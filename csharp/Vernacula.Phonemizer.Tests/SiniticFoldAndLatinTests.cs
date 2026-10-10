/**
 * The Sinitic hosts adopt the shared Han fold + iteration marks (#1481), and cdo routes non-BUC Latin to the
 * English reader (#1478). Ported from test/sinitic-fold-and-latin.test.ts; the every-dict-key reachability
 * sweep is a data check and lives on the TS side only — its one orphan (wuu U+F995) is pinned here.
 */
using System.Text;
using Vernacula.Phonemizer.Languages.MinDong;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class SiniticFoldAndLatinTests
{
    public static readonly TheoryData<string> Sinitic = new() { "cmn", "yue", "wuu", "gan", "hsn", "hak", "nan", "cjy", "cdo" };
    private static readonly string KangxiMan = char.ConvertFromUtf32(0x2F08); // KANGXI RADICAL MAN → 人

    [Theory, MemberData(nameof(Sinitic))]
    public void KangxiRadicalReadsAsItsUnifiedIdeograph(string lang)
    {
        var unified = Phonemizer.Phonemize("人", lang);
        Assert.NotEqual("", unified);
        Assert.Equal(unified, Phonemizer.Phonemize(KangxiMan, lang));
        Assert.Equal(Phonemizer.Phonemize("一人", lang), Phonemizer.Phonemize("一" + KangxiMan, lang));
    }

    [Theory, MemberData(nameof(Sinitic))]
    public void CompatibilityIdeographReadsAsItsUnifiedTwin(string lang)
    {
        var found = 0;
        for (var cp = 0xF900; cp <= 0xFAFF && found < 3; cp++)
        {
            var c = char.ConvertFromUtf32(cp);
            var u = c.Normalize(NormalizationForm.FormKC);
            if (u == c || !Core.JsRegex.Compile("^\\p{Script=Han}$", "u").IsMatch(u)) continue;
            var reading = Phonemizer.Phonemize(u, lang);
            if (reading == "") continue;
            Assert.Equal(reading, Phonemizer.Phonemize(c, lang));
            found++;
        }
        Assert.Equal(3, found);
    }

    [Theory, MemberData(nameof(Sinitic))]
    public void IterationMarksRepeatTheHanCharacterBefore(string lang)
    {
        var doubled = Phonemizer.Phonemize("人人", lang);
        Assert.Equal(doubled, Phonemizer.Phonemize("人々", lang));
        Assert.Equal(doubled, Phonemizer.Phonemize("人〻", lang));
        Assert.Equal(doubled, Phonemizer.Phonemize(KangxiMan + "々", lang));
    }

    [Fact]
    public void CoreIterationRewrite()
    {
        Assert.Equal("佐佐木 時時", Core.Unicode.RepeatHanIterationMarks("佐々木 時〻"));
        Assert.Equal("々", Core.Unicode.RepeatHanIterationMarks("々"));
    }

    [Fact]
    public void UntracedKeyFoldIsTheSameFold()
    {
        for (var cp = 0x2E80; cp <= 0x2FA1F; cp++)
        {
            if (cp >= 0xD800 && cp <= 0xDFFF) continue;
            var c = char.ConvertFromUtf32(cp);
            Assert.Equal(Core.Unicode.FoldHanCompatibility(c), Core.Unicode.FoldHanCompatibilityKey(c));
        }
    }

    [Fact]
    public void WuCompatibilityKeyIsNotOrphanedByTheFold()
    {
        Assert.NotEqual("", Phonemizer.Phonemize(char.ConvertFromUtf32(0xF995), "wuu"));
    }

    private static string En(string s) => Phonemizer.Phonemize(s, "en");
    private static string Cdo(string s) => Phonemizer.Phonemize(s, "cdo");

    [Fact]
    public void CdoRoutesNonBucLatinToEnglish()
    {
        Assert.Equal(En("IUPAC"), Cdo("（IUPAC）"));
        Assert.Equal($"{En("Harry")} {En("Potter")}", Cdo("Harry Potter"));
        Assert.Equal(En("Québec"), Cdo("Québec"));
        Assert.False(MinDongPhonemizer.LatinParts("Québec".Normalize(NormalizationForm.FormD))[0].Native);
    }

    [Fact]
    public void CdoKeepsBucOnTheConverter()
    {
        Assert.True(MinDongPhonemizer.LatinParts("Hók-ciŭ".Normalize(NormalizationForm.FormD)) is [{ Native: true }]);
        Assert.True(MinDongPhonemizer.LatinParts("gah") is [{ Native: true }]);
        Assert.True(MinDongPhonemizer.LatinParts("bĭh".Normalize(NormalizationForm.FormD))[0].Native);
    }

    [Fact]
    public void CdoMixedRunKeepsBothHalves()
    {
        Assert.Equal(new[] { false, true },
            MinDongPhonemizer.LatinParts("Kazakh-cŭk".Normalize(NormalizationForm.FormD)).Select(p => p.Native));
        Assert.Equal(new[] { false }, MinDongPhonemizer.LatinParts("Il-sung").Select(p => p.Native));
    }

    [Theory, InlineData("cmn"), InlineData("yue"), InlineData("wuu"), InlineData("gan"), InlineData("hsn"),
     InlineData("hak"), InlineData("nan"), InlineData("cjy")]
    public void OtherSiniticHostsRouteLatinToEnglish(string lang) =>
        Assert.Equal(En("Washington"), Phonemizer.Phonemize("Washington", lang));
}
