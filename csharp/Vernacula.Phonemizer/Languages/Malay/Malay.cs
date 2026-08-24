/**
 * Standard Malay (zsm) — the Indonesian engine plus a Malay normalization PRE-PASS.
 * Ported from src/languages/malay/malay.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Indonesian;

namespace Vernacula.Phonemizer.Languages.Malay;

public static class MalayPhonemizer
{
    private sealed class Engine : ILanguage
    {
        private readonly ILanguage _inner;

        /**
         * The FOREIGN reader is threaded through to the Indonesian engine: a token carrying a diacritic is a
         * foreign name, and without a reader for it the native g2p drops the letter it cannot spell.
         */
        internal Engine(Func<string, string>? foreign = null) =>
            _inner = IndonesianPhonemizer.CreateIndonesian(foreign);

        /**
         * Malay conventions first, then the Indonesian engine's own Text() — which runs the inherited
         * Indonesian normalization and the shared symbol tier over what is left. Ordering is the point: a
         * Malay rule can only pre-empt an Indonesian one if it runs first.
         */
        public string Text(string input) => _inner.Text(Normalize.NormalizeMalay(input));
    }

    /** Build the Standard Malay phonemizer. */
    public static ILanguage CreateMalay(Func<string, string>? foreign = null) => new Engine(foreign);

    internal static void RegisterSelf() =>
        Registry.Register("malay", () => CreateMalay(Registry.ReadAsEnglish));
}
