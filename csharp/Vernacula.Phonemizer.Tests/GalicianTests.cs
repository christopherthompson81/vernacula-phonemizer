/**
 * The portable half of test/galician.test.ts — Galician (gl), Ibero-Romance (sister of Portuguese), a
 * shallow near-phonemic orthography on the Spanish-shaped engine. The Galician deltas: ⟨x⟩/⟨j⟩→ʃ,
 * ⟨g⟩→ɡ (no Castilian jota), ⟨nh⟩→ŋ, coda/pre-velar ⟨n⟩→ŋ, and the standard RAG distinción.
 * Referee: wikipron glg_latn_broad (human).
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Galician;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class GalicianTests
{
    private static string Word(string s) => GalicianPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "gl").Trim();
    private static string Norm(string s) => Normalize.NormalizeGalician(s);

    [Theory]
    // ⟨x⟩ = ʃ — the Galician signature (Spanish's ks/jota is gone).
    [InlineData("peixe", "pˈeᶦʃe")]    // x=ʃ, ei diphthong
    [InlineData("xente", "ʃˈente")]    // word-initial x=ʃ
    [InlineData("caixa", "kˈaᶦʃa")]
    [InlineData("baixo", "bˈaᶦʃo")]
    public void XIsTheGalicianSignature(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // ⟨g⟩ is always the velar stop (no jota); intervocalic → spirant ɣ.
    [InlineData("galego", "ɡalˈeɣo")]  // initial ɡ, intervocalic ɣ
    [InlineData("xénero", "ʃˈeneɾo")]  // x=ʃ + é stress
    public void GIsAlwaysTheVelarStop(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // ⟨nh⟩ → ŋ and nasal velarization (coda / pre-velar ⟨n⟩ → ŋ).
    [InlineData("unha", "ˈuŋa")]     // ⟨nh⟩ = velar nasal
    [InlineData("cinco", "θˈiŋko")]  // ⟨n⟩ before velar → ŋ, ⟨c⟩ before i → θ
    [InlineData("un", "ˈuŋ")]        // word-final ⟨n⟩ → ŋ
    public void NhAndNasalVelarization(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // The shared Ibero phonemes: ⟨ll⟩=ʎ, ⟨ñ⟩=ɲ, ⟨ch⟩=t͡ʃ, ⟨z/c⟩=θ, ⟨v⟩→b spirantized β.
    [InlineData("carballo", "kaɾβˈaʎo")]
    [InlineData("ollo", "ˈoʎo")]
    [InlineData("mañá", "maɲˈa")]
    [InlineData("chave", "t͡ʃˈaβe")]
    public void TheSharedIberoPhonemes(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // ⟨h⟩ silent, ⟨ou/au⟩ offglides; a falling-diphthong ending is oxytone.
    [InlineData("home", "ˈome")]        // ⟨h⟩ silent
    [InlineData("auga", "ˈaᶷɣa")]       // ⟨au⟩ offglide, intervocalic ɣ
    [InlineData("dous", "dˈoᶷs")]       // ⟨ou⟩ offglide
    [InlineData("cantou", "kantˈoᶷ")]   // -ou preterite is OXYTONE (glide-final, not penult)
    [InlineData("amei", "amˈeᶦ")]       // -ei preterite oxytone
    public void OffglidesAndOxytoneFallingEndings(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // An accented weak vowel breaks a diphthong into HIATUS, but a following weak stays an offglide.
    [InlineData("muíño", "muˈiɲo")]  // ⟨uí⟩ hiatus: u is its own nucleus
    [InlineData("ruído", "ruˈiðo")]
    [InlineData("viúva", "biˈuβa")]  // ⟨iú⟩ hiatus, ⟨v⟩→β
    [InlineData("saíu", "saˈiᶷ")]    // ⟨íu⟩ FOLLOWING weak stays a falling-diphthong offglide
    public void AccentedWeakBreaksADiphthongIntoHiatus(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // The -ns plural cluster velarizes; ⟨x⟩ before a consonant is [ks].
    [InlineData("cans", "kˈaŋs")]           // word-final -ns → ŋs
    [InlineData("cancións", "kanθjˈoŋs")]   // internal n stays, final -ns velarizes
    [InlineData("texto", "tˈeksto")]        // ⟨x⟩ before a consonant → [ks]
    public void NsVelarizesAndXBeforeAConsonantIsKs(string word, string want) => Assert.Equal(want, Word(word));

    [Fact]
    public void RegistryWiring() => Assert.Equal("bˈo ðˈia , ɡalˈiθja !", Say("Bo día, Galicia!"));

    [Theory]
    // CARDINALS — tens juxtapose with the connector "e" (vinte e un); long scale.
    [InlineData(0, "cero")]
    [InlineData(1, "un")]
    [InlineData(100, "cen")]
    [InlineData(101, "cento un")]
    [InlineData(275, "douscentos setenta e cinco")]
    [InlineData(1200, "mil douscentos")]
    [InlineData(3000000, "tres millóns")]
    [InlineData(2000000000, "dous mil millóns")]   // 10⁹ = dous mil millóns (long scale)
    public void CardinalsWithTheEConnector(double n, string want) =>
        Assert.Equal(want, Numbers.NumberToWords(n));

    [Theory]
    // Numbers wired into the phonemizer (⟨v⟩→b, final n→ŋ).
    [InlineData("21", "bˈinte e uŋ")]
    [InlineData("35", "tɾˈinta e θˈiŋko")]
    [InlineData("100", "θˈeŋ")]
    [InlineData("1200", "mˈil doᶷsθˈentos")]
    [InlineData("3000000", "tɾˈes miʎˈoŋs")]       // -ns velarized
    [InlineData("2000000000", "dˈoᶷs mˈil miʎˈoŋs")]
    public void NumbersWiredIntoThePhonemizer(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // Ordinal words: the irregular table, the composed tens, and the bound.
    [InlineData(1, "primeiro")]
    [InlineData(9, "noveno")]
    [InlineData(10, "décimo")]             // the tens table's own first entry
    [InlineData(28, "vixésimo oitavo")]    // composed — the corpus's "o 28º do mundo"
    [InlineData(90, "nonaxésimo")]         // the last attested tens word
    [InlineData(100, "centésimo")]
    public void TheOrdinalTableAndItsBound(double n, string want) => Assert.Equal(want, Normalize.GalicianOrdinal(n));

    [Theory]
    // The table stops where the attestation stops.
    [InlineData(101)]
    [InlineData(0)]
    [InlineData(101.5)]
    public void TheOrdinalTableRefusesOutOfRange(double n) => Assert.Null(Normalize.GalicianOrdinal(n));

    [Theory]
    // Ordinal INDICATORS: º masculine, ª feminine (EVERY element agrees), the dotted form, and the >100 strip.
    [InlineData("1º", "primeiro")]
    [InlineData("2ª", "segunda")]
    [InlineData("21ª", "vixésima primeira")]
    [InlineData("a 4.ª vez", "a cuarta vez")]            // the DOTTED indicator
    [InlineData("o 1.000º", "o 1.000")]                 // the digit run SPANS the grouping dot
    [InlineData("entre 400º e 1300º", "entre 400 e 1300")] // ABOVE 100 THE INDICATOR IS STRIPPED
    public void OrdinalIndicators(string input, string want) => Assert.Equal(want, Norm(input));

    [Fact]
    public void OrdinalWiredIntoThePhonemizer() => Assert.Equal("pɾimˈeᶦɾo", Say("1º"));

    [Theory]
    // Era markers — the artifact glosses its own a.C. — and número before a digit only.
    [InlineData("1200 a. C.", "1200 antes de Cristo")]
    [InlineData("534 a.C. e", "534 antes de Cristo e")]
    [InlineData("2000 d.C.", "2000 despois de Cristo")]  // despois, NOT the pt depois
    [InlineData("a. e. c.", "antes da Era común")]
    [InlineData("n.º 5", "número 5")]
    [InlineData("no 5 de maio", "no 5 de maio")]         // bare `no` is the en+o contraction, not a number sign
    public void EraMarkersAndNumero(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // The dotted abbreviation — mid-sentence the dot is consumed, at a phrase end it is kept.
    [InlineData("Dr. Silva", "doutor Silva")]
    [InlineData("etc.", "etcétera.")]
    // ⚠ THE FOLDED NEAR-MISS (#1122): the pattern is built from the table's own keys under `i`+`u`, and
    // JS's fold widens `s` onto the long s, so `ſr.` matches the `sr` arm while its key is absent.
    // Declined as a whole, not stringified as "undefined".
    [InlineData("ſr. Silva", "ſr. Silva")]
    [InlineData("ſra. Pardo", "ſra. Pardo")]
    public void DottedAbbreviationsAndTheFoldedMiss(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // Percent, currency and the unit tier — each word attested on gl.wikipedia.
    [InlineData("35 %", "tɾˈinta e θˈiŋko poɾ θˈento")]
    [InlineData("100 €", "θˈeŋ ˈeᶷɾos")]
    [InlineData("US$ 500", "θiŋkoθˈentos ðˈolaɾes")]  // the code folds to the sign
    [InlineData("R$ 30", "tɾˈinta rˈeaᶦs")]
    [InlineData("12,5 km", "dˈoθe kˈoma θˈiŋko kilˈometɾos")]
    [InlineData("120 km/h", "θˈento βˈinte kilˈometɾos poɾ ˈoɾa")]
    // ⚠ THE MAGNITUDE MUST END AT A WORD BOUNDARY: `millóns` = `millón` + `s`, and `s` is the declared
    // seconds unit, so the tier backtracked and read the plural marker as the unit.
    [InlineData("5 millóns de euros", "θˈiŋko miʎˈoŋs ðe ˈeᶷɾos")]
    [InlineData("1 millón de km²", "uŋ miʎˈoŋ de kilˈometɾos kaðɾˈaðos")]
    public void PercentCurrencyAndTheUnitTier(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // Degrees, and the exponent that has a word against the two that do not.
    [InlineData("0 °C", "0 graos Celsius")]
    [InlineData("104,45°", "104,45 graos")]
    [InlineData("-5°C a 600 atm", "menos 5 graos Celsius a 600 atm")]
    public void Degrees(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    [InlineData("10 km²", "dˈeθ kilˈometɾos kaðɾˈaðos")]
    [InlineData("5²", "θˈiŋko ao kaðɾˈaðo")]   // the BARE power, sourced ×13
    public void ExponentsWiredIntoThePhonemizer(string input, string want) => Assert.Equal(want, Say(input));

    [Fact]
    // `ao cubo` scores 0 and `elevado a` is a false attestation, so those powers stay UNREAD rather than
    // invented — the superscript survives where the RAWMARK gate can see it.
    public void UndeclaredPowersStayUnread() => Assert.Equal("10⁻³", Norm("10⁻³"));

    [Theory]
    // Clock, and the three-field timestamp that is not one.
    [InlineData("ás 11:35", "ás once e trinta e cinco")]
    [InlineData("ás 06:00", "ás seis")]       // a round hour reads no spurious "cero"
    [InlineData("ás 11:12:01 do martes", "ás 11 12 01 do martes")]
    [InlineData("(00:36:59)", "(00 36 59)")]
    public void ClockAndTimestamps(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // Signs — every reading named by a gl.wikipedia article, not carried over from Portuguese.
    [InlineData("3 > 0", "3 maior que 0")]
    [InlineData("2 < 5", "2 menor que 5")]
    [InlineData("a = b", "a igual a b")]
    // ⚠ `dividido POR` — NOT the ×19-hit `dividido entre`, which is "divided between".
    [InlineData("8593 ÷ 23", "8593 dividido por 23")]
    [InlineData("UTC +1", "u te ce máis 1")]   // the initialism pass spells the run too
    public void Signs(string input, string want) => Assert.Equal(want, Norm(input));

    [Fact]
    // ± is a single character (U+00B1), so no `+` rule can ever match inside it — the padded reading
    // opens the string, and the TS suite trims it.
    public void PlusMinusAtTheStart() => Assert.Equal("máis menos 2", Norm("±2").Trim());

    [Theory]
    [InlineData("5 × 3", "θˈiŋko multiplikˈaðo poɾ tɾˈes")]   // a product
    [InlineData("4x4", "kˈatɾo poɾ kˈatɾo")]                  // the unspaced dimension idiom
    [InlineData("Thames & Hudson", "tˈames e ˈuðsoŋ")]
    public void MultiplyAndAmpersand(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // Fractions: the noun branch, the ordinal branch, and the bound that is not a fraction.
    [InlineData("1/2", "medio")]
    [InlineData("1/3", "un terzo")]      // the other noun — the ordinal would give *un terceiro*
    [InlineData("2/3", "dous terzos")]
    [InlineData("3/4", "tres cuartos")]  // ordinal branch, pluralised
    [InlineData("8/9", "oito novenos")]
    [InlineData("1/12", "un décimo segundo")]
    [InlineData("MARPOL 73/78", "MARPOL 73/78")]   // NOT a fraction — the ≤12 denominator bound
    [InlineData("1994/1995", "1994/1995")]
    public void FractionsAndTheirBound(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // Ranges read `a`, and the rule must survive a full stop (trap 58).
    [InlineData("de 1996-1998", "de 1996 a 1998")]
    [InlineData("100–200 metros", "100 a 200 metros")]
    [InlineData("entre 1824–1843.", "entre 1824 a 1843.")]  // CLAUSE-FINAL
    public void RangesReadA(string input, string want) => Assert.Equal(want, Norm(input));

    [Fact]
    public void RangesWiredIntoThePhonemizer() =>
        Assert.Equal("de mˈil noβeθˈentos noβˈenta e sˈeᶦs a mˈil noβeθˈentos noβˈenta e ˈoᶦto", Say("de 1996-1998"));

    [Theory]
    // THE DOT DECIMAL was not merely unread, it was read WRONG — and grouping still is not.
    [InlineData("48.26 km", "48 coma 26 km")]
    [InlineData("(11.1%)", "(11 coma 1%)")]
    [InlineData("4.2-3.9", "4 coma 2 a 3 coma 9")]  // decimals BEFORE the range rule
    [InlineData("460.000 km", "460.000 km")]        // exactly three fraction digits is a thousands group
    [InlineData("106.460.000 km²", "106.460.000 km²")]
    public void DotDecimalsAgainstThousandsGroups(string input, string want) => Assert.Equal(want, Norm(input));

    [Fact]
    public void ThreeDigitsAreThousands() => Assert.Equal("mˈil θiŋkoθˈentos peɾsˈoas", Say("1.500 persoas"));

    [Fact]
    public void SiSpaceDeGrouping() =>
        Assert.Contains("mˈetɾos poɾ seɣˈundo", Say("299 792 458 m/s"));

    [Theory]
    // Initialisms are spelled; a Roman century stays a CARDINAL.
    [InlineData("EEUU", "e e ˈu ˈu")]
    [InlineData("ONU", "ˈonu")]   // read as a word, not spelled
    public void Initialisms(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // ⚠ THROUGH `phonemize`, NOT THE RAW ENGINE — the shared core/roman.ts pass lives in the registry
    // wrapping the engine, so a test on the bare engine does not exercise it.
    [InlineData("século XV", "sˈekulo kˈinθe")]
    [InlineData("século XIX", "sˈekulo ðeθanˈoβe")]   // a century is a CARDINAL
    public void RomanCenturiesAreCardinals(string input, string want) => Assert.Equal(want, Say(input));
}
