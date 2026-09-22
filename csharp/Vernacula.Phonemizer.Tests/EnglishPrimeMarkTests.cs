/**
 * The prime and double-prime as feet and inches, and the DMS coordinate that makes them ambiguous
 * (#1435). Ported from test/english-prime-marks.test.ts.
 *
 * ⚠ THE MARKS WERE DROPPED OUTRIGHT — `0.015″` read "zero point zero one five", `5′ 6″ tall` read
 * "five six tall", a height with no units at all.
 */
using Vernacula.Phonemizer.Languages.English;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishPrimeMarkTests
{
    private static string Norm(string s) => Normalize.NormalizeEnglish(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "en");

    [Theory]
    [InlineData("0.015″", "0.015 inches")]
    [InlineData("0.015″ wall", "0.015 inches wall")]
    [InlineData("12″ pipe", "12 inches pipe")]
    [InlineData("5′", "5 feet")]
    [InlineData("5′ 6″ tall", "5 feet 6 inches tall")]
    [InlineData("1″", "1 inch")]
    [InlineData("1′", "1 foot")]
    public void APrimeIsAFootAndADoublePrimeAnInch(string text, string expected)
        => Assert.Equal(expected, Norm(text));

    /// <summary>⚠ The reported case end to end, which needed #1437, the range rule and this one.</summary>
    [Fact]
    public void TheReportedToleranceRangeReadsWhole()
    {
        Assert.Equal("0.002 to 0.005 inches", Norm(".002–.005″"));
        Assert.Equal(Say("0.002 to 0.005 inches"), Say(".002–.005″"));
    }

    /// <summary>
    /// ⚠ A DEGREE SIGN CHANGES WHAT THE MARKS MEAN: arcminutes and arcseconds, not feet and inches. The
    /// coordinate is consumed FIRST so every prime the unit rule then sees is unambiguously a foot or
    /// an inch — which is what lets ⟨′⟩ and ⟨″⟩ be plain unit keys at all.
    /// </summary>
    [Theory]
    [InlineData("40°26′46″N", "40 degrees 26 minutes 46 seconds north")]
    [InlineData("40° 26′ 46″ N", "40 degrees 26 minutes 46 seconds north")]
    [InlineData("51°30′N", "51 degrees 30 minutes north")]
    [InlineData("40°26.5′N", "40 degrees 26.5 minutes north")]
    [InlineData("1°1′", "1 degree 1 minute")]
    public void ADegreeSignMakesItACoordinate(string text, string expected)
        => Assert.Equal(expected, Norm(text));

    /// <summary>
    /// ⚠ THE CASE THAT KILLED THE OTHER DESIGN. A backward scan for a preceding ⟨°⟩ has to admit a
    /// decimal and interior spaces, and once it admits both it also matches a SENTENCE END.
    /// </summary>
    [Fact]
    public void ADegreeInThePreviousSentenceIsNotACoordinate()
        => Assert.Equal("the angle is 90 degrees. 5 inches of travel",
                        Norm("the angle is 90°. 5″ of travel"));

    /// <summary>
    /// ⚠ THE HEMISPHERE LETTER ENDS ON `(?![\p{L}\p{M}])`, NOT `\b` — JS defines `\b` on ASCII `\w`, so
    /// `40°26′Nörd` read "…minutes northörd". The defect class of #949.
    /// </summary>
    [Fact]
    public void TheHemisphereLetterIsNotClaimedBeforeANonAsciiLetter()
    {
        Assert.DoesNotContain("north", Norm("40°26′Nörd"));
        Assert.Contains("north", Norm("40°26′N"));
    }

    /// <summary>⚠ Minutes are required, so the coordinate rule claims nothing the unit rule handles.</summary>
    [Theory]
    [InlineData("5°C", "5 degrees Celsius")]
    [InlineData("5°", "5 degrees")]
    [InlineData("40°26", "40 degrees 26")]
    public void ItIsLeftToTheUnitRule(string text, string expected)
        => Assert.Equal(expected, Norm(text));

    /// <summary>⚠ A prime with no number in front is not a unit — the mathematical prime is common.</summary>
    [Theory]
    [InlineData("f′(x)")]
    [InlineData("x′")]
    [InlineData("′″")]
    [InlineData("″")]
    public void APrimeWithNoNumberIsUntouched(string w) => Assert.Equal(w, Norm(w));

    /// <summary>
    /// ⚠ THE ASCII QUOTES ARE DELIBERATELY NOT CLAIMED. `"` and `'` are quotation marks and apostrophes
    /// far more often than units — the same reasoning that keeps ⟨in⟩ out of the unit table while
    /// ⟨µin⟩ is a whole key (#1427). U+2032 and U+2033 are only ever prime marks.
    /// </summary>
    [Theory]
    [InlineData("0.015\"")]
    [InlineData("5'")]
    public void TheAsciiQuotesAreLeftAlone(string w) => Assert.Equal(w, Norm(w));
}
