/**
 * Native Marathi (mr) text phonemizer — canonical IPA. Reuses the generic Hindi engine (MakeNativeHindi) with
 * a Marathi manifest; the Marathi-specific facts live entirely in marathi.jsonc.
 * Ported from src/languages/marathi/marathi.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Hindi;

namespace Vernacula.Phonemizer.Languages.Marathi;

/** Marathi's manifest adds the two word tables Hindi's def does not carry. */
public sealed class MarathiDef : HindiDef
{
    public PercentDef Percent { get; set; } = new();
    public Dictionary<string, string> Currency { get; set; } = new();
    public string Ampersand { get; set; } = "";
    public string Multiply { get; set; } = "";
    /** The LATIN unit abbreviations the shared tier is keyed on. */
    public Dictionary<string, string> Units { get; set; } = new();
    /** ⚠ A SECOND unit table on purpose — normalize.ts's, with the Devanagari forms. See marathi.jsonc. */
    public Dictionary<string, string> UnitWords { get; set; } = new();
    public string[] MagnitudeWords { get; set; } = [];
    public OrdinalsDef Ordinals { get; set; } = new();
    public string[] VisargaAdverbs { get; set; } = [];
    public ClockDef Clock { get; set; } = new();
    public EraDef EraMarkers { get; set; } = new();
    public Dictionary<string, string> Abbreviations { get; set; } = new();
    public DegreeDef Degree { get; set; } = new();
    public FractionsDef Fractions { get; set; } = new();
    public SymbolWordsDef SymbolWords { get; set; } = new();
    public string RangeWord { get; set; } = "";
    public string BareHundred { get; set; } = "";

    public sealed class OrdinalsDef
    {
        public Dictionary<string, int> SuffixForm { get; set; } = new();
        /** ⚠ Indexed [masc, fem, plural/neuter, oblique] — the order IS the contract with SuffixForm. */
        public Dictionary<string, string[]> Irregular { get; set; } = new();
        public string StemHundred { get; set; } = "";
        public string[] StemNine { get; set; } = [];
        public string[] StemTens { get; set; } = [];
    }
    public sealed class ClockDef { public string Past { get; set; } = ""; public string Minutes { get; set; } = ""; public string Oclock { get; set; } = ""; }
    public sealed class EraDef { public string Bc { get; set; } = ""; public string Ad { get; set; } = ""; }
    public sealed class DegreeDef
    {
        public string Word { get; set; } = ""; public string Celsius { get; set; } = ""; public string Fahrenheit { get; set; } = "";
        public string North { get; set; } = ""; public string South { get; set; } = ""; public string East { get; set; } = ""; public string West { get; set; } = "";
    }
    public sealed class FractionsDef
    {
        public string Half { get; set; } = ""; public string Quarter { get; set; } = "";
        public string ThreeQuarters { get; set; } = ""; public string DividedBy { get; set; } = "";
    }
    public sealed class SymbolWordsDef
    {
        public string Plus { get; set; } = ""; public string Approximately { get; set; } = ""; public string PlusMinus { get; set; } = "";
        public string LessThan { get; set; } = ""; public string GreaterThan { get; set; } = ""; public string Divide { get; set; } = ""; public string Equals { get; set; } = "";
        /** Declared, but no ASCII-hyphen rule reads it — see marathi.jsonc. */
        public string Minus { get; set; } = "";
    }

    public sealed class PercentDef
    {
        public string Plural { get; set; } = "";
        public string Singular { get; set; } = "";
    }
}

public static class MarathiPhonemizer
{
    // ⚠ ONE LOAD. The tier below is built at type-init and must read the same object the engine does, or the
    // two go back to disagreeing — which is exactly what happened to £ (see marathi.jsonc).
    public static readonly MarathiDef DEF = LoadManifest.Load<MarathiDef>("languages/marathi", "marathi.jsonc");

    // The bare-sign map the Hindi engine tokenizes on is DERIVED from `percent`, not authored a second time.
    private static readonly MarathiDef WITH_SYMBOLS = WithPercentSign(DEF);

    private static MarathiDef WithPercentSign(MarathiDef d)
    {
        d.Symbols = new Dictionary<string, string>(d.Symbols ?? new Dictionary<string, string>(), StringComparer.Ordinal)
        {
            ["%"] = d.Percent.Plural,
        };
        return d;
    }

    private static NativeHindiEngine? MR;
    private static NativeHindiEngine Engine(ForeignPhonemizer? foreign = null) =>
        Hindi.Hindi.MakeNativeHindi(WITH_SYMBOLS, PhonologyLoader.LoadSharedPhonology(), foreign);

    /**
     * Marathi shares Hindi's ENGINE but not Hindi's orthographic conventions, so it supplies its OWN symbol
     * words (and its own normalizer) through MakeNativeHindi's overrides rather than inheriting Hindi's.
     */
    private static readonly Func<string, string> MR_SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "गुणिले" },
        Ampersand = "आणि",
        Percent = new[] { DEF.Percent.Plural }, // Hindi's प्रतिशत is not Marathi
        // From the manifest, and shared with Normalize.cs — the two paths claim the sign in different
        // positions and used to answer with different words for £.
        Currency = DEF.Currency.ToDictionary(kv => kv.Key, kv => (IReadOnlyList<string>)new[] { kv.Value }, StringComparer.Ordinal),
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "किलोमीटर" }, ["cm"] = new[] { "सेंटीमीटर" }, ["mm"] = new[] { "मिलिमीटर" },
            ["kg"] = new[] { "किलोग्रॅम" }, ["ha"] = new[] { "हेक्टर" }, ["l"] = new[] { "लिटर" },
            // ⟨l⟩ and ⟨L⟩ are both official for the litre — the one exception to the one-letter case rule in
            // Core/NormalizeSymbols, which exists for symbols whose two cases are DIFFERENT units.
            ["L"] = new[] { "लिटर" },
        },
    });

    public static NativeHindiEngine CreateMarathi(ForeignPhonemizer? foreign = null)
    {
        return Hindi.Hindi.MakeNativeHindi(WITH_SYMBOLS, PhonologyLoader.LoadSharedPhonology(), foreign, null, null,
            normalizeOverride: Normalize.MakeMarathiNormalizer(DEF),
            symbolsOverride: MR_SYMBOLS);
    }

    /** Bare word→IPA (tests / referee eval). */
    public static string PhonemizeWord(string w) => (MR ??= Engine()).Word(w);

    internal static void RegisterSelf() =>
        Registry.Register("marathi", () => new NativeHindiLanguage(CreateMarathi(latin => Registry.ReadAsEnglish(latin))));
}
