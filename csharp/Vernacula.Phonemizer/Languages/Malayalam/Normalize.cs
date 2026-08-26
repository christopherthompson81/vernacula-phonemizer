/**
 * Malayalam (ml) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/malayalam/normalize.ts — see that file for the corpus evidence.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Malayalam;

public static class Normalize
{
    /** Malayalam letter+mark boundary. Never `\b`. */
    private const string NA = "(?![\\p{L}\\p{M}])";

    /** ZWJ chillu ligatures — the legacy encoding of the six chillu letters as base + virama + ZWJ. */
    private static readonly IReadOnlyDictionary<string, string> ZWJ_CHILLU = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ണ"] = "ൺ", ["ന"] = "ൻ", ["ര"] = "ർ", ["ല"] = "ൽ", ["ള"] = "ൾ", ["ക"] = "ൿ",
    };

    /** The SHARED symbol tier (percent / currency / units / exponent). Its position in the ordering matters
     *  and the ordering is this file's job, so it lives here rather than in Malayalam.cs. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "ഗുണം" },
        Ampersand = "ആൻഡ്",
        Percent = Manifest.MANIFEST.SymbolTier.Percent,
        Currency = Manifest.MANIFEST.SymbolTier.Currency,
        Units = Manifest.MANIFEST.SymbolTier.Units,
        ExponentWords = Manifest.MANIFEST.SymbolTier.ExponentWords,
        Magnitudes = Manifest.MANIFEST.SymbolTier.Magnitudes,
    });

    /** Read from the manifest — LONGEST FIRST, and the order is load-bearing (see the jsonc). */
    private static IReadOnlyList<string> ORDINAL_ENDINGS => Manifest.MANIFEST.OrdinalEndings;

    private static readonly string[] OBLIQUE_CLITICS = { "ത്തിലെ", "ത്തിൽ", "ത്തില്", "ലാണ്", "ന്റെ", "ലോ", "നും", "ലെ", "ൽ", "ന്" };
    private static readonly string[] PLURAL_CLITICS = { "കളുടെ", "കളിലെ", "കളിൽ", "കൾ" };

    // ⚠ `OrderByDescending`, NOT `List.Sort` — LINQ's ordering is STABLE like JS's `Array.prototype.sort`,
    // and `List.Sort` is not. Equal-length clitics would otherwise alternate between runs and the alternation
    // order decides which one an overlapping match claims.
    private static string LongestFirst(IReadOnlyList<string> a) => string.Join("|", a.OrderByDescending(x => x.Length));

    /** ത്തിൽ/ത്തിലെ are the ം-final oblique already spelled out; fold them onto the plain clitic. */
    private static readonly IReadOnlyDictionary<string, string> FOLD_CLITIC = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ത്തിലെ"] = "ലെ", ["ത്തിൽ"] = "ൽ", ["ത്തില്"] = "ൽ",
    };

    private static JsRe Clitic(IReadOnlyList<string> list) =>
        JsRegex.Compile($"(?<![\\d.,])(\\d+)\\s*[-–]?\\s*({LongestFirst(list)}){NA}", "gu");

    private static readonly JsRe ORDINAL_RE = Clitic(ORDINAL_ENDINGS);
    private static readonly JsRe PLURAL_RE = Clitic(PLURAL_CLITICS);
    private static readonly JsRe OBLIQUE_RE = Clitic(OBLIQUE_CLITICS);

    // ⚠ ESCAPED, NOT LITERAL. These are the legacy-chillu ZWJ and the four zero-width characters; written
    // as themselves the source reads as an empty class and the rule looks like a no-op.
    private static readonly JsRe ZWJ_CHILLU_RE = JsRegex.Compile("([ണനരലളക])്\\u200d", "gu");
    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[\\u200b\\u200c\\u200d\\ufeff]", "gu");
    private static readonly JsRe GROUPING_COMMA = JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0),(?=\\d{3}(?:,\\d|[^\\d]|$))", "gu");
    private static readonly JsRe OCLOCK = JsRegex.Compile("(?<![\\d:])([01]?\\d|2[0-3]):\\s?00(?![\\d:.])", "gu");
    private static readonly JsRe TIME_COLON = JsRegex.Compile("(?<=\\d):\\s?(?=\\d)", "gu");
    private static readonly JsRe DOUBLE_PERCENT = JsRegex.Compile("ശതമാനം(\\s+ശതമാനം)+", "gu");
    private static readonly JsRe DECIMAL_RE = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d.])", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\p{Nd}])[-−–](?=\\d)", "gu");
    private static readonly JsRe DIGIT_LEFT = JsRegex.Compile("\\d\\s*$", "u");
    private static readonly JsRe PLUS_AFTER = JsRegex.Compile("(\\S)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_INITIAL = JsRegex.Compile("(^|\\s)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe DEGREE = JsRegex.Compile("(\\d)\\s?°\\s?", "gu");

    /** A clitic rule's shared arithmetic: a safe non-zero integer, or the match is left alone. */
    private static string Welded(Match m, Func<double, string> compose)
    {
        var n = Js.Number(m.Groups[1].Value);
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n == 0) return m.Value;
        var w = compose(n);
        return w.Length == 0 ? m.Value : w;
    }

    /** The Malayalam normalizer. ⚠ A numbered, ORDER-DEPENDENT sequence; the coupling is stated at each step
     *  in src/languages/malayalam/normalize.ts. */
    public static string NormalizeMalayalam(string input)
    {
        // 1) ZERO-WIDTH characters, FIRST — every later rule asserts letter/digit adjacency.
        var s = JsRegex.Replace(input, ZWJ_CHILLU_RE, m => ZWJ_CHILLU[m.Groups[1].Value]);
        s = JsRegex.Replace(s, ZERO_WIDTH, _ => "");

        // 2) MALAYALAM DIGITS ൦-൯ → ASCII, before every numeric rule.
        s = Unicode.FoldNativeDigits(s);

        // 3) DIGIT DE-GROUPING, before anything that reads punctuation.
        s = JsRegex.Replace(s, GROUPING_COMMA, _ => "");

        // 4) NUMERIC CLITICS, after de-grouping and before the symbol tier and the time rule.
        //    (a) ORDINALS first: -ാമത്തെ must not be claimed by a shorter ending.
        s = JsRegex.Replace(s, ORDINAL_RE, m => Welded(m, n =>
        {
            var end = m.Groups[2].Value;
            // "ആം" is the standalone spelling of the ending "ാം"; "മത്തെ" of "ാമത്തെ".
            var ending = end == "ആം" ? "ാം" : end.StartsWith("ാ", StringComparison.Ordinal) ? end : "ാ" + end;
            return NumbersMl.OrdinalToWords(n, ending);
        }));
        //    (b) PLURAL clitics before oblique ones: -കളിൽ ends in the oblique -ൽ.
        s = JsRegex.Replace(s, PLURAL_RE, m =>
            Welded(m, n => NumbersMl.CliticToWords(n, m.Groups[2].Value, NumbersMl.PluralStem)));
        //    (c) OBLIQUE case clitics.
        s = JsRegex.Replace(s, OBLIQUE_RE, m => Welded(m, n =>
        {
            var c = m.Groups[2].Value;
            return NumbersMl.CliticToWords(n, FOLD_CLITIC.TryGetValue(c, out var f) ? f : c, NumbersMl.ObliqueStem);
        }));

        // 5) The SHARED symbol tier. UNITS BEFORE DECIMALS (step 8) — the tier matches a unit only when a
        //    NUMBER is adjacent.
        s = SYMBOLS(s);

        // 6) TIMES BEFORE the decimal step, so a bare-number rule cannot restart inside 2:11.60.
        s = JsRegex.Replace(s, OCLOCK, m => m.Groups[1].Value);
        s = JsRegex.Replace(s, TIME_COLON, _ => " ");

        // 7) PERCENT ALREADY SPELLED OUT — the shared tier's duplicate guard is currency-only.
        s = JsRegex.Replace(s, DOUBLE_PERCENT, _ => "ശതമാനം");

        // 8) DECIMALS, after units and times have taken their share.
        s = JsRegex.Replace(s, DECIMAL_RE, m =>
            $"{m.Groups[1].Value} {NumbersMl.DECIMAL_WORD} {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 9) SIGNS, then DEGREES last so a decimal temperature keeps its point.
        s = JsRegex.Replace(s, PLUS_MINUS, _ => " പ്ലസ് മൈനസ് ");
        // ⚠ The JS replacer's `offset`/`whole` arguments are `m.Index` and the subject: the third guard
        // rejects a SPACED range or score by looking for a digit ANYWHERE to the left.
        var subject = s;
        s = JsRegex.Replace(s, MINUS, m => DIGIT_LEFT.IsMatch(subject[..m.Index]) ? m.Value : "മൈനസ് ");
        s = JsRegex.Replace(s, PLUS_AFTER, m => m.Groups[1].Value + " പ്ലസ് ");
        s = JsRegex.Replace(s, PLUS_INITIAL, m => m.Groups[1].Value + "പ്ലസ് ");

        s = PostposedSignPass.PostposedSign(s, "<", "എക്കാൾ കുറവ്");
        s = PostposedSignPass.PostposedSign(s, ">", "എക്കാൾ കൂടുതൽ");
        s = JsRegex.Replace(s, DIVIDE, _ => " ഹരണം ");
        s = PostposedSignPass.PostposedSign(s, "=", "ന് തുല്യം");
        s = JsRegex.Replace(s, DEGREE, m => m.Groups[1].Value + " ഡിഗ്രി ");

        return s;
    }
}
