/**
 * Tagalog (tl) TEXT NORMALIZATION — the pre-tokenizer rewrites (HTML entities, digit ranges) that run
 * BEFORE the symbol tier.
 * Ported from src/languages/tagalog/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tagalog;

public static class Normalize
{
    private static readonly JsRe ENTITY = JsRegex.Compile("&(nbsp|ndash|mdash|amp|quot|lt|gt|#\\d+);", "gu");

    private static readonly IReadOnlyDictionary<string, string> ENTITY_CHAR =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["nbsp"] = " ", ["ndash"] = "–", ["mdash"] = "—", ["amp"] = "&",
        };

    private static readonly JsRe RANGE = JsRegex.Compile("(\\d)\\s*[–—]\\s*(?=\\d)|(\\d)-(?=\\d)", "gu");

    /** Tagalog text → text, before tokenization. */
    public static string NormalizeTagalog(string input)
    {
        var s = ENTITY.Replace(input, m => ENTITY_CHAR.TryGetValue(m.Groups[1].Value, out var v) ? v : " ");
        // `$1$2`: the hyphen alternative leaves group 1 unmatched, which substitutes as the empty string in
        // both engines.
        return RANGE.Replace(s, "$1$2 hanggang ");
    }
}
