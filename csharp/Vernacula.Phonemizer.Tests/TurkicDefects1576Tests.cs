/**
 * #1576 — the az/kk/ky/uz/tk/tt defects the Rust port of the Turkic group found. Every input is a SYNTHETIC
 * probe; relations are used where they can be, and the literal pins are the engine's own output after the fix.
 * Ported from test/turkic-defects-1576.test.ts.
 */
using Xunit;
using Az = Vernacula.Phonemizer.Languages.Azerbaijani;
using Kk = Vernacula.Phonemizer.Languages.Kazakh;
using Ky = Vernacula.Phonemizer.Languages.Kyrgyz;
using Tk = Vernacula.Phonemizer.Languages.Turkmen;
using Tt = Vernacula.Phonemizer.Languages.Tatar;
using Uz = Vernacula.Phonemizer.Languages.Uzbek;

namespace Vernacula.Phonemizer.Tests;

public class TurkicDefects1576Tests
{
    private static string Say(string lang, string s) => Phonemizer.Phonemize(s, lang).Trim();
    private static string Spaced(string digits) => string.Join(" ", digits.ToCharArray());
    private const string BIG = "12345678901234567890"; // past 2⁵³

    [Fact]
    public void Azerbaijani()
    {
        Assert.Equal(Say("az", Spaced(BIG) + " nəfər"), Say("az", BIG + " nəfər"));
        Assert.Equal(Say("az", Spaced("1000000000000000000000")), Say("az", "1000000000000000000000"));
        Assert.Equal(Say("az", "1234,5 manat"), Say("az", "1.234,5 manat"));
        Assert.Contains("bizˈim", Say("az", "BE 1000 il"));
        Assert.DoesNotContain("bizˈim", Say("az", "be 5 il"));
        Assert.DoesNotContain("bizˈim", Say("az", "Be 2010"));
        foreach (var w in new[] { "əsr", "əsrdə", "əsrin", "əsrlər", "sinifdə" })
            Assert.True(Az.RomanOrdinals.ROMAN_POLICY.OrdinalAfter!.IsMatch(w), w);
        Assert.False(Az.RomanOrdinals.ROMAN_POLICY.OrdinalAfter!.IsMatch("əsrarəngiz"));
        Assert.Equal(Say("az", "20 əsrarəngiz"), Say("az", "XX əsrarəngiz"));
    }

    [Fact]
    public void Kazakh()
    {
        var n = Kk.Manifest.MANIFEST.Numbers;
        Assert.Equal(n.Milliard, Say("kk", "1000000000"));
        Assert.Equal(n.Trillion, Say("kk", "1000000000000"));
        Assert.Equal($"{Say("kk", "3")} {n.Milliard}", Say("kk", "3000000000"));
        Assert.Equal(Say("kk", Spaced(BIG)), Say("kk", BIG));
        Assert.Equal(Say("kk", "1977, 1981 жылдары"), Say("kk", "1977-1981 жылдары"));
        Assert.Equal(Say("kk", "137, 151."), Say("kk", "137–151."));
        Assert.Equal(Say("kk", "5 километрге"), Say("kk", "5 км-ге"));
        Assert.Equal(Say("kk", "20 пайызға"), Say("kk", "20%-ға"));
        Assert.Equal(Say("kk", "3 метрден"), Say("kk", "3 м-ден"));
        Assert.Equal("бір мыңыншы жыл", Kk.Normalize.NormalizeKazakh("1000-шы жыл"));
        Assert.Equal("үш мыңыншы жыл", Kk.Normalize.NormalizeKazakh("3000-шы жыл"));
    }

    [Fact]
    public void Kyrgyz()
    {
        Assert.Equal("kitepˈter", Say("ky", "китептер"));
        Assert.Equal("ˈsport", Say("ky", "спорт"));
        Assert.Equal("ˈtoː", Say("ky", "тоо"));
        Assert.Equal("бир триллион", Ky.Numbers.NumberWords(1e12));
        Assert.Equal("эки миң триллион", Ky.Numbers.NumberWords(2e15));
        Assert.Equal(Say("ky", "2,5 версия"), Say("ky", "2.5 версия"));
        Assert.DoesNotContain("byˈtyn", Say("ky", "12.00дө"));
        Assert.Equal(Say("ky", "а б барабар жана в"), Say("ky", "а = б жана в"));
        Assert.Equal(Say("ky", "1 теңге 100 тыйынга барабар"), Say("ky", "1 теңге = 100 тыйынга"));
    }

    [Fact]
    public void Uzbek()
    {
        Assert.Equal("bir trillion", Uz.Numbers.NumberToWords(1e12));
        Assert.Equal("uch trillion besh", Uz.Numbers.NumberToWords(3e12 + 5));
        Assert.Equal("", Uz.Numbers.NumberToWords(Core.Js.Number(BIG)));
        Assert.Contains(BIG, Uz.Normalize.NormalizeUzbek(BIG + "-regbi"));
        Assert.Equal("yuz toʻqsoninchi", Uz.Numbers.OrdinalWords(190));
    }

    [Fact]
    public void Turkmen()
    {
        Assert.Equal("kitɑpˈlɑɾ", Say("tk", "kitaplar"));
        Assert.Equal("ilkinˈd͡ʒi", Say("tk", "ilkinji"));
        Assert.Equal("ˈpljuθ", Say("tk", "plýus"));
        Assert.DoesNotContain("miˈnuθ", Say("tk", "Ilkinji ýyl – 1995."));
        Assert.Equal(Say("tk", "-5 gradus"), Say("tk", "–5 gradus"));
        Assert.Empty(Tk.Numbers.NumberToWords(double.NaN));
        Assert.Empty(Tk.Numbers.NumberToWords(-5));
        Assert.Empty(Tk.Numbers.NumberToWords(2.5));
    }

    [Fact]
    public void Tatar()
    {
        Assert.Equal("mæsʔæˈlæ", Say("tt", "мәсъәлә"));
        Assert.Equal("mæʁˈnæ", Say("tt", "мәгънә"));
        Assert.Equal("mæqaˈlæ", Say("tt", "мәкъалә"));
        Assert.Equal("ˈsjezd", Say("tt", "съезд"));
        Assert.Equal("jøzjelˈlɨq", Say("tt", "йөзъеллык"));
        Assert.Equal("kitapˈlar", Say("tt", "китаплар"));
        Assert.Equal("ˈsport", Say("tt", "спорт"));
        Assert.Equal(new[] { "бер", "триллион" }, Tt.Numbers.NumberToWords(1e12));
    }
}
