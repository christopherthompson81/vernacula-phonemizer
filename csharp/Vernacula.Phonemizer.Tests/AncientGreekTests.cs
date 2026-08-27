// The portable half of test/ancientgreek.test.ts — Ancient Greek (grc), the reconstructed 5th-c. BCE
// Classical Attic reading (Allen, Vox Graeca) over polytonic Greek.
//
// ⚠ THESE CARRY MORE WEIGHT HERE THAN IN MOST PORTS, because grc's golden is VARIANT-DERIVED: it is
// rendered over MODERN Greek FLEURS text, which is monotonic. Of the nine combining marks this engine
// reads, that text exercises exactly two — 3,122 acutes and 13 diaereses, and ZERO rough, smooth, grave,
// circumflex, iota subscript, macron or breve. Every branch below is one the 200-row gate cannot see.
using Vernacula.Phonemizer;
using GrcEngine = Vernacula.Phonemizer.Languages.AncientGreek.AncientGreekPhonemizer;
using GrcNumbers = Vernacula.Phonemizer.Languages.AncientGreek.Numbers;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class AncientGreekTests
{
    [Theory]
    // The aspirates, the long mid vowels, and the γ-nasal.
    [InlineData("λόγος", "lóɡos")]
    [InlineData("ἄνθρωπος", "ántʰrɔːpos")]
    [InlineData("θεός", "tʰeós")]              // the acute stays on the ⟨ο⟩, not the next vowel
    [InlineData("ἄγγελος", "áŋɡelos")]         // ⟨γγ⟩ → [ŋɡ]
    [InlineData("δεδεγμένος", "dedeŋménos")]   // …and the agma before ⟨μ⟩ too
    // The ROUGH BREATHING, the diphthongs, υ→[y], and the two-phone letters.
    [InlineData("ἵππος", "híppos")]
    [InlineData("αὐτός", "au̯tós")]
    [InlineData("ψυχή", "psykʰɛː́")]
    [InlineData("ζῷον", "zdɔːí̯on")]           // ⟨ζ⟩→[zd]; iota subscript ⟨ῳ⟩→[ɔːi̯], circumflex on it
    [InlineData("μοῦσα", "muː́sa")]            // the diphthong takes its accent from the OFFGLIDE
    // σ-voicing, aspirate assimilation, and the voiceless ρ.
    [InlineData("Λέσβια", "lézbia")]
    [InlineData("Σμύρνα", "zmýrna")]
    [InlineData("Βάκχε", "bákʰkʰe")]
    [InlineData("Σαπφώ", "sapʰpʰɔː́")]
    [InlineData("ῥήτωρ", "r̥ɛː́tɔːr")]         // word-initial ⟨ῥ⟩ → the VOICELESS [r̥]
    [InlineData("Πύρρα", "pýr̥r̥a")]           // …and so is a ⟨ρρ⟩ cluster
    public void TheAtticReading(string word, string want) => Assert.Equal(want, GrcEngine.PhonemizeWord(word));

    [Fact]
    public void RegistryWiring() => Assert.Equal("lóɡos", Phonemizer.Phonemize("λόγος", "grc").Trim());

    // CARDINALS. Two structural features: καί-LINKED compounds, in the TENS-FIRST order chosen so the spoken
    // order tracks the digits, and MYRIAD (10⁴) grouping rather than a thousands ladder — μυριάς/μυριάδες with
    // a genitive μυριάδων per extra level (Archimedes' μυριὰς μυριάδων = 10⁸). Citation form: masc. nominative.
    [Theory]
    [InlineData(0, "οὐδέν")]                                 // Classical Greek has no zero cardinal
    [InlineData(1, "εἷς")]
    [InlineData(3, "τρεῖς")]
    [InlineData(4, "τέτταρες")]                              // ATTIC, not the Ionic/koine τέσσαρες
    [InlineData(10, "δέκα")]
    [InlineData(12, "δώδεκα")]
    [InlineData(13, "τρεῖς καὶ δέκα")]                       // Smyth's own units-first phrase for 13/14
    [InlineData(15, "πεντεκαίδεκα")]                         // 15–19 are FUSED
    [InlineData(16, "ἑκκαίδεκα")]
    [InlineData(20, "εἴκοσι")]
    [InlineData(21, "εἴκοσι καὶ εἷς")]
    [InlineData(25, "εἴκοσι καὶ πέντε")]
    [InlineData(99, "ἐνενήκοντα καὶ ἐννέα")]
    [InlineData(100, "ἑκατόν")]
    [InlineData(101, "ἑκατόν καὶ εἷς")]
    [InlineData(555, "πεντακόσιοι καὶ πεντήκοντα καὶ πέντε")]
    [InlineData(1000, "χίλιοι")]
    [InlineData(2000, "δισχίλιοι")]                          // the multiplicative χίλιοι series
    [InlineData(4000, "τετρακισχίλιοι")]
    [InlineData(10000, "μυριάς")]                            // a magnitude, not "ten thousand"
    [InlineData(12345, "μυριάς καὶ δισχίλιοι καὶ τριακόσιοι καὶ τετταράκοντα καὶ πέντε")]
    [InlineData(20000, "δύο μυριάδες")]
    [InlineData(1000000, "ἑκατόν μυριάδες")]                 // 10⁶ = a hundred myriads
    [InlineData(1000000000, "δέκα μυριάδες μυριάδων")]       // the genitive nesting
    public void TheMyriadComposer(double n, string want) => Assert.Equal(want, GrcNumbers.NumberToWords(n));

    /** No digit leak, sentinel or gap anywhere in the composer's dense range. */
    [Fact]
    public void NoLeakAcrossTheDenseRange()
    {
        for (var n = 0; n <= 20000; n++)
        {
            var w = GrcNumbers.NumberToWords(n);
            Assert.False(w.Contains("undefined") || w.Contains("NaN") || w.Any(char.IsAsciiDigit), $"n={n}");
        }
    }

    [Theory]
    // The numeral is phonemized, not spelled out digit-wise — and εἷς keeps its rough-breathing [h].
    [InlineData("21", "eː́kosi kaí̯ heː́s")]
    [InlineData("10000", "myriás")]
    public void EndToEndTheNumeralIsSpoken(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "grc").Trim());
}
