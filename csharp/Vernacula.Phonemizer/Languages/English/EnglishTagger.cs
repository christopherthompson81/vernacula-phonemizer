/**
 * English OOV G2P — the neural OOV reader.
 * Ported from src/languages/english/englishTagger.ts — see that file for the corpus evidence.
 *
 * ⚠ FALLING BACK IS THE POLICY; BEING SILENT ABOUT IT WAS NOT. Degrading to the sync n-gram engine rather
 * than throwing is right — a missing OPTIONAL model must not take an utterance down — but the two catches
 * below were bare, so Onnx.LoadOrt built a diagnosable message and it was discarded a line later. Nothing
 * downstream could tell a neural reading from an n-gram one, and the difference is not cosmetic: on the words
 * the dictionary misses, exact agreement with misaki's lexicon is 31.0% neural against 19.9% n-gram over
 * 80,222 words, and -able/-ible alone is misread 28.9% of the time against 0.2%. A consumer measured the
 * fallback for a full sweep and concluded the engine had a rule defect; nothing could have told them
 * otherwise. The reason now lives in EnglishTaggerFactory.UnavailableReason.
 */
using System.Text.Json;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

public interface IEnglishTagger
{
    /**
     * A bare OOV word (letters) → canonical IPA, or "" to defer to the sync n-gram engine (out-of-vocab
     * letter).
     */
    Task<string> Tag(string word);
}

public static class EnglishTaggerFactory
{
    /**
     * Why the last <see cref="CreateEnglishTagger"/> call produced no tagger, or null when one was built (or
     * when none has been attempted). Set by the two catches below and cleared on success, so it describes the
     * CURRENT state rather than accumulating. EnglishNeural memoizes the tagger for the process, so after the
     * first phonemize this is stable. Mirrors taggerUnavailableReason() in englishTagger.ts.
     */
    public static string? UnavailableReason { get; private set; }

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
        catch (Exception e)
        {
            // The model files, not the runtime — the ordinary "data tree without the optional model" case.
            UnavailableReason =
                $"the English neural OOV G2P model is not readable ({dir}/{basename}.*): {e.Message}";
            return null;
        }
        IOrtLike ortLib;
        IOrtSession sess;
        try
        {
            ortLib = await Onnx.LoadOrt("English neural OOV G2P").ConfigureAwait(false);
            var ep = Environment.GetEnvironmentVariable("EN_ORT_EP"); // CPU default; opt into a GPU execution provider for fast eval
            sess = await ortLib.CreateInferenceSession(modelBytes, ep?.Split(',')).ConfigureAwait(false);
        }
        catch (Exception e)
        {
            // LoadOrt already names the runtime and why it failed; keep ITS message rather than a summary.
            UnavailableReason = e.Message;
            return null;
        }
        UnavailableReason = null;
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
            var chars = Js.CodePoints(Js.ToLowerCase(word));
            var T = chars.Count;
            if (T == 0) return "";
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
            return _arpabetToIpa(
                EnglishG2pFactory.EnforceSinglePrimary(EnglishG2pFactory.CollapseGeminates(phones, _vowels), _vowels),
                word);
        }
    }
}
