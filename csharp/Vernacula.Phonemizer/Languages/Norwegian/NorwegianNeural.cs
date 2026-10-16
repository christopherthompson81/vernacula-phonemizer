/**
 * Async neural entry for Norwegian Bokmål (nb). Runs the per-grapheme structural tagger over the words the
 * NST lexicon misses and leaves everything else to the sync engine (lexicon → tagger → rules).
 * Ported from src/languages/norwegian/norwegianNeural.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Norwegian;

public static class NorwegianNeural
{
    // ⚠ THE WORDS TAGGED ARE THE WORDS THE ENGINE ASKS FOR, recorded rather than re-derived (#1578): a
    // hand-listed letter class keyed by the raw match offered `Dvořák` as `Dvo` + `k` while the engine asked
    // for `Dvorak`. See norwegianNeural.ts.
    private static Task<IWordStructuralTagger?>? taggerP;
    private static readonly object Gate = new();
    private static NorwegianPhonemizer? engine;
    private static NorwegianPhonemizer NbEngine() => engine ??= NorwegianPhonemizer.CreateNorwegian();

    /** Phonemize Norwegian text with the neural tagger filling the OOV tail. */
    public static async Task<string> PhonemizeNbNeural(string text)
    {
        Task<IWordStructuralTagger?> p;
        lock (Gate) p = taggerP ??= NorwegianTaggerFactory.CreateNorwegianTagger();
        var tagger = await p.ConfigureAwait(false);
        if (tagger is null) return Foreign.WithHost("nb", () => NbEngine().Text(text)); // no model → sync path
        return await StructuralTagger.AskedWordsNeuralPrepass(text,
            w => tagger.Tag(w),
            (t, oov) => Foreign.WithHost("nb", () => NbEngine().Text(t, w => oov(w)))).ConfigureAwait(false);
    }
}
