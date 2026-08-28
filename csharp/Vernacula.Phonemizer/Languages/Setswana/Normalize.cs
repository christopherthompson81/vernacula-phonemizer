/**
 * Setswana / Tswana (tn) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ TWO FUNCTIONS, NOT ONE, and `Setswana.cs` sequences them around the shared symbol tier:
 * `NormalizeSetswanaPost(SYMBOLS(NormalizeSetswanaPre(input)))`. Neither half can move — the HTML entities,
 * the currency magnitude suffix, the rand and the degrees must reach the tier already rewritten; de-grouping
 * and the decimal spell-out must run after it, which is also what keeps the tier's `NOT_VERSION` guard alive
 * for the one-letter `m` key (it works by SEEING the dot, and the decimal rule spends it).
 *
 * Ported from src/languages/setswana/normalize.ts, whose header carries the whole evidential record: the
 * separator census re-measured on tn's own corpus, the glossed attestations behind `dikirii`, `ntlha`,
 * `kwa tlase ga lefela`, the day-part and clock nouns and `go ya go`, and the priced refusals (`€`, `×`,
 * the arithmetic signs, letter names, `ml`/`ft`, fractions, sports times). Nothing is re-derived here.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Setswana;

public static class Normalize
{
    /** The manifest's own conjunction — read from there so the number path and this file cannot drift. */
    private static string AND => Manifest.MANIFEST.Numbers.And;

    private const string DEGREE = "dikirii";
    private static readonly Dictionary<string, string> SCALE = new() { ["C"] = "Celcius", ["F"] = "Fahrenheit" };
    private const string BELOW_ZERO = "kwa tlase ga lefela";
    private const string POINT_WORD = "ntlha";

    /** The digits of a fractional part, spaced so the number path speaks them ONE AT A TIME — which is what
     *  both glossed readings in the corpus do. Reading `75` in `9.75` as a NUMBER would say a different
     *  quantity. */
    private static string Spell(string integer, string frac) =>
        $"{integer} {POINT_WORD} {string.Join(" ", Js.CodePoints(frac))}";

    private static readonly Dictionary<string, string> MAGNITUDE_SUFFIX =
        new(StringComparer.Ordinal) { ["bn"] = "dibilione", ["m"] = "dimilione", ["M"] = "dimilione" };

    private const string MAGNITUDE_WORD = "billion|million|bilione|milione|dibilione|dimilione";

    private const string AM = "mo mosong";
    private const string PM = "thapama";
    /** A day-part already in the text MARKS a colon-number as a clock — and is RE-EMITTED, never consumed. */
    private const string DAYPART = "mo mosong|thapama|maitseboa|mosong|bosigo";
    private const string TZ = "UTC|GMT|CAT|SAST|BST|CET|EST";
    /** Both clock nouns carry their own concord: the hour noun is class 8/10, the minute noun class 4. */
    private const string HOURS = "diura di le";
    private const string MINUTES = "metsotso e le";
    private const string RANGE = "go ya go";

    // ── PASS ONE ────────────────────────────────────────────────────────────
    private static readonly JsRe NBSP_ENTITY = JsRegex.Compile("&nbsp;", "giu");
    private static readonly JsRe SP_ENTITY = JsRegex.Compile("&#x20;", "giu");
    private static readonly JsRe LB_ENTITY = JsRegex.Compile("&#x5B;", "giu");
    private static readonly JsRe RB_ENTITY = JsRegex.Compile("&#x5D;", "giu");
    private static readonly JsRe AMP_ENTITY = JsRegex.Compile("&amp;", "giu");

    private static readonly JsRe CURRENCY_SCALE = JsRegex.Compile(
        "((?:US[ \\u00a0]?\\$|\\$|£|P|R)[ \\u00a0]?\\d[\\d \\u00a0.,]*)(bn|M|m)(?![\\p{L}\\p{M}\\d])", "gu");  // space, NBSP

    private static readonly JsRe RAND = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])R[  ]?(\\d[\\d  .,]*\\d|\\d)(?![\\p{{L}}\\p{{M}}])([  ]*(?:{MAGNITUDE_WORD})(?![\\p{{L}}\\p{{M}}]))?",  // space, NBSP
        "gu");
    /** The discriminator is the AMOUNT, not the sign: a rand figure carries a separator or a magnitude word,
     *  a South African ROAD number is a bare 1–3 digit integer. */
    private static readonly JsRe HAS_SEPARATOR = JsRegex.Compile("[.,  ]", "u");  // NBSP

    private static readonly JsRe DEGREE_SCALE = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\d])([-−–]?)(\\d+(?:[.,]\\d+)?)[ \\u00a0]?°[ \\u00a0]?([CF])(?![\\p{L}\\p{M}])", "gui");  // space, NBSP
    private static readonly JsRe DEGREE_BARE = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(\\d+(?:[.,]\\d+)?)[ \\u00a0]?[°º](?![\\p{L}\\p{M}])", "gu");  // space, NBSP

    /** PASS ONE — everything that must reach the shared symbol tier already rewritten. */
    public static string NormalizeSetswanaPre(string input)
    {
        var s = input;

        // 1) HTML ENTITIES, FIRST OF EVERYTHING — 21 of the artifact's 32 ampersands are `&nbsp;`, and the
        //    entity sits BETWEEN the number and its unit or sign, so the fold is load-bearing for the unit
        //    path and not only for the ampersand.
        s = Rewrite(Rewrite(Rewrite(Rewrite(
            Rewrite(s, NBSP_ENTITY, " "), SP_ENTITY, " "), LB_ENTITY, "["), RB_ENTITY, "]"), AMP_ENTITY, "&");

        // 2) A MAGNITUDE SUFFIX GLUED TO A CURRENCY AMOUNT → the magnitude word, before the tier claims the
        //    number. ⚠ ANCHORED ON THE CURRENCY SIGN, which is the whole guard: `915 m` is metres.
        s = Rewrite(s, CURRENCY_SCALE, m =>
            $"{m.Groups[1].Value} {MAGNITUDE_SUFFIX[m.Groups[2].Value]}");

        // 3) THE RAND, LOCALLY — the tier cannot express the guard this sign needs.
        s = Rewrite(s, RAND, m =>
        {
            var n = m.Groups[1].Value;
            var mag = m.Groups[2].Success ? m.Groups[2].Value : null;
            var scaled = mag is not null && mag != "";
            if (!scaled && !HAS_SEPARATOR.IsMatch(n)) return m.Value; // a bare small integer is a road, not money
            return $"diranta di le {n}{mag ?? ""}";
        });

        // 4) DEGREES, before the tier and before every numeric rule in pass two. ⚠ THE MINUS ARM IS CLAIMED
        //    ONLY HERE, on a scale-marked degree — never on a bare number.
        s = Rewrite(s, DEGREE_SCALE, m =>
        {
            var sign = m.Groups[1].Value;
            var n = m.Groups[2].Value;
            var sc = SCALE[m.Groups[3].Value.ToUpperInvariant()];
            return sign == ""
                ? $"{DEGREE} tsa {sc} di le {n}"
                : $"{DEGREE} tsa {sc} tse di {BELOW_ZERO} di le {n}";
        });
        //    A BARE degree — a coordinate, or the open end of a temperature span.
        s = Rewrite(s, DEGREE_BARE, $"{DEGREE} di le $1");

        return s;
    }

    // ── PASS TWO ────────────────────────────────────────────────────────────
    private static readonly JsRe CLOCK = JsRegex.Compile(
        $"(?<![\\d:.,])([01]?\\d|2[0-3]):[  ]?([0-5]\\d)(?![:.\\d])"  // NBSP
        + $"(?:[  ]*(?:([AaPp])\\.?[Mm]\\.?|({TZ})(?![\\p{{L}}\\p{{M}}])|({DAYPART})(?![\\p{{L}}\\p{{M}}])))",  // space, NBSP
        "gu");

    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:,\\d{3})+(?![\\d]|[.,]\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe GROUP_DOT =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:\\.\\d{3})+(?![\\d]|[.,]\\d)", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe GROUP_SPACE =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:[ \\u00a0\\u202f\\u2009]\\d{3})+(?![\\d])", "gu");  // space, NBSP, NNBSP, thin space
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space

    private static readonly JsRe ENGLISH_ORDINAL =
        JsRegex.Compile("(\\d+)(?:st|nd|rd|th)(?![\\p{L}\\p{M}])", "giu");

    private static readonly JsRe DASH_RANGE = JsRegex.Compile(
        "(?<![-\\d.,\\p{L}\\p{M}])(\\d+)[ \\u00a0]?[-–—][ \\u00a0]?(\\d+)(?![-\\d\\p{L}\\p{M}]|[.,]\\d)", "gu");  // space, NBSP

    /** ⚠ A SPAN WHOSE UNIT SITS AFTER THE SECOND OPERAND (#1104), matched on the TIER'S OUTPUT — by the
     *  time ranges run, `5 kg` is already `dikilogerama di le 5` with the measure noun in front, so
     *  `DASH_RANGE` sees no pair of digits. Keyed on the `di le` concord rather than on the unit table,
     *  which lives in Setswana.cs. See the TS for why moving ranges above the tier does not work. */
    private static readonly JsRe DASH_RANGE_UNIT = JsRegex.Compile(
        "(?<![-\\d.,\\p{L}\\p{M}])(\\d+)[ \\u00a0]?[-–—][ \\u00a0]?"  // space, NBSP
        + "((?:\\p{L}+[ \\u00a0])?\\p{L}+[ \\u00a0]di[ \\u00a0]le[ \\u00a0])(\\d+)(?![-\\d\\p{L}\\p{M}]|[.,]\\d)", "gu");

    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d{1,2})(?![\\d])", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d{1,2})(?![\\d,])", "gu");
    private static readonly JsRe DECIMAL_ZERO_LONG =
        JsRegex.Compile("(?<![\\d.,])(0)[.,](\\d{3,})(?![\\d])", "gu");

    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[^\\S\\n]{2,}", "gu");
    private static readonly JsRe EDGE_SPACE = JsRegex.Compile("^[^\\S\\n]+|[^\\S\\n]+$", "gu");

    /** PASS TWO — everything that must run after the shared symbol tier has attached its nouns. */
    public static string NormalizeSetswanaPost(string input)
    {
        var s = input;

        // 5) THE CLOCK — and the MARKER identifies it, not the shape: all 13 true clocks in the artifact
        //    carry a right-hand marker and not one of the 20 sports times does.
        s = Rewrite(s, CLOCK, m =>
        {
            var hv = Js.Number(m.Groups[1].Value);
            var mv = Js.Number(m.Groups[2].Value);
            if (hv > 23 || mv > 59) return m.Value;
            // `:00` emits the hour alone — the alternative is the manifest's zero word, and "seven hours and
            // zero minutes" is not a reading of 7:00 in any language.
            var body = mv == 0
                ? $"{HOURS} {Js.NumberToString(hv)}"
                : $"{HOURS} {Js.NumberToString(hv)} {AND} {MINUTES} {Js.NumberToString(mv)}";
            if (m.Groups[3].Success)
                return $"{body} {(m.Groups[3].Value.ToLowerInvariant() == "p" ? PM : AM)}";
            return $"{body} {(m.Groups[4].Success ? m.Groups[4].Value : m.Groups[5].Value)}";
        });

        // 6) THOUSANDS DE-GROUPING, before every remaining numeric rule. ⚠ EXACTLY THREE DIGITS PER BLOCK,
        //    and the head must start 1–9 — that guard is what separates period-grouping from period-decimal.
        s = Rewrite(s, GROUP_COMMA, m => COMMAS.Replace(m.Value, ""));
        s = Rewrite(s, GROUP_DOT, m => DOTS.Replace(m.Value, ""));
        s = Rewrite(s, GROUP_SPACE, m => SPACE_SEPS.Replace(m.Value, ""));

        // 7) THE ENGLISH ORDINAL SUFFIX — always foreign orthography here, and it was reaching the phoneme
        //    stream as a bare [tʰ]. Stripping it is the whole fix.
        s = Rewrite(s, ENGLISH_ORDINAL, "$1");

        // 8) RANGES → `go ya go`. ⚠ ASCENDING ONLY: the non-ascending pairs are football scores and SEASONS.
        s = Rewrite(s, DASH_RANGE, m =>
            Js.Number(m.Groups[1].Value) < Js.Number(m.Groups[2].Value)
                ? $"{m.Groups[1].Value} {RANGE} {m.Groups[2].Value}"
                : m.Value);

        // 8b) …and the same span with the tier's measure-noun phrase between the operands.
        s = Rewrite(s, DASH_RANGE_UNIT, m =>
            Js.Number(m.Groups[1].Value) < Js.Number(m.Groups[3].Value)
                ? $"{m.Groups[2].Value}{m.Groups[1].Value} {RANGE} {m.Groups[3].Value}"
                : m.Value);

        // 9) DECIMALS, LAST of the numeric rules — steps 5 to 8 all need their number intact, and the tier's
        //    `NOT_VERSION` guard needs the dot to still be there when it looks.
        s = Rewrite(s, DECIMAL_DOT, m => Spell(m.Groups[1].Value, m.Groups[2].Value));
        s = Rewrite(s, DECIMAL_COMMA, m => Spell(m.Groups[1].Value, m.Groups[2].Value));
        //    ⚠ AND A THIRD ARM FOR THE LEADING-ZERO LONG TAIL, which the other two and step 6 all decline by
        //    design and which therefore fell through to `clausePunctuation` as a SENTENCE BREAK.
        s = Rewrite(s, DECIMAL_ZERO_LONG, m => Spell(m.Groups[1].Value, m.Groups[2].Value));

        // A padded replacement doubles a space that was already there and can leave one at an edge.
        return Rewrite(Rewrite(s, MULTI_SPACE, " "), EDGE_SPACE, "");
    }
}
