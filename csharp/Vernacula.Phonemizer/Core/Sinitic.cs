/**
 * SHARED SINITIC NUMBER RULES — the shapes that five Han-orthography layers each rediscovered.
 * Ported from src/core/sinitic.ts — see that file for the corpus evidence.
 */

using System.Text;

namespace Vernacula.Phonemizer.Core;

public static class Sinitic
{
    /** 0–9 as Han numerals. The default; a language may pass its own (〇 vs 零 is a real choice). */
    public static readonly IReadOnlyList<string> HAN_DIGITS = new[] { "零", "一", "二", "三", "四", "五", "六", "七", "八", "九" };

    /**
     * Port of the TS `digits[Number(c)]` index for one code point: an ASCII digit gives its value, and a
     * code point in the ECMAScript whitespace set gives 0, because JS `Number(" ")` is 0 — reproduced on
     * purpose, since the index it feeds is observable.
     */
    private static int JsNumberIndex(string c)
    {
        if (c.Length == 1)
        {
            var ch = c[0];
            if (ch is >= '0' and <= '9') return ch - '0';
            if (ch is '\t' or '\n' or '\v' or '\f' or '\r' or ' ' or '\u00A0' or '\u1680'
                or (>= '\u2000' and <= '\u200A') or '\u2028' or '\u2029' or '\u202F' or '\u205F'
                or '\u3000' or '\uFEFF') return 0;
        }
        return -1;
    }

    /** A digit string read ONE DIGIT AT A TIME — what Sinitic gives a year (二零零九) and a decimal's tail. */
    public static string SpellHanDigits(string s, IReadOnlyList<string>? digits = null)
    {
        digits ??= HAN_DIGITS;
        var sb = new StringBuilder();
        foreach (var c in Js.CodePoints(s))
        {
            var i = JsNumberIndex(c);
            sb.Append(i >= 0 && i < digits.Count ? digits[i] : c);
        }
        return sb.ToString();
    }

    /**
     * THOUSANDS DE-GROUPING — the most destructive number defect these engines have, and the same rule in
     * four languages.
     */
    public static string DegroupThousands(string s)
    {
        return JsRegex.Compile(@"(?<![\d.,])[1-9]\d{0,2}(?:,\d{3})+(?![\d,])", "gu")
            .Replace(s, m => JsRegex.Compile(",", "gu").Replace(m.Value, ""));
    }

    /** THE YEAR TRIO, IN THE ONLY ORDER THAT WORKS — and the order is the point. */
    public static string SpellYears(string s, YearRuleData? d = null)
    {
        d ??= new YearRuleData();
        var digits = d.Digits ?? HAN_DIGITS;
        var dash = d.Dashes ?? "-–—－~～〜";
        string Spell(string y) => SpellHanDigits(y, digits);
        var outp = s;
        if (d.RangeWord != null)
        {
            outp = JsRegex.Compile($"(?<![\\d.,])(\\d{{4}})\\s*[{dash}]\\s*(\\d{{4}})(?![\\d.,])(?=\\s*年)", "gu")
                .Replace(outp, m => $"{Spell(m.Groups[1].Value)}{d.RangeWord}{Spell(m.Groups[2].Value)}");
            outp = JsRegex.Compile($"(?<![\\d.,])(\\d{{4}})\\s*年\\s*[{dash}]\\s*(?=\\d{{4}}\\s*年)", "gu")
                .Replace(outp, m => $"{Spell(m.Groups[1].Value)}年{d.RangeWord}");
        }
        return JsRegex.Compile(@"(?<![\d.,:])(\d{4})(?![\d.,])(?=\s*年)", "gu")
            .Replace(outp, m => Spell(m.Groups[1].Value));
    }

    /** THE FRACTION, IN THE CHINESE ORDER — `a/b` is `b分之a`, "of b parts, a". */
    public static string ReorderFraction(string s, string fractionWord)
    {
        return JsRegex.Compile(@"(?<![\d.,/\p{sc=Latn}])(\d{1,4})\/(\d{1,4})(?![\d/])", "gu").Replace(s, m =>
        {
            var num = m.Groups[1].Value;
            var den = m.Groups[2].Value;
            return num.Length == 4 && den.Length == 4 ? m.Value : $"{den}{fractionWord}{num}";
        });
    }

    /**
     * DECIMALS — the separator is a word and the FRACTIONAL PART IS READ DIGIT BY DIGIT: 6.34 is 六點三四, never
     * 六點三十四.
     */
    public static string ReadDecimals(string s, string decimalWord, IReadOnlyList<string>? digits = null)
    {
        digits ??= HAN_DIGITS;
        return JsRegex.Compile(@"(?<![\d.,])(\d+)\.(\d{1,3})(?![\d,])(?!\.\d)", "gu").Replace(s,
            m => $"{m.Groups[1].Value}{decimalWord}{SpellHanDigits(m.Groups[2].Value, digits)}");
    }

    /**
     * TEMPERATURE THEN BARE DEGREE, in that order — and the order is load-bearing: run the bare rule first
     * and it eats the ° and leaves a lone ⟨C⟩ to be read as a letter.
     */
    private const string DEG_NUM = "(\\d+(?:\\.\\d+)?)";
    public static string ReadDegrees(string s, DegreeData d)
    {
        var outp = s;
        if (d.Celsius != null) outp = JsRegex.Compile($"{DEG_NUM}\\s*°\\s*C(?![\\p{{sc=Latn}}])", "gui").Replace(outp, m => d.Celsius(m.Groups[1].Value));
        if (d.Fahrenheit != null) outp = JsRegex.Compile($"{DEG_NUM}\\s*°\\s*F(?![\\p{{sc=Latn}}])", "gui").Replace(outp, m => d.Fahrenheit(m.Groups[1].Value));
        if (d.Bare != null) outp = JsRegex.Compile($"{DEG_NUM}\\s*°", "gu").Replace(outp, m => d.Bare(m.Groups[1].Value));
        return outp;
    }
}

/**
 * Word data for the year rules. `rangeWord` omitted ⇒ the range arms are skipped, single years still spell.
 */
public sealed class YearRuleData
{
    /** The range connective — 到 (yue/wuu/cjy), 至, kàu. Omit to decline ranges. */
    public string? RangeWord { get; init; }
    /** Han digit table, if the language does not use the default. */
    public IReadOnlyList<string>? Digits { get; init; }
    /** Dash characters that count as a range. Defaults to the four the Han orthographies write. */
    public string? Dashes { get; init; }
}

/** Options for the temperature/degree trio. Any field omitted is DECLINED rather than guessed. */
public sealed class DegreeData
{
    /** Given the number, produce the whole reading — the position differs and cannot be a plain word:
     *  yue/nan write the scale name BEFORE (`攝氏20度`, `Liap-sī 20 tō͘`), wuu writes it AFTER (`20摄氏度`). */
    public Func<string, string>? Celsius { get; init; }
    public Func<string, string>? Fahrenheit { get; init; }
    /** The bare-degree reading, for coordinates and angles. Omit to leave ° unread. */
    public Func<string, string>? Bare { get; init; }
}
