/**
 * Async neural entry for English (en).
 * Ported from src/languages/english/englishNeural.ts — see that file for the corpus evidence.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

public static class EnglishNeural
{
    private static readonly JsRe WORD = JsRegex.Compile("[A-Za-z][A-Za-z']*", "gu");

    /** An ORDINAL SUFFIX glued to a digit — `23rd`. Scanning the NORMALIZED text surfaces fragments the raw
     *  text never had, and an ONNX call is the most expensive thing in that loop.
     *  ⚠ A BLANKET "not adjacent to a digit" was REFUSED BY THE GOLDENS: it excluded pinyin with a tone
     *  number (`zhong1`), unit abbreviations (`600Mbit`) and identifiers (`35px`), where the letters are a
     *  real word the tagger reads and the n-gram does not. Six rows, five languages. See the TS twin. */
    private static readonly JsRe DIGIT_ORDINAL = JsRegex.Compile("^[0-9](?:st|nd|rd|th)$", "iu");
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
        var lower = Js.ToLowerCase(word);
        var lookup = lower;
        if (lower.EndsWith("'s", StringComparison.Ordinal) && lower.Length > 2) lookup = lower[..^2];
        else if (lower.EndsWith("'", StringComparison.Ordinal) && lower.Length > 2 && lower[^2] == 's') lookup = lower[..^1];
        return APOSTROPHES.Replace(lookup, "");
    }

    /**
     * Tag the OOV words of `text` and record them for the FOREIGN reader (core/foreign.ts), for a host
     * language that is about to delegate an embedded Latin run to English.
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
            if (Foreign.LookupForeignOov(key) is not null) continue;
            var ipa = await tagger.Tag(key).ConfigureAwait(false);
            if (ipa.Length > 0) Foreign.AddForeignOov(key, ipa);
        }
    }

    /** Phonemize English text with the neural tagger filling the OOV tail.
     *  An ACCENT VARIANT rides on `host` + `wordTransform` (#1260): the same per-word delta `CreateEnglishGB` /
     *  `CreateEnglishIN` hand to `Text()`. Without this the variants composed on the sync engine only, so their
     *  async reading was the n-gram's — `Croydon` → *kɹˈɒɔᶦdɒn* — while `en` had the tagger's. */
    public static async Task<string> PhonemizeEnNeural(string text, string host = "en", Func<string, string, string>? wordTransform = null)
    {
        var tagger = await Tagger().ConfigureAwait(false);
        var E = EnEngine();
        if (tagger is null) return Foreign.WithHost(host, () => E.Text(text, wordTransform, null)); // no model → sync path

        var tagged = new Dictionary<string, string>(StringComparer.Ordinal);
        // ⚠ THE NORMALIZED TEXT, NOT THE CALLER'S (#1452). This scanned the RAW input, so a word the
        // NORMALIZER creates was never in it, never tagged, and fell silently to the weaker n-gram path.
        // ⚠ NORMALIZED ONCE AND HANDED ON — two passes cost +62% here and the second would POISON the
        // trace. See the TS twin.
        var normalized = E.NormalizedFor(text);
        foreach (Match m in WORD.Matches(normalized))
        {
            var w = m.Value;
            // ⚠ An ordinal suffix glued to a digit is a FRAGMENT, not a word — see DIGIT_ORDINAL.
            if (m.Index > 0 && DIGIT_ORDINAL.IsMatch(normalized.Substring(m.Index - 1, w.Length + 1))) continue;
            if (E.HasWord(w)) continue; // dict / heteronym → sync path
            var key = G2pKeyOf(w);
            if (tagged.ContainsKey(key) || !ALPHA_KEY.IsMatch(key)) continue;
            var ipa = await tagger.Tag(key).ConfigureAwait(false);
            if (ipa.Length > 0) tagged[key] = ipa;
        }
        return Foreign.WithHost(host, () => E.Text(normalized, wordTransform, g2pKey => tagged.TryGetValue(g2pKey, out var v) ? v : null, true));
    }
}
