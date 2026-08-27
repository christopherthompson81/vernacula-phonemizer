// The C# half of test/rate-half-reading.test.ts — an unreadable rate must DECLINE, not half-read (#1093).
//
// ⚠ THE DEFECT WAS A TIER ANSWERING A DATA GAP WITH HALF A READING: `km/h` is a unit plus a denominator
// NOUN, and a language that has not sourced the noun cannot say it — but the shared arm matched the
// numerator anyway and left `/h` outside the match, to reach the sink as a bare letter. `MakeBareUnitNormalizer`
// two screens below it already refused exactly this ("a half reading is worse than a visible leak"); the two
// arms disagreed and the bare one was right.
//
// The fleet-wide sweep lives in the TS, where every registry code is reachable. What is pinned here is the
// TIER CONTRACT itself, at the level the C# owns it, plus the two counter-examples that put the line at an
// ASCII-Latin denominator rather than at any slash.
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
    // An UNDECLARED denominator: the whole match declines and the symbol stays visible to the leak gates.
    [InlineData("5 m/s")]
    [InlineData("5 km/h")]
    [InlineData("2-3 cm/yr")]
    // …and the exponent goes with it, in both spellings. Without this the group BACKTRACKS to empty and
    // claims a bare `5 m`, stranding `³/s`.
    [InlineData("5 m³/s")]
    [InlineData("5 km²/h")]
    [InlineData("5 m2/s")]
    [InlineData("5 km2/h")]
    public void AnUnreadableRateDeclinesWhole(string input) => Assert.Equal(input, Plain(input));

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
    // …and an undeclared denominator still declines even where a rate IS declared.
    [InlineData("5 km/s", "5 km/s")]
    public void ADeclaredRateStillReads(string input, string want) => Assert.Equal(want, WithRate(input));

    [Theory]
    // A plain digit after the unit is a DIFFERENT class (`2005 MM13`, `約20 km15マイル`) and is deliberately
    // left alone here — see the TS for the two goldens that measurement moved in opposite directions.
    [InlineData("20 km15", "20 kilometre15")]
    [InlineData("5 km", "5 kilometre")]
    public void APlainDigitAfterTheUnitIsNotThisDefect(string input, string want) =>
        Assert.Equal(want, Plain(input));
}
