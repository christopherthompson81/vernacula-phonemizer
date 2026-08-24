/**
 * Mandarin (cmn) TEXT NORMALIZATION — the pre-tokenizer pass for what is left after the engine's own number
 * handling and the shared symbol tier.
 * Ported from src/languages/mandarin/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Mandarin;

public static class Normalize
{
    /**
     * Western fraction notation → the Chinese order, still in digits: `a/b` → `b分之a`. `\b` is unusable in
     * these patterns — it is defined on ASCII word characters and finds no boundary against Han — so the
     * boundaries are explicit lookarounds throughout this file.
     */
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d.,/])(\\d{1,4})\\/(\\d{1,4})(?![\\d/])", "gu");

    /**
     * The two left guards differ ON PURPOSE, and must not be unified: the temperature rule can afford the
     * loose guard because a degree word follows it, while the general negative needs the strict one or a
     * Han letter before a hyphen (a model name like 伊尔-76) is read as a minus sign.
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
        (JsRegex.Compile("\\s?\\+\\s?", "gu"), "加"),
    };

    /**
     * The ampersand. Between Latin letters it stays inside the Latin run and is spelled " and ", because
     * the whole token is delegated to English; elsewhere it becomes 和.
     */
    private static readonly JsRe AMP_LATIN = JsRegex.Compile("(?<=[A-Za-z])\\s?[&＆]\\s?(?=[A-Za-z])", "gu");
    private static readonly JsRe AMP_ELSEWHERE = JsRegex.Compile("\\s?[&＆]\\s?", "gu");

    /**
     * A BARE exponent — `5³`, no unit — becomes 的立方, the same measure word the unit case uses. Requires a
     * digit before the exponent, which keeps it off `km²`. The power is written 平方/立方 rather than as a
     * digit on purpose: a digit here would be claimed by the engine's own 两 rule (`5²` → 五的两次方).
     */
    private static readonly JsRe BARE_EXPONENT = JsRegex.Compile("(?<=\\d)([²³])", "gu");
    private static readonly IReadOnlyDictionary<string, string> POWER = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["²"] = "平方", ["³"] = "立方",
    };

    /** LATIN LETTER NAMES, as Han the Hanzi→pinyin front end can read. */
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
        s = FRACTION.Replace(s, m => $"{m.Groups[2].Value}分之{m.Groups[1].Value}");
        // Temperature before the general negative, so 零下 wins where it applies.
        s = BELOW_ZERO.Replace(s, "零下$1");
        s = NEGATIVE.Replace(s, "负");
        foreach (var (re, word) in SIGNS) s = re.Replace(s, word);
        // Latin-internal ampersand first, or the general arm claims it.
        s = AMP_LATIN.Replace(s, " and ");
        s = AMP_ELSEWHERE.Replace(s, "和");
        // After the signs, or one of them strands the exponent.
        s = BARE_EXPONENT.Replace(s, m => $"的{POWER[m.Groups[1].Value]}");
        return s;
    }

    private static readonly JsRe CAPS_RUN = JsRegex.Compile("(?<![\\p{sc=Latn}\\d])[A-Z]{2,3}(?![\\p{sc=Latn}\\d])", "gu");
    private static readonly JsRe ROMAN = JsRegex.Compile("^[IVX]{2,3}$", "u");
    private static readonly JsRe LONE_UPPER = JsRegex.Compile(
        "(?<=\\p{Script=Han})([A-Z])(?![\\p{sc=Latn}\\d])|(?<![\\p{sc=Latn}\\d])([A-Z])(?=\\p{Script=Han})", "gu");

    /**
     * Initialisms → their letter names, spelled in Han. A separate pass that MUST RUN AFTER the shared
     * symbol tier: run first, it rewrites the ⟨C⟩ of `20°C` to 西 and the tier can no longer see the unit.
     * The letters are space-separated because the Han front end segments by greedy longest match.
     */
    public static string SpellInitialisms(string input)
    {
        var s = CAPS_RUN.Replace(input, m => ROMAN.IsMatch(m.Value) ? m.Value : SpellLetters(m.Value));
        s = LONE_UPPER.Replace(s, m =>
        {
            var L = m.Groups[1].Success && m.Groups[1].Value.Length > 0 ? m.Groups[1].Value : m.Groups[2].Value;
            return LETTER_NAMES.TryGetValue(L, out var name) ? $" {name} " : m.Value;
        });
        return s;
    }
}
