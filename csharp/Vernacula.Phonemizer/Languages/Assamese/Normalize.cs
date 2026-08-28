/**
 * Assamese (as) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks.
 * Ported from src/languages/assamese/normalize.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Bengali;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Assamese;

public static class Normalize
{
    private static readonly string BN_DIGIT = string.Concat(Unicode.BENGALI_DIGITS.Keys);
    /** Either digit system. */
    private static readonly string D = $"0-9{BN_DIGIT}";

    /** Fold Bengali digits to ASCII so a value can be computed from either script. */
    private static string ToAscii(string s) =>
        string.Concat(Js.CodePoints(s).Select(c => Unicode.BENGALI_DIGITS.GetValueOrDefault(c, c)));

    /** Magnitude nouns that sit BETWEEN a number and its currency ("$১৪.৭ বিলিয়ন আমেৰিকান ডলাৰ" — Assamese's
     *  own word order). */
    private const string MAGNITUDE = "(?:মিলিয়ন|বিলিয়ন|ট্ৰিলিয়ন|হাজাৰ|লাখ|কোটি)";

    /**
     * ⚠ THE CLASSICAL ORDINAL SERIES 11–20 IS SUPPLETIVE, not the cardinal plus a suffix: 11শ is একাদশ, not
     * *এঘাৰশ.
     */
    private static readonly IReadOnlyDictionary<int, string> ORDINAL_11_20 = new Dictionary<int, string>
    {
        [11] = "একাদশ", [12] = "দ্বাদশ", [13] = "ত্রয়োদশ", [14] = "চতুর্দশ", [15] = "পঞ্চদশ",
        [16] = "ষোড়শ", [17] = "সপ্তদশ", [18] = "অষ্টাদশ", [19] = "ঊনবিংশ", [20] = "বিংশ",
    };

    private static readonly IReadOnlyDictionary<string, string> CODE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["US"] = "আমেৰিকান", ["AUD"] = "অস্ট্রেলিয়ান",
    };
    private static readonly string[] ORDINAL_1_10 =
        { "প্রথম", "দ্বিতীয়", "তৃতীয়", "চতুর্থ", "পঞ্চম", "ষষ্ঠ", "সপ্তম", "অষ্টম", "নবম", "দশম" };

    private static readonly JsRe DOTTED_LATIN = JsRegex.Compile("(?<![\\p{L}\\p{M}])[A-Za-z]\\.(?:[ \u00a0]?[A-Za-z]\\.)+", "gu");
    private static readonly JsRe DOT_OR_SPACE = JsRegex.Compile("[.\\s]", "gu");
    private static readonly JsRe LONE_INITIAL = JsRegex.Compile("(?<![\\p{L}\\p{M}])([A-Z])\\.(?=\\s+[A-Z])", "gu");
    private static readonly JsRe DOTTED_BENGALI =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])[\\p{Script=Bengali}\\p{M}]+\\.(?:[ \u00a0]?[\\p{Script=Bengali}\\p{M}]+\\.)+", "gu");
    private static readonly JsRe DOT_G = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe SPACE_RUN = JsRegex.Compile("\\s+", "gu");
    private static readonly JsRe SHA_TWO_DIGIT = JsRegex.Compile($"(?<![{D}])([{D}]{{2}})(শ)(?![{D}ত])", "gu");
    private static readonly JsRe SHA_ONE_DIGIT = JsRegex.Compile($"(?<![{D}])([{D}])শ(?![{D}])", "gu");
    private static readonly JsRe NANG = JsRegex.Compile($"(?<![{D}])([{D}]+)\\s?নং(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe GROUPED_ORDINAL =
        JsRegex.Compile($"([{D}]),([{D}]{{3}})(?=(?:তম|শে|ই|ম|য়|র্থ|ষ্ঠ|লা|রা|ঠা))", "gu");
    private static readonly JsRe VERSION_DOT =
        JsRegex.Compile($"(?<![{D},.:])([{D}]{{3,}})\\.([{D}]+)(?=(?:[a-zA-Z](?![a-zA-Z])|এন))", "gu");
    private static readonly string NUM = $"[{D}]+(?:[.,][{D}]+)*";
    private static readonly JsRe CURRENCY_CODE =
        JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])(US|AUD)\\$[ ]?({NUM})(\\s+{MAGNITUDE})?", "gu");
    private static readonly JsRe BARE_DOLLAR_REDUNDANT =
        JsRegex.Compile($"\\$[ ]?({NUM})(\\s+{MAGNITUDE})?(?=\\s+(?:আমেৰিকান\\s+)?ডলা[ৰর])", "gu");
    private static readonly JsRe BARE_DOLLAR_MAGNITUDE = JsRegex.Compile($"\\$[ ]?({NUM})(\\s+{MAGNITUDE})", "gu");
    private static readonly JsRe AMP_SPACED = JsRegex.Compile("\\s&\\s", "gu");
    private static readonly JsRe AMP_BARE = JsRegex.Compile("(?<![A-Za-z])&(?![A-Za-z])", "gu");
    private static readonly JsRe AMP_TIGHT = JsRegex.Compile("([A-Za-z])&([A-Za-z])", "gu");
    private static readonly JsRe REGNAL_WW = JsRegex.Compile($"([{D}]{{1,2}})\\s+বিশ্ব যুদ্ধ", "gu");
    private static readonly JsRe EQUALS_RE = JsRegex.Compile("(\\S)\\s*=\\s*(\\S)", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(\\d)\\s*<\\s*(\\d)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(\\d)\\s*>\\s*(\\d)", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(\\d)\\s*×\\s*(\\d)", "gu");

    /** Build the Assamese pre-pass normalizer. Takes the numbers definition so it can re-compose a cardinal
     *  (e.g. for `1,000তম` where the suffix must stay attached to the de-grouped number). */
    public static Func<string, string> MakeAssameseNormalizer(NumbersDef numbers)
    {
        string Cardinal(double n) =>
            string.Join(" ", Core.Numbers.indicNumberWords(n, numbers).Select(w => w ?? ""));

        return input =>
        {
            var s = Renormalize(input, NormalizationForm.FormC);

            s = Rewrite(s, DOTTED_LATIN, m => DOT_OR_SPACE.Replace(m.Value, ""));
            s = Rewrite(s, LONE_INITIAL, "$1");
            s = Rewrite(s, DOTTED_BENGALI, m => SPACE_RUN.Replace(DOT_G.Replace(m.Value, " "), " "));

            s = Rewrite(s, SHA_TWO_DIGIT, m =>
            {
                var n = (int)Js.Number(ToAscii(m.Groups[1].Value));
                return ORDINAL_11_20.TryGetValue(n, out var ord) ? ord : n == 10 ? "দশম" : m.Value;
            });
            s = Rewrite(s, SHA_ONE_DIGIT, m =>
                Js.Number(ToAscii(m.Groups[1].Value)) == 1 ? "একশ" : m.Value);

            s = Rewrite(s, NANG, m => $"{Cardinal(Js.Number(ToAscii(m.Groups[1].Value)))} নম্বৰ");

            for (var i = 0; i < 2; i++)
                s = Rewrite(s, GROUPED_ORDINAL, "$1$2");

            s = Rewrite(s, VERSION_DOT, "$1 বিন্দু $2");

            s = Rewrite(s, CURRENCY_CODE, m =>
                $"{m.Groups[2].Value}{(m.Groups[3].Success ? m.Groups[3].Value : "")} {CODE[m.Groups[1].Value]} ডলাৰ");
            s = Rewrite(s, BARE_DOLLAR_REDUNDANT, "$1$2");
            s = Rewrite(s, BARE_DOLLAR_MAGNITUDE, "$1$2 ডলাৰ");

            s = Rewrite(s, AMP_SPACED, " আৰু ");
            s = Rewrite(s, AMP_BARE, " আৰু ");
            s = Rewrite(s, AMP_TIGHT, "$1 আৰু $2");

            s = Rewrite(s, REGNAL_WW, m =>
            {
                var n = (int)Js.Number(ToAscii(m.Groups[1].Value));
                if (n < 1 || n > 20) return m.Value;
                var ord = n <= 10 ? ORDINAL_1_10[n - 1] : ORDINAL_11_20[n];
                return $"{ord} বিশ্ব যুদ্ধ";
            });

            s = Rewrite(s, EQUALS_RE, "$1 সমান $2");
            s = Rewrite(s, LESS_THAN, "$1 তকৈ সৰু $2");
            s = Rewrite(s, GREATER_THAN, "$1 তকৈ ডাঙৰ $2");
            s = Rewrite(s, TIMES, "$1 গুণ $2");

            return s;
        };
    }

    /** The Assamese pre-pass, self-contained (loads the Assamese numbers itself) so the engine and the tests
     *  call the same entry the review tool can see. */
    public static string NormalizeAssamese(string input) =>
        MakeAssameseNormalizer(LoadManifest.Load<BengaliDef>("languages/assamese", "assamese.jsonc").Numbers)(input);
}
