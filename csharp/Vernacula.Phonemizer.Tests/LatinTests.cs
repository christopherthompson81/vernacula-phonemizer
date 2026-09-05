// The portable half of test/latin.test.ts — Latin (la), the reconstructed CLASSICAL reading (Allen,
// *Vox Latina*) over macronized spelling.
//
// ⚠ la HAS NO FLEURS SPLIT, so the corpus-wide differential PORTING.md asks for is unavailable in its
// usual form and the weight falls on these plus the off-golden probes (see docs/investigations/la/la_port_investigation.md).
using Vernacula.Phonemizer;
using LaEngine = Vernacula.Phonemizer.Languages.Latin.LatinPhonemizer;
using LaNormalize = Vernacula.Phonemizer.Languages.Latin.Normalize;
using LaNumbers = Vernacula.Phonemizer.Languages.Latin.Numbers;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class LatinTests
{
    [Theory]
    // Short-vowel laxing vs macron length; ⟨c⟩→[k], ⟨v⟩→[w].
    [InlineData("rosa", "ˈrɔsa")]
    [InlineData("vīta", "ˈwiːta")]
    [InlineData("cīvis", "ˈkiːwɪs")]
    [InlineData("amīcus", "aˈmiːkʊs")]          // penult heavy (ī) → penult stress
    // ⟨qu⟩→[kʷ], ⟨ngu⟩→[ŋɡʷ], ⟨x⟩→[ks], ⟨gn⟩→[ŋn].
    [InlineData("aqua", "ˈakʷa")]
    [InlineData("lingua", "ˈlɪŋɡʷa")]
    [InlineData("exemplum", "ɛkˈsɛmpɫũː")]
    [InlineData("magnus", "ˈmaŋnʊs")]
    // Aspirates, diphthongs, dark ⟨l⟩, and the intervocalic GEMINATE glide.
    [InlineData("Caesar", "ˈkae̯sar")]
    [InlineData("philosophia", "pʰɪɫɔˈsɔpʰia")]
    [InlineData("eius", "ˈɛjjʊs")]              // the ⟨e⟩ stays LAX — a following glide is not hiatus
    [InlineData("fīlia", "ˈfiːlia")]            // ⟨l⟩ before ⟨i⟩ → clear [l]
    // Word-final ⟨-Vm⟩, the initial glide, and hiatus.
    [InlineData("bellum", "ˈbɛllũː")]
    [InlineData("aquam", "ˈakʷãː")]
    [InlineData("Iūlius", "ˈjuːliʊs")]
    [InlineData("nātiō", "ˈnaːtioː")]           // ⟨ti⟩ hiatus is a LIGHT penult → antepenult stress
    [InlineData("coëunda", "koeˈʊnda")]         // the diaeresis tenses unconditionally
    // Weight stress: nasalized nuclei, diphthongs, muta cum liquida.
    [InlineData("mēnsam", "ˈmẽːsãː")]
    [InlineData("Rōmānum", "roːˈmaːnũː")]
    [InlineData("tenebrae", "ˈtɛnɛbrae̯")]      // a diphthong is ONE nucleus
    [InlineData("volucris", "ˈwɔɫʊkrɪs")]       // muta cum liquida onsets the ultima
    public void TheClassicalReading(string word, string want) => Assert.Equal(want, LaEngine.PhonemizeWord(word));

    // ─────────────────────────────────────────────────────────────────────────────────────────────
    // #1097 — word-final ⟨-Vm⟩ must nasalize a NUCLEUS, never a diphthong offglide.
    //
    // `IsVowelSeg` is true of an offglide (`u̯` decomposes to `u` + U+032F), so a word whose last two
    // letters spell a diphthong had that diphthong's SECOND element nasalized and lengthened in place:
    // `Nicolaum` read *ˈnɪkɔɫaũ̯ː*. Two defects in one — no language has that segment, and `PlaceStress`
    // skips anything carrying U+032F, so the word lost a syllable. It was live in this port's own golden.
    //
    // ⚠ THE REFEREE DECIDED IT: of the 45 `la.wikipron-lat-clas-narrow` rows spelled ⟨a|o|e⟩⟨u|e⟩m, NOT
    // ONE nasalizes an offglide. `-aum` is a hiatus, so the offglide is made syllabic.
    [Theory]
    // Segment-for-segment against the referee row quoted beside each.
    [InlineData("Boleslaum", "bɔˈɫɛsɫaũː")]   // b ɔ ɫ ɛ s ɫ a ũː
    [InlineData("Coeum", "ˈkoe̯ũː")]           // k o e̯ ũː — the ⟨oe̯⟩ diphthong SURVIVES; only the final u nasalizes
    [InlineData("Idaeum", "ɪˈdae̯ũː")]         // ɪ d a e̯ ũː
    [InlineData("Caesareum", "kae̯ˈsareũː")]   // k a e̯ s a r e ũː
    [InlineData("Nicolaum", "nɪˈkɔɫaũː")]     // the golden row that carried the defect
    public void FinalVmNasalizesANucleusNotAnOffglide(string word, string want) =>
        Assert.Equal(want, LaEngine.PhonemizeWord(word));

    /** ⚠ AND THE ORDINARY CASES ARE UNTOUCHED — the change is to the offglide branch alone. */
    [Theory]
    [InlineData("bellum", "ˈbɛllũː")]
    [InlineData("aquam", "ˈakʷãː")]
    [InlineData("laudem", "ˈɫau̯dẽː")]   // a diphthong NOT at the -Vm site keeps its offglide
    [InlineData("mensa", "ˈmẽːsa")]      // the pre-fricative nasal shares NasalizeLong
    public void TheOrdinaryNasalizationsAreUntouched(string word, string want) =>
        Assert.Equal(want, LaEngine.PhonemizeWord(word));

    [Fact]
    public void RegistryWiring() => Assert.Equal("ˈrɔsa", Phonemizer.Phonemize("rosa", "la").Trim());

    [Theory]
    [InlineData(0, "nihil")]                    // Classical Latin has no zero cardinal
    [InlineData(1, "ūnus")]
    [InlineData(3, "trēs")]
    [InlineData(10, "decem")]
    [InlineData(17, "septendecim")]
    [InlineData(18, "duodēvīgintī")]            // SUBTRACTIVE, and it is the expected reading
    [InlineData(19, "ūndēvīgintī")]
    [InlineData(20, "vīgintī")]
    [InlineData(21, "vīgintī ūnus")]
    [InlineData(28, "duodētrīgintā")]
    [InlineData(29, "ūndētrīgintā")]
    [InlineData(88, "duodēnōnāgintā")]
    [InlineData(98, "duodēcentum")]             // the "next ten" after 90 is centum
    [InlineData(99, "ūndēcentum")]
    [InlineData(100, "centum")]
    [InlineData(101, "centum ūnus")]
    [InlineData(111, "centum ūndecim")]
    [InlineData(555, "quīngentī quīnquāgintā quīnque")]
    [InlineData(900, "nōngentī")]
    [InlineData(1000, "mīlle")]                 // bare indeclinable adjective
    [InlineData(2000, "duo mīlia")]
    [InlineData(3000, "tria mīlia")]            // neuter agreement: trēs → tria
    [InlineData(12345, "duodecim mīlia trecentī quadrāgintā quīnque")]
    [InlineData(1000000, "mīlliō")]
    [InlineData(2000000, "duo mīlliōnēs")]
    [InlineData(1000000000, "mīlliardum")]
    public void TheCardinalComposer(double n, string want) => Assert.Equal(want, LaNumbers.NumberToWords(n));

    /** No digit leak, sentinel or gap anywhere in the composer's dense range. */
    [Fact]
    public void NoLeakAcrossTheDenseRange()
    {
        for (var n = 0; n <= 20000; n++)
        {
            var w = LaNumbers.NumberToWords(n);
            Assert.False(w.Contains("undefined") || w.Contains("NaN") || w.Any(char.IsAsciiDigit), $"n={n}");
        }
    }

    [Theory]
    [InlineData("18", "duɔdeːwiːˈɡɪntiː")]
    [InlineData("19", "uːndeːwiːˈɡɪntiː")]
    [InlineData("1000", "ˈmiːllɛ")]
    public void EndToEndTheNumeralIsSpoken(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "la").Trim());

    [Theory]
    // DE-GROUPING — and ⚠ the FOUR-group case the sweep's usual two-digit-join idiom gets silently wrong.
    [InlineData("25 000 000", "25000000")]
    [InlineData("1 320 000 000", "1320000000")]
    // ⚠ The trailing guard rejects a DIGIT, not a dot (trap 58) — a clause-final figure keeps its grouping.
    [InlineData("25 000 000,", "25000000,")]
    [InlineData("25 000 000.", "25000000.")]
    // The ERA marker, which is its own expansion — and the LONGER form has to run first.
    [InlineData("anno 31 a.C.n.", "anno 31 ante Christum natum.")]
    [InlineData("saeculi II p.C.n. auctor", "saeculi II post Christum natum auctor")]
    [InlineData("a.C. 500", "ante Christum 500")]
    [InlineData("Thesei, &c.", "Thesei, et cetera")]
    // RANGES take a pause — and ⚠ an ISBN is not a range.
    [InlineData("1732-1735", "1732, 1735")]
    [InlineData("pp. 1-43", "pp. 1, 43")]
    [InlineData("ISBN 978-3-8273-7360-1", "ISBN 978-3-8273-7360-1")]
    [InlineData("0-333-75088-8", "0-333-75088-8")]
    // ⚠ WHAT IS REFUSED: the arithmetic signs are REAL here, and the blocker is AGREEMENT, not sense.
    [InlineData("6/3 = 2", "6/3 = 2")]
    [InlineData("73 = 5 × 14 + 3", "73 = 5 × 14 + 3")]
    public void TheNormalizer(string input, string want) => Assert.Equal(want, LaNormalize.NormalizeLatin(input));

    /** The corpus glosses its own notation, and those glosses are the only words this layer emits. */
    [Theory]
    [InlineData("10.6° C", "10.6 gradus Celsius")]
    [InlineData("43,5°", "43,5 gradus")]
    [InlineData("97%", "97 centesimae")]
    public void TheSignAndItsWordReadAlike(string sign, string word) =>
        Assert.Equal(Phonemizer.Phonemize(word, "la"), Phonemizer.Phonemize(sign, "la"));

    /** A Roman numeral stays CARDINAL: Latin ordinals decline for five cases × three genders and the
     *  corpus's own instances span the paradigm, while `libri III` is a cardinal outright. */
    [Fact]
    public void TheRomanNumeralIsNotDeclinedIntoAnOrdinal() =>
        Assert.Equal("ˈlɪbɛr ˈduɔ", Phonemizer.Phonemize("liber II", "la").Trim());
}
