/**
 * Async neural entry for Khmer (km) — restores the WORD BOUNDARIES Khmer does not write with the BiLSTM,
 * then hands the text to the unchanged sync engine (built with `segment: false`, so the perceptron does
 * not split the pieces again).
 * Ported from src/languages/khmer/khmerNeural.ts — see that file for the measured gain and the fallback.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Khmer;

public static class KhmerNeural
{
    private static Task<IKhmerSegmenter?>? segmenterP;
    /** BiLSTM boundaries supplied here, so the engine must NOT add the perceptron's on top. */
    private static ILanguage? unsegmented;
    /** ⚠ The FALLBACK engine still segments — without the BiLSTM this path degrades to the ordinary sync
     *  path (perceptron boundaries), not to the unsegmented reading that predates both models. */
    private static ILanguage? segmenting;
    private static readonly object Gate = new();

    /** Phonemize Khmer text, restoring word boundaries with the neural tagger before the sync engine reads it. */
    public static async Task<string> PhonemizeKmNeural(string text)
    {
        Task<IKhmerSegmenter?> pending;
        lock (Gate) pending = segmenterP ??= KhmerSegmenter.CreateKhmerSegmenter();
        var segmenter = await pending.ConfigureAwait(false);
        if (segmenter is null)
        {
            ILanguage fallback;
            lock (Gate) fallback = segmenting ??= KhmerPhonemizer.CreateKhmer();
            return Foreign.WithHost("km", () => fallback.Text(text));
        }
        ILanguage engine;
        lock (Gate) engine = unsegmented ??= KhmerPhonemizer.CreateKhmer(segmentOpt: false);
        // The await is HOISTED out of WithHost: the host stack is only correct within one synchronous turn.
        var segmented = await segmenter.Restore(text).ConfigureAwait(false);
        return Foreign.WithHost("km", () => engine.Text(segmented));
    }
}
