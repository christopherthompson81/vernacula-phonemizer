/**
 * Async neural entry for Central Kurdish (ckb). Runs the BIZROKE tagger over the words the AsoSoft-derived
 * lexicon misses and leaves everything else to the SYNC engine (lexicon → tagger → rules).
 * Ported from src/languages/central-kurdish/centralKurdishNeural.ts — see that file for the evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.CentralKurdish;

public static class CentralKurdishNeural
{
    private static readonly JsRe WORD = JsRegex.Compile("[ؠ-ۿ‌]+", "gu"); // ZWNJ

    private static Task<IWordStructuralTagger?>? taggerP;
    private static readonly object Gate = new();
    private static CentralKurdishPhonemizer? engine;
    private static CentralKurdishPhonemizer CkbEngine() =>
        engine ??= CentralKurdishPhonemizer.CreateCentralKurdishEngine();

    /** Phonemize Sorani text with the bizroke tagger filling the OOV tail. */
    public static async Task<string> PhonemizeCkbNeural(string text)
    {
        Task<IWordStructuralTagger?> p;
        lock (Gate) p = taggerP ??= CentralKurdishTaggerFactory.CreateCentralKurdishTagger();
        var tagger = await p.ConfigureAwait(false);
        if (tagger is null) return Foreign.WithHost("ckb", () => CkbEngine().Text(text)); // no model → sync path
        // ⚠ NORMALISE FIRST: the pre-pass keys its readings by the word as it appears in `text`, but the
        // engine tokenizes the NORMALISED text. NormalizeCentralKurdish is idempotent, so the engine
        // re-running it below is a no-op.
        return await StructuralTagger.WordLevelNeuralPrepass(Normalize.NormalizeCentralKurdish(text),
            new NeuralPrepassOptions
            {
                Word = WORD,
                LexHas = CentralKurdishPhonemizer.BizrokeLexiconHas, // the same lookup the engine does
                Tag = w => tagger.Tag(w),
                // `WithHost` — the engine is built here rather than by the registry, so nothing else pushes
                // the host and a foreign run would be dropped for want of one (Core/Foreign.cs).
                Render = (t, oov) => Foreign.WithHost("ckb", () => CkbEngine().Text(t, w => oov(w))),
            }).ConfigureAwait(false);
    }
}
