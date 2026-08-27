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

    /** Phonemize English text with the neural tagger filling the OOV tail. */
    public static async Task<string> PhonemizeEnNeural(string text)
    {
        var tagger = await Tagger().ConfigureAwait(false);
        var E = EnEngine();
        if (tagger is null) return Foreign.WithHost("en", () => E.Text(text)); // no model → sync path

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
        return Foreign.WithHost("en", () => E.Text(text, null, g2pKey => tagged.TryGetValue(g2pKey, out var v) ? v : null));
    }
}
