// Canonical-IPA goldens for Kikuyu / Gĩkũyũ (ki) — the C# mirror of test/kikuyu.test.ts.
using KiEngine = Vernacula.Phonemizer.Languages.Kikuyu.KikuyuPhonemizer;
using KiNormalize = Vernacula.Phonemizer.Languages.Kikuyu.Normalize;
using KiNumbers = Vernacula.Phonemizer.Languages.Kikuyu.Numbers;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class KikuyuTests
{
    [Theory]
    // 7-vowel ATR: the TILDE is vowel QUALITY not nasal — ⟨ĩ⟩=e, ⟨ũ⟩=o; ⟨e⟩=ɛ, ⟨o⟩=ɔ.
    [InlineData("Gĩkũyũ", "ɣekojo")] // ⟨ĩ⟩→e, ⟨ũ⟩→o (the endonym)
    [InlineData("gatego", "ɣatɛɣɔ")]
    [InlineData("mũndũ", "moⁿdo")] // "person" — ⟨ũ⟩→o, ⟨nd⟩→ⁿd
    public void TheSevenVowelAtrSystem(string word, string want) =>
        Assert.Equal(want, KiEngine.PhonemizeWord(word));

    [Theory]
    // Bantu FRICATIVIZATION: ⟨b⟩=β, ⟨th⟩=ð, ⟨g⟩=ɣ, ⟨c⟩=ɕ; ⟨r⟩=ɾ.
    [InlineData("thaatũ", "ðaːto")] // "three" — ⟨th⟩→ð, ⟨aa⟩→aː, ⟨ũ⟩→o
    [InlineData("biacara", "βiaɕaɾa")]
    [InlineData("gatarũ", "ɣataɾo")] // ⟨g⟩→ɣ (Dahl's Law is orthographic)
    public void TheBantuFricativization(string word, string want) =>
        Assert.Equal(want, KiEngine.PhonemizeWord(word));

    [Theory]
    // PRENASALIZED digraphs ⟨mb⟩=ᵐb, ⟨nj⟩=ᶮdʑ, ⟨ng⟩=ᵑɡ; ⟨ng'⟩=ŋ, ⟨ny⟩=ɲ.
    [InlineData("mbaara", "ᵐbaːɾa")]
    [InlineData("Njoroge", "ᶮdʑɔɾɔɣɛ")]
    [InlineData("bongwe", "βɔᵑɡwɛ")]
    [InlineData("nyama", "ɲama")]
    [InlineData("kĩng'angi", "keŋaᵑɡi")] // ⟨ng'⟩→ŋ (distinct from ⟨ng⟩→ᵑɡ)
    public void ThePrenasalizedDigraphs(string word, string want) =>
        Assert.Equal(want, KiEngine.PhonemizeWord(word));

    [Fact]
    public void TheClauseAssembly() =>
        Assert.Equal("ɣekojo ne ɾoðiɔmi .", KiEngine.CreateKikuyu().Text("Gĩkũyũ nĩ rũthiomi."));

    [Theory]
    // The E5x citation series: a bare integer gives the adjectival 1–5 no noun to agree with.
    [InlineData(0, "kĩbũgũ")]
    [InlineData(7, "mũgwanja")]
    [InlineData(11, "ikũmi na ĩmwe")]
    [InlineData(19, "ikũmi na kenda")]
    public void UnitsAndTheAdditiveTeens(double n, string want) =>
        Assert.Equal(want, KiNumbers.NumberToWords(n));

    [Theory]
    // THE TENS MULTIPLIER TAKES CLASS-4 CONCORD FROM `mĩrongo` — the ĩ- concord, not the citation form.
    // 7 and 9 are invariant in BOTH slots.
    [InlineData(20, "mĩrongo ĩrĩ")]
    [InlineData(21, "mĩrongo ĩrĩ na ĩmwe")]
    [InlineData(60, "mĩrongo ĩtandatũ")]
    [InlineData(40, "mĩrongo ĩna")]
    [InlineData(80, "mĩrongo ĩnana")]
    [InlineData(7, "mũgwanja")]
    [InlineData(70, "mĩrongo mũgwanja")]
    public void TheTensTakeTheClassFourConcord(double n, string want) =>
        Assert.Equal(want, KiNumbers.NumberToWords(n));

    [Theory]
    // Hundreds take the cl.6 magana series — the `ma-` concord one class over.
    [InlineData(100, "igana rĩmwe")]
    [InlineData(200, "magana meerĩ")]
    [InlineData(600, "magana matandatũ")]
    [InlineData(800, "magana manana")]
    // ⚠ 555 ALSO PINS THE SLOT SPLIT: the tens multiplier is the class-4 `ĩtano` and the trailing unit the
    // citation `ithano` — same value, two different words.
    [InlineData(555, "magana matano mĩrongo ĩtano na ithano")]
    public void TheHundredsTakeTheClassSixSeries(double n, string want) =>
        Assert.Equal(want, KiNumbers.NumberToWords(n));

    [Theory]
    // 10⁹ is a THOUSAND MILLION — there is no borrowed "billion".
    [InlineData(1000, "ngiri ĩmwe")]
    [InlineData(2000, "ngiri igĩrĩ")]
    [InlineData(1000000, "mirioni ĩmwe")]
    [InlineData(1000000000, "mirioni ngiri ĩmwe")]
    public void ThousandsAndMillions(double n, string want) =>
        Assert.Equal(want, KiNumbers.NumberToWords(n));

    [Fact]
    public void TheNumbersRunThroughTheG2p()
    {
        Assert.Equal("meɾɔᵑɡɔ eɾe", Phonemizer.Phonemize("20", "ki").Trim()); // ⟨ĩ⟩→e (tilde = vowel QUALITY)
        Assert.Equal("iɣana ɾemwɛ", Phonemizer.Phonemize("100", "ki").Trim());
    }

    [Fact]
    public void TheOrtographicSubstituteFold()
    {
        // The tilde vowels a contributor's keyboard could not write. Unfolded, each one is DELETED by the g2p:
        // nyamű → *ɲam*, mūndū → *mⁿd*, kūrī → *kɾ*, Îri → *ɾi*.
        Assert.Equal("nyamũ mũno andũ", KiNormalize.NormalizeKikuyu("nyamű műno andű")); // U+0171
        Assert.Equal("mũndũ kũrĩ ũrĩa", KiNormalize.NormalizeKikuyu("mūndū kūrī ūrīa")); // U+016B + U+012B
        Assert.Equal("mũno igũrũ kĩa Ĩri", KiNormalize.NormalizeKikuyu("mûno igûrû kîa Îri")); // U+00FB / U+00EE / U+00CE
        // ⚠ THE REPAIR IS ON THE TEXT PATH, which is where the layer lives — `phonemizeWord` is the bare word
        // path and still sees the raw letter, which is correct.
        Assert.Equal(Phonemizer.Phonemize("nyamũ", "ki").Trim(), Phonemizer.Phonemize("nyamű", "ki").Trim());
        Assert.Equal("moⁿdo", Phonemizer.Phonemize("mūndū", "ki").Trim());
        // ⚠ THE ACUTE ACCENTS ARE DELIBERATELY NOT FOLDED. `Fágúnwà` must survive intact.
        Assert.Equal("Fágúnwà na Márquez", KiNormalize.NormalizeKikuyu("Fágúnwà na Márquez"));
    }

    [Fact]
    public void TheDeGroupingAndTheTwoCommaShapesThatAreNotNumbers()
    {
        Assert.Equal("1312", KiNormalize.NormalizeKikuyu("1,312"));
        Assert.Equal("70560000", KiNormalize.NormalizeKikuyu("70,560,000"));
        // The maths article's digit list and interval pair — declined by the exactly-three-digits rule.
        Assert.Equal("ndari 1,2,3,4,5,6,7,8,9", KiNormalize.NormalizeKikuyu("ndari 1,2,3,4,5,6,7,8,9"));
        Assert.Equal("ndari(0,1)", KiNormalize.NormalizeKikuyu("ndari(0,1)"));
        // and the grouped number that ends a clause keeps its pause (the `(?!\d)` half)
        Assert.Equal("ta 3066 3 ft", KiNormalize.NormalizeKikuyu("ta 3,066.3 ft"));
    }

    [Fact]
    public void TheRangesTakeNginyaAscendingOnly()
    {
        Assert.Equal("1891 nginya 1978", KiNormalize.NormalizeKikuyu("1891-1978"));
        Assert.Equal("kuma 2013 nginya 2017", KiNormalize.NormalizeKikuyu("kuma 2013 nginya 2017")); // already spelled out
        Assert.Equal("1849 – 27 February 1936", KiNormalize.NormalizeKikuyu("1849 – 27 February 1936")); // day, not a year
        // ⚠ THE CHESS ARM, which this corpus has twice and the sibling layer's guard does not carry.
        Assert.Equal("(+1 -3 =0)", KiNormalize.NormalizeKikuyu("(+1 -3 =0)"));
        // ⚠ A DECIMAL RANGE IS DECLINED — the stated limit, not an oversight. The decimal step still runs on
        // the left operand, so the pair reads as two juxtaposed quantities with no false pause.
        Assert.Equal("kilo 30 9-72", KiNormalize.NormalizeKikuyu("kilo 30.9-72"));
    }

    [Fact]
    public void AClauseFinalSpanKeepsItsJoinerAndItsPause()
    {
        Assert.Equal("p 237 nginya 240.", KiNormalize.NormalizeKikuyu("p 237–240."));
        Assert.Equal("mwaka wa 1991 nginya 2009.", KiNormalize.NormalizeKikuyu("mwaka wa 1991- 2009."));
        Assert.Equal("mwaka wa 1991 nginya 2009, na", KiNormalize.NormalizeKikuyu("mwaka wa 1991-2009, na"));
        // and the decimal half of the guard is untouched — a separator WITH a digit still declines
        Assert.Equal("kilo 20-43 5", KiNormalize.NormalizeKikuyu("kilo 20-43.5"));
        // the chess arm is unaffected: it lives in the LEFT guard
        Assert.Equal("(+2 -5 =2).", KiNormalize.NormalizeKikuyu("(+2 -5 =2)."));
    }

    [Fact]
    public void ThePercentIsHarĩIgana()
    {
        Assert.Equal("gĩcunjĩ kĩa 33 harĩ igana kĩa thĩ", KiNormalize.NormalizeKikuyu("gĩcunjĩ kĩa 33% kĩa thĩ"));
        // the corpus's own frame, with the decimal tail carried into the operand and spelled out after
        Assert.Equal(
            "ɣeɕuᶮdʑe kea meɾɔᵑɡɔ eɾe na kɛⁿda iɣeɾe haɾe iɣana",
            Phonemizer.Phonemize("gĩcunjĩ kĩa 29.2%", "ki").Trim());
    }

    [Fact]
    public void TheDollarNounPrecedesItsAmountAndIsNotSaidTwice()
    {
        Assert.Equal("dolari 2 7 million", KiNormalize.NormalizeKikuyu("$2.7 million"));
        Assert.Equal("dolari 486840", KiNormalize.NormalizeKikuyu("US$486,840"));
        // trap 12: the sentence already names the currency
        Assert.Equal("dolari milioni 4 3 5 na 5", KiNormalize.NormalizeKikuyu("dolari milioni 4.35 na $5"));
    }

    [Fact]
    public void TheUnitsAreNounFirstAndTheMetreKeyKeepsItsVersionGuard()
    {
        Assert.Equal("ta mita 1661 (5450 ft)", KiNormalize.NormalizeKikuyu("ta 1661 m (5450 ft)")); // ft declined: an English gloss
        Assert.Equal("ta mita 934 6", KiNormalize.NormalizeKikuyu("ta 934.6 m"));
        Assert.Equal("kilomita 200", KiNormalize.NormalizeKikuyu("200km"));
        Assert.Equal("kilomita 12 5", KiNormalize.NormalizeKikuyu("12.5km")); // a two-letter key still reads glued
        // ⚠ THE BRANCH THIS CORPUS DOES NOT CONTAIN, which is exactly why it is pinned:
        Assert.Equal("802.11m", KiNormalize.NormalizeKikuyu("802.11m"));
        Assert.Equal("241 m3/s", KiNormalize.NormalizeKikuyu("241 m3/s")); // no cube word — declined, not guessed
        Assert.Equal("kilomita 41200", KiNormalize.NormalizeKikuyu("kilomita 41,200km")); // trap 12, the corpus's own case
    }

    [Fact]
    public void TheDecimalsLoseTheSeparatorAndKeepEveryDigit()
    {
        Assert.Equal("2 7", KiNormalize.NormalizeKikuyu("2.7"));
        // ⚠ reading the tail as a NUMBER would say a different quantity, so the digits are spaced apart
        Assert.Equal("emwɛ iɣeɾe iðanɔ", Phonemizer.Phonemize("1.25", "ki").Trim());
        // the numbered dictionary clauses this corpus writes are not quantities
        Assert.Equal("11.3.42 kĩbaũ", KiNormalize.NormalizeKikuyu("11.3.42 kĩbaũ"));
        // and the comma is a grouping mark and a pause in this language, never a decimal
        Assert.Equal("0,5", KiNormalize.NormalizeKikuyu("0,5"));
    }

    [Fact]
    public void TheEnglishOrdinalSuffixIsStripped()
    {
        Assert.Equal("21 Century Fox", KiNormalize.NormalizeKikuyu("21st Century Fox"));
        Assert.Equal("70 Birthday", KiNormalize.NormalizeKikuyu("70th Birthday"));
        Assert.Equal("wa kerĩ", KiNormalize.NormalizeKikuyu("wa kerĩ")); // the language's own ordinal, untouched
    }

    [Fact]
    public void TheHtmlEntitiesAreFoldedAndNoAmpersandWordIsSpent()
    {
        Assert.Equal("kilomita 700². Nĩ", KiNormalize.NormalizeKikuyu("kilomita 700². &nbsp;&nbsp;Nĩ"));
        Assert.Equal("Niia & Lil Wayne", KiNormalize.NormalizeKikuyu("Niia & Lil Wayne")); // an English name; nothing to say
    }

    /**
     * ⚠ A LONE SURROGATE MUST NOT THROW. `PhonemizeWord` normalizes the RAW WORD to NFC before the scan,
     * and .NET's `string.Normalize` refuses a string carrying an unpaired half where JS returns it
     * unchanged. Every expectation is the TypeScript's own answer. #1199's class.
     */
    [Theory]
    [InlineData("lone high", "\ud83d", "")]
    [InlineData("lone low", "\ude00", "")]
    [InlineData("trailing half", "a\ud83d", "a")]
    [InlineData("leading half", "\ud83da", "a")]
    [InlineData("stranded mid-word", "a\ud83db", "aβ")]
    [InlineData("inside a Kikuyu word", "k\ud83dtu", "ktu")]
    public void PhonemizeWordSurvivesALoneSurrogate(string label, string word, string want) =>
        Assert.Equal((label, want), (label, KiEngine.PhonemizeWord(word)));

    /**
     * …and the same for the NORMALIZE pass, which is reachable from the SHIPPED `Phonemize()`. Its opening
     * `Renormalize` is the shared-core site #1199's sweep fixed.
     */
    [Theory]
    [InlineData("bare half", "\ud83d", "\ud83d")]
    [InlineData("half between words", "ki \ud83d ta", "ki \ud83d ta")]
    [InlineData("half inside a digit run", "1\ud83d000", "1\ud83d000")]
    [InlineData("half after a decimal", "1.5 \ud83d", "1 5 \ud83d")]
    [InlineData("half before a degree letter", "30\ud83dC", "30\ud83dC")]
    public void NormalizeSurvivesALoneSurrogate(string label, string input, string want) =>
        Assert.Equal((label, want), (label, KiNormalize.NormalizeKikuyu(input)));

    [Theory]
    [InlineData("ki \ud83d ta", "ki ta")]
    [InlineData("1\ud83d000", "emwɛ keβoɣo")]
    public void TheShippedPathSurvivesALoneSurrogate(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "ki").Trim());
}
