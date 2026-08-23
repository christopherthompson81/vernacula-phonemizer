/**
 * Shared core for the per-position STRUCTURAL TAGGERS (bn bengaliTagger.ts, nb norwegianTagger.ts). A tagger is a
 * single BiLSTM forward pass emitting one IPA-chunk TAG per input symbol, decoded by a CONSONANT-CONSISTENCY MASK:
 * each symbol may only choose among the tags it produced in training, so the consonant skeleton is always canonical
 * and the model only picks the vowel/stress decoration. This module owns the three pieces both languages share so a
 * fix to any of them can't drift between them:
 *   1. the decode kernel — `maskedArgmax` (the mask + argmax invariant "cannot break the consonant skeleton");
 *   2. the word-level tagger — `createWordStructuralTagger` (lazy ONNX load + the per-word decode loop);
 *   3. the async serving pre-pass — `wordLevelNeuralPrepass` (tag each OOV word once, inject into the sync engine).
 * Each language still owns its language-specific bits via the options (bn: NFC preprocess; nb: lowercase+NFC preprocess
 * plus a single-primary-stress postprocess). fa's faTagger.ts and he's hebrewTagger.ts are a DIFFERENT (sentence-level,
 * UNK-permits-all) shape and intentionally do NOT use the word-level factory — but they DO still consume `maskedArgmax`
 * + `TaggerMeta` below, so a change to that decode kernel or the meta shape must keep those two compiling too.
 */
using System.Text.Json;

namespace Vernacula.Phonemizer.Core;

/** `src`: symbol → id (incl. `<pad>`=0, `<unk>`=1). `tags`: tag-id → IPA chunk. `charTags`: symbol-id → the tag-ids
 *  that symbol may emit (the consonant mask). Emitted by the train/export tools (export_tagger_onnx.py /
 *  export_bn_tagger_onnx.py / train_nb_bilstm.py). */
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
    /** the calling module's data directory, RELATIVE to the data root (C# stand-in for the TS
     *  `dirname(fileURLToPath(import.meta.url))` — e.g. "languages/norwegian"); the model + meta live there */
    public required string Dir { get; init; }

    /** meta filename stem; loads `${basename}.meta.json` */
    public required string Basename { get; init; }

    /** the ONNX filename (varies: `nb-g2p-tagger.onnx`, `bn-g2p-tagger.int8.onnx`) */
    public required string ModelFile { get; init; }

    /** loadOrt context string for the missing-dependency error (e.g. "Norwegian neural tagging") */
    public required string Context { get; init; }

    /** env var naming an ONNX execution provider (e.g. "NB_ORT_EP"); CPU default when unset */
    public required string EpEnv { get; init; }

    /** normalize a word to the training vocab (e.g. NFC, or lowercase+NFC) before it is split into graphemes */
    public required Func<string, string> Preprocess { get; init; }

    /** optional final pass over the assembled IPA (e.g. nb's single-primary-stress normalizer); identity if absent */
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

    /** run the sync engine over the full text with the tagger readings injected as its per-word oovOverride */
    public required Func<string, Func<string, string?>, string> Render { get; init; }
}

public static class StructuralTagger
{
    /**
     * Argmax over ONLY the permitted tag ids for one position (the consonant mask) — a cheap scan of ~3 candidates
     * instead of all ~160 tags. `rowOffset` = position·nTags into the flat row-major `[T·nTags]` logits. Returns the
     * best tag id, or -1 when `valid` is empty/absent (the caller decides whether that means "decline the word").
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
     *  (Norwegian + Danish add ə/ɐ/ɒ). Only consulted when a reading carries NEITHER a primary nor a secondary mark. */
    private static readonly JsRe DEFAULT_STRESS_VOWEL = JsRegex.Compile("[ɑaeɛiɪoɔuʉʊyʏøœæəɐɒ]", "u");

    private static readonly JsRe StressRun = JsRegex.Compile("[ˈˌ]{2,}", "gu");
    private static readonly JsRe PrimaryStress = JsRegex.Compile("ˈ", "gu");

    /**
     * Enforce EXACTLY ONE primary stress on a per-letter-tag concatenation. The tag alphabet embeds ˈ/ˌ but the
     * per-position argmax has no global stress constraint, so a raw reading can carry adjacent-doubled (`ˈˈ`/`ˌˌ`), zero,
     * or two primary marks. The lexicon and rule tiers both guarantee a single ˈ; this makes the tagger output
     * convention-consistent so the shipped OOV IPA never violates it. Keep the FIRST primary and drop later ones
     * (legitimate secondary ˌ are kept); if none survives, promote the first secondary, else place ˈ before the first
     * vowel's onset (the rule-engine default). `vowel` overrides the fallback vowel class for languages beyond the default.
     */
    public static string OneStress(string ipa, JsRe? vowel = null)
    {
        vowel ??= DEFAULT_STRESS_VOWEL;
        // collapse any run of adjacent stress marks to one (primary wins): ˈˈ / ˈˌ / ˌˈ → ˈ, ˌˌ → ˌ
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
     * Build a word-level structural tagger from an ONNX model + its `TaggerMeta`, or `undefined` if the model /
     * onnxruntime-node is unavailable (callers fall back to their sync path; no throw). The `tag()` loop is the single
     * shared implementation: preprocess → decline on any out-of-vocab grapheme → one forward pass → masked argmax per
     * position → optional postprocess.
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
            // Shipping default is CPU. Opt into a GPU execution provider (fast eval iteration) via the env var.
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
            // DECLINE (return "") on any grapheme outside the training vocab: its symbol is not in the mask, so tagging
            // it would emit an arbitrary tag and override the correct rule reading. "" = "defer to the rule engine".
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
            var outp = "";
            for (var k = 0; k < T; k++)
            {
                // Masked argmax over ONLY this symbol's permitted tags (the consonant mask, pad-excluded). A -1 (no
                // permitted tag) means decline the whole word → defer to rules.
                var best = MaskedArgmax(logits, k * _nTags,
                    _meta.CharTags.TryGetValue(ids[k].ToString(), out var valid) ? valid : null);
                if (best < 0) return "";
                outp += _meta.Tags.TryGetValue(best.ToString(), out var chunk) ? chunk : "";
            }
            return _post(outp);
        }
    }

    /**
     * The shared async neural serving pre-pass (bn, nb): tag each DISTINCT out-of-lexicon word ONCE, then run the ordinary
     * sync engine with those readings injected between the lexicon and the rule engine (lexicon → tagger → rules). Numbers,
     * punctuation, and clause assembly stay the sync engine's, so only OOV word readings change vs the plain sync path.
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
