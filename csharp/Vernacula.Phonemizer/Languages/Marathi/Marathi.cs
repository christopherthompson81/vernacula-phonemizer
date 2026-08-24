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
