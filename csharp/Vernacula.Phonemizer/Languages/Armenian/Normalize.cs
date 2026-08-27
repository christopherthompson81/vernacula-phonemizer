/**
 * Eastern Armenian (hy) text normalization — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/armenian/normalize.ts — see that file for the corpus counts, the per-word
 * sourcing, and the refusals (the bare-colon clock, the range joiner, the plus, the initialisms).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Armenian;

public static class Normalize
{
    private static readonly NumbersDef NUMBERS = Manifest.MANIFEST.Numbers;

    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // DATA
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    /** Armenian lowercase letters, for a bound suffix. `և` (U+0587) sits outside the ա–ֆ range. */
    private const string ARM_LOWER = "[\\u0561-\\u0586\\u0587]";

    /** The MAGNITUDE words, abbreviated → spelled. Longest first. */
    private static readonly (string Abbr, string Full)[] MAGNITUDE_ABBREV =
    [
        ("մլրդ", "միլիարդ"),
        ("մլդ", "միլիարդ"),
        ("տրլն", "տրիլիոն"),
        ("մլն", "միլիոն"),
        ("հզր", "հազար"),
    ];

    /** The spelled magnitudes, used as the DECIMAL discriminator in step 1c. */
    private static readonly string[] MAGNITUDE_WORDS =
        ["միլիոն", "միլիարդ", "տրիլիոն", "հազար", "մլն", "մլրդ", "մլդ", "տրլն", "հզր"];

    /** Unit abbreviations handled LOCALLY, for the two shapes the shared tier cannot reach. `գ` is
     *  deliberately absent — this corpus writes `գ.` for ԳՅՈՒՂ, "village". */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["կմ"] = "կիլոմետր",
            ["սմ"] = "սանտիմետր",
            ["մմ"] = "միլիմետր",
            ["կգ"] = "կիլոգրամ",
            ["հա"] = "հեկտար",
            ["դմ"] = "դեցիմետր",
            ["մ"] = "մետր",
        };

    /** Longest-first, so `կմ` is tried before `մ`. ⚠ STABLE, like JS's sort: declaration order within a
     *  length. */
    private static readonly IReadOnlyList<string> UNIT_KEYS =
        UNIT_WORD.Keys.OrderByDescending(k => k.Length).ToList();

    /** The exponent measure words, in the position both sources put them: BEFORE the unit noun. */
    private static readonly IReadOnlyDictionary<string, string> EXPONENT_WORD =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["²"] = "քառակուսի", ["³"] = "խորանարդ" };

    /** The month names in the GENITIVE — the form the corpus's date frame takes. */
    private static readonly string[] MONTH_GENITIVE =
    [
        "հունվարի", "փետրվարի", "մարտի", "ապրիլի", "մայիսի", "հունիսի",
        "հուլիսի", "օգոստոսի", "սեպտեմբերի", "հոկտեմբերի", "նոյեմբերի", "դեկտեմբերի",
    ];

    /** Read from the manifest — see the jsonc, where the evidence lives. */
    private static IReadOnlyDictionary<string, string> IRREGULAR_ORDINAL => Manifest.MANIFEST.IrregularOrdinals;

    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // NUMBER WORDS + ARMENIAN SUFFIX MORPHOPHONOLOGY
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    /** Integer → the Armenian cardinal as SPACE-SEPARATED WORDS. `null` when it cannot compose. */
    private static string? CardinalWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n > 999_999_999_999) return null;
        var parts = Core.Numbers.westernNumberWords(n, NUMBERS);
        if (parts.Any(p => p == null || p == "")) return null;
        return string.Join(" ", parts);
    }

    /** Attach a CASE/ARTICLE suffix to a cardinal's last word, with the two attested stem changes:
     *  `երկու` → `երկուս-` (suppletive oblique) and a final `ը` DROPS. */
    private static string AttachSuffix(string cardinal, string suffix)
    {
        var words = cardinal.Split(' ');
        var stem = words[^1];
        if (stem.EndsWith("երկու", StringComparison.Ordinal)) stem = $"{stem}ս";
        else if (stem.EndsWith("ը", StringComparison.Ordinal)) stem = stem[..^1];
        words[^1] = $"{stem}{suffix}";
        return string.Join(" ", words);
    }

    /** Integer → the Armenian ORDINAL: the cardinal with `-երորդ` on its LAST word, and a final `ը`
     *  becoming `ն`. 1–4 are suppletive standalone only. */
    public static string? OrdinalWords(double n)
    {
        if (IRREGULAR_ORDINAL.TryGetValue(Js.NumberToString(n), out var irregular)) return irregular;
        var cardinal = CardinalWords(n);
        if (cardinal == null) return null;
        var words = cardinal.Split(' ');
        var stem = words[^1];
        if (stem.EndsWith("ը", StringComparison.Ordinal)) stem = $"{stem[..^1]}ն";
        words[^1] = $"{stem}երորդ";
        return string.Join(" ", words);
    }

    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // THE PASS — a numbered, order-dependent sequence. Each step's coupling is stated in the TS.
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    private static readonly JsRe DIGITS_ONLY = JsRegex.Compile(@"^\d+$", "u");

    // ⚠ ՛ ՜ ՞ ARE NO LONGER HANDLED HERE — the rule moved to `Armenian.UnbreakMarks`, applied to the input
    // before this normalizer runs. The word they split is split by the SHARED tokenizer, so keeping the fix
    // in one dialect's normalizer left the other dialect broken. See the TS docstring.

    private const string DOT = "[.\\u2024]";

    private static readonly JsRe GROUP_SPACE = JsRegex.Compile(
        @"(?<!\d)(?<!\d[.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)(?![.,]\d)", "gu");
    private static readonly JsRe GROUP_SPACE_SEP = JsRegex.Compile(@"[ \u00a0\u202f\u2009]", "gu");
    private static readonly JsRe GROUP_MULTI = JsRegex.Compile(
        @"(?<!\d)(?<!\d[.,])([1-9]\d{0,2})((?:([.,])\d{3}){2,})(?!\d)(?![.,]\d)", "gu");
    private static readonly JsRe GROUP_MULTI_SEP = JsRegex.Compile(@"[.,]", "gu");
    private static readonly JsRe GROUP_ONE = JsRegex.Compile(
        "(?<!\\d)(?<!\\d[.,])([1-9]\\d{0,2})[.,](\\d{3})(?!\\d)(?![.,]\\d)(\\s*(?:"
        + string.Join("|", MAGNITUDE_WORDS) + ")" + Boundaries.NOT_LETTER_AFTER + "|\\s*[×x%])?", "gu");

    private static readonly JsRe DOTTED_DATE = JsRegex.Compile(
        @"(?<!\d)(?<!\d[.,])(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)(?![.,]\d)", "gu");

    private static readonly JsRe ERA_BCE = JsRegex.Compile(
        Boundaries.NOT_LETTER_BEFORE + "[Մմ]" + DOT + "\\s?թ" + DOT + "\\s?ա" + DOT + "?", "gu");
    private static readonly JsRe ERA_BC = JsRegex.Compile(
        Boundaries.NOT_LETTER_BEFORE + "[Քք]" + DOT + "\\s?ա" + DOT + "?", "gu");
    private static readonly JsRe ERA_CE = JsRegex.Compile(
        Boundaries.NOT_LETTER_BEFORE + "[Մմ]" + DOT + "\\s?թ" + DOT, "gu");

    private static readonly (string Abbr, string Full)[] COORD_ABBREV =
    [
        ("հս", "հյուսիսային"), ("հվ", "հարավային"), ("արլ", "արևելյան"), ("արմ", "արևմտյան"),
    ];
    private static readonly (JsRe Lat, JsRe Lon, string Full)[] COORD_RULES = COORD_ABBREV
        .Select(p => (
            JsRegex.Compile(Boundaries.NOT_LETTER_BEFORE + p.Abbr + DOT + "\\s?լ" + DOT, "gu"),
            JsRegex.Compile(Boundaries.NOT_LETTER_BEFORE + p.Abbr + DOT + "\\s?ե" + DOT, "gu"),
            p.Full))
        .ToArray();

    private static readonly JsRe ABBR_YEARS_PL = JsRegex.Compile("(\\d|" + ARM_LOWER + ")\\s?թթ" + DOT, "gu");
    private static readonly JsRe ABBR_YEAR = JsRegex.Compile("(\\d|" + ARM_LOWER + ")\\s?թ" + DOT, "gu");
    private static readonly JsRe ABBR_SQUARE = JsRegex.Compile(Boundaries.NOT_LETTER_BEFORE + "քառ" + DOT, "gu");
    private static readonly JsRe ABBR_SAINT = JsRegex.Compile(Boundaries.NOT_LETTER_BEFORE + "Սբ" + DOT, "gu");
    private static readonly (JsRe Re, string Full)[] MAGNITUDE_RULES = MAGNITUDE_ABBREV
        .Select(p => (JsRegex.Compile(Boundaries.NOT_LETTER_BEFORE + p.Abbr + Boundaries.NOT_LETTER_AFTER, "gu"), p.Full))
        .ToArray();

    private static readonly JsRe ASCII_EXPONENT = JsRegex.Compile(
        "([\\d/\\s])(" + string.Join("|", UNIT_KEYS) + ")([23])(?![\\d])" + Boundaries.NOT_LETTER_AFTER, "gu");
    private static readonly JsRe UNIT_SUFFIXED = JsRegex.Compile(
        "(\\d\\s?)(" + string.Join("|", UNIT_KEYS) + ")([²³]?)[-\\u2010\\u2011\\u2013\\u2014](" + ARM_LOWER + "+)"
        + Boundaries.NOT_LETTER_AFTER, "gu");
    private static readonly JsRe UNIT_AFTER_MEASURE = JsRegex.Compile(
        "((?:քառակուսի|խորանարդ)\\s)(" + string.Join("|", UNIT_KEYS) + ")(?![\\d])" + Boundaries.NOT_LETTER_AFTER, "gu");
    private static readonly JsRe UNIT_AFTER_SLASH = JsRegex.Compile(
        "(/\\s?)(" + string.Join("|", UNIT_KEYS) + ")([²³]?)(?![\\d])" + Boundaries.NOT_LETTER_AFTER, "gu");

    private static readonly JsRe ORDINAL_RANGE = JsRegex.Compile(
        @"(?<!\d)(?<!\d[.,])(\d{1,4})[-–](\d{1,4})-րդ(?![\p{L}\p{M}])", "gu");
    private static readonly JsRe ORDINAL_SUFFIX = JsRegex.Compile(
        "(?<!\\d)(?<!\\d[.,])(\\d[\\d ]*\\d|\\d)[-\\u2010\\u2011\\u2013\\u2014]րդ(" + ARM_LOWER + "*)"
        + Boundaries.NOT_LETTER_AFTER, "gu");
    private static readonly JsRe CASE_SUFFIX = JsRegex.Compile(
        "(?<!\\d)(?<!\\d[.,])(\\d[\\d ]*\\d|\\d)[-\\u2010\\u2011\\u2013\\u2014](" + ARM_LOWER + "+)"
        + Boundaries.NOT_LETTER_AFTER, "gu");
    private static readonly JsRe SPACES = JsRegex.Compile(" ", "gu");

    private static readonly JsRe RANGE = JsRegex.Compile(
        @"(?<!\d)(?<!\d[.,])(?<![-‐‑–—])(\d+(?:[.,]\d+)?)\s?[-‐‑–—]\s?(\d+(?:[.,]\d+)?)(?!\d)(?![.,]\d)(?![-‐‑–—])", "gu");

    private static readonly JsRe PERCENT_SUFFIXED = JsRegex.Compile(
        "\\s?%\\s?[-\\u2013\\u2014]\\s?(" + ARM_LOWER + "+)" + Boundaries.NOT_LETTER_AFTER, "gu");

    private static readonly JsRe DEGREE_SUFFIXED = JsRegex.Compile(
        "(\\d)\\s?°\\s?[CСc]?\\s?[-\\u2013](" + ARM_LOWER + "+)" + Boundaries.NOT_LETTER_AFTER, "gu");
    private static readonly JsRe DEGREE_CELSIUS = JsRegex.Compile(@"(\d)\s?°\s?[CС](?![\p{L}\p{M}])", "gui");
    private static readonly JsRe DEGREE_BARE = JsRegex.Compile(@"(\d)\s?°(?![\p{L}\p{M}])", "gu");

    private static readonly JsRe MINUS = JsRegex.Compile(
        @"(^|[\s(«՝])[-−–]\s?(\d[\d ]*(?:[.,]\d+)?)(?=\s?(?:%|աստիճան|Ցելսիուսի))", "gmu");

    private static readonly JsRe DECIMAL = JsRegex.Compile(@"(?<!\d)(?<!\d[.,])(\d+)[.,](\d+)(?!\d)(?![.,]\d)", "gu");
    private static readonly JsRe LEADING_ZEROS = JsRegex.Compile("^0*", "u");

    private static readonly JsRe FRACTION = JsRegex.Compile(
        @"(?<!\d)(?<!\d[.,])(?<!/)(\d{1,2})/(\d{1,2})(?!\d)(?![.,]\d)(?!/)", "gu");

    /** Eastern Armenian text normalization. Runs inside `Text()`, before the shared symbol tier. */
    public static string NormalizeArmenian(string input)
    {
        var s = input;

        // ── 1. DE-GROUPING — FIRST, or a grouping mark reads as clause punctuation.
        s = GROUP_SPACE.Replace(s, m => m.Groups[1].Value + GROUP_SPACE_SEP.Replace(m.Groups[2].Value, ""));
        s = GROUP_MULTI.Replace(s, m => m.Groups[1].Value + GROUP_MULTI_SEP.Replace(m.Groups[2].Value, ""));
        s = GROUP_ONE.Replace(s, m =>
        {
            var head = m.Groups[1].Value;
            // ⚠ `head == "0"` cannot fire — the pattern's head is `[1-9]\d{0,2}`. Carried verbatim from the
            // TS, where the same branch is dead; a leading-zero decimal never reaches this rule and is
            // claimed by step 13 instead. See the report on this port.
            // ⚠ GROUP 3 is the optional trailer — the magnitude/×/% discriminator. There is no separator
            // capture in this pattern (that is GROUP_MULTI's group 3).
            return head == "0" || m.Groups[3].Success ? m.Value : head + m.Groups[2].Value;
        });

        // ── 2. DOTTED D.M.YYYY DATES — before every other dot rule.
        s = DOTTED_DATE.Replace(s, m =>
        {
            double day = Js.Number(m.Groups[1].Value), month = Js.Number(m.Groups[2].Value);
            if (day < 1 || day > 31 || month < 1 || month > 12) return m.Value;
            return $"{m.Groups[3].Value} թվականի {MONTH_GENITIVE[(int)month - 1]} {Js.NumberToString(day)}";
        });

        // ── 3. ERA MARKERS — before the generic abbreviation step. Longest first: `մ.թ.ա.` before `մ.թ.`
        s = ERA_BCE.Replace(s, "մեր թվարկությունից առաջ");
        s = ERA_BC.Replace(s, "Քրիստոսից առաջ");
        s = ERA_CE.Replace(s, "մեր թվարկության");

        // ── 4. COORDINATE ABBREVIATION PAIRS — as PAIRS, never as single letters.
        foreach (var (lat, lon, full) in COORD_RULES)
        {
            s = lat.Replace(s, $"{full} լայնություն");
            s = lon.Replace(s, $"{full} երկայնություն");
        }

        // ── 5. SINGLE-DOT ABBREVIATIONS and the MAGNITUDE abbreviations.
        s = ABBR_YEARS_PL.Replace(s, "$1 թվականներ");
        s = ABBR_YEAR.Replace(s, "$1 թվական");
        s = ABBR_SQUARE.Replace(s, "քառակուսի");
        s = ABBR_SAINT.Replace(s, "Սուրբ");
        foreach (var (re, full) in MAGNITUDE_RULES) s = re.Replace(s, full);

        // ── 6. ASCII EXPONENT ON A UNIT — folded to the superscript so ONE rule handles both.
        s = ASCII_EXPONENT.Replace(s, m =>
            $"{m.Groups[1].Value}{m.Groups[2].Value}{(m.Groups[3].Value == "2" ? "²" : "³")}");

        // ── 7. A UNIT (optionally with its power) CARRYING A BOUND SUFFIX.
        s = UNIT_SUFFIXED.Replace(s, m =>
        {
            var noun = UNIT_WORD[m.Groups[2].Value];
            var power = m.Groups[3].Value;
            var measure = power == "" ? "" : $"{EXPONENT_WORD[power]} ";
            return $"{m.Groups[1].Value}{measure}{noun}{m.Groups[4].Value}";
        });

        // ── 7b. A UNIT AFTER A MEASURE WORD, and A UNIT AFTER A SLASH.
        s = UNIT_AFTER_MEASURE.Replace(s, m => $"{m.Groups[1].Value}{UNIT_WORD[m.Groups[2].Value]}");
        s = UNIT_AFTER_SLASH.Replace(s, m =>
        {
            var power = m.Groups[3].Value;
            return $"{m.Groups[1].Value}{(power == "" ? "" : $"{EXPONENT_WORD[power]} ")}{UNIT_WORD[m.Groups[2].Value]}";
        });

        // ── 8. THE BOUND SUFFIX ON DIGITS — trap 14, this language's defining rule.
        s = ORDINAL_RANGE.Replace(s, m =>
        {
            var first = OrdinalWords(Js.Number(m.Groups[1].Value));
            var second = OrdinalWords(Js.Number(m.Groups[2].Value));
            return first == null || second == null ? m.Value : $"{first}, {second}";
        });
        s = ORDINAL_SUFFIX.Replace(s, m =>
        {
            var bare = SPACES.Replace(m.Groups[1].Value, "");
            if (!DIGITS_ONLY.IsMatch(bare)) return m.Value;
            var ord = OrdinalWords(Js.Number(bare));
            var tail = m.Groups[2].Value;
            return ord == null ? m.Value : tail == "" ? ord : AttachSuffix(ord, tail);
        });
        s = CASE_SUFFIX.Replace(s, m =>
        {
            var bare = SPACES.Replace(m.Groups[1].Value, "");
            if (!DIGITS_ONLY.IsMatch(bare)) return m.Value;
            var card = CardinalWords(Js.Number(bare));
            return card == null ? m.Value : AttachSuffix(card, m.Groups[2].Value);
        });

        // ── 9. RANGES — a PAUSE, not a joiner.
        s = RANGE.Replace(s, "$1, $2");

        // ── 10. PERCENT WITH A BOUND SUFFIX.
        s = PERCENT_SUFFIXED.Replace(s, " տոկոս$1");

        // ── 11. DEGREES. ⚠ The scale letter may be CYRILLIC С (U+0421), which this corpus writes.
        s = DEGREE_SUFFIXED.Replace(s, "$1 աստիճան$2");
        s = DEGREE_CELSIUS.Replace(s, "$1 Ցելսիուսի աստիճան");
        s = DEGREE_BARE.Replace(s, "$1 աստիճան");

        // ── 12. MINUS — narrow, and the narrowness is the whole argument. AFTER step 11.
        s = MINUS.Replace(s, "$1մինուս $2");

        // ── 13. DECIMALS — LAST among the number rules, because this step SPENDS the `.`/`,`.
        s = DECIMAL.Replace(s, m =>
        {
            var frac = m.Groups[2].Value;
            var zeros = LEADING_ZEROS.Match(frac).Value.Length;
            var rest = frac[zeros..];
            var spelledZeros = string.Join(" ", Enumerable.Repeat(NUMBERS.Units[0], zeros));
            return string.Join(" ", new[] { $"{m.Groups[1].Value} ամբողջ", spelledZeros, rest }.Where(p => p != ""));
        });

        // ── 14. FRACTIONS — numerator a cardinal, denominator an ORDINAL. The cap is the guard.
        s = FRACTION.Replace(s, m =>
        {
            double n = Js.Number(m.Groups[1].Value), d = Js.Number(m.Groups[2].Value);
            if (d < 2 || d > 10 || n > d) return m.Value;
            var num = CardinalWords(n);
            var den = OrdinalWords(d);
            return num == null || den == null ? m.Value : $"{num} {den}";
        });

        return s;
    }
}
