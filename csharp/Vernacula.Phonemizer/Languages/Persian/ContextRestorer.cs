/**
 * Persian CONTEXT restorer — a SENTENCE-level char seq2seq (BiLSTM encoder + attention decoder) mapping a
 * whole abjad hemistich to IPA. CLASSICAL-scoped and optional: it is not wired into the default modern
 * runtime, and the factory returns null when the ONNX runtime or the models are absent.
 * Ported from src/languages/persian/contextRestorer.ts — see that file for the corpus evidence.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Persian;

public sealed class Seq2SeqMeta
{
    public Dictionary<string, int> Src { get; init; } = new();
    public Dictionary<string, int> Tgt { get; init; } = new();
    // ⚠ The sidecar key is a CAPITAL `H`, and the shared deserializer's camelCase policy would rename this
    // member to "h" — which binds nothing, leaving a zero-width decoder hidden state that ONNX rejects. The
    // explicit name is load-bearing; the fa golden runs the tagger, so no parity gate catches its removal.
    [System.Text.Json.Serialization.JsonPropertyName("H")]
    public int H { get; init; }
    public int Bos { get; init; }
    public int Eos { get; init; }
    public int Unk { get; init; }
}

public interface IFaContextRestorer
{
    /** A Persian abjad sentence/hemistich → restored Iranian IPA (per-word final stress). */
    Task<string> Restore(string sentence);
}

public static class ContextRestorer
{
    private static readonly JsRe VOWEL_G = JsRegex.Compile("[aeiouɒæ]ː?", "gu");

    /**
     * Mark Persian final stress on the last vowel of each space-separated word. Shared with the structural
     * tagger.
     */
    public static string StressPerWord(string ipa) =>
        string.Join(" ", ipa.Split(' ').Select(w =>
        {
            var vs = VOWEL_G.Matches(w);
            if (vs.Count == 0) return w;
            var last = vs[^1].Index;
            return w[..last] + "ˈ" + w[last..];
        }));

    /** One decoding hypothesis: the token ids so far, its accumulated log-probability, the LSTM state that
     *  produced them, and whether it has emitted EOS. */
    private sealed class Beam
    {
        public required List<int> Toks;
        public required double Lp;
        public required OrtTensor H;
        public required OrtTensor C;
        public required bool Done;
    }

    /**
     * The shared BEAM decode for both Persian seq2seq restorers (word-level vowelRestorer and this sentence-
     * level classical one) — length-normalised, width B, over an encoder output + decoder-step graph.
     * Factored out IN THE PORT: the TypeScript carries the loop twice, differing only in the step cap, which
     * is the `maxSteps` parameter here. No behaviour differs from either copy.
     */
    internal static async Task<List<int>> BeamDecode(
        IOrtLike ort, IOrtSession dec, OrtTensor encO, OrtTensor mask, Seq2SeqMeta meta, int maxSteps)
    {
        const int B = 5;
        var Z = 2 * meta.H;
        OrtTensor Zero() => ort.Tensor("float32", new float[Z], new[] { 1, 1, Z });
        static double Score(Beam b) => b.Lp / Math.Max(b.Toks.Count, 1); // length-normalised

        var beams = new List<Beam>
        {
            new() { Toks = new List<int> { meta.Bos }, Lp = 0, H = Zero(), C = Zero(), Done = false },
        };
        for (var step = 0; step < maxSteps && !beams.All(b => b.Done); step++)
        {
            var cand = new List<Beam>();
            foreach (var b in beams)
            {
                if (b.Done) { cand.Add(b); continue; }
                var r = await dec.Run(new Dictionary<string, OrtTensor>
                {
                    ["y"] = ort.Tensor("int64", new[] { (long)b.Toks[^1] }, new[] { 1, 1 }),
                    ["h"] = b.H,
                    ["c"] = b.C,
                    ["enc_o"] = encO,
                    ["mask"] = mask,
                }).ConfigureAwait(false);
                var lo = (r.GetValueOrDefault("logits") ?? throw new InvalidOperationException("decoder produced no logits")).AsFloat32();
                var mx = double.NegativeInfinity;
                foreach (var v in lo) if (v > mx) mx = v;
                double sum = 0;
                foreach (var v in lo) sum += Math.Exp(v - mx);
                var lse = mx + Math.Log(sum); // log-sum-exp → log-softmax
                // JS `Array.prototype.sort` is stable and .NET's OrderByDescending is too, so equal logits
                // keep index order in both — the tie-break that decides a beam when two tags score alike.
                var idx = Enumerable.Range(0, lo.Length).OrderByDescending(i => lo[i]).Take(B);
                var hOut = r["h_out"];
                var cOut = r["c_out"];
                foreach (var nid in idx)
                {
                    var toks = new List<int>(b.Toks) { nid };
                    cand.Add(new Beam { Toks = toks, Lp = b.Lp + (lo[nid] - lse), H = hOut, C = cOut, Done = nid == meta.Eos });
                }
            }
            beams = cand.OrderByDescending(Score).Take(B).ToList();
        }
        var best = beams.Aggregate((a, z) => Score(z) > Score(a) ? z : a);
        return best.Toks.Skip(1).Where(t => t != meta.Eos).ToList();
    }

    private sealed class Loaded : IFaContextRestorer
    {
        private readonly IOrtLike _ort;
        private readonly IOrtSession _enc;
        private readonly IOrtSession _dec;
        private readonly Seq2SeqMeta _meta;
        private readonly Dictionary<int, string> _i2t;

        internal Loaded(IOrtLike ort, IOrtSession enc, IOrtSession dec, Seq2SeqMeta meta)
        {
            _ort = ort;
            _enc = enc;
            _dec = dec;
            _meta = meta;
            _i2t = meta.Tgt.ToDictionary(kv => kv.Value, kv => kv.Key);
        }

        public async Task<string> Restore(string sentence)
        {
            var cps = Js.CodePoints(sentence);
            var ids = cps.Select(ch => (long)_meta.Src.GetValueOrDefault(ch, _meta.Unk)).ToArray();
            var T = ids.Length;
            if (T == 0) return "";
            var eo = (await _enc.Run(new Dictionary<string, OrtTensor>
            {
                ["tokens"] = _ort.Tensor("int64", ids, new[] { 1, T }),
            }).ConfigureAwait(false))["enc_o"];
            var mask = _ort.Tensor("bool", Enumerable.Repeat((byte)1, T).ToArray(), new[] { 1, T });
            var toks = await BeamDecode(_ort, _dec, eo, mask, _meta, T * 3 + 5).ConfigureAwait(false);
            return StressPerWord(string.Concat(toks.Select(t => _i2t.GetValueOrDefault(t) ?? "")));
        }
    }

    /**
     * Build the CLASSICAL Persian CONTEXT restorer ("fa-context-restorer", aligned-Shahnameh silver,
     * excellent on verse), or `undefined` if the model / onnxruntime-node is unavailable.
     */
    public static async Task<IFaContextRestorer?> CreateFaContextRestorer(string basename = "fa-context-restorer")
    {
        Seq2SeqMeta meta;
        byte[] encBytes, decBytes;
        try
        {
            meta = System.Text.Json.JsonSerializer.Deserialize<Seq2SeqMeta>(
                File.ReadAllText(DataPath.ResolveAllowMissing($"languages/persian/{basename}.meta.json")), Jsonc.JsonOpts)!;
            encBytes = File.ReadAllBytes(DataPath.ResolveAllowMissing($"languages/persian/{basename}.enc.onnx"));
            decBytes = File.ReadAllBytes(DataPath.ResolveAllowMissing($"languages/persian/{basename}.dec.onnx"));
        }
        catch { return null; }
        try
        {
            var ort = await Onnx.LoadOrt("Persian neural restoration").ConfigureAwait(false);
            var ep = Environment.GetEnvironmentVariable("FA_ORT_EP");
            var opts = string.IsNullOrEmpty(ep) ? null : ep.Split(',');
            var enc = await ort.CreateInferenceSession(encBytes, opts).ConfigureAwait(false);
            var dec = await ort.CreateInferenceSession(decBytes, opts).ConfigureAwait(false);
            return new Loaded(ort, enc, dec, meta);
        }
        catch { return null; }
    }
}
