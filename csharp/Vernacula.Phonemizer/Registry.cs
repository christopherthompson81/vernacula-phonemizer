/**
 * Language registry: code → canonical-IPA phonemizer. Deliberately tiny and explicit (one row per
 * language), built lazily and cached. No fallback — an unknown language throws.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * C# REGISTRATION PATTERN (port note — read before adding a language)
 *
 * The TS registry imports every `create<Language>` factory statically. The C# port compiles BEFORE
 * any language is ported, so factories arrive by REGISTRATION instead of imports:
 *
 *   · A language module registers itself once:  `Registry.Register("thai", () => new Thai(...));`
 *     (each language file carries a small static bootstrap; `Registry.RegisterAll()` in the future
 *     languages layer, or a ModuleInitializer, triggers them — the Build switch below never changes).
 *   · The Build switch resolves through `Create(key)`; an unregistered key throws
 *     NotImplementedException("port pending: <key>") — the compile-now stub behaviour.
 *   · Keys are the TS module names ("english", "arabic", …); the Arabic VARIETIES are separate keys
 *     ("arabic:egyptian", …) that the one Arabic module registers in a loop.
 *   · Factory ARGUMENTS in the TS switch (readAsEnglish, the English knownWord lookups) become
 *     Registry statics — `Registry.ReadAsEnglish`, `Registry.EnglishKnownWord` — that a factory
 *     closure captures at registration. The per-case comments below record which case passed what.
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
    private static ILanguage Create(string key) =>
        Factories.TryGetValue(key, out var f)
            ? f()
            : throw new NotImplementedException($"port pending: {key}");

    /**
     * Per-language ROMAN NUMERAL policy: how this language reads a Roman numeral, including whether a
     * century is a cardinal or an ordinal. The data lives in each language's own directory (so it can build
     * on that language's cardinal compositor) and is assembled here because the pass runs ABOVE the engines.
     *
     * Only the languages where Roman numerals measurably occur are wired — evidence from the FLEURS corpora,
     * which is also why es/pt/ca supply an ordinal for anniversaries but leave CENTURIES cardinal, the
     * reading those languages actually use.
     *
     * (C# port: populated by each language's romanOrdinals port via RegisterRomanPolicy — the TS wires
     * es, es-419, pt, pt-BR, it, ro, ca, ru, pl, uk, be, hu, az, kk, uz, ba, tt, chv, tk.)
     */
    private static readonly Dictionary<string, RomanPolicy> ROMAN_POLICIES = new();

    public static void RegisterRomanPolicy(string code, RomanPolicy policy) => ROMAN_POLICIES[code] = policy;

    // ─── Foreign-run wiring (module-load side effects in TS → static ctor here) ────────────────

    // Embedded FOREIGN runs (a brand name, acronym or code-switched phrase in a script the engine does not
    // own) are read as English — the same choice the engines that already handle Latin make. Registered
    // here rather than imported by core/, so core keeps its no-dependency position. Without this, the 47
    // engines whose tokenizer matches only their own script DROP such text silently (core/foreign.ts).
    static Registry()
    {
        Foreign.SetDefaultForeign(ReadAsEnglish);

        // SCRIPT ROUTING (core/scripts.ts). The line above reads every foreign run as ENGLISH, which is correct
        // for Latin and wrong for every other script — and in practice a non-Latin run never reached it at all,
        // because `emitUnclaimed` surfaced only Latin. So `Ο Πούτιν και ο Владимир` read as "o putin ce o" with
        // the Cyrillic silently gone. The router picks a reader from the run's SCRIPT, with the host language's
        // own overrides applied (a Han run inside Japanese is Japanese, not Mandarin).
        Foreign.SetScriptReader((run, host) =>
        {
            // `text` is the run itself except for the LONE GREEK LETTER, which core/scripts.ts rewrites to its
            // Greek-spelled NAME (⟨α⟩ → «άλφα») — the run used to be declined here, and a declined run is deleted.
            var routed = Scripts.ReaderFor(run, host);
            if (routed is null) return null;
            var (target, text) = routed.Value;
            try
            {
                // A LATIN run routes here, not to `setDefaultForeign` — `emitUnclaimed` asks the router first and
                // `SCRIPT_TARGET.Latin` is "en", so this is the path that actually reads embedded Latin. It therefore
                // needs the prewarmed OOV readings too; without this the fix reached only the runs the router declined.
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
     * Read a foreign run as ENGLISH, with whatever NEURAL OOV readings the async entries prewarmed (core/foreign.ts).
     *
     * ⚠ `textWithOov`, not `text`. Both English-reading paths below are typed SYNCHRONOUS, so before this a delegated
     * run got the n-gram OOV G2P even under `phonemizeAsync` — and delegated runs are overwhelmingly proper nouns,
     * i.e. exactly the OOV tail the BiLSTM exists for. Going through `getPhonemizer("en").text` is what loses the
     * third argument (that shadow is one-arg), so `foldPass` + `withHost` reproduce here what the shadow would have
     * applied; `romanPass` is a no-op, `en` being ROMAN_NATIVE. The memo is empty on the sync path, so `phonemize`
     * stays byte-identical.
     *
     * THE ONE ENGLISH READER FOR EMBEDDED TEXT, used from all three places a foreign run can be read, because
     * fixing only one of them fixes almost nothing:
     *   1. `setDefaultForeign` below — the fallback for runs the script router declines;
     *   2. `setScriptReader`'s Latin target — where an embedded Latin run ACTUALLY goes, the router being asked first;
     *   3. the `readAsEnglish` argument threaded into the ~46 engines that claim Latin themselves (mandarin, hindi,
     *      sindhi, amharic, vietnamese, …) — those never reach 1 or 2 at all.
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

    /** Languages whose own normalization already reads the VULGAR FRACTIONS, and reads them BETTER than the fold
     *  can — with the "and" that joins a mixed number. ca says *vint-i-nou I tres quarts* and mk *…ˈи три
     *  четврт…*; the fold, which only rewrites `¾` to ` 3/4`, drops that conjunction because supplying it needs a
     *  per-language word in a per-language position. Measured over the artifacts: 36 languages carry a vulgar
     *  fraction, 27 DROP it and these 9 already handle it, so the fold is for the 27 and must not pre-empt the 9.
     *  Found by the test suite — ca's and mk's fraction tests failed on the missing conjunction, which is exactly
     *  the regression an opt-out exists to prevent. */
    private static readonly IReadOnlySet<string> VULGAR_FOLD_OPT_OUT =
        new HashSet<string> { "az", "ca", "el", "ga", "hr", "kn", "mk", "te", "uz" };

    private static readonly Dictionary<string, ILanguage> Cache = new();

    /** The raw engine instances (the TS keeps these implicitly, because its shadow REPLACES `text` on the
     *  instance and the cache holds the instance itself — a C# interface member cannot be monkey-patched, so
     *  the raw engine and its pre-passed wrapper are two entries instead of one; the observable behaviour is
     *  identical, and the English casts above go through here exactly as the TS casts go through its cache). */
    private static readonly Dictionary<string, ILanguage> Engines = new();

    /** The UNWRAPPED `text` of each built engine — the function the pre-passes are wrapped around, keyed by the
     *  code it was built for. Populated when `getPhonemizer` installs the shadow; read by `renderInHost` for the
     *  one caller that has already run the pre-passes itself (see there). */
    private static readonly Dictionary<string, Func<string, string>> Unwrapped = new();

    private static readonly object Gate = new();

    private static ILanguage RawEngine(string lang)
    {
        GetPhonemizer(lang); // builds and installs
        return Engines[lang];
    }

    /** Languages whose own normalization already resolves Roman numerals, with more context than a shared
     *  pass can have — English distinguishes regnal ("henry viii" → the eighth) from cardinal ("world war
     *  ii" → two); French reads the ordinal `XIVe`. The shared pass must not pre-empt them. */
    private static readonly IReadOnlySet<string> ROMAN_NATIVE =
        new HashSet<string> { "en", "en-GB", "en-IN", "fr", "fr-CA" };

    /** Shared ROMAN NUMERAL pass (core/roman.ts), applied at the single dispatch point rather than in 190
     *  engines — and BEFORE the engine's tokenizer, which is what lets it work in the engines that drop Latin
     *  runs (`XIX век` would otherwise lose the numeral). It rewrites to DIGITS, so each language's own cardinal
     *  compositor does the pronouncing. A no-op for the languages that read Roman numerals themselves. */
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
     * The shared CHARACTER-LEVEL pre-passes, in order. Runs AFTER `romanPass` — see `prePass`.
     *
     * MARKUP first, and for EVERY language including the ROMAN_NATIVE ones: a tag is not text in any of them.
     * Without it `km<sup>2</sup>` was spoken as "sup … sup" (core/markup.ts).
     *
     * NATIVE DIGITS ARE FOLDED FOR EVERY LANGUAGE, at the single dispatch point.
     *
     * A digit is script-MARKED but language-NEUTRAL in value, and that is what separates it from a letter. A
     * Cyrillic word inside English text is Russian and wants the script router; `٢٠٢٤` inside English text is
     * just 2024, and an English reader says "twenty twenty-four" — routing it to Arabic would be wrong.
     *
     * Two defects this closes at once. Embedded foreign digits were DROPPED everywhere: the gap pass surfaces
     * runs of `\p{L}`, so a digit run matched nothing and the router never saw it — `phonemize("Year ٢٠٢٤",
     * "en")` was "jˈɪɹ". And seven engines read their OWN digits as an empty string (sd ug ps bal syl rkt shn),
     * because a raw block range in the tokenizer's LETTER class swallowed them — the Central Kurdish defect,
     * which no gate could see because a claimed-but-empty token leaves no gap.
     *
     * Per-language folds already in twelve normalize.ts files stay: folding is idempotent, and they document the
     * reason locally where the corpus proved it.
     * ⚠ A NATIVE DIGIT IS NOT ALWAYS A DIGIT. Telugu ౦ (DIGIT ZERO) is a homoglyph for the anusvara ం and is a
     * typo for it in all 144 corpus instances; folding it to "0" globally would pre-empt the language's own
     * disambiguation, which uses context the registry does not have. Such a language opts out and folds inside
     * its own normalize.ts, AFTER the homoglyph rule — see telugu/normalize.ts.
     * ℃/℉ ARE FOLDED FOR EVERY LANGUAGE TOO, and unconditionally — there is no opt-out list because there is no
     * language for which `℃` means something other than `°C`. 52 of the 65 languages with an artifact already
     * read `°C` and dropped `℃` entirely, losing the unit and not merely the sign; the 13 that handled both had
     * written the arm out by hand, and folding is idempotent so they are unaffected. See `foldSquaredDegrees`
     * for why the list stops at two characters instead of being NFKC.
     * DOUBLE-ENCODED UTF-8 IS REPAIRED FIRST, before anything reads a character: mojibake is the one corruption
     * that makes every downstream guard misfire, because the injected `Â` and `Ã` are LETTERS. `19.500 kmÂ²`
     * lost its whole unit that way — the tier's trailing guard saw a letter after `km` and refused the match.
     * Measured safe across all 67 corpora (31 occurrences, all in id_id, none elsewhere); see
     * `repairDoubleEncoded`.
     * `foldLatinConfusables` sits with the other repairs, and AFTER the mojibake decode: a double-encoded
     * sequence can produce Latin-1 letters, so the confusable check wants the decoded string.
     * THE CYRILLIC STRESS MARK IS FOLDED LAST, and after the Cyrillic confusable fold on purpose: the confusable
     * pass rewrites a Latin look-alike inside a Cyrillic word to its Cyrillic letter, so running this one first
     * would leave the annotation sitting on a Latin `a` and miss it. It is applied for EVERY language rather than
     * for `CYRILLIC_HOSTS`, because the discriminator is the BASE CHARACTER — a Cyrillic quotation inside a
     * non-Cyrillic article splits exactly the same way, and the fold makes no claim about a Latin or Greek base.
     * Measured across all 162 mined artifacts before shipping: it moves the reading of 14 languages, in every case
     * by rejoining a word the annotation had split, and is byte-identical for the other 148. See
     * `foldCyrillicStressMarks`.
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
     * EVERY shared pre-pass `getPhonemizer` applies, as one function — the whole of what an engine's `text` sees
     * before its own tokenizer does.
     *
     * ⚠ EXPORTED FOR THE ASYNC PATH. `phonemizeAsync` dispatches through `neuralRegistry.ts`, whose entries build
     * their engine directly (they need constructor arguments the registry's instance does not carry — Khmer's
     * `segment: false`, Arabic's variety, and the `oovOverride` extra argument the shadow below would drop). So
     * they never reach the shadow, and every pre-pass silently did not run for them: `phonemizeAsync("سال ۲۰۲۴
     * ۾", "sd")` lost its own script's digits outright. `getNeuralPhonemizer` calls this on the input instead, so
     * there is ONE definition of the chain and the opt-out lists (`te`'s digit fold above all) cannot drift
     * between the two entry points.
     *
     * ⚠ ROMANS OUTERMOST — before markup stripping, matching the layering in `getPhonemizer`. Not
     * interchangeable: `stripMarkup` decodes entities, so running it first would let `&amp;lt;` become a real
     * `<` for the numeral scan.
     */
    public static string PrePass(string lang, string input) => FoldPass(lang, RomanPass(lang, input));

    /**
     * Render `input` with `lang`'s engine and `lang` as the foreign-run host, WITHOUT re-running `prePass`.
     *
     * For a caller that has already pre-passed — the async entries, which pre-pass once at
     * `getNeuralPhonemizer` before their tagger sees the text. Going back through `getPhonemizer(lang).text`
     * would apply the chain a SECOND time, and it is not idempotent: `stripMarkup` decodes entities, so a
     * doubly-escaped `&amp;lt;` — an author writing ABOUT a tag, the exact case core/markup.ts orders its passes
     * to protect — would decode to `<` on the first pass and be stripped as markup on the second.
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
            // TS SHADOWS `text` on the engine instance rather than wrapping it in a fresh `{ text }` object,
            // because some engines expose more than the interface — the registry itself casts the English
            // phonemizer to reach `knownWord` for Naija — and a wrapper object silently drops those members.
            // C# cannot monkey-patch an interface member, so the wrapper object returns and the extra members
            // are reached through `Engines`/`RawEngine` instead (see the field comment) — same observable
            // behaviour, different plumbing.
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
            // British English (SSBE/"BBC") — the GenAm engine + an RP lexical-set delta (accent variant of `en`).
            case "en-GB":
                return Create("english-gb");
            // General Indian English — the GenAm engine + a GIE delta (retroflexion, TH-stopping, v/w, monophthongs).
            case "en-IN":
                return Create("english-in");
            // Embedded Latin in Chinese text routes to the English phonemizer (lazy — loaded only if it appears).
            case "cmn":
                return Create("mandarin"); // TS: createMandarin(readAsEnglish)
            case "es":
                return Create("spanish");
            // Latin-American Spanish (neutral/pan-American) — Castilian engine + seseo (θ→s) + yeísmo (ʎ→ʝ).
            case "es-419":
                return Create("spanish-419");
            case "ar":
                return Create("arabic");
            case "arz": // Egyptian Arabic — shares the Arabic engine, Egyptian variety data
                return Create("arabic:egyptian");
            case "apc": // North Levantine Arabic (Syrian/Lebanese) — Levantine variety data
                return Create("arabic:levantine");
            case "apd": // Sudanese Arabic — Sudanese variety data (authored; ق→ɡ, ج→ɟ, interdentals kept)
                return Create("arabic:sudanese");
            case "acm": // Iraqi Arabic (Baghdadi gilit) — ق→ɡ, ج=d͡ʒ, interdentals kept
                return Create("arabic:iraqi");
            case "afb": // Gulf Arabic (Khaleeji) — ق→ɡ, خ→χ, ج=d͡ʒ, interdentals kept
                return Create("arabic:gulf");
            case "ary": // Moroccan Arabic (Darija) — ق kept q, ج→ʒ, interdentals→stops
                return Create("arabic:moroccan");
            case "ayl": // Libyan Arabic (Tripolitanian) — ق→ɡ, ج→ʒ, خ→χ, interdentals kept
                return Create("arabic:libyan");
            case "ajp": // South Levantine Arabic (Palestinian/Jordanian) — ق→ʔ, ج→ʒ, ث/ذ→t/d, ظ→zˤ (sibling of apc)
                return Create("arabic:southlevantine");
            case "acw": // Hijazi Arabic (western Saudi) — ق→ɡ, ج=d͡ʒ retained, خ=x, interdentals→stops/zˤ
                return Create("arabic:hijazi");
            case "fr":
                return Create("french");
            // Québécois French — the France engine + a Canadian delta (affrication t/d→t͡s/d͡z, high-vowel laxing).
            case "fr-CA":
                return Create("french-ca");
            case "pt":
                return Create("portuguese");
            // Brazilian Portuguese (neutral/paulistano) — the EP engine in `dialect: "bp"` mode (accent variant of `pt`).
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
            // Galician (galego) — Ibero-Romance sister of Portuguese; the Spanish-shaped engine + Galician deltas
            // (⟨x⟩/⟨j⟩→ʃ, ⟨g⟩→ɡ no jota, ⟨nh⟩→ŋ, coda/pre-velar ⟨n⟩→ŋ).
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
            // Shan (Tai Long) — Southwestern Tai in the SHAN ABUGIDA (Myanmar-script variant); syllable scan + EXPLICIT lexical tone marks.
            case "shn":
                return Create("shan");
            // Lao — Brahmic abugida, Thai sibling with a more phonemic orthography; leaner authored rule g2p + tone.
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
            // Croatian (hrvatski) — a THIN module that REUSES the Serbian engine's Serbo-Croatian g2p (identical
            // grapheme→IPA: č=t͡ʃ, ć=t͡ɕ, đ=d͡ʑ, dž=d͡ʒ, lj=ʎ, nj=ɲ, h=x, v=ʋ; same deferred pitch accent) and overrides only
            // the CARDINAL NUMBER WORDS (Croatian tisuća/milijun/dvjesto vs Serbian hiljada/milion/dvesta). The segmental
            // referee is wikipron hbs_latn (the Serbo-Croatian macrolanguage, which contains the Croatian words).
            case "hr":
                return Create("croatian");
            case "bs":
                return Create("bosnian");
            // Slovenian (slovenščina) — South Slavic, its OWN engine (not the BCS shared g2p): l-vocalization (coda ⟨l⟩→ʋ),
            // ⟨lj/nj⟩ coda-j-drop, syllabic-r→ər, voicing/devoicing; vowel quality/length/pitch/schwa unwritten → folded.
            case "sl":
                return Create("slovenian");
            case "da":
                return Create("danish");
            case "fi":
                return Create("finnish");
            // Estonian (eesti keel) — Uralic/Finnic sibling of Finnish; phonemic scan + gemination + first-syllable stress.
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
            // Embedded Latin in Hindi text routes to the English phonemizer (lazy — loaded only if it appears).
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
            // Standard Malay (Malaysian/Bruneian) — ALIAS to the Indonesian engine as a labelled approximation. Malay and
            // Indonesian are mutually intelligible standardisations of the same Malayic language, sharing the reformed
            // Latin orthography and largely the same grapheme→IPA phonology. There is no independent Malay referee wired,
            // and the documented differences (Malaysian final open ⟨a⟩ leaning to [ə], some vowel realisations) are
            // accent-level, not a categorical grapheme→IPA delta — so `id` is its nearest verified sibling. First-class
            // code, transparent that no Malay-specific phonology is claimed. See tools/language-catalogue (served_by='id').
            // the PHONOLOGY is still Indonesian's — createMalay wraps createIndonesian — but the two standards'
            // orthographic conventions differ (Malay groups thousands with a comma and writes the decimal dot, the exact
            // inverse of Indonesian), so Malay owns its own text-normalization pre-pass. See languages/malay/normalize.ts.
            // `ms` IS THE SAME LANGUAGE, and its absence was a live gap rather than a policy: `zsm` is the ISO 639-3
            // code for Standard Malay, `ms` the ISO 639-1 two-letter one, and `ms` is what nearly every caller and
            // dataset writes — including this repo's own `tools/corpus/mined/ms.jsonc`, whose `source` reads
            // "FLEURS ms_my". So the artifact was filed under a code the registry threw on, and a fleet sweep that
            // iterated the artifacts reported Malay as unreachable while `zsm` had been working the whole time.
            case "ms":
            case "zsm":
                return Create("malay"); // TS: createMalay(readAsEnglish)
            case "pa":
                return Create("punjabi"); // TS: createPunjabi(readAsEnglish)
            // Western Punjabi / Lahnda (Shahmukhi, Pakistan) — the SAME Punjabi engine; the scanner auto-detects the
            // Perso-Arabic script and applies the shared phonology (tonogenesis, gemination, nasal assimilation).
            case "pnb":
                return Create("punjabi"); // TS: createPunjabi(readAsEnglish)
            // Saraiki (Shahmukhi, Pakistan) — the NON-tonal Lahnda sibling of Punjabi: reuses the shared Shahmukhi
            // front-end + Lahnda phonology but keeps the voiced aspirates & aspirated sonorants (no tonogenesis) and
            // adds the four implosives ٻɓ ڄʄ ڳɠ ݙɗ.
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
                // ⚠ A FOREIGN READER IS NEEDED AFTER ALL, and the old comment's reasoning was the trap: being
                // Latin-script is exactly what made this necessary, not what made it unnecessary. Oromo's word group
                // claims Latin text, so an accented foreign NAME was claimed and then mangled by a g2p with no rule
                // for the letter — `São Paulo` read *s ˈə ˈo paˈulo*.
                return Create("oromo"); // TS: createOromo(readAsEnglish)
            case "pl":
                return Create("polish");
            case "sd":
                return Create("sindhi"); // TS: createSindhi(readAsEnglish)
            case "fa":
                return Create("persian"); // TS: createPersian(readAsEnglish)
            case "it":
                return Create("italian");
            // Naija is English-lexified: a known-English word is nativised (English dict IPA → Naija phonology), an
            // OOV word (substrate loan) falls through to the rule g2p. Pass the English DICT lookup (knownWord).
            case "pcm":
                return Create("naija"); // TS: createNaija(latin => en.knownWord(latin)) — use Registry.EnglishKnownWord
            // Embedded Latin in Wu text routes to the English phonemizer (lazy — loaded only if it appears).
            case "wuu":
                return Create("wu"); // TS: createWu(readAsEnglish)
            // Jin Chinese (Taiyuan) — Han → Sinological IPA + Chao tones; embedded Latin routes to English.
            case "cjy":
                return Create("jin"); // TS: createJin(readAsEnglish)
            // Hakka Chinese (Meixian) — same shared Han-dict engine; embedded Latin routes to English.
            case "hak":
                return Create("hakka"); // TS: createHakka(readAsEnglish)
            // Xiang Chinese (Changsha) — same shared Han-dict engine; embedded Latin routes to English.
            case "hsn":
                return Create("xiang"); // TS: createXiang(readAsEnglish)
            case "gan":
                return Create("gan"); // TS: createGan(readAsEnglish)
            // ⚠ NO FOREIGN READER, AND THE ABSENCE IS THE DECISION. This case read
            // `createAkan(readAsEnglish)` and `createAkan` never referenced the
            // argument — wiring with no routing behind it. Akan IS written in Latin, so its tokenizer claims
            // every Latin run and NATIVISES it; there is no unclaimed-run seam for a reader to sit in, and
            // handing one in would need a discriminator ("is this word Akan?") that no lexicon in this repo can
            // answer. Reading `February` as *ˈfɛbɹuɛɹi* instead of *febrwarj* would not be a fix either: the
            // normalize.ts header makes the point that an English reader lets a defect hide as a plausible
            // English word rather than showing up as visible gibberish. Fleet: 45 cases here hand a factory a
            // reader; 9 of those factories never invoke it (this one, plus am bal ckb ig my nan ti yo, which
            // store it in a field and never read it — their embedded Latin is served by `setDefaultForeign`
            // above). Only `ak` is fixed here; the other eight are engines this change does not own.
            case "ak":
                return Create("akan");
            case "jv":
                return Create("javanese");
            case "sw":
                return Create("swahili");
            case "gu":
                return Create("gujarati"); // TS: createGujarati(readAsEnglish)
            // ⚠ `ps`/`pus` IS A MACROLANGUAGE AND THIS ENGINE IS ONE OF ITS MEMBERS. ISO 639-3 `pus` covers pbt
            // (Southern/Kandahari), pbu (Northern/Peshawar) and pst (Central/Waziri), and pashto.ts implements
            // exactly one: "Dialect: ښ/ږ = Kandahari retroflex ʂ/ʐ". `pbt` is therefore the accurate code and is
            // added here; `ps` keeps resolving because it is what callers type, as a labelled approximation for
            // the umbrella — the same shape as `ms`/`zsm` above. The catalogue records the distinction (ps is an
            // unimplemented macrolanguage umbrella; pbt carries the verdict), because the phoneme question is
            // not answerable at umbrella level: the referees list Northern x/ɡ and Southern ʂ/ʐ for the same
            // orthography and no single engine can be right for both.
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
            // Macedonian (македонски) — South Slavic, Cyrillic; phonemic g2p + fixed antepenultimate stress.
            case "mk":
                return Create("macedonian");
            // Kabuverdianu (kriolu) — Portuguese-lexified creole of Cape Verde; ALUPEC phonemic g2p + nasalization.
            case "kea":
                return Create("kabuverdianu");
            // Maltese (Malti) — Semitic in the Latin alphabet; grapheme g2p + q→ʔ + final devoicing + silent għ/h.
            case "mt":
                return Create("maltese");
            // Luxembourgish (Lëtzebuergesch) — West Germanic; grapheme g2p + the diphthong system + German-style rules.
            case "lb":
                return Create("luxembourgish");
            // Icelandic (íslenska) — North Germanic; deep orthography, fortis/lenis neutralization + epenthetic clusters.
            case "fo":
                return Create("faroese");
            case "is":
                return Create("icelandic");
            // Occitan (lenga d'òc) — Occitano-Romance; Languedocien g2p (o→u, final-a→ɔ).
            case "oc":
                return Create("occitan");
            // Māori (te reo Māori) — Eastern Polynesian; a near-1:1 phonemic g2p (macron length, wh→ɸ, ng→ŋ).
            case "haw":
                return Create("hawaiian");
            case "mi":
                return Create("maori"); // TS: createMaori(readAsEnglish)
            // Quechua (Runasimi) — Southern Quechua; 3 vowels, overt 3-way stop series (plain/aspirate/ejective), penult stress.
            case "qu":
                return Create("quechua");
            // Tibetan (Standard/Lhasa) — deep orthography; syllable-stack rule engine (tonogenesis, cluster realization, suffix umlaut/length/nasalization).
            case "bo":
                return Create("tibetan");
            // Guaraní (Avañe'ẽ) — Tupian; 12 vowels (6 nasal + ⟨y⟩→ɨ), prenasalized ⟨mb nd⟩, glottal ⟨'⟩, glide formation.
            case "gn":
                return Create("guarani");
            // Albanian (Shqip) — Indo-European (own branch); digraph-rich (dh th sh zh xh, palatals gj/q), 7 vowels, penult stress.
            case "sq":
                return Create("albanian");
            // Turkmen (Türkmençe) — Oghuz Turkic; the interdental hallmark s→θ/z→ð, 9 vowels (a→ɑ, ä→æ, ü→y, y→ɯ), final stress.
            case "tk":
                return Create("turkmen");
            // Tatar (Татар теле) — Kipchak Turkic, Cyrillic; vowel-harmony backing of к/г→q/ʁ, ә→æ ө→ø ү→y җ→ʑ, final stress.
            case "tt":
                return Create("tatar");
            case "mto":
                return Create("totontepecmixe");
            // Cherokee (ᏣᎳᎩ ᎦᏬᏂᎯᏍᏗ) — Iroquoian, the Cherokee syllabary; deterministic 85-char CV lookup, phonemically voiceless obstruents (aspiration-not-voicing), ⟨v⟩→ə̃; tone/length/aspiration/glottal unwritten (folded).
            case "chr":
                return Create("cherokee");
            // Lule Sami (julevsámegiella) — Uralic (Saami); transparent segmental scan, North-Saami-style VOICELESS ⟨b d g⟩→[p t k], ⟨sj tj⟩→ʃ/t͡ʃ, diphthongs ie/uo/oa; first-syllable stress; morphophonology deferred.
            case "smj":
                return Create("lulesami");
            // Classical Nahuatl (nāhuatlahtōlli) — Uto-Aztecan; position-aware scan of the Spanish-based orthography: ⟨c⟩→k/s, ⟨cu/uc⟩→kʷ, ⟨hu/uh⟩→w, saltillo ⟨h⟩→ʔ, ⟨tz tl ch⟩ affricates, the ⟨chu⟩=kw trap; length unwritten.
            case "nci":
                return Create("nahuatl");
            case "nog":
                return Create("nogai");
            // Latin (Classical, Vox Latina) — Italic; macron length, short-vowel laxing, c→k, v→w, qu→kʷ, x→ks, final -Vm→Ṽː.
            case "la":
                return Create("latin");
            // Santali (ᱥᱟᱱᱛᱟᱲᱤ) — Munda (Austroasiatic), the Ol Chiki alphabet; ᱷ aspiration, ᱹ→ə, ᱸ nasal, word-final CHECKED stops.
            case "sat":
                return Create("santali");
            // K'iche' (Qatzijob'al) — Mayan; ejective series b'→ɓ k'/q'/tz'/ch', aspirated plain stops, x→ʃ j→x.
            case "quc":
                return Create("kichee");
            // Bashkir (Башҡорт теле) — Kipchak Turkic; interdentals ҫ→θ ҙ→ð, written uvulars ҡ→q ғ→ʁ, vowel shift; Russian loans routed to ru.
            case "ba":
                return Create("bashkir");
            // Basque (euskara) — a LANGUAGE ISOLATE; the three-way sibilant/affricate system ⟨z s x⟩→[s̻ s̺ ʃ], ⟨tz ts tx⟩→[t͡s̻ t͡s̺ t͡ʃ]; r tap/trill.
            case "eu":
                return Create("basque");
            // Karakalpak (qaraqalpaq tili) — Kipchak Turkic (close to Kazakh), 2016 Latin; written uvulars q/x/ǵ, front acute vowels á ó ú, ı→ɯ, final stress.
            case "kaa":
                return Create("karakalpak");
            // Crimean Tatar (qırımtatar tili) — Kipchak+Oghuz Turkic, Turkish-based Latin; written uvular q/ğ, front-back harmony, c→d͡ʒ, ñ→ŋ, final stress.
            case "crh":
                return Create("crimeantatar");
            // Papiamentu (pap) — Iberian-lexified creole of the ABC islands; coda-n vowel nasalization, digraphs ch/sh/dj, open vowels è ò ù.
            case "pap":
                return Create("papiamento");
            // Nama (Khoekhoe) — Khoe-Kwadi; the fleet.s FIRST CLICK language: 4 click types ǀ ǁ ǂ ǃ × accompaniments (bare/g/kh/h/n).
            case "naq":
                return Create("nama");
            // Aromanian (armãneashti) — Eastern/Balkan Romance, sibling of Romanian; digraphs ts/dz/sh/nj/lj, dh/th interdentals, ã→ə.
            case "rup":
                return Create("aromanian");
            // Abkhaz (аҧсуа) — NW Caucasian; huge consonant inventory (labialized/palatalized/ejective/pharyngealized), 2 vowels.
            case "ab":
                return Create("abkhaz");
            // Chuvash (Чӑвашла) — the sole surviving Oghur Turkic; allophonic intervocalic/post-nasal voicing, geminate-blocking, reduced-vowel ⟨ӑ ӗ⟩ stress.
            case "chv":
                return Create("chuvash");
            // Ewe (Eʋegbe) — Gbe (Niger-Congo, Kwa); labial-velars gb/kp, bilabial ƒ→ɸ/ʋ→β, w/ɰ + r/l allophony, toneless.
            case "ee":
                return Create("ewe");
            // Asturian (asturianu) — Astur-Leonese (Ibero-Romance); x→ʃ, distinción, no final deletion.
            case "an":
                return Create("aragonese");
            case "ast":
                return Create("asturian");
            // Haitian Creole (kreyòl ayisyen) — French-lexified creole; phonemic IPN g2p + nasal-vowel rule.
            case "ht":
                return Create("haitian");
            // Rangpuri (KRNB) — Eastern Indo-Aryan, Devanagari; reuses the Hindi abugida engine + a KRNB manifest.
            case "rkt":
                return Create("rangpuri"); // TS: createRangpuri(readAsEnglish)
            // Bavarian (Boarisch) — Upper German (Austro-Bavarian), Latin; greedy scan + falling diphthongs + r-vocalization.
            case "bar":
                return Create("bavarian");
            // Min Dong / Eastern Min (Fuzhou) — Sinitic, tonal; Bàng-uâ-cê (BUC) → IPA converter; segmental + citation tone.
            case "cdo":
                return Create("mindong");
            // Hmong (White Hmong / Hmoob Dawb) — Hmong-Mien, tonal; RPA → IPA (final consonant letter = tone).
            case "hmn":
                return Create("hmong");
            // Tashelhit / Shilha — Berber (Amazigh), Latin; near-1:1 phonemic grapheme scan + gemination + labialisation.
            case "shi":
                return Create("tashelhit");
            case "ckb":
                return Create("centralkurdish"); // TS: createCentralKurdish(readAsEnglish)
            // Balochi (Southern) — NW Iranian, Balochi Arabic script. Authored (Jahani & Korn). ⚠ THE ORTHOGRAPHY IS
            // DEFECTIVE for this purpose: short vowels are unwritten and و/ی each conflate two long vowels
            // (uː/oː, iː/eː), so those distinctions are not recoverable from the spelling. Fills the retroflex-Iranian census gap.
            case "bal":
                return Create("balochi"); // TS: createBalochi(readAsEnglish)
            case "bho":
                return Create("bhojpuri"); // TS: createBhojpuri(readAsEnglish)
            // Magahi (Magadhan, Bihar) — BESPOKE (was a mag→bho alias). Shares the Bihari core with Bhojpuri (no vowel
            // length, श/ष→s, ण/ञ→n) but the comparative phonology (Vinod Kumar 2026) documents a Magahi-specific GLIDE
            // HARDENING — word-initial व→[b], य→[d͡ʒ] — that the alias got wrong, so it earns its own module.
            case "mag":
                return Create("magahi"); // TS: createMagahi(readAsEnglish)
            // Haryanvi (Bangaru — Western Hindi, Haryana) — ALIAS to the Hindi engine. Haryanvi is segmentally ~Hindi
            // (same 28–30 consonants / 4-way stop contrast); its documented differences (vowel free-variation a~e,
            // a marked retroflexion tendency, intonation) are allophonic/prosodic, NOT a categorical grapheme→IPA
            // delta, and there is NO referee to verify one. So we serve it via `hi` (its nearest verified sibling —
            // Western Hindi) as a labelled approximation. See tools/language-catalogue (served_by='hi').
            // NORMALIZER WORDS: no source exists. bgc.wikipedia does not exist, and there is no FLEURS corpus,
            // artifact or referee — every tier of the haystack is empty.
            // Hindi's inherited percent/clock/era words are therefore the only available answer, which is
            // consistent with this being a labelled approximation served via `hi` in the first place. Recorded so
            // nobody re-investigates a settled refusal; a KRNB-style divergence check would need a Haryanvi source.
            case "bgc":
                return Create("hindi"); // TS: createHindi(readAsEnglish)
            // Chhattisgarhi (Eastern Hindi) — ⚠ an unverified stub on the shared Hindi engine.
            case "hne":
                return Create("chhattisgarhi"); // TS: createChhattisgarhi(readAsEnglish)
            case "za":
                return Create("zhuang");
            // Awadhi (Eastern Hindi) — a Saksena-sourced ⚠ unverified stub on the shared Hindi engine.
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
            // Western Armenian (արեւմտահայերէն) — the Istanbul/diaspora standard; the CONSONANT SHIFT (classical voiced/aspirate ⟨բ դ գ⟩→pʰ tʰ kʰ, classical voiceless ⟨պ տ կ⟩→b d ɡ).
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
                return Create("igbo"); // TS: createIgbo(readAsEnglish)
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
            // Latvian (latviešu) — Baltic sibling of Lithuanian; written palatals/length + fixed first-syllable stress.
            case "lv":
                return Create("latvian");
            // Latgalian (latgaļu volūda) — Eastern Baltic, sibling of Latvian; ⟨i⟩/⟨y⟩ soft/hard palatalization, ⟨y⟩→ɨ.
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
