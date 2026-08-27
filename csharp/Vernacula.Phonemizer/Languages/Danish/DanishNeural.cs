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
    // ⚠ THE PRE-PASS TOKENIZES AND KEYS EXACTLY AS THE SYNC ENGINE DOES — Danish.cs's own LATIN_RUN and
    // `Nat`, not a restated letter class. A hand-listed copy drifted in the TS and silently skipped the
    // tagger tier for every word the nativiser rewrites; see danishNeural.ts for the measurement.
    private static readonly JsRe WORD = JsRegex.Compile(HostWord.LATIN_RUN, "giu");

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
        return await StructuralTagger.WordLevelNeuralPrepass(text, new NeuralPrepassOptions
        {
            Word = WORD,
            Key = w => DanishPhonemizer.Nat(w), // …the spelling Text() hands oovOverride; see the ⚠ on WORD
            LexHas = w => DanishPhonemizer.DanishLexiconHas(Js.ToLowerCase(w)),
            Tag = w => tagger.Tag(w), // tagger lowercases+NFCs internally; "" = declined → left to the rules
            // `WithHost` — the engine is built here rather than by the registry, so nothing else pushes the
            // host and a foreign run would be dropped for want of one (Core/Foreign.cs).
            Render = (t, oov) => Foreign.WithHost("da", () => DaEngine().Text(t, w => oov(w))),
        }).ConfigureAwait(false);
    }
}
