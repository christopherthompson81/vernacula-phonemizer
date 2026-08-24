/**
 * Native Gujarati (gu) text phonemizer — canonical IPA. Indo-Aryan, the Gujarati abugida.
 * A thin wrapper: it reuses the generic abugida engine + the entire Hindi orchestration (makeNativeHindi —
 * schwa deletion, weight stress, the Indic number compositor, clause assembly) with a Gujarati-Unicode data file
 * (gujarati.jsonc) and the Gujarati script's word-run + digit constants.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Hindi;

namespace Vernacula.Phonemizer.Languages.Gujarati;

public static class GujaratiPhonemizer
{
    public static readonly HindiDef DEF = LoadManifest.Load<HindiDef>("languages/gujarati", "gujarati.jsonc");

    // Whole-word lexicon for the proven-lexical medial-schwa tail (cross-source consensus of wikipron+kaikki; see
    // gujarati-lexicon.tsv). NFC-normalized keys; applied on the SHIPPED path only, never in the rule engine.
    private static Dictionary<string, string>? LEXICON;
    private static readonly object GATE = new();
    private static Dictionary<string, string> Lexicon()
    {
        lock (GATE)
        {
            if (LEXICON is null)
            {
                LEXICON = new Dictionary<string, string>(StringComparer.Ordinal);
                foreach (var kv in LoadTsv.LoadTsvMap("languages/gujarati", "gujarati-lexicon.tsv", optional: true))
                    LEXICON[kv.Key.Normalize(System.Text.NormalizationForm.FormC)] = kv.Value;
            }
            return LEXICON;
        }
    }

    /**
     * normalization. Gujarati shares Hindi's ENGINE but not Hindi's orthographic conventions or its
     * SCRIPT, so it supplies its own normalizer and its own symbol words through `makeNativeHindi`'s
     * overrides rather than inheriting Hindi's. The inheritance was not merely saying the wrong word: Hindi's
     * tier emits DEVANAGARI, which `core/unicode.ts` GUJARATI_WORD excludes, so the tokenizer dropped it —
     * "45%" came out [pˈistalis] with the percent word gone and "$45 મિલિયન" lost its currency outright.
     *
     * Every word here is attested in the gu_in FLEURS corpus in the same function (ટકા ×40, ડોલર ×4/ડૉલર ×2,
     * યુરો ×37, પાઉન્ડ ×8, યેન ×3, કિલોમીટર ×15, મીલીમીટર ×3, માઇલ, કલાક ×30, સેકંડ ×2, and પ્રતિ ×6 as the
     * rate connective, "8 માઇલ પ્રતિ સેકંડ" / "240 કિલોમીટર પ્રતિ કલાક") except રૂપિયા, સેન્ટીમીટર and
     * કિલોગ્રામ, which are transparent international units and whose signs/abbreviations do not occur here.
     *
     * `US$` and `AUD$` are declared because the corpus writes both ("US$30", "US$11,000થી", "AUD$45 મિલિયન")
     * and the tier's currency lookbehind `(?<![\p{L}\p{M}])` would otherwise refuse the bare `$` after a
     * letter and drop the sign silently. `ક` (for કલાક, in "165 કિમી/ક") is a rateDenominator rather than a
     * unit precisely because ⚠ a one-letter key matchable standalone
     * is confidently wrong far more often than it is right.
     */
    private static readonly Func<string, string> GU_SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // `multiply` — this language had NO word for the sign at all. ⚠ STANDARD MATHEMATICAL REGISTER, not a
        // corpus attestation: the sweep's plausible hits were homographs of PREPOSITIONS (es `por` ×23, it `per` ×25,
        // ru `на` ×31 are all the preposition), the same trap that defeated the exponent sourcing. One word, so `by`
        // defaults to it — this language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "ગુણ્યા" },
        // `&` was DROPPED outright: the corpus's `B&B` and `Arts & Sciences` lost the sign.
        // `અને` ×1128 in this corpus. The tier spaces it on both sides, because `B&B` is two
        // initialisms and joining them would make one token.
        Ampersand = "અને",
        Percent = new[] { "ટકા" }, // Hindi's प्रतिशत is not Gujarati — and in Devanagari it was not even audible
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "ડોલર" }, ["AUD$"] = new[] { "ડોલર" }, ["$"] = new[] { "ડોલર" },
            ["€"] = new[] { "યુરો" }, ["£"] = new[] { "પાઉન્ડ" }, ["¥"] = new[] { "યેન" }, ["₹"] = new[] { "રૂપિયા" },
        },
        Magnitudes = new[] { "મિલિયન", "બિલિયન", "ટ્રિલિયન", "કરોડ", "લાખ", "અબજ", "હજાર" },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["કિમી"] = new[] { "કિલોમીટર" }, ["કિમિ"] = new[] { "કિલોમીટર" },
            ["મીમી"] = new[] { "મીલીમીટર" }, ["મિમી"] = new[] { "મીલીમીટર" }, ["એમએમ"] = new[] { "મીલીમીટર" },
            ["માઇલ"] = new[] { "માઇલ" }, ["માઈલ"] = new[] { "માઈલ" }, // identity — declared so the RATE form માઇલ/કલાક composes
            ["km"] = new[] { "કિલોમીટર" }, ["cm"] = new[] { "સેન્ટીમીટર" }, ["mm"] = new[] { "મીલીમીટર" }, ["kg"] = new[] { "કિલોગ્રામ" },
            // `m` ADDED so the cube word below has a head noun — without it `120 m³` read as a bare letter
            // *ˈɛm* and the declaration was dead. મીટર ×28 spelled out, and digit-adjacent bare `m` is ×0 in
            // this corpus, so the one-letter-key hazard is checked rather than assumed. (Same measurement over
            // hi/kn/or/sd — all ×0 — and mr ×7, all of them `100m આણિ 200m` swimming events, i.e. metres. Those
            // five have no cube word yet and are left to the bare-`m` sweep.)
            ["m"] = new[] { "મીટર" },
        },
        UnitPer = "પ્રતિ",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["ક"] = "કલાક", ["કલાક"] = "કલાક", ["સેકંડ"] = "સેકંડ", ["h"] = "કલાક", ["s"] = "સેકંડ",
        },
        // `વર્ગ કિલોમીટર` ×10 — the best-attested measure word in this sweep — and `ક્યુબિક મીટર` ×2, both
        // word-first. ⚠ NEITHER bare word is the evidence, and both bare counts are traps:
        //   વર્ગ ×55   is the CLASSROOM ("વિદ્યાર્થીઓ તેમના વર્ગમાં બેસીને")
        //   ઘન  ×6    is SOLID, the state of matter ("ઘન, પ્રવાહી, વાયુ અને પ્લાઝમા") — and it is the same
        //             ધન/ઘન cluster that offers confidently wrong plus words to a token count.
        // The cube word here is the English loan ક્યુબિક, not ઘન. Only the collocation decides it.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "વર્ગ" }, Cubed = new[] { "ક્યુબિક" }, Position = ExponentPosition.Before,
        },
    });

    private static readonly AbugidaScript SCRIPT = new()
    {
        Word = Unicode.GUJARATI_WORD,
        Digits = Unicode.GUJARATI_DIGITS,
        Avagraha = "\u0ABD", // escaped, as the TS writes it — an isolated sign is unreadable as a literal
    };

    /** Load gujarati.jsonc (beside this file) and build the Gujarati phonemizer. `foreign` handles embedded Latin. */
    public static NativeHindiEngine CreateGujarati(ForeignPhonemizer? foreign = null)
    {
        var def = LoadManifest.Load<HindiDef>("languages/gujarati", "gujarati.jsonc");
        return Hindi.Hindi.MakeNativeHindi(
            def,
            PhonologyLoader.LoadSharedPhonology(),
            foreign,
            SCRIPT,
            Lexicon(),
            normalizeOverride: Normalize.MakeGujaratiNormalizer(def.Numbers),
            symbolsOverride: GU_SYMBOLS);
    }

    private static NativeHindiEngine? WORD;
    private static NativeHindiEngine Build()
    {
        lock (GATE) return WORD ??= Hindi.Hindi.MakeNativeHindi(
            LoadManifest.Load<HindiDef>("languages/gujarati", "gujarati.jsonc"),
            PhonologyLoader.LoadSharedPhonology(),
            null,
            SCRIPT,
            Lexicon());
    }

    /** Bare word→IPA, SHIPPED path (lexicon → rule engine). For tests and real text. */
    public static string PhonemizeWord(string word) => Build().Word(word);

    /** Bare word→IPA, RULE-ENGINE ONLY (no lexicon) — the honest, non-circular signal for the referee eval. */
    public static string PhonemizeWordRules(string word) => Build().WordRules(word);

    internal static void RegisterSelf() =>
        Registry.Register("gujarati", () => new NativeHindiLanguage(CreateGujarati(latin => Registry.ReadAsEnglish(latin))));
}
