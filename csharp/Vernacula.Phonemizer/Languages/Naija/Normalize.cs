/**
 * Nigerian Pidgin (pcm) TEXT NORMALIZATION — the pre-tokenizer rewrites (title abbreviation, the glued
 * ⟨bn⟩ magnitude, the U+2212 minus).
 * Ported from src/languages/naija/normalize.ts — see that file for the corpus evidence and for why the
 * ⟨Dr⟩ alternation is case-SENSITIVE and the minus is U+2212 only.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Naija;

public static class Normalize
{
    private static readonly IReadOnlyDictionary<string, string> ABBREV =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["Dr"] = "Doctor", ["dr"] = "Doctor" };

    private static readonly JsRe ABBREV_RE =
        JsRegex.Compile($"\\b({string.Join("|", ABBREV.Keys)})\\.?(?![\\p{{L}}])", "gu");

    private static readonly JsRe MAGNITUDE_ABBREV = JsRegex.Compile(@"(?<=\d)\s?bn(?![\p{L}\p{M}\d])", "gu");

    private static readonly JsRe MINUS = JsRegex.Compile(@"(?<![\p{L}\p{M}\p{Nd}])(?<!\p{Nd}\s)−(?=\p{Nd})", "gu");

    /** Naija text → text, before tokenization. */
    public static string NormalizeNaija(string input) =>
        MINUS.Replace(
            MAGNITUDE_ABBREV.Replace(
                ABBREV_RE.Replace(input, m => ABBREV[m.Groups[1].Value]),
                " billion"),
            "minus ");
}
