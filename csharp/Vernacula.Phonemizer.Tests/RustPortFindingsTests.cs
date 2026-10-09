/**
 * Four defects the Rust port found by reading (#1463), fixed TS-first.
 * Ported from test/rust-port-findings.test.ts.
 *
 * ⚠ THE PROTOTYPE HALF WAS ALREADY RIGHT HERE: a `Dictionary` inherits nothing, so the TypeScript moved onto
 * C#. These assertions pin it anyway, so that a future "simplification" cannot reintroduce it on either side.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class RustPortFindingsTests
{
    private static string Norm(string s) => Languages.English.Normalize.NormalizeEnglish(s);

    [Fact]
    public void EntityNamedLikeAPrototypeMemberStaysLiteral()
    {
        Assert.Equal("a &constructor; b", Core.Markup.StripMarkup("a &constructor; b"));
        Assert.Equal("a & b", Core.Markup.StripMarkup("a &amp; b"));
    }

    [Fact]
    public void SlashRateIgnoresInheritedMembers()
    {
        Assert.DoesNotContain("function", Norm("litres/constructor"));
        Assert.DoesNotContain(" per ", Norm("toString/apples"));
        Assert.Equal("litres per day", Norm("litres/day"));
    }

    [Fact]
    public void AmbiguousMicroFoldDeclines()
    {
        Assert.DoesNotContain("micro meter", Norm("25 ΜM"));
        Assert.DoesNotContain("microsecond", Norm("5 ΜS"));
        Assert.Equal("25 micromolar", Norm("25 µM"));
        Assert.Equal("4 micro meters", Norm("4 µm"));
        Assert.Equal("3 micrograms", Norm("3 ΜG"));
        Assert.Equal("10 mega ohms and 10 milli ohms", Norm("10 MΩ and 10 mΩ"));
    }

    [Theory]
    [InlineData("2024-02-31", "february")]
    [InlineData("2/30/2024", "february")]
    [InlineData("2024-04-31", "april")]
    [InlineData("2023-02-29", "february")]
    [InlineData("1900-02-29", "february")]
    public void ImpossibleDateIsNotADate(string text, string month) => Assert.DoesNotContain(month, Norm(text));

    [Theory]
    [InlineData("2024-02-29", "february 29th")]
    [InlineData("2000-02-29", "february 29th")]
    [InlineData("2024-12-31", "december 31st")]
    public void RealDateStillReads(string text, string want) => Assert.Contains(want, Norm(text));
}
