/**
 * #1551 leftovers: sv `12:00,` and pl `1/2.5`. Ported from test/leftovers-1551.test.ts. Relational, never typed IPA.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class Leftovers1551Tests
{
    private static string Strip(string s) => System.Text.RegularExpressions.Regex.Replace(s, @"\s*[.,]\s*", " ").Trim();

    [Fact]
    public void SwedishColonClockBeforeACommaIsAClock() =>
        Assert.Equal(Strip(Phonemizer.Phonemize("Klockan 12:00. Sedan", "sv").ToLowerInvariant()), Strip(Phonemizer.Phonemize("Klockan 12:00, sedan", "sv")));

    [Fact]
    public void SwedishScoreBeforeACommaIsStillAScore() =>
        Assert.Equal(Phonemizer.Phonemize("Det blev 3 0, sedan", "sv"), Phonemizer.Phonemize("Det blev 3:0, sedan", "sv"));

    [Theory]
    [InlineData("To 1/2.5 razy", "To 1/2,5 razy")]
    [InlineData("Wynik 0.1/2 oraz", "Wynik 0,1/2 oraz")]
    public void APolishPeriodDecimalIsNotAFraction(string period, string comma)
    {
        var p = Phonemizer.Phonemize(period, "pl").Split(' ');
        var c = Phonemizer.Phonemize(comma, "pl").Split(' ');
        Assert.Equal(c.Length, p.Length);
        Assert.Single(p.Where((w, i) => w != c[i])); // only the point word differs
    }
}
