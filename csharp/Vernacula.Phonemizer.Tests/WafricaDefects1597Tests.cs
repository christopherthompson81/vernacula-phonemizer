// #1597: the ha/wo/ig/ak defects the Rust port of the West African group found. Relational throughout, so no IPA
// is typed; all inputs are synthetic. Mirrors test/wafrica-defects-1597.test.ts.
using System.Linq;
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class WafricaDefects1597Tests
{
    private static int Count(string output, string token) => output.Split(' ').Count(t => t == token);

    [Fact]
    public void HausaSentenceEndingInAnAcronymKeepsItsBreak()
    {
        var acronym = Phonemizer.Phonemize("Ya je BBC. Bello ya zo.", "ha");
        var word = Phonemizer.Phonemize("Ya je Kano. Bello ya zo.", "ha");
        Assert.Equal(Count(word, "."), Count(acronym, "."));
        Assert.Equal(2, Count(acronym, "."));
    }

    [Theory]
    [InlineData("Ya je M. Bello ya zo.")]
    [InlineData("Ya je M. Ɗanjuma ya zo.")]
    public void HausaInitialBeforeANameStillLosesItsDot(string text) =>
        Assert.Equal(1, Count(Phonemizer.Phonemize(text, "ha"), "."));

    [Theory]
    [InlineData("12° ak 16° (fukk ak juróom benn aj)", 2)]
    [InlineData("tàng 30° la, waaye aj du", 2)]
    [InlineData("60° (60 aj)", 1)]
    [InlineData("0° (tus aj)", 1)]
    public void WolofDegreeWindowStopsAtTheNextSignOrClauseMark(string text, int want)
    {
        var aj = Phonemizer.Phonemize("aj", "wo").Trim();
        Assert.Equal(want, Count(Phonemizer.Phonemize(text, "wo"), aj));
    }

    [Theory]
    [InlineData("ig", "4x100", "4×100")]
    [InlineData("ig", "4 x 100", "4 × 100")]
    [InlineData("ig", "4X100", "4×100")]
    [InlineData("ig", "4x100m", "4×100m")]
    [InlineData("ak", "4x100", "4×100")]
    [InlineData("ak", "4 x 100", "4 × 100")]
    [InlineData("ak", "4X100", "4×100")]
    [InlineData("ak", "4x100m", "4×100m")]
    public void DigitFlankedXReadsAsTimes(string lang, string ascii, string times) =>
        Assert.Equal(Phonemizer.Phonemize(times, lang), Phonemizer.Phonemize(ascii, lang));

    [Theory]
    [InlineData("ig")]
    [InlineData("ak")]
    public void AnXNotBetweenDigitsIsUntouched(string lang) =>
        Assert.NotEqual(Phonemizer.Phonemize("× 100", lang), Phonemizer.Phonemize("x 100", lang));
}
