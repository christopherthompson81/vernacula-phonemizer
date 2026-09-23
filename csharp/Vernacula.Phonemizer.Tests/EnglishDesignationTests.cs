/**
 * Alphanumeric material designations (#1458). Ported from test/english-normalize.test.ts.
 *
 * ⚠ THE `L` OF `316L` RESOLVED AS LITRES — `316L tubing` read "three hundred sixteen LITERS tubing". A
 * WRONG UNIT, which the normalizer ranks worse than a missing word, and #1421's postal-code leak reached
 * from the other side: that guard needs a TOKEN-INITIAL LETTER then one digit (`V6L`), and `316L` has
 * none. ⚠ AND NO SHAPE-BASED RULE SEPARATES IT FROM `a 5L jug`, which is why the fix is a LIST.
 */
using Vernacula.Phonemizer.Languages.English;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishDesignationTests
{
    private static string Norm(string s) => Normalize.NormalizeEnglish(s);

    /// ⚠ THE SPOKEN FORM, NOT A GLOSS (the user's call): "three sixteen L", never "…austenitic stainless
    /// steel". `Ti64` is the same principle from the other side — not "titanium six aluminium four vanadium".
    [Theory]
    [InlineData("316L tubing", "three sixteen L tubing")]
    [InlineData("a Ti64 part", "a titanium sixty-four part")]
    public void TheReportedDesignationsReadAsTheyAreSaid(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /// ⚠ A GENUINE glued volume must still read — the reason the fix is a list and not a shape rule.
    [Theory]
    [InlineData("a 5L jug", "a 5 liters jug")]
    [InlineData("500L tank", "500 liters tank")]
    public void AGenuineGluedVolumeStillReads(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /// ⚠ The capitalisation IS the signal, and the token boundary is exact.
    [Theory]
    [InlineData("A316LX")]
    [InlineData("316LX")]
    public void ADesignationInsideALongerTokenIsNotOne(string w) => Assert.Equal(w, Norm(w));

    /// ⚠ Rows on REPORT, not by enumeration — the near neighbours misread today and are left alone.
    [Fact]
    public void TheNearNeighboursAreDeliberatelyAbsent() =>
        Assert.Equal("304 liters pipe", Norm("304L pipe"));
}
