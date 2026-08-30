/**
 * The portable half of test/faroese.test.ts — Faroese (fo), North Germanic (Insular Scandinavian,
 * sibling of Icelandic), one of the deepest orthographies in the fleet. The core rule is that vowel
 * LENGTH conditions vowel QUALITY (open syllable → long/diphthongal, closed → short/monophthong);
 * plus b/d/g→p/t/k, intervocalic ð/g→glide, g/k→t͡ʃ before front vowels, skerping, ng-palatalization.
 * Referee: wikipron fao_latn_broad (human).
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Faroese;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class FaroeseTests
{
    private static string Word(string s) => FaroesePhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "fo").Trim();
    private static string Norm(string s) => Normalize.NormalizeFaroese(s);
    private static string[] Words(string s) => Say(s).Split(' ');

    [Theory]
    // Length-conditioned vowel quality (open→long, closed→short) + b/d/g→p/t/k.
    [InlineData("maður", "mɛaːvʊɹ")]  // open: a→[ɛaː] long; ð→[v] (round u)
    [InlineData("land", "lant")]       // closed: a→[a] short (before cluster); d→[t]
    [InlineData("dagur", "tɛaːvʊɹ")]  // d→[t]; open a→[ɛaː]; intervocalic g→[v] (round u)
    [InlineData("bátur", "pɔɑːtʊɹ")]  // b→[p]; á→[ɔɑː] long
    public void LengthConditionedVowelQuality(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // Intervocalic ⟨g ð⟩ glide by neighbour (front→j, round→v) + front-vowel affrication.
    [InlineData("vegur", "veːvʊɹ")]          // g→[v] (round u wins; e is neutral)
    [InlineData("Eyður", "ɛiːjʊɹ")]          // ð→[j] (the i-offglide of ⟨ey⟩ wins over round u)
    [InlineData("kirkja", "t͡ʃɪɹt͡ʃa")]        // ⟨k⟩→[t͡ʃ] before front ⟨i⟩ and ⟨kj⟩→[t͡ʃ]
    [InlineData("gøta", "køːta")]             // ⟨g⟩ before ⟨ø⟩ is NOT affricated → [k]; ø→[øː] long
    public void IntervocalicGlideAndFrontAffrication(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // The Faroese hallmarks — skerping + ng-palatalization.
    [InlineData("dúgva", "tɪkva")]         // SKERPING: ú→[ɪ] before ⟨gv⟩
    [InlineData("nýggjur", "nʊt͡ʃʊɹ")]      // SKERPING before ⟨ggj⟩: ý drops the offglide → [ʊ]; gg+j→[t͡ʃ]
    [InlineData("gangi", "kɛɲt͡ʃɪ")]        // ng: ⟨n⟩→[ɲ] before the affricate, a→[ɛ]; ⟨g⟩→[t͡ʃ]
    [InlineData("fólk", "fœlk")]           // ó→[œ] short (before cluster)
    [InlineData("hús", "hʉuːs")]           // ú→[ʉuː] long
    public void TheHallmarksSkerpingAndNasalPalatalization(string word, string want) => Assert.Equal(want, Word(word));

    [Fact]
    public void RegistryWiring() => Assert.Equal("lant", Say("land"));

    [Theory]
    // CARDINAL NUMBERS — units-first fused with "og" (einogtjúgu = 21), magnitude groups chained with "og".
    // The modern DECIMAL tens (fimmti/seksti/sjeyti/áttati/níti) over the vigesimal layer, and the NEUTER
    // counting series (eitt, tvey, trý) as the citation form.
    [InlineData(0, "null")]
    [InlineData(3, "trý")]                          // NEUTER counting form (not masc. tríggir)
    [InlineData(21, "einogtjúgu")]                  // unit first, fused; compound "one" is ein-, not eitt-
    [InlineData(55, "fimmogfimmti")]                // decimal fimmti, not vigesimal hálvtrýss
    [InlineData(99, "níggjuogníti")]
    [InlineData(100, "eitt hundrað")]
    [InlineData(555, "fimm hundrað og fimmogfimmti")]
    [InlineData(1000, "eitt túsund")]
    [InlineData(12345, "tólv túsund og trý hundrað og fimmogfýrati")]
    [InlineData(1000000, "ein millión")]
    [InlineData(1000000000, "ein milliard")]
    public void NumbersUnitsFirstOnTheDecimalTens(double n, string want) =>
        Assert.Equal(want, Numbers.NumberToWords(n));

    [Theory]
    // Numbers wired into the phonemizer.
    [InlineData("21", "aiːnɔkt͡ʃʏvʊ")]   // einogtjúgu
    [InlineData("1000", "ait tʉuːsʊnt")] // eitt túsund
    public void NumbersWiredIntoThePhonemizer(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // ⚠ THE FULL STOP DOES FIVE JOBS, and the layer resolves them in order.
    [InlineData("23.59.60", "23 59 60")]                                 // the TIME — two dots, the leap second
    [InlineData("49.267", "49267")]                                      // the THOUSANDS GROUP — exactly three digits follow
    [InlineData("11.738", "11738")]
    [InlineData("3.00 kr", "3,00 kr")]                                   // the DECIMAL — folded onto the comma
    [InlineData("4.19$", "4,19$")]
    [InlineData("1. juli 2011", "1 juli 2011")]                          // the ORDINAL MARKER — a lowercase word follows
    [InlineData("2. og 3. ættarlið", "2 og 3 ættarlið")]
    [InlineData("Tað var 1998. Síðan kom", "Tað var 1998. Síðan kom")]   // ⚠ THE SENTENCE END MUST SURVIVE
    public void TheFullStopDoesFiveJobs(string input, string want) => Assert.Equal(want, Norm(input));

    [Fact]
    public void TheOrdinalWordIsRefusedAndTheFalseBreakIsFixed()
    {
        // The ordinal is a later round with a source; what is fixed now is only the false clause break.
        Assert.Equal(Say("23 apríl"), Say("23. apríl"));
        Assert.DoesNotContain(".", Say("1. juli"));
    }

    [Theory]
    // The abbreviations, every expansion the corpus's own.
    [InlineData("57°71° n.br.", "57 stig 71 stig norðurbreidd.")]
    [InlineData("4000 f.Kr.", "4000 fyri Kristus.")]
    [InlineData("kl. 3 e.m.", "klokkan 3 eftir middag.")]
    [InlineData("2,5 mió. kr.", "2,5 milliónir kr.")]
    public void TheAbbreviationsAreTheCorpusOwn(string input, string want) => Assert.Equal(want, Norm(input));

    [Fact]
    public void TheColonIsNotAClockHere()
    {
        // `9:59.91` is minutes:seconds.hundredths — a national swimming record.
        Assert.Equal("9:59,91", Norm("9:59.91"));
    }

    [Theory]
    // Degrees, the decimal comma and the percent.
    [InlineData("56,7 °C", "sɛksɔkfɪmtɪ kɔma ʃɛiː stiːk kɛlsɪʊs")]
    [InlineData("79 %", "nʊt͡ʃʊɔkʃɛitɪ pɹoːsɛnt")]
    public void TheDegreesTheDecimalCommaAndThePercent(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // The range's pause — ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER.
    [InlineData("1269–1308", "1269, 1308")]
    [InlineData("s. 96-100.", "s. 96, 100.")]
    public void TheRangesPause(string input, string want) => Assert.Equal(want, Norm(input));

    [Fact]
    // #1080 — the bignum fallback used to re-read the float it exists to bypass. 9007199254740993 is
    // 2^53+1; as a double it IS 2^53, so re-stringifying reads …992.
    public void ANumeralPastTwoToTheFiftyThreeReadsTheTypedDigits() =>
        Assert.Equal("tɹʊiː", Words("9007199254740993")[^1]);

    [Fact]
    // …and above 1e21, where String(n) is exponent form, every digit is still read.
    public void AboveOneETwentyOneEveryDigitIsStillRead() =>
        Assert.Equal(22, Words("1000000000000000000000").Length);
}
