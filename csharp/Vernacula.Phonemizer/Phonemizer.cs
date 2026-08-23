/**
 * vernacula-phonemizer — canonical-IPA. (C# port of src/index.ts.)
 *
 *   phonemize("भारत", "hi") → "bʱaːɾət̪"
 *   phonemize("I read a book", "en") → "aᶦ ɹˈɛd ə bˈʊk"
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer;

public static class Phonemizer
{
    /**
     * Does `text` mix a Latin run into a non-Latin script? Then the host's tokenizer will not claim the Latin and it
     * becomes a FOREIGN RUN, delegated to English (core/foreign.ts) — so its OOV words are worth prewarming.
     *
     * The gate is on the TEXT, not a table of host scripts, because that is what the delegation actually keys on, and
     * because it keeps the prewarm off the languages that would waste it: a Latin-script host (en, vi, tr, …) reads
     * its own words, so an all-Latin text needs nothing tagged for the foreign path.
     */
    private static readonly JsRe LatinAny = JsRegex.Compile(@"\p{Script=Latin}", "u");

    private static readonly JsRe NonLatinAny = JsRegex.Compile(
        @"[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Arabic}\p{Script=Cyrillic}\p{Script=Devanagari}\p{Script=Tamil}\p{Script=Ethiopic}\p{Script=Hebrew}\p{Script=Bengali}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Gujarati}\p{Script=Gurmukhi}\p{Script=Sinhala}\p{Script=Khmer}\p{Script=Lao}\p{Script=Myanmar}\p{Script=Georgian}\p{Script=Armenian}\p{Script=Greek}\p{Script=Tibetan}\p{Script=Oriya}\p{Script=Thaana}\p{Script=Syriac}\p{Script=Cherokee}]",
        "u");

    private static bool MixedLatin(string text) => LatinAny.IsMatch(text) && NonLatinAny.IsMatch(text);

    /**
     * PORT-PENDING HOOKS. `phonemizeAsync` dispatches through src/neuralRegistry.ts and prewarms
     * embedded-Latin OOV words via languages/english/englishNeural.ts — neither is in the core port's
     * scope. The two slots below are where those ports register themselves; until then they are null
     * and `phonemizeAsync` degrades to the sync engine, which is EXACTLY the TS behaviour when a
     * model / onnxruntime-node is absent — "every path degrades to the sync engine, so this is always
     * safe to call".
     */
    /// <summary>Port of `getNeuralPhonemizer(lang)`: the best async path for a language, or null.
    /// Registered by the neuralRegistry port.</summary>
    public static Func<string, Func<string, Task<string>>?> GetNeuralPhonemizer { get; set; } = _ => null;

    /// <summary>Port of `prewarmForeignEnglish(text)`. Registered by the English neural port.</summary>
    public static Func<string, Task>? PrewarmForeignEnglish { get; set; }

    /** Phonemize `text` in language `lang` to canonical IPA (SYNCHRONOUS). Throws for an unregistered language.
     *  This is the simple path: a complete rule/lexicon engine for every language. Two caveats it does NOT cover —
     *  the unpointed ABJADS (Arabic `ar`+dialects, Hebrew `he`) expect VOCALIZED input here (bare text → the consonant
     *  skeleton), and the languages with a neural OOV/restoration upgrade (en, bn, da, nb, fr, fa, ur, ps, pnb) use
     *  their SYNC fallback. `phonemizeAsync` covers both — prefer it for real-world text. */
    public static string Phonemize(string text, string lang) =>
        Registry.GetPhonemizer(lang).Text(text);

    /** Phonemize real-world text to canonical IPA — the UNIFIED best-output entry. Identical to `phonemize` for the
     *  bulk, but routes each language to its best available path (neuralRegistry.ts): the unpointed ABJADS restore
     *  their unwritten vowels from BARE input (Arabic `ar`+dialects via the neural diacritizer), and the
     *  neural-upgrade languages (en's BiLSTM OOV, bn/da/nb/fr taggers, he NAKDAN, fa + the ur/ps/pnb Perso-Arabic
     *  riders) use their ONNX model. Every other language resolves synchronously. When a model / `onnxruntime-node`
     *  is absent each path degrades to the sync engine, so this is always safe to call. Use this for undiacritized /
     *  novel-word text.
     *
     *  ⚠ THE TWO ENTRIES SHARE THE REGISTRY'S PRE-PASSES. Markup stripping, the native/fullwidth digit folds, the
     *  vulgar-fraction fold, the Roman-numeral pass and the foreign-run host apply here exactly as they do to
     *  `phonemize` — they used not to, because the async registry's entries build their engine directly and so
     *  never reached the wrapper `getPhonemizer` installs. `getNeuralPhonemizer` applies them now; see the note
     *  there, and `test/phonemizeAsync.test.ts` for the invariant that keeps the two in step. */
    public static async Task<string> PhonemizeAsync(string text, string lang)
    {
        // FOREIGN RUNS FIRST. An embedded Latin run is read by a synchronous reader (core/foreign.ts), so its OOV
        // words have to be tagged BEFORE the host renders — there is no await available once the host's tokenizer is
        // running. Skipped for English itself, whose entry tags its own OOV tail. Never throws the host's render:
        // the memo is an optimisation, and an empty one is the pre-existing behaviour.
        if (lang != "en" && MixedLatin(text) && PrewarmForeignEnglish is not null)
        {
            try
            {
                await PrewarmForeignEnglish(text).ConfigureAwait(false);
            }
            catch
            {
                // A missing model or a tagger failure must not take the utterance down.
            }
        }
        var neural = GetNeuralPhonemizer(lang);
        return neural is not null ? await neural(text).ConfigureAwait(false) : Phonemize(text, lang);
    }
}
