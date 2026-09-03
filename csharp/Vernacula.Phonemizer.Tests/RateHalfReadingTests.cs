// The C# half of test/rate-half-reading.test.ts — an unreadable rate reads its NUMERATOR and strands only
// the denominator (#1093 → #1098 → #1249).
//
// ⚠ THIS CONTRACT HAS BEEN BOTH WAYS ROUND. `km/h` is a unit plus a denominator NOUN, and a language that
// has not sourced the noun cannot say it. The arm first matched the numerator anyway and left `/h` outside
// the match; #1098 called that a half reading and rejected the whole match, so the abbreviation would stay
// where the leak gates can see it. #1249 measured that the abbreviation stays there EITHER WAY — the residue
// after the slash is character-for-character the same — while declining additionally throws away a reading
// the language has, and in 34 of the 193 registry codes hands the raw `km` to the English foreign reader,
// which says the LETTER NAMES. So the tier reads what it can read and strands what has no word behind it.
//
// The fleet-wide sweep lives in the TS, where every registry code is reachable. What is pinned here is the
// TIER CONTRACT itself, at the level the C# owns it, plus the two counter-examples #1098 measured — both
// unaffected, since neither was ever an ASCII-Latin denominator.
using Vernacula.Phonemizer.Core;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class RateHalfReadingTests
{
    private static readonly Func<string, string> Plain = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "kilometre" }, ["m"] = new[] { "metre" }, ["cm"] = new[] { "centimetre" },
            ["mg"] = new[] { "milligram" }, ["ml"] = new[] { "millilitre" },
        },
    });

    private static readonly Func<string, string> WithRate = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Units = new Dictionary<string, IReadOnlyList<string>> { ["km"] = new[] { "kilometre" } },
        UnitPer = "per",
        RateDenominators = new Dictionary<string, string> { ["h"] = "hour" },
        ExponentWords = new ExponentWordsDef { Squared = new[] { "square" }, Position = ExponentPosition.Before },
    });

    [Theory]
    // An UNDECLARED denominator: the NUMERATOR reads and only the `/den` strands, exactly as visible after
    // the slash as it was when the whole match declined.
    [InlineData("5 m/s", "5 metre/s")]
    [InlineData("5 km/h", "5 kilometre/h")]
    [InlineData("2-3 cm/yr", "2-3 centimetre/yr")]
    // …and the EXPONENT comes with the numerator, in both spellings. The decline rejected that branch too,
    // so `5 m³/s` used to lose the POWER as well as the noun; no `³` is stranded, because the trailing
    // lookahead refuses one and forces the exponent branch to take it.
    [InlineData("5 m³/s", "5 metre³/s")]
    [InlineData("5 km²/h", "5 kilometre²/h")]
    [InlineData("5 m2/s", "5 metre²/s")]
    [InlineData("5 km2/h", "5 kilometre²/h")]
    public void AnUnreadableRateReadsItsNumerator(string input, string want) => Assert.Equal(want, Plain(input));

    [Theory]
    // ⚠ THE TWO MEASURED COUNTER-EXAMPLES. A DIGIT after the slash is a RATIO of two readable quantities —
    // Min Nan's blood-sugar article writes `120mg/100ml`, where this arm reads the first and its own next
    // match reads the second, so declining would leak BOTH units raw.
    [InlineData("120mg/100ml", "120 milligram/100 millilitre")]
    // A NON-LATIN denominator is a word the host engine reads. Declining `12.8 km/秒` took a Japanese golden
    // row from `12.8 kilometre byou` — very nearly right — to the ENGLISH LETTER NAMES for `km`.
    [InlineData("12.8 km/秒", "12.8 kilometre/秒")]
    public void ADenominatorThatIsNotABareAbbreviationIsNotAStranding(string input, string want) =>
        Assert.Equal(want, Plain(input));

    [Theory]
    // ⚠ THE GUARD MUST NOT COST A LANGUAGE THE READINGS IT HAS SOURCED.
    [InlineData("5 km/h", "5 kilometre per hour")]
    [InlineData("5 km²/h", "5 square kilometre per hour")]
    [InlineData("5 km2/h", "5 square kilometre per hour")]
    [InlineData("5 km²", "5 square kilometre")]
    // …and an undeclared denominator strands where a rate IS declared, without costing the numerator.
    [InlineData("5 km/s", "5 kilometre/s")]
    public void ADeclaredRateStillReads(string input, string want) => Assert.Equal(want, WithRate(input));

    [Theory]
    // A plain digit after the unit is a DIFFERENT class (`2005 MM13`, `約20 km15マイル`) and is deliberately
    // left alone here — see the TS for the two goldens that measurement moved in opposite directions.
    [InlineData("20 km15", "20 kilometre15")]
    [InlineData("5 km", "5 kilometre")]
    public void APlainDigitAfterTheUnitIsNotThisDefect(string input, string want) =>
        Assert.Equal(want, Plain(input));
}
