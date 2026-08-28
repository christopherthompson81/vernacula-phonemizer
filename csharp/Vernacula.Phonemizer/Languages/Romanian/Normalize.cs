/**
 * Romanian (ro) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the Romanian g2p cannot
 * already read into Romanian words the existing pipeline speaks.
 * Ported from src/languages/romanian/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Romanian;

public static class Normalize
{
    /** Unit abbreviations → Romanian words. ⚠ Longest first, so `km` is not matched as `m` with a stray k
     *  left over. */
    private static readonly (JsRe Re, string Word)[] UNITS =
    {
        (JsRegex.Compile("\\bkm\\b", "giu"), "kilometri"),
        (JsRegex.Compile("\\bkg\\b", "giu"), "kilograme"),
        (JsRegex.Compile("\\bcm\\b", "giu"), "centimetri"),
        // ⚠ THE TWO LOOKBEHINDS ARE A VERSION GUARD: a one-letter unit glued to a dotted number is a
        // designation, not a quantity (`802.11g` read as "…unsprezece GRAME"), and the second one names the
        // standard because its two-letter suffixes (`802.11ah`) collide with `Ah`, ampere-hours.
        (JsRegex.Compile("(?<!\\d[.,]\\d{1,4})(?<!802[.,]11[a-z]{0,3})\\bmm\\b", "giu"), "milimetri"),
        (JsRegex.Compile("(?<!\\d[.,]\\d{1,4})(?<!802[.,]11[a-z]{0,3})\\bm\\b", "giu"), "metri"),
        (JsRegex.Compile("(?<!\\d[.,]\\d{1,4})(?<!802[.,]11[a-z]{0,3})\\bg\\b", "giu"), "grame"),
    };

    /** The same abbreviations standing alone, with no numeral in front. ⚠ The keys are read off the UNITS
     *  table above rather than written out again, so the two cannot drift. */
    private static readonly JsRe BARE_KEY = JsRegex.Compile("\\\\b([a-z]+)\\\\b$", "u");
    private static readonly Func<string, string> BARE_UNITS = NormalizeSymbols.MakeBareUnitNormalizer(
        UNITS.Select(u =>
        {
            var m = BARE_KEY.Match(u.Re.Source);
            return new KeyValuePair<string, string>(m.Success ? m.Groups[1].Value : "", u.Word);
        }));

    /** Squared / cubed units; Romanian postposes the modifier (*kilometri pătrați*). */
    private static readonly (JsRe Re, string Word)[] SQUARED =
    {
        (JsRegex.Compile("\\bkm\\s*\u00b2", "giu"), "kilometri pătrați"),
        (JsRegex.Compile("\\bm\\s*\u00b2", "giu"), "metri pătrați"),
        (JsRegex.Compile("\\bcm\\s*\u00b2", "giu"), "centimetri pătrați"),
        (JsRegex.Compile("\\bm\\s*\u00b3", "giu"), "metri cubi"),
    };

    /** Currency sign → the Romanian word. Both placements are claimed, sign-before and sign-after. */
    private static readonly IReadOnlyDictionary<string, string> CURRENCY = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["$"] = "dolari", ["€"] = "euro", ["£"] = "lire", ["¥"] = "yeni", ["lei"] = "lei",
    };

    /** Relational and operator signs, read in every position. */
    private static readonly (JsRe Re, string Word)[] RELATIONAL =
    {
        (JsRegex.Compile("\u00b1", "gu"), " plus minus "),
        (JsRegex.Compile("\u2248", "gu"), " aproximativ egal cu "),
        (JsRegex.Compile("\u2264", "gu"), " mai mic sau egal cu "),
        (JsRegex.Compile("\u2265", "gu"), " mai mare sau egal cu "),
        (JsRegex.Compile("=", "gu"), " egal cu "),
        (JsRegex.Compile("<", "gu"), " mai mic decât "),
        (JsRegex.Compile(">", "gu"), " mai mare decât "),
        (JsRegex.Compile("\u00d7|(?<=\\p{Nd})[ \\t]?x[ \\t]?(?=\\p{Nd})", "gu"), " ori "),
        (JsRegex.Compile("\u00f7", "gu"), " împărțit la "),
    };

    private static readonly JsRe GROUP_DOT = JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)\\.(?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)[ \u00a0\u202f\u2009](?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(\\d+),(\\d+)", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(\\d{1,2}):(\\d{2})(?!\\d)", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile("(\\d+)\\s*%", "gu");
    private static readonly JsRe DEG_C_SIGN = JsRegex.Compile("\u2103", "gu");
    private static readonly JsRe DEG_F_SIGN = JsRegex.Compile("\u2109", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s*\u00b0\\s*C(?![\\p{L}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s*\u00b0\\s*F(?![\\p{L}])", "giu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s*\u00b0", "gu");
    private static readonly JsRe KM_H = JsRegex.Compile("km\\s*\\/\\s*(?:h|or[ăa])(?!\\p{L})", "giu");
    private static readonly JsRe M_S = JsRegex.Compile("(?<!\\p{L})m\\s*\\/\\s*s(?!\\p{L})", "giu");
    private static readonly JsRe BACKSLASH_B = JsRegex.Compile("\\\\b", "gu");
    /** The counted form of each unit rule: the same source, `\b` boundaries stripped, behind a digit. */
    private static readonly (JsRe Re, string Word)[] COUNTED_UNITS = UNITS
        .Select(u => (JsRegex.Compile($"(\\d)\\s*(?:{BACKSLASH_B.Replace(u.Re.Source, "")})(?![\\p{{L}}\\d²³/])", "gu"), u.Word))
        .ToArray();
    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<![-\u2013\u2014])(\\d+)\\s*[-\u2013\u2014]\\s*(\\d+)(?!\\d)(?!\\s*[-\u2013\u2014]\\s*\\d)", "gu");
    private static readonly JsRe NON_LETTER_FIRST = JsRegex.Compile("^[^\\p{L}]", "u");
    private static readonly JsRe ESCAPE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");
    private static readonly JsRe SIGNED = JsRegex.Compile("(?<![\\p{L}\\d])([-\u2212+])(\\d+)", "gu");
    private static readonly JsRe INFIX_PLUS = JsRegex.Compile("(\\d)\\s*\\+\\s*(\\d)", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s*[&\uff06]\\s*", "gu");
    private static readonly JsRe RUNS = JsRegex.Compile("[ \\t]{2,}", "gu");

    public static string NormalizeRomanian(string input)
    {
        var t = input;

        string prev;
        do
        {
            prev = t;
            t = Rewrite(t, GROUP_DOT, "");
        } while (t != prev);

        do
        {
            prev = t;
            t = Rewrite(t, GROUP_SPACE, "");
        } while (t != prev);

        t = Rewrite(t, DECIMAL_COMMA, m =>
            $"{m.Groups[1].Value} virgulă {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        t = Rewrite(t, CLOCK, "$1 $2");

        t = Rewrite(t, PERCENT, "$1 la sută");

        // ⚠ DEGREES BEFORE the unit rules — the ⟨C⟩ of `20 °C` is otherwise read as Romanian [k].
        t = Rewrite(Rewrite(t, DEG_C_SIGN, "\u00b0C"), DEG_F_SIGN, "\u00b0F");
        t = Rewrite(t, DEG_C, "$1 grade Celsius");
        t = Rewrite(t, DEG_F, "$1 grade Fahrenheit");
        t = Rewrite(t, DEG, "$1 grade");

        // ⚠ SQUARED/CUBED BEFORE the plain unit rule, or `km` is consumed first and the exponent stranded.
        foreach (var (re, word) in SQUARED) t = Rewrite(t, re, word);

        // ⚠ RATES BEFORE the plain unit rule too, or `km` is consumed and a bare `/h` is left dangling.
        // ⚠ The trailing boundary is `(?!\p{L})`, NOT `\b` — do not "simplify" it: after the ⟨ă⟩ of `oră`
        // the JS `\b` this port reproduces finds no boundary and the rule silently does not fire.
        t = Rewrite(t, KM_H, "kilometri pe oră");
        t = Rewrite(t, M_S, "metri pe secundă");

        foreach (var (re, word) in COUNTED_UNITS) t = Rewrite(t, re, $"$1 {word}");
        // The bare-unit pass runs AFTER the counted loop, so only what the counted rule could not reach
        // is left for it.
        t = BARE_UNITS(t);

        t = Rewrite(t, RANGE, "$1 până la $2");

        foreach (var (sign, word) in CURRENCY)
        {
            if (!NON_LETTER_FIRST.IsMatch(sign)) continue; // `lei` is a word already, not a sign
            var esc = JsRegex.Replace(sign, ESCAPE, "\\$&");
            t = Rewrite(t, JsRegex.Compile($"{esc}\\s*(\\d+)", "gu"), $"$1 {word}");
            t = Rewrite(t, JsRegex.Compile($"(\\d+)\\s*{esc}", "gu"), $"$1 {word}");
        }

        t = Rewrite(t, SIGNED, m => $"{(m.Groups[1].Value == "+" ? "plus" : "minus")} {m.Groups[2].Value}");

        t = Rewrite(t, INFIX_PLUS, "$1 plus $2");
        foreach (var (re, word) in RELATIONAL) t = Rewrite(t, re, word);

        t = Rewrite(t, AMPERSAND, " și ");

        return Rewrite(t, RUNS, " ");
    }
}
