// The portable half of test/slovenian.test.ts — the branches the 200-row golden cannot reach, plus the six
// defects the port sent back to the TypeScript, NONE of which moves a golden row in either engine:
// the decimal's leading zeros (a 100× error), `\p{Lu}` being inert under /i in TWO capitalisation guards
// (the honorific and the regnal-names one), the era marker's /i eating a person's initials, the degree
// rule truncating a decimal count, and `slCountForm` routing 0 to the paucal.
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Slovenian;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class SlovenianTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "sl").Trim();
    private static string Norm(string s) => Normalize.NormalizeSlovenian(s);

    [Theory]
    // The Slovene rules: lj/nj coda-j-drop, syllabic r → ər, voicing/devoicing, ⟨v⟩ → ʋ, ⟨x⟩ → ks.
    [InlineData("polje", "pˈɔljɛ")]
    [InlineData("kralj", "kral")]
    [InlineData("konj", "kɔn")]
    [InlineData("prst", "pərst")]
    [InlineData("vrt", "ʋərt")]
    [InlineData("grad", "ɡrat")]
    [InlineData("glasba", "ɡlˈazba")]
    [InlineData("Afganistan", "aʋɡˈanistan")]
    [InlineData("Abhazija", "abxˈazija")]
    public void ReadsTheSloveneG2p(string input, string expected) => Assert.Equal(expected, Say(input));

    [Theory]
    // The Germanic-style unit-in-ten inversion, and the DUAL in the magnitude agreement.
    [InlineData("21", "ɛnaindʋˈajsɛt")]
    [InlineData("234", "dʋˈɛstɔ ʃtiriintrˈidɛsɛt")]
    [InlineData("1000", "tˈisɔt͡ʃ")]
    [InlineData("2000000", "dʋa milijˈɔna")]
    [InlineData("2000000000", "dʋɛ milijˈardi")]
    public void ReadsTheSloveneCardinals(string input, string expected) => Assert.Equal(expected, Say(input));

    [Fact]
    public void ADecimalsLeadingZerosSurviveTheComma()
    {
        // ⚠ A 100× ERROR: the fractional run becomes its own token and `Number("001")` is 1.
        Assert.Equal("0 vejica 0 0 1 grama", Norm("0,001 grama"));
        Assert.Equal("0 vejica 0 5 grama", Norm("0,05 grama"));
        Assert.Equal("1 vejica 50 kilometra", Norm("1,50 km")); // no leading zero: untouched
        Assert.NotEqual(Norm("1,5 km"), Norm("1,05 km"));       // …and two distinct numbers must differ
    }

    [Fact]
    public void TheCapitalisationGuardsAreRealAndNotIFolded()
    {
        // ⚠ `\p{Lu}` UNDER /i MATCHES A LOWERCASE LETTER. Both guards were therefore absent.
        Assert.Equal("Vzel ga. je", Norm("Vzel ga. je"));           // was *Vzel gospa je*
        Assert.Equal("gospa Kirchner je", Norm("Ga. Kirchner je")); // …and the real one still fires
        Assert.Equal("kralj je bil 12 let", Norm("kralj je bil 12 let"));         // was *dvanajsti let*
        Assert.Equal("papež je bil star 78 let", Norm("papež je bil star 78 let"));
        Assert.Equal("kraljica Elizabeta druga je", Norm("kraljica Elizabeta 2 je"));
    }

    [Fact]
    public void TheEraMarkerDoesNotEatAPersonsInitials()
    {
        Assert.Equal("leta 323 pred našim štetjem obnovili.", Norm("leta 323 pr. n. š. obnovili."));
        // ⚠ …and `N. Š.` is two initials, which step 20's dotted-capital-run rule owns (#1074's hr shape).
        Assert.Equal("ne še Kovač je prišel", Norm("N. Š. Kovač je prišel"));
    }

    [Fact]
    public void TheDegreeNounAgreesWithTheWholeValue()
    {
        // ⚠ The fifth slot exists for the genitive singular a decimal governs; truncating never reached it,
        // so one construction had three answers.
        Assert.Equal("1 vejica 5 stopinje Celzija", Norm("1,5 °C"));
        Assert.Equal("2 vejica 4 stopinje Celzija", Norm("2,4 °C"));
        Assert.Equal("1 stopinja Celzija", Norm("1 °C"));
        Assert.Equal("90 stopinj Fahrenheita", Norm("90 °F"));
    }

    [Fact]
    public void ZeroTakesTheGenitivePlural()
    {
        // `n <= 4` used to catch 0 in the PAUCAL slot — the form for 3–4.
        Assert.Equal(3, SlovenianPhonemizer.SlCountForm(0));
        Assert.Equal("0 odstotkov", Norm("0 %"));
        Assert.Equal("0 stopinj Celzija", Norm("0 °C"));
    }

    [Theory]
    // The licensed `N.` ordinal, the clock, and the invariant the whole file is measured by: an
    // utterance-final period after a year is a SENTENCE period and must survive.
    [InlineData("v 11., 12. in 13. stoletju", "v enajstem, dvanajstem in trinajstem stoletju")]
    [InlineData("Malo po 11. uri", "Malo po enajsti uri")]
    [InlineData("so ob 23.35 naposled", "so ob triindvajseti uri petintrideset naposled")]
    [InlineData("leta 2009.", "leta 2009.")]
    [InlineData("(0230 UTC)", "(druga ura trideset u te ce)")]
    public void ReadsTheOrdinalsAndTheClock(string input, string expected) => Assert.Equal(expected, Norm(input));
}
