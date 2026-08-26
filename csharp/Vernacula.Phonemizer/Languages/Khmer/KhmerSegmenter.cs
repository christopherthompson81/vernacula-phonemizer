/**
 * Khmer word-boundary tagger — a per-character BiLSTM (ONNX) that re-inserts the U+200B word boundaries
 * Khmer does not write, so the syllabifier stops re-parsing across them.
 * Ported from src/languages/khmer/khmerSegmenter.ts — see that file (and km-segmenter.PROVENANCE.md) for
 * the label cleaning and the measured gain.
 */
using System.Text.Json;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Khmer;

public interface IKhmerSegmenter
{
    /** Insert U+200B at every predicted word boundary inside each Khmer run of `text`. */
    Task<string> Restore(string text);
}

public sealed class KhmerSegmenterMeta
{
    public Dictionary<string, int> Src { get; init; } = new();
    public int MaxRun { get; init; }
}

public static class KhmerSegmenter
{
    /** U+200B ZERO WIDTH SPACE — what Khmer writers type at a word boundary. */
    public const string ZWSP = "​";

    private static readonly JsRe KHMER_RUN = JsRegex.Compile("[ក-៓ៜ-៝]{2,}", "gu");

    private const int MIN_PIECE = 2;
    /** …except an independent vowel, which IS a standalone Khmer word. Same exception as KhmerPerceptron. */
    private static readonly JsRe STANDALONE_1CHAR = JsRegex.Compile("[\\u17A3-\\u17B3]", "u");

    /**
     * Build the Khmer boundary tagger, or null when the model / the ONNX runtime is unavailable.
     * Runs longer than the training cap are SPLIT at the cap rather than truncated.
     */
    public static async Task<IKhmerSegmenter?> CreateKhmerSegmenter(string basename = "km-segmenter")
    {
        KhmerSegmenterMeta meta;
        try
        {
            meta = JsonSerializer.Deserialize<KhmerSegmenterMeta>(
                File.ReadAllText(DataPath.ResolveAllowMissing($"languages/khmer/{basename}.meta.json")), Jsonc.JsonOpts)!;
        }
        catch { return null; }
        try
        {
            var ort = await Onnx.LoadOrt("Khmer word segmentation").ConfigureAwait(false);
            var session = await ort.CreateInferenceSession(
                DataPath.ResolveAllowMissing($"languages/khmer/{basename}.int8.onnx")).ConfigureAwait(false);
            return new Loaded(ort, session, meta);
        }
        catch { return null; } // the runtime or the model is absent → the caller keeps the sync path
    }

    private sealed class Loaded : IKhmerSegmenter
    {
        private readonly IOrtLike _ort;
        private readonly IOrtSession _session;
        private readonly KhmerSegmenterMeta _meta;
        private readonly int _unk;
        private readonly int _cap;

        internal Loaded(IOrtLike ort, IOrtSession session, KhmerSegmenterMeta meta)
        {
            _ort = ort;
            _session = session;
            _meta = meta;
            _unk = meta.Src.TryGetValue("<unk>", out var u) ? u : 1;
            _cap = meta.MaxRun > 0 ? meta.MaxRun : 200;
        }

        /** Tag one run (already within the length cap) and return it with U+200B at each predicted boundary. */
        private async Task<string> TagOne(string run)
        {
            var chars = Js.CodePoints(run);
            var ids = chars.Select(c => (long)(_meta.Src.TryGetValue(c, out var id) ? id : _unk)).ToArray();
            var outp = await _session.Run(new Dictionary<string, OrtTensor>
            {
                ["chars"] = _ort.Tensor("int64", ids, new[] { 1, chars.Count }),
            }).ConfigureAwait(false);
            if (!outp.TryGetValue("logits", out var t) || t.Type != "float32") return run;
            var logits = t.AsFloat32();
            if (logits.Length < chars.Count * 3) return run;
            var parts = new List<string> { chars[0] };
            var since = 1; // characters emitted since the last boundary — the guard below needs it
            for (var i = 1; i < chars.Count; i++)
            {
                // class 1 = no boundary, class 2 = a word starts here (class 0 is pad/ignore, never decoded)
                var boundary = logits[i * 3 + 2] > logits[i * 3 + 1]
                    && (since >= MIN_PIECE || (since == 1 && STANDALONE_1CHAR.IsMatch(chars[i - 1])))
                    && (chars.Count - i >= MIN_PIECE || STANDALONE_1CHAR.IsMatch(chars[i]));
                if (boundary) { parts.Add(ZWSP); since = 0; }
                parts.Add(chars[i]);
                since++;
            }
            return string.Concat(parts);
        }

        private async Task<string> TagRun(string run)
        {
            if (run.Length <= _cap) return await TagOne(run).ConfigureAwait(false);
            var pieces = new List<string>();
            for (var i = 0; i < run.Length; i += _cap)
                pieces.Add(await TagOne(run.Substring(i, Math.Min(_cap, run.Length - i))).ConfigureAwait(false));
            return string.Join(ZWSP, pieces); // the cap itself is a boundary guess
        }

        public async Task<string> Restore(string text)
        {
            var runs = JsRegex.MatchAll(KHMER_RUN, text);
            if (runs.Count == 0) return text;
            var outp = "";
            var at = 0;
            foreach (var m in runs)
            {
                var start = m.Index;
                outp += text[at..start] + await TagRun(m.Value).ConfigureAwait(false);
                at = start + m.Value.Length;
            }
            return outp + text[at..];
        }
    }
}
