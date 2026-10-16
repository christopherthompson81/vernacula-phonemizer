/**
 * #1581 — the ba/crh/kaa/nog/chv/tg defects the Rust port of the turkic2 group found. Every input is a SYNTHETIC
 * probe, and every assertion is a relation to a form the engine already reads right, so no IPA is typed.
 * Ported from test/turkic2-defects-1581.test.ts.
 */
using Vernacula.Phonemizer.Core;
using Xunit;
using Ba = Vernacula.Phonemizer.Languages.Bashkir;
using Chv = Vernacula.Phonemizer.Languages.Chuvash;
using Kaa = Vernacula.Phonemizer.Languages.Karakalpak;
using Nog = Vernacula.Phonemizer.Languages.Nogai;
using Tg = Vernacula.Phonemizer.Languages.Tajik;

namespace Vernacula.Phonemizer.Tests;

public class TurkicDefects1581Tests
{
    private static string Say(string lang, string s) => Phonemizer.Phonemize(s, lang).Trim();

    [Fact]
    public void Tajik()
    {
        Assert.Equal("ҳазор триллион", Tg.TajikPhonemizer.NumberWords(1e15));
        Assert.Equal(Say("tg", "ҳазор триллион"), Say("tg", "1000000000000000"));
        Assert.NotEqual(Say("tg", "1000000000000"), Say("tg", "1000000000000000"));
        const string run = "9007199254740993";
        Assert.Equal(run.Length, Tg.TajikPhonemizer.DigitWords(run).Split(' ').Length);
        Assert.Equal(Say("tg", string.Join(" ", run.ToCharArray())), Say("tg", run));
    }

    [Fact]
    public void TrillionInBashkirAndKarakalpak()
    {
        Assert.Equal(Say("ba", "бер триллион"), Say("ba", "1000000000000"));
        Assert.Equal(Say("kaa", "bir trillion"), Say("kaa", "1000000000000"));
    }

    [Fact]
    public void SpaceGroupsJoinWholeRuns()
    {
        Assert.Equal("1000000", SeparatorHygienePass.JoinSpaceGroups("1 000 000"));
        Assert.Equal("5781203 и", SeparatorHygienePass.JoinSpaceGroups("5 781 203 и"));
        Assert.Equal("0 000 000", SeparatorHygienePass.JoinSpaceGroups("0 000 000"));
        Assert.Equal("0 000 000", SeparatorHygienePass.SeparatorHygiene("0 000 000"));
        Assert.Equal("0 000", SeparatorHygienePass.JoinSpaceGroups("0 000"));
        Assert.Equal("21 2001", SeparatorHygienePass.JoinSpaceGroups("21 2001"));
        Assert.Equal("3,0000", SeparatorHygienePass.JoinSpaceGroups("3,0 000"));
    }

    [Fact]
    public void Bashkir()
    {
        Assert.Equal(Say("ba", "1990-1995"), Say("ba", "1990 -1995"));
        Assert.Equal(Say("ba", "минус 5"), Say("ba", "-5"));
        Assert.Equal(Say("ba", "5 граммға"), Say("ba", "5 г-ға"));
        Assert.StartsWith("ˈ", Ba.BashkirPhonemizer.PhonemizeWordNative("спорт"));
        var kitaplar = Ba.BashkirPhonemizer.PhonemizeWordNative("китаплар");
        Assert.Equal(kitaplar.LastIndexOf('ɑ') - 2, kitaplar.IndexOf('ˈ'));
    }

    [Fact]
    public void Nogai()
    {
        var w = Nog.NogaiPhonemizer.PhonemizeWord("китаплар");
        Assert.Equal(w.IndexOf('l') - 1, w.IndexOf('ˈ'));
        Assert.StartsWith("ˈ", Nog.NogaiPhonemizer.PhonemizeWord("спорт"));
    }

    [Fact]
    public void CrimeanTatar()
    {
        Assert.Equal(Say("crh", "50 faiz ve"), Say("crh", "50% ve"));
        Assert.Equal(Say("crh", "0,7 faizine"), Say("crh", "0,7%-ine"));
        Assert.Equal(Say("crh", "fiyatı 5 lira"), Say("crh", "fiyatı - 5 lira"));
        Assert.Equal(Say("crh", "minus 6 °C"), Say("crh", "-6 °C"));
    }

    [Fact]
    public void Karakalpak()
    {
        Assert.StartsWith("ˈ", Kaa.KarakalpakPhonemizer.PhonemizeWord("tåw"));
        Assert.Equal(Say("kaa", "24 00"), Say("kaa", "24:00"));
        Assert.NotEqual(Say("kaa", "24 30"), Say("kaa", "24:30"));
    }

    [Fact]
    public void Chuvash()
    {
        Assert.Equal(Chv.Normalize.NormalizeChuvash("15-мӗшӗсенче"), Chv.Normalize.NormalizeChuvash("15-мĕшĕсенче"));
        Assert.Equal(Chv.Normalize.NormalizeChuvash("11-15-мӗшӗсенче"), Chv.Normalize.NormalizeChuvash("11-15-мĕшĕсенче"));
        Assert.DoesNotContain("15", Chv.Normalize.NormalizeChuvash("15-мĕшĕсенче"));
        Assert.Equal("24:30", Chv.Normalize.NormalizeChuvash("24:30"));
        Assert.Equal(Say("chv", "24"), Say("chv", "24:00"));
    }
}
