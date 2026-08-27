/**
 * Async neural entry for Afrikaans (af).
 * Ported from src/languages/afrikaans/afrikaansNeural.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Afrikaans;

public static class AfrikaansNeural
{
    private static readonly JsRe WORD = JsRegex.Compile(
        "['’]?\\p{Script=Latin}[\\p{Script=Latin}\\p{M}]*(?:['’]\\p{Script=Latin}[\\p{Script=Latin}\\p{M}]*)*", "gu");

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
        return await StructuralTagger.WordLevelNeuralPrepass(text, new NeuralPrepassOptions
        {
            Word = WORD,
            Key = w => Js.ToLowerCase(w.Normalize(NormalizationForm.FormC)),
            LexHas = w => AfrikaansPhonemizer.AfrikaansLexiconHas(w) || AfrikaansPhonemizer.AfrikaansRuleReserved(w),
            Tag = w => tagger.Tag(w),
            Render = (t, oov) => Foreign.WithHost("af", () => AfEngine().Text(t, w => oov(w))),
        }).ConfigureAwait(false);
    }
}
