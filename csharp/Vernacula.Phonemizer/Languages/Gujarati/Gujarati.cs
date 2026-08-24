/**
 * Native Gujarati (gu) text phonemizer — canonical IPA.
 * Ported from src/languages/gujarati/gujarati.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Hindi;

namespace Vernacula.Phonemizer.Languages.Gujarati;

public static class GujaratiPhonemizer
{
    public static readonly HindiDef DEF = LoadManifest.Load<HindiDef>("languages/gujarati", "gujarati.jsonc");

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
     * The symbol tier. ⚠ It REPLACES the inherited Hindi one rather than extending it: Hindi's words are
     * DEVANAGARI, which GUJARATI_WORD excludes, so an inherited word is dropped by the tokenizer outright.
     */
    private static readonly Func<string, string> GU_SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "ગુણ્યા" },
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
            ["m"] = new[] { "મીટર" },
        },
        UnitPer = "પ્રતિ",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["ક"] = "કલાક", ["કલાક"] = "કલાક", ["સેકંડ"] = "સેકંડ", ["h"] = "કલાક", ["s"] = "સેકંડ",
        },
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

    /**
     * Load gujarati.jsonc (beside this file) and build the Gujarati phonemizer. `foreign` handles embedded
     * Latin.
     */
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

    /**
     * Bare word→IPA, RULE-ENGINE ONLY (no lexicon) — the honest, non-circular signal for the referee eval.
     */
    public static string PhonemizeWordRules(string word) => Build().WordRules(word);

    internal static void RegisterSelf() =>
        Registry.Register("gujarati", () => new NativeHindiLanguage(CreateGujarati(latin => Registry.ReadAsEnglish(latin))));
}
