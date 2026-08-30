/**
 * Chuvash (chv) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Two things own this file rather than the symbol tier: the ORDINAL (an invariant -мӗш on the FULL
 * numeral) and THE ATTRIBUTIVE NUMERAL (the short series that fires only once the symbol tier has turned
 * a unit into a word, so it runs AFTER it). The rest is the shared shape: de-grouping, magnitude
 * abbreviations, the era marker, the clock (three-field, seconds reaching 60 for the leap second), the
 * fraction gated on `пай`, the ordinal range, the written ordinal suffix, the signs, the degrees — here
 * all 33 of them temperatures with a three-way scale letter — and the numeric ranges.
 * Ported from src/languages/chuvash/normalize.ts — see that file for the corpus evidence and the sourcing.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Chuvash;

public static class Normalize
{
    /** The cardinal as words, in the series the slot calls for. */
    private static string Cardinal(double n, bool attr = false) => string.Join(" ", Numbers.NumberToWords(n, attr));

    // ───────────────────────────────────────────────────────────────────────────────────────────────
    // ORDINALS — derived, not tabulated
    // ───────────────────────────────────────────────────────────────────────────────────────────────

    /**
     * The Chuvash ORDINAL — the FULL numeral plus an invariant **-мӗш**. No vowel harmony, no rounding, no
     * consonant assimilation: one suffix, every stem. ⚠ THE STEM IS THE FULL SERIES, NOT THE ATTRIBUTIVE
     * ONE — the corpus's "виççĕ тăваттăмĕш пайĕ" spells it out; using the short series would give *тӑватмӗш*,
     * which no source writes.
     */
    public static string? OrdinalOf(double n)
    {
        if (!double.IsInteger(n) || n < 0) return null;
        var words = Cardinal(n).Split(' ').ToList();
        var last = words.Count > 0 ? words[^1] : null;
        if (last is null || last == "") return null;
        words[^1] = last + "мӗш";
        return string.Join(" ", words);
    }

    // ───────────────────────────────────────────────────────────────────────────────────────────────
    // INITIALISMS
    // ───────────────────────────────────────────────────────────────────────────────────────────────

    /**
     * Chuvash letter NAMES. The alphabet is Russian Cyrillic plus ⟨ӑ ӗ ҫ ӳ⟩; the shared letters keep their
     * Russian names (how the alphabet is recited) and the four Chuvash-only letters are named by their own
     * sound. The corpus's caps runs are ЧР, ЧНИИ, АССР, РСФСР, СССР, АПШ, ЧАССР, УТ.
     */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["а"] = "а", ["ӑ"] = "ӑ", ["б"] = "бэ", ["в"] = "вэ", ["г"] = "гэ", ["д"] = "дэ",
        ["е"] = "е", ["ё"] = "ё", ["ж"] = "жэ", ["з"] = "зэ", ["и"] = "и", ["й"] = "кӗске и",
        ["к"] = "ка", ["л"] = "эль", ["м"] = "эм", ["н"] = "эн", ["о"] = "о", ["п"] = "пэ",
        ["р"] = "эр", ["с"] = "эс", ["ҫ"] = "ҫе", ["т"] = "тэ", ["у"] = "у", ["ӳ"] = "ӳ",
        ["ф"] = "эф", ["х"] = "ха", ["ц"] = "цэ", ["ч"] = "че", ["ш"] = "ша", ["щ"] = "ща",
        ["ы"] = "ы", ["э"] = "э", ["ӗ"] = "ӗ", ["ю"] = "ю", ["я"] = "я",
    };

    /** Chuvash phonotactics, for the OOV rule in Core/Initialisms.cs. */
    public static readonly Func<string, bool> IsUnreadableChuvash = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[аӑеёиоуӳыэӗюя]", "u"),
        LegalOnsets = new HashSet<string>(
            ["бл", "бр", "гр", "гл", "др", "кр", "кл", "пл", "пр", "ст", "сп", "ск", "тр", "шк", "шт"],
            StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(
            ["кт", "нт", "нк", "рт", "рд", "рс", "лт", "лк", "ст", "шт", "рш", "мп", "нч", "рч", "рм"],
            StringComparer.Ordinal),
    });

    private static readonly Func<string, string> INITIALISMS = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.GetValueOrDefault(l),
        // Spelled out despite being pronounceable — the corpus's own runs.
        AcronymLetters = new HashSet<string>(
            ["чр", "чнии", "асср", "рсфср", "ссср", "апш", "часср", "ссп", "ут"],
            StringComparer.Ordinal),
        IsRecorded = _ => false,
        IsUnreadable = IsUnreadableChuvash,
    });

    public static string NormalizeChuvashInitialisms(string text) => INITIALISMS(text);

    // ───────────────────────────────────────────────────────────────────────────────────────────────
    // The rules
    // ───────────────────────────────────────────────────────────────────────────────────────────────

    /** ⚠ EVERY BOUNDARY IN THIS FILE IS AN EXPLICIT LOOKAROUND, NEVER `\b` — `\b` is ASCII-defined and
     *  finds none against Cyrillic. */
    /** The Chuvash-Cyrillic letters a written suffix can be spelt with. */
    private const string SFX = "[а-яёӑӗҫӳ]";
    /** A Chuvash word, for the attributive pass and the fraction's `пай` guard. */
    private const string WORD = "[а-яёӑӗҫӳА-ЯЁӐӖҪӲ]";

    /** 0) DIGIT DE-GROUPING, FIRST — ⚠ THE WHOLE NUMBER AT ONCE (trap 63), and the trailing guard rejects a
     *  DIGIT and nothing else: `(?![.,]\d)` costs `3 779,8` and `(?![\d.,])` declines every clause-final
     *  figure (trap 58). Separators spelled as escapes. */
    private static readonly JsRe GROUPED = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");
    /** The fractional side, anchored on the separator (SI groups the fraction too: `0,000 001`). */
    private static readonly JsRe GROUPED_FRAC = JsRegex.Compile(
        "([.,]\\d{3})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu"); // space, NBSP, NNBSP, thin space

    /** 1) THE MAGNITUDE ABBREVIATIONS, before any single-dot rule — the dot is optional because the corpus
     *  writes both. */
    private static readonly JsRe MILLIARD = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}млрд\\.?{Boundaries.NOT_LETTER_AFTER}", "giu");
    private static readonly JsRe TRILLION = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}трлн\\.?{Boundaries.NOT_LETTER_AFTER}", "giu");
    private static readonly JsRe MILLION = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}млн\\.?{Boundaries.NOT_LETTER_AFTER}", "giu");

    /** 1b) THE ERA MARKER AND THE YEAR ABBREVIATION. The abbreviation is written for the one clean form seen
     *  (trap 9). `ҫ.` / `ҫҫ.` after a figure are ҫул / ҫулсем. */
    private static readonly JsRe ERA_ABBREV = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}п\\.\\s?эрч\\.", "giu");
    private static readonly JsRe YEAR_PL = JsRegex.Compile("(\\d)\\s?ҫҫ\\.", "gu");
    private static readonly JsRe YEAR_SG = JsRegex.Compile("(\\d)\\s?ҫ\\.", "gu");

    /** 2) НОМЕР — the sign was dropped outright. */
    private static readonly JsRe NUMERO = JsRegex.Compile("№\\s?(?=\\d)", "gu");

    /** 3) CLOCK — every one of this corpus's clocks has THREE FIELDS, and the seconds field reaches 60
     *  (the leap second). The two-field form follows for the ordinary case. */
    private static readonly JsRe CLOCK_3 = JsRegex.Compile(
        "(?<![\\d:.,])([01]?\\d|2[0-4]):([0-5]\\d):([0-5]\\d|60)(?![\\d:.,])", "gu");
    private static readonly JsRe CLOCK_2 = JsRegex.Compile(
        "(?<![\\d:.,])([01]?\\d|2[0-4]):\\s?([0-5]\\d)(?![\\d:.,])", "gu");

    /** 4) THE FRACTION, claimed ONLY WHERE `пай` FOLLOWS (the shape every attested instance has). */
    private static readonly JsRe FRACTION = JsRegex.Compile(
        $"(?<![\\d.,/])(\\d{{1,2}})\\s?/\\s?(\\d{{1,2}})(?=\\s(?:пай|пая|пайĕ|пайӗ){WORD}*)", "gu");

    /** 5) THE ORDINAL RANGE, BEFORE the plain ordinal and the range rule — three hyphens, two of which open
     *  a range and one introduces the suffix. The suffix is written ONCE, on the second endpoint. */
    private static readonly JsRe ORD_RANGE = JsRegex.Compile(
        $"(?<![\\d.,])(\\d+)\\s?-\\s?(\\d+)\\s?-\\s?(м[ĕӗ]ш{SFX}{{0,8}}){Boundaries.NOT_LETTER_AFTER}", "gu");

    /** 6) NUMERAL + THE ORDINAL SUFFIX. MUST run before the range rule, which would eat the hyphen. */
    private static readonly JsRe ORD_SUFFIX = JsRegex.Compile(
        $"(?<![\\d.,/])(\\d+)\\s?-\\s?(м[ĕӗ]ш{SFX}{{0,6}}){Boundaries.NOT_LETTER_AFTER}", "gu");
    /** The Latin ⟨ĕ⟩ folded to the real ⟨ӗ⟩ in a written suffix. */
    private static readonly JsRe LAT_E = JsRegex.Compile("ĕ", "gu");

    /** 7) SIGNS — the true MINUS (U+2212) as well as the hyphen. ± is a SINGLE CHARACTER, not a `+`. */
    private static readonly JsRe MINUS = JsRegex.Compile("(^|(?<!\\d)[\\s(])[-\\u2212\\u2013](\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("\\u00b1", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("(^|[\\s(])\\+\\s?(\\d)", "gu");

    /** 8) DEGREES — all 33 are TEMPERATURES, and the scale letter is written three ways (Latin ⟨C⟩,
     *  Cyrillic ⟨С⟩, lowercase Cyrillic ⟨с⟩), which render identically. The `i` flag widens the class. */
    private static readonly JsRe DEG_CELSIUS = JsRegex.Compile("(\\d)\\s?°\\s?[CСс](?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_FAHRENHEIT = JsRegex.Compile("(\\d)\\s?°\\s?[FФф](?![\\p{L}\\p{M}])", "gui");
    /** ⚠ WITH A TRAILING SPACE, because the sign is written glued to letters this rule does not claim. */
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");

    /** 9) NUMERIC RANGES — the dash is spent on a PAUSE rather than a connective (the measured refusal
     *  ba, kk and tt make), and NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58). Runs AFTER the
     *  ordinal and sign rules. */
    private static readonly JsRe DASH_RANGE = JsRegex.Compile("(\\d)\\s?[\\u2013\\u2014]\\s?(?=\\d)", "gu");
    private static readonly JsRe HYPHEN_RANGE = JsRegex.Compile("(?<![\\d.,])(\\d+)\\s?-\\s?(?=\\d)", "gu");

    private static readonly JsRe WS_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** THE ATTRIBUTIVE NUMERAL — fires only on a figure IMMEDIATELY followed by a Chuvash word, so a digit
     *  run standing alone keeps the counting form. Spelled rather than flagged, because the number branch
     *  cannot see what follows. */
    private static readonly JsRe ATTRIBUTIVE =
        JsRegex.Compile($"(?<![\\d.,:/-])(\\d+)(\\s)(?={WORD})", "gu");

    /**
     * Attach a written suffix to an ordinal figure. The suffix typed is the TAIL of a longer word —
     * `22-мĕшĕнче` is the ordinal plus a possessive plus a locative — so the rule derives the ordinal and
     * splices on the OVERLAP, appending only the remainder.
     */
    private static string AttachOrdinal(string whole, string digits, string rawSuffix)
    {
        var n = Js.Number(digits);
        // JS `Number.isSafeInteger(n)`: an integral double inside ±2^53 − 1.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991.0)) return whole;
        var ord = OrdinalOf(n);
        if (ord is null) return whole;
        // ⚠ The suffix reaches the OUTPUT, so it is lowercased with `Js.ToLowerCase`, not `ToLowerInvariant`.
        var suffix = Js.ToLowerCase(rawSuffix);
        for (var k = Math.Min(ord.Length, suffix.Length); k >= 2; k--)
            if (ord.EndsWith(suffix[..k], StringComparison.Ordinal)) return ord + suffix[k..];
        return whole;
    }

    /** Normalize one Chuvash input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeChuvash(string input)
    {
        var s = input;

        // 0) Digit de-grouping, first — every later rule needs the figure whole.
        s = Rewrite(s, GROUPED, m => m.Groups[1].Value + SPACE_SEPS.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, GROUPED_FRAC, m => m.Groups[1].Value + SPACE_SEPS.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, SPACE_SEPS, " ");

        // 1) The magnitude abbreviations.
        s = Rewrite(s, MILLIARD, "миллиард");
        s = Rewrite(s, TRILLION, "триллион");
        s = Rewrite(s, MILLION, "миллион");

        // 1b) The era marker and the year abbreviation.
        s = Rewrite(s, ERA_ABBREV, "пирӗн эраччен");
        s = Rewrite(s, YEAR_PL, "$1 ҫулсем");
        s = Rewrite(s, YEAR_SG, "$1 ҫул");

        // 2) Номер.
        s = Rewrite(s, NUMERO, "номер ");

        // 3) The clock — three fields, then the ordinary two-field form.
        s = Rewrite(s, CLOCK_3, m =>
            $"{Cardinal(Js.Number(m.Groups[1].Value))} {Cardinal(Js.Number(m.Groups[2].Value))} {Cardinal(Js.Number(m.Groups[3].Value))}");
        s = Rewrite(s, CLOCK_2, m =>
        {
            var hv = Js.Number(m.Groups[1].Value);
            var mv = Js.Number(m.Groups[2].Value);
            return mv == 0 ? Cardinal(hv) : $"{Cardinal(hv)} {Cardinal(mv)}";
        });

        // 4) The fraction, claimed only where `пай` follows.
        s = Rewrite(s, FRACTION, m =>
        {
            var whole = m.Value;
            var nv = Js.Number(m.Groups[1].Value);
            var dv = Js.Number(m.Groups[2].Value);
            if (!(nv >= 1 && nv < dv && dv <= 12)) return whole;
            var ord = OrdinalOf(dv);
            return ord is null ? whole : $"{Cardinal(nv)} {ord}";
        });

        // 5) The ordinal range, before the plain ordinal and the range rule.
        s = Rewrite(s, ORD_RANGE, m =>
        {
            var whole = m.Value;
            var first = AttachOrdinal(whole, m.Groups[1].Value, m.Groups[3].Value);
            var second = AttachOrdinal(whole, m.Groups[2].Value, m.Groups[3].Value);
            if (first == whole || second == whole) return whole;
            return $"{first}, {second}";
        });

        // 6) Numeral + the ordinal suffix.
        s = Rewrite(s, ORD_SUFFIX, m => AttachOrdinal(m.Value, m.Groups[1].Value, LAT_E.Replace(m.Groups[2].Value, "ӗ")));

        // 7) Signs.
        s = Rewrite(s, MINUS, "$1минус $2");
        s = Rewrite(s, PLUS_MINUS, " плюс минус ");
        s = Rewrite(s, PLUS, "$1плюс $2");

        // 8) Degrees — all temperatures here.
        s = Rewrite(s, DEG_CELSIUS, "$1 Цельси градусӗ");
        s = Rewrite(s, DEG_FAHRENHEIT, "$1 Фаренгейт градусӗ");
        s = Rewrite(s, DEG_BARE, "$1 градус ");

        // 9) Numeric ranges.
        s = Rewrite(s, DASH_RANGE, "$1, ");
        s = Rewrite(s, HYPHEN_RANGE, "$1, ");

        // A padded replacement (` плюс минус `) doubles a space that was already there. Harmless downstream
        // because AssembleClauses collapses runs, but this pass should not produce the candidates.
        return Rewrite(s, WS_RUN, " ");
    }

    /** THE ATTRIBUTIVE NUMERAL — the pass that runs AFTER the symbol tier, and the reason it has to. */
    public static string SpellAttributive(string input) =>
        Rewrite(input, ATTRIBUTIVE, m =>
        {
            var whole = m.Value;
            var n = Js.Number(m.Groups[1].Value);
            if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991.0)) return whole;
            return $"{Cardinal(n, true)}{m.Groups[2].Value}";
        });
}
