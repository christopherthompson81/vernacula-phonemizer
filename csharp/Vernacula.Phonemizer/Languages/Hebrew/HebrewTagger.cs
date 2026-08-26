/**
 * Hebrew PHASE-2 restorer — the neural NAKDAN: a sentence-level per-consonant BiLSTM (ONNX) that restores the
 * niqqud of a bare consonantal clause, which the rule g2p then converts to IPA. Output length == input
 * length; a per-consonant mask constrains each letter to the niqqud it took in training.
 * Ported from src/languages/hebrew/hebrewTagger.ts — see that file for the architecture and provenance.
 */
using System.Text;
using System.Text.Json;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hebrew;

public interface IHebrewTagger
{
    /** Restore + phonemize a CLAUSE of bare Hebrew words (space-separated) → Modern Israeli IPA. "" if declined. */
    Task<string> Restore(string clause);

    /** Whether every character of `word` is in the model's charset — answered WITHOUT a model call, which is
     *  what lets the caller split a clause at the words the tagger cannot read. */
    bool CanRead(string word);
}

public static class HebrewTagger
{
    private const string BARE = "∅"; // the tag for a consonant with no niqqud
    private const string SPACE = " "; // the tag for a space char (word boundary)
    private static readonly JsRe NIQQUD = JsRegex.Compile("[֑-ׇ]", "gu");

    private sealed class Loaded : IHebrewTagger
    {
        private readonly IOrtLike _ort;
        private readonly IOrtSession _sess;
        private readonly TaggerMeta _meta;
        private readonly int _nTags;

        internal Loaded(IOrtLike ort, IOrtSession sess, TaggerMeta meta)
        {
            _ort = ort;
            _sess = sess;
            _meta = meta;
            _nTags = meta.Tags.Count;
        }

        public bool CanRead(string word) =>
            Js.CodePoints(word.Normalize(NormalizationForm.FormC)).All(c => _meta.Src.ContainsKey(c));

        public async Task<string> Restore(string clause)
        {
            var chars = Js.CodePoints(clause.Normalize(NormalizationForm.FormC));
            var T = chars.Count;
            if (T == 0) return "";
            // Every char must be a known symbol (letters + space); a stray/foreign char → decline (defer to sync).
            var ids = new long[T];
            for (var i = 0; i < T; i++)
            {
                if (!_meta.Src.TryGetValue(chars[i], out var id)) return "";
                ids[i] = id;
            }
            var r = await _sess.Run(new Dictionary<string, OrtTensor>
            {
                ["chars"] = _ort.Tensor("int64", ids, new[] { 1, T }),
            }).ConfigureAwait(false);
            var logits = r["logits"].AsFloat32(); // flat [T * nTags], row-major (t·nTags + tag)
            var words = new List<string> { "" };
            for (var k = 0; k < T; k++)
            {
                if (chars[k] == " ") { words.Add(""); continue; } // word boundary
                var best = StructuralTagger.MaskedArgmax(logits, k * _nTags,
                    _meta.CharTags.TryGetValue(ids[k].ToString(System.Globalization.CultureInfo.InvariantCulture), out var valid) ? valid : null);
                var tag = best < 0
                    ? BARE
                    : _meta.Tags.TryGetValue(best.ToString(System.Globalization.CultureInfo.InvariantCulture), out var t) ? t : BARE;
                if (tag == SPACE) { words.Add(""); continue; }
                words[^1] += chars[k] + (tag == BARE ? "" : tag); // consonant + restored niqqud
            }
            // A known non-homograph skeleton takes its lexicon reading (in our convention); else the tagger's g2p.
            return string.Join(" ", words.Where(w => w.Length > 0).Select(w =>
                Lexicon.LexiconLookup(JsRegex.Replace(w, NIQQUD, _ => "")) ?? HebrewPhonemizer.PhonemizeWord(w)));
        }
    }

    /** Build the Hebrew nakdan tagger, or null if the model / the ONNX runtime is unavailable. */
    public static async Task<IHebrewTagger?> CreateHebrewTagger(string basename = "he-tagger")
    {
        TaggerMeta meta;
        byte[] modelBytes;
        try
        {
            meta = JsonSerializer.Deserialize<TaggerMeta>(
                       File.ReadAllText(DataPath.ResolveAllowMissing($"languages/hebrew/{basename}.meta.json")),
                       Jsonc.JsonOpts)
                   ?? throw new JsonException("null meta");
            modelBytes = File.ReadAllBytes(DataPath.ResolveAllowMissing($"languages/hebrew/{basename}.int8.onnx"));
        }
        catch { return null; }
        try
        {
            var ort = await Onnx.LoadOrt("Hebrew neural restoration").ConfigureAwait(false);
            var ep = Environment.GetEnvironmentVariable("HE_ORT_EP");
            var sess = await ort.CreateInferenceSession(modelBytes, string.IsNullOrEmpty(ep) ? null : ep.Split(',')).ConfigureAwait(false);
            return new Loaded(ort, sess, meta);
        }
        catch { return null; }
    }
}
