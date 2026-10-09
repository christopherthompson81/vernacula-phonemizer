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
        Assert.Equal("litres/constructor", Norm("litres/constructor"));
        Assert.Equal("toString/apples", Norm("toString/apples"));
        Assert.Equal("litres per day", Norm("litres/day"));
    }

    [Fact]
    public void AmbiguousMicroFoldDeclines()
    {
        Assert.Equal("25 mu M", Norm("25 ΜM"));
        Assert.Equal("5 mu S", Norm("5 ΜS"));
        Assert.Equal("25 micromolar", Norm("25 µM"));
        Assert.Equal("4 micro meters", Norm("4 µm"));
        Assert.Equal("3 micrograms", Norm("3 ΜG"));
        Assert.Equal("10 mega ohms and 10 milli ohms", Norm("10 MΩ and 10 mΩ"));
    }

    /// <summary>Not a date, so the date rules leave it exactly as written.</summary>
    [Theory]
    [InlineData("2024-02-31")]
    [InlineData("2/30/2024")]
    [InlineData("2024-04-31")]
    [InlineData("2023-02-29")]
    [InlineData("1900-02-29")]
    public void ImpossibleDateIsNotADate(string text) => Assert.Equal(text, Norm(text));

    [Theory]
    [InlineData("2024-02-29", "february 29th")]
    [InlineData("2000-02-29", "february 29th")]
    [InlineData("2024-12-31", "december 31st")]
    public void RealDateStillReads(string text, string want) => Assert.Contains(want, Norm(text));
}
