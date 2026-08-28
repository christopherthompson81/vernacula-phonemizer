/**
 * Zhuang (za) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks (CJK punctuation, foreign-script glosses, era markers,
 * de-grouping, units, degrees, percent, ranges, fractions, decimals, the ampersand). Pure text→text.
 * Ported from src/languages/zhuang/normalize.ts — see that file for the corpus counts, the ORDER-DEPENDENCE
 * of every step, and the sourcing of (and refusals behind) every word emitted here.
 */
using System.Text;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Zhuang;

public static class Normalize
{
    /** The CJK-ideograph blocks Sawndip draws on — the same set Sawndip.cs recognises, as a class body. */
    private const string HAN = "\\u{3007}\\u{3400}-\\u{4dbf}\\u{4e00}-\\u{9fff}\\u{f900}-\\u{faff}\\u{20000}-\\u{2ee5f}\\u{2f800}-\\u{2fa1f}\\u{30000}-\\u{3347f}";
    private static readonly JsRe HAN_RUN = JsRegex.Compile($"[{HAN}]+", "gu");
    private static readonly JsRe HAS_HAN = JsRegex.Compile($"[{HAN}]", "u");

    /** A script/language LABEL the corpus writes in front of a foreign-script gloss. */
    private static readonly JsRe GLOSS_LABEL = JsRegex.Compile(
        $"(?:Sawgun|Vahgun|Sawndip|Sawdai|Binghyaem\\s+Vahgun|Ciqyaem\\s+Gaeuq|gyoepyaem|拼音)\\s*[:：]\\s*(?=[{HAN}])",
        "giu");

    /** A bracket group with no nesting — every gloss in this corpus is flat. */
    private static readonly JsRe BRACKET = JsRegex.Compile("[(（《「『][^()（）《》「」『』]*[)）》」』]", "gu");

    /** Ascending digit pairs only; see the TS for the three guards and what each one refuses. */
    private static readonly JsRe RANGE =
        JsRegex.Compile("(?<![\\d.,:\\p{L}\\p{M}-])(\\d+)\\s?[-–—]\\s?(\\d+)(?![\\d\\p{L}\\p{M}-]|[.,]\\d)", "gu");

    /** The commoner shape: the dash after a DATE NOUN, ×95 against the digit arm's ×28. */
    private static readonly JsRe DATE_RANGE =
        JsRegex.Compile("(?<=(?:nienz|nyied|hauh|ngoenz|sigij|geiz))\\s?[-–—]\\s?(?=\\d)", "gu");

    // ⚠ LONGEST KEY FIRST — `km²`/`km2` must be tried before `km`, and the squared word is a PREFIX on the
    // unit noun in Zhuang, so it is spelled into the key rather than composed.
    private static readonly (string Sym, string Word)[] UNITS =
    {
        ("km²", "bingzfueng goengleix"), ("km2", "bingzfueng goengleix"),
        ("km", "goengleix"), ("cm", "leizmeix"),
        ("m", "meix"),
    };

    private static readonly JsRe REGEX_META = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");

    private static readonly JsRe ENTITY = JsRegex.Compile("&nbsp;|&#(?:x[0-9a-f]+|\\d+);", "giu");
    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[\\u200b\\u200c\\u200d\\ufeff]", "gu");

    private static readonly JsRe CJK_STOP = JsRegex.Compile("[。｡]", "gu");
    private static readonly JsRe CJK_COMMA = JsRegex.Compile("[、，]", "gu");
    private static readonly JsRe CJK_SEMI = JsRegex.Compile("；", "gu");
    private static readonly JsRe CJK_COLON = JsRegex.Compile("：", "gu");
    private static readonly JsRe CJK_QUESTION = JsRegex.Compile("？", "gu");
    private static readonly JsRe CJK_BANG = JsRegex.Compile("！", "gu");
    private static readonly JsRe MIDDLE_DOT = JsRegex.Compile("[‧·・]", "gu");
    private static readonly JsRe CURLY_APOS = JsRegex.Compile("’", "gu");
    private static readonly JsRe QUOTES = JsRegex.Compile("[“”‘「」『』]", "gu");
    private static readonly JsRe DASHES = JsRegex.Compile("[—－～〜]", "gu");
    private static readonly JsRe CJK_BRACKETS = JsRegex.Compile("[（）《》〈〉【】\\u3000]", "gu");
    private static readonly JsRe FULLWIDTH_PERCENT = JsRegex.Compile("％", "gu");
    private static readonly JsRe FULLWIDTH_AMP = JsRegex.Compile("＆", "gu");

    private static readonly JsRe MINUS =
        JsRegex.Compile("(?<![\\p{L}\\p{M}\\p{Nd}])(?<!\\p{Nd}\\s)\\u2212(?=\\p{Nd})", "gu");

    private const string BCE = "\\s?B\\.?C(?![\\p{L}\\p{M}])";
    private static readonly JsRe BCE_SPAN =
        JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}\\d])(\\d+){BCE}\\s?[-–—]\\s?(\\d+){BCE}", "gu");
    private static readonly JsRe BCE_ONE = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}\\d])(\\d+){BCE}", "gu");

    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})((?:,\\d{3})+)(?![\\d]|,\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe GROUP_SPACE =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?![\\d]| \\d)", "gu");
    private static readonly JsRe GROUP_SPACES = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");

    /** Lifted VERBATIM from core/normalizeSymbols.ts — it caught a live bug here (`802.11m`), not a
     *  hypothetical one. */
    private const string NOT_VERSION = "(?<![\\d.,])(?!\\d+[.,]\\d+[a-zA-Z](?![a-zA-Z\\d]))";

    /** The unit patterns, one per key, compiled once in the order the TS applies them. */
    private static readonly (JsRe Re, string Word)[] UNIT_RULES = UNITS
        .Select(u => (
            JsRegex.Compile(
                $"(?<![\\p{{L}}\\p{{M}}\\d.,]){NOT_VERSION}(\\d+(?:\\.\\d+)?)(\\s(?:fanh|ik))?\\s?{REGEX_META.Replace(u.Sym, "\\$&")}(?![\\p{{L}}\\p{{M}}\\d²³])",
                "gu"),
            u.Word))
        .ToArray();

    private static readonly JsRe DEGREES =
        JsRegex.Compile("(?<![\\d.,])(\\d+(?:\\.\\d+)?)\\s?(?:°\\s?[CF]|[℃℉])(?![\\p{L}\\p{M}])", "gui");

    private static readonly JsRe PERCENT_SPAN =
        JsRegex.Compile("(?<![\\d.,])(\\d+(?:\\.\\d+)?)\\s?%\\s?-\\s?(\\d+(?:\\.\\d+)?)\\s?%", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile("(?<![\\d.,])(\\d+(?:\\.\\d+)?)\\s?%", "gu");

    private static readonly JsRe FRACTION =
        JsRegex.Compile("(?<![\\d\\p{L}\\p{M}/])(\\d{1,3})/(\\d{1,3})(?![\\d/])", "gu");

    private static readonly JsRe DECIMAL_POINT =
        JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)(?![\\d\\p{L}\\p{M}])", "gu");

    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s?&\\s?", "gu");

    // The dangling-CJK-punctuation cleanups inside a stripped gloss.
    private static readonly JsRe DANGLING_MARK = JsRegex.Compile("[,;:、，；：]\\s*(?=[,;:、，；：]|$)", "gu");
    private static readonly JsRe LEADING_MARK = JsRegex.Compile("^[\\s,;:、，；：]+", "u");
    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("\\s{2,}", "gu");
    private static readonly JsRe HAS_LETTER_OR_NUMBER = JsRegex.Compile("[\\p{L}\\p{N}]", "u");

    /** Expand a foreign-script gloss out of one bracket group, or drop the group if nothing else is in it. */
    private static string StripGloss(string group)
    {
        if (!HAS_HAN.IsMatch(group)) return group;
        var open = group[..1];
        var close = group[^1..];
        var inner = group[1..^1];
        // ⚠ `inner` IS A SLICE OF A MATCHED GROUP, not the pipeline string — off the seam, or the whole
        // utterance's mapping goes with it. (`x = Rewrite(x, …)` is normally the shape that proves a site
        // IS the pipeline; here the variable is a local built from the match, which is the exception.)
        inner = JsRegex.Replace(inner, GLOSS_LABEL, "");
        inner = JsRegex.Replace(inner, HAN_RUN, " ");
        inner = JsRegex.Replace(inner, DANGLING_MARK, " ");
        inner = JsRegex.Replace(inner, LEADING_MARK, "");
        inner = JsRegex.Replace(inner, MULTI_SPACE, " ");
        inner = Js.Trim(inner);
        return HAS_LETTER_OR_NUMBER.IsMatch(inner) ? $"{open}{inner}{close}" : " ";
    }

    /**
     * Zhuang text normalization. A numbered sequence of ORDER-DEPENDENT steps; the TS states the coupling
     * for each one, and every reordering here is a behaviour change.
     */
    public static string NormalizeZhuang(string input)
    {
        // 0) NFC at the entry.
        var s = Renormalize(input, NormalizationForm.FormC);

        // 1) HTML entities, zero-width marks, then the bracketed foreign-script gloss — the gloss pass must
        //    run BEFORE step 2, which folds away the full-width brackets it keys on.
        s = Rewrite(Rewrite(s, ENTITY, " "), ZERO_WIDTH, "");
        s = Rewrite(s, BRACKET, m => StripGloss(m.Value));

        // 2) CJK punctuation → ASCII. `’` folds to the apostrophe (a syllable boundary), not to nothing;
        //    the dashes fold to `-` so step 8 can see them. NOT a blanket NFKC — that would erase `²`.
        s = Rewrite(s, CJK_STOP, ".");
        s = Rewrite(s, CJK_COMMA, ",");
        s = Rewrite(s, CJK_SEMI, ";");
        s = Rewrite(s, CJK_COLON, ":");
        s = Rewrite(s, CJK_QUESTION, "?");
        s = Rewrite(s, CJK_BANG, "!");
        s = Rewrite(s, MIDDLE_DOT, ",");
        s = Rewrite(s, CURLY_APOS, "'");
        s = Rewrite(s, QUOTES, " ");
        s = Rewrite(s, DASHES, "-");
        s = Rewrite(s, CJK_BRACKETS, " ");
        s = Rewrite(s, FULLWIDTH_PERCENT, "%");
        s = Rewrite(s, FULLWIDTH_AMP, "&");

        // 2b) THE MINUS — U+2212 only, preposed, before the era and range rules.
        s = Rewrite(s, MINUS, $"{Manifest.MANIFEST.Minus} ");

        // 3) ERA MARKERS, before de-grouping and before the range rule; the SPAN arm first.
        s = Rewrite(s, BCE_SPAN, "gunghyenz gonq $1 daengz gunghyenz gonq $2");
        s = Rewrite(s, BCE_ONE, "gunghyenz gonq $1");

        // 4) DIGIT DE-GROUPING — the comma only, plus the space. The DOT is Zhuang's decimal separator.
        s = Rewrite(s, GROUP_COMMA, m => COMMAS.Replace(m.Value, ""));
        s = Rewrite(s, GROUP_SPACE, m => GROUP_SPACES.Replace(m.Value, ""));

        // 5) UNITS, before decimals and after de-grouping; postposed, with a magnitude word allowed between.
        foreach (var (re, word) in UNIT_RULES)
            s = Rewrite(s, re, m =>
                $"{m.Groups[1].Value}{(m.Groups[2].Success ? m.Groups[2].Value : "")} {word}");

        // 6) DEGREES — the sign and the scale letter are CONSUMED AND UNREAD (no attested Zhuang word).
        s = Rewrite(s, DEGREES, "$1");

        // 7) PERCENT — the composed `bak faenh cih`, preposed; the percent-to-percent span is claimed first.
        s = Rewrite(s, PERCENT_SPAN, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return Js.Number(a) < Js.Number(b)
                ? $"bak faenh cih {a} daengz bak faenh cih {b}"
                : m.Value;
        });
        s = Rewrite(s, PERCENT, "bak faenh cih $1");

        // 8) RANGES, after percent and de-grouping and step 3; ascending only.
        s = Rewrite(s, DATE_RANGE, " daengz ");
        s = Rewrite(s, RANGE, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return Js.Number(a) < Js.Number(b) ? $"{a} daengz {b}" : m.Value;
        });

        // 9) FRACTIONS → `faenh cih` WITH THE OPERANDS SWAPPED (Zhuang states the denominator first).
        s = Rewrite(s, FRACTION, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return Js.Number(a) < Js.Number(b) && Js.Number(b) <= 100 ? $"{b} faenh cih {a}" : m.Value;
        });

        // 10) DECIMALS, after every rule that needs the number intact; the separator becomes NOTHING.
        s = Rewrite(s, DECIMAL_POINT, m =>
            $"{m.Groups[1].Value} {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 11) THE AMPERSAND — spaced on both sides deliberately: `A&B` would otherwise become one token.
        s = Rewrite(s, AMPERSAND, " caeuq ");

        return s;
    }
}
