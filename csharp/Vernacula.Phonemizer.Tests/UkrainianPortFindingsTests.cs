/**
 * Ukrainian defects the Rust port found (#1525), fixed TS-first. Ported from test/ukrainian-port-findings.test.ts;
 * probe text is synthetic, and the expectations are the TS engine's output.
 */
using Normalize = Vernacula.Phonemizer.Languages.Ukrainian.Normalize;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class UkrainianPortFindingsTests
{
    private static string N(string s) => Normalize.NormalizeUkrainian(s);

    [Fact]
    public void AClockTimeBeforeAFullStopOrACommaIsRead()
    {
        Assert.Equal("Це почалося о шостій тридцять.", N("Це почалося о 6:30."));
        Assert.Equal("о шостій тридцять, потім", N("о 6:30, потім"));
        Assert.Equal("О двадцятій тридцять і з шостої тридцять.", N("О 20:30 і з 6:30."));
        Assert.Equal("о 6:30,5", N("о 6:30,5"));
        Assert.Equal("о 6:30,5", N("о 6:30.5"));
    }

    [Fact]
    public void AnAbbreviationDotBeforeACapitalAlsoEndsTheSentence()
    {
        Assert.Equal("1990 року. Потім", N("1990 р. Потім"));
        Assert.Equal("та інше. Потім", N("та ін. Потім"));
        Assert.Equal("1990 року потім", N("1990 р. потім"));
        Assert.Equal("дивись Петренко", N("див. Петренко"));
        Assert.Contains(" . ", Phonemizer.Phonemize("1990 р. Потім", "uk"));
        Assert.DoesNotContain(" . ", Phonemizer.Phonemize("1990 р. потім", "uk"));
    }

    [Fact]
    public void TheFractionDenominatorTakesTheNumeratorsCount()
    {
        Assert.Equal("дві третіх", N("2/3"));
        Assert.Equal("п'ять восьмих", N("5/8"));
        Assert.Equal("двадцять дві п'ятих", N("22/5"));
        Assert.Equal("одинадцять п'ятих", N("11/5"));
        Assert.Equal("одна п'ята", N("1/5"));
        Assert.Equal("двадцять одна сота", N("21/100"));
    }

    [Fact]
    public void EveryAbbreviationArmDeclinesAFoldedMiss()
    {
        Assert.Equal("ᲁив., далі", N("ᲁив., далі"));
        Assert.Equal("дивись ᲃтор., далі", N("Див. ᲃтор., далі"));
    }

    [Fact]
    public void ConstructorBeforeAClockTimeDoesNotBlockIt()
    {
        Assert.Equal("Constructor десята тридцять", N("Constructor 10:30"));
        Assert.Equal("toString десята тридцять", N("toString 10:30"));
    }

    [Fact]
    public void ClockMinutesAgreeWithTheFeminineKhvylyna()
    {
        Assert.Equal("О першій одна", N("О 1:01"));
        Assert.Equal("третя дві", N("3:02"));
        Assert.Equal("о двадцятій двадцять одна", N("о 20:21"));
        Assert.Equal("о одинадцятій дванадцять", N("о 11:12"));
    }
}
