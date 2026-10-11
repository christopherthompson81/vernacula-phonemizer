/**
 * #1514: five German defects the Rust port found. Ported from test/german-1514.test.ts. Expectations are
 * relational — each input must read the same as a spelling the engine already reads correctly — never typed IPA.
 */
using Xunit;
using GermanG2p = Vernacula.Phonemizer.Languages.German.G2p;
using GermanNormalize = Vernacula.Phonemizer.Languages.German.Normalize;

namespace Vernacula.Phonemizer.Tests;

public class German1514Tests
{
    private static string De(string s) => Phonemizer.Phonemize(s, "de");

    [Theory]
    [InlineData("3.000,50 Euro", "3000,50 Euro")]
    [InlineData("1.000,5", "1000,5")]
    [InlineData("1.000.000,25 Euro", "1000000,25 Euro")]
    [InlineData("1.000, dann", "1000, dann")]
    public void AGroupedAmountKeepsItsDecimalComma(string grouped, string plain) =>
        Assert.Equal(De(plain), De(grouped));

    [Theory]
    [InlineData("z. b. das", "z. B. das")]
    [InlineData("z.b. das", "z.B. das")]
    [InlineData("u. ä. mehr", "u. Ä. mehr")]
    public void ZbAndUaeMatchLowercasedInput(string lower, string cased)
    {
        Assert.Equal(De(cased), De(lower));
        Assert.Equal(GermanNormalize.NormalizeGerman(cased), GermanNormalize.NormalizeGerman(lower));
    }

    [Fact]
    public void ADenominatorOfOneIsNotAFractionWord()
    {
        Assert.Equal("1/1", GermanNormalize.NormalizeGerman("1/1"));
        Assert.Equal("2/1", GermanNormalize.NormalizeGerman("2/1"));
        Assert.Equal(De("1 1"), De("1/1"));
        Assert.NotEqual("1/2", GermanNormalize.NormalizeGerman("1/2"));
    }

    [Theory]
    [InlineData("1 Mio. Euro", "eine Million Euro")]
    [InlineData("1 mio. Euro", "eine Million Euro")]
    [InlineData("1 Mrd. Menschen", "eine Milliarde Menschen")]
    [InlineData("das kostet 1 Mio.", "das kostet eine Million.")]
    [InlineData("2 Mio. Euro", "2 Millionen Euro")]
    [InlineData("11 Mio. Euro", "11 Millionen Euro")]
    [InlineData("1,1 Mio. Euro", "1,1 Millionen Euro")]
    public void OneMioIsSingularWithTheArticle(string input, string spelled) =>
        Assert.Equal(De(spelled), De(input));

    [Fact]
    public void ANonInitialChWithNoVowelBeforeItIsTheIchLaut()
    {
        var phs = GermanG2p.ToSegments("lchen").Select(s => s.Ph).ToList();
        Assert.DoesNotContain("x", phs);
        Assert.Contains("ç", phs);
        Assert.Contains("x", GermanG2p.ToSegments("lachen").Select(s => s.Ph));
    }
}
