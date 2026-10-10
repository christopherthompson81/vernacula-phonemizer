/**
 * The shared Indic composer refuses an unsafe integer (#1463): on Infinity it recursed until the stack
 * overflowed and killed the process, and above 2^53 it composed the rounded double.
 * Ported from test/indic-composer-safe-integer.test.ts. Expectations are relational, never typed IPA.
 */
using Vernacula.Phonemizer.Core;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class IndicComposerSafeIntegerTests
{
    private static NumbersDef HI => Languages.Hindi.Hindi.DEF.Numbers;

    [Theory]
    [InlineData(9007199254740992d)]
    [InlineData(9007199254740994d)]
    [InlineData(1e21)]
    [InlineData(double.PositiveInfinity)]
    [InlineData(double.NegativeInfinity)]
    [InlineData(double.NaN)]
    [InlineData(1.5)]
    public void UnsafeIntegerIsAGap(double n) => Assert.Equal(new string?[] { null }, Numbers.indicNumberWords(n, HI));

    [Fact]
    public void LargestSafeIntegerStillComposes()
    {
        var w = Numbers.indicNumberWords(9007199254740991d, HI);
        Assert.True(w.Count > 1);
        Assert.DoesNotContain(null, w);
    }

    [Fact]
    public void IsSafeIntegerMatchesJs()
    {
        Assert.True(Js.IsSafeInteger(9007199254740991d));
        Assert.True(Js.IsSafeInteger(-9007199254740991d));
        Assert.False(Js.IsSafeInteger(9007199254740992d));
        Assert.False(Js.IsSafeInteger(1.5));
        Assert.False(Js.IsSafeInteger(double.NaN));
        Assert.False(Js.IsSafeInteger(double.PositiveInfinity));
    }

    public static IEnumerable<object[]> Markers() => new[]
    {
        new object[] { "pa", "ਵਾਂ" }, new object[] { "ur", "واں" }, new object[] { "or", "ତମ" },
        new object[] { "bn", "তম" }, new object[] { "as", "নং" }, new object[] { "as", "তম" },
        new object[] { "hi", "वाँ" }, new object[] { "mr", "वा" },
    };

    [Theory]
    [MemberData(nameof(Markers))]
    public void AboveTwoToThe53ReadsItsOwnDigits(string lang, string marker)
    {
        string P(string s) => Phonemizer.Phonemize(s, lang);
        var above = P($"9007199254740993{marker}");
        Assert.NotEqual(P($"9007199254740992{marker}"), above);
        Assert.Equal($"{P("9007199254740993")} {P(marker)}", above);
        Assert.DoesNotMatch(@"\d", above);
    }

    [Theory]
    [MemberData(nameof(Markers))]
    public void FourHundredDigitRunDoesNotCrash(string lang, string marker)
    {
        string P(string s) => Phonemizer.Phonemize(s, lang);
        var digits = new string('1', 400);
        var outp = P($"{digits}{marker}");
        Assert.Equal($"{P(digits)} {P(marker)}", outp);
        Assert.DoesNotMatch(@"\d", outp);
    }
}
