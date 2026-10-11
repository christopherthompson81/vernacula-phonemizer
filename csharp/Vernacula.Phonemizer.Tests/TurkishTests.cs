/**
 * Turkish (tr) — the #1523 pins from test/turkish.test.ts (defects the Rust port found).
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Turkish;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class TurkishTests
{
    private static string Word(string s) => TurkishPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "tr");

    [Fact]
    public void ANumeralPastKatrilyonKeepsItsScaleWordAndEveryDigit()
    {
        Assert.Equal("bir sekstilyon", TurkishNumbers.DigitsToWords("1000000000000000000000"));
        Assert.Equal("iki sekstilyon beş kentilyon", TurkishNumbers.DigitsToWords("2005000000000000000000"));
        Assert.Equal("bir kentilyon", TurkishNumbers.NumberToWords(1e18));
        Assert.EndsWith("yedi yüz seksen dokuz bin on iki", TurkishNumbers.DigitsToWords("1234567890123456789012"));
        Assert.Equal(string.Join(" ", new[] { "bir" }.Concat(Enumerable.Repeat("sıfır", 36))),
            TurkishNumbers.DigitsToWords("1" + new string('0', 36)));
        Assert.Equal("bˈiɾ secstiljˈon", Say("1000000000000000000000"));
        Assert.EndsWith("dokˈuz bˈin ˈon icˈi", Say("1234567890123456789012"));
        Assert.Equal("bˈeʃ bˈiɾ centiljˈon biɾdˈen cyt͡ʃˈyctyɾ", Say("5 < 1000000000000000001"));
    }

    [Theory]
    [InlineData("kâr", "cˈaɾ")]
    [InlineData("kar", "kˈaɾ")]
    [InlineData("lâle", "lalˈe")]
    [InlineData("rüzgâr", "ɾyzɟˈaɾ")]
    public void CircumflexAfterKGLKeepsThePalatal(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    [InlineData("elma", "elmˈa")]
    [InlineData("masa", "masˈa")]
    [InlineData("olsa", "ˈoɫsa")]
    public void APlainNounEndingMaSaLaKeepsFinalStress(string word, string want) => Assert.Equal(want, Word(word));

    [Fact]
    public void AnUpperCaseApostropheSuffixReadsLikeTheLowerCaseOne()
    {
        Assert.Equal(Say("34'ü"), Say("34'Ü"));
        Assert.Equal(Say("1985'in"), Say("1985'İN"));
    }

    [Fact]
    public void AYearBeforeACapitalEndsTheSentence()
    {
        Assert.Equal("jˈɯɫ icˈi bˈin dˈøɾt . sonɾˈa ɟeldˈi .", Say("Yıl 2004. Sonra geldi."));
        Assert.Equal("biɾind͡ʒˈi dˈynja savaʃˈɯ", Say("1. Dünya Savaşı"));
    }

    [Fact]
    public void SoftGAfterAConsonantDoesNotLengthenIt() =>
        Assert.Equal("ɾa", string.Concat(G2p.ToSegments("rğa").Select(s => s.Ph)));
}
