using System.Globalization;
/**
 * Bengali (bn) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks.
 * Ported from src/languages/bengali/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bengali;

public static class Normalize
{
    private static readonly string BN_DIGIT = string.Concat(Unicode.BENGALI_DIGITS.Keys);
    /** Either digit system. */
    private static readonly string D = $"0-9{BN_DIGIT}";

    /** Fold Bengali digits to ASCII so a value can be computed from either script. */
    private static string ToAscii(string s) =>
        string.Concat(Js.CodePoints(s).Select(c => Unicode.BENGALI_DIGITS.GetValueOrDefault(c, c)));

    /**
     * DATE ordinal suffixes (শে, ই) plus the general তম. 1–4 are suppletive in the date series; everything
     * else is the cardinal with the suffix JOINED to its final word.
     */
    private static readonly IReadOnlyDictionary<int, string> DATE_SUPPLETIVE = new Dictionary<int, string>
    {
        [1] = "পহেলা", [2] = "দোসরা", [3] = "তেসরা", [4] = "চৌঠা",
    };

    /** The suppletive 1–10 series, from the manifest — see the jsonc for why it stops at ten. */
    private static IReadOnlyDictionary<string, string> ORDINAL_SUPPLETIVE => Bengali.DEF.Ordinals.Suppletive;

    /** Suffixes that mark the classical series rather than the date series. */
    private static readonly IReadOnlySet<string> CLASSICAL_SUFFIX =
        new HashSet<string>(new[] { "ম", "য়", "র্থ", "ষ্ঠ", "তম" }, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> DATE_SUFFIX =
        new HashSet<string>(new[] { "শে", "ই", "লা", "রা", "ঠা" }, StringComparer.Ordinal);
    /** Read from the manifest — LONGEST FIRST, and the order is load-bearing (see the jsonc). */
    private static IReadOnlyList<string> ORDINAL_SUFFIX => Bengali.DEF.Ordinals.Suffixes;

    /** Bengali unit abbreviations → the full word. The shared symbol tier is keyed on the Latin forms. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["কিমি"] = "কিলোমিটার", ["কিমি/ঘন্টা"] = "কিলোমিটার প্রতি ঘন্টা", ["সেমি"] = "সেন্টিমিটার",
        ["মিমি"] = "মিলিমিটার", ["কেজি"] = "কিলোগ্রাম", ["গ্রা"] = "গ্রাম", ["মি"] = "মিটার",
    };
    private static readonly string UNIT_ALT = string.Join("|", UNIT_WORD.Keys.OrderByDescending(k => k.Length));

    /** Abbreviations. ডঃ writes a VISARGA rather than a dot, which is not punctuation and so was reading its
     *  visarga as a syllable ([ɖɔh]) and ড. was leaving a phrase break. */
    private static readonly IReadOnlyDictionary<string, string> ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ড"] = "ডক্টর", ["অধ্যা"] = "অধ্যায়", ["পৃ"] = "পৃষ্ঠা", ["সং"] = "সংখ্যা",
    };
    private static readonly string ABBREV_ALT = string.Join("|", ABBREV.Keys.OrderByDescending(k => k.Length));

    private static readonly JsRe ABBREV_RE = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({ABBREV_ALT})[ঃ.]\\s*(?=[\\p{{L}}])", "gu");
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile(
        $"(?<![{D}.,])([{D}]+)\\s?({string.Join("|", ORDINAL_SUFFIX)})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe UNIT_RE = JsRegex.Compile($"([{D}])\\s?({UNIT_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile($"([{D}])\\s?°\\s?C(?![\\p{{L}}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile($"([{D}])\\s?°\\s?F(?![\\p{{L}}])", "giu");
    private static readonly JsRe DEG = JsRegex.Compile($"([{D}])\\s?°", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile($"(?<![{D}:])([{D}]{{1,2}}):([{D}]{{2}})(?![{D}:])(\\s*টা)?", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile($"(^|[\\s(])[-−–]([{D}])", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile($"(\\S)\\+\\s?([{D}])", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile($"(^|\\s)\\+\\s?([{D}])", "gu");
    private static readonly JsRe EQUALS_RE = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile($"(?<![{D}.,/])([{D}]{{1,3}})/([{D}]{{1,3}})(?![{D}/])", "gu");

    /** Build the Bengali normalizer. Takes the numbers definition so ordinals and fractions can compose the
     *  same cardinal words the engine's own number path uses. */
    public static Func<string, string> MakeBengaliNormalizer(NumbersDef numbers)
    {
        string Cardinal(double n) =>
            string.Join(" ", Numbers.indicNumberWords(n, numbers).Select(w => w ?? ""));

        string? Ordinal(double n, string suffix)
        {
            var key = (int)n;
            if (DATE_SUFFIX.Contains(suffix) && DATE_SUPPLETIVE.TryGetValue(key, out var dateForm)) return dateForm;
            if (CLASSICAL_SUFFIX.Contains(suffix) && ORDINAL_SUPPLETIVE.TryGetValue(key.ToString(CultureInfo.InvariantCulture), out var classical)) return classical;
            var words = Cardinal(n).Split(' ');
            if (words.Any(w => w == "")) return null;
            words[^1] = $"{words[^1]}{suffix}";
            return string.Join(" ", words);
        }

        return input =>
        {
            var s = string.Concat(Js.CodePoints(input).Select(c => Unicode.BENGALI_DIGITS.GetValueOrDefault(c, c)));

            s = ABBREV_RE.Replace(s, m => $"{ABBREV[m.Groups[1].Value]} ");

            s = ORDINAL_RE.Replace(s, m =>
                Ordinal(Js.Number(ToAscii(m.Groups[1].Value)), m.Groups[2].Value) ?? m.Value);

            s = UNIT_RE.Replace(s, m => $"{m.Groups[1].Value} {UNIT_WORD[m.Groups[2].Value]}");

            s = DEG_C.Replace(s, "$1 ডিগ্রি সেলসিয়াস");
            s = DEG_F.Replace(s, "$1 ডিগ্রি ফারেনহাইট");
            s = DEG.Replace(s, "$1 ডিগ্রি");

            s = CLOCK.Replace(s, m =>
            {
                var hv = Js.Number(ToAscii(m.Groups[1].Value));
                var mv = Js.Number(ToAscii(m.Groups[2].Value));
                if (hv > 23 || mv > 59) return m.Value;
                var ta = m.Groups[3].Success ? m.Groups[3].Value : null;
                if (mv == 0) return $"{Cardinal(hv)}{ta ?? "টা"}";
                return $"{Cardinal(hv)}টা {Cardinal(mv)} মিনিট";
            });

            s = MINUS.Replace(s, "$1ঋণাত্মক $2");
            s = PLUS_ATTACHED.Replace(s, "$1 যোগ $2");
            s = PLUS_LEADING.Replace(s, "$1যোগ $2");

            s = PostposedSignPass.PostposedSign(s, "<", "থেকে কম");
            s = PostposedSignPass.PostposedSign(s, ">", "থেকে বেশি");
            s = EQUALS_RE.Replace(s, " সমান ");
            s = DIVIDE.Replace(s, " ভাগ ");

            s = FRACTION.Replace(s, m =>
            {
                var num = Js.Number(ToAscii(m.Groups[1].Value));
                var den = Js.Number(ToAscii(m.Groups[2].Value));
                if (num == 1 && den == 2) return "অর্ধেক";
                var nw = Cardinal(num);
                var dw = Cardinal(den);
                return nw == "" || dw == "" ? m.Value : $"{dw} ভাগের {nw}";
            });

            return s;
        };
    }
}
