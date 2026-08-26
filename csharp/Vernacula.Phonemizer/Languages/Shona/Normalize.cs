/**
 * Shona / chiShona (sn) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * ⚠ TWO PASSES, ONE EITHER SIDE OF THE SHARED SYMBOL TIER (the Kinyarwanda shape) — see Shona.cs.
 * Ported from src/languages/shona/normalize.ts — see that file for the corpus evidence behind every arm
 * and for the long list of readings deliberately refused (clock, minus, plus, fractions, compass, cubed).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Shona;

public static class Normalize
{
    private const string RANGE = "kusvika";
    private const string DEGREE = "madhigiriyi";
    private const string SQUARED = "maskweya";

    private static readonly IReadOnlyDictionary<string, string> SCALE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["C"] = "Celsius", ["F"] = "Fahrenheit",
    };

    private const string POINT_WORD = "poyindi";
    private const string COMMA_WORD = "koma";

    /** Class-6 measure and currency nouns this layer or the tier emits, for the concord pass (step 9).
     *  ⚠ `hekita` and `rita` are deliberately absent — they are not `ma-` plurals. Order is safe by
     *  inspection: `mamita` and `mamirimita` diverge at their fifth letter. */
    private const string MA_NOUNS =
        "makiromita|masendimita|makirogiramu|mamirimita|mamita|matani|maawa|masekondi|madhora|maskweya|madhigiriyi";

    private const string DEG = "(?:[  ]?°|[  ]o)";

    private static readonly JsRe AMP_ENTITY = JsRegex.Compile("&amp;", "giu");
    private static readonly JsRe NBSP_ENTITY = JsRegex.Compile("&nbsp;", "giu");
    private static readonly JsRe PROCLITIC_DOLLAR = JsRegex.Compile("(?<=\\p{Ll})\\$(?=\\d)", "gu");
    private static readonly JsRe DOTTED_RUN = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(?:\\p{Lu}\\.[  ]?){2,}(?:\\p{Lu}(?![\\p{L}\\p{M}]))?", "gu");
    private static readonly JsRe DOTS_AND_SPACES = JsRegex.Compile("[.  ]", "gu");
    private static readonly JsRe LEADING_LETTER = JsRegex.Compile("^[\\p{L}\\p{M}]", "u");
    private static readonly JsRe TRAILING_SPACE = JsRegex.Compile("[  ]$", "u");
    private static readonly JsRe LEADING_SPACE_CAP = JsRegex.Compile("^[  ]+\\p{Lu}", "u");
    private static readonly JsRe GROUP_COMMA = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:,\\d{3})+(?!\\d|[.,]\\d)", "gu");
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile(
        "(?<![\\d.,])([1-9]\\d{0,2})(?:[    ]\\d{3})+(?!\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe GROUP_SPACES = JsRegex.Compile("[    ]", "gu");
    private static readonly JsRe ORDINAL_SUFFIX = JsRegex.Compile("(\\d+)(?:st|nd|rd|th)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe RANGE_RE = JsRegex.Compile(
        "(?<![-\\d.,\\p{L}\\p{M}])(\\d+)[  ]?[-–—][  ]?(\\d+)(?![-\\d\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DECIMAL_METRE = JsRegex.Compile(
        "(?<![\\d.,])(\\d+[.,]\\d+)[  ]?m([²³])?(?![\\p{L}\\p{M}'’ʼ\\d])", "gu");
    private static readonly JsRe BARE_HOURS = JsRegex.Compile(
        "(?<![\\d.,:\\p{L}\\p{M}])(\\d+(?:[.,]\\d+)?)[  ]?hrs?(?![\\p{L}\\p{M}\\d])", "gu");
    private static readonly JsRe DEGREE_SCALE = JsRegex.Compile(
        $"(?<![\\d.,])(\\d+(?:[.,]\\d+)?){DEG}[  ]?([CF])(?![\\p{{L}}\\p{{M}}])", "gui");
    private static readonly JsRe DEGREE_BARE = JsRegex.Compile(
        $"(?<![\\d.,])(\\d+(?:[.,]\\d+)?){DEG}(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe CONCORD = JsRegex.Compile($"((?:{MA_NOUNS})[  ])(\\d+)(?![.,]?\\d)", "gu");
    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)(?![\\d.,])", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d{1,2})(?![\\d,])", "gu");
    private static readonly JsRe RUN_OF_SPACES = JsRegex.Compile("[^\\S\\n]{2,}", "gu");
    private static readonly JsRe EDGE_SPACES = JsRegex.Compile("^[^\\S\\n]+|[^\\S\\n]+$", "gu");

    /** The digits of a fractional part, spaced so the number path speaks them one at a time. */
    private static string Spell(string i, string sep, string frac) =>
        $"{i} {sep} {string.Join(" ", Js.CodePoints(frac))}";

    /** JS `String.prototype.slice` — clamping, never throwing, where .NET's range operator would. */
    private static string Slice(string s, int start, int end)
    {
        var a = Math.Clamp(start, 0, s.Length);
        var b = Math.Clamp(end, a, s.Length);
        return s[a..b];
    }

    /** Is `word` written within ~45 characters either side of this offset? The redundancy guard for the
     *  degree noun, checked on BOTH sides — a Shona measure noun normally precedes its number. */
    private static bool SaidNear(string full, int offset, int end, string word) =>
        Slice(full, offset - 45, end + 45).Contains(word, StringComparison.Ordinal);

    private static string DegreeBody(string n, int off, int end, string full) =>
        SaidNear(full, off, end, DEGREE) ? n : $"{DEGREE} {n}";

    /** PASS ONE — everything that must reach the shared symbol tier already rewritten. */
    public static string NormalizeShonaPre(string input)
    {
        var s = input;

        // 1) HTML entities, first — the entity sits exactly in the gap the tier's number-unit adjacency
        //    needs. `&amp;` is unfolded first so a doubly-escaped entity does not survive.
        s = NBSP_ENTITY.Replace(AMP_ENTITY.Replace(s, "&"), " ");

        // 2) A lowercase Shona proclitic glued to a currency sign, split off. LOWERCASE ONLY, which keeps
        //    `US$` / `AUD$` intact for their own compound keys.
        s = PROCLITIC_DOLLAR.Replace(s, " $$");

        // 3) Dotted capital runs → the bare letters, before anything reads an interior dot as a break.
        // ⚠ `full` IS THE PRE-REPLACE STRING, as JS's replace callback argument is — snapshot it, or the
        // closure would see `s` as reassigned by this very statement.
        var src3 = s;
        s = DOTTED_RUN.Replace(s, mm =>
        {
            var run = mm.Value;
            var letters = DOTS_AND_SPACES.Replace(run, "");
            var rest = Slice(src3, mm.Index + run.Length, src3.Length);
            if (LEADING_LETTER.IsMatch(rest)) return $"{letters} ";
            // ⚠ PUT BACK THE SPACE THE RUN SWALLOWED: the quantifier lets a space follow the LAST dot too.
            var tail = TRAILING_SPACE.IsMatch(run) ? " " : "";
            return rest == "" || LEADING_SPACE_CAP.IsMatch(rest) ? $"{letters}.{tail}" : $"{letters}{tail}";
        });

        // 4) Thousands de-grouping, before every remaining numeric rule. Exactly three digits per block.
        s = GROUP_COMMA.Replace(s, mm => COMMAS.Replace(mm.Value, ""));
        s = GROUP_SPACE.Replace(s, mm => GROUP_SPACES.Replace(mm.Value, ""));

        // 5) The English ordinal suffix, stripped — Shona writes its own ordinals as words.
        s = ORDINAL_SUFFIX.Replace(s, "$1");

        // 6) Ranges → `kusvika`, ASCENDING only. BEFORE THE TIER: Shona writes the unit after the SECOND
        //    operand, so once the tier has moved it no range rule can pair the two.
        s = RANGE_RE.Replace(s, mm =>
            Js.Number(mm.Groups[1].Value) < Js.Number(mm.Groups[2].Value)
                ? $"{mm.Groups[1].Value} {RANGE} {mm.Groups[2].Value}"
                : mm.Value);

        return Tidy(s);
    }

    /** PASS TWO — everything that needs the shared symbol tier to have run first. */
    public static string NormalizeShonaPost(string input)
    {
        var s = input;

        // 7) Bare `m` after a DECIMAL → *mamita*, the one metre reading the tier's `NOT_VERSION` guard
        //    structurally declines. The `²` arm recovers the exponent the same guard also cost.
        s = DECIMAL_METRE.Replace(s, mm =>
        {
            var n = mm.Groups[1].Value;
            return mm.Groups[2].Success && mm.Groups[2].Value == "²" ? $"{SQUARED} mamita {n}" : $"mamita {n}";
        });

        // 7b) A bare count of hours → *maawa N*. Claimed locally rather than as a `units` key: a units key
        //     is matchable as a DENOMINATOR too, and the tier cannot decline a clock. The colon in the
        //     lookbehind is what leaves `06:00hrs` raw and reported.
        s = BARE_HOURS.Replace(s, "maawa $1");

        // 8) Degrees. ⚠ THE LEFT GUARD IS `(?<![\d.,])`, NOT the siblings' letter-excluding one — Shona
        //    binds a proclitic to the front of a digit run (`ye32 ° C`, `ne180 °`).
        var src8a = s;
        s = DEGREE_SCALE.Replace(s, mm =>
            $"{DegreeBody(mm.Groups[1].Value, mm.Index, mm.Index + mm.Length, src8a)} {SCALE[mm.Groups[2].Value.ToUpperInvariant()]}");
        var src8b = s;
        s = DEGREE_BARE.Replace(s, mm =>
            DegreeBody(mm.Groups[1].Value, mm.Index, mm.Index + mm.Length, src8b));

        // 9) Noun-class concord on a measure or currency noun's number (trap 14): the operand becomes WORDS
        //    inside the rule that knows which noun it follows. BEFORE step 10, so a decimal is left alone.
        s = CONCORD.Replace(s, mm =>
        {
            var n = Js.Number(mm.Groups[2].Value);
            if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n >= 1e6) return mm.Value;
            return $"{mm.Groups[1].Value}{Numbers.WithClass6Concord(Numbers.NumberToWords(n))}";
        });

        // 10) Decimals, LAST of the numeric rules — one word per mark. ⚠ THE TWO ARMS TAKE DIFFERENT TAILS:
        //     Shona has zero period-grouped thousands, so the period arm takes any tail, while the comma arm
        //     keeps the 1–2 cap because comma-grouped thousands here are real.
        s = DECIMAL_DOT.Replace(s, mm => Spell(mm.Groups[1].Value, POINT_WORD, mm.Groups[2].Value));
        s = DECIMAL_COMMA.Replace(s, mm => Spell(mm.Groups[1].Value, COMMA_WORD, mm.Groups[2].Value));

        return Tidy(s);
    }

    /** A padded replacement doubles a space that was already there and can leave one at an edge. */
    private static string Tidy(string s) => EDGE_SPACES.Replace(RUN_OF_SPACES.Replace(s, " "), "");
}
