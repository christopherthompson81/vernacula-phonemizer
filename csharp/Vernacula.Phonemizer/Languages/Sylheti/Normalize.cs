/**
 * Sylheti / ꠍꠤꠟꠐꠤ ꠘꠣꠉꠞꠤ (syl) text normalization — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/sylheti/normalize.ts — see that file for the corpus evidence, the sourcing of
 * every word this layer inserts, and the tiers it declines.
 */
using System.Globalization;
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sylheti;

public static class Normalize
{
    /** Syloti Nagri LETTERS and signs — U+A800–A827 plus U+A82C (alternate hasanta). */
    private const string SYL = "\\u{A800}-\\u{A827}\\u{A82C}";
    /** A Syloti Nagri letter, as a bare class for use in lookarounds. */
    private const string S = "[" + SYL + "]";

    private static readonly IReadOnlyDictionary<string, string> BN_TO_SYL = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        // marks Syloti Nagri does not have
        ["়"] = "", ["ঁ"] = "", ["ঃ"] = "",
        ["ং"] = "ꠋ", ["্"] = "꠆", ["ৎ"] = "ꠔ꠆",
        ["ৃ"] = "ꠞꠤ", ["ঋ"] = "ꠞꠤ",
        // dependent vowel signs
        ["া"] = "ꠣ", ["ি"] = "ꠤ", ["ী"] = "ꠤ", ["ু"] = "ꠥ", ["ূ"] = "ꠥ",
        ["ে"] = "ꠦ", ["ৈ"] = "ꠂ", ["ো"] = "ꠧ", ["ৌ"] = "ꠧ",
        // independent vowels
        ["অ"] = "ꠅ", ["আ"] = "ꠀ", ["ই"] = "ꠁ", ["ঈ"] = "ꠁ", ["উ"] = "ꠃ",
        ["ঊ"] = "ꠃ", ["এ"] = "ꠄ", ["ঐ"] = "ꠂ", ["ও"] = "ꠅ", ["ঔ"] = "ꠅ",
        // consonants
        ["ক"] = "ꠇ", ["খ"] = "ꠈ", ["গ"] = "ꠉ", ["ঘ"] = "ꠊ", ["ঙ"] = "ꠋ",
        ["চ"] = "ꠌ", ["ছ"] = "ꠍ", ["জ"] = "ꠎ", ["ঝ"] = "ꠏ", ["ঞ"] = "ꠘ",
        ["ট"] = "ꠐ", ["ঠ"] = "ꠑ", ["ড"] = "ꠒ", ["ঢ"] = "ꠓ", ["ণ"] = "ꠘ",
        ["ত"] = "ꠔ", ["থ"] = "ꠕ", ["দ"] = "ꠖ", ["ধ"] = "ꠗ", ["ন"] = "ꠘ",
        ["প"] = "ꠙ", ["ফ"] = "ꠚ", ["ব"] = "ꠛ", ["ভ"] = "ꠜ", ["ম"] = "ꠝ",
        ["য"] = "ꠎ", ["র"] = "ꠞ", ["ল"] = "ꠟ", ["শ"] = "ꠡ", ["ষ"] = "ꠡ",
        ["স"] = "ꠡ", ["হ"] = "ꠢ", ["ড়"] = "ꠠ", ["ঢ়"] = "ꠠ", ["য়"] = "ꠄ",
    };

    /** Bengali-Assamese LETTERS AND MARKS ONLY — U+0980–09E5 plus ৰ ৱ, never the digits or the taka sign. */
    private const string BN_LETTER = "\\u0980-\\u09E5\\u09F0\\u09F1";
    private static readonly JsRe MIXED_RUN = JsRegex.Compile($"[{SYL}{BN_LETTER}]+", "gu");
    private static readonly JsRe HAS_SYL = JsRegex.Compile(S, "u");
    private static readonly JsRe HAS_BN = JsRegex.Compile($"[{BN_LETTER}]", "u");
    private static readonly JsRe YA_NUKTA = JsRegex.Compile("(?:ꠎ|\\u09AF)\\u09BC([ꠣꠤꠥꠦꠧ]?)", "gu");
    private static readonly IReadOnlyDictionary<string, string> INDEPENDENT = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ꠣ"] = "ꠀ", ["ꠤ"] = "ꠁ", ["ꠥ"] = "ꠃ", ["ꠦ"] = "ꠄ", ["ꠧ"] = "ꠅ", [""] = "",
    };

    /** Format/zero-width characters that split a Syloti token in two. */
    private static readonly JsRe ZERO_WIDTH =
        JsRegex.Compile("[\\u200B\\u200C\\u200D\\u200E\\u200F\\u2060\\uFEFF]", "gu");

    /** A number, possibly with a decimal point, anchored to END in a digit (never eating a clause comma). */
    private const string NUM = "\\p{Nd}(?:[\\p{Nd}.]*\\p{Nd})?";
    /** Bengali → ASCII digit value, for the range rule's comparison only. */
    private const string BN_DIGITS = "০১২৩৪৫৬৭৮৯";

    private static double NumValue(string s) => Js.Number(string.Concat(Js.CodePoints(s).Select(c =>
    {
        var at = BN_DIGITS.IndexOf(c, StringComparison.Ordinal);
        return at >= 0 ? at.ToString(CultureInfo.InvariantCulture) : c;
    })));

    private const string DECIMAL_WORD = "ꠖꠡꠝꠤꠇ";
    private const string PERCENT_WORD = "ꠡꠔꠣꠋꠡ";
    private const string CURRENCY_WORD = "ꠐꠦꠈꠣ";
    private const string DEGREE_WORD = "ꠒꠤꠉ꠆ꠞꠤ";
    private const string RANGE_WORD = "ꠔꠘꠦ";
    /** The degree SCALE abbreviations the corpus writes, with the full form it writes them beside. */
    private static readonly IReadOnlyDictionary<string, string> SCALE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ꠍꠦ"] = "ꠍꠦꠟꠍꠤꠀꠍ", ["ꠚꠣ"] = "ꠚꠣꠞꠦꠘꠢꠣꠁꠐ",
    };

    /** Fold the Bengali-Assamese characters of a MIXED token into Syloti Nagri. The "a Syloti neighbour in
     *  the same run" guard is the whole rule — see the TS. */
    private static string FoldStrayBengali(string s) => MIXED_RUN.Replace(s, m =>
    {
        var run = m.Value;
        if (!(HAS_SYL.IsMatch(run) && HAS_BN.IsMatch(run))) return run;
        var carrier = YA_NUKTA.Replace(run, mm => INDEPENDENT.TryGetValue(mm.Groups[1].Value, out var v) ? v : "");
        return string.Concat(Js.CodePoints(carrier).Select(c => BN_TO_SYL.TryGetValue(c, out var t) ? t : c));
    });

    private static readonly JsRe DOTTED_ABBREV = JsRegex.Compile($"(?:{S}+\\.)+{S}+\\.?", "gu");
    private static readonly JsRe DOT_G = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile("(\\p{Nd})(?<!(?<!\\p{Nd})0),(?=\\p{Nd}{2,3}(?!\\p{Nd}))", "gu");
    private static readonly JsRe RANGE =
        JsRegex.Compile($"(?<![\\p{{Nd}}.,])({NUM})\\s*[-–—]\\s*({NUM})(?![\\p{{Nd}}.,])", "gu");
    private static readonly JsRe DEGREE_NATIVE = JsRegex.Compile($"(\\p{{Nd}})\\s*°\\s*(ꠍꠦ|ꠚꠣ)\\.?(?!{S})", "gu");
    private static readonly JsRe DEGREE_LATIN = JsRegex.Compile("(\\p{Nd})\\s*°\\s*([CF])(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEGREE_BARE = JsRegex.Compile("(\\p{Nd})\\s*°", "gu");
    private static readonly JsRe DECIMAL =
        JsRegex.Compile("(?<!\\.\\p{Nd}*)(\\p{Nd})\\.(?=\\p{Nd})(?!\\p{Nd}*[./])", "gu");
    private static readonly JsRe PERCENT_NUM = JsRegex.Compile("(\\p{Nd})\\s*%", "gu");
    private static readonly JsRe PERCENT_BARE = JsRegex.Compile("%", "gu");
    private static readonly JsRe TAKA_NUM = JsRegex.Compile("৳\\s*(\\p{Nd}+)(?![^\\p{Nd}]{0,3}ꠐꠦꠈꠣ)", "gu");
    private static readonly JsRe TAKA_NUM_REDUNDANT = JsRegex.Compile("৳\\s*(\\p{Nd}+)", "gu");
    private static readonly JsRe TAKA_BARE = JsRegex.Compile("৳(?![^\\p{Nd}]{0,3}ꠐꠦꠈꠣ)", "gu");
    private static readonly JsRe TAKA_DROP = JsRegex.Compile("৳", "gu");

    /** Sylheti text → text the tokenizer can read. The step order and its couplings are stated in the TS. */
    public static string NormalizeSylheti(string input)
    {
        var s = input.Normalize(NormalizationForm.FormC);
        s = ZERO_WIDTH.Replace(s, "");
        s = FoldStrayBengali(s);
        s = DOTTED_ABBREV.Replace(s, m => DOT_G.Replace(m.Value, ""));
        for (var prev = ""; prev != s;)
        {
            prev = s;
            s = GROUP_COMMA.Replace(s, "$1");
        }
        s = RANGE.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return NumValue(b) > NumValue(a) ? $"{a} {RANGE_WORD} {b}" : m.Value;
        });
        s = DEGREE_NATIVE.Replace(s, m =>
            $"{m.Groups[1].Value} {DEGREE_WORD} {SCALE[m.Groups[2].Value.ToUpperInvariant()]}");
        s = DEGREE_LATIN.Replace(s, m =>
            $"{m.Groups[1].Value} {DEGREE_WORD} {(m.Groups[2].Value.ToUpperInvariant() == "C" ? SCALE["ꠍꠦ"] : SCALE["ꠚꠣ"])}");
        s = DEGREE_BARE.Replace(s, $"$1 {DEGREE_WORD}");
        s = DECIMAL.Replace(s, $"$1 {DECIMAL_WORD} ");
        s = PERCENT_NUM.Replace(s, $"$1 {PERCENT_WORD}");
        s = PERCENT_BARE.Replace(s, $" {PERCENT_WORD} ");
        s = TAKA_NUM.Replace(s, $"$1 {CURRENCY_WORD}");
        s = TAKA_NUM_REDUNDANT.Replace(s, "$1");
        s = TAKA_BARE.Replace(s, $" {CURRENCY_WORD} ");
        s = TAKA_DROP.Replace(s, "");
        return s;
    }
}
