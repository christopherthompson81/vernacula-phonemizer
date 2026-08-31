/**
 * The portable half of test/scottishgaelic.test.ts — Scottish Gaelic / Gàidhlig (gd), Goidelic Celtic
 * (sibling of Irish). The core is the BROAD/SLENDER axis (velarized/dental next to a/o/u, palatalized
 * next to e/i) + the Scottish hallmarks: PRE-ASPIRATION (medial ⟨p t c⟩→[hp ht̪ xk]) and lenis ⟨b d g⟩→[p t̪ k].
 * Referee: symbol vs the MULTI-DIALECT wikipron gla_latn_broad (human).
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.ScottishGaelic;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class ScottishGaelicTests
{
    private static string Word(string s) => ScottishGaelicPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "gd").Trim();
    private static string Norm(string s) => Normalize.NormalizeScottishGaelic(s);

    [Theory]
    // PRE-ASPIRATION: medial/final ⟨p t c⟩ → [hp ht̪ xk].
    [InlineData("mac", "mˈaxk")]       // medial ⟨c⟩ pre-aspirates to [xk] (the SG signature)
    [InlineData("cat", "kʰˈaht̪")]     // initial ⟨c⟩→[kʰ] aspirated; final ⟨t⟩→[ht̪] pre-aspirated
    [InlineData("cù", "kʰˈuː")]       // initial fortis ⟨c⟩→[kʰ]; ù→[uː]
    [InlineData("bochd", "pˈɔxk")]    // ⟨chd⟩ → [xk] (the -achd class)
    [InlineData("annta", "ˈan̪ˠt̪ə")]  // NO pre-aspiration after a nasal (the fortis stays plain)
    public void PreAspiration(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // broad/slender axis + lenis ⟨b d g⟩→[p t̪ k] + lenition.
    [InlineData("geal", "kʲˈɛl̪ˠ")]    // slender ⟨g⟩→[kʲ] (lenis); broad ⟨l⟩→[l̪ˠ]
    [InlineData("balach", "pˈal̪ˠəx")] // lenis ⟨b⟩→[p]; ⟨ch⟩→[x]; unstressed a→[ə]
    [InlineData("sgoil", "s̪kˈɔlʲ")]   // broad ⟨s⟩→[s̪], ⟨g⟩→[k]; slender ⟨l⟩→[lʲ]
    [InlineData("uisge", "ˈuʃkʲə")]   // slender ⟨s⟩→[ʃ], ⟨g⟩→[kʲ]
    public void BroadSlenderAxisAndLenis(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // vowels + lenition ⟨ch th⟩.
    [InlineData("mòr", "mˈɔːrˠ")]  // ò→[ɔː]; broad ⟨r⟩→[rˠ]
    [InlineData("each", "ˈɛx")]    // ⟨ea⟩→[ɛ]; ⟨ch⟩→[x]
    [InlineData("math", "mˈah")]   // ⟨th⟩→[h]
    public void VowelsAndLenition(string word, string want) => Assert.Equal(want, Word(word));

    [Fact]
    // registry wiring.
    public void RegistryWiring() => Assert.Equal("mˈaxk", Say("mac"));

    [Theory]
    // CARDINAL NUMBERS — the Goidelic shape mirrors Irish (two numeral series, the ⟨a⟩ particle, h- before
    // a vowel, ⟨deug⟩ lenited after dhà) but Gaelic mutation is LENITION ONLY: ⟨dà⟩ lenites the magnitude
    // it counts (dà cheud) and 3–10 leave it BARE (naoi ceud), where Irish would eclipse (naoi gcéad).
    [InlineData(0, "neoni")]                            // bare zero takes no ⟨a⟩ particle
    [InlineData(1, "a h-aon")]                          // h- before the vowel-initial counting form
    [InlineData(2, "a dhà")]                            // the counting form is itself lenited (attributive: dà)
    [InlineData(8, "a h-ochd")]
    [InlineData(11, "a h-aon deug")]
    [InlineData(12, "a dhà dheug")]                     // ⟨deug⟩ lenites after dhà ONLY
    [InlineData(13, "a trì deug")]
    [InlineData(20, "fichead")]
    [InlineData(21, "fichead agus a h-aon")]            // the tens↔units connector (written ⟨'s⟩, emitted as ⟨agus⟩)
    [InlineData(25, "fichead agus a còig")]
    [InlineData(40, "ceathrad")]                        // DECIMAL 40, not the vigesimal ⟨dà fhichead⟩
    [InlineData(42, "ceathrad agus a dhà")]
    [InlineData(99, "naochad agus a naoi")]
    [InlineData(100, "ceud")]                           // bare magnitude — no ⟨aon⟩
    [InlineData(101, "ceud agus a h-aon")]
    [InlineData(200, "dà cheud")]                       // ⟨dà⟩ LENITES: ceud → cheud
    [InlineData(300, "trì ceud")]                       // 3–10 leave the magnitude BARE
    [InlineData(900, "naoi ceud")]                      // NO ECLIPSIS (Irish: naoi gcéad) — the gd/ga divergence
    [InlineData(1000, "mìle")]
    [InlineData(2000, "dà mhìle")]                      // mìle → mhìle after dà
    [InlineData(1009, "mìle agus a naoi")]              // connector before a bare counting remainder
    [InlineData(1998, "mìle naoi ceud naochad agus a h-ochd")]
    [InlineData(1000000, "muillean")]
    [InlineData(1000000000, "billean")]
    public void CardinalNumbers(int n, string want) => Assert.Equal(want, Numbers.NumberToWords(n));

    [Fact]
    // no digit leak, sentinel or gap across 0..20000.
    public void NoDigitLeakSentinelOrGap()
    {
        for (var n = 0; n <= 20000; n++)
            Assert.DoesNotMatch("undefined|NaN|[0-9]", Numbers.NumberToWords(n));
    }

    [Theory]
    // end-to-end: the numeral is phonemized, not spelled out digit-wise.
    [InlineData("21", "fˈiçət̪ ˈakəs̪ ˈa hˈɯːn̪ˠ")]  // fichead agus a h-aon
    [InlineData("40", "kʲʰˈɛhrˠət̪")]              // ceathrad — the DECIMAL forty
    [InlineData("2000", "t̪ˈaː vˈiːlʲə")]           // dà mhìle — the lenited magnitude
    public void NumeralIsPhonemizedNotSpelledOut(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // the separator convention is the ENGLISH one — comma groups, dot decimates.
    [InlineData("6,000 duine", "6000 duine")]
    [InlineData("9,984,670 km²", "9984670 km²")]
    [InlineData("130,161", "130161")]
    [InlineData("12.5 km", "12 puing 5 km")]
    [InlineData("0.94%", "0 puing 9 4%")]
    // …and the THREE-DIGIT test is applied to BOTH marks, because the corpus also writes `32.976.026`.
    [InlineData("32.976.026", "32976026")]
    public void SeparatorConventionIsEnglish(string input, string want) => Assert.Equal(want, Norm(input));

    [Fact]
    public void GroupedThousandsArePhonemized() =>
        Assert.Equal("ʃˈiə mˈiːlʲə t̪ˈuɲə", Say("6,000 duine")); // sia mìle duine

    [Theory]
    // the ordinal SPLITS AROUND ITS NOUN — the circumfix that defines this language.
    [InlineData("19mh linn", "naoidheamh linn deug")]
    [InlineData("an 18mh linn", "an ochdamh linn deug")]
    [InlineData("an 12na linn", "an dàrna linn deug")]
    [InlineData("an 11mh linn", "an aonamh linn deug")]
    // Below 11 there is no circumfix at all…
    [InlineData("6mh linn", "siathamh linn")]
    [InlineData("1d", "chiad")]
    [InlineData("2na", "dàrna")]
    [InlineData("3s", "treas")]
    // …and with no noun to reach across, `deug` goes straight after the head.
    [InlineData("an 19mh", "an naoidheamh deug")]
    // ⚠ THE NOUN IS RE-EMITTED VERBATIM (trap 10): it carries lenition the writer already applied.
    [InlineData("14mh cheann-suidhe", "ceathramh cheann-suidhe deug")]
    // ⚠ THE SUFFIX MUST BE GLUED. Allowing a space made `3 s` — three seconds — read as *treas*,
    // because that ordinal does end in ⟨s⟩.
    [InlineData("3 s", "3 s")]
    [InlineData("1990s", "1990")] // the decade, not an ordinal
    public void OrdinalSplitsAroundItsNoun(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // NO range rule, and that is the finding — the gd ranges are ISO dates in BBC citations, ISBNs and
    // football scores; not one is a measurement span. The minus IS claimed, but only after a non-digit.
    [InlineData("BBC Naidheachdan 2016-12-31", "BBC Naidheachdan 2016-12-31")]
    [InlineData("ISBN 3-89940-263-4", "ISBN 3-89940-263-4")]
    [InlineData("6-0", "6-0")]
    [InlineData("{ ..., -3, -2 }", "{ ..., minus 3, minus 2 }")]
    [InlineData("1805 -1869", "1805 -1869")]
    public void NoRangeRuleAndMinusOnlyAfterANonDigit(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // percent, currency, units and the exponent that follows its noun.
    [InlineData("70 %", "ʃˈɛxkət̪ s̪ˈa çˈiaːt̪")]  // seachdad sa cheud
    [InlineData("£20", "fˈiçət̪ n̪ˠˈɔht̪")]        // fichead not — the £ article names the sign
    // ⚠ GAELIC HAS NO NUMBER AGREEMENT on a counted noun: it stays singular after any numeral.
    [InlineData("100 kg", "kʲʰˈiaːt̪ kʲʰˈilʲəkrˠəm")]
    // The measure adjective goes AFTER the noun — the corpus glosses its own abbreviation:
    // "an fharsaingeachd de 551,695 cilemeatair ceàrnagach (km²)".
    [InlineData("5 km²", "ˈa kʰˈɔːəkʲ kʲʰˈilʲəməht̪əɾʲ kʲʰˈeaːrˠn̪ˠəkəx")]
    public void PercentCurrencyUnitsAndExponent(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    public void GluedUnitIsLeftToTheTier() =>
        Assert.Equal("176km", Norm("176km")); // glued; the tier claims it downstream

    [Fact]
    // Both halves of the rate are sourced with the notation glossed beside them: "deich air fhichead
    // mile 'san uair", and "aonadan de meatairean anns an diog (m/s)".
    public void RateDenominators()
    {
        Assert.Contains("s̪ˈan̪ˠ ˈuəəɾʲ", Say("320 km/h"));
        Assert.Contains("s̪ˈan̪ˠ tʲˈik", Say("10 m/s"));
    }

    [Theory]
    // abbreviations, and the four classes refused on a measurement.
    [InlineData("srl.", "agus mar sin air adhart.")]
    [InlineData("no. 5", "àireamh 5")]
    // ⚠ DEGREES ARE UNREAD ON PURPOSE. `ceum` is the Gaelic word and all 43 of its attestations are
    // the ACADEMIC degree; `ceum Celsius` and `ìre Celsius` both score 0.
    [InlineData("20 °C", "20 °C")]
    // ⚠ AND SO ARE `×` AND `=`: `uiread` is "quantity", never "times", and every `=` in this corpus is
    // a wiki heading marker or raw LaTeX.
    [InlineData("7 × 14", "7 × 14")]
    [InlineData("== Hallstatt ==", "== Hallstatt ==")]
    public void AbbreviationsAndRefusedClasses(string input, string want) => Assert.Equal(want, Norm(input));

    [Fact]
    public void AmpersandIsTheLanguagesOwnAnd() =>
        Assert.Equal("rˠˈɔs̪ ˈakəs̪ hˈeɲt̪rˠy", Say("Ross & Hendry"));
}
