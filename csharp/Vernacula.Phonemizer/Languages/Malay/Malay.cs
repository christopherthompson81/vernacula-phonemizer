/**
 * Standard Malay (zsm) — the Indonesian engine plus a Malay normalization PRE-PASS.
 *
 * The phonology stays Indonesian's, exactly as before: Malay and Indonesian are standardisations of one
 * Malayic language sharing the reformed Latin orthography, and no Malay-specific grapheme→IPA delta is
 * claimed (see registry.ts, and tools/language-catalogue served_by='id'). What is NOT shared is the
 * ORTHOGRAPHIC convention around numbers, clocks, units and abbreviations, which is what normalize.ts here
 * rewrites. Measured: 105 of 1,908 ms_my utterances change; 0 of 1,936 id_id utterances do, by construction —
 * nothing in src/languages/indonesian/ is touched or configured from here.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Indonesian;

namespace Vernacula.Phonemizer.Languages.Malay;

public static class MalayPhonemizer
{
    private sealed class Engine : ILanguage
    {
        private readonly ILanguage _inner;

        /** The FOREIGN reader is threaded through to the Indonesian engine, or Malay would keep the defect Indonesian
         *  just lost: a token carrying a diacritic is a foreign name, and without a reader for it the native g2p
         *  drops the letter it cannot spell (`Cañitas` → *t͡ʃaˈitas*). Malay inherits Indonesian's phonology, so it
         *  inherits its foreign-name problem too — and its solution. */
        internal Engine(Func<string, string>? foreign = null) =>
            _inner = IndonesianPhonemizer.CreateIndonesian(foreign);

        /** Malay conventions first, then the Indonesian engine's own `text()` — which runs the inherited
         *  Indonesian normalization and the shared symbol tier over what is left. Ordering is the point: a
         *  Malay rule can only pre-empt an Indonesian one if it runs first, and the shapes it does NOT claim
         *  (dot-thousands, `dsb.`, `ke-N`, the units, the currency names, the dates) are the shapes measured
         *  to be identical in both standards. */
        public string Text(string input) => _inner.Text(Normalize.NormalizeMalay(input));
    }

    /** Build the Standard Malay phonemizer. */
    public static ILanguage CreateMalay(Func<string, string>? foreign = null) => new Engine(foreign);

    internal static void RegisterSelf() =>
        Registry.Register("malay", () => CreateMalay(Registry.ReadAsEnglish));
}
