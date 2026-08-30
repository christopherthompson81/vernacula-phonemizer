/**
 * Kabuverdianu / kriolu (kea) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/kabuverdianu/normalize.ts — see that file for the corpus evidence and the
 * sourcing of each expansion.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Kabuverdianu;

public static class Normalize
{
    /**
     * The shared SYMBOL tier. Every form declared here is a kea CORPUS token read in slot — see the TS header;
     * there is no wiki and no espeak to fall back on. The unit table is deliberately incomplete (⟨mm⟩ and
     * ⟨kg⟩ are refused), and the one-letter keys are declared so the tier's version guard can see the dot.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "pur sentu" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["AUD$"] = new[] { "dóla" },
            ["$"] = new[] { "dóla" },
            ["£"] = new[] { "libra" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "kilómitru" },
            ["m"] = new[] { "métru" },
            ["cm"] = new[] { "sentímitru" },
            ["mi"] = new[] { "milha" },
            ["mph"] = new[] { "milha pa óra" },
        },
        UnitPer = "pa",
        RateDenominators = new Dictionary<string, string>
        {
            ["h"] = "óra", ["hr"] = "óra", ["s"] = "sigundu",
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kuadradu" },
            Cubed = new[] { "kúbiku" },
            Position = ExponentPosition.After,
        },
        Magnitudes = new[] { "milhons", "milhon", "mil" },
        MagnitudeConnective = "di",
        Ampersand = "y",
    });

    /** Read from the manifest — see the jsonc, where the evidence lives. */
    private static IReadOnlyList<string> ORDINAL => Manifest.MANIFEST.Ordinals;

    /** Fraction denominators, 2–5 — the four the corpus attests IN THE FRACTION SENSE; 6 and up are ordinals. */
    private static readonly IReadOnlyDictionary<string, string> DENOMINATOR = new Dictionary<string, string>
    {
        ["2"] = "meiu", ["3"] = "tersu", ["4"] = "kuartu", ["5"] = "kintu",
    };

    // The de-grouping separators, spelled as ESCAPES rather than typed, so the three non-ASCII members cannot
    // collapse to plain spaces on the way in (the nso NBSP trap, #1109).
    private const string SEPARATORS = "[ \\u00a0\\u202f\\u2009]";
    private static readonly JsRe SPACE_LIKE = JsRegex.Compile(SEPARATORS, "gu");
    private static readonly JsRe DOT_DECIMAL = JsRegex.Compile("(?<!\\d)(\\d+)[.,](\\d+)(?!\\d)", "gu");
    private static readonly JsRe NUMBER_SIGN =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}N\\s?[º°]\\s?(?=\\d)", "gu");
    private static readonly JsRe ORDINAL_INDICATOR =
        JsRegex.Compile("(?<![\\d.,])(\\d{1,2})\\s?º(?=\\s?[\\p{L}])", "gu");
    private static readonly JsRe DEGREE = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe DEGREE_ORD = JsRegex.Compile("(\\d)\\s?º(?!\\s?[\\p{L}\\p{M}])", "gu");
    private static readonly JsRe CLOCK =
        JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(?![.,]\\d)", "gu");
    private static readonly JsRe FRACTION =
        JsRegex.Compile("(?<![\\d.,\\/])(\\d{1,2})\\s?\\/\\s?([2-5])(?![\\d\\/])", "gu");
    private static readonly JsRe RANGE_DOUBLE = JsRegex.Compile("(\\d)\\s?--\\s?(?=\\d)", "gu");
    private static readonly JsRe RANGE =
        JsRegex.Compile("(?<![\\d.,\\-\\/])(\\d+)\\s?-\\s?(\\d+)(?![\\d\\/])(?!\\s?-\\s?\\d)", "gu");
    private static readonly JsRe WS_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");
    private static readonly JsRe ERA_END = JsRegex.Compile("^\\s*[\"»)'”]?\\s*$", "u");
    private static readonly (JsRe Re, string Word)[] ERA =
    {
        (JsRegex.Compile("(?<![\\p{L}\\p{M}.])[aA]\\s?\\.\\s?[cC]\\s?\\.", "gu"), "antis di Kristu"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}.])[dD]\\s?\\.\\s?[cC]\\s?\\.", "gu"), "dipôs di Kristu"),
    };

    /** The three-digit de-grouping test on one mark: `([1-9]\d{0,2})((?:${mark}\d{3})+)(?!\d)`. */
    private static JsRe DeGroup(string mark) =>
        JsRegex.Compile($"(?<!\\d)(?<![\\d][.,])([1-9]\\d{{0,2}})((?:{mark}\\d{{3}})+)(?!\\d)", "gu");

    /** Normalize one Kabuverdianu input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeKabuverdianu(string input)
    {
        var s = input;

        // 1) THE SHARED SYMBOL TIER FIRST: its numeral pattern reads `783.562` and `14,7` as ONE token, and its
        //    NOT_VERSION guard works by seeing the dot, which the de-grouping below spends.
        s = SYMBOLS(s);

        // 2) DE-GROUPING, BY THE THREE-DIGIT TEST ON BOTH MARKS. The whole number at once, not one join per pass;
        //    the trailing guard rejects a digit and nothing else; the price is `30 pes (9,114 m)` read as a group.
        s = Rewrite(s, DeGroup(SEPARATORS), m => m.Groups[1].Value + SPACE_LIKE.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, DeGroup("\\."), m => m.Groups[1].Value + m.Groups[2].Value.Replace(".", ""));
        s = Rewrite(s, DeGroup(","), m => m.Groups[1].Value + m.Groups[2].Value.Replace(",", ""));

        // 3) WHAT IS LEFT BETWEEN TWO DIGITS IS SPENT ON A SPACE, NOT SPOKEN — no decimal word is sourceable, so
        //    the defect fixed is the false sentence break mid-quantity (`14,7` read with a clause pause inside).
        s = Rewrite(s, DOT_DECIMAL, "$1 $2");

        // 4) THE ERA MARKER, before any generic dotted-abbreviation handling. The left guard excludes a preceding
        //    dot, so `10.000 E.D.C.` is left whole; the final dot is kept at a sentence end or the pause is lost.
        foreach (var (re, word) in ERA)
            s = Rewrite(s, re, m => ERA_END.IsMatch(s.Substring(m.Index + m.Value.Length)) ? word + "." : word);

        // 5) THE NUMBER SIGN — `númeru` ×27 has one instance in exactly this slot; guarded on a following digit so
        //    a bare `Nº` cannot match.
        s = Rewrite(s, NUMBER_SIGN, "númeru ");

        // 6) THE ORDINAL INDICATOR — before the degree step. A following letter is required (separates the ordinal
        //    from the clause-final temperature), and values above 10 and the feminine `ª` are refused whole.
        s = Rewrite(s, ORDINAL_INDICATOR, m =>
        {
            var n = (int)Js.Number(m.Groups[1].Value);
            return n >= 1 && n <= 10 ? ORDINAL[n] : m.Value;
        });

        // 7) DEGREES — the scale letter and the compass letter are deliberately left. `º` reaches this step only
        //    when not followed by a letter (the one temperature), and the guard looks PAST a space.
        s = Rewrite(s, DEGREE, "$1 grau ");
        s = Rewrite(s, DEGREE_ORD, "$1 grau ");

        // 8) THE CLOCK — 17 of 20 colons here are clocks. The two-digit minute is the whole guard; the trailing
        //    guard rejects a digit or a continuing colon, not a dot or comma (the corpus's first clock ends `11:20,`).
        s = Rewrite(s, CLOCK, "$1 $2");

        // 9) FRACTIONS — digit-gated on both sides; the rule is written on the ASCII shape the vulgar fold produces.
        s = Rewrite(s, FRACTION, m => m.Groups[1].Value + " " + DENOMINATOR[m.Groups[2].Value]);

        // 10) RANGES — the mark is the ASCII hyphen and a doubled one, never an en dash; the dash is spent on a
        //     pause, nothing is required after the second number, and a chain of three or more is an identifier.
        s = Rewrite(s, RANGE_DOUBLE, "$1, ");
        s = Rewrite(s, RANGE, "$1, $2");

        // A padded replacement doubles a space that was already there; collapse the runs.
        return Rewrite(s, WS_RUN, " ");
    }
}
