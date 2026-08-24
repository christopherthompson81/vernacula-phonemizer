/**
 * Persian STRUCTURAL TAGGER — the DEFAULT modern fa restorer. A sentence-level BiLSTM sequence-labeller that emits
 * one IPA-chunk TAG per abjad char (the char's consonant, COPIED, plus its following short vowel / ezafe), then
 * assembles the tags into words on the space chars. Because output length == input length, it CANNOT degenerate and
 * CANNOT break the consonant skeleton — a single forward pass, no beam, no autoregressive decode loop, no
 * degeneration guard. Context (ezafe / homographs) comes from the bidirectional pass.
 *
 * It REPLACES the modern seq2seq context restorer. On the CANONICAL held-out (the fair gold — colloquial
 * fusions/elisions no canonical phonemizer would produce are excluded) it measures 93.6% per-word vs the seq2seq's
 * 92.5% on that same subset, with 0% catastrophic degeneration (the seq2seq's ~1.4% runaway-loop risk) at ~3MB vs
 * ~5MB. A per-char CONSONANT-CONSISTENCY MASK constrains each char to only the tags whose consonant it produced in
 * training (ص→s, never ʃ; غ→ɣ, never the colloquial ɡ), so the output is always canonical. See
 * fa-tagger.PROVENANCE.md and.
 *
 * `onnxruntime-node` is optional (lazy import); createFaTagger() resolves to `undefined` (no-op) if it or the model
 * is absent — identical to the seq2seq restorer's contract, so callers fall back to the word-level path.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Persian;

public static class FaTagger
{
    private static readonly IReadOnlySet<string> SHORT_V = new HashSet<string>(new[] { "a", "e", "o" }, StringComparer.Ordinal);

    /**
     * Post-tagger FIRST-VOWEL correction — targets the tagger's /a/-prior default on the lexically-fixed first syllable
     * (the correct vowel is in the clean training data, but the lightweight BiLSTM can't memorise every lexical
     * exception, so it falls back to the majority /a/). Two parts: (1) a DETERMINISTIC rule — word-initial آ (alef madda)
     * is always ʔ + long aː, so after the leading ʔ we force a long aː: promote a short vowel (آزاد ʔazaːd→ʔaːzaːd) OR
     * INSERT aː when the tagger dropped the vowel entirely (آنان ʔnaːn→ʔaːnaːn); (2) a PIN transplant — replace the first
     * short vowel with the value pinned for frequent, consistent (non-homograph) words. Only the first vowel is touched;
     * consonants, later vowels, and ezafe are left to the tagger. Validated fix-only (0 breaks) on the GE2PE +
     * cross-source referees; no HomoRich-canonical regression.
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
                // Masked argmax over ONLY this char's permitted tags (the consonant mask): keeps every consonant
                // canonical, a cheap scan of ~8 candidates. UNK permits all tags, so `best` is never -1 here.
                var best = StructuralTagger.MaskedArgmax(logits, k * _nTags,
                    _meta.CharTags.TryGetValue(id.ToString(System.Globalization.CultureInfo.InvariantCulture), out var valid) ? valid : null);
                var tag = best < 0 ? "" : _meta.Tags.GetValueOrDefault(best.ToString(System.Globalization.CultureInfo.InvariantCulture)) ?? "";
                if (tag != " ") words[^1] += tag;
            }
            // Correct the lexically-fixed first vowel (آ→aː rule + pin transplant) before stress; grapheme words
            // align 1:1 with the tagged output words (both split on the input spaces).
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
        // First-syllable-vowel pin (fa-pin-vowels.tsv, skeleton→first short vowel). Optional — empty if absent.
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
            // Shipping default is CPU. Opt into a GPU execution provider (fast eval iteration) with FA_ORT_EP=cuda.
            var ep = Environment.GetEnvironmentVariable("FA_ORT_EP");
            var sess = await ort.CreateInferenceSession(modelBytes, string.IsNullOrEmpty(ep) ? null : ep.Split(',')).ConfigureAwait(false);
            return new Loaded(ort, sess, meta, pin);
        }
        catch { return null; }
    }
}
