/**
 * Async neural entry for Norwegian Bokmål (nb). Runs the per-grapheme structural tagger over the words the
 * NST lexicon misses and leaves everything else to the sync engine (lexicon → tagger → rules).
 * Ported from src/languages/norwegian/norwegianNeural.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Norwegian;

public static class NorwegianNeural
{
    private static readonly JsRe WORD = JsRegex.Compile("[A-Za-zÆØÅæøåÉéÈèÊêËëÀàÂâÔôÜü]+", "gu");

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
        return await StructuralTagger.WordLevelNeuralPrepass(text, new NeuralPrepassOptions
        {
            Word = WORD,
            // ⚠ NO `Key`: the TS declares none, so the tagged map is keyed by the RAW matched spelling while
            // `LexHas` lowercases. Adding one would change which words the tagger claims.
            LexHas = w => NorwegianPhonemizer.NorwegianLexiconHas(Js.ToLowerCase(w)),
            Tag = w => tagger.Tag(w),
            Render = (t, oov) => Foreign.WithHost("nb", () => NbEngine().Text(t, w => oov(w))),
        }).ConfigureAwait(false);
    }
}
