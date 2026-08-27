// The portable half of test/finnish.test.ts — Finnish (fi), Standard yleiskieli over a near-perfectly
// phonemic orthography. Three rules live in code rather than the table: CONSONANT GEMINATION and the
// velar-nasal pair ⟨ng⟩→ŋː / ⟨nk⟩→ŋk.
using Vernacula.Phonemizer;
using FiEngine = Vernacula.Phonemizer.Languages.Finnish.FinnishPhonemizer;
using FiNormalize = Vernacula.Phonemizer.Languages.Finnish.Normalize;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class FinnishTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "fi").Trim();

    [Theory]
    // Back ⟨a⟩=ɑ, DOUBLING = LENGTH, ⟨v⟩=ʋ.
    [InlineData("talo", "tɑlo")]
    [InlineData("maa", "mɑː")]
    [InlineData("pää", "pæː")]
    [InlineData("vesi", "ʋesi")]
    // Consonant gemination → Cː.
    [InlineData("kukka", "kukːɑ")]
    [InlineData("tullut", "tulːut")]
    [InlineData("mummo", "mumːo")]
    // ⚠ THE VELAR NASALS: ⟨ng⟩ is a LONG ŋː, ⟨nk⟩ is ŋ + k (so kk-gemination still holds after it).
    [InlineData("kengät", "keŋːæt")]
    [InlineData("rengas", "reŋːɑs")]
    [InlineData("sänky", "sæŋky")]
    [InlineData("kaupunki", "kɑu̯puŋki")]
    // The diphthongs mark the 2nd vowel non-syllabic.
    [InlineData("pöytä", "pøy̯tæ")]
    [InlineData("auto", "ɑu̯to")]
    [InlineData("tie", "tie̯")]
    [InlineData("työ", "tyø̯")]
    [InlineData("vuosi", "ʋuo̯si")]
    [InlineData("Suomi", "suo̯mi")]
    public void TheGreedyScan(string word, string want) => Assert.Equal(want, FiEngine.PhonemizeWord(word));

    [Theory]
    // ⚠ ALL FOUR ORDINAL BRANCHES, including the hundreds the corpus never writes.
    [InlineData(1, "ensimmäinen")]
    [InlineData(3, "kolmas")]
    [InlineData(10, "kymmenes")]
    [InlineData(11, "yhdestoista")]      // the teens use the COMBINING unit, not the standalone form
    [InlineData(12, "kahdestoista")]
    [InlineData(20, "kahdeskymmenes")]
    [InlineData(21, "kahdeskymmenesensimmäinen")]
    [InlineData(22, "kahdeskymmenestoinen")] // …and 2 changes shape between the two slots
    [InlineData(100, "sadas")]
    [InlineData(126, "sadaskahdeskymmeneskuudes")]
    [InlineData(200, "kahdessadas")]
    public void TheOrdinal(double n, string want) => Assert.Equal(want, FiNormalize.Ordinal(n));

    [Theory]
    [InlineData(0)]
    [InlineData(1000)]
    public void TheOrdinalDeclinesOutOfRange(double n) => Assert.Null(FiNormalize.Ordinal(n));

    [Theory]
    // Cardinals: agglutinated below 1000, `tuhat` joined, `miljoona` separate.
    [InlineData("0", "nolːɑ")]
    [InlineData("7", "sei̯tsemæn")]
    [InlineData("11", "yksitoi̯stɑ")]
    [InlineData("234", "kɑksisɑtɑːkolmekymːentæneljæ")]
    [InlineData("1234", "tuhɑt kɑksisɑtɑːkolmekymːentæneljæ")]
    [InlineData("2000000", "kɑksi miljoːnɑː")]
    // ⚠ >9 digits reads the RAW STRING digit-by-digit, so the float cannot go exponential.
    [InlineData("10000000000", "yksi nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ")]
    [InlineData("Talo on iso.", "tɑlo on iso .")]
    public void TheWholePipeline(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // The bare `N.` ordinal is claimed before a month or a lowercase word — and the ordinal RANGE first.
    [InlineData("13. toukokuuta 1931", "kolmɑstoi̯stɑ tou̯kokuːtɑ")]
    [InlineData("18. herttuatar", "kɑhdeksɑstoi̯stɑ hertːuɑtɑr")]
    [InlineData("20.–24. toukokuuta", "kɑhdeskymːenes kɑhdeskymːenesneljæs")]
    [InlineData("33:s", "kolmɑskymːeneskolmɑs")]
    // ⚠ A SENTENCE PERIOD IS NEVER EATEN — the invariant the 333-context table was built to protect.
    [InlineData("vuonna 1978. Jakokoski on kylä", "kɑhdeksɑn . jɑkokoski")]
    [InlineData("noin 2100 eaa. Urissa asui", "ɑlkuɑ . urisːɑ")]
    // Space grouping, the decimal comma, and the unit that survives it.
    [InlineData("1 786", "tuhɑt sei̯tsemænsɑtɑːkɑhdeksɑŋkymːentækuːsi")]
    [InlineData("50,7 %", "pilkːu sei̯tsemæn prosentːiɑ")]
    [InlineData("13,6 cm", "pilkːu kuːsi sentːimetriæ")]
    // The rate keys compose the inessive denominator; the exponent COMPOUNDS onto the front.
    [InlineData("120 km/h", "kilometriæ tunːisːɑ")]
    [InlineData("3 m/s", "metriæ sekunːisːɑ")]
    [InlineData("76 km²", "neliøkilometriæ")]
    [InlineData("259 km2", "neliøkilometriæ")]
    // Degrees, the minus and plus, currency, the ampersand.
    [InlineData("14–30 °C", "ɑstetːɑ")]
    [InlineData("−2 °C", "miːnus")]
    [InlineData("+33,2 °C", "plus")]
    [InlineData("100 $ barrelilta", "dolːɑriɑ")]
    [InlineData("Robinson & Cook", "jɑ")]
    // The clock, gated on the marker word.
    [InlineData("kello 21.01", "kɑksikymːentæy̯ksi nolːɑ yksi")]
    [InlineData("kello 10.00", "kymːenen nolːɑ nolːɑ")]
    // Letter names, and the colon suffix glued to the LAST one (which is why the long forms exist).
    [InlineData("CIA:n", "seː iː ɑːn")]
    [InlineData("BKT:sta", "beː koː teːstɑ")]
    [InlineData("YK:n", "yː koːn")]
    [InlineData("MM-kilpailuissa", "æm æm")]   // was ONE geminate /mː/
    [InlineData("EU:n", "eː uːn")]
    // Abbreviations, and the digit guards that separate them from the units.
    [InlineData("s. 21. helmikuuta 1966", "syntynyt")]
    [InlineData("944 mm. Sateet", "milːimetriæ")]   // the UNIT, not `muun muassa`
    [InlineData("Siellä on mm. eräs", "muːn muɑsːɑ")]
    [InlineData("(engl. Algic languages)", "eŋːlɑnːiksi ɑlɡik")]
    public void ThePipelineContains(string input, string want) =>
        Assert.Contains(want, Say(input), StringComparison.Ordinal);

    [Theory]
    // ⚠ THE SPORTS TIME IS NOT A CLOCK — and it is excluded by the TRAILING guard, not by the marker.
    [InlineData("ajalla 9.29,43", "yhdeksæn kɑksikymːentæy̯hdeksæn")]
    [InlineData("1994–1997", "miːnus")]              // a range's dash is not a minus sign
    [InlineData("802.11m", "metriæ")]                // a dotted designation is not a quantity
    [InlineData("korvasi Volvo 850:n. Rinnakkaismallina", "noi̯n")] // the `\d:` guard on `n.`
    public void ThePipelineDeclines(string input, string unwanted) =>
        Assert.DoesNotContain(unwanted, Say(input), StringComparison.Ordinal);

    /** ⟨cm⟩ and ⟨km⟩ were the SAME reading before the unit tier — trap 56, a defect with no leak. */
    [Fact]
    public void CmAndKmAreNoLongerTheSameReading()
    {
        Assert.NotEqual(Say("5 cm"), Say("5 km"));
        Assert.Contains("kilometriæ", Say("5 km"), StringComparison.Ordinal);
    }

    /** A readable acronym stays a WORD unless the language spells it — `usa` and `ivy` are deliberately
     *  absent from the lexical list because the referee records Finnish reading them as words. */
    [Fact]
    public void AReadableAcronymStaysAWord() => Assert.Equal("usɑ", Say("USA"));

    /** Roman numerals reach the NUMBER path, not the initialism pass — the shared roman pass wraps
     *  `Text()` because Finnish is not in `ROMAN_NATIVE`. */
    [Theory]
    [InlineData("XV", "ʋiːsitoi̯stɑ")]
    [InlineData("Filipp II:n", "filipː kɑksi n")]
    public void RomanNumeralsReachTheNumberPath(string input, string want) => Assert.Equal(want, Say(input));

    /** The apostrophe genitive glues; the vowel-hiatus mark does not. */
    [Theory]
    [InlineData("Perrault’n", "perːɑu̯ltn")]
    [InlineData("raa'asti", "rɑː ɑsti")]
    public void TheApostrophe(string input, string want) => Assert.Equal(want, Say(input));

    /** No digit leak, sentinel or gap anywhere in the composer's dense range. */
    [Fact]
    public void NoLeakAcrossTheDenseRange()
    {
        for (var n = 0; n <= 20000; n++)
        {
            var w = Languages.Finnish.Numbers.NumberToWords(n);
            Assert.False(w.Contains("undefined") || w.Contains("NaN") || w.Any(char.IsAsciiDigit), $"n={n}");
        }
    }
}
