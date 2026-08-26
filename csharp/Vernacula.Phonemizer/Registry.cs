/**
 * Language registry: code → canonical-IPA phonemizer. Deliberately tiny and explicit (one row per
 * language), built lazily and cached. No fallback — an unknown language throws.
 * Ported from src/registry.ts — see that file for the corpus evidence.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * C# REGISTRATION PATTERN (port note — read before adding a language)
 *
 * The TS registry imports every `create<Language>` factory statically. The C# port compiles BEFORE
 * any language is ported, so factories arrive by REGISTRATION instead of imports:
 *
 *   · A language module registers itself once:  `Registry.Register("thai", () => new Thai(...));`
 *     Languages/Bootstrap.cs triggers them all; the Build switch below never changes.
 *   · The Build switch resolves through `Create(key)`; an unregistered key throws
 *     NotImplementedException("port pending: <key>") — the compile-now stub behaviour.
 *   · Keys are the TS module names ("english", "arabic", …); the Arabic VARIETIES are separate keys
 *     ("arabic:egyptian", …) that the one Arabic module registers in a loop.
 *   · Factory ARGUMENTS in the TS switch (readAsEnglish, the English knownWord lookups) become
 *     Registry statics — `Registry.ReadAsEnglish`, `Registry.EnglishKnownWord` — that a factory
 *     closure captures at registration. The per-case `// TS:` comments below record which case
 *     passed what.
 *   · Per-language ROMAN_POLICY objects (imported statically in TS) arrive the same way:
 *     `Registry.RegisterRomanPolicy("es", policy)` from each language's romanOrdinals port.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer;

public static class Registry
{
    // ─── Registration surface (C#-only; see the header) ────────────────────────────────────────

    private static readonly Dictionary<string, Func<ILanguage>> Factories = new();

    /// <summary>Register a language factory under its module key (e.g. "english", "arabic:egyptian").</summary>
    public static void Register(string key, Func<ILanguage> factory) => Factories[key] = factory;

    /// <summary>The single language stub helper: resolve a registered factory or throw the
    /// compile-now placeholder.</summary>
    /**
     * Every language key a run ASKED FOR and did not get.
     *
     * ⚠ A MISSING ENGINE IS INVISIBLE AT THE CALL SITE. The script router reads an embedded foreign run
     * through another language's engine and CATCHES the failure, so an unported target does not raise — the
     * run is silently dropped and the row merely differs, looking like an ordinary porting bug. The parity
     * gate reads this set so "blocked on an unported dependency" is a distinct answer from "wrong".
     */
    private static readonly SortedSet<string> PortPendingRequested = new(StringComparer.Ordinal);

    /// <summary>Language keys requested during this process that have no registered factory.</summary>
    public static IReadOnlyCollection<string> PortPending
    {
        get { lock (PortPendingRequested) return PortPendingRequested.ToArray(); }
    }

    /// <summary>Reset the pending set. ⚠ FOR THE PARITY GATE, and for the same reason
    /// <c>Foreign.ClearForeignOov</c> exists: the set is process-wide, so once ANY language has asked for an
    /// unported engine every later row inherits the entry and "did THIS row block?" becomes unanswerable.
    /// Clearing per row is what makes blocked-vs-wrong a per-row verdict instead of a run-wide guess.</summary>
    public static void ClearPortPending()
    {
        lock (PortPendingRequested) PortPendingRequested.Clear();
    }

    /**
     * Run the language bootstrap once — the C# stand-in for registry.ts's static imports.
     *
     * ⚠ EVERY ENTRY POINT MUST CALL THIS, not just the sync one. Reached only from `Create`, the FIRST
     * `PhonemizeAsync` finds the neural table unset, falls back to the sync engine, and installs the table on
     * its way through — one wrong utterance per process, with nothing to see from the second call onwards.
     */
    public static void EnsureLanguages() => Languages.Bootstrap.EnsureRegistered();

    private static ILanguage Create(string key)
    {
        EnsureLanguages();
        if (Factories.TryGetValue(key, out var f)) return f();
        lock (PortPendingRequested) PortPendingRequested.Add(key);
        throw new NotImplementedException($"port pending: {key}");
    }

    /**
     * Per-language ROMAN NUMERAL policy: how this language reads a Roman numeral, including whether a century
     * is a cardinal or an ordinal. The data lives in each language's own directory and is assembled here
     * because the pass runs ABOVE the engines.
     *
     * C# port: populated by each language's romanOrdinals port via RegisterRomanPolicy, where the TS imports
     * the policies statically.
     */
    private static readonly Dictionary<string, RomanPolicy> ROMAN_POLICIES = new();

    public static void RegisterRomanPolicy(string code, RomanPolicy policy) => ROMAN_POLICIES[code] = policy;

    // ─── Foreign-run wiring (module-load side effects in TS → static ctor here) ────────────────

    // Embedded FOREIGN runs are read as English. ⚠ REGISTERED HERE rather than imported by Core, so Core
    // keeps its no-dependency position — the TS does this as a module-load side effect, the C# in a static
    // constructor.
    static Registry()
    {
        // ⚠ Before anything else: an engine running without Unicode normalization returns wrong
        // phonemes instead of failing (see Core/Globalization.cs).
        Core.Globalization.AssertNormalizationWorks();

        Foreign.SetDefaultForeign(ReadAsEnglish);

        // SCRIPT ROUTING. The line above reads every foreign run as ENGLISH, which is right for Latin and wrong
        // for every other script. The router picks a reader from the run's SCRIPT, with the host language's own
        // overrides applied (a Han run inside Japanese is Japanese, not Mandarin).
        Foreign.SetScriptReader((run, host) =>
        {
            // `text` is the run itself except for the LONE GREEK LETTER, which Scripts rewrites to its Greek-spelled
            // NAME — a declined run is a deleted run.
            var routed = Scripts.ReaderFor(run, host);
            if (routed is null) return null;
            var (target, text) = routed.Value;
            try
            {
                // A LATIN run routes here, not to the default foreign reader: the router is asked first and the Latin
                // target is "en", so this is the path that actually reads embedded Latin — hence the OOV readings.
                return target == "en" ? ReadAsEnglish(text) : GetPhonemizer(target).Text(text);
            }
            catch
            {
                // An unbuilt or unknown target must not take the whole utterance down; declining here falls back
                // to the Latin-to-English path, which is what happened before this existed.
                return null;
            }
        });
    }

    /**
     * Read a foreign run as ENGLISH, with whatever NEURAL OOV readings the async entries prewarmed.
     *
     * ⚠ `TextWithOov`, not `Text`. Both English-reading paths are typed SYNCHRONOUS, so a delegated run would
     * otherwise get the n-gram OOV g2p even under `PhonemizeAsync` — and delegated runs are overwhelmingly
     * proper nouns, exactly the tail the BiLSTM exists for. Going through `GetPhonemizer("en").Text` is what
     * loses the third argument, so `FoldPass` + `WithHost` reproduce here what the shadow would have applied
     * (`RomanPass` is a no-op, `en` being ROMAN_NATIVE). The memo is empty on the sync path, so `Phonemize`
     * stays byte-identical.
     *
     * THE ONE ENGLISH READER FOR EMBEDDED TEXT, used from all three places a foreign run can be read — the
     * default reader, the router's Latin target, and the reader threaded into the engines that claim Latin
     * themselves — because fixing only one of them fixes almost nothing.
     */
    public static string ReadAsEnglish(string text)
    {
        return Foreign.WithHost("en", () =>
            ((IEnglishPhonemizer)RawEngine("en")).TextWithOov(FoldPass("en", text), Foreign.LookupForeignOov));
    }

    /// <summary>The English dictionary lookup the TS switch threads into Naija (`knownWord`), and whose
    /// non-null test Zulu/Xhosa receive as their `isEnglishWord` predicate.</summary>
    public static string? EnglishKnownWord(string latin) =>
        ((IEnglishPhonemizer)RawEngine("en")).KnownWord(latin);

    /** Languages whose own script has a digit that is not always a digit; they fold inside normalize.ts. */
    private static readonly IReadOnlySet<string> FOLD_OPT_OUT = new HashSet<string> { "te" };

    /**
     * Languages whose own normalization already reads the VULGAR FRACTIONS, and reads them BETTER than the
     * fold can — with the "and" that joins a mixed number, which the fold cannot supply. The fold is for the
     * languages that DROP the fraction and must not pre-empt these.
     */
    private static readonly IReadOnlySet<string> VULGAR_FOLD_OPT_OUT =
        new HashSet<string> { "az", "ca", "el", "ga", "hr", "kn", "mk", "te", "uz" };

    private static readonly Dictionary<string, ILanguage> Cache = new();

    /**
     * The raw engine instances. ⚠ THE TS KEEPS THESE IMPLICITLY: its shadow REPLACES `text` on the instance,
     * and the cache holds the instance itself. A C# interface member cannot be monkey-patched, so the raw
     * engine and its pre-passed wrapper are two entries instead of one — the observable behaviour is
     * identical, and the English casts go through here exactly as the TS casts go through its cache.
     */
    private static readonly Dictionary<string, ILanguage> Engines = new();

    /**
     * The UNWRAPPED `Text` of each built engine — the function the pre-passes are wrapped around. Populated
     * when `GetPhonemizer` installs the shadow; read by `RenderInHost` for the one caller that has already run
     * the pre-passes itself.
     */
    private static readonly Dictionary<string, Func<string, string>> Unwrapped = new();

    private static readonly object Gate = new();

    private static ILanguage RawEngine(string lang)
    {
        GetPhonemizer(lang); // builds and installs
        return Engines[lang];
    }

    /**
     * Languages whose own normalization already resolves Roman numerals, with more context than a shared pass
     * can have. The shared pass must not pre-empt them.
     */
    private static readonly IReadOnlySet<string> ROMAN_NATIVE =
        new HashSet<string> { "en", "en-GB", "en-IN", "fr", "fr-CA" };

    /**
     * Shared ROMAN NUMERAL pass, applied at the single dispatch point rather than in every engine, and BEFORE
     * the engine's tokenizer — which is what lets it work in the engines that drop Latin runs. It rewrites to
     * DIGITS, so each language's own cardinal compositor does the pronouncing.
     */
    private static string RomanPass(string lang, string input)
    {
        if (ROMAN_NATIVE.Contains(lang)) return input;
        // A language's own policy wins; otherwise it still gets its homograph exclusions.
        var policy = ROMAN_POLICIES.TryGetValue(lang, out var p)
            ? p
            : new RomanPolicy
            {
                Exclude = Roman.ROMAN_EXCLUSIONS.TryGetValue(lang, out var ex) ? ex : null,
            };
        return Roman.NormalizeRomans(input, policy);
    }

    /**
     * The shared CHARACTER-LEVEL pre-passes, in order. Runs AFTER `RomanPass` — see `PrePass`.
     *
     * ⚠ THE ORDER IS THE CONTRACT, and each step below depends on the ones before it:
     *   · MARKUP FIRST, for every language including the ROMAN_NATIVE ones — a tag is not text in any of them.
     *   · DOUBLE-ENCODED UTF-8 IS REPAIRED BEFORE ANYTHING READS A CHARACTER: the injected `Â`/`Ã` are
     *     LETTERS, so mojibake makes every downstream guard misfire.
     *   · `FoldLatinConfusables` AFTER the mojibake decode, because a double-encoded sequence can itself
     *     produce Latin-1 letters.
     *   · THE CYRILLIC STRESS MARK IS FOLDED LAST, after the Cyrillic confusable fold: that pass rewrites a
     *     Latin look-alike inside a Cyrillic word to its Cyrillic letter, so running this first would leave
     *     the annotation sitting on a Latin base and miss it. Applied for EVERY language, because the
     *     discriminator is the BASE CHARACTER, not the host.
     *   · NATIVE DIGITS ARE FOLDED LAST OF ALL, and for every language: a digit is script-MARKED but
     *     language-NEUTRAL in value, which is what separates it from a letter. ⚠ BUT A NATIVE DIGIT IS NOT
     *     ALWAYS A DIGIT — a script whose digit doubles as a homoglyph opts out and folds inside its own
     *     normalize, after its own disambiguation.
     *   · ℃/℉ unconditionally: there is no language for which `℃` means something other than `°C`.
     *
     * The per-language folds already in the engines stay: folding is idempotent.
     */
    private static string FoldPass(string lang, string input)
    {
        var folded = Unicode.FoldCyrillicStressMarks(
            Unicode.FoldCaretExponents(
                Unicode.FoldLatinConfusables(
                    Unicode.FoldCyrillicConfusables(
                        Unicode.FoldFullwidthLatin(
                            Unicode.FoldSquaredDegrees(
                                Unicode.RepairDoubleEncoded(
                                    Markup.StripMarkup(input)))),
                        Scripts.CYRILLIC_HOSTS.Contains(lang)))));
        var pre = VULGAR_FOLD_OPT_OUT.Contains(lang) ? folded : Unicode.FoldVulgarFractions(folded);
        return FOLD_OPT_OUT.Contains(lang) ? pre : Unicode.FoldNativeDigits(pre);
    }

    /**
     * EVERY shared pre-pass `GetPhonemizer` applies, as one function — the whole of what an engine's `Text`
     * sees before its own tokenizer does.
     *
     * ⚠ PUBLIC FOR THE ASYNC PATH. The neural entries build their engine directly (they need constructor
     * arguments the registry's instance does not carry, and the `oovOverride` argument the shadow would drop),
     * so they never reach the shadow and every pre-pass silently did not run for them. They call this on the
     * input instead, so there is ONE definition of the chain and the opt-out lists cannot drift between the
     * two entry points.
     *
     * ⚠ ROMANS OUTERMOST — before markup stripping, matching the layering in `GetPhonemizer`. Not
     * interchangeable: `StripMarkup` decodes entities, so running it first would let `&amp;lt;` become a real
     * `<` for the numeral scan.
     */
    public static string PrePass(string lang, string input) => FoldPass(lang, RomanPass(lang, input));

    /**
     * Render `input` with `lang`'s engine and `lang` as the foreign-run host, WITHOUT re-running `PrePass` —
     * for a caller that has already pre-passed. ⚠ THE CHAIN IS NOT IDEMPOTENT: `StripMarkup` decodes entities,
     * so a doubly-escaped `&amp;lt;` would decode to `<` on the first pass and be stripped as markup on the
     * second.
     */
    public static string RenderInHost(string lang, string input)
    {
        GetPhonemizer(lang); // builds and installs, populating `unwrapped`
        if (!Unwrapped.TryGetValue(lang, out var engine))
            throw new InvalidOperationException($"no engine for language: {lang}");
        return Foreign.WithHost(lang, () => engine(input));
    }

    /** Get (and memoize) the phonemizer for a language code. */
    public static ILanguage GetPhonemizer(string lang)
    {
        lock (Gate)
        {
            if (Cache.TryGetValue(lang, out var cached)) return cached;
            var engine = Build(lang);
            Engines[lang] = engine;
            // The shared PRE-PASSES (`prePass` above) run here, at the single dispatch point, before the
            // engine's own tokenizer sees a character.
            //
            // TS SHADOWS `text` on the engine instance rather than wrapping it in a fresh object, because some
            // engines expose more than the interface and a wrapper would silently drop those members. C# cannot
            // monkey-patch an interface member, so the wrapper object returns and the extra members are reached
            // through `Engines`/`RawEngine` instead — same observable behaviour, different plumbing.
            Func<string, string> original = engine.Text;
            Unwrapped[lang] = original;
            ILanguage p = new Shadowed(lang, original);
            if (!ROMAN_NATIVE.Contains(lang))
            {
                // Roman numerals OUTSIDE the shadow, so they are rewritten to digits before markup stripping —
                // see `prePass`, which reproduces this layering for the async path.
                var inner = p;
                p = new RomanWrapped(lang, inner);
            }
            Cache[lang] = p;
            return p;
        }
    }

    private sealed class Shadowed : ILanguage
    {
        private readonly string _lang;
        private readonly Func<string, string> _original;

        internal Shadowed(string lang, Func<string, string> original)
        {
            _lang = lang;
            _original = original;
        }

        // The host language has to be known while the engine runs, because a foreign run is
        // resolved DURING tokenization, deep inside `emitUnclaimed`. A stack, since reading a
        // foreign run re-enters this same wrapper for another language.
        public string Text(string input) =>
            Foreign.WithHost(_lang, () => _original(FoldPass(_lang, input)));
    }

    private sealed class RomanWrapped : ILanguage
    {
        private readonly string _lang;
        private readonly ILanguage _engine;

        internal RomanWrapped(string lang, ILanguage engine)
        {
            _lang = lang;
            _engine = engine;
        }

        public string Text(string input) => _engine.Text(RomanPass(_lang, input));
    }

    private static ILanguage Build(string lang)
    {
        switch (lang)
        {
            case "en":
                return Create("english");
            case "en-GB":
                return Create("english-gb");
            case "en-IN":
                return Create("english-in");
            case "cmn":
                return Create("mandarin"); // TS: createMandarin(readAsEnglish)
            case "es":
                return Create("spanish");
            case "es-419":
                return Create("spanish-419");
            case "ar":
                return Create("arabic");
            case "arz":
                return Create("arabic:egyptian");
            case "apc":
                return Create("arabic:levantine");
            case "apd":
                return Create("arabic:sudanese");
            case "acm":
                return Create("arabic:iraqi");
            case "afb":
                return Create("arabic:gulf");
            case "ary":
                return Create("arabic:moroccan");
            case "ayl":
                return Create("arabic:libyan");
            case "ajp":
                return Create("arabic:southlevantine");
            case "acw":
                return Create("arabic:hijazi");
            case "fr":
                return Create("french");
            case "fr-CA":
                return Create("french-ca");
            case "pt":
                return Create("portuguese");
            case "pt-BR":
                return Create("portuguese-br");
            case "ru":
                return Create("russian");
            case "de":
                return Create("german");
            case "nl":
                return Create("dutch");
            case "ja":
                return Create("japanese");
            case "tr":
                return Create("turkish");
            case "az":
                return Create("azerbaijani");
            case "mg":
                return Create("malagasy");
            case "vi":
                return Create("vietnamese"); // TS: createVietnamese(readAsEnglish)
            case "ta":
                return Create("tamil");
            case "sv":
                return Create("swedish");
            case "ca":
                return Create("catalan");
            case "gl":
                return Create("galician");
            case "gd":
                return Create("scottishgaelic");
            case "ga":
                return Create("irish");
            case "cy":
                return Create("welsh");
            case "ko":
                return Create("korean");
            case "ha":
                return Create("hausa");
            case "th":
                return Create("thai");
            case "shn":
                return Create("shan");
            case "lo":
                return Create("lao");
            case "ff":
                return Create("fula");
            case "si":
                return Create("sinhala");
            case "kl":
                return Create("kalaallisut");
            case "kk":
                return Create("kazakh");
            case "tg":
                return Create("tajik");
            case "zu":
                return Create("zulu"); // TS: createZulu(readAsEnglish, w => en.knownWord(w) !== undefined)
            case "xh":
                return Create("xhosa"); // TS: createXhosa(readAsEnglish, w => en.knownWord(w) !== undefined)
            case "sr":
                return Create("serbian");
            case "hr":
                return Create("croatian");
            case "bs":
                return Create("bosnian");
            case "sl":
                return Create("slovenian");
            case "da":
                return Create("danish");
            case "fi":
                return Create("finnish");
            case "et":
                return Create("estonian");
            case "sk":
                return Create("slovak");
            case "hu":
                return Create("hungarian");
            case "kmr":
                return Create("kurmanji");
            case "cs":
                return Create("czech");
            case "hi":
                return Create("hindi"); // TS: createHindi(readAsEnglish)
            case "bn":
                return Create("bengali"); // TS: createBengali(readAsEnglish)
            case "as":
                return Create("assamese"); // TS: createAssamese(readAsEnglish)
            case "bpy":
                return Create("bishnupriya"); // TS: createBishnupriya(readAsEnglish)
            case "so":
                return Create("somali");
            case "ceb":
                return Create("cebuano");
            case "hil":
                return Create("hiligaynon");
            case "ilo":
                return Create("ilocano");
            case "ur":
                return Create("urdu"); // TS: createUrdu(readAsEnglish)
            case "id":
                return Create("indonesian"); // TS: createIndonesian(readAsEnglish)
            case "ms":
            case "zsm":
                return Create("malay"); // TS: createMalay(readAsEnglish)
            case "pa":
                return Create("punjabi"); // TS: createPunjabi(readAsEnglish)
            case "pnb":
                return Create("punjabi"); // TS: createPunjabi(readAsEnglish)
            case "ro":
                return Create("romanian");
            case "skr":
                return Create("saraiki"); // TS: createSaraiki(readAsEnglish)
            case "mr":
                return Create("marathi"); // TS: createMarathi(readAsEnglish)
            case "te":
                return Create("telugu"); // TS: createTelugu(readAsEnglish)
            case "yue":
                return Create("cantonese"); // TS: createCantonese(readAsEnglish)
            case "tl":
                return Create("tagalog");
            case "om":
            // ⚠ A FOREIGN READER IS NEEDED HERE despite Oromo being Latin-script — that is what makes it
            // necessary, not what makes it unnecessary: the word group claims Latin text, so an accented
            // foreign name is claimed and then mangled by a g2p with no rule for the letter.
                return Create("oromo"); // TS: createOromo(readAsEnglish)
            case "pl":
                return Create("polish");
            case "sd":
                return Create("sindhi"); // TS: createSindhi(readAsEnglish)
            case "fa":
                return Create("persian"); // TS: createPersian(readAsEnglish)
            case "it":
                return Create("italian");
            case "pcm":
                return Create("naija"); // TS: createNaija(latin => en.knownWord(latin)) — use Registry.EnglishKnownWord
            case "wuu":
                return Create("wu"); // TS: createWu(readAsEnglish)
            case "cjy":
                return Create("jin"); // TS: createJin(readAsEnglish)
            case "hak":
                return Create("hakka"); // TS: createHakka(readAsEnglish)
            case "hsn":
                return Create("xiang"); // TS: createXiang(readAsEnglish)
            case "gan":
                return Create("gan"); // TS: createGan(readAsEnglish)
            // ⚠ NO FOREIGN READER, AND THE ABSENCE IS THE DECISION — do not add one to match the
            // neighbouring cases. Akan is written in Latin, so its tokenizer claims every Latin run and
            // NATIVISES it: there is no unclaimed-run seam for a reader to sit in.
            case "ak":
                return Create("akan");
            case "jv":
                return Create("javanese");
            case "sw":
                return Create("swahili");
            case "gu":
                return Create("gujarati"); // TS: createGujarati(readAsEnglish)
            case "ps":
            case "pbt":
                return Create("pashto"); // TS: createPashto(readAsEnglish)
            case "kn":
                return Create("kannada"); // TS: createKannada(readAsEnglish)
            case "ml":
                return Create("malayalam"); // TS: createMalayalam(readAsEnglish)
            case "or":
                return Create("odia"); // TS: createOdia(readAsEnglish)
            case "uz":
                return Create("uzbek");
            case "am":
                return Create("amharic"); // TS: createAmharic(readAsEnglish)
            case "ti":
                return Create("tigrinya"); // TS: createTigrinya(readAsEnglish)
            case "bg":
                return Create("bulgarian");
            case "mk":
                return Create("macedonian");
            case "kea":
                return Create("kabuverdianu");
            case "mt":
                return Create("maltese");
            case "lb":
                return Create("luxembourgish");
            case "fo":
                return Create("faroese");
            case "is":
                return Create("icelandic");
            case "oc":
                return Create("occitan");
            case "haw":
                return Create("hawaiian");
            case "mi":
                return Create("maori"); // TS: createMaori(readAsEnglish)
            case "qu":
                return Create("quechua");
            case "bo":
                return Create("tibetan");
            case "gn":
                return Create("guarani");
            case "sq":
                return Create("albanian");
            case "tk":
                return Create("turkmen");
            case "tt":
                return Create("tatar");
            case "mto":
                return Create("totontepecmixe");
            case "chr":
                return Create("cherokee");
            case "smj":
                return Create("lulesami");
            case "nci":
                return Create("nahuatl");
            case "nog":
                return Create("nogai");
            case "la":
                return Create("latin");
            case "sat":
                return Create("santali");
            case "quc":
                return Create("kichee");
            case "ba":
                return Create("bashkir");
            case "eu":
                return Create("basque");
            case "kaa":
                return Create("karakalpak");
            case "crh":
                return Create("crimeantatar");
            case "pap":
                return Create("papiamento");
            case "naq":
                return Create("nama");
            case "rup":
                return Create("aromanian");
            case "ab":
                return Create("abkhaz");
            case "chv":
                return Create("chuvash");
            case "ee":
                return Create("ewe");
            case "an":
                return Create("aragonese");
            case "ast":
                return Create("asturian");
            case "ht":
                return Create("haitian");
            case "rkt":
                return Create("rangpuri"); // TS: createRangpuri(readAsEnglish)
            case "bar":
                return Create("bavarian");
            case "cdo":
                return Create("mindong");
            case "hmn":
                return Create("hmong");
            case "shi":
                return Create("tashelhit");
            case "ckb":
                return Create("centralkurdish"); // TS: createCentralKurdish(readAsEnglish)
            case "bal":
                return Create("balochi"); // TS: createBalochi(readAsEnglish)
            case "bho":
                return Create("bhojpuri"); // TS: createBhojpuri(readAsEnglish)
            case "mag":
                return Create("magahi"); // TS: createMagahi(readAsEnglish)
            case "bgc":
                return Create("hindi"); // TS: createHindi(readAsEnglish)
            case "hne":
                return Create("chhattisgarhi"); // TS: createChhattisgarhi(readAsEnglish)
            case "za":
                return Create("zhuang");
            case "awa":
                return Create("awadhi"); // TS: createAwadhi(readAsEnglish)
            case "mai":
                return Create("maithili"); // TS: createMaithili(readAsEnglish)
            case "uk":
                return Create("ukrainian");
            case "be":
                return Create("belarusian");
            case "hy":
                return Create("armenian");
            case "hyw":
                return Create("westarmenian");
            case "ky":
                return Create("kyrgyz");
            case "nb":
                return Create("norwegian");
            case "su":
                return Create("sundanese");
            case "ne":
                return Create("nepali"); // TS: createNepali(readAsEnglish)
            case "nan":
                return Create("minnan"); // TS: createMinnan(readAsEnglish)
            case "mn":
                return Create("mongolian");
            case "umb":
                return Create("umbundu");
            case "yo":
                return Create("yoruba"); // TS: createYoruba(readAsEnglish)
            case "ig":
                return Create("igbo");
            case "my":
                return Create("burmese"); // TS: createBurmese(readAsEnglish)
            case "sn":
                return Create("shona");
            case "rw":
                return Create("kinyarwanda");
            case "mad":
                return Create("madurese");
            case "nya":
                return Create("chichewa");
            case "ln":
                return Create("lingala");
            case "km":
                return Create("khmer");
            case "tn":
                return Create("setswana");
            case "st":
                return Create("sesotho");
            case "nso":
                return Create("sepedi");
            case "bm":
                return Create("bambara");
            case "wo":
                return Create("wolof");
            case "mos":
                return Create("mossi");
            case "ki":
                return Create("kikuyu");
            case "kam":
                return Create("kamba");
            case "ka":
                return Create("georgian");
            case "lt":
                return Create("lithuanian");
            case "lv":
                return Create("latvian");
            case "ltg":
                return Create("latgalian");
            case "af":
                return Create("afrikaans");
            case "he":
                return Create("hebrew");
            case "lg":
                return Create("luganda");
            case "luo":
                return Create("luo");
            case "rn":
                return Create("kirundi");
            case "ug":
                return Create("uyghur");
            case "syl":
                return Create("sylheti");
            case "el":
                return Create("greek");
            case "grc":
                return Create("ancientgreek");
            default:
                throw new ArgumentException(
                    $"vernacula-phonemizer: no phonemizer registered for \"{lang}\"");
        }
    }
}
