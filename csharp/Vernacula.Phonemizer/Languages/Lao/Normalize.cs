/**
 * Lao (lo) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/lao/normalize.ts — see that file for the corpus evidence (the two invisible
 * characters, the era markers, the group-size separator split, and the four declined classes).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Lao;

public static class Normalize
{
    /** The shared symbol tier — every word attested in its slot; see the TS for the citations. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "ຮ້ອຍລະ" },
        PercentPrefix = true,
        // ⚠ INSERTION-ORDERED, matching the TS object literal: the tier's longest-first sort is stable,
        // so declaration order is the tie-break.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "ໂດລາສະຫະລັດ" },
            ["$"] = new[] { "ໂດລາ" },
            ["€"] = new[] { "ເອີໂຣ" },
            ["£"] = new[] { "ປອນ" },
        },
        Magnitudes = new[] { "ພັນ", "ລ້ານ", "ຕື້" },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "ກິໂລແມັດ" },
            ["m"] = new[] { "ແມັດ" },
            ["cm"] = new[] { "ຊັງຕີແມັດ" },
            ["kg"] = new[] { "ກິໂລກຼາມ" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "ຕາລາງ" },
            Cubed = new[] { "ກ້ອນ" },
            Position = new ExponentPositionSpec
            {
                Squared = ExponentPosition.Compound,
                Cubed = ExponentPosition.Suffix,
            },
        },
        Ampersand = "ແລະ",
        UnspacedScript = true,
    });

    /** The era markers, as a CLOSED LIST and BOUNDED ON BOTH SIDES — ⟨ຄ⟩ and ⟨ສ⟩ begin ordinary Lao words,
     *  and this corpus writes a sentence period with no space after it. */
    private static readonly (JsRe Re, string To)[] ERA =
    {
        (JsRegex.Compile("(?<![຀-໿])ຄ\\s?\\.\\s?ສ\\s?\\.?(?![຀-໿])", "gu"), "ຄຣິດສັກກະລາດ "),
        (JsRegex.Compile("(?<![຀-໿])ພ\\s?\\.\\s?ສ\\s?\\.?(?![຀-໿])", "gu"), "ພຸດທະສັກກະລາດ "),
    };

    // The step patterns. The TS builds each inline; JsRegex.Compile caches, so hoisting them is a
    // readability choice and not a behaviour one.
    private static readonly JsRe NBSP = JsRegex.Compile("&nbsp;", "gu");
    /** ⚠ WRITTEN AS ESCAPES, NOT LITERALS. The TS source spells this class with the three invisible
     *  characters themselves; same class, stated by code point: U+00AD SOFT HYPHEN, U+200C ZWNJ, U+FEFF.
     *  ⚠ U+200B ZERO WIDTH SPACE IS DELIBERATELY ABSENT — in this spaceless script it is doing the word
     *  segmentation the tokenizer needs. See the TS header. */
    private static readonly JsRe INVISIBLE = JsRegex.Compile("[\\u00ad\\u200c\\ufeff]", "gu");
    private static readonly JsRe US_DOLLAR = JsRegex.Compile("(?<![\\p{L}])Us\\$", "gu");
    private static readonly JsRe DOUBLE_SPACE = JsRegex.Compile("  +", "gu");
    private static readonly JsRe GROUP = JsRegex.Compile(
        "(?<![\\p{Nd}.,])([1-9]\\p{Nd}{0,2}(?:([.,])\\p{Nd}{3})+)(?![\\p{Nd}.,])", "gu");
    private static readonly JsRe MINUS_SIGN = JsRegex.Compile("−(?=\\p{Nd})", "gu");
    private static readonly JsRe MINUS_ASCII = JsRegex.Compile("(?<!\\p{Nd}\\s?)(?<![{_])-(?=\\p{Nd})", "gu");
    private static readonly JsRe DEGREE_SCALE = JsRegex.Compile(
        "(\\p{Nd}+(?:[.,]\\p{Nd}+)?)\\s*(?:°\\s*[CF]|[cf]\\s*°)(?![\\p{L}])", "giu");
    private static readonly JsRe DEGREE_BARE = JsRegex.Compile("(\\p{Nd}+(?:[.,]\\p{Nd}+)?)\\s*°", "gu");
    private static readonly JsRe PERCENT_WORD_NUM = JsRegex.Compile(
        "(ເປີເຊັນ|ຮ້ອຍລະ)(\\s*\\p{Nd}[\\p{Nd}.,]*)\\s*%", "gu");
    private static readonly JsRe PERCENT_WORD_SIGN = JsRegex.Compile("(ເປີເຊັນ|ຮ້ອຍລະ)\\s*%(?=\\s?\\p{Nd})", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile(
        "(?<![\\p{Nd}.,])(\\p{Nd}+)[.,](\\p{Nd}+)(?![\\p{Nd}.,])", "gu");

    /** Every rule emits Lao WORDS or ASCII digits; nothing reaches the phoneme sink as a spelling. */
    public static string NormalizeLao(string input)
    {
        var s = input;

        // 1) THE SOFT HYPHEN GOES AND THE ZERO WIDTH SPACE STAYS — see the TS header.
        s = INVISIBLE.Re.Replace(NBSP.Re.Replace(s, " "), "");
        s = US_DOLLAR.Re.Replace(s, "US$$");

        // 2) ERA MARKERS — before anything that reads a dot, and the largest single class in the language.
        foreach (var (rx, word) in ERA) s = rx.Re.Replace(s, word);
        s = DOUBLE_SPACE.Re.Replace(s, " ");

        // 3) THE SEPARATORS, BY GROUP SIZE — three digits after the mark is a THOUSANDS group whichever
        //    mark carries it.
        s = JsRegex.Replace(s, GROUP, m => m.Value.Replace(m.Groups[2].Value, "", StringComparison.Ordinal));

        // 4) NEGATIVE NUMBERS — U+2212 anywhere, the ASCII hyphen only where it does not follow a number.
        s = MINUS_SIGN.Re.Replace(s, "ລົບ ");
        s = MINUS_ASCII.Re.Replace(s, "ລົບ ");

        // 5) DEGREES — `ອົງສາ`, POSTPOSED. Lao writes the scale letter FIRST (`30 - 33 c°`), so both orders
        //    are claimed and the letter is consumed rather than read as an English letter name.
        s = DEGREE_SCALE.Re.Replace(s, "$1 ອົງສາ");
        s = DEGREE_BARE.Re.Replace(s, "$1 ອົງສາ");

        // 5b) A PERCENT WORD ALREADY IN THE TEXT SPENDS THE SIGN — on either side of the figure.
        s = PERCENT_WORD_NUM.Re.Replace(s, "$1$2");
        s = PERCENT_WORD_SIGN.Re.Replace(s, "$1");

        // 6) THE SHARED TIER — above step 7, because the tier matches a unit only when a NUMBER is adjacent
        //    and the decimal rewrite destroys that adjacency.
        s = SYMBOLS(s);

        // 7) THE DECIMAL POINT — `ຈຸດ`, fractional digits emitted ONE AT A TIME, as they are said.
        s = JsRegex.Replace(s, DECIMAL,
            m => m.Groups[1].Value + " ຈຸດ " + string.Join(" ", Js.CodePoints(m.Groups[2].Value)));

        return s;
    }
}
