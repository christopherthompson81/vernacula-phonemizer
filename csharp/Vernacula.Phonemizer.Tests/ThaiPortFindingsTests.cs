/**
 * Thai defects the Rust port found by reading (#1512), fixed TS-first.
 * Ported from test/thai-port-findings.test.ts.
 */
using Normalize = Vernacula.Phonemizer.Languages.Thai.Normalize;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class ThaiPortFindingsTests
{
    private static string Th(string s) => Phonemizer.Phonemize(s, "th");

    [Fact]
    public void UnitAfterADecimalIsStillExpanded()
    {
        Assert.Equal("ยาว 3 จุด ห้า กิโลเมตร", Normalize.NormalizeThai("ยาว 3.5 กม."));
        Assert.Equal("2 จุด ห้า กิโลกรัม", Normalize.NormalizeThai("2.5 กก."));
        Assert.Equal(Th("ยาว 3 จุด ห้า กิโลเมตร"), Th("ยาว 3.5 กม."));
        Assert.DoesNotContain(".", Th("ยาว 3.5 กม."));
        Assert.Equal("ยาว 3 กิโลเมตร", Normalize.NormalizeThai("ยาว 3 กม."));
    }

    [Fact]
    public void ClockHourNeverMatchesTheTailOfALongerNumber()
    {
        Assert.DoesNotContain("นาฬิกา", Normalize.NormalizeThai("123.45 น."));
        Assert.DoesNotContain("นาฬิกา", Normalize.NormalizeThai("2024 น."));
        Assert.Equal("9 นาฬิกา 30 นาที", Normalize.NormalizeThai("09.30 น."));
        Assert.Equal("เวลา 9 นาฬิกา", Normalize.NormalizeThai("เวลา 9 น."));
        Assert.Equal("22 นาฬิกา ถึง 23 นาฬิกา", Normalize.NormalizeThai("22.00-23.00 น."));
    }

    [Fact]
    public void FinalOneAfterAMagnitudeIsEt()
    {
        Assert.Equal(Th("หนึ่ง ร้อย เอ็ด"), Th("101"));
        Assert.Equal(Th("หนึ่ง พัน เอ็ด"), Th("1001"));
        Assert.Equal(Th("สอง ร้อย เอ็ด"), Th("201"));
        Assert.Equal(Th("หนึ่ง ร้อย สิบ เอ็ด"), Th("111"));
        Assert.Equal(Th("หนึ่ง"), Th("1"));
        Assert.Equal(Th("หนึ่ง ล้าน"), Th("1000000"));
        Assert.Equal(Th("สิบ"), Th("10"));
    }

    [Fact]
    public void BahtSignIsRead()
    {
        Assert.Equal(Th("ราคา 100 บาท"), Th("ราคา ฿100"));
        Assert.NotEqual(Th("ราคา 100"), Th("ราคา ฿100"));
    }

    [Fact]
    public void FahrenheitLeavesNoLatinLetter()
    {
        Assert.Equal("10 องศาฟาเรนไฮต์", Normalize.NormalizeThai("10°F"));
        Assert.Equal("10 องศาฟาเรนไฮต์", Normalize.NormalizeThai("10 °F"));
        Assert.Equal(Th("10 องศาฟาเรนไฮต์"), Th("10°F"));
        Assert.Equal("10 องศาเซลเซียส", Normalize.NormalizeThai("10°C"));
    }
}
