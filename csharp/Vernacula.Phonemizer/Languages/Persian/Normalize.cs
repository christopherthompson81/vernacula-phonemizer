/**
 * Persian / Farsi (fa) text normalization — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the pipeline speaks. It sits ABOVE the neural restorers, whose
 * alphabet is BARE Perso-Arabic, so it may emit only undiacritized words and ASCII digits.
 * Ported from src/languages/persian/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Persian;

public static class Normalize
{
    /** Persian-Indic digits ۰-۹ (U+06F0-U+06F9) — Persian's own block, NOT the Arabic-Indic ٠-٩ (U+0660) that
     *  Arabic uses. Both are folded, since either can be typed on a Persian keyboard layout. */
    private static readonly JsRe EASTERN_DIGIT = JsRegex.Compile("[۰-۹٠-٩]", "gu");
    private static string FoldDigit(string c)
    {
        var cp = Js.CodePointAt0(c);
        if (cp >= 0x06f0 && cp <= 0x06f9) return Js.NumberToString(cp - 0x06f0); // ۰-۹ Extended Arabic-Indic (Persian/Urdu)
        if (cp >= 0x0660 && cp <= 0x0669) return Js.NumberToString(cp - 0x0660); // ٠-٩ Arabic-Indic
        return c;
    }

    /** A Persian word continues across a ZWNJ, so "not followed by a letter" must exclude ZWNJ as well. */
    private const string NOT_WORD = "(?![\\p{L}\\p{M}\\u200C])";

    /** Currency sign → its Persian word. `¥` is ین; the Japanese and Chinese currencies are not distinguished. */
    private static readonly IReadOnlyDictionary<string, string> CURRENCY = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["$"] = "دلار", ["€"] = "یورو", ["£"] = "پوند", ["¥"] = "ین",
    };
    /**
     * Harakat + the connective marker: stripped from any word this layer writes into the TEXT.
     * ⚠ WRITTEN AS ESCAPES, NOT LITERALS: the class is four combining marks and a private-use code point,
     * none of which survive a round-trip through a shell heredoc or render distinguishably in an editor.
     */
    private static readonly JsRe HARAKAT_OR_MARK = JsRegex.Compile("[\u064B-\u0652\u0670\uE000]", "gu");
    /** ⟨و⟩ /o/, the connective, as ordinary text — read by the word path like the ubiquitous conjunction. */
    private const string VA = "و";

    // The step patterns, hoisted to statics (the TS builds them inline in the returned closure; JsRegex
    // caches, so the placement is a readability choice and not a behaviour one).
    private static readonly JsRe PCT_SIGN = JsRegex.Compile("٪", "gu");
    private static readonly JsRe ARABIC_DECIMAL = JsRegex.Compile("٫", "gu");
    private static readonly JsRe ARABIC_GROUP = JsRegex.Compile("٬", "gu");
    private static readonly JsRe ARABIC_COMMA_GROUP = JsRegex.Compile("(\\d)،(\\d{3})(?!\\d)", "gu");
    private static readonly JsRe GROUP_COMMA = JsRegex.Compile("(?<![\\d.,])(\\d{1,3})((?:,\\d{3})+)(?![\\d,])", "gu");
    private static readonly JsRe GROUP_DOT = JsRegex.Compile("(?<![\\d.,])(\\d{1,3})((?:\\.\\d{3})+)(?![\\d.])", "gu");
    private static readonly JsRe COMMA = JsRegex.Compile(",", "gu");
    private static readonly JsRe DOT = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(?![.,]\\d)(\\s*دقیقه)?", "gu");
    private static readonly JsRe CLOCK_UTC = JsRegex.Compile("(?<![\\d.,])([01]?\\d|2[0-3])\\.([0-5]\\d)(?=\\s*UTC(?![A-Za-z]))", "gu");
    private static readonly JsRe DECIMAL_RE = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)(?![\\d.,])", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile($"(\\d)\\s?%{NOT_WORD}", "gu");
    private static readonly JsRe CURRENCY_RE = JsRegex.Compile("([$€£¥])\\s?(\\d[\\d.,]*)", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(?<=[\\d\\u06f0-\\u06f9])\\s?(?:×|x)\\s?(?=[\\d\\u06f0-\\u06f9])", "gu");
    private static readonly JsRe PLUS_AFTER = JsRegex.Compile("(\\d[\\d.,]*)\\s?\\+(?!\\s?\\d)", "gu");
    private static readonly JsRe PLUS_BEFORE = JsRegex.Compile("\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](?=\\d)", "gu");
    /** The range guard's own test — `/\d\s*$/u` against the text to the LEFT of the sign. */
    private static readonly JsRe DIGIT_AT_END = JsRegex.Compile("\\d\\s*$", "u");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(\\d+)\\s?<\\s?(\\d+)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(\\d+)\\s?>\\s?(\\d+)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("&", "gu");
    private static readonly JsRe ORDINAL = JsRegex.Compile($"(?<![\\d.,])(\\d+)\\u200C?ام{NOT_WORD}", "gu");

    /**
     * Build the Persian normalizer. Takes the numbers table so the one place a number WORD is needed (the
     * ordinal) is spelled by the same compositor the engine's digit path uses.
     */
    public static Func<string, string> MakePersianNormalizer(NumbersDef numbers)
    {
        /** Cardinal as plain running text: the compositor's words, connective marker → ⟨و⟩, harakat stripped. */
        string? CardinalText(double n)
        {
            var parts = Numbers.PersianNumberWords(n, numbers);
            if (parts.Any(w => w is null || w == "")) return null;
            return JsRegex.Replace(
                string.Join(" ", parts.Select(w => w!.EndsWith("\uE000", StringComparison.Ordinal) ? $"{w![..^1]} {VA}" : w!)),
                HARAKAT_OR_MARK, _ => "");
        }

        /**
         * Ordinal text — the cardinal with its LAST word suffixed, with three irregularities: 1st is the
         * suppletive اول, a final ⟨سه⟩ becomes ⟨سوم⟩, and after a final ⟨ی⟩ the suffix is ⟨ام⟩ behind a ZWNJ.
         */
        string? OrdinalText(double n)
        {
            if (n == 1) return "اول";
            var w = CardinalText(n);
            if (w is null) return null;
            var parts = w.Split(" ");
            var last = parts[^1];
            parts[^1] = last == "سه" ? "سوم"
                : last.EndsWith("ی", StringComparison.Ordinal) ? $"{last}‌ام"
                : $"{last}م";
            return string.Join(" ", parts);
        }

        /**
         * Hour ⟨و⟩ minutes دقیقه; at :00 the minutes drop entirely. `written` is the text's OWN دقیقه when it
         * wrote one — reused rather than duplicated, and at :00 handed back untouched rather than swallowed
         * with the minutes: this rule must not delete words the text already wrote.
         */
        string Clock(string _m, string h, string min, string? written) =>
            Js.Number(min) == 0
                ? $"{Js.NumberToString(Js.Number(h))}{written ?? ""}"
                : $"{Js.NumberToString(Js.Number(h))} {VA} {Js.NumberToString(Js.Number(min))}{written ?? " دقیقه"}";

        return input =>
        {
            var s = input;

            s = JsRegex.Replace(s, EASTERN_DIGIT, m => FoldDigit(m.Value));

            // Arabic symbol characters → ASCII, before de-grouping, decimals and percent so a natively-typed
            // ٫ / ٬ / ٪ is seen by them.
            s = JsRegex.Replace(s, PCT_SIGN, _ => "%");
            s = JsRegex.Replace(s, ARABIC_DECIMAL, _ => ".");
            s = JsRegex.Replace(s, ARABIC_GROUP, _ => ",");
            // ⚠ The Arabic comma DOUBLES as the thousands separator (19،500). Only the digit-flanked,
            // exactly-3-digit case is folded — ⟨،⟩ as real punctuation is the commonest mark in Persian text.
            s = JsRegex.Replace(s, ARABIC_COMMA_GROUP, m => $"{m.Groups[1].Value},{m.Groups[2].Value}");

            // De-grouping FIRST among the numeric rules: a grouping comma or period is otherwise read as clause
            // punctuation. The period form requires whole 3-digit blocks, which keeps it off genuine decimals.
            s = JsRegex.Replace(s, GROUP_COMMA,
                m => m.Groups[1].Value + JsRegex.Replace(m.Groups[2].Value, COMMA, _ => ""));
            s = JsRegex.Replace(s, GROUP_DOT,
                m => m.Groups[1].Value + JsRegex.Replace(m.Groups[2].Value, DOT, _ => ""));

            // CLOCK before any rule that reads a bare number, so 11:30 is not claimed piecewise. No ساعت is
            // inserted (a clock is already introduced by one), and the text's own دقیقه is consumed rather than
            // duplicated. Lookarounds keep it off a longer digit run and off a comma-decimal sports time.
            s = JsRegex.Replace(s, CLOCK, m => Clock(m.Value, m.Groups[1].Value, m.Groups[2].Value,
                m.Groups[3].Success ? m.Groups[3].Value : null));

            // The dotted 24-hour clock, only when anchored by a following UTC — H.MM is decimal-shaped, so
            // nothing weaker may claim it, and it must be settled before the decimal rule below.
            s = JsRegex.Replace(s, CLOCK_UTC, m => Clock(m.Value, m.Groups[1].Value, m.Groups[2].Value, null));

            // Units: AFTER de-grouping and BEFORE the decimal rule, which rewrites the dot as ممیز and would
            // leave FA_NUM's version guard with no dot to reject. ⚠ The exponent arm must precede the plain
            // one, or the plain rule eats the unit and strands the `²`.
            var faUnits = string.Join("|", FA_UNIT.Keys.OrderByDescending(k => k.Length));
            s = JsRegex.Replace(s, JsRegex.Compile($"{FA_NUM}\\s?({faUnits})(?:\\s?([²³])|([23])(?![\\d\\p{{L}}]))", "giu"),
                m =>
                {
                    var n = m.Groups[1].Value;
                    var u = m.Groups[2].Value;
                    var sup = m.Groups[3].Success ? m.Groups[3].Value : null;
                    var ascii = m.Groups[4].Success ? m.Groups[4].Value : null;
                    var power = sup ?? ascii;
                    return $"{n} {FA_UNIT[u.ToLowerInvariant()]} {(power == "³" || power == "3" ? "مکعب" : "مربع")}";
                });
            // ⚠ The rate arm precedes the plain one, or the plain rule consumes the numerator and strands the
            // slash, leaving `120 km/h` to read the denominator as an English letter name.
            s = JsRegex.Replace(s, JsRegex.Compile($"{FA_NUM}\\s?({faUnits})\\s?/\\s?([hs])(?![\\p{{L}}\\p{{M}}\\d])", "giu"),
                m => $"{m.Groups[1].Value} {FA_UNIT[m.Groups[2].Value.ToLowerInvariant()]} بر {FA_PER[m.Groups[3].Value.ToLowerInvariant()]}");
            s = JsRegex.Replace(s, JsRegex.Compile($"{FA_NUM}\\s?({faUnits})(?![\\p{{L}}\\p{{M}}\\d])", "giu"),
                m => $"{m.Groups[1].Value} {FA_UNIT[m.Groups[2].Value.ToLowerInvariant()]}");

            // Decimals AFTER de-grouping and both clock rules, each of which a decimal-shaped pattern would
            // otherwise mis-claim. The fractional part is spelled DIGIT BY DIGIT, not as an integer.
            var decimalWord = numbers.DecimalWord;
            if (decimalWord is not null)
                s = JsRegex.Replace(s, DECIMAL_RE,
                    m => $"{m.Groups[1].Value} {decimalWord} {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

            s = JsRegex.Replace(s, PERCENT, m => $"{m.Groups[1].Value} درصد");

            // ⚠ Unlike percent, currency MOVES its word ACROSS the numeral: the sign precedes the number in
            // logical order and the word follows it, so an in-place substitution would invert the two.
            s = JsRegex.Replace(s, CURRENCY_RE, m => $"{m.Groups[2].Value} {CURRENCY[m.Groups[1].Value]}");

            s = JsRegex.Replace(s, TIMES, _ => " ضربدر ");
            // ⚠ TWO PLUS ARMS, because a displayed `+1` is stored as `1+` in logical order. The digit-first arm
            // moves the word across the numeral (and requires no digit after the sign, so arithmetic `5+3`
            // falls to the second arm); a single in-place arm would emit operand and operator inverted.
            s = JsRegex.Replace(s, PLUS_AFTER, m => $"به اضافه {m.Groups[1].Value}");
            s = JsRegex.Replace(s, PLUS_BEFORE, _ => " به اضافه ");

            s = JsRegex.Replace(s, DEG_C, m => $"{m.Groups[1].Value} درجه سانتی‌گراد");
            s = JsRegex.Replace(s, DEG_F, m => $"{m.Groups[1].Value} درجه فارنهایت");
            s = JsRegex.Replace(s, DEG, m => $"{m.Groups[1].Value} درجه");

            s = JsRegex.Replace(s, PLUSMINUS, _ => " مثبت و منفی ");
            // ⚠ THE RANGE GUARD: a digit anywhere to the LEFT rejects the match — a negative quantity does not
            // follow a number, a range does. (`whole` is the subject string, snapshotted because `s` is
            // reassigned by every step; it is the JS replacer's fourth argument.)
            var whole = s;
            s = JsRegex.Replace(s, MINUS, m =>
                DIGIT_AT_END.IsMatch(whole[..m.Index]) ? m.Value : $"{m.Groups[1].Value}منفی ");

            // ⚠ Persian is SOV, so a comparative ends in است: the two inequality rules CONSUME both operands
            // and rebuild the clause. Equality and division are genuinely infix (برابر است با carries its
            // copula in the middle), so those two substitute between the operands.
            s = JsRegex.Replace(s, LESS_THAN, m => $"{m.Groups[1].Value} کوچکتر از {m.Groups[2].Value} است");
            s = JsRegex.Replace(s, GREATER_THAN, m => $"{m.Groups[1].Value} بزرگتر از {m.Groups[2].Value} است");
            s = JsRegex.Replace(s, EQUALS, _ => " برابر است با ");
            s = JsRegex.Replace(s, DIVIDE, _ => " تقسیم بر ");

            s = JsRegex.Replace(s, AMPERSAND, _ => " اند ");

            // ORDINALS LAST, after every numeric rule, so a decimal or a clock can never be re-read as one.
            // The one rule here that emits number WORDS, undiacritized, since the suffix must attach to the
            // final word. Only the ⟨ام⟩ spelling is matched: a bare ⟨م⟩ would reach into ordinary sequences.
            s = JsRegex.Replace(s, ORDINAL, m =>
            {
                var n = Js.Number(m.Groups[1].Value);
                if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d)) return m.Value;
                return OrdinalText(n) ?? m.Value;
            });

            return s;
        };
    }

    private static readonly IReadOnlyDictionary<string, string> FA_UNIT = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "کیلومتر", ["cm"] = "سانتی‌متر", ["mm"] = "میلی‌متر", ["kg"] = "کیلوگرم", ["m"] = "متر",
    };
    // ⚠ A dotted designation is not a quantity (`802.11m` is not 802.11 metres). The guard is on the WHOLE
    // number, not the adjacent digit, and what separates the two cases is the SPACE: a version glues its
    // letter to the digits.
    private const string FA_NUM = "(?<![\\d.,])(?!\\d+[.,]\\d+[a-zA-Z](?![a-zA-Z\\d]))(\\d[\\d.,]*)";
    private static readonly IReadOnlyDictionary<string, string> FA_PER = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["h"] = "ساعت", ["s"] = "ثانیه",
    };
}
