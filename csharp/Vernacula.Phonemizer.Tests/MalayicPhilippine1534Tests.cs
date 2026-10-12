/**
 * #1534: id, ms, tl, ceb, hil and ilo defects the Rust port found. Ported from
 * test/malayic-philippine-1534.test.ts. Expectations are relational or structural — never typed IPA.
 */
using Xunit;
using Vernacula.Phonemizer.Languages.Hiligaynon;
using Vernacula.Phonemizer.Languages.Ilocano;
using Vernacula.Phonemizer.Languages.Tagalog;
using MalayNormalize = Vernacula.Phonemizer.Languages.Malay.Normalize;

namespace Vernacula.Phonemizer.Tests;

public class MalayicPhilippine1534Tests
{
    private static string Say(string s, string l) => Phonemizer.Phonemize(s, l);

    [Theory]
    [InlineData("1.000,5", "1000,5")]
    [InlineData("Rp 1.000,50", "Rp 1000,50")]
    [InlineData("1.000.000,25 orang", "1000000,25 orang")]
    [InlineData("1.000, dan", "1000, dan")]
    public void IdAGroupedAmountKeepsItsDecimalComma(string grouped, string plain) =>
        Assert.Equal(Say(plain, "id"), Say(grouped, "id"));

    [Fact]
    public void IdAnUnmarkedColonPairIsNotAClock()
    {
        Assert.Equal(Say("skor 21, 20", "id"), Say("skor 21:20", "id"));
        Assert.DoesNotContain("lewˈat", Say("skor 21:20", "id"));
    }

    [Theory]
    [InlineData("pukul 21:20")]
    [InlineData("Pukul 9:30")]
    [InlineData("jam 9:30 pagi")]
    [InlineData("21:20 WIB")]
    [InlineData("pukul 8.46")]
    [InlineData("8.46")]
    public void IdAMarkedColonClockAndEveryDotClockStillReadLewat(string t) => Assert.Contains("lewˈat", Say(t, "id"));

    [Fact]
    public void MsUsFoldsToTheBareSignAndAsKeepsItsCode()
    {
        Assert.Equal(Say("yuran $30", "ms"), Say("yuran US$30", "ms"));
        Assert.Equal(Say("yuran $30", "ms"), Say("yuran US $30", "ms"));
        Assert.Equal("yuran AS $30", MalayNormalize.NormalizeMalay("yuran AS$30"));
    }

    [Fact]
    public void MsARunWithTwoGroupingDotsIsNotADecimal()
    {
        Assert.Equal(Say("12345678 orang", "ms"), Say("12.345.678 orang", "ms"));
        Assert.Contains("pərpulˈuhan", Say("3.141", "ms"));
    }

    [Fact]
    public void TlAnOrdinalAbove2To53ReadsItsDigits()
    {
        Assert.Equal(400, Say("ika-" + new string('9', 400), "tl").Split(' ').Length);
        var a = Say("ika-12345678901234567891", "tl");
        Assert.NotEqual(Say("ika-12345678901234567899", "tl"), a);
        Assert.Equal(Say("12345678901234567891", "tl").Split(' ').Skip(1), a.Split(' ').Skip(1));
    }

    [Fact]
    public void TlTheCardinalHasScalesAboveMilyon()
    {
        Assert.Equal(TagalogPhonemizer.NumberWords(2) + "ng bilyon", TagalogPhonemizer.NumberWords(2e9));
        Assert.EndsWith(" trilyon", TagalogPhonemizer.NumberWords(3e12));
        Assert.DoesNotContain("milyon", TagalogPhonemizer.NumberWords(1e9));
        Assert.Contains("milyon", TagalogPhonemizer.NumberWords(999999999).Split(' '));
    }

    [Theory]
    [InlineData("ceb", "ka")]
    [InlineData("ilo", "a")]
    public void CebIloReadThreeFractionDigitsAsADecimal(string l, string ka) =>
        Assert.Equal(Say($"3 punto 1 4 1 {ka} metro", l), Say($"3.141 {ka} metro", l));

    [Theory]
    [InlineData("0.625", "0 punto 6 2 5")]
    [InlineData("3.1416", "3 punto 1 4 1 6")]
    [InlineData("1234.567", "1234 punto 5 6 7")]
    public void HilReadsAShapeNoThousandsGroupHasAsADecimal(string a, string b) => Assert.Equal(Say(b, "hil"), Say(a, "hil"));

    [Fact]
    public void HilStillRefusesTheAmbiguousShape() => Assert.DoesNotContain("pˈunto", Say("17.865 ka pumuluyo", "hil"));

    [Theory]
    [InlineData("12.30 pm", "12.30 sa hapon")]
    [InlineData("8.15 p.m. ug", "8.15 sa gabii ug")]
    [InlineData("8.15 P.M. ug", "8.15 sa gabii ug")]
    [InlineData("8.15 a.m. ug", "8.15 sa buntag ug")]
    [InlineData("alas 9:30 pm", "alas 9:30 sa gabii")]
    public void CebAMeridiemIsSaidAsThePartOfTheDay(string a, string b) => Assert.Equal(Say(b, "ceb"), Say(a, "ceb"));

    [Theory]
    [InlineData("queso", "keso")]
    [InlineData("quinse", "kinse")]
    [InlineData("Quezon", "Keson")]
    public void HilATrigraphVowelIsANucleus(string a, string b) =>
        Assert.Equal(HiligaynonPhonemizer.PhonemizeWord(b), HiligaynonPhonemizer.PhonemizeWord(a));

    [Theory]
    [InlineData("queso", "keso")]
    [InlineData("Quezon", "Keson")]
    public void IloATrigraphVowelIsANucleus(string a, string b) =>
        Assert.Equal(IlocanoPhonemizer.PhonemizeWordRules(b).IndexOf('ˈ'), IlocanoPhonemizer.PhonemizeWordRules(a).IndexOf('ˈ'));

    [Theory]
    [InlineData("45° N", "45 grado amianan")]
    [InlineData("45°S ken", "45 grado abagatan ken")]
    [InlineData("12° E", "12 grado daya")]
    [InlineData("12°W", "12 grado laud")]
    public void IloACompassLetterAfterTheDegreeSign(string a, string b) => Assert.Equal(Say(b, "ilo"), Say(a, "ilo"));
}
