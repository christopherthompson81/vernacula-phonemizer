/**
 * Persian STRUCTURAL TAGGER — the DEFAULT modern fa restorer. A sentence-level BiLSTM sequence-labeller that
 * emits one IPA-chunk TAG per abjad char and assembles the tags into words on the spaces; output length
 * equals input length, so it cannot degenerate or break the consonant skeleton.
 * Ported from src/languages/persian/faTagger.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Persian;

public static class FaTagger
{
    private static readonly IReadOnlySet<string> SHORT_V = new HashSet<string>(new[] { "a", "e", "o" }, StringComparer.Ordinal);

    /**
     * Post-tagger FIRST-VOWEL correction — targets the tagger's /a/-prior default on the lexically-fixed
     * first syllable. Two parts: word-initial آ is always ʔ + long aː (promote a short vowel, or insert aː
     * when the tagger dropped it), and a pin transplant that replaces the first short vowel with the value
     * pinned for that skeleton. Only the first vowel is touched; consonants, later vowels and ezafe are the
     * tagger's.
     */
    private static string CorrectFirstVowel(string word, string ipa, IReadOnlyDictionary<string, string> pin)
    {
        var cp = Js.CodePoints(ipa);
        string At(int k) => k >= 0 && k < cp.Count ? cp[k] : "";
        if (word.StartsWith("آ", StringComparison.Ordinal) && At(0) == "ʔ") // deterministic: آ = ʔ + long aː
        {
            if (At(1) == "a" && At(2) == "ː") return ipa;                                       // already ʔaː → correct
            if (At(1) != "" && SHORT_V.Contains(At(1))) return "ʔaː" + string.Concat(cp.Skip(2)); // ʔa/ʔe/ʔo → ʔaː
            if (At(1) == "i" || At(1) == "u") return ipa;                                        // ʔiː/ʔuː — not our target, leave
            return "ʔaː" + string.Concat(cp.Skip(1));                                            // consonant/dropped vowel → insert aː
        }
        if (word.StartsWith("آ", StringComparison.Ordinal)) return ipa;
        if (pin.TryGetValue(word, out var v) && v.Length > 0)
        {
            for (var i = 0; i < cp.Count; i++)
                if (SHORT_V.Contains(cp[i]) && At(i + 1) != "ː")
                    return string.Concat(cp.Take(i)) + v + string.Concat(cp.Skip(i + 1));
        }
        return ipa;
    }

    private sealed class Loaded : IFaContextRestorer
    {
        private readonly IOrtLike _ort;
        private readonly IOrtSession _sess;
        private readonly TaggerMeta _meta;
        private readonly IReadOnlyDictionary<string, string> _pin;
        private readonly int _unk;
        private readonly int _nTags;

        internal Loaded(IOrtLike ort, IOrtSession sess, TaggerMeta meta, IReadOnlyDictionary<string, string> pin)
        {
            _ort = ort;
            _sess = sess;
            _meta = meta;
            _pin = pin;
            _unk = meta.Src.GetValueOrDefault("<unk>", 1);
            _nTags = meta.Tags.Count;
        }

        public async Task<string> Restore(string sentence)
        {
            var chars = Js.CodePoints(sentence);
            var T = chars.Count;
            if (T == 0) return "";
            var ids = chars.Select(c => (long)_meta.Src.GetValueOrDefault(c, _unk)).ToArray();
            var r = await _sess.Run(new Dictionary<string, OrtTensor>
            {
                ["chars"] = _ort.Tensor("int64", ids, new[] { 1, T }),
            }).ConfigureAwait(false);
            var logits = (r.GetValueOrDefault("logits") ?? throw new InvalidOperationException("tagger produced no logits")).AsFloat32(); // flat [T * nTags], row-major (t·nTags + tag)
            var words = new List<string> { "" };
            for (var k = 0; k < T; k++)
            {
                if (chars[k] == " ") { words.Add(""); continue; } // word boundary → new word, no tag emitted
                var id = _meta.Src.GetValueOrDefault(chars[k], _unk);
                var best = StructuralTagger.MaskedArgmax(logits, k * _nTags,
                    _meta.CharTags.TryGetValue(id.ToString(System.Globalization.CultureInfo.InvariantCulture), out var valid) ? valid : null);
                var tag = best < 0 ? "" : _meta.Tags.GetValueOrDefault(best.ToString(System.Globalization.CultureInfo.InvariantCulture)) ?? "";
                if (tag != " ") words[^1] += tag;
            }
            var gWords = sentence.Split(' ');
            var fixedWords = words.Select((w, i) => CorrectFirstVowel(i < gWords.Length ? gWords[i] : "", w, _pin));
            return ContextRestorer.StressPerWord(string.Join(" ", fixedWords));
        }
    }

    /** Build the structural tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
    public static async Task<IFaContextRestorer?> CreateFaTagger(string basename = "fa-tagger")
    {
        TaggerMeta meta;
        byte[] modelBytes;
        try
        {
            meta = System.Text.Json.JsonSerializer.Deserialize<TaggerMeta>(
                File.ReadAllText(DataPath.ResolveAllowMissing($"languages/persian/{basename}.meta.json")), Jsonc.JsonOpts)!;
            modelBytes = File.ReadAllBytes(DataPath.ResolveAllowMissing($"languages/persian/{basename}.int8.onnx"));
        }
        catch { return null; }
        var pin = new Dictionary<string, string>(StringComparer.Ordinal);
        try
        {
            foreach (var line in File.ReadAllText(DataPath.ResolveAllowMissing("languages/persian/fa-pin-vowels.tsv")).Split('\n'))
            {
                if (line.Length == 0 || line.StartsWith("#", StringComparison.Ordinal)) continue;
                var parts = line.Split('\t');
                if (parts.Length >= 2 && parts[0].Length > 0 && parts[1].Length > 0) pin[parts[0]] = parts[1];
            }
        }
        catch { /* no pin file → tagger output unchanged */ }
        try
        {
            var ort = await Onnx.LoadOrt("Persian neural tagging").ConfigureAwait(false);
            var ep = Environment.GetEnvironmentVariable("FA_ORT_EP");
            var sess = await ort.CreateInferenceSession(modelBytes, string.IsNullOrEmpty(ep) ? null : ep.Split(',')).ConfigureAwait(false);
            return new Loaded(ort, sess, meta, pin);
        }
        catch { return null; }
    }
}
