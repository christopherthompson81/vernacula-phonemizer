// The portable half of test/aragonese.test.ts — the g2p branches and the normalization defects
// the 200-row golden cannot reach on its own. Canonical-IPA goldens for Aragonese (an) — aragonés,
// Ibero-Romance (Pyrenean), Latin script, a Spanish-shaped shallow g2p. The hallmarks: ⟨ch⟩→[t͡ʃ]
// (where Spanish has [x]), ⟨ny⟩→[ɲ] (the Catalan-style digraph), ⟨x⟩→[ʃ], ⟨v⟩→[b] (betacism),
// the distinción (⟨z c⟩+e/i → [θ], not the seseo merger), and the word-final ⟨-r⟩ apocope.
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Aragonese;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class AragoneseTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "an").Trim();
    private static string Norm(string s) => Normalize.NormalizeAragonese(s);

    [Theory]
    // The hallmark ⟨ch⟩→[t͡ʃ], ⟨ny⟩→[ɲ], ⟨x⟩→[ʃ] and the rising glide ⟨u⟩→[w].
    [InlineData("Chesús", "t͡ʃesus")]
    [InlineData("Espanya", "espaɲa")]
    [InlineData("baxo", "baʃo")]
    [InlineData("chuego", "t͡ʃweɡo")]
    public void ReadsTheHallmarkDigraphsAndGlide(string input, string expected) =>
        Assert.Equal(expected, AragonesePhonemizer.PhonemizeWord(input));

    [Theory]
    // Distinción + ⟨ll⟩→[ʎ] + the rising glides + the tap/trill split.
    [InlineData("abanza", "abanθa")]
    [InlineData("cielo", "θjelo")]
    [InlineData("tierra", "tjera")]
    [InlineData("fillo", "fiʎo")]
    [InlineData("Aragón", "aɾaɡon")]
    public void ReadsTheDistincionTheDigraphsAndTheGlides(string input, string expected) =>
        Assert.Equal(expected, AragonesePhonemizer.PhonemizeWord(input));

    [Theory]
    // Word-final ⟨-r⟩ apocope (the Aragonese trait): a final tap after a vowel is dropped.
    [InlineData("cantar", "kanta")]
    [InlineData("muller", "muʎe")]
    public void DropsTheWordFinalRAfterAVowel(string input, string expected) =>
        Assert.Equal(expected, AragonesePhonemizer.PhonemizeWord(input));

    [Fact]
    public void RegistryWiring() => Assert.Equal("t͡ʃesus", Say("Chesús"));

    [Theory]
    // Decimal; the twenties FUSE (vintiun) while 30–90 take the ⟨y⟩ connector; 16–19 are the analytic
    // deci- series; millón is a NOUN (un millón / dos millons), 10⁹ the Ibero long-scale "mil millons".
    [InlineData(7, "siete")]
    [InlineData(16, "decisiéis")]
    [InlineData(21, "vintiun")]
    [InlineData(31, "trenta y un")]
    [InlineData(555, "cincocientos cinquanta y cinco")]
    [InlineData(12345, "dotze mil trecientos quaranta y cinco")]
    [InlineData(1000000, "un millón")]
    [InlineData(1000000000, "mil millons")]
    public void ComposesTheCardinals(double n, string expected) => Assert.Equal(expected, Numbers.NumberToWords(n));

    [Fact]
    public void TheNumeralIsPhonemizedNotSpelledOutDigitWise()
    {
        Assert.Equal("bintjun", Say("21")); // ⟨v⟩→b (betacism)
        Assert.Equal("θjent", Say("100")); // cient — distinción ⟨c⟩+i → θ
    }

    [Fact]
    public void NoDigitLeakSentinelOrGapAcrossTwentyThousand()
    {
        for (var n = 0; n <= 20000; n++)
            Assert.Matches("^[^0-9]*$", Numbers.NumberToWords(n));
        Assert.DoesNotContain("undefined", Numbers.NumberToWords(20000));
        Assert.DoesNotContain("NaN", Numbers.NumberToWords(20000));
    }

    [Theory]
    // The separators: the DOT groups and the COMMA decimates, the DOT also decimates under 3 digits,
    // the SPACE groups too, and a clause-final figure must survive (the trailing guard rejects a digit).
    [InlineData("30.689", "30689")]
    [InlineData("8.443.713", "8443713")]
    [InlineData("450 295", "450295")]
    [InlineData("1 000 000", "1000000")]
    [InlineData("10.92", "10,92")]
    [InlineData("21,9", "21,9")]
    [InlineData("bellas 25.000 personas.", "bellas 25000 personas.")]
    public void TheSeparatorsDotGroupsCommaDecimatesSpaceGroups(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    // `°` and `º` are SWAPPED; the allow-list is what tells the senses apart. The compass set is NSEU
    // (Aragonese west is *ueste*), and the lone ordinal written with a degree sign is left UNREAD.
    [InlineData("baixan d'os -10º.", "baixan d'os menos 10 graus .")]
    [InlineData("de 3º y la de agosto de 21,9°", "de 3 graus y la de agosto de 21,9 graus ")]
    [InlineData("28°C", "28 graus Celsius")]
    [InlineData("11°U y 12°E", "11 graus ueste y 12 graus este")]
    [InlineData("o 57° país mas gran", "o 57° país mas gran")]
    public void TheDegreeAndOrdinalSignsAreSwappedAndTheAllowListDecides(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    // The colon is an athletics stopwatch: a trailing `.dd` or a second colon is what a clock has not.
    [InlineData("A las 17:07 se produce", "A las 17 07 se produce")]
    [InlineData("a las 04:35 UTC", "a las 04 35 UTC")]
    [InlineData("3.000 metros obstaclos - 8:09.09 min", "3000 metros obstaclos - 8:09,09 min")]
    [InlineData("un tiempo de 3:34.91", "un tiempo de 3:34,91")]
    [InlineData("eixemplo 41:20:00", "eixemplo 41:20:00")]
    public void TheClockDeclinesTheStopwatchAndTheCoordinate(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    // The minus sign must not claim the athletics list separator (a figure whose digits run into a
    // colon is a time, not a signed quantity).
    [InlineData("de -37,8 °C", "de menos 37,8 graus Celsius")]
    [InlineData("1.500 metros lisos - 3:40.96 min", "1500 metros lisos - 3:40,96 min")]
    public void TheMinusDoesNotClaimTheListSeparator(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    // The era marker, the abbreviations (each expanding to ITS OWN word), `hab.` losing its dot so the
    // tier sees a rate, and `m.a.` — which the tier would otherwise read as metres.
    [InlineData("dende arredol d'o 12.500 a. C.", "dende arredol d'o 12500 antes de Cristo.")]
    [InlineData("(490 a. C.?)", "(490 antes de Cristo?)")]
    [InlineData("nº 132", "numero 132")]
    [InlineData("lum. 160", "lumero 160")]
    [InlineData("413 hab./km²", "413 hab/km²")]
    [InlineData("fa ±415 - ±360 m.a.", "fa ±415 - ±360 millons d'anyadas")]
    public void TheEraMarkerTheAbbreviationsAndMa(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    // Ranges, and the guards that keep the rule off a citation (an adjacent slash means a citation).
    [InlineData("1961-1990", "1961, 1990")]
    [InlineData("pp. 28–37", "pp. 28, 37")]
    [InlineData("Lei 10/2009", "Lei 10/2009")]
    [InlineData("30/10/1977", "30/10/1977")]
    public void RangesAndTheGuardsThatKeepTheRuleOffACitation(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Fact]
    // The whole pipeline: separators + the symbol tier + the decimal-comma number branch.
    public void TheWholePipelineSeparatorsTierAndTheDecimalComma()
    {
        Assert.Equal("kwaɾanta i θinko mil kilometɾos kwadɾaus", Say("45.000 km²"));
        Assert.Equal("kwaɾanta i tɾes koma θinko abitants po kilometɾo kwadɾau", Say("43,5 hab/km²"));
        Assert.Equal("un siʃanta po θjent dos inɡɾesos", Say("un 60% d'os ingresos"));
        Assert.Equal("tɾeθjentos θinkwanta i nweu koma nweu biʎons de dolaɾs", Say("$359,9 billons"));
        Assert.Equal("nobanta i dos mil euɾos", Say("92.000€"));
    }
}
