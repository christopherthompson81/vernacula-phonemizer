/**
 * Mandarin (cmn) TEXT NORMALIZATION — the pre-tokenizer pass for what is left after the engine's own
 * number handling and the shared symbol tier. Pure text→text; no IPA.
 *
 * This file is DELIBERATELY SMALL, and that is the finding rather than an omission. Mandarin already had
 * more of this tier than any other language audited: years read digit-by-digit (2009年 → 二零零九年, which
 * is right and is NOT the cardinal reading), full dates compose correctly (2011年3月14日), centuries take
 * the cardinal (20世纪), 点/分 clock readings work, 第N ordinals work, 百分之 is emitted as a PREFIX by the
 * shared symbol tier, full-width punctuation is already a clause mark, and embedded Latin runs are
 * delegated to English — which is the right reading for UTC / NBA / GPS as Chinese speakers say them.
 *
 * The defects the audit did find were in the ENGINE, not here, and are fixed in mandarin.ts:
 *   · the "following character" test for the year rule and the 两 rule did not skip whitespace, and the
 *     corpus writes "2009 年" and "2 个人" WITH a space — so all 272 years were read as cardinals;
 *   · the number pattern did not accept comma grouping, so "783,562" became two numbers and a pause;
 *   · currency signs were dropped outright and °C fell through to the English letter name.
 *
 * What genuinely needs a rewrite here is the FRACTION, because Chinese states it in the opposite order
 * from the western notation: 1/5 is 五分之一, "of five parts, one". Emitting the reordered form as DIGITS
 * lets the engine's own numeral substitution do the reading.
 *
 * ── THE SIGN CLASSES ────────────────────────────────────────────────────────────────────────────
 *
 * ⚠ AN UNCLAIMED MATH SIGN IS DROPPED, NOT MISREAD, which is what makes it dangerous: `-5 度` reads as
 * 五度, **positive** five degrees, so a below-freezing temperature is silently reported as above it. A
 * dropped sign is invisible to every check that looks for a wrong reading.
 *
 * EVERY WORD BELOW IS ATTESTED IN ITS OWN NOTATION SLOT, from zh.wikipedia via
 * `tools/normalization/attest.ts` (cached in `tools/corpus/attest/cmn.jsonc`) and, for 乘以 and 平方, from
 * the FLEURS artifact itself. The attestations are quoted because the sense is the whole question — 加 and
 * 加上 both mean "plus" in a dictionary and only one of them is the operator:
 *
 *   =  等于    "任何数字与1相乘皆等于其本身"  ·  "一加一不等於二"
 *   <  小于    "呼吸频率（RR）小于每分钟30次"
 *   >  大于    "a > b ，即 a 大于 b"          — the article glosses the notation directly
 *   ×  乘以    "29¾ 英寸乘以 24½ 英寸" (cmn.jsonc)  ·  "0乘以任何实数都等于0（0×10=0）"
 *   ÷  除以    "總人口數除以總面積"
 *   +  加      "1+1是一個數學算式 … 1+1或一加一也可能指" — Wikipedia's own gloss OF `1+1`
 *   ±  正负    "直流正负800千伏" — a ±800 kV rating, the sign in a unit context
 *   -  负      "0非正非负" · "0的负数次方" — the negative-number morpheme
 *   -  零下    "经过零下40度高寒地带" — a −40° zone, and the reason temperature gets its OWN rule
 *
 * 加上 was the first candidate for `+`, on a wiki gloss of `1+0=1`. It is the wrong word: its own
 * attestations are the CONJUNCTION sense ("加上海外市場後" — "plus the overseas market, …"), and the
 * disambiguation page for `1+1` names the arithmetic reading 一加一. Availability is not correctness.
 */

/**
 * Western fraction notation → the Chinese order, still in digits: `a/b` → `b分之a`. Guarded against dates
 * and unit ratios by requiring digits on both sides and nothing numeric adjacent. `\b` is unusable here —
 * it is defined on ASCII word characters and finds no boundary against Han script — so the boundaries are
 * explicit lookarounds, the same discipline the Hindi pass needed.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Mandarin;

public static class Normalize
{
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d.,/])(\\d{1,4})\\/(\\d{1,4})(?![\\d/])", "gu");

    /**
     * THE TWO LEFT GUARDS, and why they differ — measured, not reasoned. Chinese is written WITHOUT SPACES,
     * so the character before a negative is normally a Han letter — but THE CORPUS writes the aircraft as
     * 伊尔-76 with a Han letter before the hyphen, so the relaxed guard read it as 伊尔负76. The
     * discrimination that survives is one of RIGHT context: the temperature rule can afford the loose guard
     * because a DEGREE WORD follows it, and 伊尔-76 has none.
     */
    private const string SIGN = "[-−–]";
    private const string NEG_LEFT_STRICT = "(?<![\\p{L}\\p{Nd}-])";
    private const string NEG_LEFT_LOOSE = "(?<![\\p{Nd}\\p{sc=Latn}-])";

    /** TEMPERATURE first: before a degree word Chinese says 零下 ("below zero"), not 负. `°C` is still `°C`
     *  here — the shared symbol tier turns it into 摄氏度 after this layer runs. */
    private static readonly JsRe BELOW_ZERO = JsRegex.Compile(
        $"{NEG_LEFT_LOOSE}{SIGN}(\\d+(?:[.,]\\d+)?)(?=\\s*(?:°|℃|℉|度))", "gu");
    private static readonly JsRe NEGATIVE = JsRegex.Compile($"{NEG_LEFT_STRICT}{SIGN}(?=\\d)", "gu");

    /** Sign → word, applied in order. `±` is its own code point, so it cannot be reached by the `+` arm. */
    private static readonly (JsRe Re, string Word)[] SIGNS =
    {
        (JsRegex.Compile("±\\s?", "gu"), "正负"),
        (JsRegex.Compile("\\s?×\\s?", "gu"), "乘以"),
        (JsRegex.Compile("\\s?÷\\s?", "gu"), "除以"),
        (JsRegex.Compile("\\s?=\\s?", "gu"), "等于"),
        (JsRegex.Compile("\\s?<\\s?", "gu"), "小于"),
        (JsRegex.Compile("\\s?>\\s?", "gu"), "大于"),
        // Both the spaced form and the attached one (`UTC+1` → UTC加1), matching the English rule's coverage.
        (JsRegex.Compile("\\s?\\+\\s?", "gu"), "加"),
    };

    /**
     * THE AMPERSAND. Between LATIN letters it stays inside the Latin run and is spelled ` and `, because the
     * whole token is an English term the engine already delegates to English: reading half of `B&B` in
     * Mandarin would be a code-switch in the middle of a word. Elsewhere it becomes 和.
     */
    private static readonly JsRe AMP_LATIN = JsRegex.Compile("(?<=[A-Za-z])\\s?[&＆]\\s?(?=[A-Za-z])", "gu");
    private static readonly JsRe AMP_ELSEWHERE = JsRegex.Compile("\\s?[&＆]\\s?", "gu");

    /**
     * A BARE exponent — `5³`, no unit — becomes 的立方, the same measure word the unit case uses.
     * Requires a DIGIT before the exponent, which is what keeps it off `km²`.
     * ⚠ 的2次方 WAS THE FIRST ATTEMPT: emitting the exponent as a DIGIT walked into the engine's own 两 rule
     * (`5²` read as 五的两次方). Writing 平方/立方 puts the reading beyond reach of any numeral rule.
     */
    private static readonly JsRe BARE_EXPONENT = JsRegex.Compile("(?<=\\d)([²³])", "gu");
    private static readonly IReadOnlyDictionary<string, string> POWER = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["²"] = "平方", ["³"] = "立方",
    };

    /**
     * LATIN LETTER NAMES, as Han the Hanzi→pinyin front end can read. WHAT A MANDARIN SPEAKER SAYS is the
     * ENGLISH letter NAME in MANDARIN phonology (espeak-ng's own cmn_list carries the block). The fix is
     * ORTHOGRAPHIC: spell the name in Han and let the existing pipeline read it (playbook trap 6).
     * ⚠ UNLIKE WU, THE CONVENTIONAL CHINESE TRANSLITERATION IS CORRECT HERE UNCHANGED — the convention was
     * built FOR Mandarin. VALIDATED against espeak's letter phonetics via chars.tsv pinyin: 20 of 26 agree.
     */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAMES = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["A"] = "诶", ["B"] = "比", ["C"] = "西", ["D"] = "迪", ["E"] = "伊", ["F"] = "艾弗", ["G"] = "吉",
        ["H"] = "艾尺", ["I"] = "艾", ["J"] = "杰", ["K"] = "开", ["L"] = "艾勒", ["M"] = "艾姆", ["N"] = "恩",
        ["O"] = "欧", ["P"] = "皮", ["Q"] = "丘", ["R"] = "阿儿", ["S"] = "艾丝", ["T"] = "提", ["U"] = "优",
        ["V"] = "维", ["W"] = "大布留", ["X"] = "艾克斯", ["Y"] = "歪", ["Z"] = "兹",
    };

    /** Spell a Latin run as its letter names, space-separated. See the two guards at the call sites. */
    private static string SpellLetters(string run) =>
        $" {string.Join(" ", Js.CodePoints(run).Select(c => LETTER_NAMES.TryGetValue(c, out var n) ? n : c))} ";

    public static string NormalizeMandarin(string input)
    {
        var s = input;
        // 1) FRACTION — the reordering the western notation needs.
        s = FRACTION.Replace(s, m => $"{m.Groups[2].Value}分之{m.Groups[1].Value}");
        // 2) NEGATIVES, temperature before the general case so 零下 wins where it applies.
        s = BELOW_ZERO.Replace(s, "零下$1");
        s = NEGATIVE.Replace(s, "负");
        // 3) The remaining signs.
        foreach (var (re, word) in SIGNS) s = re.Replace(s, word);
        // 3b) The ampersand, Latin-internal arm first so the general arm cannot claim it.
        s = AMP_LATIN.Replace(s, " and ");
        s = AMP_ELSEWHERE.Replace(s, "和");
        // 4) A bare exponent, after the signs so nothing above can strand it.
        s = BARE_EXPONENT.Replace(s, m => $"的{POWER[m.Groups[1].Value]}");
        return s;
    }

    private static readonly JsRe CAPS_RUN = JsRegex.Compile("(?<![\\p{sc=Latn}\\d])[A-Z]{2,3}(?![\\p{sc=Latn}\\d])", "gu");
    private static readonly JsRe ROMAN = JsRegex.Compile("^[IVX]{2,3}$", "u");
    private static readonly JsRe LONE_UPPER = JsRegex.Compile(
        "(?<=\\p{Script=Han})([A-Z])(?![\\p{sc=Latn}\\d])|(?<![\\p{sc=Latn}\\d])([A-Z])(?=\\p{Script=Han})", "gu");

    /**
     * INITIALISMS → their letter names, spelled in Han.
     * ⚠ A SEPARATE PASS, AND IT MUST RUN AFTER THE SHARED SYMBOL TIER — the tier reads the SCALE LETTER of a
     * temperature: run first, this pass rewrote the ⟨C⟩ of `20°C` to 西 and the tier could no longer see the
     * unit at all. ⚠ THE WINDOW IS 2–3 LETTERS, NARROWED FROM 2–4 BY MEASUREMENT: at four letters this corpus
     * is 9 of 16 tokens ENGLISH WORDS (FIFA ×7). The letters are SPACE-SEPARATED because the front end
     * segments Han by greedy longest match: run together, 西欧 (CO) is "Western Europe".
     */
    public static string SpellInitialisms(string input)
    {
        var s = CAPS_RUN.Replace(input, m => ROMAN.IsMatch(m.Value) ? m.Value : SpellLetters(m.Value));
        // A LONE uppercase letter, only where it touches Han — `X光`, `A股`, `T恤` are letter-read, while a
        // bare single letter in Latin context is a math variable or a chemical symbol.
        s = LONE_UPPER.Replace(s, m =>
        {
            var L = m.Groups[1].Success && m.Groups[1].Value.Length > 0 ? m.Groups[1].Value : m.Groups[2].Value;
            return LETTER_NAMES.TryGetValue(L, out var name) ? $" {name} " : m.Value;
        });
        return s;
    }
}
