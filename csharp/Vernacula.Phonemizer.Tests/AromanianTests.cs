// The portable half of test/aromanian.test.ts — the g2p branches, the numeral composer, and the
// normalization defects the 200-row golden cannot reach on its own. Canonical-IPA goldens for Aromanian
// (rup) — armãneashti, an Eastern (Balkan) Romance sibling of Romanian, the Cunia Latin orthography.
// Signatures: the Aromanian DIGRAPHS ⟨ts⟩→[t͡s], ⟨dz⟩→[d͡z], ⟨sh⟩→[ʃ], ⟨nj⟩→[ɲ], ⟨lj⟩→[ʎ], ⟨dh⟩→[ð],
// ⟨th⟩→[θ]; ⟨ã⟩→[ə]; the shared Romance c/g softening + rising diphthongs ⟨ea⟩→[e̯a], ⟨oa⟩→[o̯a] + the
// word-final ⟨-u⟩ desyllabification.
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Aromanian;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class AromanianTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "rup").Trim();
    private static string Norm(string s) => Normalize.NormalizeAromanian(s);

    [Theory]
    // The Aromanian digraphs ⟨ts dz sh nj lj th dh⟩.
    [InlineData("tsintsi", "t͡sint͡si")]
    [InlineData("dzatsi", "d͡zat͡si")]
    [InlineData("njic", "ɲik")]
    [InlineData("oclju", "okʎu")]
    [InlineData("cathi", "kaθi")]
    [InlineData("dhoarã", "ðo̯arə")]
    public void ReadsTheAromanianDigraphs(string input, string expected) =>
        Assert.Equal(expected, AromanianPhonemizer.PhonemizeWord(input));

    [Theory]
    // ⟨ã⟩→[ə], the rising diphthongs ⟨ea oa⟩, and the endonym.
    [InlineData("armãneashti", "arməne̯aʃti")]
    [InlineData("noaptea", "no̯apte̯a")]
    [InlineData("limba", "limba")]
    public void ReadsTheVowelsAndTheEndonym(string input, string expected) =>
        Assert.Equal(expected, AromanianPhonemizer.PhonemizeWord(input));

    [Theory]
    // Romance c/g softening + the word-final ⟨-u⟩ desyllabification.
    [InlineData("Crãciun", "krət͡ʃun")]
    [InlineData("ghine", "ɡine")]
    [InlineData("cãntãtor", "kəntətor")]
    [InlineData("acatsu", "akat͡s")]
    [InlineData("amintu", "amintu")]
    public void SoftensCgAndDesyllabifiesFinalU(string input, string expected) =>
        Assert.Equal(expected, AromanianPhonemizer.PhonemizeWord(input));

    [Theory]
    // ⟨y⟩→[ɣ] (Greek gamma), and ⟨ndz⟩→[ndʒ] (the soft-g reflex).
    [InlineData("anyedz", "anɣed͡z")]
    [InlineData("sãndze", "sənd͡ʒe")]
    [InlineData("dzinire", "d͡zinire")]
    public void ReadsGreekGammaAndTheNdzReflex(string input, string expected) =>
        Assert.Equal(expected, AromanianPhonemizer.PhonemizeWord(input));

    [Theory]
    // Units, the fused ⟨-sprã-⟩ series, the ⟨shi⟩ connector, hundreds, thousands, millions.
    [InlineData(7, "shapti")]
    [InlineData(16, "shasprãdzatsi")]
    [InlineData(20, "yinghits")]
    [InlineData(21, "unsprãyinghits")]
    [InlineData(31, "treidzãts shi unu")]
    [InlineData(100, "unã sutã")]
    [InlineData(555, "tsintsi suti tsindzãts shi tsintsi")]
    [InlineData(12345, "dosprãdzatsi njilj trei suti patrudzãts shi tsintsi")]
    [InlineData(1000000, "unã miliunã")]
    [InlineData(1000000000, "unã njilji miliunj")]
    public void ComposesTheCardinals(double n, string expected) => Assert.Equal(expected, Numbers.NumberToWords(n));

    [Theory]
    // The magnitude nouns are FEMININE, so 2 agrees as ⟨dau⟩.
    [InlineData(2, "doi")]
    [InlineData(200, "dau suti")]
    [InlineData(2000, "dau njilj")]
    [InlineData(2000000, "dau miliunj")]
    public void TheMagnitudeMultiplierAgreesFeminine(double n, string expected) => Assert.Equal(expected, Numbers.NumberToWords(n));

    [Fact]
    public void NoDigitLeakSentinelOrGapAcrossTwentyThousand()
    {
        for (var n = 0; n <= 20000; n++)
            Assert.Matches("^[^0-9]*$", Numbers.NumberToWords(n));
        Assert.DoesNotContain("undefined", Numbers.NumberToWords(20000));
        Assert.DoesNotContain("NaN", Numbers.NumberToWords(20000));
    }

    [Fact]
    public void TheNumeralIsPhonemizedNotSpelledOutDigitWise()
    {
        Assert.Equal("unsprəɣinɡit͡s", Say("21")); // ⟨ã⟩→ə, ⟨y⟩→ɣ (Greek gamma), ⟨ts⟩→t͡s
        Assert.Equal("unə sutə", Say("100"));
    }

    [Fact]
    public void AllFourSeparatorConventionsCoexist()
    {
        // the comma groups and decimates one clause apart; the dot does both too
        Assert.Equal("206235", Norm("206,235"));
        Assert.Equal("111 2", Norm("111,2"));
        Assert.Equal("22834", Norm("22.834"));
        Assert.Equal("0 48", Norm("0.48"));
        Assert.Equal("10600000", Norm("10,600,000"));
        Assert.Equal("216061", Norm("216 061"));
        // ⚠ trap 58 — a clause mark after the figure keeps both the number and the pause
        Assert.Equal("52360 bãnãtori.", Norm("52.360 bãnãtori."));
    }

    [Fact]
    public void TheDottedDateIsTakenBeforeTheDecimalArm()
    {
        Assert.Equal("23 12 1951", Norm("23.12.1951"));
        Assert.Equal("16 04 1959", Norm("16.04.1959"));
    }

    [Fact]
    public void TheEraInBothSpacingsWithTheFormsTheWikiWrites()
    {
        Assert.Equal("287 ninti di Hristo.", Norm("287 n.Hr."));
        Assert.Equal("356 ninti di Hristo, 323 dupu Hristo.", Norm("356 n. Hr. \u2013 323 d.Hr."));
        // the en/em dash span is claimed BEFORE the era step, while the dot is still on its left
        Assert.Equal("287 ninti di Hristo, 212 dupu Hristo.", Norm("287 n.Hr. \u2013212 d.Hr."));
        Assert.Equal("1904, 1905", Norm("1904 \u2014 1905"));
    }

    [Fact]
    public void TheDottedAbbreviationsAndTheSentenceEndGuard()
    {
        // the corpus's commonest instance has a BRACKET after the dot
        Assert.Equal("216061 bãnãtori (2002)", Norm("216 061 bãn. (2002)"));
        Assert.Equal("Ledzea numir 53", Norm("Ledzea nr. 53"));
        Assert.Equal("(grãtseascã γλωσσολογία)", Norm("(gr. γλωσσολογία)"));
    }

    /**
     * ⚠ THE SENTENCE-END CLASS IS `["»)']`, AND THE GOLDEN CANNOT SEE IT. The guard decides whether the
     * abbreviation's dot is KEPT as the clause pause, and it only fires when the rest of the string is
     * blank — so it is settled by what closes the segment. The first cut of the port transcribed the
     * bracket and the straight apostrophe as the curly `”` `’`, which INVERTED the rule on this corpus's
     * own commonest shape (`216 061 bãn. (2002)`, `Lingvistica (gr. …)` — both end in a bracket): the
     * clause-final pause was dropped outright, and every mid-string case, which is all the golden has,
     * agreed anyway. Every expected value below is the TS engine's own output.
     */
    [Theory]
    // IN the class — the dot is kept as the pause.
    [InlineData("216 061 b\u00e3n.)", "216061 b\u00e3n\u00e3tori.)")]
    [InlineData("Tu anlu 800 n.Hr.)", "Tu anlu 800 ninti di Hristo.)")]
    [InlineData("Lingvistica (gr.)", "Lingvistica (gr\u00e3tseasc\u00e3.)")]
    [InlineData("easti dr.)", "easti doctor.)")]
    [InlineData("avea 52.360 b\u00e3n.'", "avea 52360 b\u00e3n\u00e3tori.'")]
    [InlineData("avea 52.360 b\u00e3n.\"", "avea 52360 b\u00e3n\u00e3tori.\"")]
    [InlineData("avea 52.360 b\u00e3n.\u00bb", "avea 52360 b\u00e3n\u00e3tori.\u00bb")]
    [InlineData("avea 52.360 b\u00e3n.", "avea 52360 b\u00e3n\u00e3tori.")]
    // NOT in the class — the curly quotes are not sentence-end here, so the dot goes.
    [InlineData("avea 52.360 b\u00e3n.\u201d", "avea 52360 b\u00e3n\u00e3tori\u201d")]
    [InlineData("avea 52.360 b\u00e3n.\u2019", "avea 52360 b\u00e3n\u00e3tori\u2019")]
    // not a sentence end at all — the dot goes.
    [InlineData("avea 52.360 b\u00e3n. shi", "avea 52360 b\u00e3n\u00e3tori shi")]
    public void TheSentenceEndGuardKeepsTheDotForExactlyTheTsClass(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Fact]
    public void TheColonIsNeverAClock()
    {
        Assert.Equal("sh-tu 2001: 52116", Norm("sh-tu 2001: 52.116"));
    }

    [Fact]
    public void ThePercentPhraseAndTheDiParticleReachThePipeline()
    {
        Assert.Contains("la sut\u0259", Say("0.48%"));
        Assert.Contains("la sut\u0259", Say("19,1 la sutã"));
        // the particle sits between the figure and the unit, so the tier cannot bridge it
        Assert.Contains("kilometru", Say("18 di km"));
        Assert.Contains("kilometru", Say("6650 km"));
    }
}
