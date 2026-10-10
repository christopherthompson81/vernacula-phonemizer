/**
 * Four Mandarin defects the Rust port found by reading (#1463), fixed TS-first.
 * Ported from test/mandarin-port-findings.test.ts (the fourth is a TypeScript type, with no C# twin).
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Languages.Mandarin;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class MandarinPortFindingsTests
{
    private static string Cmn(string s) => Phonemizer.Phonemize(s, "cmn");
    private static readonly Regex HAN = new(@"\p{IsCJKUnifiedIdeographs}|[\uD840-\uD87F][\uDC00-\uDFFF]");

    [Fact]
    public void HanWithNoReadingIsDropped()
    {
        Assert.Equal("jiɛ˨˩˦ t͡ɕiɑ˥˥", Cmn("𠮷野家"));
        Assert.Equal("", Cmn("𪛖"));
        // The cdo golden's case: a Min dialect character reached Mandarin through the script router.
        Assert.DoesNotMatch(HAN, Phonemizer.Phonemize("復加𡅏北韓", "cdo"));
    }

    [Fact]
    public void KangxiRadicalAndCompatibilityIdeographReadAsTheirNfkcFold()
    {
        Assert.Equal(Cmn("一"), Cmn("⼀"));
        Assert.Equal("ji˧˥ kɤ˥˩", Cmn("⼀个"));
        Assert.Equal(Cmn("豈".Normalize(System.Text.NormalizationForm.FormKC)), Cmn("豈"));
        Assert.NotEqual("", Cmn("豈"));
    }

    [Fact]
    public void IterationMarkRepeatsThePrecedingCharacter()
    {
        Assert.Equal(Cmn("人人"), Cmn("人々"));
        Assert.Equal("ʂʐ̩˧˥ ʂʐ̩˧˥ kʰɤ˥˩ kʰɤ˥˩", Cmn("時々刻々"));
        Assert.Equal("", Cmn("々"));
    }

    [Fact]
    public void UnparseablePinyinTokenIsDropped()
    {
        var py = MandarinPhonemizer.CreatePinyinPhonemizer();
        Assert.Equal("ni˨˩˦ xɑᵘ˨˩˦", py("ni3 xyz9 hao3"));
        Assert.Equal("ni˧˥ xɑᵘ˨˩˦", py("ni3 hao3"));
    }

    [Theory]
    [InlineData("1/2.5", "1/2.5")]
    [InlineData("3/4,5", "3/4,5")]
    [InlineData("1.5/2", "1.5/2")]
    [InlineData("3,4/5", "3,4/5")]
    [InlineData("1/2", "2分之1")]
    [InlineData("1/2.", "2分之1.")]
    [InlineData("1/2, 好", "2分之1, 好")]
    public void FractionGuardsAgreeOnBothSides(string input, string expected) =>
        Assert.Equal(expected, Normalize.NormalizeMandarin(input));

    [Theory]
    [InlineData("1/2.5", "ji˥˥ ər˥˩ tiɛn˧˥ wu˨˩˦")]
    [InlineData("mp3", "ˌɛmpˈiː san˥˥")]
    [InlineData("web3", "wˈɛb san˥˥")]
    [InlineData("a4 paper", "ˈə sɹ̩˥˩ pʰˈeᶦpɚ")]
    // real pinyin keeps the direct path
    [InlineData("ni3 hao3", "ni˧˥ xɑᵘ˨˩˦")]
    [InlineData("ni3 hao", "ni˨˩˦ xɑᵘ")]
    [InlineData("lv4", "ly˥˩")]
    [InlineData("a4", "ɑ˥˩")]
    public void Readings(string input, string expected) => Assert.Equal(expected, Cmn(input));

    [Fact]
    public void NonPinyinAlphanumericIsNotPassedThrough()
    {
        foreach (var t in new[] { "mp3", "ipv4", "web3", "a4 paper" })
            Assert.DoesNotMatch(new Regex("[a-z][0-9]"), Cmn(t));
    }
}
