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

    /// ⚠ THE ONE PLACE DESIGNATION_TOKEN DIVERGES FROM FORMULA_TOKEN: it drops the `(?!-\p{Lu})` tail.
    /// WITH the tail, `316L-Grade` would be left unclaimed and the UNIT PASS would take it — an unclaimed
    /// designation falls back to a WRONG UNIT, not to "harmlessly spelled out". `317L-Grade` is the
    /// unlisted control that shows what that fallback does. The accepted cost is the `Ti64-Al` row.
    [Theory]
    [InlineData("317L-Grade", "317 liters-Grade")]
    [InlineData("316L-Grade", "three sixteen L-Grade")]
    [InlineData("Ti64-Al", "titanium sixty-four-Al")]
    public void AHyphenHeadIsClaimedBecauseUnclaimedWouldInventAUnit(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /// MIXED-CASE ABBREVIATIONS (#1460) — `DoE` read "doe", and it reaches no initialism rule at all
    /// because that pass claims ALL-CAPS runs.
    [Fact]
    public void AMixedCaseAbbreviationIsExpanded() =>
        Assert.Equal("the design of experiments matrix", Norm("the DoE matrix"));

    /// ⚠ THE EXACT CASE IS THE ENTIRE SAFETY PROPERTY OF THAT TABLE, and nothing else pins it: the
    /// goldens contain no `DoE`, so parity would not catch a drift either. `doe` is a common noun and
    /// `DOE` is the US Department of Energy — neither may be claimed.
    [Theory]
    [InlineData("a doe in the field")]
    [InlineData("the DOE budget")]
    [InlineData("aDoE")]
    [InlineData("DoEs")]
    public void OnlyTheExactMixedCaseSpellingIsClaimed(string s) =>
        Assert.DoesNotContain("design of experiments", Norm(s));
}
