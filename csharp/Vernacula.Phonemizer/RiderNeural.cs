/**
 * Async neural entry for the Perso-Arabic riders (Urdu, Persian, Pashto, Punjabi-Shahmukhi): the shared
 * multilingual BiLSTM harakat pre-pass (ONNX) followed by the SYNC phonemizer, so precedence is
 * lexicon → neural → default. With no model or no `onnxruntime-node` the pre-pass is a no-op.
 * Ported from src/riderNeural.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer;

public static class RiderNeural
{
    // Model language token → that rider's coverage-lexicon ACCESSOR. Lazy (a `Func`, not an eager dictionary)
    // so a single-language neural call loads only that rider's lexicon, not all four.
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
    // ⚠ INSERTION ORDER, not sorted: the TS reads `Object.keys(LEXICONS)` off a literal, so the order is the
    // declaration order and it reaches users through the not-a-rider error message. A Dictionary preserves
    // insertion order as long as nothing is removed, which holds here (registration is append-only).
    public static IReadOnlyList<string> NEURAL_RIDERS => LEXICONS.Keys.ToList();

    private static Task<IRiderDiacritizer?>? diacritizer;
    private static readonly object Gate = new();

    /** Phonemize bare (undiacritized) rider text via the neural short-vowel pre-pass + the sync g2p. */
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
        // `RenderInHost`, NOT `GetPhonemizer(lang).Text`: the shared pre-passes have already run once, and the
        // chain is not idempotent — `StripMarkup` decodes entities, so a second pass would turn an author's
        // `&amp;lt;` into a real `<` and strip it.
        return Registry.RenderInHost(lang, vocalized);
    }
}
