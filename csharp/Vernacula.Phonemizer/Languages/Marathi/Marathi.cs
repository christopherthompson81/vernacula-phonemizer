/**
 * Native Marathi (mr) text phonemizer — canonical IPA. Reuses the generic Hindi engine (MakeNativeHindi) with
 * a Marathi manifest; the Marathi-specific facts live entirely in marathi.jsonc.
 * Ported from src/languages/marathi/marathi.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Hindi;

namespace Vernacula.Phonemizer.Languages.Marathi;

public static class MarathiPhonemizer
{
    public static readonly HindiDef DEF = LoadManifest.Load<HindiDef>("languages/marathi", "marathi.jsonc");

    private static NativeHindiEngine? MR;
    private static NativeHindiEngine Engine(ForeignPhonemizer? foreign = null) =>
        Hindi.Hindi.MakeNativeHindi(
            LoadManifest.Load<HindiDef>("languages/marathi", "marathi.jsonc"),
            PhonologyLoader.LoadSharedPhonology(),
            foreign);

    /**
     * Marathi shares Hindi's ENGINE but not Hindi's orthographic conventions, so it supplies its OWN symbol
     * words (and its own normalizer) through MakeNativeHindi's overrides rather than inheriting Hindi's.
     */
    private static readonly Func<string, string> MR_SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "गुणिले" },
        Ampersand = "आणि",
        Percent = new[] { "टक्के" }, // Hindi's प्रतिशत is not Marathi
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "डॉलर" }, ["€"] = new[] { "युरो" }, ["£"] = new[] { "पाउंड" },
            ["₹"] = new[] { "रुपये" }, ["¥"] = new[] { "येन" },
        },
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
        var def = LoadManifest.Load<HindiDef>("languages/marathi", "marathi.jsonc");
        return Hindi.Hindi.MakeNativeHindi(def, PhonologyLoader.LoadSharedPhonology(), foreign, null, null,
            normalizeOverride: Normalize.MakeMarathiNormalizer(def.Numbers),
            symbolsOverride: MR_SYMBOLS);
    }

    /** Bare word→IPA (tests / referee eval). */
    public static string PhonemizeWord(string w) => (MR ??= Engine()).Word(w);

    internal static void RegisterSelf() =>
        Registry.Register("marathi", () => new NativeHindiLanguage(CreateMarathi(latin => Registry.ReadAsEnglish(latin))));
}
