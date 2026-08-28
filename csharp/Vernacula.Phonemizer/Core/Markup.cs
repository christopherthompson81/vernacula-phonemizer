/**
 * Shared MARKUP stripping — render HTML to the text it stands for, before any engine sees it; left alone,
 * tags reach the phoneme stream and are SPOKEN. Applied at the single dispatch point in the registry.
 * Ported from src/core/markup.ts — see that file for the corpus evidence.
 *
 * ⚠ ORDER: tags are stripped BEFORE entities are decoded. The other way round, `&lt;i&gt;` — an author
 * writing ABOUT a tag, which must stay literal — would decode to `<i>` and then be stripped as markup.
 */

using System.Text;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Core;

public static class Markup
{
    /** The named entities that actually occur, plus the handful any text realistically carries. An entity
     *  NOT listed is deliberately left literal; each row here maps to a character the engine ALREADY reads,
     *  and pairs with the machinery that reads it (sup1-3 → the exponent rules, frac → the vulgar-fraction
     *  fold, minus/plusmn → the sign rules, cent/micro/permil → the symbol tier). */
    private static readonly IReadOnlyDictionary<string, string> NAMED = new Dictionary<string, string>
    {
        ["amp"] = "&",
        ["lt"] = "<",
        ["gt"] = ">",
        ["quot"] = "\"",
        ["apos"] = "'",
        ["nbsp"] = "\u00a0",
        ["laquo"] = "«",
        ["raquo"] = "»",
        ["ldquo"] = "“",
        ["rdquo"] = "”",
        ["lsquo"] = "‘",
        ["rsquo"] = "’",
        ["hellip"] = "…",
        ["ndash"] = "–",
        ["mdash"] = "—",
        ["deg"] = "°",
        ["times"] = "×",
        ["middot"] = "·",
        ["euro"] = "€",
        ["pound"] = "£",
        ["yen"] = "¥",
        ["sup1"] = "¹",
        ["sup2"] = "²",
        ["sup3"] = "³",
        ["frac12"] = "½",
        ["frac14"] = "¼",
        ["frac34"] = "¾",
        ["minus"] = "−",
        ["plusmn"] = "±",
        ["micro"] = "µ",
        ["permil"] = "‰",
        ["cent"] = "¢",

        ["thinsp"] = "\u2009",
        ["bull"] = " ",

        ["lrm"] = "\u200e",
        ["zwnj"] = "\u200c",

        ["aacute"] = "á",
        ["agrave"] = "à",
        ["ccedil"] = "ç",
        ["eacute"] = "é",
        ["egrave"] = "è",
        ["ecirc"] = "ê",
        ["iacute"] = "í",
        ["icirc"] = "î",
        ["ocirc"] = "ô",
        ["ograve"] = "ò",

    };

    /**
     * LaTeX CONTROL SEQUENCES, as MediaWiki's `<math>` leaves them: `{\displaystyle W={\frac {Rv+Cm}{v+m}}}`
     * was recited as English (*dˈʌbəɫjuː dɪsplˈeᶦstaᶦɫ …*).
     */
    private static readonly JsRe LATEX_CMD = JsRegex.Compile(@"\\[a-zA-Z]+\s?", "gu");
    /** Non-global twin for the presence test — `.test()` on a `/g` regex advances `lastIndex` and would make
     *  alternate calls disagree with themselves. */
    private static readonly JsRe HAS_LATEX = JsRegex.Compile(@"\\[a-zA-Z]+", "u");
    private static readonly JsRe MATH_BRACE = JsRegex.Compile("[{}]", "gu");

    /**
     * `<sup>` is rendered to real superscript characters BEFORE the general tag pass removes its brackets.
     */
    private static readonly IReadOnlyDictionary<string, string> SUP_MAP = new Dictionary<string, string>
    {
        ["0"] = "\u2070",
        ["1"] = "\u00b9",
        ["2"] = "\u00b2",
        ["3"] = "\u00b3",
        ["4"] = "\u2074",
        ["5"] = "\u2075",
        ["6"] = "\u2076",
        ["7"] = "\u2077",
        ["8"] = "\u2078",
        ["9"] = "\u2079",
        ["-"] = "\u207b",
        ["+"] = "\u207a",
    };
    private static readonly JsRe SUP_TAG = JsRegex.Compile(@"<sup>([+-]?\d+)<\/sup>", "giu");

    /** An HTML TAG. */
    private static readonly JsRe TAG = JsRegex.Compile(@"<\/?[a-zA-Z][^<>]*>", "gu");

    /**
     * WIKITABLE SYNTAX — not HTML, but it arrives by the same route (scraped text) and was likewise SPOKEN,
     * an attribute at a time.
     */
    private static readonly JsRe WIKITABLE = JsRegex.Compile(
        @"^[ \t]*\{\|[^\n]*|\|\}|^[ \t]*\|(?:[a-zA-Z-]+=(?:""[^""\n]*""|'[^'\n]*'|[^|\s]+)[ \t]*)*\|?|\|\|", "gmu");
    private static readonly JsRe ENTITY = JsRegex.Compile(@"&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);", "gu");

    /** Port of `Number.parseInt(digits, radix)` for the entity-reference bodies. */
    private static double ParseIntRadix(string digits, int radix)
    {
        double v = 0;
        foreach (var c in digits)
        {
            var d = c <= '9' ? c - '0' : char.ToLowerInvariant(c) - 'a' + 10;
            v = v * radix + d;
        }
        return v;
    }

    /**
     * Port of `String.fromCodePoint(cp)` for the decoder: JS returns a LONE SURROGATE for 0xD800-0xDFFF
     * where .NET's ConvertFromUtf32 throws, so a numeric reference to one must not take the call down.
     */
    private static string FromCodePoint(int cp) =>
        cp is >= 0xD800 and <= 0xDFFF ? ((char)cp).ToString() : Js.FromCodePoint(cp);

    /** Strip HTML tags and decode character entities. Pure text→text; a string containing neither is
     *  returned unchanged, and the fast path makes that the common case. */
    public static string StripMarkup(string text)
    {
        if (
            !text.Contains('<') &&
            !text.Contains('&') &&
            !text.Contains('|') &&
            !text.Contains('!') &&
            !text.Contains('\\') &&
            !text.Contains('{') &&
            !text.Contains('}')
        )
            return text;
        var deLatex = HAS_LATEX.IsMatch(text) ? Rewrite(Rewrite(text, LATEX_CMD, " "), MATH_BRACE, " ") : text;
        var s = Rewrite(deLatex, WIKITABLE, " ");
        s = Rewrite(s, SUP_TAG, m =>
        {
            var d = m.Groups[1].Value;
            var sb = new StringBuilder();
            foreach (var c in Js.CodePoints(d)) sb.Append(SUP_MAP.TryGetValue(c, out var sup) ? sup : c);
            return sb.ToString();
        });
        s = Rewrite(s, TAG, "");
        return Rewrite(s, ENTITY, m =>
        {
            var whole = m.Value;
            var body = m.Groups[1].Value;
            if (body.StartsWith("#", StringComparison.Ordinal))
            {
                var cp =
                    body[1] == 'x' || body[1] == 'X'
                        ? ParseIntRadix(body[2..], 16)
                        : ParseIntRadix(body[1..], 10);
                return double.IsFinite(cp) && cp > 0 && cp <= 0x10ffff ? FromCodePoint((int)cp) : whole;
            }
            return NAMED.TryGetValue(body.ToLowerInvariant(), out var named) ? named : whole; // an unknown entity stays literal
        });
    }
}
