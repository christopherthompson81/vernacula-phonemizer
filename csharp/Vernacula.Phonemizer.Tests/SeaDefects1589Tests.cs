// #1589: number and clock defects in vi/lo/my/jv/su/mad — the C# half of test/sea-defects-1589.test.ts.
// Every assertion is RELATIONAL (the defective input against a spelling the engine already reads right), so no
// IPA is typed. Synthetic probes.
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class SeaDefects1589Tests
{
    [Theory]
    // vi: a number of 10¹² or more keeps its scale word, composed on tỷ; below 10¹² unchanged.
    [InlineData("vi", "1000000000000", "một nghìn tỷ")]
    [InlineData("vi", "2500000000000", "hai nghìn năm trăm tỷ")]
    [InlineData("vi", "1000000005", "một tỷ không trăm linh năm")]
    // lo: a grouped number ending in a decimal in the other mark is one number.
    [InlineData("lo", "1,234.5", "1234.5")]
    [InlineData("lo", "1.234,5", "1234,5")]
    // my: a following hour word is consumed, :00 is the hour alone, an out-of-range time is refused.
    [InlineData("my", "၉:၃၀ နာရီ", "၉:၃၀")]
    [InlineData("my", "12:00", "12 နာရီ")]
    [InlineData("my", "8:46 နာရီတိတိ", "8:46 နာရီ တိတိ")]
    [InlineData("my", "123:45", "123 45")]
    // jv: a clock with minutes after jam has no pause; pada marks leave single spaces.
    [InlineData("jv", "jam 07.30", "jam 7 30")]
    [InlineData("jv", "jam 8:46 esuk", "jam 8 46 esuk")]
    [InlineData("jv", "ꦲꦏꦸ꧈ ꦲꦏꦸ꧉ ꦲꦏꦸ", "aku, aku. aku")]
    // su: a long decimal is one decimal; miliar and triliun are said.
    [InlineData("su", "3,14159", "3 koma 1 4 1 5 9")]
    [InlineData("su", "1000000000", "samiliar")]
    [InlineData("su", "1000000000000", "satriliun")]
    [InlineData("su", "2500000000", "dua miliar lima ratus yuta")]
    // mad: a clock with minutes, a long decimal, and no era after a currency amount.
    [InlineData("mad", "jam 7.30", "jam 7 30")]
    [InlineData("mad", "7.30 WIB", "7 30 WIB")]
    [InlineData("mad", "3.14159", "3 koma 1 4 1 5 9")]
    [InlineData("mad", "Rp 5 M", "Rp 5 m")]
    public void ReadsAsItsSpelledForm(string lang, string input, string spelled) =>
        Assert.Equal(Phonemizer.Phonemize(spelled, lang), Phonemizer.Phonemize(input, lang));

    [Fact]
    public void PadaMarksLeaveNoDoubleSpace() =>
        Assert.DoesNotContain("  ", Phonemizer.Phonemize("ꦲꦏꦸ꧈ ꦲꦏꦸ꧉ ꦲꦏꦸ", "jv"), StringComparison.Ordinal);

    [Fact]
    public void AYearStillTakesTheEraButMoneyDoesNot()
    {
        var era = Phonemizer.Phonemize("Masèhi", "mad").Trim();
        Assert.Contains(era, Phonemizer.Phonemize("940 M", "mad"), StringComparison.Ordinal);
        Assert.DoesNotContain(era, Phonemizer.Phonemize("Rp 5 M", "mad"), StringComparison.Ordinal);
    }
}
