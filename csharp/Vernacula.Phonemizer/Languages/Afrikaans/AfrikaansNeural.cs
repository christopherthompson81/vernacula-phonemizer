/**
 * Async neural entry for Afrikaans (af). Runs the per-grapheme STRUCTURAL TAGGER (afrikaansTagger.ts, a BiLSTM,
 * ONNX) over the OOV words — those BOTH shipped lexicons miss — and leaves everything else to the SYNC engine.
 *
 * Precedence: curated af-lexicon.tsv → af-rcrl-lexicon.tsv → **tagger** → rules. The tagger sits below the
 * dictionaries because they are exact for the words they cover (86% of running-text tokens) and above the rules
 * because on the words neither covers it is far better: 91.4% vs 63.5% word-exact on a dictionary-gold held-out split.
 *
 * The shared `wordLevelNeuralPrepass` tags each distinct OOV word once and injects the readings as the sync
 * engine's oovOverride, so tokenizer / numbers / normalization / clause assembly stay byte-identical to
 * `phonemize(text, "af")` — only OOV word readings change. When `onnxruntime` or the model is absent the
 * tagger is `null` and this returns exactly the sync path (no throw). The sync engine is untouched.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Afrikaans;

public static class AfrikaansNeural
{
    // Mirrors the sync engine's TOKEN word class (Latin-script runs with an optional internal apostrophe).
    private static readonly JsRe WORD = JsRegex.Compile(
        "['’]?\\p{Script=Latin}[\\p{Script=Latin}\\p{M}]*(?:['’]\\p{Script=Latin}[\\p{Script=Latin}\\p{M}]*)*", "gu");

    private static Task<IWordStructuralTagger?>? taggerP;
    private static readonly object Gate = new();
    private static AfrikaansPhonemizer? engine;
    private static AfrikaansPhonemizer AfEngine() => engine ??= AfrikaansPhonemizer.CreateAfrikaans();

    /**
     * Phonemize Afrikaans text with the neural tagger filling the OOV tail. Async because the ONNX pass is; falls back
     * to the plain sync path (lexicons + rule engine) when the model / `onnxruntime` is unavailable.
     */
    public static async Task<string> PhonemizeAfNeural(string text)
    {
        Task<IWordStructuralTagger?> p;
        lock (Gate) p = taggerP ??= AfrikaansTaggerFactory.CreateAfrikaansTagger();
        var tagger = await p.ConfigureAwait(false);
        if (tagger is null) return Foreign.WithHost("af", () => AfEngine().Text(text)); // no model → sync path
        return await StructuralTagger.WordLevelNeuralPrepass(text, new NeuralPrepassOptions
        {
            Word = WORD,
            // ⚠ NFC, matching phonemizeWord's own key. Without it the prepass stores under the NFD key while the
            // lookup asks for the NFC one, so on decomposed input every reading is computed and then DISCARDED —
            // silently switching the tier off for exactly the diacritic-bearing words (ë ô ï ê) it was needed for.
            Key = w => w.Normalize(NormalizationForm.FormC).ToLowerInvariant(),
            // Lexicon-covered words are served by the sync lexicon path; RULE-RESERVED words (⟨'n⟩, bare letters)
            // by the rule path. The engine enforces the latter at the seam too — this just avoids a wasted tag().
            LexHas = w => AfrikaansPhonemizer.AfrikaansLexiconHas(w) || AfrikaansPhonemizer.AfrikaansRuleReserved(w),
            Tag = w => tagger.Tag(w),
            // `withHost` — the engine is built here rather than by the registry, so nothing else pushes the host
            // and a foreign run would be dropped for want of one (core/foreign.ts). Sync, as that stack requires.
            Render = (t, oov) => Foreign.WithHost("af", () => AfEngine().Text(t, w => oov(w))),
        }).ConfigureAwait(false);
    }
}
