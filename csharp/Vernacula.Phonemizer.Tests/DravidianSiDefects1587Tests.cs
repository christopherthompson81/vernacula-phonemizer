/**
 * #1587 — the te/ta/si/kn defects the Rust port of the Dravidian group found. Every input is a SYNTHETIC probe, and
 * every assertion is a relation, so no IPA is typed. Ported from test/dravidian-si-defects-1587.test.ts.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class DravidianSiDefects1587Tests
{
    private static string Say(string lang, string s) => Phonemizer.Phonemize(s, lang).Trim();
    private static string[] Words(string s) => s.Split(' ', StringSplitOptions.RemoveEmptyEntries);
    private static string SpelledSi(string digits) =>
        string.Join(" ", digits.Select(d => Say("si", d.ToString())));

    [Theory]
    [InlineData("$1500", "$2500")]
    [InlineData("US$1500", "US$2500")]
    [InlineData("1500 $", "2500 $")]
    [InlineData("1500%", "2500%")]
    public void TeluguSignWordSurvivesInTheYearBand(string band, string outside) =>
        Assert.Equal(Words(Say("te", outside))[^1], Words(Say("te", band))[^1]);

    [Fact]
    public void TeluguAmountIsACardinalAndABareNumeralIsStillAYear()
    {
        Assert.NotEqual(Say("te", "1500"), string.Join(" ", Words(Say("te", "$1500"))[..^1]));
        Assert.NotEqual(Say("te", "$1976"), Say("te", "1976"));
    }

    [Theory]
    [InlineData("12345678901234567891")]
    [InlineData("1234567890123456789012")]
    public void TamilUnsafeOrdinalReadsTheWrittenDigits(string digits) =>
        Assert.StartsWith(Say("ta", digits), Say("ta", digits + "ஆம்"));

    [Fact]
    public void TamilSafeOrdinalStillFuses() =>
        Assert.False(Say("ta", "15ஆம்").StartsWith(Say("ta", "15"), StringComparison.Ordinal));

    [Fact]
    public void SinhalaUnsafeIntegerIsReadDigitByDigit()
    {
        Assert.NotEqual(Say("si", "9007199254740992"), Say("si", "9007199254740993"));
        Assert.Equal(SpelledSi("100000000000000000000000"), Say("si", "100000000000000000000000"));
        Assert.NotEqual(SpelledSi("9007199254740991"), Say("si", "9007199254740991"));
    }

    [Fact]
    public void KannadaDottedUnitAndBareFraction()
    {
        Assert.Equal(Say("kn", "10 ಕಿಲೋಮೀಟರ್ ದೂರ"), Say("kn", "10 ಕಿ.ಮೀ. ದೂರ"));
        Assert.Equal(Say("kn", "ದೂರ 10 ಕಿಲೋಮೀಟರ್."), Say("kn", "ದೂರ 10 ಕಿ.ಮೀ."));
        Assert.Equal(Say("kn", "10 ಕಿಲೋಮೀಟರ್. ದೂರ"), Say("kn", "10 ಕಿಮೀ. ದೂರ"));
        Assert.Equal(Say("kn", "ಅರ್ಧ ಭಾಗ"), Say("kn", "½ ಭಾಗ"));
        Assert.Equal(Say("kn", "ಕಾಲು ಭಾಗ"), Say("kn", "¼ ಭಾಗ"));
        Assert.Equal(Say("kn", "ಮುಕ್ಕಾಲು ಭಾಗ"), Say("kn", "¾ ಭಾಗ"));
    }
}
