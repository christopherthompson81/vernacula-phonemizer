/**
 * Native Punjabi (pa) text phonemizer — canonical IPA. Gurmukhi is a Brahmic abugida read
 * by the generic engine (core/abugida.ts); on top, punjabi.ts adds the features Hindi's assembly does not share:
 *
 *   1. addak ੱ gemination — the following consonant is long (ਪੱਕਾ → pəkːaː).
 *   2. TONOGENESIS (Punjabi's signature): the historical voiced-aspirate letters ਘ ਝ ਢ ਧ ਭ (carried here as the
 *      breathy markers ɡʱ d͡ʒʱ ɖʱ d̪ʱ bʱ) DE-ASPIRATE and shift tone — voiceless + LOW tone word-initially
 *      (ਘੋੜਾ → kòːɽaː), voiced + HIGH tone post-vocalically (ਕੰਘਾ → kə́ŋɡaː).
 *   3. inherent-vowel (schwa) deletion — word-final + medial Ohala, shared with Hindi.
 *
 * The referee-eval strips Chao tone letters, so tones are graded on the synthesis output, not the backbone.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Punjabi;

public class PunjabiDef : AbugidaDef
{
    public NumbersDef Numbers { get; set; } = new();
    public Dictionary<string, string> ClausePunctuation { get; set; } = new();
}

/** Variety options. Saraiki (skr) is the NON-tonal Lahnda sibling: it never underwent Punjabi's tonogenesis (it
 *  kept the voiced aspirates AND its aspirated sonorants — لھ→lʰ), and it writes retroflex ɳ explicitly (ݨ), so
 *  the plain-ن→ɳ infinitive heuristic must not fire. One declarative flag toggles all three (ADR-2). */
public sealed class PunjabiOpts
{
    public bool Saraiki { get; init; }
    /** The variety's OWN pre-tokenizer pass, replacing the Punjabi one. Saraiki supplies
     *  `normalizeSaraiki`; without it the `saraiki` flag leaves the text unnormalized (which is what it did
     *  before that layer existed — see the comment on `normalize` below). */
    public Func<string, string>? Normalize { get; init; }
}

/** The four entry points `makeNativePunjabi` returns. */
public sealed class NativePunjabiEngine
{
    public required Func<string, string> Word;
    public required Func<string, string> ShippedWord;
    public required Func<string, string> Number;
    public required Func<string, string> Text;
}

public static class PunjabiPhonemizer
{
    private const string VOWEL = "əaɪiʊueɛoɔ";
    private static readonly JsRe VOWEL_G = JsRegex.Compile($"[{VOWEL}]", "g");
    private const string GURMUKHI_WORD = "਀-੿";
    private static readonly IReadOnlyDictionary<string, string> GURMUKHI_DIGITS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["੦"] = "0", ["੧"] = "1", ["੨"] = "2", ["੩"] = "3", ["੪"] = "4",
        ["੫"] = "5", ["੬"] = "6", ["੭"] = "7", ["੮"] = "8", ["੯"] = "9",
    };
    private static readonly string DIGIT_CLASS = "0-9\\u0660-\\u0669\\u06F0-\\u06F9" + string.Concat(GURMUKHI_DIGITS.Keys);
    private const string ADDAK = "ੱ";
    private const string CONS_CLASS = "ਕ-ਹਖ਼-ੜ"; // Gurmukhi consonant range (for addak gemination)

    // Historical voiced aspirate → [word-initial voiceless, post-vocalic voiced] de-aspirated realization.
    private static readonly IReadOnlyDictionary<string, string[]> BREATHY = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
        ["d͡ʒʱ"] = new[] { "t͡ʃ", "d͡ʒ" },
        ["ɡʱ"] = new[] { "k", "ɡ" },
        ["ɖʱ"] = new[] { "ʈ", "ɖ" },
        ["d̪ʱ"] = new[] { "t̪", "d̪" },
        ["bʱ"] = new[] { "p", "b" },
    };
    private static readonly string[] BREATHY_KEYS = BREATHY.Keys.OrderByDescending(k => k.Length).ToArray();
    private const string HIGH = "˥˩"; // high-falling tone (post-vocalic source)
    private const string LOW = "˨˩";  // low(-rising) tone (word-initial source)

    private static readonly JsRe VOWEL_RUN = JsRegex.Compile($"[{VOWEL}]ː?̃?", "gu");
    private static readonly JsRe VOWEL_HEAD = JsRegex.Compile($"^[{VOWEL}]ː?̃?", "u");

    /** Append a tone letter after the LAST vowel (+ length) already in `s`. */
    private static string ToneOnLastVowel(string s, string tone)
    {
        var ms = VOWEL_RUN.Matches(s);
        if (ms.Count == 0) return s;
        var m = ms[^1];
        var end = m.Index + m.Length;
        return s[..end] + tone + s[end..];
    }

    /** Punjabi tonogenesis: rewrite each breathy voiced-aspirate marker to its de-aspirated, TONED realization —
     *  voiceless + low tone in a word-initial onset, voiced + high tone post-vocalically. */
    private static string Tonogenesis(string ipa)
    {
        var @out = "";
        var i = 0;
        var seenVowel = false;
        while (i < ipa.Length)
        {
            var key = BREATHY_KEYS.FirstOrDefault(k => string.CompareOrdinal(ipa, i, k, 0, k.Length) == 0 && i + k.Length <= ipa.Length);
            if (key is not null)
            {
                var pair = BREATHY[key];
                if (!seenVowel)
                {
                    @out += pair[0];
                    i += key.Length;
                    var vm = VOWEL_HEAD.Match(ipa[i..]);
                    if (vm.Success)
                    {
                        @out += vm.Value + LOW;
                        i += vm.Value.Length;
                        seenVowel = true;
                    }
                }
                else
                {
                    @out = ToneOnLastVowel(@out, HIGH);
                    @out += pair[1];
                    i += key.Length;
                }
                continue;
            }
            var ch = ipa[i].ToString();
            if (VOWEL.Contains(ch, StringComparison.Ordinal)) seenVowel = true;
            @out += ch;
            i++;
        }
        return @out;
    }

    private static readonly JsRe GEMINATE = JsRegex.Compile(
        "(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t̪ʰ|d̪ʱ|ɖʱ|ʈʰ|ɡʱ|kʰ|t̪|d̪|[kɡpbmnlsʃɾɽŋɳɭjɦʋʈɖqxzɣf])\\1(?!͡)", "gu");
    private static readonly JsRe ASP_AFTER_LENGTH = JsRegex.Compile("ː([ʰʱ])", "gu");
    private static readonly JsRe FINAL_SCHWA = JsRegex.Compile("ə$", "u");
    private static readonly JsRe N_PALATAL = JsRegex.Compile("n(?=t͡ʃ|d͡ʒ)", "gu");
    private static readonly JsRe N_RETROFLEX = JsRegex.Compile("n(?=ʈʰ|ɖʱ|[ʈɖɽ])", "gu");
    private static readonly JsRe N_VELAR = JsRegex.Compile("n(?=kʰ|ɡʱ|[kɡxɣq])", "gu");
    private static readonly JsRe INFINITIVE_NA = JsRegex.Compile("(?<![ɾɽ])n(aː)$", "u");
    private static readonly JsRe ASP_SONORANT = JsRegex.Compile("([nlmɳɭɽ])ʱ", "gu");
    private static readonly JsRe GLOTTAL = JsRegex.Compile("ʔ", "gu");

    public static NativePunjabiEngine MakeNativePunjabi(
        PunjabiDef def,
        Phonology? phon = null,
        Func<string, string>? foreign = null,
        PunjabiOpts? opts = null)
    {
        phon ??= PhonologyLoader.LoadSharedPhonology();
        opts ??= new PunjabiOpts();
        var g2p = Abugida.MakeAbugidaG2P(def, phon);
        var CLAUSE_MARK = def.ClausePunctuation;
        var addakRe = JsRegex.Compile($"{ADDAK}([{CONS_CLASS}]਼?)", "gu");
        var tokenRe = JsRegex.Compile(
            // ⚠ ALL OF LATIN, not just ASCII: `[A-Za-z]+` ended the token at a diacritic, so the letter carrying it
            // became an unclaimed gap read as an English LETTER NAME and the rest of the word started over —
            // `São Paulo` read *ˈɛs ˈə ˈoᶷ pʰˈɔːloᶷ*, "ES ə O Paulo". This group already means FOREIGN (its match goes
            // to the injected reader), so widening it is the whole fix. Same change as the shared abugida tokenizer.
            $"([{GURMUKHI_WORD}{Shahmukhi.SHAHMUKHI_CLASS}]+)|(\\p{{Script=Latin}}[\\p{{Script=Latin}}\\p{{M}}]*)|([{DIGIT_CLASS}]+)|([।॥.?!,;:۔؟،؛])",
            "gu");

        string Word(string w)
        {
            // Raw canonical IPA, script-routed: Shahmukhi (Perso-Arabic) → the abjad scanner, else the Gurmukhi
            // abugida (with addak ੱ pre-normalized to a geminate ਪੱਕਾ → ਪਕ੍ਕਾ). Both feed the shared post-processing.
            var isShah = Shahmukhi.SHAHMUKHI_WORD.IsMatch(w);
            var x = isShah
                ? Shahmukhi.ScanShahmukhi(w)
                : g2p(addakRe.Replace(w.Normalize(System.Text.NormalizationForm.FormC), "$1੍$1"));
            // geminate → length + aspiration-before-length reorder.
            x = ASP_AFTER_LENGTH.Replace(GEMINATE.Replace(x, "$1ː"), "$1ː");
            // word-final then medial inherent-vowel (schwa) deletion — same as Hindi.
            var syls = VOWEL_G.Matches(x).Count;
            if (syls >= 2) x = FINAL_SCHWA.Replace(x, "");
            x = Schwa.DeleteMedialSchwa(x);
            // Homorganic nasal assimilation: a plain /n/ takes the place of a following velar/palatal/retroflex stop
            // (ਪੰਜਾਬੀ ɲd͡ʒ, ŋɡ, ɳɖ). Gurmukhi encodes this via tippi ੰ + the engine's homorganic nasal; Shahmukhi
            // writes a generic ن, so the raw string carries a plain n here — assimilate it (matches wikipron pan_arab).
            x = N_VELAR.Replace(N_RETROFLEX.Replace(N_PALATAL.Replace(x, "ɲ"), "ɳ"), "ŋ");
            // SHAHMUKHI-ONLY: the verbal infinitive/causative ending is RETROFLEX -ਣਾ [ɳaː] (آکھنا→aːkʰɳaː, بنانا→
            // bənaːɳaː) EXCEPT after a rhotic /ɾ ɽ/, where it is DENTAL -ਨਾ [naː] (کرنا→kəɾnaː, مارنا→maːrnaː, پھڑنا→
            // pʰəɽnaː) — a real Punjabi morphophonemic split that GURMUKHI spells orthographically (ਣ vs ਨ). Shahmukhi
            // writes both with the ambiguous plain ن, so retroflex a word-final naː UNLESS a rhotic precedes; Gurmukhi
            // is authoritative (never fire). +24 net vs the Shahmukhi referee (breaks only the 3 nouns نانا/مہینہ/انھا
            // that also end in a non-rhotic ...aːnaː — a small lexical cost).
            // (SKR skips this: Saraiki writes retroflex ɳ explicitly as ݨ, so a plain ن is unambiguously [n].)
            if (isShah && !opts.Saraiki) x = INFINITIVE_NA.Replace(x, "ɳ$1");
            // TONOGENESIS: de-aspirate the breathy markers + assign tone. (SKR is NON-tonal — skip it, keeping the
            // voiced aspirates bʰ d̪ʱ ɡʱ … as segments.)
            if (!opts.Saraiki) x = Tonogenesis(x);
            // Punjabi has NO phonemic /ʔ/ — the loanword letters ع/ء are silent / hiatus carriers, not glottal stops
            // (اعتراض → et̪raːz, not əʔət̪raːz) — and NO aspirated SONORANTS — نھ/لھ/مھ are the sonorant + /h/ (a tone
            // source), not [nʱ/lʱ/mʱ] (the referee writes plain n/l/m). Both are no-ops for Gurmukhi input (its scanner
            // produces neither), so this is unscripted. +13 net vs the Shahmukhi referee. (SKR KEEPS aspirated
            // sonorants — لھ→lʰ is a real Saraiki segment the referee writes — so only the ʔ removal applies.)
            if (!opts.Saraiki) x = ASP_SONORANT.Replace(x, "$1");
            x = GLOTTAL.Replace(x, "");
            return WeightStress.ApplyWeightStress(x).Normalize(System.Text.NormalizationForm.FormC);
        }

        /**
         * The SHIPPED word path: the lexicon tiers in front of the rule engine, in the precedence the exported
         * `phonemizeWord` already documents — mined Gurmukhi exceptions → cross-script gold → harakat restore →
         * `word`.
         *
         * ⚠ text() USED TO CALL `word` DIRECTLY, so the shipped engine consulted NONE of the three lexicons and
         * every one of them was dead weight on the only path users reach. Measured when it was found: 153 of the
         * 200 pa golden rows contain at least one word the Gurmukhi exceptions lexicon covers — words mined
         * precisely because the rules get them wrong — and the 11,166-entry cross-script GOLD lexicon was unused
         * outright, so `آئرلینڈ` read *aːˈiːɾliːnəɖ* against its gold *aːɪɾlˈɛ̃ɳɖ*.
         *
         * ⚠ AND IT BROKE THE NEURAL RIDER'S DESIGN, which is how it stayed invisible: the rider diacritizer leaves
         * a lexicon-covered word BARE on purpose, so that "the authoritative sync lexicon layer" vocalizes it
         * (core/riderDiacritizer.ts says exactly that). With no such layer wired, those words got neither the
         * neural vocalization nor the lexicon — the one class the whole precedence exists to serve.
         *
         * `word` itself is deliberately left lexicon-free: `phonemizeWordCore` and the mining tool depend on that,
         * and `phonemizeWordEval` must never see the guru lexicon (it is mined FROM the referee).
         *
         * SARAIKI IS GATED OFF: these are Punjabi lexicons (Gurmukhi keys, pa cross-script pairs), and skr shares
         * only the factory. Same gate as tonogenesis and the ɳ heuristic above.
         */
        string ShippedWord(string w)
        {
            if (opts.Saraiki) return Word(w);
            if (GuruLexicon().TryGetValue(w, out var g)) return g;
            if (CrossScriptLexicon().TryGetValue(w, out var c)) return c;
            return Word(HarakatLexicon.RestoreHarakat(w, HarakatLex()));
        }

        string ToAscii(string d) =>
            string.Concat(Js.CodePoints(d).Select(c => GURMUKHI_DIGITS.GetValueOrDefault(c) ?? Shahmukhi.ShahmukhiDigit(c) ?? c));

        string Number(string digits)
        {
            var n = Js.Number(ToAscii(digits));
            // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
            // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
            // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
            // digit-at-a-time through this engine's own number words instead; see core/numbers.ts `spellDigits`
            // for the full account and the cost (above 2^53 the reading is a digit string, not a quantity).
            if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d))
                return Core.Numbers.SpellDigits(ToAscii(digits), def.Numbers, Word);
            return Core.Numbers.RenderNumber(n, def.Numbers, Word);
        }

        // Punjabi-specific rewrites (the shared symbol tier, digit de-grouping, decimals,
        // the clock, ordinal suffixes, Gurmukhi unit abbreviations, the era marker and degrees) BEFORE
        // tokenization. Roman numerals need no ordering care: `pa` is not in the registry's ROMAN_NATIVE set,
        // so the shared roman→digit pass has already run at the registry seam. See normalize.ts for the
        // corpus counts and the step-by-step ordering couplings.
        //
        // GATED OFF FOR SARAIKI. skr builds on this same factory (saraiki.ts) and would inherit the whole pass,
        // but the pass EMITS PUNJABI WORDS — ਪ੍ਰਤੀਸ਼ਤ, ਡਾਲਰ, ਡਿਗਰੀ, ਈਸਾ ਪੂਰਵ. ⚠ THE VARIETY MAY NOW SUPPLY ITS
        // OWN, which is what `opts.normalize` is for: Saraiki passes `normalizeSaraiki` (Shahmukhi words,
        // three digit sets, the Arabic comma), and the identity fallback is the behaviour that shipped while
        // that layer did not exist.
        var normalize = opts.Normalize ?? (opts.Saraiki ? new Func<string, string>(s => s) : Normalize.MakePunjabiNormalizer(def.Numbers));

        string Text(string input)
        {
            // Fold this script's own digits to ASCII first: the number token is `\d+`, which JavaScript
            // defines as ASCII-only, so a numeral written in native digits matched NO token and was
            // dropped entirely — the engine returned an empty string for it (core/unicode.ts). It runs
            // BEFORE `normalize`, whose patterns are all written against ASCII digits.
            return Clauses.AssembleClauses(normalize(Unicode.FoldNativeDigits(input)), tokenRe, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(ShippedWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(foreign is not null ? foreign(m.Groups[2].Value) : "");
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0) sink.Emit(Number(m.Groups[3].Value));
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[4].Value) ?? Shahmukhi.ShahmukhiPause(m.Groups[4].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }

        return new NativePunjabiEngine { Word = Word, ShippedWord = ShippedWord, Number = Number, Text = Text };
    }

    // COVERAGE layer: mined Shahmukhi (Perso-Arabic) skeletons are vocalized before g2p; Gurmukhi input has no
    // harakat keys in the lexicon so it passes through unchanged (see core/harakatLexicon.ts). Loaded LAZILY
    // (registry.ts imports every rider eagerly; the TSV is only read on first Punjabi use).
    private static Dictionary<string, string>? LEXICON;
    public static IReadOnlyDictionary<string, string> HarakatLex() =>
        LEXICON ??= HarakatLexicon.LoadHarakatLexicon("languages/punjabi");

    private static NativePunjabiEngine? PA;

    /** Lexicon-FREE core: bare word→IPA. Used by the mining tool, which must NOT consult the content lexicon (mining
     *  candidates would collide with content homographs). The number path already uses this via the `word` closure. */
    public static string PhonemizeWordCore(string w) =>
        (PA ??= MakeNativePunjabi(LoadPunjabiManifest())).Word(w);

    /** The Punjabi manifest — reused by the Saraiki (skr) module, which shares the Shahmukhi front-end and Lahnda
     *  phonology (Gurmukhi g2p unused; numbers deferred to a skr manifest). */
    public static PunjabiDef LoadPunjabiManifest() =>
        LoadManifest.Load<PunjabiDef>("languages/punjabi", "punjabi.jsonc");

    // CROSS-SCRIPT layer: a direct Shahmukhi-word → GOLD-IPA lexicon whose vowels come from the VOWELED Gurmukhi
    // sister-spelling (kaikki real dual-script pairs; crossscript.tsv). It resolves ALL THREE abjad ambiguities the
    // harakat layer cannot fully reach — short vowels, the majhūl و/ی ([oː]~[uː], [iː]~[eː]), AND ن vs retroflex ݨ
    // (a consonant, not a harakat) — so it takes PRECEDENCE for a covered word. Gurmukhi input never matches (keys are
    // Perso-Arabic).
    private static Dictionary<string, string>? CROSS;
    public static IReadOnlyDictionary<string, string> CrossScriptLexicon() =>
        CROSS ??= LoadTsv.LoadTsvMap("languages/punjabi", "crossscript.tsv", optional: true);

    /**
     * Bare word→IPA for the REFEREE EVAL: cross-script gold → coverage-lexicon restore → the lexicon-free core.
     *
     * ⚠ THIS FUNCTION MUST NEVER CONSULT `guruLexicon` — that lexicon is MINED FROM the pan_guru referee, so an
     * eval that read it would score the answer key (the af/en-GB/km house pattern: the eval scores a
     * lexicon-free-ish path, the shipped path adds the mined tier on top). The cross-script layer stays: its
     * readings come from OUR OWN g2p over the voweled Gurmukhi sister-spelling, not from any referee's labels.
     */
    public static string PhonemizeWordEval(string w) =>
        CrossScriptLexicon().TryGetValue(w, out var c)
            ? c
            : PhonemizeWordCore(HarakatLexicon.RestoreHarakat(w, HarakatLex()));

    // GURMUKHI EXCEPTIONS LEXICON — wikipron pan_guru readings for the words the rules get wrong; mostly the
    // medial-schwa class proven lexical three ways (audio adjudication, two failed rule derivations, the 52:40
    // population split — investigation Runs 1-4). Mined by tools/gen/build-pa-guru-lexicon.mts; CC-BY-SA (§3).
    private static Dictionary<string, string>? GURU;
    public static IReadOnlyDictionary<string, string> GuruLexicon() =>
        GURU ??= LoadTsv.LoadTsvMap("languages/punjabi", "gurmukhi-lexicon.tsv", optional: true);

    /** Bare word→IPA, SHIPPED: the mined Gurmukhi exceptions lexicon first (keys are Gurmukhi script, so
     *  Shahmukhi input never matches), then the eval path. */
    public static string PhonemizeWord(string w) =>
        GuruLexicon().TryGetValue(w, out var g) ? g : PhonemizeWordEval(w);

    private sealed class Engine : ILanguage
    {
        private readonly NativePunjabiEngine _engine;
        internal Engine(NativePunjabiEngine engine) => _engine = engine;
        public string Text(string input) => _engine.Text(input);
    }

    /** Build the Punjabi phonemizer. `foreign` handles embedded Latin. */
    public static ILanguage CreatePunjabi(Func<string, string>? foreign = null) =>
        new Engine(MakeNativePunjabi(LoadPunjabiManifest(), PhonologyLoader.LoadSharedPhonology(), foreign));

    internal static void RegisterSelf()
    {
        Registry.Register("punjabi", () => CreatePunjabi(Registry.ReadAsEnglish));
        // The Shahmukhi rider's coverage lexicon — `pnb` routes through phonemizeRiderNeural(t, "pa").
        RiderNeural.RegisterRider("pa", HarakatLex);
    }
}
