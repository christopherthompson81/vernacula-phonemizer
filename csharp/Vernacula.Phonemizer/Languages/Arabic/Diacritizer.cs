/**
 * Neural Arabic diacritizer: a sentence-level BiLSTM that restores short vowels on bare Arabic
 * text, run via ONNX Runtime as an ASYNC PRE-PASS. Its vocalized output feeds the (synchronous) g2p in
 * arabic.ts — so phonemize() stays sync and dependency-free; only this pre-pass touches ONNX. `onnxruntime-
 * node` is an OPTIONAL dependency, imported lazily.
 *
 * Position-preserving: only harakat are inserted after Arabic letters; digits/punctuation/spacing are kept.
 */
using System.Text.Json;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Arabic;

public static class Diacritizer
{
    private static string SHADDA => Manifest.MANIFEST.Marks.Shadda;
    private static IReadOnlyDictionary<string, string> LABEL_VOWEL_MARK => Manifest.MANIFEST.Diacritizer.LabelMarks; // label → combining mark
    private static readonly Dictionary<string, string> MARK_TO_VOWEL =
        LABEL_VOWEL_MARK.ToDictionary(kv => kv.Value, kv => kv.Key, StringComparer.Ordinal);
    private static readonly HashSet<string> IS_MARK =
        new(MARK_TO_VOWEL.Keys.Prepend(SHADDA), StringComparer.Ordinal);

    private static bool IsArabicLetterCp(int cp) =>
        (cp >= 0x0620 && cp <= 0x064a) || (cp >= 0x0671 && cp <= 0x06d3) || cp == 0x0629 || cp == 0x0649;

    /** Strip every combining haraka → the bare consonant skeleton. */
    private static string Undiacritize(string word)
    {
        var outp = "";
        foreach (var c in Js.CodePoints(word))
            if (!IS_MARK.Contains(c))
                outp += c;
        return outp;
    }

    /** Reconstruct the combining marks for one label ("0" = bare). */
    private static string LabelToMarks(string label)
    {
        if (label == "0") return "";
        var outp = "";
        var v = label;
        if (label.StartsWith("~", StringComparison.Ordinal)) { outp += SHADDA; v = label[1..]; }
        if (v.Length > 0 && v != "0") outp += LABEL_VOWEL_MARK.GetValueOrDefault(v, "");
        return outp;
    }

    // Defective-spelling closed class (authored data in arabic.jsonc): high-frequency words whose long /aː/ is an
    // unwritten dagger-alif.
    private static readonly IReadOnlyDictionary<string, string> AR_DEFECTIVE_SPELLING =
        Manifest.MANIFEST.Diacritizer.DefectiveSpelling;

    private static readonly JsRe OTIOSE_MIA = JsRegex.Compile("مائة", "g");
    private static readonly JsRe OTIOSE_MIT = JsRegex.Compile("مائت", "g");

    /** Classical otiose-alif مائة "hundred" → modern مئة (reads /miʔa/, not /maːʔa/). */
    private static string NormalizeArabicNumberSpelling(string skeleton) =>
        OTIOSE_MIT.Replace(OTIOSE_MIA.Replace(skeleton, "مئة"), "مئت");

    private static readonly JsRe DEFECTIVE_WORD = JsRegex.Compile("[؀-ۿݐ-ݿ]+", "gu");
    private static readonly JsRe DEFECTIVE_PROCLITIC = JsRegex.Compile("^([وفبكل][ً-ْٰ]*)(.+)$", "u");

    /** Rewrite defective-spelling words to their dagger-alif form (keyed on the skeleton; strips a leading proclitic). */
    private static string ApplyDefectiveSpelling(string line)
    {
        return DEFECTIVE_WORD.Replace(line, w =>
        {
            if (AR_DEFECTIVE_SPELLING.TryGetValue(Undiacritize(w.Value), out var direct)) return direct;
            var m = DEFECTIVE_PROCLITIC.Match(w.Value);
            if (m.Success && AR_DEFECTIVE_SPELLING.TryGetValue(Undiacritize(m.Groups[2].Value), out var stem))
                return m.Groups[1].Value + stem;
            return w.Value;
        });
    }

    /** Whitespace set matching C# char.IsWhiteSpace + Python .split() (NOT JS /\s/) for cross-engine parity. */
    private static bool IsWhitespace(string c)
    {
        var cp = (int)c[0];
        return cp == 0x20 || (cp >= 0x09 && cp <= 0x0d) || cp == 0x85 || cp == 0xa0 || cp == 0x1680
            || (cp >= 0x2000 && cp <= 0x200a) || cp == 0x2028 || cp == 0x2029 || cp == 0x202f || cp == 0x205f || cp == 0x3000;
    }

    /** A pausal (phrase-final) boundary follows: end / whitespace / punctuation (not a letter or mark). */
    private static bool IsPausalBoundary(string? next)
    {
        if (next is null || IsWhitespace(next)) return true;
        var cp = Js.CodePointAt0(next);
        var isMark = (cp >= 0x064b && cp <= 0x065f) || cp == 0x0670;
        return !IsArabicLetterCp(cp) && !isMark;
    }

    /** Pausal form for TTS: drop a word-final case-ending vowel/tanwin; accusative ـًا/ـًى → /aː/.
     *  ⚠ EXPORTED for `tools/arabic/eval_ar_runtime.mts`, which must pausalize the GOLD exactly as the runtime
     *  pausalizes the model or every word-final scores wrong (it read 0% before). Reused rather than ported —
     *  a copy would drift and the measurement would silently stop meaning anything. */
    public static string Pausalize(string text)
    {
        var chars = Js.CodePoints(text);
        var outp = new List<string>();
        for (var i = 0; i < chars.Count; i++)
        {
            var cp = Js.CodePointAt0(chars[i]);
            if (cp == 0x064b)
            {
                int? nextCp = i + 1 < chars.Count ? Js.CodePointAt0(chars[i + 1]) : null;
                if ((nextCp == 0x0627 || nextCp == 0x0649) && IsPausalBoundary(i + 2 < chars.Count ? chars[i + 2] : null))
                {
                    outp.Add("َ");
                    continue;
                }
            }
            if (cp >= 0x064b && cp <= 0x0650 && IsPausalBoundary(i + 1 < chars.Count ? chars[i + 1] : null)) continue;
            outp.Add(chars[i]);
        }
        return string.Concat(outp);
    }

    public sealed class DiacritizerMeta
    {
        public Dictionary<string, int> Chars { get; init; } = new();
        public Dictionary<string, int> Labels { get; init; } = new();
    }

    public interface IArabicDiacritizer
    {
        Task<string> Diacritize(string text);
    }

    private sealed class LoadedDiacritizer : IArabicDiacritizer
    {
        private readonly IOrtLike _ort;
        private readonly IOrtSession _session;
        private readonly DiacritizerMeta _meta;
        private readonly string[] _ilabels;
        private readonly int _unk;
        private readonly int _sp;
        private readonly int _nLabels;

        public LoadedDiacritizer(IOrtLike ort, IOrtSession session, DiacritizerMeta meta)
        {
            _ort = ort;
            _session = session;
            _meta = meta;
            var ilabels = new string[meta.Labels.Count == 0 ? 0 : meta.Labels.Values.Max() + 1];
            foreach (var (lab, idx) in meta.Labels) ilabels[idx] = lab;
            _ilabels = ilabels;
            _unk = meta.Chars.GetValueOrDefault("<unk>", 1);
            _sp = meta.Chars.GetValueOrDefault("<sp>", -1);
            if (_sp < 0) throw new InvalidOperationException("diacritizer meta missing the <sp> token");
            _nLabels = ilabels.Length;
        }

        private async Task<int[]> Argmax(List<int> indices)
        {
            var input = _ort.Tensor("int64", indices.Select(i => (long)i).ToArray(), new[] { 1, indices.Count });
            var outp = await _session.Run(new Dictionary<string, OrtTensor> { ["input"] = input });
            var logitsTensor = outp.GetValueOrDefault("logits") ?? outp.Values.FirstOrDefault();
            if (logitsTensor is null) throw new InvalidOperationException("diacritizer ONNX produced no output");
            var logits = logitsTensor.AsFloat32();
            var res = new int[indices.Count];
            for (var p = 0; p < indices.Count; p++)
            {
                var best = 0;
                var bestv = float.NegativeInfinity;
                var baseIdx = p * _nLabels;
                for (var o = 0; o < _nLabels; o++)
                {
                    var v = logits[baseIdx + o];
                    if (v > bestv) { bestv = v; best = o; }
                }
                res[p] = best;
            }
            return res;
        }

        private async Task<string> DiacritizeLine(string line)
        {
            var src = Js.CodePoints(NormalizeArabicNumberSpelling(Undiacritize(line)));
            var seq = new List<int>();
            var pos = new List<int>();
            var prevWordHadLetter = false;
            var i = 0;
            while (i < src.Count)
            {
                if (IsWhitespace(src[i])) { i++; continue; }
                var j = i;
                var hasLetter = false;
                while (j < src.Count && !IsWhitespace(src[j]))
                {
                    if (IsArabicLetterCp(Js.CodePointAt0(src[j]))) hasLetter = true;
                    j++;
                }
                if (hasLetter)
                {
                    if (prevWordHadLetter) seq.Add(_sp);
                    for (var k = i; k < j; k++)
                        if (IsArabicLetterCp(Js.CodePointAt0(src[k])))
                        {
                            pos.Add(k);
                            seq.Add(_meta.Chars.GetValueOrDefault(src[k], _unk));
                        }
                    prevWordHadLetter = true;
                }
                i = j;
            }
            if (seq.Count == 0 || seq.All(x => x == _sp)) return line;
            var labelIdx = await Argmax(seq);
            var marks = new Dictionary<int, string>();
            var li = 0;
            for (var p = 0; p < seq.Count; p++)
            {
                if (seq[p] == _sp) continue;
                marks[pos[li]] = LabelToMarks(_ilabels[labelIdx[p]]);
                li++;
            }
            var rebuilt = string.Concat(src.Select((ch, k) => ch + marks.GetValueOrDefault(k, "")));
            return Pausalize(ApplyDefectiveSpelling(rebuilt));
        }

        public async Task<string> Diacritize(string text)
        {
            var lines = text.Split('\n');                      // one sentence per line = one inference context
            for (var k = 0; k < lines.Length; k++)
                if (lines[k].Trim().Length > 0)
                    lines[k] = await DiacritizeLine(lines[k]);
            return string.Join("\n", lines);
        }
    }

    /** Load a neural Arabic diacritizer from ONNX model bytes + sidecar meta. Session created once and reused. */
    public static async Task<IArabicDiacritizer> LoadArabicDiacritizer(byte[] modelBytes, DiacritizerMeta meta)
    {
        var ort = await Onnx.LoadOrt("Arabic diacritization");
        var session = await ort.CreateInferenceSession(modelBytes);
        return new LoadedDiacritizer(ort, session, meta);
    }

    /** Load the diacritizer from the model + meta beside this file (model is gitignored — dev stand-in or the
     *  built permissive model). Returns undefined if the .onnx is absent. `variety:"egyptian"` prefers the EGYPTIAN
     *  student model (diacritizer-egy.onnx, restores EGYPTIAN short vowels — مصر→maṣr not the MSA miṣr); it falls
     *  back to the MSA model (→ MSA vowels + the Cairene consonant shifts, the pre-lexicon behavior) if absent. */
    public static async Task<IArabicDiacritizer?> CreateArabicDiacritizer(string? variety = null)
    {
        var bases = variety == "egyptian" ? new[] { "diacritizer-egy", "diacritizer" } : new[] { "diacritizer" };
        foreach (var baseName in bases)
        {
            var modelPath = DataPath.ResolveAllowMissing($"languages/arabic/{baseName}.onnx");
            if (!File.Exists(modelPath)) continue;
            var bytes = File.ReadAllBytes(modelPath);
            var meta = JsonSerializer.Deserialize<DiacritizerMeta>(
                File.ReadAllText(DataPath.ResolveAllowMissing($"languages/arabic/{baseName}.meta.json")),
                Jsonc.JsonOpts)!;
            return await LoadArabicDiacritizer(bytes, meta);
        }
        return null;
    }
}
