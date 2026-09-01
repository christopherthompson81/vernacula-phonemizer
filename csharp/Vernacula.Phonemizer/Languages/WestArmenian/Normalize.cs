/**
 * Western Armenian (hyw) text normalization — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THIS IS A SIBLING LAYER AND SEVEN THINGS DID NOT TRANSFER from Eastern (hy) — the classical ⟨թ⟩ in
 * the measure words, `տոլար`/`եւրօ`, the scale compound «սելսիուս աստիճան» (scale first, no genitive),
 * the oblique "two" `երկուք-`, the second era abbreviation `Ք.Ա.`, and the decimal separator being BOTH
 * marks. Each difference is measured on hyw.wikipedia; the table is in the TS header.
 * Ported from src/languages/westarmenian/normalize.ts — see that file for the corpus counts, the
 * per-word sourcing, and the refusals (no clock rule; ± and ÷ take a pause).
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Armenian;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.WestArmenian;

public static class Normalize
{
    private static readonly NumbersDef NUMBERS = Manifest.MANIFEST.Numbers;

    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // DATA
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    /** ⚠ NEVER `\b` — it is ASCII and finds no boundary against Armenian (trap 1); and a "not inside a
     *  word" guard carries `\p{M}` beside `\p{L}` (trap 23). Explicit lookarounds throughout. */
    /** Armenian lowercase, for a bound suffix. `և` (U+0587) sits outside the ա–ֆ range. */
    private const string ARM_LOWER = "[\\u0561-\\u0586\\u0587]";

    /** The magnitude abbreviations this corpus writes, which reach the IPA as consonant clusters unless
     *  expanded. ⚠ `պլն`/`պիլիոն` is the WESTERN spelling of "billion" with initial ⟨պ⟩ — Eastern writes
     *  մլրդ/միլիարդ, and this corpus writes both. ⚠ ORDERED: longest-first within each family, so `մլրդ`
     *  is tried before `մլն` and `պիլիոն` before `պլն`. */
    private static readonly (string Abbrev, string Word)[] MAGNITUDE_ABBREV =
    [
        ("մլրդ", "միլիառ"),
        ("պիլիոն", "միլիառ"),
        ("պլն", "միլիառ"),
        ("մլն", "միլիոն"),
        ("հզր", "հազար"),
    ];

    /** Read from the manifest — see the jsonc, where the evidence lives. */
    private static readonly IReadOnlyDictionary<string, string> IRREGULAR_ORDINAL =
        Manifest.MANIFEST.IrregularOrdinals;

    /** Integer → the Western Armenian cardinal as SPACE-SEPARATED WORDS, through the engine's own
     *  composer and spellings, so this pass and the tokenizer can never disagree about a numeral. */
    private static string? CardinalWords(double n)
    {
        // JS `Number.isSafeInteger(n)`: an integral double inside ±2^53 − 1.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991.0) || n < 0 || n > 999_999_999_999)
            return null;
        var parts = Core.Numbers.westernNumberWords(n, NUMBERS);
        if (parts.Any(p => p is null or "")) return null;
        return string.Join(" ", parts);
    }

    /**
     * Attach a CASE/ARTICLE suffix to a cardinal's last word.
     *
     * ⚠ THE OBLIQUE "TWO" IS WHERE WESTERN AND EASTERN PART. hy's layer uses the suppletive stem
     * `երկուս-`; hyw.wikipedia has **երկուք ×17 against երկուս ×1**. Porting the Eastern stem across
     * would have produced *երկուսին* for the commonest declined numeral in the language.
     *
     * Otherwise a final `ը` DROPS (ինը → ին-, տասը → տաս-) and everything else glues directly.
     */
    private static string AttachSuffix(string cardinal, string suffix)
    {
        var words = cardinal.Split(' ').ToList();
        var stem = words[^1];
        if (stem.EndsWith("երկու", StringComparison.Ordinal)) stem = $"{stem}ք";
        else if (stem.EndsWith("ը", StringComparison.Ordinal)) stem = stem[..^1];
        words[^1] = $"{stem}{suffix}";
        return string.Join(" ", words);
    }

    /** Integer → the Western Armenian ORDINAL: the cardinal with `-երորդ` on its LAST word, a final `ը`
     *  becoming `ն` (ինը → իններորդ, տասը → տասներորդ). 1–4 are suppletive, standalone only. */
    public static string? OrdinalWords(double n)
    {
        // JS `IRREGULAR_ORDINAL[n]` — a numeric index into a string-keyed object, so JS stringifies it.
        if (IRREGULAR_ORDINAL.TryGetValue(Js.NumberToString(n), out var irregular)) return irregular;
        var cardinal = CardinalWords(n);
        if (cardinal is null) return null;
        var words = cardinal.Split(' ').ToList();
        var stem = words[^1];
        if (stem.EndsWith("ը", StringComparison.Ordinal)) stem = $"{stem[..^1]}ն";
        words[^1] = $"{stem}երորդ";
        return string.Join(" ", words);
    }

    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // THE PATTERNS
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    // 1) SEPARATORS. ⚠ THIS CORPUS USES BOTH MARKS FOR THE DECIMAL; what makes the two decidable is that
    //    the GROUPING is by SPACE, so neither mark is doing double duty. ⚠ THE WHOLE NUMBER AT ONCE, not
    //    one join per pass (trap 63), and the trailing guard rejects a DIGIT and nothing else (trap 58).
    private static readonly JsRe GROUPED = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space
    /** A COMMA with exactly three digits after it and no more is GROUPING (`445,000`). */
    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0),(?=\\d{3}(?![\\d,]))", "gu");
    /** …every other comma is a DECIMAL. Both marks become a single ASCII `.`. */
    private static readonly JsRe COMMA_DECIMAL = JsRegex.Compile("(\\d),\\s?(\\d+)", "gu");

    /** 3) THE ERA MARKERS. Both abbreviations occur and the wiki glosses each by the other in one
     *  parenthesis, so neither expansion is inferred. ⚠ THE LONGER FORM MUST BE TRIED FIRST, or the bare
     *  `մ.թ.` rule eats the prefix of `մ.թ.ա.` and strands its final letter. */
    private static readonly (JsRe Re, string Word)[] MULTI =
    [
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}մ\\s?\\.\\s?թ\\s?\\.\\s?ա\\s?\\.?", "giu"), "մեր թուարկութենէն առաջ"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}ք\\s?\\.\\s?ա\\s?\\.?{Boundaries.NOT_LETTER_AFTER}", "giu"), "Քրիստոսէ առաջ"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}ք\\s?\\.\\s?ե\\s?\\.?{Boundaries.NOT_LETTER_AFTER}", "giu"), "Քրիստոսէ ետք"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}մ\\s?\\.\\s?թ\\s?\\.", "giu"), "մեր թուարկութեամբ"),
    ];
    /** The final dot is kept at a sentence end, or the pause is lost outright (trap 10). */
    private static readonly JsRe SENTENCE_END = JsRegex.Compile("^\\s*[\"\\u00bb)']?\\s*$", "u");

    /** 4) THE ASTRONOMICAL UNIT — the corpus glosses it itself ("5.23 աստղագիտական միաւոր (ա.մ.) է"). It
     *  was reaching the g2p as two bare letters with two false clause pauses. */
    private static readonly JsRe ASTRO_UNIT = JsRegex.Compile("(\\d[^\\s]*)\\s?ա\\s?\\.\\s?մ\\s?\\.", "gu");

    /** 5a. ORDINAL RANGE — the suffix is written once, at the end. */
    private static readonly JsRe ORD_RANGE = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}(\\d{{1,4}})\\s?-\\s?(\\d{{1,4}})\\s?-\\s?(ր|եր|րոր)դ{Boundaries.NOT_LETTER_AFTER}", "gu");
    /** 5b. ORDINAL. The corpus writes `-րդ` and once the fuller `-րորդ`; the spelled word is the same
     *  either way, so the alternation covers both without the reading depending on which was typed. */
    private static readonly JsRe ORDINAL = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}(\\d{{1,4}})\\s?-\\s?(?:ր|եր|րոր)դ({ARM_LOWER}*){Boundaries.NOT_LETTER_AFTER}", "gu");
    /** 5c/5d. THE DECADE and EVERY OTHER BOUND SUFFIX, in one rule. ⚠ The alternation is CLOSED to
     *  Armenian lowercase and requires the hyphen, which is what keeps `1915-1923` (a range) and
     *  `13-11-2020` (a date) out: both have a DIGIT after the hyphen, and this rule needs a letter. */
    private static readonly JsRe BOUND_SUFFIX = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}(\\d+)\\s?-\\s?({ARM_LOWER}+){Boundaries.NOT_LETTER_AFTER}", "gu");

    /** 6) DEGREES. ⚠ THE SCALE COMPOUND IS «սելսիուս աստիճան» — scale FIRST and NO genitive, where
     *  Eastern writes «Ցելսիուսի աստիճան». ⚠ AND THE CASE SUFFIX SITS ON THE SIGN.
     *  ⚠ THE LOWERCASE SCALE LETTER GOES IN THE CLASS, NOT IN AN `i` FLAG — the suffix class beside it is
     *  genuinely lowercase-only, and `i` folds it so the flag would widen the suffix capture too. */
    private static readonly JsRe DEG_C_SFX = JsRegex.Compile(
        $"(\\d)\\s?°\\s?[CСcс]\\s?-\\s?({ARM_LOWER}+){Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe DEG_F_SFX = JsRegex.Compile(
        $"(\\d)\\s?°\\s?[Ff]\\s?-\\s?({ARM_LOWER}+){Boundaries.NOT_LETTER_AFTER}", "gu");
    /** ⚠ NO SCALE LETTER IN THIS ARM, so a case-insensitive flag fixes nothing and only folds ARM_LOWER
     *  into matching uppercase Armenian: `20 °-Ը` would match where it must not. */
    private static readonly JsRe DEG_SFX = JsRegex.Compile(
        $"(\\d)\\s?°\\s?-\\s?({ARM_LOWER}+){Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?[CС](?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");

    /** 7) SIGNS. ⚠ `±` GETS A PAUSE, not a word: no Western reading of the sign is attested, while
     *  dropping it ran the two figures together into one numeral. ⚠ AND `÷` IS A RANGE HERE, NOT A
     *  DIVISION — the Russian-tradition span notation. */
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("\\s?\\u00b1\\s?", "gu");
    private static readonly JsRe DIVIDE_RANGE = JsRegex.Compile("(\\d)\\s?\\u00f7\\s?(?=\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|(?<!\\d)[\\s(])[-\\u2212\\u2013]\\s?(\\d)", "gu");

    /** 7b) DECIMALS — LAST among the number rules, because this step SPENDS the `.` that step 1 needed to
     *  make its grouping decision (trap 39: a guard's evidence has a lifetime). ⚠ AND A LEADING ZERO IN
     *  THE FRACTION IS A SILENT 10× ERROR OTHERWISE (trap 56's worst shape): `0.037` left as digits reads
     *  *զրօ ամբողջ ԵՐԵՍՈՒՆ ԵՕԹ*, a well-formed numeral ten times too big. */
    private static readonly JsRe DECIMAL = JsRegex.Compile(
        "(?<!\\d)(?<!\\d[.,])(\\d+)[.,](\\d+)(?!\\d)(?![.,]\\d)", "gu");
    private static readonly JsRe LEADING_ZEROS = JsRegex.Compile("^0*", "u");

    /** 7c) THE EQUALS SIGN, DIGIT-GATED — and ⚠ THIS LANGUAGE IS THE COUNTER-EXAMPLE TO TRAP 62. Five
     *  consecutive rounds found `=` was never an equation; hyw has 44 and MOST ARE REAL ARITHMETIC, from
     *  its number-theory articles. ⚠ THE COPULA IS DROPPED, deliberately — careful Armenian writes
     *  «հաւասար է» with the verb after the second operand, and the tier's slot is BETWEEN them. */
    private static readonly JsRe EQUALS = JsRegex.Compile("(\\d)\\s?=\\s?(?=\\d)", "gu");

    /** 8) NUMERIC RANGES. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE, the same measured
     *  refusal hy makes. ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58). */
    private static readonly JsRe DASH_RANGE = JsRegex.Compile("(\\d)\\s?[\\u2013\\u2014]\\s?(?=\\d)", "gu");
    private static readonly JsRe HYPHEN_RANGE = JsRegex.Compile("(?<![\\d.,])(\\d+)\\s?-\\s?(?=\\d)", "gu");

    private static readonly JsRe WS_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // THE PASS — a numbered, order-dependent sequence.
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    public static string NormalizeWestArmenian(string input)
    {
        var s = input;

        // 1) Separators.
        s = Rewrite(s, GROUPED, m => m.Groups[1].Value + SPACE_SEPS.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, SPACE_SEPS, " ");
        s = Rewrite(s, GROUP_COMMA, "");
        s = Rewrite(s, COMMA_DECIMAL, "$1.$2");

        // 2) Magnitude abbreviations, before any single-dot rule.
        foreach (var (abbrev, word) in MAGNITUDE_ABBREV)
            s = Rewrite(s, JsRegex.Compile(
                $"{Boundaries.NOT_LETTER_BEFORE}{abbrev}\\.?{Boundaries.NOT_LETTER_AFTER}", "giu"), word);

        // 3) The era markers.
        foreach (var (re, word) in MULTI)
        {
            var full = s;
            s = Rewrite(s, re, m =>
            {
                var rest = full[(m.Index + m.Length)..];
                return SENTENCE_END.IsMatch(rest) ? $"{word}." : word;
            });
        }

        // 4) The astronomical unit.
        s = Rewrite(s, ASTRO_UNIT, "$1 աստղագիտական միաւոր");

        // 5) The bound suffix on a figure — this language's defining form. A digit cannot take a suffix,
        //    because the digit becomes words in the TOKENIZER, downstream of everything here — so the rule
        //    converts the operand to WORDS and attaches the suffix there.
        //    ⚠ ORDER: the ORDINAL first (its suffix is a different morpheme), then the rest.
        s = Rewrite(s, ORD_RANGE, m =>
        {
            var first = OrdinalWords(Js.Number(m.Groups[1].Value));
            var second = OrdinalWords(Js.Number(m.Groups[2].Value));
            return first is null || second is null ? m.Value : $"{first}, {second}";
        });
        s = Rewrite(s, ORDINAL, m =>
        {
            var ord = OrdinalWords(Js.Number(m.Groups[1].Value));
            return ord is null ? m.Value : $"{ord}{m.Groups[2].Value}";
        });
        s = Rewrite(s, BOUND_SUFFIX, m =>
        {
            var cardinal = CardinalWords(Js.Number(m.Groups[1].Value));
            return cardinal is null ? m.Value : AttachSuffix(cardinal, m.Groups[2].Value);
        });

        // 6) Degrees.
        s = Rewrite(s, DEG_C_SFX, "$1 սելսիուս աստիճան$2");
        s = Rewrite(s, DEG_F_SFX, "$1 ֆարենհայթ աստիճան$2");
        s = Rewrite(s, DEG_SFX, "$1 աստիճան$2");
        s = Rewrite(s, DEG_C, "$1 սելսիուս աստիճան");
        s = Rewrite(s, DEG_F, "$1 ֆարենհայթ աստիճան");
        s = Rewrite(s, DEG_BARE, "$1 աստիճան ");

        // 7) Signs.
        s = Rewrite(s, PLUS_MINUS, ", ");
        s = Rewrite(s, DIVIDE_RANGE, "$1, ");
        s = Rewrite(s, MINUS, "$1մինուս $2");

        // 7b) Decimals.
        s = Rewrite(s, DECIMAL, m =>
        {
            var frac = m.Groups[2].Value;
            var zeros = LEADING_ZEROS.Match(frac).Value.Length;
            var rest = frac[zeros..];
            var spelledZeros = string.Join(" ", Enumerable.Repeat(NUMBERS.Units[0], zeros));
            return string.Join(" ", new[] { $"{m.Groups[1].Value} ամբողջ", spelledZeros, rest }
                .Where(p => p != ""));
        });

        // 7c) The equals sign, digit-gated.
        s = Rewrite(s, EQUALS, "$1 հաւասար ");

        // 8) Numeric ranges.
        s = Rewrite(s, DASH_RANGE, "$1, ");
        s = Rewrite(s, HYPHEN_RANGE, "$1, ");

        // A padded replacement doubles a space that was already there. Harmless downstream because
        // AssembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the
        // one producing candidates for it.
        return Rewrite(s, WS_RUN, " ");
    }
}
