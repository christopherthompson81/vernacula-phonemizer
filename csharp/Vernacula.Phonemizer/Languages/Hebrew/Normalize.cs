/**
 * Hebrew (he) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks (proclitics, gershayim acronyms/quotes, the glossed
 * abbreviations, digit grouping, the sign classes). Pure text→text; every word it emits carries niqqud.
 * Ported from src/languages/hebrew/normalize.ts — see that file for the corpus counts and every refusal.
 */
using System.Text;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Hebrew;

public static class Normalize
{
    private const string NUM = "[0-9]+(?:\\.[0-9]+)?";
    private const string DASH = "[-‐‑־]";
    private const string GERESH = "['׳’]";
    private const string GERSHAYIM = "[\"״]";

    private static readonly IReadOnlyDictionary<string, string> PROCLITIC = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ב"] = "בְּ", ["כ"] = "כְּ", ["ל"] = "לְ", ["ו"] = "וְ", ["מ"] = "מֵ", ["ה"] = "הַ", ["ש"] = "שֶׁ",
    };
    private const string PRO_DASH = "[בכלמוה]";
    private const string PRO_QUOTE = "[בכלמוהש]";

    private static string Vocalize(string run) =>
        string.Join(" ", Js.CodePoints(run).Select(ch => PROCLITIC.TryGetValue(ch, out var v) ? v : ch));

    /** [ body (regex, no anchors), vocalized expansion, the glued-proclitic-friendly first word ] */
    private static readonly (string Body, string Expansion, string Head)[] ABBREV =
    {
        ("לפנה" + GERSHAYIM + "ס", "לִפְנֵי הַסְּפִירָה", "לִפְנֵי"),
        ("לפסה" + GERSHAYIM + "נ", "לִפְנֵי סְפִירַת הַנּוֹצְרִים", "לִפְנֵי"),
        ("קמ" + GERSHAYIM + "ר", "קִילוֹמֶטֶר רָבוּעַ", "קִילוֹמֶטֶר"),
        ("סמ" + GERSHAYIM + "ק", "סֶנְטִימֶטֶר מְעֻקָּב", "סֶנְטִימֶטֶר"),
        ("ק" + GERSHAYIM + "מ", "קִילוֹמֶטֶר", "קִילוֹמֶטֶר"),
        ("מ" + GERSHAYIM + "מ", "מִילִימֶטֶר", "מִילִימֶטֶר"),
        ("ד" + GERSHAYIM + "ר", "דּוֹקְטוֹר", "דּוֹקְטוֹר"),
        ("ש" + GERSHAYIM + "ח", "שֶׁקֶל חָדָשׁ", "שֶׁקֶל"),
        ("וכו" + GERESH, "וְכוּלֵי", "וְכוּלֵי"),
        ("פרופ" + GERESH, "פְּרוֹפֶסוֹר", "פְּרוֹפֶסוֹר"),
    };

    private static readonly JsRe SOF_PASUQ = JsRegex.Compile("\\u05C3", "gu");
    // ⚠ The TS writes these as literal characters; they are ZERO-WIDTH, so the port spells them as escapes
    // rather than as invisible bytes in the source. Same class, character for character:
    // LRM, RLM, LRE-RLO, LRI-PDI, ZWSP-ZWJ, BOM.
    private static readonly JsRe BIDI =
        JsRegex.Compile("[\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069\\u200B-\\u200D\\uFEFF]", "gu");
    private static readonly JsRe ENTITY = JsRegex.Compile("&nbsp;|&#(?:x[0-9a-f]+|\\d+);", "giu");
    private static readonly JsRe GROUPED =
        JsRegex.Compile("(?<![0-9.,])[1-9][0-9]{0,2}(?:,[0-9]{3})+(?![0-9]|,[0-9])", "gu");
    private static readonly JsRe COMMA = JsRegex.Compile(",", "gu");
    private static readonly JsRe QUOTE_ARM =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}({PRO_QUOTE}{{1,2}}){GERSHAYIM}(?=[א-ת]{{2,}})", "gu");
    private static readonly JsRe ACRONYM_ARM =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}([א-ת]{{1,6}}){GERSHAYIM}([א-ת]{{1,8}}){Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe PROCLITIC_DASH =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}({PRO_DASH}{{1,2}}){DASH}(?=[0-9A-Za-z])", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile($"({NUM})\\s?%\\s?(אחוז\\S*)?", "gu");
    private const string MAG = "(?:\\s(?:אלף|מיליון|מיליארד|טריליון))?";
    private static readonly JsRe DOLLAR_PRE = JsRegex.Compile($"\\$\\s?({NUM})", "gu");
    private static readonly JsRe DOLLAR_POST = JsRegex.Compile($"({NUM}{MAG})\\s?\\$", "gu");
    private static readonly JsRe TRAILING_MINUS =
        JsRegex.Compile($"(?<![0-9.,])({NUM})(\\s?°\\s?[CF])\\s?[-−–]", "gui");
    private static readonly JsRe DEGREE_SCALE =
        JsRegex.Compile($"(?<![0-9.,])({NUM})\\s?°\\s?[CF]{Boundaries.NOT_LETTER_AFTER}", "gui");
    private static readonly JsRe DEGREE_BARE = JsRegex.Compile($"(?<![0-9.,])({NUM})\\s?°", "gu");
    private static readonly JsRe KM3 =
        JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}0-9.])({NUM})\\s?km³{Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe KM2 =
        JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}0-9.])({NUM})\\s?km²{Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe SQUARE = JsRegex.Compile($"(?<![0-9.,])({NUM})\\s?²", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("(?<=[0-9])\\s?:\\s?(?=[0-9]{2})", "gu");

    /** The Hebrew text normalizer. */
    public static string NormalizeHebrew(string input)
    {
        var s = input.Normalize(NormalizationForm.FormC);                                              // 1
        s = Rewrite(s, SOF_PASUQ, _ => " \u05C3 ");                                            // 1b
        s = Rewrite(s, BIDI, _ => "");                                                         // 2
        s = Rewrite(s, ENTITY, _ => " ");
        s = Rewrite(s, GROUPED, m => JsRegex.Replace(m.Value, COMMA, _ => ""));                // 3

        foreach (var (body, expansion, head) in ABBREV)                                                // 4
        {
            var tail = expansion[head.Length..];
            var re = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}({PRO_DASH}?){body}{Boundaries.NOT_LETTER_AFTER}", "gu");
            s = Rewrite(s, re, m =>
            {
                var pre = m.Groups[1].Value;
                return (pre == "" ? expansion : (PROCLITIC.TryGetValue(pre, out var v) ? v : pre) + head + tail) + " ";
            });
        }

        s = Rewrite(s, QUOTE_ARM, m => Vocalize(m.Groups[1].Value) + " \"");                    // 5
        s = Rewrite(s, ACRONYM_ARM, m => m.Groups[1].Value + m.Groups[2].Value);
        s = Rewrite(s, PROCLITIC_DASH, m => Vocalize(m.Groups[1].Value) + " ");                 // 6
        s = Rewrite(s, PERCENT, m =>                                                            // 7
            m.Groups[1].Value + " " + (m.Groups[2].Success ? m.Groups[2].Value : "אָחוּז") + " ");
        s = Rewrite(s, DOLLAR_PRE, m => m.Groups[1].Value + " דּוֹלָר ");                          // 8
        s = Rewrite(s, DOLLAR_POST, m => m.Groups[1].Value + " דּוֹלָר ");
        s = Rewrite(s, TRAILING_MINUS, m => "מִינוּס " + m.Groups[1].Value + m.Groups[2].Value);    // 9
        s = Rewrite(s, DEGREE_SCALE, m => m.Groups[1].Value + " מַעֲלוֹת צֶלְזִיוּס ");                // 10
        s = Rewrite(s, DEGREE_BARE, m => m.Groups[1].Value + " מַעֲלוֹת ");
        s = Rewrite(s, KM3, m => m.Groups[1].Value + " קִילוֹמֶטֶר מְעֻקָּב ");                        // 11
        s = Rewrite(s, KM2, m => m.Groups[1].Value + " קִילוֹמֶטֶר רָבוּעַ ");
        s = Rewrite(s, SQUARE, m => m.Groups[1].Value + " בְּרִיבּוּעַ ");
        s = NormalizeSymbols.SpacedBareExponent(s);
        s = Rewrite(s, CLOCK_COLON, _ => " ");                                                  // 12
        return s;
    }
}
