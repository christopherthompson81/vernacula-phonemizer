/**
 * Async neural entry for French (fr).
 * Ported from src/languages/french/frenchNeural.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.French;

public static class FrenchNeural
{
    private static readonly JsRe WORD = JsRegex.Compile("[a-zà-ÿœæ]+(?:['’][a-zà-ÿœæ]+)?", "giu");
    // The tagger's a–z + accented training letters (no apostrophe/elision). WORD never matches a hyphen, so the
    // vocab's hyphen is not listed: a compound reaches the tagger part by part, through PhonemizeWord.
    private static readonly JsRe IN_VOCAB = JsRegex.Compile("^[a-zà-ÿœæ]+$", "u");
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
        return await PrepassWith(tagger, text).ConfigureAwait(false);
    }

    /** The pre-pass and render with a given tagger. Internal so a test can hand it a recording tagger and see
     *  which words are offered, which no reading can show while the tagger and the g2p agree. */
    internal static async Task<string> PrepassWith(IWordStructuralTagger tagger, string text)
    {
        var E = FrEngine();
        // ⚠ THE NORMALIZED TEXT, NOT THE CALLER'S (#1463): normalized once here and handed on, so a word the
        // normalizer creates reaches the tagger. supplement.tsv keeps the ones it misreads away from it.
        var normalized = E.NormalizedFor(text);
        return await StructuralTagger.WordLevelNeuralPrepass(normalized, new NeuralPrepassOptions
        {
            Word = WORD,
            Key = w => w.ToLowerInvariant(),
            LexHas = lower => FrenchPhonemizer.FrenchHasWord(lower) || !IN_VOCAB.IsMatch(lower),
            Tag = lower => tagger.Tag(lower),
            Render = (t, oov) => Foreign.WithHost("fr", () => E.TextNormalized(t, oov)),
        }).ConfigureAwait(false);
    }
}
