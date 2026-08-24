/**
 * Neural GENERALIZATION tier for the Perso-Arabic riders (Urdu, Persian, Pashto, Punjabi-Shahmukhi) — a
 * shared multilingual BiLSTM that restores the short-vowel harakat these abjads leave unwritten, run as an
 * ASYNC pre-pass. ⚠ THE PRECEDENCE IS lexicon → neural → default: a word the exact-match lexicon already
 * covers is LEFT BARE here, so the authoritative sync lexicon layer vocalizes it. Vocalized output feeds
 * the SYNC g2p, so `Phonemize` stays sync.
 * Ported from src/core/riderDiacritizer.ts — see that file for the corpus evidence.
 */
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace Vernacula.Phonemizer.Core;

public sealed class RiderDiacritizerMeta
{
    public Dictionary<string, int> Chars { get; init; } = new();
    public Dictionary<string, int> Labels { get; init; } = new();
    [JsonPropertyName("lang_tokens")]
    public Dictionary<string, string> LangTokens { get; init; } = new();
}

public interface IRiderDiacritizer
{
    /** Vocalize the words of `text` for `lang`, skipping any word whose skeleton is in `lexicon` (left bare
     *  for the sync lexicon layer). Position-preserving: only harakat are inserted; spacing, digits and
     *  punctuation are kept. */
    Task<string> Diacritize(string text, string lang, IReadOnlyDictionary<string, string> lexicon);
}

public static class RiderDiacritizerLoader
{
    // label → the combining haraka to append after a base letter, mirroring the training VOWELS map. A "~"
    // prefix means shadda (gemination) plus that vowel; "0" is bare, the model's default.
    private static readonly IReadOnlyDictionary<string, string> HAR = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["0"] = "", ["a"] = "َ", ["u"] = "ُ", ["i"] = "ِ", ["o"] = "ْ",
        ["F"] = "ً", ["N"] = "ٌ", ["K"] = "ٍ", ["^"] = "ٰ",
    };

    private static string HarOf(string label)
    {
        if (label.StartsWith("~", StringComparison.Ordinal)) return "ّ" + (HAR.GetValueOrDefault(label[1..]) ?? "");
        return HAR.GetValueOrDefault(label) ?? "";
    }

    private static readonly JsRe WORD = JsRegex.Compile("[؀-ۿݐ-ݿ‌‍]+", "gu");

    private sealed class Loaded : IRiderDiacritizer
    {
        private readonly IOrtLike _ort;
        private readonly IOrtSession _session;
        private readonly RiderDiacritizerMeta _meta;
        private readonly string[] _ilabels;
        private readonly int _unk;
        private readonly int _nLabels;

        internal Loaded(IOrtLike ort, IOrtSession session, RiderDiacritizerMeta meta)
        {
            _ort = ort;
            _session = session;
            _meta = meta;
            var ilabels = new string[meta.Labels.Count == 0 ? 0 : meta.Labels.Values.Max() + 1];
            foreach (var (lab, idx) in meta.Labels) ilabels[idx] = lab;
            _ilabels = ilabels;
            _unk = meta.Chars.GetValueOrDefault("<unk>", 1);
            _nLabels = ilabels.Length;
        }

        /**
         * One skeleton → predicted harakat labels (per base char; the prepended lang-token position is
         * dropped).
         */
        private async Task<List<string>> Predict(int langTokIdx, IReadOnlyList<int> chars)
        {
            var seq = new List<long> { langTokIdx };
            seq.AddRange(chars.Select(c => (long)c));
            var input = _ort.Tensor("int64", seq.ToArray(), new[] { 1, seq.Count });
            var outp = await _session.Run(new Dictionary<string, OrtTensor> { ["input"] = input }).ConfigureAwait(false);
            var logitsTensor = outp.GetValueOrDefault("logits") ?? outp.Values.FirstOrDefault();
            if (logitsTensor is null) throw new InvalidOperationException("rider diacritizer ONNX produced no output");
            var logits = logitsTensor.AsFloat32();
            var labels = new List<string>();
            for (var p = 1; p < seq.Count; p++) // p=0 is the lang token → skipped
            {
                var best = 0;
                var bestv = float.NegativeInfinity;
                var @base = p * _nLabels;
                for (var o = 0; o < _nLabels; o++)
                {
                    var v = logits[@base + o];
                    if (v > bestv) { bestv = v; best = o; }
                }
                labels.Add(_ilabels[best]);
            }
            return labels;
        }

        public async Task<string> Diacritize(string text, string lang, IReadOnlyDictionary<string, string> lexicon)
        {
            var langTok = _meta.LangTokens.GetValueOrDefault(lang);
            int? langTokIdx = langTok is not null && _meta.Chars.TryGetValue(langTok, out var li) ? li : null;
            if (langTokIdx is null) return text; // unknown language → no-op
            var @out = new List<string>();
            var cursor = 0;
            foreach (Match m in JsRegex.MatchAll(WORD, text))
            {
                var raw = m.Value;
                @out.Add(text[cursor..m.Index]);
                cursor = m.Index + raw.Length;
                var skel = HarakatLexicon.StripHarakat(raw).Normalize(System.Text.NormalizationForm.FormC);
                if (skel.Length == 0 || HarakatLexicon.HARAKAT.IsMatch(raw) || lexicon.ContainsKey(skel))
                {
                    @out.Add(raw);
                    continue;
                }
                var cps = Js.CodePoints(skel);
                var labels = await Predict(langTokIdx.Value, cps.Select(c => _meta.Chars.GetValueOrDefault(c, _unk)).ToList())
                    .ConfigureAwait(false);
                @out.Add(string.Concat(cps.Select((c, k) => c + HarOf(k < labels.Count ? labels[k] : "0"))));
            }
            @out.Add(text[cursor..]);
            return string.Concat(@out);
        }
    }

    /** Load a rider diacritizer from ONNX model bytes + sidecar meta. Session created once and reused. */
    public static async Task<IRiderDiacritizer> LoadRiderDiacritizer(byte[] modelBytes, RiderDiacritizerMeta meta)
    {
        var ort = await Onnx.LoadOrt("Rider neural diacritization").ConfigureAwait(false);
        var session = await ort.CreateInferenceSession(modelBytes).ConfigureAwait(false);
        return new Loaded(ort, session, meta);
    }

    /** Load the rider diacritizer from the model + meta beside this file. ⚠ DEGRADES TO NULL on ANY
     *  unavailability — a missing model or meta, or a failed ONNX runtime load — rather than throwing;
     *  callers fall back to the lexicon+default path. */
    public static async Task<IRiderDiacritizer?> CreateRiderDiacritizer()
    {
        byte[] bytes;
        RiderDiacritizerMeta meta;
        try
        {
            bytes = File.ReadAllBytes(DataPath.ResolveAllowMissing("core/riderDiacritizer.onnx"));
            meta = JsonSerializer.Deserialize<RiderDiacritizerMeta>(
                File.ReadAllText(DataPath.ResolveAllowMissing("core/riderDiacritizer.meta.json")), Jsonc.JsonOpts)!;
        }
        catch { return null; } // model or sidecar meta absent/corrupt
        try
        {
            return await LoadRiderDiacritizer(bytes, meta).ConfigureAwait(false);
        }
        catch { return null; } // onnxruntime-node absent or the session failed to build → sync fallback
    }
}
