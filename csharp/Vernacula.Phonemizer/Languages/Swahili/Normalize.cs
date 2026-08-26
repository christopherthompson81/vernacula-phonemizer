/**
 * Swahili / Kiswahili (sw) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/swahili/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Swahili;

public static class Normalize
{
    private static readonly JsRe RANGE = JsRegex.Compile("(?<![\\d.,\\p{L}])(\\d+)\\s?[-–]\\s?(\\d+)(?![\\d.,\\p{L}])", "gu");

    /** Expand an abbreviation whose OWN trailing dot is ambiguous with the sentence period. */
    private static string ExpandDotted(string s, string body, string word)
    {
        var atEnd = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){body}\\.(?=[ \u00a0]*(?:$|\\p{{Lu}}))", "gu");
        var inline = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){body}\\.", "gu");
        return JsRegex.Replace(JsRegex.Replace(s, atEnd, _ => $"{word}."), inline, _ => word);
    }

    /** Era markers. */
    private static string BCE_WORD => SwahiliPhonemizer.DEF.EraWords.Bce;
    private static string AD_WORD => SwahiliPhonemizer.DEF.EraWords.Ad;
    private static readonly (JsRe Re, string Word)[] BARE_ERA =
    {
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])BCE(?![\\p{L}\\p{M}])", "gu"), BCE_WORD),
        (JsRegex.Compile("(?<=\\d[ \u00a0])BC(?![\\p{L}\\p{M}])", "gu"), BCE_WORD),
    };

    /** Dotted abbreviations, as `[body-without-final-dot, words]`. */
    private static readonly (string Body, string Word)[] DOTTED =
    {
        ("B\\.C\\.E", BCE_WORD), ("A\\.D", AD_WORD), ("B\\.C", BCE_WORD), ("n\\.k", "na kadhalika"),
    };

    /* Currency moved to the SHARED tier (currencyPrefix in swahili.ts) — see the note there. */

    private static readonly JsRe NON_ASCII = JsRegex.Compile("[^\\p{ASCII}]", "u");
    private static readonly JsRe LATIN_CHAR = JsRegex.Compile("\\p{Script=Latin}", "gu");
    private static readonly JsRe NONSPACING = JsRegex.Compile("\\p{Mn}+", "gu");

    /** Fold Latin diacritics to their base letter. */
    private static string FoldLatinDiacritics(string s)
    {
        if (!NON_ASCII.IsMatch(s)) return s;
        return JsRegex.Replace(s, LATIN_CHAR, m =>
        {
            var basec = JsRegex.Replace(m.Value.Normalize(System.Text.NormalizationForm.FormD), NONSPACING, _ => "");
            return basec == "" ? m.Value : basec;
        });
    }

    // The step patterns. The TS builds several inline; JsRegex.Compile caches, so hoisting is a
    // readability choice and not a behaviour one.
    private static readonly JsRe ORDINAL_INDICATOR = JsRegex.Compile("º", "gu");
    private static readonly JsRe DEGROUP = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(,\\d{3})+(?![\\d]|,\\d)", "gu");
    private static readonly JsRe COMMA_G = JsRegex.Compile(",", "gu");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\p{Nd}])[-−–](?=\\d)", "gu");
    private static readonly JsRe DIGIT_AT_END = JsRegex.Compile("\\d\\s*$", "u");
    private static readonly JsRe PLUS_AFTER = JsRegex.Compile("(\\S)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_START = JsRegex.Compile("(^|\\s)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d[\\d.,]*)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("([+-]?)(\\d[\\d.,]*)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("([+-]?)(\\d[\\d.,]*)\\s?°", "gu");
    private static readonly JsRe DECIMAL_RE = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)(?![\\d\\p{L}])", "gu");
    private static readonly JsRe SPACED_DASH = JsRegex.Compile("(?<![\\d])\\s+[-–—]+\\s+(?![\\d])", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");

    /** Every rule here emits DIGITS wherever a number is involved and lets the engine's own number path speak
     *  them, so this layer carries no number words of its own. */
    public static string NormalizeSwahili(string input)
    {
        var s = input;

        s = FoldLatinDiacritics(s);

        s = JsRegex.Replace(s, ORDINAL_INDICATOR, _ => "°");

        s = JsRegex.Replace(s, DEGROUP, m => JsRegex.Replace(m.Value, COMMA_G, _ => ""));

        s = JsRegex.Replace(s, PLUSMINUS, _ => " plas hasi ");
        var whole5 = s;
        s = JsRegex.Replace(s, MINUS, m => DIGIT_AT_END.IsMatch(whole5[..m.Index]) ? m.Value : "hasi ");
        s = JsRegex.Replace(s, PLUS_AFTER, m => $"{m.Groups[1].Value} plas ");
        s = JsRegex.Replace(s, PLUS_START, m => $"{m.Groups[1].Value}plas ");
        s = JsRegex.Replace(s, DEG_C, m => $"nyuzi joto {m.Groups[1].Value} Selsiasi");
        s = JsRegex.Replace(s, DEG_F, m => $"nyuzi joto {m.Groups[2].Value} Fahrenheit");
        s = JsRegex.Replace(s, DEG_BARE, m => $"nyuzi joto {m.Groups[2].Value}");

        s = JsRegex.Replace(s, RANGE, m =>
            Js.Number(m.Groups[1].Value) < Js.Number(m.Groups[2].Value)
                ? $"{m.Groups[1].Value} hadi {m.Groups[2].Value}"
                : m.Value);

        s = JsRegex.Replace(s, DECIMAL_RE, m =>
            $"{m.Groups[1].Value} nukta {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // ⚠ DOTTED before BARE, and multi-dot before single-dot: `B.C.E.` must be claimed before `BC`
        //   can bite into it.
        foreach (var (body, word) in DOTTED) s = ExpandDotted(s, body, word);
        foreach (var (re, word) in BARE_ERA) s = JsRegex.Replace(s, re, _ => word);

        s = JsRegex.Replace(s, SPACED_DASH, _ => ", ");

        s = JsRegex.Replace(s, EQUALS, _ => " sawa na ");
        s = JsRegex.Replace(s, LESS_THAN, _ => " chini ya ");
        s = JsRegex.Replace(s, GREATER_THAN, _ => " zaidi ya ");
        s = JsRegex.Replace(s, DIVIDE, _ => " kugawanya kwa ");

        return s;
    }
}
