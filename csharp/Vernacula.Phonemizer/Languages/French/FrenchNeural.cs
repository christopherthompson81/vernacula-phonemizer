/**
 * Async neural entry for French (fr).
 * Ported from src/languages/french/frenchNeural.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.French;

public static class FrenchNeural
{
    private static readonly JsRe WORD = JsRegex.Compile("[a-zà-ÿœæ]+(?:['’][a-zà-ÿœæ]+)?", "giu");
    private static readonly JsRe IN_VOCAB = JsRegex.Compile("^[a-zà-ÿœæ-]+$", "u"); // the tagger's a–z + accented + hyphen training vocab (no apostrophe/elision)
    private static Task<IWordStructuralTagger?>? taggerP;
    private static FrenchPhonemizer.FrenchEngine? engine;
    private static FrenchPhonemizer.FrenchEngine FrEngine() => engine ??= FrenchPhonemizer.CreateFrench();

    /** Phonemize French text with the neural tagger filling the OOV tail. */
    public static async Task<string> PhonemizeFrNeural(string text)
    {
        Task<IWordStructuralTagger?> pending;
        lock (WORD)
        {
            taggerP ??= FrenchTagger.CreateFrenchTagger();
            pending = taggerP;
        }
        var tagger = await pending.ConfigureAwait(false);
        var E = FrEngine();
        if (tagger is null) return Foreign.WithHost("fr", () => E.Text(text)); // no model → sync path

        var lex = FrenchPhonemizer.FrenchLexicon();
        return await StructuralTagger.WordLevelNeuralPrepass(text, new NeuralPrepassOptions
        {
            Word = WORD,
            Key = w => w.ToLowerInvariant(),
            LexHas = lower => lex.ContainsKey(lower) || !IN_VOCAB.IsMatch(lower),
            Tag = lower => tagger.Tag(lower),
            Render = (t, oov) => Foreign.WithHost("fr", () => E.Text(t, oov)),
        }).ConfigureAwait(false);
    }
}
