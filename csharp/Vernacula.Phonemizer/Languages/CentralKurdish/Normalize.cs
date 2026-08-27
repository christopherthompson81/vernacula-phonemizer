/**
 * Central Kurdish / Sorani (ckb) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the
 * Kurdish g2p cannot read into Kurdish words the pipeline speaks. Pure text→text, no IPA.
 * Ported from src/languages/central-kurdish/normalize.ts — see that file for the corpus counts and for
 * every ordering constraint between the rules (they are forced, not tidy).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.CentralKurdish;

public static class Normalize
{
    /** Relational and operator signs, read in every position — a dropped sign is inaudible. */
    private static readonly (JsRe Re, string Word)[] RELATIONAL =
    [
        (JsRegex.Compile("±", "gu"), " کۆ و لێدەرکراو "),
        (JsRegex.Compile("=", "gu"), " یەکسانە بە "),
        (JsRegex.Compile("<", "gu"), " کەمتر لە "),
        (JsRegex.Compile(">", "gu"), " زیاتر لە "),
        (JsRegex.Compile("×|(?<=\\p{Nd})[ \\t]?x[ \\t]?(?=\\p{Nd})", "gu"), " لە "),
        (JsRegex.Compile("÷", "gu"), " دابەش بە "),
    ];

    /** Currency sign → the Kurdish word. ⚠ ORDERED: the TS iterates `Object.entries`, insertion order. */
    private static readonly IReadOnlyList<KeyValuePair<string, string>> CURRENCY =
    [
        new("$", "دۆلار"), new("€", "یۆرۆ"), new("£", "پاوەند"), new("¥", "یەن"),
    ];

    /** Arabic-keyboard letterforms → the Sorani code points for the same letters. */
    private static readonly IReadOnlyDictionary<string, string> LETTERFORM =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["ك"] = "ک", ["ى"] = "ی", ["ي"] = "ی" };
    private static readonly JsRe LETTERFORM_RE =
        JsRegex.Compile($"[{string.Concat(LETTERFORM.Keys)}]", "gu");

    private static readonly IReadOnlyDictionary<string, string> CKB_UNIT =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["km"] = "کیلۆمەتر", ["cm"] = "سانتیمەتر", ["mm"] = "میلیمەتر", ["m"] = "مەتر",
        };

    private static readonly IReadOnlyDictionary<string, string> CKB_PER =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["h"] = "کاتژمێر", ["s"] = "چرکە", ["کاتژمێر"] = "کاتژمێر", ["چرکە"] = "چرکە",
        };

    private static readonly IReadOnlyDictionary<string, string> CKB_NUMER =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["کم"] = "کیلۆمەتر", ["کیلۆمەتر"] = "کیلۆمەتر", ["مەتر"] = "مەتر", ["سم"] = "سانتیمەتر",
        };

    /** ⚠ JS `Array.prototype.sort` with `(a,b) => b.length - a.length` is not a total order on ties, but it
     *  IS stable in V8 — so equal-length keys keep their insertion order. `OrderByDescending` is stable too. */
    private static string Alternation(IEnumerable<string> keys) =>
        string.Join("|", keys.OrderByDescending(k => k.Length));

    private static readonly string CkbUnits = Alternation(CKB_UNIT.Keys);
    private static readonly string CkbPer = Alternation(CKB_PER.Keys);
    private static readonly string CkbNumer = Alternation(CKB_NUMER.Keys);

    /** A DOTTED DESIGNATION IS NOT A QUANTITY (`802.11m`) — NOT_VERSION, guarding the WHOLE number. */
    private const string CKB_NUM = "(?<![\\d.,])(?!\\d+[.,]\\d+[a-zA-Z](?![a-zA-Z\\d]))(\\d[\\d.,]*)";

    private static readonly JsRe GROUPED =
        JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)[,،](?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe UNIT_EXP =
        JsRegex.Compile($"{CKB_NUM}\\s*({CkbUnits})(?:\\s?([²³])|([23])(?![\\d\\p{{L}}]))", "giu");
    private static readonly JsRe RATE_LATIN =
        JsRegex.Compile($"{CKB_NUM}\\s*({CkbUnits})\\s*/\\s*({CkbPer})(?![\\p{{L}}\\p{{M}}\\d])", "giu");
    private static readonly JsRe RATE_NATIVE =
        JsRegex.Compile($"(\\d[\\d.,]*)\\s*({CkbNumer})\\s*/\\s*({CkbPer})(?![\\p{{L}}\\p{{M}}\\d])", "gu");
    private static readonly JsRe UNIT_PLAIN =
        JsRegex.Compile($"{CKB_NUM}\\s*({CkbUnits})(?![\\p{{L}}\\p{{M}}\\d])", "giu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(\\d+)\\.(\\d+)", "gu");
    private static readonly JsRe COLON_CLOCK = JsRegex.Compile("(\\d{1,2}):(\\d{2})(?!\\d)", "gu");
    private static readonly JsRe PERCENT_AFTER = JsRegex.Compile("(\\d+)\\s*%", "gu");
    private static readonly JsRe PERCENT_BEFORE = JsRegex.Compile("%\\s*(\\d+)", "gu");
    private static readonly JsRe DEG_C_SIGN = JsRegex.Compile("℃", "gu");
    private static readonly JsRe DEG_F_SIGN = JsRegex.Compile("℉", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s*°\\s*C(?!\\p{L})", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s*°\\s*F(?!\\p{L})", "giu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s*°", "gu");
    private static readonly JsRe ABBR_KM = JsRegex.Compile("(\\d)\\s*کم(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ABBR_CM = JsRegex.Compile("(\\d)\\s*سم(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe RANGE =
        JsRegex.Compile("(?<![-–—])(\\d+)\\s*[-–—]\\s*(\\d+)(?!\\d)(?!\\s*[-–—]\\s*\\d)", "gu");
    private static readonly JsRe ESCAPE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");
    private static readonly JsRe[] CURRENCY_BEFORE =
        CURRENCY.Select(c => JsRegex.Compile($"{Esc(c.Key)}\\s*(\\d+)", "gu")).ToArray();
    private static readonly JsRe[] CURRENCY_AFTER =
        CURRENCY.Select(c => JsRegex.Compile($"(\\d+)\\s*{Esc(c.Key)}", "gu")).ToArray();
    private static string Esc(string sign) => ESCAPE.Replace(sign, "\\$&");
    private static readonly JsRe SIGNED_PLUS = JsRegex.Compile("(?<![\\d])(\\+)(\\d+)", "gu");
    private static readonly JsRe SIGNED_MINUS = JsRegex.Compile("(?<![\\d\\p{L}\\p{M}])([-−])(\\d+)", "gu");
    private static readonly JsRe PLUS_INFIX = JsRegex.Compile("(\\d)\\s*\\+\\s*(\\d)", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s*[&＆]\\s*", "gu");
    private static readonly JsRe SPACE_RUN = JsRegex.Compile("[ \\t]{2,}", "gu");

    public static string NormalizeCentralKurdish(string input)
    {
        // 0) THE ARABIC LETTERFORMS, before anything reads a word.
        input = LETTERFORM_RE.Replace(input, m => LETTERFORM[m.Value]);

        // 1) FOLD THE NATIVE DIGITS FIRST — every rule below counts digits.
        var t = Core.Unicode.FoldNativeDigits(input);

        // 2) COMMA-GROUPED THOUSANDS, before the decimal rule (Kurdish follows the ENGLISH convention).
        string prev;
        do
        {
            prev = t;
            t = GROUPED.Replace(t, "");
        } while (t != prev);

        // 2b) LATIN UNIT ALIASES AND THEIR POWERS — exponent arm first, then rates, then the plain arm.
        t = UNIT_EXP.Replace(t, m =>
        {
            var sup = m.Groups[3].Success ? m.Groups[3].Value : m.Groups[4].Value;
            return $"{m.Groups[1].Value} {CKB_UNIT[m.Groups[2].Value.ToLowerInvariant()]} "
                + (sup == "³" || sup == "3" ? "سێجا" : "دووجا");
        });
        t = RATE_LATIN.Replace(t, m =>
            $"{m.Groups[1].Value} {CKB_UNIT[m.Groups[2].Value.ToLowerInvariant()]} لە {CKB_PER[m.Groups[3].Value.ToLowerInvariant()]}");
        t = RATE_NATIVE.Replace(t, m =>
            $"{m.Groups[1].Value} {CKB_NUMER[m.Groups[2].Value]} لە {CKB_PER[m.Groups[3].Value]}");
        t = UNIT_PLAIN.Replace(t, m =>
            $"{m.Groups[1].Value} {CKB_UNIT[m.Groups[2].Value.ToLowerInvariant()]}");

        // 3) DECIMAL POINT — the fractional part is spoken digit by digit.
        t = DECIMAL.Replace(t, m =>
            $"{m.Groups[1].Value} خاڵ {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 4) CLOCK, COLON FORM.
        t = COLON_CLOCK.Replace(t, "$1 $2");

        // 5) PERCENT — PREPOSED, and both placements of the sign are claimed.
        t = PERCENT_AFTER.Replace(t, "لە سەدا $1");
        t = PERCENT_BEFORE.Replace(t, "لە سەدا $1");

        // 6) DEGREES.
        t = DEG_F_SIGN.Replace(DEG_C_SIGN.Replace(t, "°C"), "°F");
        t = DEG_C.Replace(t, "$1 پلەی سەلیزی");
        t = DEG_F.Replace(t, "$1 پلەی فەهرەنهایت");
        t = DEG.Replace(t, "$1 پلە");

        // 6b) UNIT ABBREVIATIONS — a numeral MUST precede; that guard is the whole safety of this rule.
        t = ABBR_KM.Replace(t, "$1 کیلۆمەتر");
        t = ABBR_CM.Replace(t, "$1 سانتیمەتر");

        // 7) RANGES.
        t = RANGE.Replace(t, "$1 بۆ $2");

        // 8) CURRENCY, both placements.
        for (var i = 0; i < CURRENCY.Count; i++)
        {
            t = CURRENCY_BEFORE[i].Replace(t, $"$1 {CURRENCY[i].Value}");
            t = CURRENCY_AFTER[i].Replace(t, $"$1 {CURRENCY[i].Value}");
        }

        // 9) SIGNED NUMBERS — ⟨+⟩ admits a LETTER before it (the timezone `UTC+1`); ⟨-⟩ does NOT, because
        //    every letter-adjacent hyphen in this corpus is a designation. See the TS for the count.
        t = SIGNED_PLUS.Replace(t, m => $" کۆ {m.Groups[2].Value}");
        t = SIGNED_MINUS.Replace(t, m => $" کەم {m.Groups[2].Value}");

        // 10) ARITHMETIC AND RELATIONAL SIGNS.
        t = PLUS_INFIX.Replace(t, "$1 کۆ $2");
        foreach (var (re, word) in RELATIONAL) t = re.Replace(t, word);

        // 11) AMPERSAND → و ("and").
        t = AMPERSAND.Replace(t, " و ");

        // The insertions above pad with spaces so a sign never fuses with its neighbours; collapse the runs.
        return SPACE_RUN.Replace(t, " ");
    }
}
