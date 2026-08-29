/**
 * Kinyarwanda (rw) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 * ⚠ THIS FILE OWNS THE SHARED-TIER CALL (step 8): rw needs de-grouping BEFORE it and the decimal
 * spell-out AFTER it, and neither the Xhosa order nor the Chichewa one can express that.
 * Ported from src/languages/kinyarwanda/normalize.ts — see that file for the corpus evidence behind every
 * arm, every word, and every rule deliberately not written.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Kinyarwanda;

public static class Normalize
{
    /** The manifest's own conjunction and zero word, so neither can drift from the numeral path. */
    private static readonly string AND = Manifest.MANIFEST.Numbers.And;
    private static readonly string ZERO = Manifest.MANIFEST.Numbers.Units[0];

    /** THE MEASURE NOUNS, one table shared by the tier (step 8) and by step 3 (unit-then-number).
     *  ⚠ INSERTION-ORDERED, like JS `Object.keys`: the PRE/RANGE/DENOM alternations below are built by a
     *  STABLE length-descending sort over this order, so the declaration sequence is load-bearing. */
    private static readonly IReadOnlyList<KeyValuePair<string, string>> UNIT = new[]
    {
        new KeyValuePair<string, string>("km", "kilometero"),
        new KeyValuePair<string, string>("m", "metero"),
        new KeyValuePair<string, string>("cm", "santimetero"),
        new KeyValuePair<string, string>("mm", "milimetero"),
        new KeyValuePair<string, string>("kg", "kirogarama"),
        new KeyValuePair<string, string>("g", "garama"),
        new KeyValuePair<string, string>("gm", "garama"),
        new KeyValuePair<string, string>("gr", "garama"),
        new KeyValuePair<string, string>("ml", "mililitiro"),
        new KeyValuePair<string, string>("l", "litiro"),
        new KeyValuePair<string, string>("ha", "hegitari"),
    };

    private static readonly IReadOnlyDictionary<string, string> UNIT_MAP =
        UNIT.ToDictionary(kv => kv.Key, kv => kv.Value, StringComparer.Ordinal);

    private const string SQUARED = "kare";
    private const string CUBED = "kibe";

    private const string DEGREE = "dogere";
    private const string CELSIUS = "selisiyusi";
    private static readonly string BELOW_ZERO = $"munsi ya {ZERO}";

    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["N"] = "amajyaruguru", ["S"] = "amajyepfo", ["E"] = "iburasirazuba", ["W"] = "uburengerazuba",
    };

    private const string HOUR_MARKER = "saa";
    private const string MINUTES = "iminota";
    private const string HOURS = "amasaha";
    private const string SECONDS = "amasegonda";

    private const string TZ = "UTC|GMT|CAT|EAT|WAT|CET|EST|BST";

    private static string Alternation(Func<string, bool> keep) =>
        string.Join("|", UNIT.Where(kv => keep(kv.Key)).Select(kv => kv.Key).OrderByDescending(k => k.Length));

    private static readonly string PRE_UNIT = Alternation(k => k.Length > 1 || k == "m");
    private static readonly string RANGE_UNIT = Alternation(_ => true);
    private static readonly string DENOM_UNIT = Alternation(k => k.Length > 1);

    /** The shared symbol tier. Sourcing for every word is in the TS header; `magnitudes`, `bareExponent`,
     *  `multiply` and `€` are deliberately withheld there. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "ku ijana" },
        // ⚠ INSERTION-ORDERED, like JS `Object.keys`: the tier sorts currency keys longest-first, stably.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "amadolari" },
            ["$"] = new[] { "amadolari" },
            ["FRw"] = new[] { "amafaranga y'u Rwanda" },
            ["Frw"] = new[] { "amafaranga y'u Rwanda" },
            ["RWF"] = new[] { "amafaranga y'u Rwanda" },
            ["Rwf"] = new[] { "amafaranga y'u Rwanda" },
        },
        CurrencyPrefix = true,
        // ⚠ Magnitudes IS NOW DECLARED, AND SO IS THE ORDER. The old refusal was true and was also the
        // defect: the tier's magAlt matched NUMBER-then-magnitude, Kinyarwanda writes the other order
        // (30 corpus instances, no counter-example), so the hop never fired and the currency arm claimed
        // the number alone — putting the noun BETWEEN the magnitude and its count. See the TS docstring.
        Magnitudes = ["miliyari", "miliyoni", "igihumbi", "ibihumbi"],
        MagnitudePrecedes = true,
        // Derived from the ONE table above, so the tier and step 3 can never name different words for one key.
        Units = UNIT.ToDictionary(kv => kv.Key, kv => (IReadOnlyList<string>)new[] { kv.Value }, StringComparer.Ordinal),
        UnitPrefix = true,
        UnitPer = "kuri",
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { SQUARED }, Cubed = new[] { CUBED }, Position = ExponentPosition.After,
        },
        Ampersand = AND,
    });

    private static readonly JsRe DOTTED_RUN = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(?:\\p{Lu}\\.[ \u00a0]?){2,}(?:\\p{Lu}(?![\\p{L}\\p{M}]))?", "gu");
    private static readonly JsRe DOTS_AND_SPACES = JsRegex.Compile("[. \u00a0]", "gu");
    private static readonly JsRe LEADING_LETTER = JsRegex.Compile("^[\\p{L}\\p{M}]", "u");
    private static readonly JsRe LEADING_SPACE_CAP = JsRegex.Compile("^[ \u00a0]+\\p{Lu}", "u");

    private const string NOT_COORD = "(?![ \u00a0\u202f\u2009]?[°º])";
    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile($"(?<![\\d.,])[1-9]\\d{{0,2}}(?:,\\d{{3}})+(?!\\d|[.,]\\d){NOT_COORD}", "gu");
    private static readonly JsRe GROUP_DOT =
        JsRegex.Compile($"(?<![\\d.,])[1-9]\\d{{0,2}}(?:\\.\\d{{3}})+(?!\\d|[.,]\\d){NOT_COORD}", "gu");
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile(
        "(?<![\\d.,])[1-9]\\d{0,2}(?:[ \u00a0\u202f\u2009]\\d{3})+(?!\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe GROUP_SPACES = JsRegex.Compile("[ \u00a0\u202f\u2009]", "gu");

    private static readonly JsRe UNIT_BEFORE = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])({PRE_UNIT})(²|³|(?<=[a-zA-Z])[23](?![\\d\\p{{L}}]))?(?=[ \u00a0]\\d)", "giu");

    private static readonly JsRe DECIMAL_WHOLE = JsRegex.Compile("^(\\d+)[.,](\\d+)$", "u");
    private static readonly JsRe DEGREE_NEG = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\d])[-−–][ \u00a0]?(\\d+(?:[.,]\\d+)?)[ \u00a0]?°[ \u00a0]?([CF])(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEGREE_RANGE = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\d.,-])(\\d+)[ \u00a0]?[-–—][ \u00a0]?(\\d+)[ \u00a0]?°[ \u00a0]?([CF])?(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEGREE_SCALE = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(\\d+(?:[.,]\\d+)?)[ \u00a0]?°[ \u00a0]?([CF])(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEGREE_COMPASS = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(\\d+(?:[.,]\\d+)?)[ \u00a0]?°((?:[ \u00a0]?\\d+[′'][ \u00a0]?)?(?:\\d+[″\"][ \u00a0]?)?)[ \u00a0]?([NSEW])(?![\\p{L}\\p{M}])",
        "gu");
    private static readonly JsRe DEGREE_BARE = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])(\\d+(?:[.,]\\d+)?)[ \u00a0]?[°º](?![\\p{L}\\p{M}])", "gu");

    private static readonly JsRe CLOCK = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])({HOUR_MARKER})[ \u00a0]+([01]?\\d|2[0-3]):[ \u00a0]?([0-5]\\d)(?![:.\\d])", "giu");
    private static readonly JsRe TIMESTAMP = JsRegex.Compile(
        $"(?<![\\d:])(\\d{{1,2}}):(\\d{{2}}):(\\d{{2}})(?=[ \u00a0]*(?:{TZ})(?![\\p{{L}}\\p{{M}}]))", "gu");
    private static readonly JsRe DURATION = JsRegex.Compile(
        "(?<![\\d:.])(\\d{1,2}):[ \u00a0]?(\\d{2}):[ \u00a0]?(\\d{2})(?![:.\\d])", "gu");
    private static readonly JsRe COLON_PAIR = JsRegex.Compile("(?<![\\d:])(\\d{1,2}):[ \u00a0]?(\\d{2})(?![:\\d])", "gu");

    private static readonly JsRe PERCENT_SPAN = JsRegex.Compile(
        "(?<![\\d.,])(\\d+)[ \u00a0]?%[ \u00a0]?[-–—][ \u00a0]?(\\d+)[ \u00a0]?%", "gu");
    private static readonly JsRe SPAN_WITH_UNIT = JsRegex.Compile(
        $"(?<![-\\d.,\\p{{L}}\\p{{M}}])(\\d+)[ \u00a0]?[-–—][ \u00a0]?(\\d+)[ \u00a0]?({RANGE_UNIT})(²|³|(?<=[a-zA-Z])[23](?![\\d\\p{{L}}]))?(?![\\p{{L}}\\p{{M}}\\d'’])",
        "gu");
    private static readonly JsRe SPAN_BARE = JsRegex.Compile(
        "(?<![-\\d.,\\p{L}\\p{M}])(\\d+)[ \u00a0]?[-–—][ \u00a0]?(\\d+)(?![-\\d\\p{L}\\p{M}]|[.,]\\d)", "gu");

    private static readonly JsRe DENOM_SLASH = JsRegex.Compile(
        $"/[ \u00a0]?({DENOM_UNIT})(²|³|(?<=[a-zA-Z])[23](?![\\d\\p{{L}}]))?(?![\\p{{L}}\\p{{M}}\\d'’])", "giu");
    private static readonly JsRe BARE_EXPONENT_UNIT = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])({DENOM_UNIT}|m)(²|³)(?![\\p{{L}}\\p{{M}}\\d'’])", "giu");

    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d{1,2})(?!\\d|[.,]\\d)", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d{1,2})(?!\\d|[.,]\\d)", "gu");
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
     *  `dogere`, checked on BOTH sides. ⚠ A MARKED occurrence is stripped first — see INSERTED. */
    private static bool SaidNear(string full, int offset, int end, string word) =>
        Slice(full, offset - 45, end + 45).Replace(INSERTED + word, "", StringComparison.Ordinal)
            .Contains(word, StringComparison.Ordinal);

    /// <summary>⚠ THE MARK THAT KEEPS THE REDUNDANCY GUARD FROM READING ITS OWN OUTPUT.
    /// <para>SaidNear asks one question — did the WRITER already write this word? — so it must look at what
    /// the writer wrote. It reads the pre-replacement string, which within one pass is exactly right (two
    /// matches in the same pass are invisible to each other). Across passes it was not: by 4c the string
    /// carried 4a's INSERTED `dogere`, so one construction got two answers —
    /// `−27.2 °C (−17.0 °F)` said it twice (both figures 4a, one pass) while `−14.4 °C (6.1 °F)` said it
    /// once, and the parenthetical lost its noun AND its scale, reading a bare *(6 1)*.</para>
    /// <para>Every emitted `dogere` is prefixed with U+0000; the guard strips a marked occurrence before
    /// testing; the marks come off after 4e, the LAST arm. Exact where a pre-block snapshot is not — the
    /// arms rewrite as they go, so any offset into a frozen copy drifts.</para></summary>
    private const string INSERTED = "\u0000";
    private static readonly JsRe INSERTED_RE = JsRegex.Compile("\\u0000", "gu");

    private static string SpellDec(string n)
    {
        var m = DECIMAL_WHOLE.Match(n);
        return m.Success ? Spell(m.Groups[1].Value, m.Groups[2].Value) : n;
    }

    private static string DegreeBody(string n, int off, int end, string full, string scale) =>
        $"{(SaidNear(full, off, end, DEGREE) ? "" : $"{INSERTED}{DEGREE} ")}{scale}{SpellDec(n)}";

    /** The scale slot: Celsius is NAMED, Fahrenheit is CLAIMED but left unsaid — see the TS header. */
    private static string Scale(Group sc) =>
        sc.Success && sc.Value.ToUpperInvariant() == "C" ? $"{CELSIUS} " : "";

    private static string Exponent(Group exp) =>
        !exp.Success ? "" : $" {(exp.Value == "²" || exp.Value == "2" ? SQUARED : CUBED)}";

    /** Normalize one Kinyarwanda input string. Steps are ORDER-DEPENDENT; the TS states each coupling. */
    public static string NormalizeKinyarwanda(string input)
    {
        var s = input;

        // 1) DOTTED CAPITAL RUNS → the bare letters, before anything reads an interior dot as a break.
        //    ⚠ A DOT IS ONLY EVER KEPT, NEVER ADDED (`run.endsWith(".")`) — where this departs from nya.
        // ⚠ `full` IS THE PRE-REPLACE STRING, as JS's replace callback argument is — snapshot it, or the
        // closure would see `s` as reassigned by this very statement. (Same for every pass below.)
        var src1 = s;
        s = Rewrite(s, DOTTED_RUN, mm =>
        {
            var run = mm.Value;
            var letters = JsRegex.Replace(run, DOTS_AND_SPACES, "");
            var rest = Slice(src1, mm.Index + run.Length, src1.Length);
            if (LEADING_LETTER.IsMatch(rest)) return $"{letters} ";
            if (!run.EndsWith(".", StringComparison.Ordinal)) return letters;
            return rest == "" || LEADING_SPACE_CAP.IsMatch(rest) ? $"{letters}." : letters;
        });

        // 2) THOUSANDS DE-GROUPING, before every remaining numeric rule AND before the tier — a grouped
        //    `1.300m` must reach the tier de-grouped or `NOT_VERSION` refuses the metre.
        s = Rewrite(s, GROUP_COMMA, mm => COMMAS.Replace(mm.Value, ""));
        s = Rewrite(s, GROUP_DOT, mm => DOTS.Replace(mm.Value, ""));
        s = Rewrite(s, GROUP_SPACE, mm => GROUP_SPACES.Replace(mm.Value, ""));

        // 3) A UNIT ABBREVIATION WRITTEN BEFORE ITS NUMBER — structurally invisible to the shared tier.
        s = Rewrite(s, UNIT_BEFORE, mm =>
            $"{UNIT_MAP[Js.ToLowerCase(mm.Groups[1].Value)]}{Exponent(mm.Groups[2])}");

        // 4) DEGREES — four arms plus the coordinate one, ordered longest-first so `°C` is not claimed by
        //    the bare arm. BEFORE step 10, which would otherwise break the number↔sign adjacency.
        //    4a) A NEGATIVE TEMPERATURE — the only slot with an attested reading for the sign.
        var src4a = s;
        s = Rewrite(s, DEGREE_NEG, mm =>
            $"{DegreeBody(mm.Groups[1].Value, mm.Index, mm.Index + mm.Length, src4a, Scale(mm.Groups[2]))} {BELOW_ZERO}");
        //    4b) A RANGE OF DEGREES — claimed HERE and not by step 7, because the noun heads the whole span.
        var src4b = s;
        s = Rewrite(s, DEGREE_RANGE, mm =>
        {
            var a = mm.Groups[1].Value;
            var b = mm.Groups[2].Value;
            return Js.Number(a) < Js.Number(b)
                ? $"{DegreeBody(a, mm.Index, mm.Index + mm.Length, src4b, Scale(mm.Groups[3]))} kugeza kuri {b}"
                : mm.Value;
        });
        //    4c) A SCALE TEMPERATURE.
        var src4c = s;
        s = Rewrite(s, DEGREE_SCALE, mm =>
            DegreeBody(mm.Groups[1].Value, mm.Index, mm.Index + mm.Length, src4c, Scale(mm.Groups[2])));
        //    4d) A COORDINATE — the compass letter is a DIRECTION, not a scale.
        var src4d = s;
        s = Rewrite(s, DEGREE_COMPASS, mm =>
            $"{DegreeBody(mm.Groups[1].Value, mm.Index, mm.Index + mm.Length, src4d, "")} {mm.Groups[2].Value}{COMPASS[mm.Groups[3].Value]}");
        //    4e) A BARE DEGREE.
        var src4e = s;
        s = Rewrite(s, DEGREE_BARE, mm =>
            DegreeBody(mm.Groups[1].Value, mm.Index, mm.Index + mm.Length, src4e, ""));
        // ⚠ THE MARKS COME OFF HERE — AFTER 4e, the LAST arm. A step earlier and 4e would read a `dogere`
        // this file inserted as one the WRITER wrote, and suppress a noun it should emit. Unconditional and
        // once, so no mark reaches the phoneme stream even if an arm declines.
        s = Rewrite(s, INSERTED_RE, ""); // the sentinel comes off the PIPELINE string — see Gan for the shape

        // 5) The English ordinal suffix is NOT stripped — there is nothing to strip. See the TS.

        // 6) COLON TIMES. The colon is clausePunctuation, so every one of these emitted comma PAUSES
        //    inside a single quantity. ⚠ THE MARKER IS WHAT IDENTIFIES A CLOCK, not the shape.
        s = Rewrite(s, CLOCK, mm =>
        {
            var mark = mm.Groups[1].Value;
            var h = Js.NumberToString(Js.Number(mm.Groups[2].Value));
            var mv = Js.Number(mm.Groups[3].Value);
            return mv == 0 ? $"{mark} {h}" : $"{mark} {h} {AND} {MINUTES} {Js.NumberToString(mv)}";
        });
        //    A THREE-FIELD run WITH a timezone is a timestamp: the colons simply stop being clauses.
        s = Rewrite(s, TIMESTAMP, "$1 $2 $3");
        //    A THREE-FIELD run WITHOUT one is a RACE DURATION.
        s = Rewrite(s, DURATION, mm =>
            $"{HOURS} {Js.NumberToString(Js.Number(mm.Groups[1].Value))} {MINUTES} " +
            $"{Js.NumberToString(Js.Number(mm.Groups[2].Value))} {SECONDS} {Js.NumberToString(Js.Number(mm.Groups[3].Value))}");
        //    ANY REMAINING `N:NN` keeps its digits but loses the spurious pause.
        s = Rewrite(s, COLON_PAIR, "$1 $2");

        // 7) RANGES → `kugeza kuri`, ASCENDING ONLY. A PERCENT SPAN is claimed first and keeps ONE sign.
        s = Rewrite(s, PERCENT_SPAN, mm =>
        {
            var a = mm.Groups[1].Value;
            var b = mm.Groups[2].Value;
            return Js.Number(a) < Js.Number(b) ? $"{a} kugeza kuri {b}%" : mm.Value;
        });
        //    FIRST ARM: a span whose second operand carries the UNIT — the noun is HOISTED to the front.
        s = Rewrite(s, SPAN_WITH_UNIT, mm =>
        {
            var a = mm.Groups[1].Value;
            var b = mm.Groups[2].Value;
            if (Js.Number(a) >= Js.Number(b)) return mm.Value;
            return $"{UNIT_MAP[mm.Groups[3].Value]}{Exponent(mm.Groups[4])} {a} kugeza kuri {b}";
        });
        //    SECOND ARM: the bare span.
        s = Rewrite(s, SPAN_BARE, mm =>
        {
            var a = mm.Groups[1].Value;
            var b = mm.Groups[2].Value;
            return Js.Number(a) < Js.Number(b) ? $"{a} kugeza kuri {b}" : mm.Value;
        });

        // 8) THE SHARED SYMBOL TIER — between steps 2 and 10 BY NECESSITY, in both directions.
        s = SYMBOLS(s);

        // 9) A UNIT USED AS A BARE DENOMINATOR, with no numeral of its own. AFTER the tier, so a surviving
        //    `/unit` is one that had no numerator. MULTI-LETTER KEYS ONLY — a one-letter key here would
        //    read a URL path segment as a unit.
        s = Rewrite(s, DENOM_SLASH, mm =>
            $" kuri {UNIT_MAP[Js.ToLowerCase(mm.Groups[1].Value)]}{Exponent(mm.Groups[2])}");
        //    AND THE SAME GAP WITHOUT THE SLASH — claimed ONLY when an EXPONENT is present.
        s = Rewrite(s, BARE_EXPONENT_UNIT, mm =>
            $"{UNIT_MAP[Js.ToLowerCase(mm.Groups[1].Value)]} {(mm.Groups[2].Value == "²" ? SQUARED : CUBED)}");

        // 9b) A lone `+`, `=` or `×` is left unread, deliberately — see the TS header.

        // 10) DECIMALS, LAST of the numeric rules — and the rule that spends the dot `NOT_VERSION` needs.
        s = Rewrite(s, DECIMAL_DOT, mm => Spell(mm.Groups[1].Value, mm.Groups[2].Value));
        s = Rewrite(s, DECIMAL_COMMA, mm => Spell(mm.Groups[1].Value, mm.Groups[2].Value));

        return Rewrite(Rewrite(s, RUN_OF_SPACES, " "), EDGE_SPACES, "");
    }
}
