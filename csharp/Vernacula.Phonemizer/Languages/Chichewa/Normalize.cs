/**
 * Chichewa / Chinyanja (nya) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 * ⚠ IT RUNS *AFTER* THE SHARED SYMBOL TIER (the Swahili order) — see Chichewa.cs.
 * Ported from src/languages/chichewa/normalize.ts — see that file for the corpus evidence behind every
 * arm, and for the list of rules deliberately not written.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Chichewa;

public static class Normalize
{
    private static string AND => Manifest.MANIFEST.Numbers.And;

    private const string METRE = "mamita";
    private const string DEGREE = "madigiri";

    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["N"] = "kumpoto", ["S"] = "kumwera", ["E"] = "kum'mawa", ["W"] = "kumadzulo",
    };

    private const string HOUR_WORD = "koloko";
    private const string MINUTE_WORD = "mphindi";
    private const string AM = "m'mawa";
    private const string PM = "masana";

    private const string DAYPART = "m['’]?mawa|masana|madzulo|usiku";
    private const string TZ = "UTC|GMT|BST|CET|EST|EDT|CST|CDT|PST|PDT";

    private static readonly JsRe NBSP_ENTITY = JsRegex.Compile("&nbsp;", "giu");
    private static readonly JsRe AMP_ENTITY = JsRegex.Compile("&amp;", "giu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("&", "gu");
    private static readonly JsRe DOTTED_RUN = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(?:\\p{Lu}\\.[ \u00a0]?){2,}(?:\\p{Lu}(?![\\p{L}\\p{M}]))?", "gu");
    private static readonly JsRe DOTS_AND_SPACES = JsRegex.Compile("[. \u00a0]", "gu");
    private static readonly JsRe LEADING_LETTER = JsRegex.Compile("^[\\p{L}\\p{M}]", "u");
    private static readonly JsRe LEADING_SPACE_CAP = JsRegex.Compile("^[ \u00a0]+\\p{Lu}", "u");
    private static readonly JsRe CLOCK = JsRegex.Compile(
        "(?<![\\d:.,])([01]?\\d|2[0-3]):[ \u00a0]?([0-5]\\d)(?![:.\\d])" +
        $"(?:[ \u00a0]*(?:([AaPp])\\.?[Mm]\\.?|({TZ})(?![\\p{{L}}\\p{{M}}])|({DAYPART})(?![\\p{{L}}\\p{{M}}])))",
        "gu");
    private static readonly JsRe GROUP_COMMA = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:,\\d{3})+(?![\\d]|[.,]\\d)", "gu");
    private static readonly JsRe GROUP_DOT = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:\\.\\d{3})+(?![\\d]|[.,]\\d)", "gu");
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile(
        "(?<![\\d.,])([1-9]\\d{0,2})(?:[ \u00a0\u202f\u2009]\\d{3})+(?![\\d])", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe GROUP_SPACES = JsRegex.Compile("[ \u00a0\u202f\u2009]", "gu");
    private static readonly JsRe DEGREE_SCALE = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(\\d+(?:[.,]\\d+)?)[ \u00a0]?°[ \u00a0]?[CF](?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEGREE_COMPASS = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(\\d+(?:[.,]\\d+)?)[ \u00a0]?°[ \u00a0]?([NSEW])(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEGREE_BARE = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(\\d+(?:[.,]\\d+)?)[ \u00a0]?[°º](?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe METRES = JsRegex.Compile("(?<![\\d.,])(\\d+)[ \u00a0]?m(?![\\p{L}\\p{M}'’ʼ0-9])", "gu");
    private static readonly JsRe ORDINAL_SUFFIX = JsRegex.Compile("(\\d+)(?:st|nd|rd|th)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<![-\\d.,\\p{L}\\p{M}])(\\d+)[ \u00a0]?[-–—][ \u00a0]?(\\d+)(?![-\\d\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d{1,2})(?![\\d])", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d{1,2})(?![\\d,])", "gu");
    private static readonly JsRe RUN_OF_SPACES = JsRegex.Compile("[^\\S\\n]{2,}", "gu");
    private static readonly JsRe EDGE_SPACES = JsRegex.Compile("^[^\\S\\n]+|[^\\S\\n]+$", "gu");

    /** The digits of a fractional part, spaced so the number path speaks them one at a time. */
    private static string Spell(string i, string frac) => $"{i} {string.Join(" ", Js.CodePoints(frac))}";

    /** JS `String.prototype.slice` — clamping, never throwing, where .NET's range operator would. */
    private static string Slice(string s, int start, int end)
    {
        var a = Math.Clamp(start, 0, s.Length);
        var b = Math.Clamp(end, a, s.Length);
        return s[a..b];
    }

    /** Is `word` written within ~45 characters either side of this offset? The redundancy guard for
     *  `madigiri`, checked on BOTH sides. */
    private static bool SaidNear(string full, int offset, int end, string word) =>
        Slice(full, offset - 45, end + 45).Contains(word, StringComparison.Ordinal);

    private static string DegreeBody(string n, int off, int end, string full) =>
        SaidNear(full, off, end, DEGREE) ? n : $"{DEGREE} {n}";

    /** Normalize one Chichewa input string. Steps are ORDER-DEPENDENT; the TS states each coupling. */
    public static string NormalizeChichewa(string input)
    {
        var s = input;

        // 1) HTML entities, then the bare ampersand → `ndi`. The entity table is consulted BEFORE the sign
        //    is read, which is the whole reason `ampersand` is not on the shared tier.
        s = AMP_ENTITY.Replace(NBSP_ENTITY.Replace(s, " "), "&");
        s = AMPERSAND.Replace(s, $" {AND} ");

        // 2) Dotted capital runs → the bare letters, before anything reads an interior dot as a break.
        // ⚠ `full` IS THE PRE-REPLACE STRING, as JS's replace callback argument is — snapshot it, or the
        // closure would see `s` as reassigned by this very statement.
        var src2 = s;
        s = DOTTED_RUN.Replace(s, mm =>
        {
            var run = mm.Value;
            var letters = DOTS_AND_SPACES.Replace(run, "");
            var rest = Slice(src2, mm.Index + run.Length, src2.Length);
            if (LEADING_LETTER.IsMatch(rest)) return $"{letters} ";
            return rest == "" || LEADING_SPACE_CAP.IsMatch(rest) ? $"{letters}." : letters;
        });

        // 3) The clock — a right-hand MARKER is what identifies it, not the shape. Before steps 4 and 10.
        s = CLOCK.Replace(s, mm =>
        {
            var whole = mm.Value;
            var hv = Js.Number(mm.Groups[1].Value);
            var mv = Js.Number(mm.Groups[2].Value);
            if (hv > 23 || mv > 59) return whole;
            var body = mv == 0
                ? $"{Js.NumberToString(hv)} {HOUR_WORD}"
                : $"{Js.NumberToString(hv)} {HOUR_WORD} {AND} {MINUTE_WORD} {Js.NumberToString(mv)}";
            if (mm.Groups[3].Success) return $"{body} {(Js.ToLowerCase(mm.Groups[3].Value) == "p" ? PM : AM)}";
            return $"{body} {(mm.Groups[4].Success ? mm.Groups[4].Value : mm.Groups[5].Value)}";
        });

        // 4) Thousands de-grouping, before every remaining numeric rule. Exactly three digits per block.
        s = GROUP_COMMA.Replace(s, mm => COMMAS.Replace(mm.Value, ""));
        s = GROUP_DOT.Replace(s, mm => DOTS.Replace(mm.Value, ""));
        s = GROUP_SPACE.Replace(s, mm => GROUP_SPACES.Replace(mm.Value, ""));

        // 5) Degrees. The scale letter is claimed so it cannot reach the phoneme stream raw; no scale name
        //    is invented. Before step 10, which would otherwise take the `104.0` apart.
        var src5a = s;
        s = DEGREE_SCALE.Replace(s, mm =>
            DegreeBody(mm.Groups[1].Value, mm.Index, mm.Index + mm.Length, src5a));
        var src5b = s;
        s = DEGREE_COMPASS.Replace(s, mm =>
            $"{DegreeBody(mm.Groups[1].Value, mm.Index, mm.Index + mm.Length, src5b)} {COMPASS[mm.Groups[2].Value]}");
        var src5c = s;
        s = DEGREE_BARE.Replace(s, mm =>
            DegreeBody(mm.Groups[1].Value, mm.Index, mm.Index + mm.Length, src5c));

        // 6) Bare `m` → *mamita*, with the apostrophe-aware guard the shared tier cannot express.
        s = METRES.Replace(s, $"{METRE} $1");

        // 7) The English ordinal suffix, stripped — Chichewa writes its own ordinals as words.
        s = ORDINAL_SUFFIX.Replace(s, "$1");

        // 8) Ranges → `mpaka`. ASCENDING only.
        s = RANGE.Replace(s, mm =>
            Js.Number(mm.Groups[1].Value) < Js.Number(mm.Groups[2].Value)
                ? $"{mm.Groups[1].Value} mpaka {mm.Groups[2].Value}"
                : mm.Value);

        // 9) A lone `+` between operands is left unread, deliberately — see the TS header.

        // 10) Decimals, LAST of the numeric rules. No separator word is emitted.
        s = DECIMAL_DOT.Replace(s, mm => Spell(mm.Groups[1].Value, mm.Groups[2].Value));
        s = DECIMAL_COMMA.Replace(s, mm => Spell(mm.Groups[1].Value, mm.Groups[2].Value));

        return EDGE_SPACES.Replace(RUN_OF_SPACES.Replace(s, " "), "");
    }
}
