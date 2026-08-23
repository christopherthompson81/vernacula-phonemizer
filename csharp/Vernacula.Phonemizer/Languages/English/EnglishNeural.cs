/**
 * Async neural entry for English (en). Runs the per-grapheme BiLSTM tagger (englishTagger.ts, ONNX) over the OOV words
 * — those the CMUdict lexicon misses — and leaves everything else (dict, heteronym POS disambiguation, numbers,
 * possessives, clause assembly) to the SYNC engine. Precedence per word: heteronym → lexicon → possessive → BiLSTM
 * tagger → n-gram engine. On a clean CMUdict held-out the tagger roughly HALVES the OOV phone-error-rate vs the n-gram
 * (7.4% vs 18.2%; 92.6% vs 81.8% phone-accuracy). Integration is a pre-pass: resolve each OOV word to IPA with the
 * tagger, then run the ordinary sync engine with those readings injected as its `oovOverride` — so ONLY OOV word
 * readings change; numbers, heteronyms, and punctuation are byte-identical to `phonemize(text, "en")`. When
 * `onnxruntime` or the model is absent the tagger is `null` and this returns exactly the sync path (no throw).
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

public static class EnglishNeural
{
    private static readonly JsRe WORD = JsRegex.Compile("[A-Za-z][A-Za-z']*", "gu");
    private static readonly JsRe ALPHA_KEY = JsRegex.Compile("^[a-z]+$", "u");
    private static readonly JsRe APOSTROPHES = JsRegex.Compile("'", "gu");

    private static Task<IEnglishTagger?>? taggerP;
    private static readonly object Gate = new();
    private static EnglishPhonemizer? engine;
    private static EnglishPhonemizer EnEngine() => engine ??= EnglishFactory.CreateEnglish();

    private static Task<IEnglishTagger?> Tagger()
    {
        lock (Gate) return taggerP ??= EnglishTaggerFactory.CreateEnglishTagger();
    }

    /** The sync resolver's OOV key: strip a trailing possessive ('s / s'), then any apostrophes — the exact `g2pKey`
     *  resolveWord() consults `oovOverride` with, so the pre-pass map lines up. */
    private static string G2pKeyOf(string word)
    {
        var lower = word.ToLowerInvariant();
        var lookup = lower;
        if (lower.EndsWith("'s", StringComparison.Ordinal) && lower.Length > 2) lookup = lower[..^2];
        else if (lower.EndsWith("'", StringComparison.Ordinal) && lower.Length > 2 && lower[^2] == 's') lookup = lower[..^1];
        return APOSTROPHES.Replace(lookup, "");
    }

    /**
     * Tag the OOV words of `text` and record them for the FOREIGN reader (core/foreign.ts), for a host language that
     * is about to delegate an embedded Latin run to English.
     *
     * This is the async half the delegation could not have on its own: `defaultForeign` is typed synchronous, so a
     * host's run reached English's n-gram OOV G2P even under `phonemizeAsync`. Called from `phonemizeAsync` BEFORE the
     * host's render, so by the time the (synchronous) reader asks, the readings are already memoized.
     *
     * The words tagged are every Latin word in the host's text, which is a SUPERSET of the words the host will
     * actually delegate — a superset only costs surplus tagger calls, and `phonemizeAsync` gates on mixed script so a
     * Latin-script host never gets here at all.
     *
     * Silent no-op without a model / `onnxruntime`: the memo stays empty and the reader falls back to the n-gram
     * engine, which is the pre-existing behaviour.
     */
    public static async Task PrewarmForeignEnglish(string text)
    {
        var tagger = await Tagger().ConfigureAwait(false);
        if (tagger is null) return;
        var E = EnEngine();
        var done = new HashSet<string>(StringComparer.Ordinal);
        foreach (Match m in WORD.Matches(text))
        {
            var w = m.Value;
            if (E.KnownWord(w) is not null) continue; // dict / heteronym → the sync path is authoritative
            var key = G2pKeyOf(w);
            if (done.Contains(key) || !ALPHA_KEY.IsMatch(key)) continue;
            done.Add(key);
            // ⚠ CONSULT THE MEMO BEFORE TAGGING. It was written here and read only by the foreign reader, so
            // every call re-ran the BiLSTM over names already resolved. The reading is context-free, so a hit
            // is always valid. Measured on a repeated arz utterance carrying a novel name: 10 ms cold, 2 ms warm.
            if (Foreign.LookupForeignOov(key) is not null) continue;
            var ipa = await tagger.Tag(key).ConfigureAwait(false);
            if (ipa.Length > 0) Foreign.AddForeignOov(key, ipa);
        }
    }

    /**
     * Phonemize English text with the neural tagger filling the OOV tail. Async because the ONNX pass is; falls back to
     * the plain sync path (CMUdict + n-gram engine) when the model / `onnxruntime` is unavailable.
     */
    public static async Task<string> PhonemizeEnNeural(string text)
    {
        var tagger = await Tagger().ConfigureAwait(false);
        var E = EnEngine();
        if (tagger is null) return Foreign.WithHost("en", () => E.Text(text)); // no model → sync path

        // PRE-PASS: tag each distinct OOV word once. Skip words the sync engine already knows (dict/heteronym) — they are
        // served authoritatively by the sync path; genuinely-OOV pure-alpha words go to the BiLSTM. An empty tag ("")
        // means the tagger DECLINED (an out-of-vocab letter) → leave it out so the sync n-gram engine handles the word.
        var tagged = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (Match m in WORD.Matches(text))
        {
            var w = m.Value;
            if (E.KnownWord(w) is not null) continue; // dict / heteronym → sync path
            var key = G2pKeyOf(w);
            if (tagged.ContainsKey(key) || !ALPHA_KEY.IsMatch(key)) continue;
            var ipa = await tagger.Tag(key).ConfigureAwait(false);
            if (ipa.Length > 0) tagged[key] = ipa;
        }
        // Run the SYNC engine with the tagger readings injected between the lexicon and the n-gram — everything else
        // (numbers, heteronym POS, possessives, punctuation) is the sync path, so only OOV word readings differ.
        // `withHost` — this engine is built here, not by the registry, so nothing else pushes the host and a
        // foreign run would be dropped for want of one (core/foreign.ts). Synchronous, as that stack requires.
        return Foreign.WithHost("en", () => E.Text(text, null, g2pKey => tagged.TryGetValue(g2pKey, out var v) ? v : null));
    }
}
