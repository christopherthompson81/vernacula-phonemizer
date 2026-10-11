/**
 * #1533's ordinal findings for ca and ro, mirrored from test/catalan.test.ts and test/romanian.test.ts.
 * Every expected value is the TypeScript engine's own output.
 *
 * ca: the digit ordinal and the Roman ordinal used to be two compositors that disagreed on 21–99 (`21è` read
 * *vint i primer*, XXI *vint i unè*). ro: the ordinal of exactly 1000 was built on the singular *mie*.
 */
using Vernacula.Phonemizer;
using Xunit;
using CaNormalize = Vernacula.Phonemizer.Languages.Catalan.Normalize;
using CaRoman = Vernacula.Phonemizer.Languages.Catalan.RomanOrdinals;
using RoRoman = Vernacula.Phonemizer.Languages.Romanian.RomanOrdinals;

namespace Vernacula.Phonemizer.Tests;

public class CatalanRomanianOrdinalTests
{
    [Theory]
    [InlineData(21)] [InlineData(22)] [InlineData(23)] [InlineData(24)] [InlineData(25)] [InlineData(29)]
    [InlineData(31)] [InlineData(101)] [InlineData(104)] [InlineData(105)] [InlineData(109)] [InlineData(110)]
    [InlineData(121)] [InlineData(2024)]
    public void CatalanDigitAndRomanOrdinalsShareOneCompositor(int n) =>
        Assert.Equal(CaNormalize.OrdinalWords(n), CaRoman.CatalanOrdinal(n));

    [Theory]
    [InlineData(21, false, "vint i unè")]
    [InlineData(24, false, "vint i quatrè")]
    [InlineData(21, true, "vint i unena")]
    [InlineData(105, false, "cent cinquè")]
    [InlineData(109, false, "cent novè")]
    [InlineData(110, false, "cent desè")]
    public void CatalanCompoundOrdinalIsTheSuffixedCardinal(int n, bool fem, string want) =>
        Assert.Equal(want, CaNormalize.OrdinalWords(n, fem));

    [Fact]
    public void CatalanOneSentenceReadsOneOrdinal()
    {
        Assert.Equal("əɫ βˈin i unˈɛ əniβəɾsˈaɾi i əɫ βˈin i unˈɛ əniβəɾsˈaɾi .",
            Phonemizer.Phonemize("El 21è aniversari i el XXI aniversari.", "ca"));
        // …while a written r/n/t suffix names the irregular series.
        Assert.Equal("el vint i primer", CaNormalize.NormalizeCatalan("el 21r"));
        Assert.Equal("la vint i unena", CaNormalize.NormalizeCatalan("la 21a"));
    }

    [Theory]
    [InlineData(1000, "al miilea")]
    [InlineData(2000, "al două miilea")]
    public void RomanianFinalThousandTakesThePluralStem(int n, string want) =>
        Assert.Equal(want, RoRoman.RomanianOrdinal(n));
}
