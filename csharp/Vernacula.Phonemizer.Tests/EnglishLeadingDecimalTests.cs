/**
 * A leading-point decimal gets its zero (#1437).
 * Ported from test/english-leading-decimal.test.ts.
 *
 * ⚠ THE TOKEN WAS NEVER A NUMBER AT ALL, so every downstream rule declined it in turn. These cases pin
 * the CASCADE rather than the reading — one insertion fixes the unit, the range and the magnitude.
 */
using Vernacula.Phonemizer.Languages.English;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishLeadingDecimalTests
{
    private static string Norm(string s) => Normalize.NormalizeEnglish(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "en");

    /// <summary>
    /// ⚠ A WRONG MAGNITUDE IS WORSE THAN A DROP — `.002` read "two", off by a factor of 500.
    /// </summary>
    [Fact]
    public void ThePointAndItsZerosSurvive()
    {
        Assert.Equal("0.002", Norm(".002"));
        Assert.Equal("0.5", Norm(".5"));
        Assert.Equal(Say("0.002"), Say(".002"));
        Assert.NotEqual(Say("2"), Say(".002"));
    }

    /// <summary>⚠ The unit was reaching the g2p as bare letters — ⟨kg⟩ as the word *king*.</summary>
    [Theory]
    [InlineData(".002 mm", "0.002 millimeters")]
    [InlineData(".5 kg", "0.5 kilograms")]
    [InlineData(".25 L", "0.25 liters")]
    [InlineData(".5%", "0.5 percent")]
    public void ItKeepsItsUnit(string text, string expected) => Assert.Equal(expected, Norm(text));

    [Fact]
    public void KgIsNoLongerReadAsAWord()
    {
        Assert.DoesNotContain("kʰˈɪŋ", Say(".5 kg"));
        Assert.Equal(Say("0.5 kg"), Say(".5 kg"));
    }

    /// <summary>⚠ The range is digit-gated on both sides, so the dash survived as a phrase break.</summary>
    [Theory]
    [InlineData(".5–.75 mm", "0.5 to 0.75 millimeters")]
    [InlineData(".002–.005", "0.002 to 0.005")]
    public void ARangeOfLeadingPointDecimalsReadsAsARange(string text, string expected)
        => Assert.Equal(expected, Norm(text));

    /// <summary>
    /// ⚠ THE LOOKBEHIND CARRIES THE WHOLE GUARD: a point preceded by a LETTER is an abbreviation, by a
    /// DIGIT a version or an address, by another POINT an ellipsis.
    /// </summary>
    [Theory]
    [InlineData("Fig.2")]
    [InlineData("v1.002")]
    [InlineData("192.168.1.1")]
    [InlineData("10.0.0.1")]
    [InlineData("..002")]
    [InlineData("3.14")]
    [InlineData("1,234.5")]
    [InlineData("Section 3.2")]
    public void IsUntouched(string w) => Assert.Equal(w, Norm(w));

    [Theory]
    [InlineData("End. 002 next")]
    [InlineData("He left. 5 came")]
    public void ASentenceBoundaryIsNotADecimalPoint(string w) => Assert.Equal(w, Norm(w));

    /// <summary>⚠ Currency falls out for free — the currency rule was declining the same token.</summary>
    [Theory]
    [InlineData("$.50", "50 cents")]
    [InlineData("£.75", "75 pence")]
    public void ABarePointMoneyAmountReads(string text, string expected)
        => Assert.Equal(expected, Norm(text));

    /// <summary>
    /// ⚠ A LEADING POINT IS NOT ALWAYS A DECIMAL, and this was a REGRESSION the first draft introduced.
    /// A firearm CALIBER and a batting AVERAGE are integer labels written with a point, and all of these
    /// were ALREADY CORRECT before the rule existed. No shape separates them from a decimal, so the gate
    /// is lexical: a cue word after the digits, or `batting`/`hitting` before the point.
    /// </summary>
    [Theory]
    [InlineData(".50 caliber")]
    [InlineData(".45 ACP")]
    [InlineData(".38 Special")]
    [InlineData(".22 LR")]
    [InlineData(".223 Remington")]
    [InlineData(".308 Winchester")]
    [InlineData("batting .300")]
    [InlineData("hitting .350")]
    public void ACaliberOrAverageIsNotADecimal(string w)
    {
        Assert.Equal(w, Norm(w));
        Assert.DoesNotContain("p\u02b0\u0254\u1da6nt", Say(w));
    }

    /// <summary>
    /// ⚠ KNOWN AND ACCEPTED COST, pinned so it is a decision: a BARE caliber with no cue has nothing to
    /// key on and becomes a decimal.
    /// </summary>
    [Fact]
    public void ABareCaliberHasNoCue() => Assert.Equal("he carried a 0.45", Norm("he carried a .45"));

    /// <summary>⚠ A decomposed accent ends in a combining MARK, not a letter.</summary>
    [Fact]
    public void ADecomposedAccentIsStillALetterBoundary()
        => Assert.Equal("cafe\u0301.5 kg", Norm("cafe\u0301.5 kg"));

    /// <summary>
    /// ⚠ The ASCII hyphen is still not a range, and that is the documented decision, not a gap: it is a
    /// date, a phone number and a score far more often than a span.
    /// </summary>
    [Theory]
    [InlineData(".002-.005", "0.002-0.005")]
    [InlineData("5-10", "5-10")]
    public void TheAsciiHyphenIsLeftAsItWas(string text, string expected)
        => Assert.Equal(expected, Norm(text));
}
