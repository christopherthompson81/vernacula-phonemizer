/**
 * English OOV G2P — the neural OOV reader. A per-grapheme BiLSTM (ONNX) that labels each
 * letter with an ARPABET-chunk TAG in a SINGLE forward pass, replacing the joint n-gram (and the net-harmful
 * compound-splitter) on the non-lexicon tail. On a clean CMUdict held-out it roughly HALVES the phone-error-rate vs
 * the n-gram pipeline (9.3% vs 18.2%; word-exact 59% vs 37%). It emits stress-bearing ARPABET, then finishes it the
 * SAME way as the n-gram path — `enforceSinglePrimary` + `collapseGeminates` + `arpabetToIpa` (shared, so a G2P word
 * has no seam with the dict) — so the tagger's only job is the letters→ARPABET map. A per-letter CONSONANT mask
 * (charTags) keeps it from emitting an impossible tag.
 *
 * `onnxruntime` is an OPTIONAL dependency loaded lazily; if it — or the model — is absent,
 * CreateEnglishTagger() resolves to `null` and the async path (EnglishNeural) falls back to the sync n-gram engine.
 */
using System.Text.Json;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

public interface IEnglishTagger
{
    /** A bare OOV word (letters) → canonical IPA, or "" to defer to the sync n-gram engine (out-of-vocab letter). */
    Task<string> Tag(string word);
}

public static class EnglishTaggerFactory
{
    /** Build the English OOV tagger, or `null` if the model / onnxruntime is unavailable. */
    public static async Task<IEnglishTagger?> CreateEnglishTagger(string basename = "en-g2p-tagger")
    {
        const string dir = "languages/english";
        TaggerMeta meta;
        byte[] modelBytes;
        try
        {
            meta = JsonSerializer.Deserialize<TaggerMeta>(
                       File.ReadAllText(DataPath.ResolveAllowMissing($"{dir}/{basename}.meta.json")), Jsonc.JsonOpts)
                   ?? throw new JsonException("null meta");
            modelBytes = File.ReadAllBytes(DataPath.ResolveAllowMissing($"{dir}/{basename}.int8.onnx")); // dynamic-int8 quantised (9.4MB fp32 → 2.4MB)
        }
        catch { return null; }
        IOrtLike ortLib;
        IOrtSession sess;
        try
        {
            ortLib = await Onnx.LoadOrt("English neural OOV G2P").ConfigureAwait(false);
            var ep = Environment.GetEnvironmentVariable("EN_ORT_EP"); // CPU default; opt into a GPU execution provider for fast eval
            sess = await ortLib.CreateInferenceSession(modelBytes, ep?.Split(',')).ConfigureAwait(false);
        }
        catch { return null; }
        var nTags = meta.Tags.Count;
        var arpabetToIpa = EnglishArpabet.MakeArpabetToIpa(Manifest.MANIFEST.Arpabet);
        var vowels = new HashSet<string>(Manifest.MANIFEST.Arpabet.Vowels, StringComparer.Ordinal); // for the shared stress/geminate finishing
        return new EnglishTaggerImpl(meta, ortLib, sess, nTags, arpabetToIpa, vowels);
    }

    private sealed class EnglishTaggerImpl : IEnglishTagger
    {
        private readonly TaggerMeta _meta;
        private readonly IOrtLike _ortLib;
        private readonly IOrtSession _sess;
        private readonly int _nTags;
        private readonly Func<IReadOnlyList<string>, string, string> _arpabetToIpa;
        private readonly IReadOnlySet<string> _vowels;

        internal EnglishTaggerImpl(TaggerMeta meta, IOrtLike ortLib, IOrtSession sess, int nTags,
            Func<IReadOnlyList<string>, string, string> arpabetToIpa, IReadOnlySet<string> vowels)
        {
            _meta = meta; _ortLib = ortLib; _sess = sess; _nTags = nTags;
            _arpabetToIpa = arpabetToIpa; _vowels = vowels;
        }

        public async Task<string> Tag(string word)
        {
            var chars = Js.CodePoints(word.ToLowerInvariant());
            var T = chars.Count;
            if (T == 0) return "";
            // DECLINE ("") on any letter outside the training vocab — its consonant isn't in the mask, so tagging it
            // would emit an arbitrary ARPABET chunk; the caller then defers the word to the sync n-gram engine.
            var ids = new long[T];
            for (var i = 0; i < T; i++)
            {
                if (!_meta.Src.TryGetValue(chars[i], out var id)) return "";
                ids[i] = id;
            }
            var r = await _sess.Run(new Dictionary<string, OrtTensor>
            {
                ["chars"] = _ortLib.Tensor("int64", ids, new[] { 1, T }),
            }).ConfigureAwait(false);
            var logits = r["logits"].AsFloat32(); // flat [T * nTags], row-major (t·nTags + tag)
            var phones = new List<string>();
            for (var k = 0; k < T; k++)
            {
                var best = StructuralTagger.MaskedArgmax(logits, k * _nTags,
                    _meta.CharTags.TryGetValue(ids[k].ToString(System.Globalization.CultureInfo.InvariantCulture), out var valid) ? valid : null);
                if (best < 0) return "";
                var chunk = _meta.Tags.TryGetValue(best.ToString(System.Globalization.CultureInfo.InvariantCulture), out var t) ? t : ""; // "K", "AE1", "HH AH0", or "" (silent)
                if (chunk.Length > 0) phones.AddRange(chunk.Split(' '));
            }
            if (phones.Count == 0) return "";
            // finish the SAME way the n-gram path does: one primary stress, collapse seam geminates, then render to IPA
            // (pass the word so the single-morpheme de-/re- reduction + barred-i rules fire, as for source "N").
            return _arpabetToIpa(
                EnglishG2pFactory.EnforceSinglePrimary(EnglishG2pFactory.CollapseGeminates(phones, _vowels), _vowels),
                word);
        }
    }
}
