/**
 * Async neural entry for Bengali (bn).
 * Ported from src/languages/bengali/bengaliNeural.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bengali;

public static class BengaliNeural
{
    private static readonly JsRe WORD = JsRegex.Compile($"[{Unicode.BENGALI_WORD}]+", "gu");
    private static Task<IWordStructuralTagger?>? taggerP;
    // One built engine, reused across calls, wired with the same English `foreign` reader the registry gives
    // "bn" — resolved lazily, so there is no initialization cycle between this file and the registry.
    private static NativeBengaliEngine? engine;
    private static NativeBengaliEngine BnEngine() =>
        engine ??= Bengali.CreateBengali(latin => Registry.GetPhonemizer("en").Text(latin));

    /** Phonemize Bengali text with the neural tagger filling the OOV tail. */
    public static async Task<string> PhonemizeBnNeural(string text)
    {
        Task<IWordStructuralTagger?> pending;
        lock (WORD)
        {
            taggerP ??= BengaliTagger.CreateBengaliTagger();
            pending = taggerP;
        }
        var tagger = await pending.ConfigureAwait(false);
        if (tagger is null) return Foreign.WithHost("bn", () => BnEngine().Text(text, null)); // no model → sync path
        var lex = Bengali.BengaliLexicon();
        return await StructuralTagger.WordLevelNeuralPrepass(text, new NeuralPrepassOptions
        {
            Word = WORD,
            LexHas = w => lex.ContainsKey(w.Normalize(System.Text.NormalizationForm.FormC)), // lexicon-covered words are served by the sync lexicon path
            Tag = w => tagger.Tag(w),
            Render = (t, oov) => Foreign.WithHost("bn", () => BnEngine().Text(t, oov)),
        }).ConfigureAwait(false);
    }
}
