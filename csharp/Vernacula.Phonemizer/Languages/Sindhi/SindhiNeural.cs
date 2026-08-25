/**
 * Async neural entry for Sindhi (sd). Runs the per-letter STRUCTURAL TAGGER over the OOV words — those the
 * vocalized lexicon misses — and leaves everything else to the SYNC engine (lexicon → tagger → default-ə).
 * Ported from src/languages/sindhi/sindhiNeural.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sindhi;

public static class SindhiNeural
{
    private static readonly JsRe WORD = JsRegex.Compile("[؀-ۿݐ-ݿ]+", "gu");

    private static Task<IWordStructuralTagger?>? taggerP;
    private static readonly object Gate = new();
    private static SindhiPhonemizer? engine;
    private static SindhiPhonemizer SdEngine() => engine ??= SindhiPhonemizer.CreateSindhiEngine();

    /** Phonemize Sindhi text with the neural tagger filling the OOV tail. */
    public static async Task<string> PhonemizeSdNeural(string text)
    {
        Task<IWordStructuralTagger?> p;
        lock (Gate) p = taggerP ??= SindhiTaggerFactory.CreateSindhiTagger();
        var tagger = await p.ConfigureAwait(false);
        if (tagger is null) return Foreign.WithHost("sd", () => SdEngine().Text(text)); // no model → sync path
        return await StructuralTagger.WordLevelNeuralPrepass(text, new NeuralPrepassOptions
        {
            Word = WORD,
            LexHas = SindhiPhonemizer.SindhiLexiconHas, // same lookup the engine does
            Tag = w => tagger.Tag(w),
            // `WithHost` — the engine is built here rather than by the registry, so nothing else pushes the
            // host and a foreign run would be dropped for want of one (Core/Foreign.cs).
            Render = (t, oov) => Foreign.WithHost("sd", () => SdEngine().Text(t, w => oov(w))),
        }).ConfigureAwait(false);
    }
}
