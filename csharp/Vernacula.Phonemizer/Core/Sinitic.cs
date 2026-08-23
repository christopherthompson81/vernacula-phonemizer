/**
 * SHARED SINITIC NUMBER RULES — the shapes that five Han-orthography layers each rediscovered.
 *
 * ⚠ WHY THIS EXISTS, AND WHY IT IS NOT THE THING THE PLAYBOOK WARNS AGAINST. The playbook's premise is that
 * "there is no shared `normalize dates` function, because Japanese writes 3月14日, German writes 14. März":
 * orthographic conventions are per-language. That is right ACROSS FAMILIES and wrong WITHIN HAN, where the
 * orthography genuinely is shared — and the measurement says so. Across cmn, yue, wuu, nan and cjy:
 *
 *   · `/(?<![\d.,])\d{1,3}(?:,\d{3})+(?![\d,])/gu`      — BYTE-IDENTICAL in four layers
 *   · `/(?<![\d.,:])(\d{4})(?![\d.,])(?=\s*年)/gu`       — BYTE-IDENTICAL in three
 *   · the °C / °F / bare-° trio                          — near-identical in four, AND DRIFTED
 *
 * ⚠ THE DRIFT HAD ALREADY SHIPPED A BUG, which is the argument in one line. Cantonese's degree rules used
 * `\s?` (at most one space) where wu and nan used `\s*`. Two spaces is ordinary typography, so `20  °C` lost
 * its unit in yue and nowhere else — it read *jiː˨ sɐp̚˨ sˈiː*, the scale letter as an English letter name.
 * Four near-copies, one of them subtly wrong, and no test could see it because each layer tested only itself.
 *
 * ⚠ AND THE DEFECT KNOWLEDGE MATTERED MORE THAN THE CODE. These guards were each discovered the hard way and
 * then rediscovered in the next language. They are the real payload of this file:
 *
 *   · THE YEAR-RANGE ARM MUST PRECEDE THE SINGLE-YEAR RULE. Only the RIGHT endpoint of `1996-2007年` is
 *     followed by 年, so the single-year rule spells that one and leaves the left as a cardinal — one span,
 *     two readings. Rediscovered in yue, wuu AND cjy.
 *   · …AND THE BOTH-ENDPOINTS ARM MUST PRECEDE IT TOO. `1996年-2007年` has 年 after each, so both spell
 *     correctly and only the CONNECTIVE vanishes; but placed after the single-year rule the endpoints are
 *     already Han and no digit pattern can see them. (wuu, cjy.)
 *   · A SLASHED YEAR PAIR IS NOT A FRACTION. `2020/2021` is an academic year. Three languages, three
 *     corpora, one shape: jv guarded it, nan's whole fraction rule was removed when its only digit/digit
 *     slash turned out to be `Fahrenheit 9/11`, cjy hit it in review.
 *   · THE 年 MUST BE FOUND ACROSS WHITESPACE — Han corpora write `2009 年`, and that exact detail silently
 *     defeated the rule in cmn.
 *
 * ⚠ WHAT THIS FILE DELIBERATELY DOES NOT SHARE: THE WORDS. 點 vs 点, 到 vs 至, 摄氏 postposed vs 攝氏
 * preposed vs Liap-sī preposed, and above all the conjunction — wuu says 搭 (×176 against 和's 40), nan says
 * 佮, cjy and yue say 和. Those are the findings each corpus paid for, and folding them into shared code
 * would erase exactly the part that had to be measured. Every word here is a PARAMETER.
 *
 * ⚠ AND IT DOES NOT IMPOSE AN ORDER. Each rule is exported separately so a language's `normalize.ts` keeps
 * its own numbered, commented pipeline — which the playbook requires, since the ordering couplings differ
 * (wuu claims coordinates before degrees, nan claims a tilde range before its temperature, cjy declines
 * degrees outright because ⟨度⟩ is SILENT in its dict). A monolithic builder would have to hide that.
 */

using System.Text;

namespace Vernacula.Phonemizer.Core;

public static class Sinitic
{
    /** 0–9 as Han numerals. The default; a language may pass its own (〇 vs 零 is a real corpus choice). */
    public static readonly IReadOnlyList<string> HAN_DIGITS = new[] { "零", "一", "二", "三", "四", "五", "六", "七", "八", "九" };

    /** Port of the TS `digits[Number(c)]` index for one code point: an ASCII digit gives its value; a code
     *  point in the ECMAScript whitespace set gives 0 (JS `Number(" ") === 0`); everything else is NaN,
     *  modelled as -1 so the `?? c` fallback fires. */
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
     * THOUSANDS DE-GROUPING — the most destructive number defect these engines have, and the same rule in four
     * languages. The tokenizer splits `\d+`, so a grouping comma is read as a clause pause AND the value is
     * destroyed: `1,000人` came out 一 + [pause] + 零人 in wuu, `1,000` as *iəʔ˨ , liŋ˩˩* in cjy.
     *
     * ⚠ EXACTLY-3-DIGIT GROUPS, which is what makes it safe three ways at once: it cannot touch a decimal
     * (1–2 digits), it cannot touch a clock (`09.00`), and it cannot touch a DOI (`10.1016`, four).
     * ⚠ AND IT LEAVES THE CHINESE FOUR-DIGIT GROUPING ALONE — `1,8638.36亿元` is a 万-grouping, not thousands,
     * and the corpus writes it. A looser pattern would mangle it.
     */
    public static string DegroupThousands(string s)
    {
        return JsRegex.Compile(@"(?<![\d.,])\d{1,3}(?:,\d{3})+(?![\d,])", "gu")
            .Replace(s, m => JsRegex.Compile(",", "gu").Replace(m.Value, ""));
    }

    /**
     * THE YEAR TRIO, IN THE ONLY ORDER THAT WORKS — and the order is the point. A year is read DIGIT BY DIGIT
     * across Sinitic (`2009年` is 二零零九年, never the cardinal 二千零九年), and the three arms must run
     * range → both-endpoints → single, for the reasons in the file header.
     *
     * Returns the rewritten string; a language calls this as ONE step in its own pipeline.
     */
    public static string SpellYears(string s, YearRuleData? d = null)
    {
        d ??= new YearRuleData();
        var digits = d.Digits ?? HAN_DIGITS;
        var dash = d.Dashes ?? "-–—－~～〜";
        string Spell(string y) => SpellHanDigits(y, digits);
        var outp = s;
        if (d.RangeWord != null)
        {
            // ⚠ FIRST: only the RIGHT endpoint sees 年, so left alone this span gets two different readings.
            outp = JsRegex.Compile($"(?<![\\d.,])(\\d{{4}})\\s*[{dash}]\\s*(\\d{{4}})(?![\\d.,])(?=\\s*年)", "gu")
                .Replace(outp, m => $"{Spell(m.Groups[1].Value)}{d.RangeWord}{Spell(m.Groups[2].Value)}");
            // ⚠ SECOND, AND STILL BEFORE THE SINGLE-YEAR RULE: `1996年-2007年` spells both correctly either way,
            // but after the single rule the endpoints are Han and no digit pattern can reach the dash.
            outp = JsRegex.Compile($"(?<![\\d.,])(\\d{{4}})\\s*年\\s*[{dash}]\\s*(?=\\d{{4}}\\s*年)", "gu")
                .Replace(outp, m => $"{Spell(m.Groups[1].Value)}年{d.RangeWord}");
        }
        // ⚠ THE 年 IS FOUND ACROSS WHITESPACE — `2009 年` is ordinary, and missing that silently defeated cmn.
        // ⚠ 3-DIGIT YEARS ARE NOT CLAIMED: most short `N年` forms are DURATIONS (`48年歷史`) and nothing in the
        // surface form separates them from a short year. That refusal is the fleet's, from the yue layer.
        return JsRegex.Compile(@"(?<![\d.,:])(\d{4})(?![\d.,])(?=\s*年)", "gu")
            .Replace(outp, m => Spell(m.Groups[1].Value));
    }

    /**
     * THE FRACTION, IN THE CHINESE ORDER — `a/b` is `b分之a`, "of b parts, a".
     *
     * ⚠ FOUR DIGITS ON BOTH SIDES IS A YEAR PAIR, NOT A FRACTION, and this guard is the whole reason the rule
     * is shared rather than copied. `2020/2021` is an academic year; jv met it as `taun 1985/1986`, nan's rule
     * was REMOVED when its only instance was `Fahrenheit 9/11`, and cjy hit it in review. Three corpora.
     *
     * ⚠ AND A LATIN LETTER IMMEDIATELY BEFORE THE NUMERATOR MEANS IT IS A CODE. Found by hak, the first language
     * built ON this module: hak.wikipedia's rolling-stock articles write train-set numbers as `A/C/B351/352`,
     * `A/C/B359/360`, `SP1900/1950`, and the digit-only lookbehind let every one of them through — `A/C/B351/352`
     * read *…352分之351*, "351 over 352". Nothing legitimate is written with a fraction fused to a letter; a real
     * one has a space or a Han character before it (`Fahrenheit 9/11`, `即1/1000`), so the guard costs nothing.
     * Verified byte-identical over the cmn, yue, wuu, nan and cjy corpora.
     */
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
     * 六點三十四. The integer part stays ASCII so the engine's own cardinal path reads it.
     *
     * ⚠ `(?!\.\d)` KEEPS A DOTTED DESIGNATION OUT — `1.2.3` and `802.11n` share the decimal's shape. Earned in
     * the jv layer (`nomer 1.2.3` read *siji koma loro . telu*) and carried by nan and cjy.
     * ⚠ THE FRACTION IS CAPPED AT 3 DIGITS, which also keeps a DOI (`10.1016`) out.
     */
    public static string ReadDecimals(string s, string decimalWord, IReadOnlyList<string>? digits = null)
    {
        digits ??= HAN_DIGITS;
        return JsRegex.Compile(@"(?<![\d.,])(\d+)\.(\d{1,3})(?![\d,])(?!\.\d)", "gu").Replace(s,
            m => $"{m.Groups[1].Value}{decimalWord}{SpellHanDigits(m.Groups[2].Value, digits)}");
    }

    /**
     * TEMPERATURE THEN BARE DEGREE, in that order — and the order is load-bearing: run the bare rule first and
     * it eats the ° and leaves a lone ⟨C⟩ to be read as an ENGLISH LETTER NAME, which is exactly what `20°C` did
     * in three layers before it was fixed in each.
     *
     * ⚠ `\s*`, NEVER `\s?`. Cantonese shipped `\s?` and `20  °C` lost its unit there and nowhere else. Two
     * spaces is ordinary typography.
     * ⚠ THE GUARD IS `\p{sc=Latn}`, NOT `\p{L}` — a HAN CHARACTER IS `\p{L}`, so `溫度10°C到2°C` failed the
     * guard in nan and fused the degree word onto the stranded ⟨C⟩. Found only by probing in Han running text.
     *
     * ⚠ THE NUMBER INCLUDES ITS DECIMAL PART, AND OMITTING THAT WAS A SHIPPED BUG IN EVERY PREPOSING LANGUAGE.
     * The pattern used to capture `(\d+)`, which on `13.3 °C` matches only the `3` — so the scale word was
     * inserted INTO the number: yue and nan both read `13.3°C` as `13.` + 攝氏三度, the integer part orphaned in
     * front of a raw stop and the temperature off by a factor of four. wuu was accidentally immune because it
     * POSTposes Celsius (`13.3摄氏度` keeps the digits contiguous), which is exactly why four layers could carry
     * this and no test see it — the defect is invisible from the one language that happens to put the word on
     * the other side. Found by hak, whose corpus writes `13.3 °C` and `34.2 °C` and which preposes.
     * ⚠ The decimal part is OPTIONAL and the integer arm is unchanged, so `20°C` behaves exactly as before.
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

/** Word data for the year rules. `rangeWord` omitted ⇒ the range arms are skipped, single years still spell. */
public sealed class YearRuleData
{
    /** The range connective — 到 (yue/wuu/cjy), 至, kàu. Omit to decline ranges. */
    public string? RangeWord { get; init; }
    /** Han digit table, if the language does not use the default. */
    public IReadOnlyList<string>? Digits { get; init; }
    /** Dash characters that count as a range. Defaults to the four the Han corpora write. */
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
