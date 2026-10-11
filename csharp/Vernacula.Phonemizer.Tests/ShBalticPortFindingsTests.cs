/**
 * Serbian, Croatian, Bosnian, Slovenian, Lithuanian and Latvian defects the Rust port found (#1532), fixed
 * TS-first. Ported from test/sh-baltic-port-findings.test.ts; probe text is synthetic, and the expectations
 * are the TS engine's output.
 */
using Xunit;
using Sr = Vernacula.Phonemizer.Languages.Serbian.Normalize;
using Hr = Vernacula.Phonemizer.Languages.Croatian.Normalize;
using Bs = Vernacula.Phonemizer.Languages.Bosnian.Normalize;
using Sl = Vernacula.Phonemizer.Languages.Slovenian.Normalize;
using Lt = Vernacula.Phonemizer.Languages.Lithuanian.Normalize;
using Lv = Vernacula.Phonemizer.Languages.Latvian.Normalize;

namespace Vernacula.Phonemizer.Tests;

public class ShBalticPortFindingsTests
{
    [Fact]
    public void AnObjectPrototypeNameIsNotALicensor()
    {
        Assert.Equal("Bilo je 5. constructor i dalje.", Sr.NormalizeSerbian("Bilo je 5. constructor i dalje."));
        Assert.Equal("U 3. i 4. constructor.", Bs.NormalizeBosnian("U 3. i 4. constructor."));
        Assert.Equal("Bilo je 7. hasOwnProperty i 3. toString.", Hr.NormalizeCroatian("Bilo je 7. hasOwnProperty i 3. toString."));
        Assert.Equal("Viņš bija 3 constructor.", Lv.NormalizeLatvian("Viņš bija 3. constructor."));
    }

    [Fact]
    public void SerbianDottedAbbreviations()
    {
        Assert.Equal("Voće итᲁ., даље", Sr.NormalizeSerbian("Voće итᲁ., даље"));
        Assert.Equal("Voće i tako dalje, dalje", Sr.NormalizeSerbian("Voće itd., dalje"));
        Assert.Equal("Voće, povrće i tako dalje. Sutra idemo.", Sr.NormalizeSerbian("Voće, povrće itd. Sutra idemo."));
        Assert.Equal("Воће i tako dalje. Сутра.", Sr.NormalizeSerbian("Воће итд. Сутра."));
        Assert.Equal("Voće, povrće i tako dalje sutra idemo.", Sr.NormalizeSerbian("Voće, povrće itd. sutra idemo."));
        Assert.Contains(" . ", Phonemizer.Phonemize("Voće itd. Sutra idemo.", "sr"));
        Assert.DoesNotContain(" . ", Phonemizer.Phonemize("Voće itd. sutra idemo.", "sr"));
    }

    [Fact]
    public void AClockBeforeAFullStopOrACommaIsRead()
    {
        Assert.Equal("Sastanak u jedanaest sati.", Sr.NormalizeSerbian("Sastanak u 11:00."));
        Assert.Equal("Sastanak u jedanaest sati i trideset minuta, zatim ručak.", Sr.NormalizeSerbian("Sastanak u 11:30, zatim ručak."));
        Assert.Equal("Sastanak u jedanaest sati.", Hr.NormalizeCroatian("Sastanak u 11:00."));
        Assert.Equal("Sastanak u jedanaest sati.", Bs.NormalizeBosnian("Sastanak u 11:00."));
        Assert.Equal("u dvadeset dva sata i osam minuta.", Bs.NormalizeBosnian("u 22:08 sati."));
        Assert.Equal("u 11:30 zarez 5", Sr.NormalizeSerbian("u 11:30,5"));
        Assert.Equal("u 11:30 zarez 5", Hr.NormalizeCroatian("u 11:30,5"));
        Assert.Equal("u 11:30.5", Sr.NormalizeSerbian("u 11:30.5"));
    }

    [Fact]
    public void Croatian()
    {
        Assert.Equal("U prvom stoljeću.", Hr.NormalizeCroatian("U I. stoljeću."));
        Assert.Equal("U prvom svjetskom ratu.", Hr.NormalizeCroatian("U I. svjetskom ratu."));
        Assert.Equal("Vrijednost 2/1000.", Hr.NormalizeCroatian("Vrijednost 2/1000."));
        Assert.Equal("u sezoni dvije tisuće treće/dvije tisuće četvrte kada",
            Hr.NormalizeCroatian("u sezoni 2003./2004. kada"));
    }

    [Fact]
    public void SlovenianListDashIsNotAMinus()
    {
        Assert.Equal("Seznam: - 5 jabolk.", Sl.NormalizeSlovenian("Seznam: - 5 jabolk."));
        Assert.Equal("Temperatura je minus 5 stopinj.", Sl.NormalizeSlovenian("Temperatura je -5 stopinj."));
        Assert.Equal("(minus 5 stopinj)", Sl.NormalizeSlovenian("(-5 stopinj)"));
    }

    [Fact]
    public void Lithuanian()
    {
        Assert.Equal("Bokšto aukštis siekia penkiasdešimt metų.", Lt.NormalizeLithuanian("Bokšto aukštis siekia 50 m."));
        Assert.Equal("tūkstantis aštuoni šimtai du metais Vilniuje", Lt.NormalizeLithuanian("1802 m. Vilniuje"));
        Assert.EndsWith(" .", Phonemizer.Phonemize("Tai įvyko 1990 m.", "lt"));
        Assert.Equal("Jis bėgo penki kilometrai per valandą greičiu.", Lt.NormalizeLithuanian("Jis bėgo 5 km/h greičiu."));
        Assert.Equal("Jis bėgo dvidešimt vienas kilometras per valandą, o", Lt.NormalizeLithuanian("Jis bėgo 21 km / h, o"));
        Assert.Equal("Greitis du kablelis penki kilometrų per valandą", Lt.NormalizeLithuanian("Greitis 2,5 km/h"));
        Assert.Equal("Jis bėgo penki kilometrai per valandą.", Lt.NormalizeLithuanian("Jis bėgo 5 km/h."));
        Assert.Equal("Sausio penkios dieną dešimt valandų trisdešimt minučių.", Lt.NormalizeLithuanian("Sausio 5 d. 10:30 val."));
        Assert.Equal("dvidešimt viena valanda dvidešimt viena minutė.", Lt.NormalizeLithuanian("21:21 val."));
        Assert.Equal("dešimt valandų trisdešimt minučių Kitas", Lt.NormalizeLithuanian("10:30 val. Kitas"));
        Assert.Equal("Laimėjo 3–2.", Lt.NormalizeLithuanian("Laimėjo 3–2."));
        Assert.Equal("Laimėjo 1990 iki 1995 metais.", Lt.NormalizeLithuanian("Laimėjo 1990–1995 metais."));
    }

    [Fact]
    public void Latvian()
    {
        Assert.Equal("Pulksten 10 30 sākās.", Lv.NormalizeLatvian("Pulksten 10:30 sākās."));
        Assert.Equal("Sākās pulksten 7 0 5.", Lv.NormalizeLatvian("Sākās plkst. 7:05."));
        Assert.Equal("pulksten 12 pēc", Lv.NormalizeLatvian("plkst. 12:00 pēc"));
        Assert.Equal("no 6 30 līdz 7 30", Lv.NormalizeLatvian("no 06:30 - 07:30"));
        Assert.Equal("rezultāts 25:00 komandai", Lv.NormalizeLatvian("rezultāts 25:00 komandai"));
        Assert.Equal("ar laiku 3:12.45", Lv.NormalizeLatvian("ar laiku 3:12.45"));
        Assert.Equal("Rezultāts 5 3.", Lv.NormalizeLatvian("Rezultāts 5 - 3."));
        Assert.Equal("Rezultāts 7 2.", Lv.NormalizeLatvian("Rezultāts 7–2."));
        Assert.Equal("No 10 līdz 20 metriem.", Lv.NormalizeLatvian("No 10 - 20 metriem."));
        Assert.Equal("Pirms pieci komats viens līdz četri komats seši miljoniem.", Lv.NormalizeLatvian("Pirms 5,1–4,6 miljoniem."));
    }
}
