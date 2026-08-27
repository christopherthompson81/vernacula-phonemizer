// The portable half of test/sepedi.test.ts — Sepedi / Northern Sotho (nso), Bantu S32 over the Latin
// orthography. The compounds are CONJUNCTIVE (lesometee, masomepedi, makgolopedi), which is what separates
// this numeral system from the sibling Sesotho's disjunctive one.
using Vernacula.Phonemizer;
using NsoEngine = Vernacula.Phonemizer.Languages.Sepedi.SepediPhonemizer;
using NsoNormalize = Vernacula.Phonemizer.Languages.Sepedi.Normalize;
using NsoNumbers = Vernacula.Phonemizer.Languages.Sepedi.Numbers;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class SepediTests
{
    [Theory]
    // Distinctive graphemes, the aspirate, and the ejective.
    [InlineData("kgoši", "kxoʃi")]
    [InlineData("mošomo", "moʃomo")]
    [InlineData("hlogo", "ɬoxo")]
    [InlineData("batho", "batʰo")]
    [InlineData("sepedi", "sepʼedi")]
    public void TheGreedyScan(string word, string want) => Assert.Equal(want, NsoEngine.PhonemizeWord(word));

    [Theory]
    // The counting series — and it differs from Sesotho's at 1, 7, 8 and 9.
    [InlineData(0, "lefeela")]
    [InlineData(1, "tee")]
    [InlineData(7, "šupa")]
    [InlineData(8, "seswai")]
    [InlineData(9, "senyane")]
    // ⚠ TEENS AND TENS ARE CONJUNCTIVE SINGLE WORDS.
    [InlineData(10, "lesome")]
    [InlineData(11, "lesometee")]
    [InlineData(20, "masomepedi")]
    [InlineData(21, "masomepedi tee")]
    [InlineData(90, "masomesenyane")]
    // Hundreds are the conjunctive makgolo+STEM series.
    [InlineData(100, "lekgolo")]
    [InlineData(200, "makgolopedi")]
    [InlineData(555, "makgolohlano le masomehlano hlano")]
    // Thousands take the cl.8 `tše` concord — the one place concord reappears.
    [InlineData(1000, "sekete")]
    [InlineData(2000, "dikete tše pedi")]
    [InlineData(12345, "dikete lesomepedi le makgolotharo le masomenne hlano")]
    [InlineData(1000000, "milione")]
    [InlineData(1000000000, "bilione")]
    public void TheCardinalComposer(double n, string want) => Assert.Equal(want, NsoNumbers.NumberToWords(n));

    [Theory]
    [InlineData("21", "masomepʼedi tʼee")]
    [InlineData("200", "makxolopʼedi")]
    // ⚠ `kg` IS THE SEPEDI DIGRAPH FOR /kx/, so `1200 kg` read as a well-formed Sepedi consonant — trap 56,
    // a defect that produces a READING and that no leak class can see.
    [InlineData("108 km/h", "dikʰilomitʰara t͡ʃʼe lekxolo le seswai kʼa iri")]
    [InlineData("40%", "dipʼeresentʼe t͡ʃʼe masomenne")]
    public void TheWholePipeline(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "nso").Trim());

    [Fact]
    public void TheKgDigraphNoLongerSwallowsTheUnit()
    {
        Assert.Contains("dikʰiloxrama", Phonemizer.Phonemize("1200 kg", "nso"), StringComparison.Ordinal);
        Assert.DoesNotContain(" kx", Phonemizer.Phonemize("1200 kg", "nso"), StringComparison.Ordinal);
        Assert.Contains("sentʰimetʼara", Phonemizer.Phonemize("50 cm", "nso"), StringComparison.Ordinal);
    }

    [Theory]
    // PERCENT — the noun PRECEDES its figure, and the two count forms differ in concord (cl.9 vs cl.10).
    [InlineData("3%", "diperesente tše 3")]
    [InlineData("40% ya badudi", "diperesente tše 40 ya badudi")]
    [InlineData("1%", "peresente ye 1")]
    [InlineData("61.9%", "diperesente tše 61 9")]
    // CURRENCY — `$` on the shared tier, `R` local and GUARDED against the road designations.
    [InlineData("$450 milione", "ditolara tše milione 450")]
    [InlineData("R6.4 bilione", "diranta tše bilione 6 4")]
    [InlineData("R50,000", "diranta tše 50000")]
    [InlineData("ditsela tše pedi, e lego R37 le R555", "ditsela tše pedi, e lego R37 le R555")]
    [InlineData("£10 million", "£10 million")]   // `diponto` is this wiki's POUND WEIGHT — refuted, not unfound
    // UNITS — measure noun first, cl.10 concord, and the citation form for a one-count or a bare token.
    [InlineData("200 km borwa", "dikhilomithara tše 200 borwa")]
    [InlineData("1200 kg", "dikhilograma tše 1200")]
    [InlineData("50 cm", "senthimetara 50")]     // `disenthimetara` is ×0; the noun stays bare
    [InlineData("60 mm", "dimilimithara tše 60")]
    [InlineData("5.2 m", "dimithara tše 5 2")]
    [InlineData("1 kg", "dikhilograma 1")]
    [InlineData("km", "dikhilomithara")]
    // Rates and the squared compound — which RE-SHAPES its head.
    [InlineData("108 km/h", "dikhilomithara tše 108 ka iri")]
    [InlineData("30 m/s", "dimithara tše 30 ka motsotswana")]
    [InlineData("221,6 km²", "disekwere-khilomithara tše 221 6")]
    [InlineData("361 km2", "disekwere-khilomithara tše 361")]
    // ⚠ AN UNSAYABLE POWER REFUSES THE WHOLE MATCH rather than emitting a length for an area or a volume.
    [InlineData("5 m³", "5 m³")]
    [InlineData("5 cm²", "5 cm²")]
    // ⚠ `802.11m` IS A DESIGNATION, not eleven metres — and the guard needs BOTH halves (trap 52).
    [InlineData("802.11m", "802 1 1m")]
    [InlineData("802.11n", "802 1 1n")]
    // DEGREES — Celsius named, Fahrenheit claimed and left unsaid, and ° may be U+00BA.
    [InlineData("1.2 °C", "1 2 Celsius")]
    [InlineData("1.02º Celsius", "1 0 2 Celsius")] // said once, not twice
    [InlineData("85°F", "85")]
    [InlineData("55°S", "55 borwa")]
    [InlineData("90°", "90")]                     // no degree noun: `dikgato` is this wiki's word for the FOOT
    // RANGES — descending allowed, and every measured decline.
    [InlineData("1901–2012", "1901 go ya go 2012")]
    [InlineData("5–8 senthimetara", "5 go ya go 8 senthimetara")]
    [InlineData("33,500–32,500 BP", "33500 go ya go 32500 BP")]
    [InlineData("1876-77", "1876-77")]            // an ABBREVIATED year span
    [InlineData("ISO 3166-1", "ISO 3166-1")]
    [InlineData("1970 - 1969 - 1968", "1970 - 1969 - 1968")] // a spaced-hyphen year-index chain
    [InlineData("nakong ya 1901–2012.", "nakong ya 1901 go ya go 2012.")]
    [InlineData("magareng ga 1950–2020,", "magareng ga 1950 go ya go 2020,")]
    [InlineData("9.84-9.90", "9 8 4-9 9 0")]
    // SEPARATORS — both characters carry both roles, and only the BLOCK LENGTH tells them apart.
    [InlineData("1,600,000", "1600000")]
    [InlineData("216.061 badudi", "216061 badudi")]
    [InlineData("30 560 860", "30560860")]
    [InlineData("9.84", "9 8 4")]
    [InlineData("221,6", "221 6")]
    [InlineData("(1,2,3,4,5,6)", "(1,2,3,4,5,6)")]  // a LIST, not three decimals
    // Dotted initials lose their sentence breaks WITHOUT fusing into a digraph.
    [InlineData("Verster T.L.", "Verster T-L.")]
    [InlineData("P.H. Nortjé", "P-H Nortjé")]
    [InlineData("3,500 B.C.E. kua Korea", "3500 B-C-E kua Korea")]
    // The ampersand is the manifest's own conjunction, spaced on both sides.
    [InlineData("Mail & Guardian", "Mail le Guardian")]
    [InlineData("R&B", "R le B")]
    // The English ordinal suffix is stripped.
    [InlineData("Ngwagakgolo wa lesome senyane (19th)", "Ngwagakgolo wa lesome senyane (19)")]
    public void TheNormalizer(string input, string want) => Assert.Equal(want, NsoNormalize.NormalizeSepedi(input));

    /** ⚠ THE SEPARATOR BETWEEN A FIGURE AND ITS UNIT KEY IS THE WHOLE `[ \u00a0\u202f\u2009]` CLASS, not
     *  just ASCII space. `core/markup.ts` decodes `&nbsp;` to U+00A0 upstream, so a wiki that writes
     *  `1&nbsp;kg` reaches this layer with a NO-BREAK SPACE.
     *
     *  ⚠ THIS IS A REGRESSION TEST FOR A PORTING BUG THE GOLDEN COULD NOT SEE. The class was first written
     *  as three ASCII spaces, which matches `1 kg` and misses `1\u00a0kg` — 200/200 on the parity gate, and
     *  one line of the corpus differential caught it. The separators are spelled as ESCAPES here on purpose:
     *  a literal NBSP in source is exactly what went wrong. */
    [Theory]
    [InlineData("1\u00a0kg", "dikhilograma 1")]
    [InlineData("200\u00a0km", "dikhilomithara tše 200")]
    [InlineData("30\u202fm", "dimithara tše 30")]
    [InlineData("5\u2009mm", "dimilimithara tše 5")]
    [InlineData("1\u00a0600\u00a0000\u00a0km", "dikhilomithara tše 1600000")]
    public void TheUnitSeparatorIsNotOnlyAnAsciiSpace(string input, string want) =>
        Assert.Equal(want, NsoNormalize.NormalizeSepedi(input));

    /** No digit leak, sentinel or gap anywhere in the composer's dense range. */
    [Fact]
    public void NoLeakAcrossTheDenseRange()
    {
        for (var n = 0; n <= 20000; n++)
        {
            var w = NsoNumbers.NumberToWords(n);
            Assert.False(w.Contains("undefined") || w.Contains("NaN") || w.Any(char.IsAsciiDigit), $"n={n}");
        }
    }
}
