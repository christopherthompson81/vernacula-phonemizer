/**
 * The ASCII spellings of the prime units (#1449). Ported from test/english-normalize.test.ts.
 *
 * ⚠ THE CORPUS INVERTED THE OBVIOUS FIX. `'` and `"` are overwhelmingly an apostrophe and a quotation
 * mark, and digit-adjacency is NOT a sufficient guard: measured over FLEURS `en_us`, 3,643 lines, EVERY
 * ONE of the ten digit+quote occurrences is a false positive — `7's rugby` ×4 and six CLOSING QUOTES
 * (`"cosmonaut No. 11"`, `a decal reading "18"`, `"…July 1, 2020"`, `"…4th July 1776"`). A rule keyed on
 * the digit alone would have fired ten times and been wrong every time, turning a silent drop into an
 * audible corruption — the worse trade, and the same class as `6′2″` reading "6 SQUARE FEET".
 */
using Vernacula.Phonemizer.Languages.English;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishAsciiPrimeUnitTests
{
    private static string Norm(string s) => Normalize.NormalizeEnglish(s);

    /// <summary>The two shapes the corpus says are safe: a DECIMAL + `"`, and the COMPOUND.</summary>
    [Theory]
    [InlineData("0.015\" total", "0.015 inches total")]
    [InlineData("he is 6' 2\" tall", "he is 6 feet 2 inches tall")]
    [InlineData("6'2\"", "6 feet 2 inches")]
    // ⚠ THE COMPOUND RUNS FIRST, or the decimal rule claims the inches alone and strands the feet.
    [InlineData("a 6' 2.5\" board", "a 6 feet 2.5 inches board")]
    public void TheTwoSafeShapesRead(string input, string expected) => Assert.Equal(expected, Norm(input));

    /// ⚠ The actual corpus lines, and the reason the rule is this narrow. A bare `N'` and a bare
    /// integer + `"` are refused outright — which costs `a 2" pipe`, taken at six counterexamples to zero.
    [Theory]
    [InlineData("a perfect day for 7's rugby")]
    [InlineData("a decal reading \"18\" and")]
    [InlineData("\"5\" is the answer")]
    [InlineData("the 90's")]
    [InlineData("a 2\" pipe")]
    public void EveryDigitQuoteInTheCorpusIsAFalsePositiveAndDoesNotMove(string input) =>
        Assert.Equal(input, Norm(input));

    /// ⚠ A REGRESSION THE SHAPE PROBE CAUGHT, NOT A TEST. Once FEET_INCHES_ASCII existed, the ASCII
    /// coordinate had nothing in front of it — the compound claimed `26'46"` and `40°26'46"N` read
    /// "40 degrees 26 FEET 46 INCHES N", worse than the half-normalized string it replaced.
    [Theory]
    [InlineData("40°26'46\"N", "40 degrees 26 minutes 46 seconds north")]
    [InlineData("40°26'N", "40 degrees 26 minutes north")]
    public void TheAsciiDmsCoordinateIsNotClaimedByTheCompound(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    [InlineData("0.015″ total", "0.015 inches total")]
    [InlineData("he is 6′ 2″ tall", "he is 6 feet 2 inches tall")]
    [InlineData("40°26′46″N", "40 degrees 26 minutes 46 seconds north")]
    public void TheTypographicFormsAreUntouched(string input, string expected) =>
        Assert.Equal(expected, Norm(input));
}
