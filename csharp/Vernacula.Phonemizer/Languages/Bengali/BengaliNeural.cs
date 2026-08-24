/**
 * Async neural entry for Bengali (bn). Runs the per-grapheme STRUCTURAL TAGGER (bengaliTagger.ts, a BiLSTM,
 * ONNX) over the OOV words — those the authoritative Kolkata gold + cross-source consensus lexicon
 * (bengali-lexicon.tsv) miss — and leaves everything else to the SYNC engine. Precedence is lexicon → tagger →
 * rule engine: the tagger's whole-word bidirectional pass reads Bengali's ɔ/o raising + inherent-vowel deletion
 * (held-out OOV ɔ/o 90.5% vs the rule engine's 62.6%), and because it emits one IPA-chunk per grapheme it CANNOT
 * degenerate or break the consonant skeleton.
 *
 * Integration is a pre-pass: resolve each OOV Bengali word to IPA with the tagger, then run the ordinary sync
 * `createBengali(...).text()` with those readings injected as its `oovOverride`. So the tokenizer, number path,
 * clause/pause assembly, and lexicon precedence are the SYNC engine's, byte-identical to `phonemize(text, "bn")` —
 * ONLY the OOV word readings change. When `onnxruntime-node` or the model is absent the tagger is `undefined` and
 * this returns exactly the sync path (no throw). This is a SEPARATE async path; the sync engine and its C#-parity
 * are untouched. See src/languages/bengali/bn-g2p-tagger.PROVENANCE.md.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bengali;

public static class BengaliNeural
{
    private static readonly JsRe WORD = JsRegex.Compile($"[{Unicode.BENGALI_WORD}]+", "gu");
    private static Task<IWordStructuralTagger?>? taggerP;
    // One built engine, reused across calls (like the sync path's singleton — no per-call rebuild). Built WITH the same
    // English `foreign` phonemizer the registry wires for "bn", so embedded Latin is transliterated identically to
    // phonemize(text,"bn"); getPhonemizer is called lazily so there is no import cycle at module init.
    private static NativeBengaliEngine? engine;
    private static NativeBengaliEngine BnEngine() =>
        engine ??= Bengali.CreateBengali(latin => Registry.GetPhonemizer("en").Text(latin));

    /**
     * Phonemize Bengali text with the neural tagger filling the OOV tail. Async because the ONNX pass is; falls back to
     * the plain sync path (lexicon + rule engine) when the model / `onnxruntime-node` is unavailable.
     */
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
            // `withHost` — the engine is built here rather than by the registry, so nothing else pushes the host
            // and a foreign run would be dropped for want of one (core/foreign.ts). Sync, as that stack requires.
            Render = (t, oov) => Foreign.WithHost("bn", () => BnEngine().Text(t, oov)),
        }).ConfigureAwait(false);
    }
}
