/**
 * Async neural entry for the Perso-Arabic riders (Urdu, Persian, Pashto, Punjabi-Shahmukhi) — the deploy wrapper
 * that runs the shared multilingual BiLSTM harakat pre-pass (core/riderDiacritizer.ts, ONNX) and then the SYNC
 * phonemizer. This is the full two-layer path: the pre-pass leaves lexicon-covered words BARE (the sync g2p's
 * restoreHarakat then applies the authoritative gold lexicon) and neural-vocalizes only the rest — so precedence
 * is lexicon → neural → default. When the optional `onnxruntime-node` dep or the .onnx model is absent the pre-pass
 * is a no-op and you get exactly the sync `phonemize(text, lang)` (lexicon + default). Bare Arabic uses the
 * separate `phonemizeArabic`; this is its rider analogue.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer;

public static class RiderNeural
{
    // The model's language token codes (train_multilingual_harakat.py LANGS) → each rider's coverage-lexicon ACCESSOR.
    // Lazy (functions, not eager Maps) so a single-language neural call loads only that rider's lexicon, not all four.
    //
    // ⚠ PORT STATUS: the TypeScript declares all four riders (ur, fa, ps, pa) statically; this table is REGISTERED
    // INTO by each rider language as it lands, exactly as Languages/Bootstrap.cs and NeuralRegistry do. An unported
    // rider is therefore absent rather than wrong — `phonemizeRiderNeural` throws the same named error it throws in
    // TypeScript for a non-rider, and `Registry.GetPhonemizer` already reports that language as port-pending.
    private static readonly Dictionary<string, Func<IReadOnlyDictionary<string, string>>> LEXICONS =
        new(StringComparer.Ordinal);

    /** Register a rider's coverage-lexicon accessor. Called from the language's own RegisterSelf. */
    public static void RegisterRider(string lang, Func<IReadOnlyDictionary<string, string>> lexicon) =>
        LEXICONS[lang] = lexicon;

    /** The rider languages served by the neural pre-pass (the model was trained on exactly these + Arabic). */
    public static IReadOnlyList<string> NEURAL_RIDERS => LEXICONS.Keys.OrderBy(k => k, StringComparer.Ordinal).ToList();

    private static Task<IRiderDiacritizer?>? diacritizer;
    private static readonly object Gate = new();

    /**
     * Phonemize bare (undiacritized) rider text via the neural short-vowel pre-pass + the sync g2p. `lang` must be one
     * of NEURAL_RIDERS. Async because the ONNX pre-pass is; the g2p itself stays sync. Falls back to the plain sync
     * path (lexicon + default) when the model/`onnxruntime-node` is unavailable.
     */
    public static async Task<string> PhonemizeRiderNeural(string text, string lang)
    {
        Registry.EnsureLanguages();
        if (!LEXICONS.TryGetValue(lang, out var lex))
            throw new InvalidOperationException(
                $"phonemizeRiderNeural: \"{lang}\" is not a neural rider (expected one of {string.Join(", ", NEURAL_RIDERS)})");
        Task<IRiderDiacritizer?> pending;
        lock (Gate)
        {
            diacritizer ??= RiderDiacritizerLoader.CreateRiderDiacritizer();
            pending = diacritizer;
        }
        var diac = await pending.ConfigureAwait(false); // undefined when the model or onnxruntime-node is unavailable → sync fallback
        var vocalized = diac is not null ? await diac.Diacritize(text, lang, lex()).ConfigureAwait(false) : text;
        // `renderInHost`, NOT `getPhonemizer(lang).text`: the shared pre-passes have already run once, at
        // `getNeuralPhonemizer`, and the chain is not idempotent — `stripMarkup` decodes entities, so a second pass
        // would turn an author's `&amp;lt;` into a real `<` and strip it. This renders in `lang`'s host with the
        // engine only. (This file was the ONE async entry that already reached the registry wrapper; the pre-passes
        // moved up rather than away.)
        return Registry.RenderInHost(lang, vocalized);
    }
}
