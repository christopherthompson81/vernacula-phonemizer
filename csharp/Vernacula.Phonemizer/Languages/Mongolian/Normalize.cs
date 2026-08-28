/**
 * Mongolian / Khalkha (mn) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * Ported from src/languages/mongolian/normalize.ts, whose header carries the whole evidential record: the
 * mn.wikipedia counts behind every rule, the espeak corroboration, the two sentences where the corpus states
 * its own readings ("$45"-ийг … хэмээн уншина; хувийн тэмдэг (%)), why NO shared symbol tier is wired (the
 * case suffix glued to the percent SIGN is trap 14), and the priced refusals — ranges, the general case
 * suffix, the plus, ×, =, &, the clock, the era phrase, the scale name, rates. Nothing is re-derived here.
 *
 * ⚠ THE STEPS ARE ORDER-DEPENDENT. The three that would break silently if moved: DE-GROUPING (3) above
 * everything that reads a number; UNITS (9) above DECIMALS (10), because the unit step's version guard works
 * by SEEING the dot and the decimal step spends it; INITIALISMS (11) last, after the abbreviation dot (2)
 * and the personal initials (1).
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Mongolian;

public static class Normalize
{
    private static MongolianManifest M => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> LETTER_NAME => M.LetterNames;

    // 1. PERSONAL INITIALS — `Ц.Элбэгдорж`. The guard is the surname: 1–3 initials followed by a capital
    //    PLUS a lowercase letter, which is what keeps a genuine sentence end out of it.
    private static readonly JsRe INITIALS = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}((?:[А-ЯӨҮЁ]\\.){{1,3}})(?=[А-ЯӨҮЁ][а-яөүё])", "gu");
    private static readonly JsRe CAPS = JsRegex.Compile("[А-ЯӨҮЁ]", "gu");

    // 2. THE ABBREVIATION DOT — a dot between two lowercase Cyrillic letters is never a clause end.
    private static readonly JsRe ABBREV_DOT = JsRegex.Compile("(?<=[а-яөүё])\\.(?=[а-яөүё])", "gu");

    // 3. DE-GROUPING — the comma is BOTH a thousands separator and a decimal point here; the digit count
    //    after it is the discriminator.
    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)[,](?=\\d{3}(?![\\d]))", "gu");
    private static readonly JsRe GROUP_SPACE =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})[ \\u00a0\\u202f\\u2009](\\d{3})(?!\\d)", "gu");  // space, NBSP, NNBSP, thin space

    // 4. ORDINALS — `-р` after a figure, an abbreviation of `-дугаар`/`-дүгээр`. The trailing letters are
    //    re-emitted, not dropped.
    /**
     * A COLON BETWEEN TWO DIGIT RUNS IS NEVER CLAUSE PUNCTUATION — and that is ALL this claims (#1099).
     * ⚠ IT EMITS NO WORD, which is why it can fire on every population at once: spending the colon on a
     * SPACE removes the phrase break and asserts nothing about whether the figure is a clock, a race time or
     * a census bracket, so the three do not have to be told apart. ⚠ A WHOLE RUN, so a three-field
     * `4:39:51.79` does not have its first colon spent and its second kept. ⚠ AND A COLON FOLLOWED BY A
     * SPACE IS UNTOUCHED — `0-14: 40.8%` keeps it, because there the colon really is introducing something.
     * See the TS for the FLEURS count that re-priced the refusal this sits beside.
     */
    private static readonly JsRe DIGIT_COLON_RUN =
        JsRegex.Compile("(?<![\\d:])(\\d{1,2})((?::\\d{2})+)(?![\\d])", "gu");
    private static readonly JsRe COLON_G = JsRegex.Compile(":", "gu");

    private static readonly JsRe ORDINAL = JsRegex.Compile(
        $"(?<![\\d.,\\p{{L}}\\p{{M}}])(\\d{{1,4}})-р(т?){Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe BACK_VOWELS = JsRegex.Compile($"[{M.BackVowels}]", "u");

    /** `n` → its Mongolian ordinal word string; the marker goes on the LAST word of the cardinal only and
     *  harmonises with it. */
    private static string? OrdinalWords(double n)
    {
        var cardinal = Numbers.NumberToWords(n);
        if (cardinal == "") return null; // NumberToWords refuses above 2^53 — so does this
        var words = cardinal.Split(' ');
        var last = words[^1];
        words[^1] = last + (BACK_VOWELS.IsMatch(last) ? "дугаар" : "дүгээр");
        return string.Join(" ", words);
    }

    // 5. PERCENT — the one case suffix this layer can honestly read (`хув` + the writer's own suffix).
    private static readonly JsRe PERCENT_SUFFIX = JsRegex.Compile("(\\d)\\s?%-(и[а-яөүё]+)", "gu");
    private static readonly JsRe PERCENT_NI = JsRegex.Compile("(\\d)\\s?%-нь", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile("(\\d)\\s?%(?!-)", "gu");

    // 6. CURRENCY.
    private static readonly string[] MAGNITUDES =
        [M.Numbers.Thousand, M.Numbers.Million, M.Numbers.Billion, "наяд"];
    // Captured as part of the match so it is CONSUMED and re-emitted, never left behind as a second copy.
    private static readonly string MAG =
        $"(?:[  ](?:их[  ])?(?:{string.Join("|", MAGNITUDES)})[\\p{{L}}\\p{{M}}]*)?";  // space, NBSP

    private static readonly JsRe SAID_CURRENCY = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}(?:доллар|евро(?:гийн|гоор|нууд|той|оос|[гдт])?{Boundaries.NOT_LETTER_AFTER})",
        "iu");
    private static readonly JsRe WINDOW_END = JsRegex.Compile("[.!?…](?!\\d)", "u");

    /** The redundancy window: 40 characters after the figure, truncated at the first clause terminator —
     *  ⚠ and a terminator followed by a DIGIT is the operand's own decimal point, not a clause end. */
    private static string CurrencyWindow(string whole, int off)
    {
        var slice = off >= whole.Length ? "" : whole[off..Math.Min(whole.Length, off + 40)];
        var m = WINDOW_END.Match(slice);
        return m.Success ? slice[..m.Index] : slice;
    }

    private static readonly JsRe CURRENCY_BEFORE =
        JsRegex.Compile($"([$€])[  ]?(\\d+(?:[.,]\\d+)?)({MAG})", "gu");  // space, NBSP
    private static readonly JsRe CURRENCY_AFTER =
        JsRegex.Compile($"(\\d+(?:[.,]\\d+)?)[  ]?([$€])({MAG})", "gu");  // space, NBSP
    private static readonly Dictionary<string, string> CURRENCY_WORD =
        new() { ["$"] = "доллар", ["€"] = "евро" };
    private static readonly JsRe MAGNITUDE_SUFFIXED =
        JsRegex.Compile($"(?:{string.Join("|", MAGNITUDES)})[\\p{{L}}\\p{{M}}]", "u");

    // 7. DEGREES — `хэм`, scale-neutral by design; `°F` is refused WHOLE because there the scale is the
    //    content. ⚠ ⟨С⟩ is CYRILLIC in four of the six scale-letter instances.
    private static readonly JsRe DEGREE_SCALE =
        JsRegex.Compile("(\\d)\\s?°\\s?([СсCcFf])(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEGREE_BARE =
        JsRegex.Compile("(\\d)\\s?°(?!\\s?\\d)(?!\\s?\\p{L}(?![\\p{L}\\p{M}]))", "gu");

    // 8. MINUS — read, where the plus is not: omitting a plus is lossless and omitting a minus INVERTS.
    private static readonly JsRe MINUS_DEGREE =
        JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])-(\\d+(?:[.,]\\d+)?)(?=.{0,12}?(?:хэм|градус))", "gu");
    private static readonly JsRe MINUS_TRUE = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])−(?=\\d)", "gu");

    // 9. UNITS AND EXPONENTS — every key and every word from the unit's own wikipedia article.
    private static readonly Dictionary<string, string> UNIT_WORD = new()
    {
        ["км"] = "километр", ["м"] = "метр", ["см"] = "сантиметр", ["мм"] = "миллиметр", ["кг"] = "килограмм",
        ["km"] = "километр", ["cm"] = "сантиметр", ["mm"] = "миллиметр", ["kg"] = "килограмм",
    };
    private static readonly Dictionary<string, string> EXPONENT_WORD =
        new() { ["²"] = "квадрат", ["2"] = "квадрат", ["³"] = "куб", ["3"] = "куб" };
    // Longest key first, so `км` is tried before `м`. JS `sort((a,b) => b.length - a.length)` is stable and
    // so is OrderByDescending; a Dictionary keeps insertion order, so the equal-length ties resolve the same.
    private static readonly string UNIT_KEYS =
        string.Join("|", UNIT_WORD.Keys.OrderByDescending(k => k.Length));
    private static readonly JsRe UNIT = JsRegex.Compile(
        $"(?<![\\d.,\\p{{L}}\\p{{M}}])(\\d+(?:[.,]\\d+)?)[    ]?({UNIT_KEYS})([²³23])?(?![\\p{{L}}\\p{{M}}\\d/²³])"  // space, NBSP, NNBSP, thin space
        + $"(?:-([а-яөүё]+){Boundaries.NOT_LETTER_AFTER})?",
        "gu");

    // 10. THE DECIMAL POINT — last, because every guard above needs the separator intact.
    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d+)(?![\\d.,])", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d{1,2})(?![\\d.,])", "gu");

    // 11. INITIALISMS — the shared seam, wired. The phonotactics are Khalkha's: no native initial cluster,
    //     the onsets are the Russian-loan inventory, and the codas are the native two-consonant finals.
    public static readonly Func<string, bool> IsUnreadableMongolian = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[аеёиоөуүыэюя]", "u"),
        LegalOnsets = new HashSet<string>(
        [
            "бл", "бр", "гл", "гр", "др", "кл", "кр", "пл", "пр", "сл", "см", "сп", "ст", "тр",
            "фл", "фр", "хл", "хр", "зв", "св", "тв", "дв", "сн", "шт", "шк", "шп", "гв",
        ], StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(
        [
            "рт", "рд", "рм", "рн", "рс", "рх", "рг", "рз", "рш", "рч", "рв", "рь",
            "нт", "нд", "нч", "нз", "нс", "нх", "нг",
            "лт", "лд", "лз", "лс", "лх", "лг", "лж", "ль",
            "ст", "шт", "фт", "хт", "гт", "йт", "йл", "йн", "йм", "йх", "вь", "мь", "нь", "хь",
        ], StringComparer.Ordinal),
    });

    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(M.AcronymLetters, StringComparer.Ordinal);

    /** Spell an unreadable all-caps run with Mongolian letter names. ⚠ THE STAKE IS HIGHER HERE THAN IN A
     *  SHALLOW ORTHOGRAPHY: the deep-orthography reduction deletes letters from an acronym, so it comes out
     *  SHORTER than it went in (`АНУ` → [an]). */
    private static readonly Func<string, string> SpellInitialisms =
        Initialisms.MakeInitialismNormalizer(new InitialismData
        {
            LetterName = l => LETTER_NAME.GetValueOrDefault(l),
            AcronymLetters = ACRONYM_LETTERS,
            IsRecorded = _ => false,
            IsUnreadable = IsUnreadableMongolian,
        });

    /** Normalize Mongolian text before tokenization. Pure text→text. */
    public static string NormalizeMongolian(string input)
    {
        var s = input;

        // 1. Personal initials, before the dot rule and before the caps run.
        s = Rewrite(s, INITIALS, m => string.Join(" ", CAPS.Matches(m.Groups[1].Value)
            .Select(c => LETTER_NAME.GetValueOrDefault(Js.ToLowerCase(c.Value), c.Value))) + " ");

        // 2. An abbreviation dot between two lowercase letters is not a clause end.
        s = Rewrite(s, ABBREV_DOT, " ");

        // 3. De-grouping.
        s = Rewrite(Rewrite(s, GROUP_COMMA, ""), GROUP_SPACE, "$1$2");

        // 3b. The digit-colon-digit run loses its colon — see DIGIT_COLON_RUN. Here rather than later
        //     because every numeric step below reads a digit run, and the colon was splitting one in half.
        s = Rewrite(s, DIGIT_COLON_RUN, m => m.Groups[1].Value + COLON_G.Replace(m.Groups[2].Value, " "));

        // 4. Ordinals.
        s = Rewrite(s, ORDINAL, m =>
        {
            var words = OrdinalWords(Js.Number(m.Groups[1].Value));
            return words is null ? m.Value : $"{words}{m.Groups[2].Value}";
        });

        // 5. Percent — the suffixed arms first, or the bare arm consumes the sign and strands the suffix.
        s = Rewrite(Rewrite(Rewrite(s, PERCENT_SUFFIX, "$1 хув$2"), PERCENT_NI, "$1 хувь нь"), PERCENT, "$1 хувь");

        // 6. Currency. The sign is DROPPED where the word is already said within the window; a MAGNITUDE word
        //    takes the currency name to the far side of it, or refuses the match when it is itself case-marked.
        string Currency(string whole, Match m, string num, string sign, string mag)
        {
            if (MAGNITUDE_SUFFIXED.IsMatch(mag)) return m.Value; // refuse the whole match, not half of it
            if (SAID_CURRENCY.IsMatch(CurrencyWindow(whole, m.Index))) return num + mag; // say it once, in the word
            return $"{num}{mag} {CURRENCY_WORD[sign]}";
        }
        var beforeFrozen = s;
        s = Rewrite(s, CURRENCY_BEFORE, m =>
            Currency(beforeFrozen, m, m.Groups[2].Value, m.Groups[1].Value, m.Groups[3].Value));
        var afterFrozen = s;
        s = Rewrite(s, CURRENCY_AFTER, m =>
            Currency(afterFrozen, m, m.Groups[1].Value, m.Groups[2].Value, m.Groups[3].Value));

        // 7. Degrees, scale arm first so the bare arm cannot re-claim what it declined. The `°F` refusal is
        //    CASE-FOLDED, because the class that reaches it is.
        s = Rewrite(s, DEGREE_SCALE, m =>
            m.Groups[2].Value.ToUpperInvariant() == "F" ? m.Value : $"{m.Groups[1].Value} хэм");
        s = Rewrite(s, DEGREE_BARE, "$1 хэм");

        // 8. Minus. After step 7, so the degree arm can key on the emitted `хэм` as well as on `градус`.
        s = Rewrite(Rewrite(s, MINUS_DEGREE, "хасах $1"), MINUS_TRUE, "хасах ");

        // 9. Units and exponents, with the measure word preposed onto the unit noun. A glued case suffix is
        //    ACCEPTED here and refused by the percent arm — the fallback readings are what is asymmetric.
        s = Rewrite(s, UNIT, m =>
        {
            var num = m.Groups[1].Value;
            var unit = UNIT_WORD[m.Groups[2].Value];
            var measure = !m.Groups[3].Success ? unit : $"{EXPONENT_WORD[m.Groups[3].Value]} {unit}";
            if (!m.Groups[4].Success) return $"{num} {measure}";
            var suffix = m.Groups[4].Value;
            return unit.EndsWith("р", StringComparison.Ordinal)
                ? $"{num} {measure}{suffix}"
                : $"{num} {measure}-{suffix}";
        });

        // 10. The decimal point.
        s = Rewrite(Rewrite(s, DECIMAL_DOT, "$1 цэг $2"), DECIMAL_COMMA, "$1 цэг $2");

        // 11. The shared initialism seam.
        return SpellInitialisms(s);
    }
}
