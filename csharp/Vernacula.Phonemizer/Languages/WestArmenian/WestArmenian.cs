/**
 * WESTERN Armenian / արեւմտահայերէն (hyw) text phonemizer — canonical IPA. The Istanbul/diaspora
 * standard. Reuses the shared, manifest-driven Armenian engine (Armenian.cs `MakeArmenianEngine`);
 * everything specific to Western Armenian lives in westarmenian.jsonc — chiefly the CONSONANT SHIFT
 * (classical voiced ⟨բ դ գ ձ ջ⟩ and classical aspirate ⟨փ թ ք ց չ⟩ merge to voiceless-aspirated
 * [pʰ tʰ kʰ t͡sʰ t͡ʃʰ]; classical voiceless ⟨պ տ կ ծ ճ⟩ → voiced [b d ɡ d͡z d͡ʒ]), the rhotic
 * neutralisation ⟨ր ռ⟩→[ɾ], and the front-rounded ⟨իւ⟩→[ʏ] digraph plus the POST-CONSONANT-ONLY
 * ⟨յու⟩→[ʏ] (word-initial ⟨յու⟩ stays the glide [ju]). ⚠ There is NO ⟨յո⟩→[œ] digraph, whatever
 * westarmenian.jsonc's own header and `provenance` string say: ⟨յո⟩ falls out as [jo] (յոթ→jotʰ).
 * Ported from src/languages/westarmenian/westarmenian.ts — see that file for the referee validation.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Armenian;

namespace Vernacula.Phonemizer.Languages.WestArmenian;

public static class WestArmenianPhonemizer
{
    /**
     * The shared SYMBOL tier for WESTERN Armenian. Every entry differs from the Eastern one in
     * Armenian.cs by more than an accent, and each difference is measured on hyw.wikipedia (the table is
     * in the TS normalize.ts header): `տոլար` ×48 not դոլար, `եւրօ` ×62 not եվրո, `մեթր`/`քիլոմեթր` with
     * the classical ⟨թ⟩ not ⟨տ⟩.
     *
     * ⚠ `տոկոս` ×42 SHIPS AND `առ հարիւր` DOES NOT. The Western-only phrase is real and attested in the
     * exact slot, but it is a two-word prepositional phrase whose article attaches to its SECOND word,
     * and the tier can only postpose a noun.
     *
     * ⚠ NO `£` — this corpus writes only `$` and `€`, and no Western Armenian pound word is in any source
     * the sourcing gate can read. An undeclared sign stays visible to the leak gates.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "տոկոս" },
        // ⚠ INSERTION-ORDERED, like JS `Object.keys`: the tier sorts currency keys longest-first, stably.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "տոլար" }, ["€"] = new[] { "եւրօ" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["կմ"] = new[] { "քիլոմեթր" }, ["մ"] = new[] { "մեթր" }, ["սմ"] = new[] { "սանթիմեթր" },
            ["մմ"] = new[] { "միլիմեթր" }, ["կգ"] = new[] { "քիլոկրամ" }, ["հա"] = new[] { "հեքթար" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "քառակուսի" },
            Cubed = new[] { "խորանարդ" },
            Position = ExponentPosition.Before,
        },
        Magnitudes = new[] { "հազար", "միլիոն", "միլիառ" },
    });

    // ⚠ normalize FIRST, then the tier — the same coupling Eastern documents: normalize's ordinal,
    // suffix, era and degree steps need the figure and its written suffix still adjacent, which the tier
    // would break.
    private static readonly ArmenianEngine Western =
        Armenian.Armenian.MakeArmenianEngine(Manifest.MANIFEST, s => SYMBOLS(Normalize.NormalizeWestArmenian(s)));

    /** One Western Armenian word → canonical IPA. */
    public static string PhonemizeWord(string word) => Western.PhonemizeWord(word);

    /** Build the Western Armenian phonemizer. */
    public static ILanguage CreateWestArmenian() => Western.Create();

    internal static void RegisterSelf() => Registry.Register("westarmenian", CreateWestArmenian);
}
