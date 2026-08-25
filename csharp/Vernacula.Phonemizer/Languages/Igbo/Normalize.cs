/**
 * Igbo (ig) TEXT NORMALIZATION — the symbols a reader voices, rewritten to words before the tokenizer sees
 * them. Pure text→text, no IPA. The unit noun and the percent word both PRECEDE their number.
 * Ported from src/languages/igbo/normalize.ts — see that file for the corpus evidence, for every unit
 * attestation, and for the keys it deliberately refuses.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Igbo;

public static class Normalize
{
    /** THE UNIT TABLE. ⚠ INSERTION-ORDERED: the tier and `FUSED_QUANTITY` are both derived from it. */
    private static readonly IReadOnlyDictionary<string, string> UNIT = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "kilomita",
        ["mm"] = "milimita",
        ["cm"] = "sentimita",
        ["kg"] = "kilogram",
    };

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "pasent" },
        PercentPrefix = true,
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["₦"] = new[] { "naira" },
            ["US$"] = new[] { "dollar" },
            ["$"] = new[] { "dollar" },
        },
        /** Derived from the ONE table above, so the tier and rule 2b can never disagree about which keys exist. */
        Units = UNIT.ToDictionary(e => e.Key, e => (IReadOnlyList<string>)new[] { e.Value }, StringComparer.Ordinal),
        UnitPrefix = true,
        ExponentWords = new ExponentWordsDef { Squared = new[] { "skwea" }, Position = ExponentPosition.After },
        Ampersand = "na",
    });

    /** The thousands separator is a COMMA and the decimal separator a PERIOD. */
    private static readonly JsRe GROUPED = JsRegex.Compile("(\\d),(\\d{3})(?!\\d)", "gu");
    /** A decimal period. Voiced as `ntụkpọ` — see rule 4. */
    private static readonly JsRe DECIMAL = JsRegex.Compile("(\\d)\\.(\\d+)", "gu");
    /** A digit-flanked dash. See rule 2 for why this is a RANGE and never a minus. */
    private static readonly JsRe RANGE = JsRegex.Compile("(\\d)\\s*[-–—]\\s*(?=\\d)", "gu");
    /** THE ENGLISH ORDINAL TAIL — the DIGITS are what separate it from ordinary Igbo `nd`/`st`. */
    private static readonly JsRe ORDINAL_TAIL = JsRegex.Compile("\\b(\\d+)(?:st|nd|rd|th)\\b", "giu");
    /** A letter fused to the front of a QUANTITY — the space rule 2b restores. Derived from `UNIT`. */
    private static readonly JsRe FUSED_QUANTITY = JsRegex.Compile(
        $@"(\p{{L}})(?=\d[\d.,]*\s*(?:{string.Join("|", UNIT.Keys)})(?:[²³23])?(?![\p{{L}}\p{{M}}\d]))", "giu");

    /** Normalize Igbo text: symbols the reader voices become words, before `Igbo.cs`'s TOKEN ever sees them. */
    public static string NormalizeIgbo(string text)
    {
        var s = text;

        // 1. De-group thousands FIRST, repeatedly, so `1,234,567` becomes one number.
        while (GROUPED.IsMatch(s)) s = GROUPED.Replace(s, "$1$2");

        // 1b. `8th` → `nke 8` — the ordinal marker is a corpus word and the DIGITS go to the compositor.
        s = ORDINAL_TAIL.Replace(s, "nke $1");

        // 2. A digit-flanked dash in Igbo is a RANGE, not a minus. `ruo` is "to, until".
        s = RANGE.Replace(s, "$1 ruo ");

        // 2b. ⚠ BEFORE the tier, which MOVES the unit noun leftward onto whatever precedes the digits.
        s = FUSED_QUANTITY.Replace(s, "$1 ");

        // 3. The shared symbol tier.
        s = SYMBOLS(s);

        // 4. ⚠ The decimal separator LAST: run before the tier it splits `8.3%` and the percent word lands
        //    between the halves. The fraction stays digit-by-digit after the word.
        s = DECIMAL.Replace(s, m =>
            $"{m.Groups[1].Value} {Manifest.MANIFEST.Numbers.DecimalWord} {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        return s;
    }
}
