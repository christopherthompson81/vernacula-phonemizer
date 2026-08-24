/**
 * Shared core for the per-position STRUCTURAL TAGGERS: one BiLSTM forward pass emitting an IPA-chunk TAG
 * per input symbol, decoded by a CONSONANT-CONSISTENCY MASK — each symbol may only choose among the tags it
 * produced in training, so the consonant skeleton is always canonical and the model only picks the
 * vowel/stress decoration.
 * Ported from src/core/structuralTagger.ts — see that file for the corpus evidence.
 */
using System.Text.Json;

namespace Vernacula.Phonemizer.Core;

/** `src`: symbol → id (including `<pad>`=0 and `<unk>`=1). `tags`: tag-id → IPA chunk. `charTags`: symbol-id
 *  → the tag-ids that symbol may emit — the consonant mask. Emitted by the train/export tools. */
public sealed class TaggerMeta
{
    public Dictionary<string, int> Src { get; set; } = new();
    public Dictionary<string, string> Tags { get; set; } = new();
    public Dictionary<string, int[]> CharTags { get; set; } = new();
}

/** A bare word → canonical IPA, or "" to defer to the rule engine (an out-of-vocab grapheme). */
public interface IWordStructuralTagger
{
    Task<string> Tag(string word);
}

public sealed class WordTaggerOptions
{
    /**
     * the calling module's data directory, RELATIVE to the data root (C# stand-in for the TS
     * `dirname(fileURLToPath(import.meta.url))` — e.g.
     */
    public required string Dir { get; init; }

    /** meta filename stem; loads `${basename}.meta.json` */
    public required string Basename { get; init; }

    /** the ONNX filename (varies: `nb-g2p-tagger.onnx`, `bn-g2p-tagger.int8.onnx`) */
    public required string ModelFile { get; init; }

    /** loadOrt context string for the missing-dependency error (e.g. "Norwegian neural tagging") */
    public required string Context { get; init; }

    /** env var naming an ONNX execution provider (e.g. "NB_ORT_EP"); CPU default when unset */
    public required string EpEnv { get; init; }

    /**
     * normalize a word to the training vocab (e.g. NFC, or lowercase+NFC) before it is split into graphemes
     */
    public required Func<string, string> Preprocess { get; init; }

    /**
     * optional final pass over the assembled IPA (e.g. nb's single-primary-stress normalizer); identity if
     * absent
     */
    public Func<string, string>? Postprocess { get; init; }
}

public sealed class NeuralPrepassOptions
{
    /** GLOBAL word regex over the input text */
    public required JsRe Word { get; init; }

    /** canonical form the sync engine's oovOverride is keyed by (e.g. lowercase); default: identity */
    public Func<string, string>? Key { get; init; }

    /** is this word (canonical form) served authoritatively by the sync lexicon — or otherwise
     *  outside the tagger's remit? → skip the tagger */
    public required Func<string, bool> LexHas { get; init; }

    /** the tagger; "" means it declined (out-of-vocab grapheme) → leave the word to the rule engine */
    public required Func<string, Task<string>> Tag { get; init; }

    /**
     * run the sync engine over the full text with the tagger readings injected as its per-word oovOverride
     */
    public required Func<string, Func<string, string?>, string> Render { get; init; }
}

public static class StructuralTagger
{
    /**
     * Argmax over ONLY the permitted tag ids for one position (the consonant mask) — a cheap scan of ~3
     * candidates instead of all ~160 tags. `rowOffset` = position·nTags into the flat row-major logits.
     * Returns -1 when `valid` is empty or absent, which the caller reads as "decline the word".
     */
    public static int MaskedArgmax(float[] logits, int rowOffset, int[]? valid)
    {
        if (valid is null || valid.Length == 0) return -1;
        var best = valid[0];
        var bestLo = logits[rowOffset + best];
        for (var j = 1; j < valid.Length; j++)
        {
            var t = valid[j];
            var v = logits[rowOffset + t];
            if (v > bestLo)
            {
                bestLo = v;
                best = t;
            }
        }
        return best;
    }

    /** The default vowel set for `oneStress`'s no-stress fallback — the union across the fleet's tagger languages
     *  (Norwegian + Danish add ə/ɐ/ɒ). Only consulted when a reading carries NEITHER a primary nor a
     * secondary mark. */
    private static readonly JsRe DEFAULT_STRESS_VOWEL = JsRegex.Compile("[ɑaeɛiɪoɔuʉʊyʏøœæəɐɒ]", "u");

    private static readonly JsRe StressRun = JsRegex.Compile("[ˈˌ]{2,}", "gu");
    private static readonly JsRe PrimaryStress = JsRegex.Compile("ˈ", "gu");

    /** Enforce EXACTLY ONE primary stress on a per-letter-tag concatenation. The tag alphabet embeds ˈ/ˌ but
     *  the per-position argmax has no global stress constraint, so a raw reading can carry doubled, zero or
     *  two primary marks, and the lexicon and rule tiers both guarantee a single ˈ. Keep the FIRST primary;
     *  if none survives, promote the first secondary; else place ˈ before the first vowel's onset. */
    public static string OneStress(string ipa, JsRe? vowel = null)
    {
        vowel ??= DEFAULT_STRESS_VOWEL;
        ipa = StressRun.Replace(ipa, m => m.Value.Contains('ˈ') ? "ˈ" : "ˌ");
        var seen = false;
        ipa = PrimaryStress.Replace(ipa, _ =>
        {
            if (seen) return "";
            seen = true;
            return "ˈ";
        }); // keep the first ˈ, drop the rest
        if (seen) return ipa;
        if (ipa.Contains('ˌ')) return Js.ReplaceFirst(ipa, "ˌ", "ˈ"); // no primary → promote the first secondary
        var m2 = vowel.Match(ipa); // still none → ˈ before the first vowel's onset (matches the rule engines)
        if (!m2.Success) return ipa;
        var onset = m2.Index;
        while (onset > 0 && !vowel.IsMatch(ipa[onset - 1].ToString())) onset--;
        return ipa[..onset] + "ˈ" + ipa[onset..];
    }

    /**
     * Build a word-level structural tagger from an ONNX model + its `TaggerMeta`, or `undefined` if the model
     * / onnxruntime-node is unavailable (callers fall back to their sync path; no throw).
     */
    public static async Task<IWordStructuralTagger?> CreateWordStructuralTagger(WordTaggerOptions opts)
    {
        TaggerMeta meta;
        byte[] modelBytes;
        try
        {
            meta = JsonSerializer.Deserialize<TaggerMeta>(
                       File.ReadAllText(DataPath.ResolveAllowMissing($"{opts.Dir}/{opts.Basename}.meta.json")),
                       Jsonc.JsonOpts)
                   ?? throw new JsonException("null meta");
            modelBytes = File.ReadAllBytes(DataPath.ResolveAllowMissing($"{opts.Dir}/{opts.ModelFile}"));
        }
        catch
        {
            return null;
        }
        IOrtLike ortLib;
        IOrtSession sess;
        try
        {
            ortLib = await Onnx.LoadOrt(opts.Context).ConfigureAwait(false);
            var ep = Environment.GetEnvironmentVariable(opts.EpEnv);
            sess = await ortLib.CreateInferenceSession(modelBytes, ep?.Split(',')).ConfigureAwait(false);
        }
        catch
        {
            return null;
        }
        var nTags = meta.Tags.Count;
        var post = opts.Postprocess ?? (s => s);
        return new WordStructuralTaggerImpl(meta, ortLib, sess, nTags, opts.Preprocess, post);
    }

    private sealed class WordStructuralTaggerImpl : IWordStructuralTagger
    {
        private readonly TaggerMeta _meta;
        private readonly IOrtLike _ortLib;
        private readonly IOrtSession _sess;
        private readonly int _nTags;
        private readonly Func<string, string> _preprocess;
        private readonly Func<string, string> _post;

        internal WordStructuralTaggerImpl(TaggerMeta meta, IOrtLike ortLib, IOrtSession sess, int nTags,
            Func<string, string> preprocess, Func<string, string> post)
        {
            _meta = meta;
            _ortLib = ortLib;
            _sess = sess;
            _nTags = nTags;
            _preprocess = preprocess;
            _post = post;
        }

        public async Task<string> Tag(string word)
        {
            var chars = Js.CodePoints(_preprocess(word));
            var T = chars.Count;
            if (T == 0) return "";
            var ids = new long[T];
            for (var i = 0; i < T; i++)
            {
                // ⚠ DECLINE ("" = defer to the rule engine) on any grapheme outside the training vocab: its
                // symbol is not in the mask, so tagging it would emit an arbitrary tag over a correct rule
                // reading.
                if (!_meta.Src.TryGetValue(chars[i], out var id)) return "";
                ids[i] = id;
            }
            var r = await _sess.Run(new Dictionary<string, OrtTensor>
            {
                ["chars"] = _ortLib.Tensor("int64", ids, new[] { 1, T }),
            }).ConfigureAwait(false);
            var logits = r["logits"].AsFloat32(); // flat [T * nTags], row-major (t·nTags + tag)
            var outp = "";
            for (var k = 0; k < T; k++)
            {
                var best = MaskedArgmax(logits, k * _nTags,
                    _meta.CharTags.TryGetValue(ids[k].ToString(), out var valid) ? valid : null);
                if (best < 0) return ""; // no permitted tag → decline the whole word
                outp += _meta.Tags.TryGetValue(best.ToString(), out var chunk) ? chunk : "";
            }
            return _post(outp);
        }
    }

    /**
     * The shared async neural serving pre-pass (bn, nb): tag each DISTINCT out-of-lexicon word ONCE, then
     * run the ordinary sync engine with those readings injected behind its own lexicon lookup.
     */
    public static async Task<string> WordLevelNeuralPrepass(string text, NeuralPrepassOptions opts)
    {
        var key = opts.Key ?? (w => w);
        // ⚠ Insertion-ordered like the JS Map (no deletions here, so a Dictionary preserves it).
        var tagged = new Dictionary<string, string>();
        foreach (System.Text.RegularExpressions.Match m in JsRegex.MatchAll(opts.Word, text))
        {
            var w = key(m.Value);
            if (tagged.ContainsKey(w) || opts.LexHas(w)) continue;
            var outp = await opts.Tag(w).ConfigureAwait(false);
            if (!string.IsNullOrEmpty(outp)) tagged[w] = outp; // "" = declined → leave to the rule engine
        }
        return opts.Render(text, w => tagged.TryGetValue(w, out var v) ? v : null);
    }
}
