/**
 * Mandarin defects the Rust port found by reading (#1463), fixed TS-first, plus the review round on them.
 * Ported from test/mandarin-port-findings.test.ts (the manifest-type test has no C# twin; the chars.tsv audit is
 * a data check and lives on the TS side only).
 */
using System.Text;
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
        Assert.Equal(Cmn("豈".Normalize(NormalizationForm.FormKC)), Cmn("豈"));
        Assert.NotEqual("", Cmn("豈"));
    }

    [Fact]
    public void FoldHanCompatibilityFoldsEveryNfkcChangedHanCodePoint()
    {
        var folded = 0;
        for (var cp = 0; cp <= 0x3FFFF; cp++)
        {
            if (cp >= 0xD800 && cp <= 0xDFFF) continue;
            var c = char.ConvertFromUtf32(cp);
            if (!Core.JsRegex.Compile("^\\p{Script=Han}$", "u").IsMatch(c)) continue;
            var f = c.Normalize(NormalizationForm.FormKC);
            Assert.Equal(f, Core.Unicode.FoldHanCompatibility(c));
            if (f != c) folded++;
        }
        Assert.Equal(1221, folded);
        Assert.Equal("a一b十", Core.Unicode.FoldHanCompatibility("a⼀b〸"));
    }

    [Fact]
    public void IterationMarksRepeatThePrecedingCharacter()
    {
        Assert.Equal(Cmn("人人"), Cmn("人々"));
        Assert.Equal(Cmn("人人"), Cmn("人〻"));
        Assert.Equal("ʂʐ̩˧˥ ʂʐ̩˧˥ kʰɤ˥˩ kʰɤ˥˩", Cmn("時々刻々"));
        Assert.Equal(Cmn("一一"), Cmn("⼀々"));
        Assert.Equal("", Cmn("々"));
        Assert.Equal("人人", Normalize.NormalizeMandarin("人々"));
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
    [InlineData("1.5/2", "1.5/2")]
    [InlineData("1/1,000,000", "1/1,000,000")]
    [InlineData("5,000/10,000", "5,000/10,000")]
    [InlineData("1/2,3/4", "2分之1,4分之3")]
    [InlineData("3/4,5", "4分之3,5")]
    [InlineData("3,4/5", "3,5分之4")]
    [InlineData("好,1/2", "好,2分之1")]
    [InlineData("1/2", "2分之1")]
    [InlineData("1/2.", "2分之1.")]
    [InlineData("1/2, 好", "2分之1, 好")]
    public void FractionGuardsAreMirrors(string input, string expected) =>
        Assert.Equal(expected, Normalize.NormalizeMandarin(input));

    [Theory]
    [InlineData("1/2,3/4", "ər˥˩ fən˥˥ ʈ͡ʂʐ̩˥˥ ji˥˥ , sɹ̩˥˩ fən˥˥ ʈ͡ʂʐ̩˥˥ san˥˥")]
    [InlineData("1/2.5", "ji˥˥ ər˥˩ tiɛn˧˥ wu˨˩˦")]
    [InlineData("mp3", "ˌɛmpˈiː san˥˥")]
    [InlineData("web3", "wˈɛb san˥˥")]
    [InlineData("a4 paper", "ˈə sɹ̩˥˩ pʰˈeᶦpɚ")]
    [InlineData("ni3 hao3 xyz", "nˈiː san˥˥ hˈaᶷ san˥˥ zˈaᶦz")] // one stray token declines the whole text
    [InlineData("yi1 dian3 r5", "ji˥˥ tiɛnr˨˩˦")] // erhua: the rhotic suffix of the syllable before it
    [InlineData("yi1 dian3 r", "ji˥˥ tiɛnr˨˩˦")]
    [InlineData("dian3 r5 hao3", "tiɛnr˧˥ xɑᵘ˨˩˦")] // 3-3 sandhi across the suffix
    [InlineData("r5", "ər")]
    [InlineData("ni3 hao3", "ni˧˥ xɑᵘ˨˩˦")]
    [InlineData("ni3 hao", "ni˨˩˦ xɑᵘ")]
    [InlineData("lv4", "ly˥˩")]
    [InlineData("er2", "ər˧˥")]
    [InlineData("a4", "ɑ˥˩")]
    public void Readings(string input, string expected) => Assert.Equal(expected, Cmn(input));

    [Fact]
    public void NonPinyinAlphanumericIsNotPassedThrough()
    {
        foreach (var t in new[] { "mp3", "ipv4", "web3", "a4 paper" })
            Assert.DoesNotMatch(new Regex("[a-z][0-9]"), Cmn(t));
    }
}
