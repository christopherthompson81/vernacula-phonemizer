// The portable half of test/croatian.test.ts — the branches the 200-row golden cannot reach. hr is a THIN
// module over Serbian's `PhonemizeWord`, so what is pinned here is the Croatian delta: the number words, the
// normalizer's arms, and the four defects the port sent back to the TypeScript (#1059's raw threading, the
// end-of-input hyphen-suffix guard, the case-insensitive era marker, and the /s rate preposition) — NONE of
// which moves a golden row in either engine.
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class CroatianTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "hr").Trim();

    [Theory]
    // The shared Serbo-Croatian g2p, reached through the Croatian engine.
    [InlineData("mlijeko", "mlijˈeː˩˥ko")]
    [InlineData("đak", "d͡ʑaː˥˩k")]
    [InlineData("ljubav", "ʎˈuː˩˥baʋ")]
    [InlineData("čovjek", "t͡ʃˈoʋjek")]
    // The Croatian cardinal delta: tisuća / milijun / dvjesto, with the ijekavian feminine multiplier.
    [InlineData("1000", "tˈisut͡ɕu")]
    [InlineData("2000", "dʋˈi˥˩je tˈi˥˩sut͡ɕe")]
    [InlineData("5000", "peː˥˩t tˈisut͡ɕa")]
    [InlineData("21000", "dʋˈaː˩˥deset jednˈa tˈisut͡ɕa")]
    [InlineData("200", "dʋjˈe˥˩sto")]
    [InlineData("1000000", "jˈe˩˥dan milˈi˩˥jun")]
    [InlineData("2000000", "dʋaː˥˩ milijˈuna")]
    public void ReadsTheSharedG2pAndTheCroatianNumbers(string input, string expected) =>
        Assert.Equal(expected, Say(input));

    [Theory]
    // The ordinal arms: the licensor list, the elided year, the roman prenominal, the hyphen suffix.
    [InlineData("2017. godine", "dʋˈi˥˩je tˈi˥˩sut͡ɕe sedˈamnaeste ɡˈodine")]
    [InlineData("15. kolovoza", "petnˈaestoɡ kˈoloʋoza")]
    [InlineData("11. stoljeća", "jedanˈaestoɡ stˈoʎet͡ɕa")]
    [InlineData("1965. bio je prvi čovjek", "tˈisut͡ɕu dˈe˥˩ʋetsto ʃezdˈe˩˥set pˈete bˈi˥˩o je pˈrʋi t͡ʃˈoʋjek")]
    [InlineData("I. svjetskog rata", "pˈr˩˥ʋoɡ sʋjˈetskoɡ rˈata")]
    [InlineData("II. svjetskom ratu", "drˈuː˥˩ɡom sʋjˈetskom rˈatu")]
    // Degrees, the compass bearing and its lowercase-⟨s⟩ neighbour, the clock, the ranges, the signs.
    [InlineData("90 °F", "deʋedˈe˩˥set stˈupɲeʋa fˈarenxajta")]
    [InlineData("35° W", "trˈiː˩˥deset peː˥˩t stˈupɲeʋa zˈaː˥˩padno")]
    [InlineData("35° s padavinama", "trˈiː˩˥deset peː˥˩t stˈupɲeʋa s pˈadaʋinama")]
    [InlineData("1°", "jˈe˩˥dan stˈuː˥˩paɲ")]
    [InlineData("2°", "dʋaː˥˩ stˈupɲa")]
    [InlineData("23:35 h", "dʋˈaː˩˥deset triː˥˩ sˈaː˥˩ta i trˈiː˩˥deset peː˥˩t minˈuː˩˥ta")]
    [InlineData("4×4", "t͡ʃˈe˩˥tiri pˈuta t͡ʃˈe˩˥tiri")]
    [InlineData("-5", "mˈiː˩˥nus peː˥˩t")]
    [InlineData("6 ÷ 3", "ʃeː˥˩st pˈodijeʎeno s triː˥˩")]
    [InlineData("1/5 inča", "jˈe˩˥dan pˈeti ˈiː˥˩nt͡ʃa")]
    // The shared initialism pass, which hr runs out of serbian/normalize.ts.
    [InlineData("BBC", "be be t͡se")]
    [InlineData("UTC+1", "u te t͡se plus jˈe˩˥dan")]
    public void ReadsEachNormalizeArm(string input, string expected) =>
        Assert.Equal(expected, Say(input));

    /// <summary>#1059 — the digit-by-digit fallback reads the TOKEN'S digits, not a stringified double, and
    /// the string it is handed is the SEPARATOR-STRIPPED one so a dot-grouped overflow does not spell its
    /// periods. Before the fix `1000000000000000000000` read *jˈe˩˥dan e dʋaː˥˩ jˈe˩˥dan*.</summary>
    [Fact]
    public void ALargeNumeralKeepsItsOwnDigits()
    {
        var a = Say("1000000000000000000001");
        var b = Say("1000000000000000000009");
        Assert.NotEqual(a, b);
        Assert.Equal(22, a.Split(' ').Length);
        Assert.EndsWith("jˈe˩˥dan", a, StringComparison.Ordinal);
        Assert.EndsWith("dˈe˥˩ʋet", b, StringComparison.Ordinal);
        Assert.EndsWith("triː˥˩", Say("9007199254740993"), StringComparison.Ordinal); // past 2^53
        // A dot-grouped overflow: 1 followed by 24 zeroes, and not one separator among them.
        var grouped = Say("1.000.000.000.000.000.000.000.000").Split(' ');
        Assert.Equal(25, grouped.Length);
        Assert.Single(grouped.Skip(1).Distinct(StringComparer.Ordinal));
        // …and the composed path below the cap is untouched.
        Assert.Equal("jˈe˩˥dan milˈi˩˥jun", Say("1.000.000"));
        Assert.Equal("dʋaː˥˩ zˈarez peː˥˩t", Say("2,5"));
    }

    /// <summary>The hyphen-suffix ordinal fires MID-SENTENCE. Its guard used to be `(?![^\p{L}\p{M}]|.)`,
    /// which is end-of-INPUT, so in running text the cardinal read with a stray *ih* after it.</summary>
    [Theory]
    [InlineData("tijekom 1990-ih bilo je", "tijˈeː˥˩kom tˈisut͡ɕu dˈe˥˩ʋetsto deʋedˈe˩˥setix bˈilo je")]
    [InlineData("15-og svibnja", "petnˈaestoɡ sʋˈibɲa")]
    [InlineData("1970-ih", "tˈisut͡ɕu dˈe˥˩ʋetsto sedamdˈe˩˥setix")]
    [InlineData("2-3 dana", "dʋaː˥˩ do triː˥˩ dˈana")] // the range rule still owns a digit pair
    public void TheHyphenSuffixOrdinalFiresMidSentence(string input, string expected) =>
        Assert.Equal(expected, Say(input));

    /// <summary>The era marker is LOWERCASE-ONLY: `n.e.` is also two capital initials with stops, and this
    /// block runs before the dotted-capital-run rule.</summary>
    [Theory]
    [InlineData("N. E. Kovač je došao", "ne kˈo˩˥ʋat͡ʃ je dˈoʃao")]
    [InlineData("n.e. i dalje", "nˈoʋe ˈere i dˈa˥˩ʎe")]
    [InlineData("p.n.e.", "prˈi˥˩je nˈoʋe ˈere .")]
    [InlineData("400. g. n. e.", "t͡ʃetˈiristote nˈoʋe ˈere .")]
    [InlineData("1000. g. pr. Kr.", "tisˈut͡ɕite prˈi˥˩je krˈista .")]
    public void TheEraMarkerDeclinesCapitalInitials(string input, string expected) =>
        Assert.Equal(expected, Say(input));

    /// <summary>The rate preposition is per denominator: `na sat` but `u sekundi`, because `na` governs an
    /// accusative the feminine `sekunda` does not share with `sat`.</summary>
    [Theory]
    [InlineData("133 m/s", "stoː˥˩ trˈiː˩˥deset triː˥˩ mˈetra u sekˈuː˩˥ndi")]
    [InlineData("5 km/s", "peː˥˩t kˈilometara u sekˈuː˩˥ndi")]
    [InlineData("70 km/h", "sedamdˈe˩˥set kˈilometara na saː˥˩t")]
    [InlineData("40 mi/h", "t͡ʃetrdˈe˩˥set mˈiː˥˩ʎa na saː˥˩t")]
    public void TheRatePrepositionIsPerDenominator(string input, string expected) =>
        Assert.Equal(expected, Say(input));
}
