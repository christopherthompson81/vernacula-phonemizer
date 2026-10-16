/**
 * Async neural entry for Afrikaans (af).
 * Ported from src/languages/afrikaans/afrikaansNeural.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Afrikaans;

public static class AfrikaansNeural
{
    // ⚠ THE WORDS TAGGED ARE THE WORDS THE ENGINE ASKS FOR, recorded rather than re-derived (#1578): scanning
    // the text before normalization never tagged a word the normalizer creates (`90°F` → `Fahrenheit`). The
    // NFC-lowercase key and the lexicon / rule-reserved skips are the engine's own. See afrikaansNeural.ts.
    private static Task<IWordStructuralTagger?>? taggerP;
    private static readonly object Gate = new();
    private static AfrikaansPhonemizer? engine;
    private static AfrikaansPhonemizer AfEngine() => engine ??= AfrikaansPhonemizer.CreateAfrikaans();

    /** Phonemize Afrikaans text with the neural tagger filling the OOV tail. */
    public static async Task<string> PhonemizeAfNeural(string text)
    {
        Task<IWordStructuralTagger?> p;
        lock (Gate) p = taggerP ??= AfrikaansTaggerFactory.CreateAfrikaansTagger();
        var tagger = await p.ConfigureAwait(false);
        if (tagger is null) return Foreign.WithHost("af", () => AfEngine().Text(text)); // no model → sync path
        return await StructuralTagger.AskedWordsNeuralPrepass(text,
            w => tagger.Tag(w),
            (t, oov) => Foreign.WithHost("af", () => AfEngine().Text(t, w => oov(w)))).ConfigureAwait(false);
    }
}
