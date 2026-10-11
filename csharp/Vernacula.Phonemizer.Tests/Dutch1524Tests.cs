/**
 * #1524: Dutch defects the Rust port found. Ported from test/dutch-1524.test.ts (item 4, the fraction guards, is in
 * FractionGuards1495Tests). Expectations are relational or structural — never typed IPA.
 */
using Xunit;
using Vernacula.Phonemizer.Languages.Dutch;
using DutchG2p = Vernacula.Phonemizer.Languages.Dutch.G2p;

namespace Vernacula.Phonemizer.Tests;

public class Dutch1524Tests
{
    private static string Nl(string s) => Phonemizer.Phonemize(s, "nl");

    [Theory]
    [InlineData("3.000,50 euro", "3000,50 euro")]
    [InlineData("1.000.000,25 euro", "1000000,25 euro")]
    [InlineData("1.000, dan", "1000, dan")]
    public void AGroupedAmountKeepsItsDecimal(string grouped, string plain) =>
        Assert.Equal(Nl(plain), Nl(grouped));

    [Theory]
    [InlineData("però", "pero")]
    [InlineData("lì", "li")]
    [InlineData("più", "piu")]
    public void AGraveVowelReadsAsItsBase(string grave, string plain) =>
        Assert.Equal(Nl(plain), Nl(grave));

    [Fact]
    public void AGraveVowelIsANucleus() => Assert.True(DutchG2p.ToSegments("però")[^1].Vowel);

    [Theory]
    [InlineData("beenhouwer")]
    [InlineData("geelzucht")]
    [InlineData("beurtman")]
    [InlineData("geilheid")]
    [InlineData("teelbal")]
    public void AnEDigraphSpellingIsNotAPrefix(string w)
    {
        var ipa = DutchPhonemizer.PhonemizeWord(w);
        Assert.StartsWith((w[0] == 'g' ? "ɣ" : w[..1]) + "ˈ", ipa);
        Assert.DoesNotContain("ə", ipa[..4]);
    }

    [Theory]
    [InlineData("beginnen")]
    [InlineData("gebruiken")]
    [InlineData("beëdigen")]
    [InlineData("beamen")]
    [InlineData("verkopen")]
    public void ARealPrefixStillShifts(string w) =>
        Assert.DoesNotContain("ˈ", DutchPhonemizer.PhonemizeWord(w)[..2]);
}
