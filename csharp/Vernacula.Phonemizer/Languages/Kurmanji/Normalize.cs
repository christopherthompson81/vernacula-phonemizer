/**
 * Kurmanji (kmr) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/kurmanji/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Kurmanji;

public static class Normalize
{
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "ji sedî" },
        PercentPrefix = true,
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "dolar" }, ["US$"] = new[] { "dolarên Emrîkî" }, ["€"] = new[] { "ewro" },
        },
        Magnitudes = new[] { "hezar", "mîlyon", "milyon", "milyar", "bilyon" },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kîlometre" }, ["m"] = new[] { "metre" }, ["mm"] = new[] { "mîlîmetre" },
            ["cm"] = new[] { "santîmetre" }, ["kg"] = new[] { "kîlogram" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "çargoşe" }, Cubed = new[] { "kûp" }, Position = "after",
        },
        UnitPer = "di",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal) { ["h"] = "saetê de" },
        Ampersand = "û",
    });

    /** Kurmanji vowels, for the glide test at step 4. ⟨y⟩ is a consonant here and deliberately excluded. */
    private static readonly JsRe VOWEL = JsRegex.Compile("[aeêiîouû]$", "iu");

    /** The closed list of suffixes a numeral takes, longest first so `emîn` beats `em` and `yê` beats `ê`. */
    private static readonly string SUFFIX_ALT = string.Join("|",
        new[] { "yemîn", "emîn", "yem", "em", "yan", "an", "yê", "ê", "yî", "î", "ya", "a" });

    private static readonly JsRe LEAD_Y = JsRegex.Compile("^y", "iu");

    /** A numeral plus its bound suffix, as ONE word — the glide is re-derived from the SPOKEN form. */
    private static string Suffixed(double n, string written)
    {
        var words = KurmanjiNumbers.NumberToWords(n).Split(' ').ToList();
        var last = words[^1];
        words.RemoveAt(words.Count - 1);
        var bare = JsRegex.Replace(written, LEAD_Y, ""); // the written glide is re-derived, never trusted
        // JS `VOWEL.test(bare[0])` on an empty suffix would test the string "undefined" — never a vowel.
        var glide = VOWEL.IsMatch(last) && bare.Length > 0 && VOWEL.IsMatch(bare[0].ToString()) ? "y" : "";
        words.Add(last + glide + bare);
        return string.Join(" ", words);
    }

    private static readonly JsRe NBSP = JsRegex.Compile("&nbsp;", "gu");
    private static readonly JsRe ERA_DOTTED = JsRegex.Compile(@"(?<![\p{L}])b\s?\.\s?z\s?\.?(?![\p{L}])", "giu");
    private static readonly JsRe ERA_BARE = JsRegex.Compile(@"(?<![\p{L}])BZ(?![\p{L}])", "gu");

    // ⚠ THE ERA MARKER MUST SEE A YEAR, or it eats a PERSON'S INITIALS — `B. Z. Goldberg` read
    // *bɛrˈiː zɑːjiːnˈeː ɡoːldbˈɛrɡ*. All twelve mined instances have a digit against the marker on one side
    // or the other, so the guard costs nothing measured. See the TS docstring for what it does not catch.
    private static readonly JsRe ERA_YEAR_BEFORE = JsRegex.Compile(@"\d[\p{L}'’]*\s?$", "u");
    private static readonly JsRe ERA_YEAR_AFTER = JsRegex.Compile(@"^\s?\d", "u");

    private static bool EraHasYear(string all, int at, int len) =>
        ERA_YEAR_BEFORE.IsMatch(all[Math.Max(0, at - 12)..at])
        || ERA_YEAR_AFTER.IsMatch(all[Math.Min(at + len, all.Length)..Math.Min(at + len + 3, all.Length)]);
    private static readonly JsRe GROUP = JsRegex.Compile(
        @"(?<![\p{Nd}.,])([1-9]\p{Nd}{0,2}(?:[.,]\p{Nd}{3})+)(?![\p{Nd}]|[.,]\p{Nd})", "gu");
    private static readonly JsRe JI_PERCENT = JsRegex.Compile(@"(?<![\p{L}])ji\s+(?=%\s?\p{Nd})", "giu");
    private static readonly JsRe URL_ESCAPE = JsRegex.Compile(@"\$(?=00[0-9a-fA-F]{2})", "gu");

    private const string TEMP = @"([-−]?)(\p{Nd}+(?:[.,]\p{Nd}+)?)\s*°\s*";
    private static readonly JsRe DEG_C = JsRegex.Compile(TEMP + @"C(?![\p{L}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile(TEMP + @"F(?![\p{L}])", "giu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile(
        @"([-−]?)(\p{Nd}+(?:[.,]\p{Nd}+)?)\s*°(?!\s*\p{L}(?!\p{L}))", "gu");
    private static readonly JsRe NEG_PILE = JsRegex.Compile(
        @"(?<![\p{L}\p{Nd}])[-−](\p{Nd}+(?:[.,]\p{Nd}+)?)(?=(?:\s*û\s*[-−]?\p{Nd}+(?:[.,]\p{Nd}+)?)?[^.,\p{Nd}]{0,4}\s?pile)",
        "giu");
    private static readonly JsRe NEG_START = JsRegex.Compile(@"^[-−](?=\p{Nd})", "u");

    private static readonly JsRe DEC_COMMA = JsRegex.Compile(@"(?<![\p{Nd}.,])(\p{Nd}+),(\p{Nd}{1,2})(?![\p{Nd}]|[.,]\p{Nd})", "gu");
    private static readonly JsRe DEC_PERIOD = JsRegex.Compile(@"(?<![\p{Nd}.,])(\p{Nd}+)\.(\p{Nd})(?![\p{Nd}]|[.,]\p{Nd})", "gu");

    private static readonly JsRe DOTTED_ORDINAL = JsRegex.Compile(@"(?<![\p{Nd}.,\-–—])(\p{Nd}{1,2})\.(?=\s+\p{L})", "gu");
    private static readonly JsRe BOUND_SUFFIX = JsRegex.Compile(
        $@"(?<![\p{{L}}\p{{Nd}}.,])(\p{{Nd}}{{1,9}})({SUFFIX_ALT})(?![\p{{L}}\p{{Nd}}])", "gu");

    private static string Neg(string sg) => sg.Length > 0 ? "negatîf " : "";

    /** Every rule emits Kurmanji WORDS or ASCII digits; nothing reaches the phoneme sink as a spelling. */
    public static string NormalizeKurmanji(string input)
    {
        var s = input;

        s = Rewrite(s, NBSP, _ => " ");

        var eraSrc = s;
        s = Rewrite(s, ERA_DOTTED, m => EraHasYear(eraSrc, m.Index, m.Length) ? "berî zayînê" : m.Value);
        var eraSrc2 = s;
        s = Rewrite(s, ERA_BARE, m => EraHasYear(eraSrc2, m.Index, m.Length) ? "berî zayînê" : m.Value);

        s = Rewrite(s, GROUP, m =>
            m.Value.Replace(".", "", StringComparison.Ordinal).Replace(",", "", StringComparison.Ordinal));

        s = Rewrite(s, JI_PERCENT, _ => "");

        s = Rewrite(s, URL_ESCAPE, _ => "");
        s = SYMBOLS(s);

        s = Rewrite(s, DEG_C, m => $"{Neg(m.Groups[1].Value)}{m.Groups[2].Value} pile Selsiyus");
        s = Rewrite(s, DEG_F, m => $"{Neg(m.Groups[1].Value)}{m.Groups[2].Value} pile");
        s = Rewrite(s, DEG_BARE, m => $"{Neg(m.Groups[1].Value)}{m.Groups[2].Value} pile");
        s = Rewrite(s, NEG_PILE, "negatîf $1");
        s = Rewrite(s, NEG_START, "negatîf ");

        static string Spell(string whole, string frac) => $"{whole} {string.Join(" ", Js.CodePoints(frac))}";
        s = Rewrite(s, DEC_COMMA, m => Spell(m.Groups[1].Value, m.Groups[2].Value));
        s = Rewrite(s, DEC_PERIOD, m => Spell(m.Groups[1].Value, m.Groups[2].Value));

        s = Rewrite(s, DOTTED_ORDINAL, m =>
            Js.Number(m.Groups[1].Value) <= 31 ? Suffixed(Js.Number(m.Groups[1].Value), "em") : m.Value);

        s = Rewrite(s, BOUND_SUFFIX, m =>
        {
            var n = Js.Number(m.Groups[1].Value);
            return double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d
                ? Suffixed(n, m.Groups[2].Value)
                : m.Value;
        });

        return s;
    }
}
