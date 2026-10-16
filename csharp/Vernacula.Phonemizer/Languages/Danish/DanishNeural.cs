/**
 * Async neural entry for Danish (da). Runs the per-grapheme BiLSTM tagger over the OOV words — those the
 * ~37k shipped NST lexicon misses — and leaves everything else to the SYNC engine. Precedence per word:
 * lexicon → BiLSTM tagger → rule g2p.
 * Ported from src/languages/danish/danishNeural.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Danish;

public static class DanishNeural
{
    // ⚠ THE WORDS TAGGED ARE THE WORDS THE ENGINE ASKS FOR, recorded rather than re-derived (#1578): a
    // restated tokenizer and key drifted twice, and scanning the text before normalization never tagged a
    // number word. See danishNeural.ts.
    private static Task<IWordStructuralTagger?>? taggerP;
    private static readonly object Gate = new();
    private static DanishPhonemizer? engine;
    private static DanishPhonemizer DaEngine() => engine ??= DanishPhonemizer.CreateDanish();

    /** Phonemize Danish text with the neural tagger filling the OOV tail. */
    public static async Task<string> PhonemizeDaNeural(string text)
    {
        Task<IWordStructuralTagger?> p;
        lock (Gate) p = taggerP ??= DanishTaggerFactory.CreateDanishTagger();
        var tagger = await p.ConfigureAwait(false);
        if (tagger is null) return Foreign.WithHost("da", () => DaEngine().Text(text)); // no model → sync path
        return await StructuralTagger.AskedWordsNeuralPrepass(text,
            w => tagger.Tag(w), // tagger lowercases+NFCs internally; "" = declined → left to the rules
            // `WithHost` — the engine is built here rather than by the registry, so nothing else pushes the
            // host and a foreign run would be dropped for want of one (Core/Foreign.cs).
            (t, oov) => Foreign.WithHost("da", () => DaEngine().Text(t, w => oov(w)))).ConfigureAwait(false);
    }
}
