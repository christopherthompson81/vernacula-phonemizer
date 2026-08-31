/**
 * Mooré / Mossi (mos) — Niger-Congo GUR (Oti-Volta), the Latin (Burkinabé) orthography, canonical IPA,
 * the largest language of Burkina Faso. Signatures: dedicated ATR letters ⟨ɛ ɩ ʋ⟩, ⟨o⟩=o always
 * (no ⟨ɔ⟩), DOUBLING = length, TILDE = nasal, ⟨r⟩=ɾ, ⟨y⟩=j. TONE (2-tone H/L) is not written in the
 * orthography → not emitted; numbers are composed in Numbers.cs (decimal, short-stem compounds).
 *
 * The portable half of test/mossi.test.ts. Every expected value is the TypeScript engine's own output.
 * The normalize cases pin both the rewrites and the REFUSALS (decimals, comma lists, DOIs, version
 * dots, the unsourceable £, the squared exponent) — worth as much as the rewrites.
 */
using Vernacula.Phonemizer;
using MoEngine = Vernacula.Phonemizer.Languages.Mossi.MossiPhonemizer;
using MoNormalize = Vernacula.Phonemizer.Languages.Mossi.Normalize;
using MoNumbers = Vernacula.Phonemizer.Languages.Mossi.Numbers;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class MossiTests
{
    private static string Word(string s) => MoEngine.PhonemizeWord(s);
    private static string Norm(string s) => MoNormalize.NormalizeMossi(s);
    private static string Text(string s) => MoEngine.CreateMossi().Text(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "mos").Trim();

    [Theory]
    [InlineData("lakrɛ", "lakɾɛ")]   // ⟨ɛ⟩ → ɛ
    [InlineData("malɛka", "malɛka")] // "angel" — ⟨ɛ⟩ → ɛ
    [InlineData("fɩnetre", "fɪnetɾe")] // ⟨ɩ⟩ → ɪ
    [InlineData("boko", "boko")]     // ⟨o⟩ → o (not ɔ)
    [InlineData("laloa", "laloa")]   // /ɔ/ is written as the hiatus ⟨oa⟩, not a letter
    public void TheDedicatedAtrLetters(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    [InlineData("baare", "baːɾe")]        // ⟨aa⟩ → aː
    [InlineData("lɛɛre", "lɛːɾe")]        // ⟨ɛɛ⟩ → ɛː
    [InlineData("weefo", "weːfo")]        // ⟨ee⟩ → eː
    [InlineData("fulfuugu", "fulfuːɡu")]  // ⟨uu⟩ → uː
    [InlineData("faktɩʋʋre", "faktɪʊːɾe")] // ⟨ʋʋ⟩ → ʊː (long ʊ)
    public void DoublingIsLength(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    [InlineData("burkĩna", "buɾkĩna")] // ⟨ĩ⟩ → ĩ (nasal i)
    [InlineData("rõde", "ɾõde")]       // ⟨õ⟩ → õ
    [InlineData("esãase", "esãːse")]   // ⟨ãa⟩ → ãː (nasal long a)
    public void NasalIsTilde(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    [InlineData("zirga", "ziɾɡa")] // ⟨r⟩ → ɾ, ⟨g⟩ → ɡ
    [InlineData("lay", "laj")]     // ⟨y⟩ → j
    [InlineData("yelle", "jelːe")] // ⟨y⟩ → j, ⟨ll⟩ → lː (geminate)
    public void TheTapTheGlideAndGemination(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    [InlineData("tenga", "teŋɡa")] // "village" — ⟨ng⟩ → ŋɡ (FSI tengá→teŋɡa)
    [InlineData("sh", "ʃ")]        // ⟨sh⟩ → ʃ (FSI /s/ allophone spelling)
    public void NasalPlaceAssimilationBeforeVelars(string word, string want) => Assert.Equal(want, Word(word));

    [Fact]
    public void TextWordsClausePunctuationToneDeferred() =>
        Assert.Equal("buɾkĩna faso . jelːe ?", Text("Burkĩna Faso. Yelle?"));

    /**
     * NUMBERS — DECIMAL. Mooré 6–9 (yoobe, yopoe, nii, wɛ) are opaque stems with no living 5+n
     * formation, so there is nothing quinary to compose; the sources call the system flatly
     * décimal. Bespoke because of two Gur features: each unit has a full and a SHORT combining stem
     * (yembre ~ ye, yiibu ~ yi, tãabo ~ tã), and a bare unit inside a compound needs the numeral
     * particle a (piig la a ye 11) while a tens phrase takes la alone. Tens/hundreds/thousands are
     * the noun-class plurals piiga→pisi/pis, koabga→kobs, tusri→tus.
     */
    [Theory]
    [InlineData(0, "zaalem")]
    [InlineData(7, "yopoe")]
    [InlineData(10, "piiga")]
    [InlineData(11, "piig la a ye")]   // combining piig + la + particle a + SHORT stem
    [InlineData(20, "pisi")]           // the plural of piiga
    [InlineData(21, "pisi la a ye")]
    [InlineData(42, "pis naase la a yi")]
    [InlineData(99, "pis wɛ la a wɛ")]
    public void TheUnitsTeensAndTens(double n, string want) => Assert.Equal(want, MoNumbers.NumberToWords(n));

    [Theory]
    [InlineData(100, "koabga")]   // singular; 200 takes the plural stem kobs
    [InlineData(101, "koabga la a ye")]
    [InlineData(555, "kobs a nu la pis nu la a nu")]
    [InlineData(1000, "tusri")]
    [InlineData(12345, "tus piig la a yi la kobs a tã la pis naase la a nu")]
    public void TheHundredsAndThousands(double n, string want) => Assert.Equal(want, MoNumbers.NumberToWords(n));

    // ⚠ THIS GOLDEN CHANGED. It used to assert that 10⁶ read digit-by-digit, on the stated ground
    // that no Mooré numeral above tusri was attested in any source consulted. The mos.wikipedia dump,
    // filtered to Mooré paragraphs, refutes that: `milyõ` ×219 and `milyaar` ×51 are ordinary running
    // vocabulary, and the corpus supplies the syntax too. Neither word alternates for number, so
    // 1 million is `milyõ a ye` and not a bare singular. Pinned per BRANCH rather than per corpus
    // instance: the under-ten particle branch, the ten-and-above composed branch, the remainder join,
    // and the boundary above which nothing is attested.
    [Theory]
    [InlineData(1_000_000, "milyõ a ye")]             // no bare singular — the particle is obligatory
    [InlineData(7_000_000, "milyõ a yopoe")]          // corpus: `ligd milyõ a yopoe`
    [InlineData(37_000_000, "milyõ pis tã la a yopoe")] // ≥10 multiplier → composed figure
    [InlineData(1_000_000_000, "milyaar a ye")]
    [InlineData(1_001_000_000, "milyaar a ye la milyõ a ye")] // both scales in one figure
    [InlineData(19_811_000, "milyõ piig la a wɛ la tus kobs a nii la piig la a ye")]
    public void TheMillionAndBillionLoans(double n, string want) => Assert.Equal(want, MoNumbers.NumberToWords(n));

    [Fact]
    public void AboveTheAttestedMagnitudesItIsDigitByDigit() =>
        // Nothing above milyaar is attested, so 10¹² still reads its digits rather than inventing a word.
        Assert.Equal("yembre zaalem zaalem zaalem zaalem zaalem zaalem zaalem zaalem zaalem zaalem zaalem zaalem",
            MoNumbers.NumberToWords(1e12));

    [Fact]
    public void NumbersEndToEndThroughTheG2p()
    {
        Assert.Equal("pisi", Text("20"));
        Assert.Equal("tusɾi", Text("1000")); // ⟨r⟩ → the tap ɾ
    }

    // TEXT NORMALIZATION. The pass asserted at its own layer as well as through the phonemizer: this is
    // pure text→text, so the rewrite is readable on its own and a failure here localises to the rule
    // rather than to the g2p.
    [Fact]
    public void NormalizeIsAPureTextToTextRewrite()
    {
        Assert.Equal("vote 21552 tɩ", Norm("vote 21,552 tɩ"));
        Assert.Equal("koees 15043", Norm("koees 15.043"));
        Assert.Equal("doolaar 100000", Norm("doolaar 100 000"));
        Assert.Equal("Ero 10000 la doolaar 5", Norm("€10,000 la $5"));
        Assert.Equal("29.6 la 53,6", Norm("29.6 la 53,6")); // decimals: untouched, no word to use
        Assert.Equal("£50000", Norm("£50,000"));           // de-grouped; the unsourceable sign left alone
    }

    // The layer's largest fix, and the only one needing no vocabulary at all: a grouping separator was
    // being read as CLAUSE PUNCTUATION, dropping a pause into the middle of one figure. The role is
    // decided by the DIGIT COUNT after the mark — 3 is a group, 1–2 is a decimal.
    [Theory]
    [InlineData("vote 21,552", "vote tus pisi la a je la kobs a nu la pis nu la a ji")]
    [InlineData("koees 15.043", "koeːs tus piːɡ la a nu la pis naːse la a tã")]
    [InlineData("doolaar 100 000", "doːlaːɾ tus koabɡa")]
    [InlineData("1,234,567", "miljõ a je la tus kobs a ji la pis tã la a naːse la kobs a nu la pis joːbe la a jopoe")]
    public void DeGroupsCommaPeriodAndSpaceSeparatedFigures(string input, string want) =>
        Assert.Equal(want, Text(input));

    // ⚠ THE ADVERSARIAL NEIGHBOURS: every one of these is a shape the rule must NOT claim, and each is
    // attested in this corpus. 1–2 digits after the mark is the DECIMAL and keeps its current reading,
    // because no decimal-point word is sourceable for Mooré.
    [Theory]
    [InlineData("29.6", "pisi la a wɛ . joːbe")]  // period decimal — 1 digit, untouched
    [InlineData("53,6", "pis nu la a tã , joːbe")] // comma decimal — the French convention
    [InlineData("(1,5,13)", "jembɾe , nu , piːɡ la a tã")] // a LIST of small numbers, not a group
    [InlineData("802.11n", "kobs a niː la a ji . piːɡ la a je n")] // version dot — 2 digits
    public void LeavesDecimalsListsDoisAndVersionDots(string input, string want) =>
        Assert.Equal(want, Text(input));

    // Sentence periods must survive, which is the whole reason no abbreviation rule exists here: the
    // artifact's `abbrev` cell is ordinary Mooré words before a full stop, and claiming them would
    // delete real pauses.
    [Fact]
    public void DoesNotTouchASentenceFinalPeriod() =>
        Assert.Equal("jʊːm tus a ji la a joːbe wã . jaː sõma je .", Text("Yʋʋm 2006 wã. Yaa sõma ye."));

    // The currency NOUN precedes the figure in Mooré, so the rule reorders — the shared tier can only
    // postpose. ⚠ `£` is DECLINED and stays silent: no Mooré word for the pound is attested.
    [Theory]
    [InlineData("€10,000", "eɾo tus piːɡa")]
    [InlineData("$5", "doːlaːɾ nu")]
    [InlineData("£50,000", "tus pis nu")] // de-grouped, sign correctly still silent
    public void ReadsEuroAndDollarAsPreposedNouns(string input, string want) =>
        Assert.Equal(want, Text(input));

    // ⚠ THE KILOMETRE, AND THE UNIT NOUN COMES FIRST — the same head-initial order the currency rule
    // found, reached independently.
    [Fact]
    public void ReadsKmAsThePreposedNounWhicheverSideTheSymbolWasWritten()
    {
        Assert.Equal("kilometr 10", Norm("10 km"));
        Assert.Equal("kilometr 140 (87 mi)", Norm("140 km (87 mi)"));
        Assert.Equal("kilometr 100 (62mi)", Norm("100km (62mi)")); // glued
        Assert.Equal("kilometɾ piːɡa", Text("10 km"));
        // AND THE OTHER ARM: the corpus already writes the SYMBOL in front of its own figure.
        // Here the figure never moves; only the symbol is swapped.
        Assert.Equal("a zoe kilometr 10 n pa ta", Norm("a zoe km 10 n pa ta"));
        Assert.Equal("zĩiga yaa kilometr 77.0", Norm("zĩiga yaa km2 77.0"));
    }

    // ⚠ THE EXPONENT IS CONSUMED AND UNREAD, and that is a stated LOSS rather than a fix. It ships only
    // because what it replaces is worse than a silence: `km2 77.0` read as `km` RAW plus the `2`
    // claimed by the number path as the CARDINAL TWO.
    [Fact]
    public void TheSquaredExponentIsDroppedNotInvented()
    {
        Assert.Equal("(kilometr 20.4)", Norm("(20.4 km2)"));
        Assert.Equal("kilometr 225.67", Norm("225.67km^2"));
        Assert.Equal("(akre 860; kilometr 3.5)", Norm("(akre 860; km² 3.5)"));
        Assert.DoesNotContain("jiːbu", Text("km2 77.0")); // no stray cardinal TWO from the exponent
    }

    // ⚠ THE SPAN KEEPS ITS SHAPE BEHIND ONE NOUN, which is a move only a head-initial language gets
    // for free. Matching just the right endpoint would drop the unit into the middle of the span.
    [Fact]
    public void AHyphenatedSpanTakesOnePreposedUnitNoun() =>
        Assert.Equal("yaa kilometr 20--40 (12-25 mi)", Norm("yaa 20--40 km (12-25 mi)"));

    // ⚠ THE ADVERSARIAL NEIGHBOURS: `km` is two ASCII letters in a Latin-script language, so a residue
    // is invisible to every leak class and an unguarded key bites into ordinary words. The de-grouping
    // coupling is asserted too.
    [Fact]
    public void TheKmKeyNeverBitesAWord()
    {
        Assert.Equal("kmall akm 5", Norm("kmall akm 5"));
        Assert.Equal("kilometr 18476", Norm("18,476km"));
    }

    // ⚠ TRAP 58 — all three grouping arms carried `(?![\d.,])`, so a grouped figure followed by a
    // clause comma or a sentence period was declined and read as TWO numbers.
    [Fact]
    public void ACommaGroupedFigureSurvivesTheClauseMarkAfterIt()
    {
        Assert.Equal("tus a nu .", Say("5,000."));
        Assert.Equal("tus a nu", Say("5,000"));
    }

    [Fact]
    public void ASpaceGroupedFigureSurvivesTheClauseMarkAfterIt() =>
        Assert.Equal("tus pis nu .", Say("50 000."));
}
