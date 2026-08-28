/**
 * vernacula-phonemizer — canonical-IPA. (C# port of src/index.ts.)
 *
 *   phonemize("भारत", "hi") → "bʱaːɾət̪"
 *   phonemize("I read a book", "en") → "aᶦ ɹˈɛd ə bˈʊk"
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer;

/** The result of {@link Phonemizer.PhonemizeTrace}. */
public sealed class PhonemeTrace
{
    /** Byte-identical to `Phonemize(text, lang)`. */
    public string Ipa { get; init; } = "";
    /** The text the tokenizer saw — normalization has already rewritten it. Token spans index THIS. */
    public string Normalized { get; init; } = "";
    /** ⚠ FALSE MEANS THIS ENGINE IS NOT TRACED, not that it had nothing to say. */
    public bool Traced { get; init; }
    public List<Core.TraceToken> Tokens { get; init; } = new();
    /** Whole-string rewrites — why a token's `Emitted` may not be a substring of `Ipa`. */
    public List<Core.TraceRewrite> Rewrites { get; init; } = new();
}

public static class Phonemizer
{
    /**
     * Does `text` mix a Latin run into a non-Latin script? Then the host's tokenizer will not claim the Latin
     * and it becomes a FOREIGN RUN, delegated to English (core/foreign.ts) — so its OOV words are worth
     * prewarming.
     *
     * The gate is on the TEXT, not a table of host scripts, because that is what the delegation actually keys
     * on, and because it keeps the prewarm off the languages that would waste it: a Latin-script host
     * (en, vi, tr, …) reads its own words, so an all-Latin text needs nothing tagged for the foreign path.
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
     *  This is the simple path: a complete rule/lexicon engine for every language. Two caveats it does NOT
     *  cover — the unpointed ABJADS (Arabic `ar`+dialects, Hebrew `he`) expect VOCALIZED input here (bare text
     *  → the consonant skeleton), and the languages with a neural OOV/restoration upgrade
     *  (en, bn, da, nb, fr, fa, ur, ps, pnb) use their SYNC fallback. `phonemizeAsync` covers both — prefer it
     *  for real-world text. */
    public static string Phonemize(string text, string lang) =>
        Registry.GetPhonemizer(lang).Text(text);

    /**
     * `Phonemize`, plus what happened on the way — the additive trace of #1150 stage 1.
     * Ported from src/index.ts `phonemizeTrace`; see src/core/trace.ts for the evidence and the design.
     *
     * ⚠ `Ipa` is byte-identical to `Phonemize(text, lang)`. Spans index `Normalized`, NOT `text`:
     * normalization rewrites and can REORDER, so mapping back is not an offset problem (that is stage 2).
     */
    public static PhonemeTrace PhonemizeTrace(string text, string lang)
    {
        Core.Trace.Start(text);
        try
        {
            var ipa = Phonemize(text, lang);
            var r = Core.Trace.Stop();
            return new PhonemeTrace { Ipa = ipa, Normalized = r.Normalized, Traced = r.Traced, Tokens = r.Tokens, Rewrites = r.Rewrites };
        }
        finally
        {
            // Already stopped on the success path; this clears ambient state when the engine THREW.
            Core.Trace.Stop();
        }
    }

    /** Phonemize real-world text to canonical IPA — the UNIFIED best-output entry. Identical to `phonemize` for
     *  the bulk, but routes each language to its best available path (neuralRegistry.ts): the unpointed ABJADS
     *  restore their unwritten vowels from BARE input (Arabic `ar`+dialects via the neural diacritizer), and
     *  the neural-upgrade languages (en's BiLSTM OOV, bn/da/nb/fr taggers, he NAKDAN, fa + the ur/ps/pnb
     *  Perso-Arabic riders) use their ONNX model. Every other language resolves synchronously. When a model /
     *  `onnxruntime-node` is absent each path degrades to the sync engine, so this is always safe to call. Use
     *  this for undiacritized / novel-word text.
     *
     *  ⚠ THE TWO ENTRIES SHARE THE REGISTRY'S PRE-PASSES. Markup stripping, the native/fullwidth digit folds,
     *  the vulgar-fraction fold, the Roman-numeral pass and the foreign-run host apply here exactly as they do
     *  to `phonemize`, because `GetNeuralPhonemizer` applies them — the async entries build their engine
     *  directly and so never reach the wrapper `GetPhonemizer` installs. */
    public static async Task<string> PhonemizeAsync(string text, string lang)
    {
        // ⚠ THE BOOTSTRAP RUNS FIRST, BEFORE THE PREWARM GATE READS `PrewarmForeignEnglish`. C#-only ordering:
        // the TS reaches `prewarmForeignEnglish` through a static import, while here the slot is filled by
        // `Bootstrap.EnsureRegistered`. Testing it before the bootstrap made it null on the FIRST
        // `PhonemizeAsync` of a process, so that one call skipped the prewarm and its embedded Latin words got
        // the n-gram reading instead of the BiLSTM one — `ኣብ Wolaytta ዝብል` read *wˈʌleᶦt̬ˌeᶦ* against Node's
        // *woᶷlˈeᶦt̬ə*. Invisible to the gate: the memo is process-wide, so row 2 onward warmed it and no
        // golden's FIRST row carries a Latin OOV word.
        Registry.EnsureLanguages();
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
        // ⚠ The language bootstrap (called above) installs the neural table too; without it the FIRST async
        // call in a process finds it empty and silently serves the sync reading.
        var neural = GetNeuralPhonemizer(lang);
        return neural is not null ? await neural(text).ConfigureAwait(false) : Phonemize(text, lang);
    }
}
