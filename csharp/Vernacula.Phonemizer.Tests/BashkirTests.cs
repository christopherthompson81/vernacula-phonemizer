/**
 * Bashkir (ba) — Башҡорт теле, Kipchak Turkic (sibling of Tatar), CYRILLIC. Signatures: the INTERDENTAL
 * fricatives ⟨ҫ⟩→[θ], ⟨ҙ⟩→[ð] (Bashkir's hallmark); the WRITTEN uvulars ⟨ҡ⟩→[q], ⟨ғ⟩→[ʁ] (no harmony
 * inference — unlike Tatar); the Bashkir VOWEL SHIFT ⟨о⟩→[ʊ], ⟨ө⟩→[ø], ⟨ы⟩→[ɯ], ⟨е⟩→[ɪ]; dark ⟨л⟩→[ɫ]
 * (back harmony); ⟨у ү⟩→[w] after a vowel. Real Bashkir text is loan-heavy → a detected RUSSIAN LOAN
 * (vowel-harmony violation) is routed to the Russian g2p.
 *
 * The portable half of test/bashkir.test.ts. ⚠ THESE PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES
 * (trap 13): the ordinal suffix is DERIVED from vowel harmony, so each of its live branches gets a case —
 * including values this corpus does not contain — and the glue fallback gets its own. Every expected value
 * is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Bashkir;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class BashkirTests
{
    /** Through the registry — core/roman.ts runs there, wrapping the engine. */
    private static string Say(string s) => Phonemizer.Phonemize(s, "ba").Trim();
    /** The RAW engine, without the Roman pass — the TS `getPhonemizer("ba").text(...)`. */
    private static string Engine(string s) => Registry.GetPhonemizer("ba").Text(s).Trim();
    private static string Norm(string s) => Normalize.NormalizeBashkir(s);

    [Theory]
    // the INTERDENTAL hallmark ⟨ҫ⟩→θ, ⟨ҙ⟩→ð + the written uvulars ⟨ҡ ғ⟩
    [InlineData("аҫыл", "ɑˈθɯɫ")]        // 'noble' — ⟨ҫ⟩→[θ]
    [InlineData("ҙур", "ˈðuɾ")]          // 'big' — ⟨ҙ⟩→[ð]
    [InlineData("башҡорт", "bɑʃˈqʊɾt")]  // ⟨ҡ⟩→[q], ⟨ш⟩→ʃ, ⟨о⟩→ʊ
    [InlineData("ҡыҙыл", "qɯˈðɯɫ")]      // ⟨ҡ⟩→[q], ⟨ҙ⟩→[ð], dark ⟨л⟩→[ɫ]
    // the Bashkir vowel shift + the ⟨у⟩ glide
    [InlineData("көн", "ˈkøn")]          // ⟨ө⟩→[ø]
    [InlineData("балыҡ", "bɑˈɫɯq")]      // ⟨ы⟩→[ɯ], dark ⟨л⟩
    [InlineData("һыу", "ˈhɯw")]          // ⟨у⟩ after a vowel → [w]
    [InlineData("йәшел", "jæˈʃɪl")]      // ⟨ә⟩→æ, ⟨е⟩→[ɪ]
    [InlineData("биш", "ˈbiʃ")]          // a word ending in ⟨и⟩→[i] still gets stress
    [InlineData("үҙ", "ˈyð")]            // ⟨ү⟩→[y] onset counts as a vowel for stress
    public void ReadsTheNativeScan(string input, string expected) =>
        Assert.Equal(expected, BashkirPhonemizer.PhonemizeWordNative(input));

    [Theory]
    // Turkic decimal; Bashkir's OWN lexemes, not Tatar's.
    [InlineData("7", "jɪˈtɪ")]                                        // ете, not Tatar җиде
    [InlineData("11", "ˈun ˈbɪɾ")]                                    // ун бер — TWO words (Tatar fuses)
    [InlineData("25", "jɪɡɪɾˈmɪ ˈbiʃ")]
    [InlineData("100", "ˈjøð")]                                       // йөҙ — the ⟨ҙ⟩ hallmark in a numeral
    [InlineData("555", "ˈbiʃ ˈjøð ilˈlɪ ˈbiʃ")]
    [InlineData("1984", "ˈmɪŋ tuˈʁɯð ˈjøð hikˈhæn ˈdyɾt")]            // һикһән 80, not Tatar сиксән
    [InlineData("12345", "ˈun iˈkɪ ˈmɪŋ ˈøs ˈjøð ˈqɯɾq ˈbiʃ")]
    [InlineData("1000000", "ˈbɪɾ miɫɫiˈʊn")]
    public void ComposesTheCardinals(string input, string expected) => Assert.Equal(expected, Engine(input));

    [Theory]
    [InlineData("республика", true)]  // back ⟨у а⟩ + front ⟨е⟩, no Bashkir letter → loan
    [InlineData("Европа", true)]      // front ⟨е⟩ + back ⟨о⟩ → loan
    [InlineData("тарих", false)]      // back ⟨а⟩ + NEUTRAL ⟨и⟩ (Arabic loan, read native) → NOT flagged
    [InlineData("башҡорт", false)]    // has ⟨ҡ⟩ → native
    [InlineData("балыҡ", false)]      // all-back harmony → native
    public void DetectsTheRussianLoanByHarmonyViolation(string word, bool expected) =>
        Assert.Equal(expected, BashkirPhonemizer.IsRussianLoan(word));

    [Fact]
    public void ARussianLoanIsRoutedToTheRussianG2p() =>
        // palatalization the native scan cannot make
        Assert.Contains("rʲ", BashkirPhonemizer.PhonemizeWord("республика"));

    /**
     * ⚠ ⟨ѳ⟩ U+0473 IS ⟨ө⟩ AND ⟨ӊ⟩ U+04CA IS ⟨ң⟩ — legacy-codepage artefacts. Both fall outside the letter
     * tables, so `кѳньяғында → knjɑʁɯnˈdɑ` lost its vowel outright — AND with the front vowel gone the
     * harmony test could route a native front word to the RUSSIAN g2p. The fold runs before the loan test.
     */
    [Fact]
    public void TheLegacyCodepageLettersFoldBeforeTheLoanTest()
    {
        Assert.Equal(BashkirPhonemizer.PhonemizeWord("көньяғында"), BashkirPhonemizer.PhonemizeWord("кѳньяғында"));
        Assert.Equal(BashkirPhonemizer.PhonemizeWord("һөрөлгән"), BashkirPhonemizer.PhonemizeWord("һѳрѳлгән"));
        Assert.Equal(BashkirPhonemizer.PhonemizeWord("уның"), BashkirPhonemizer.PhonemizeWord("уныӊ"));
        Assert.Equal("mɪŋˈdæn", BashkirPhonemizer.PhonemizeWord("меӊдән"));
    }

    [Theory]
    // The ordinal suffix is DERIVED by vowel harmony, and every branch is exercised.
    [InlineData("1-се", "беренсе")]                              // -енсе after a consonant
    [InlineData("2-се", "икенсе")]                               // -нсе after a VOWEL
    [InlineData("3-сө", "өсөнсө")]                               // -өнсө — the rounded branch
    [InlineData("6-сы", "алтынсы")]                              // -нсы after a vowel, back branch
    [InlineData("23-сө урында", "егерме өсөнсө урында")]         // only the LAST word takes it
    [InlineData("50-се йылдар", "илленсе йылдар")]
    [InlineData("159-сы урын", "йөҙ илле туғыҙынсы урын")]
    // ⚠ LABIAL HARMONY IS NARROWER THAN THE VOWEL INVENTORY SUGGESTS: ⟨у ү⟩ are rounded and do NOT round
    // the suffix. Neither value is in this corpus — they are the branch, not the instance.
    [InlineData("10-сы", "унынсы")]                              // ун + -ынсы, never *унонсо*
    [InlineData("4-се", "дүртенсе")]                             // дүрт + -енсе, never *дүртөнсө*
    [InlineData("100-сө", "йөҙөнсө")]
    [InlineData("1000-се", "меңенсе")]
    public void TheOrdinalSuffixIsDerivedByVowelHarmony(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    // …and the SAME notation writes a CASE suffix, which is glued instead. The writer has already chosen
    // the allomorph from the SPOKEN numeral: йөҙ takes -ҙән, нуль takes -дән.
    [InlineData("100-ҙән", "йөҙҙән")]
    [InlineData("0-дән", "нульдән")]
    [InlineData("613-ө", "алты йөҙ ун өсө")]                     // the possessive, vowel-initial
    // ⚠ A GLUED SUFFIX MUST BRING ITS OWN VOWEL unless the numeral ends in one: `…утыҙ өсн` is a syllable
    // no Bashkir word can carry, so the whole match is declined — the figure still reads, and an
    // impossible syllable is worse than an unspoken morpheme (trap 56).
    [InlineData("1923233-н", "1923233-н")]
    // ⚠ `-е` AND `-й` ARE RUSSIAN — all seven corpus instances are inside Russian passages. Gluing gave
    // *туҡһане*, a word in neither language.
    [InlineData("2-е изд.", "2-е изд.")]
    [InlineData("1990-е", "1990-е")]
    public void TheSameNotationWritesACaseSuffixWhichIsGlued(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    // The suffix goes on the DEGREE SIGN as often as on the numeral.
    [InlineData("+0,3 °C-тан", "плюс 0,3 градустан")]
    [InlineData("+2,8 °C-ҡа тиклем", "плюс 2,8 градусҡа тиклем")]
    [InlineData("5°-ҡа тиклем", "5 градусҡа тиклем")]
    // ⚠ THE CASE SUFFIX IS LOWERCASE-ONLY AND MUST STAY SO. Making the scale letter case-insensitive with
    // an `i` flag folds this language's suffix class too, so an UPPERCASE run after the hyphen starts
    // being captured as a suffix. The scale letter goes in the character class instead; these pin both.
    [InlineData("+0,3 °c-тан", "плюс 0,3 градустан")]            // lowercase scale letter
    [InlineData("35 С°-тан", "35 градустан")]                    // letter-first arm
    [InlineData("35 С°-ТАН", "35 Цельсий градусы-ТАН")]          // uppercase: NOT a suffix
    // ⚠ THE SCALE NAME IS DROPPED WHEN A SUFFIX FOLLOWS: *Цельсий градусы* has a possessive -ы that needs
    // a linking -н- before the case ending the writer did NOT type. Honest lossiness, not an oversight.
    [InlineData("+28 °C", "плюс 28 Цельсий градусы")]
    // Both the Latin ⟨C⟩ and the Cyrillic ⟨С⟩ occur and render identically; the Latin one was falling to
    // Core/Foreign.cs and reading as the ENGLISH letter name.
    [InlineData("10° С-тан", "10 градустан")]
    [InlineData("+35С°", "плюс 35 Цельсий градусы")]             // the sign typed AFTER the letter
    public void TheSuffixGoesOnTheDegreeSignAsOftenAsOnTheNumeral(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    [InlineData("10:30", "ун утыҙ")]                             // the colon was a clause pause
    [InlineData("8:30-ҙа", "һигеҙ утыҙҙа")]                      // the suffix lands on the spoken MINUTE
    [InlineData("3 000 000", "3000000")]                         // read as *өс нуль нуль* before this
    [InlineData("1991 й.", "1991 йыл")]                          // was the bare glide [j]
    [InlineData("б. э. т. 145", "беҙҙең эраға тиклем 145")]
    [InlineData("һ. б.", "һәм башҡалар.")]                       // clause-final: the dot IS the sentence end
    [InlineData("№ 5", "номер 5")]
    // ⚠ `г.` WITH A DOT is Russian *года*; `г` WITHOUT one is the gram. The dot is the only discriminator,
    // which is why the shared tier is not given the key.
    [InlineData("3,300 г", "3,300 грамм")]
    [InlineData("1988 г.", "1988 г.")]
    public void TheClockTheGroupingAndTheAbbreviations(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    [InlineData("70 %", "jɪtˈmɪʃ prɐt͡sˈɛnt")]
    // ⚠ NOT a Slavic three-way count: a Turkic counted noun stays SINGULAR after any numeral, so every
    // CountForms entry is a one-element array and `5 километр` is right, not *5 километрҙар*.
    [InlineData("12,5 км", "ˈun iˈkɪ øˈtøɾ ˈbiʃ kʲɪɫɐmʲˈetr")]
    [InlineData("10 км²", "ˈun kwɑdˈɾɑt kʲɪɫɐmʲˈetr")]           // the adjective BEFORE the noun
    // The decimal COMMA is a quantity — 24,214 corpus instances; `5,3 %` read as *биш , өс* before this.
    [InlineData("5,3 %", "ˈbiʃ øˈtøɾ ˈøs prɐt͡sˈɛnt")]
    public void PercentUnitsAndTheDecimalComma(string input, string expected) =>
        Assert.Equal(expected, Engine(input));

    [Fact]
    public void TheCountedNounStaysSingular() => Assert.Contains("kiɫʊɡˈɾɑmm", Engine("100 кг"));

    [Theory]
    // ⚠ NO DOT-DECIMAL FOLD, and that is a measured divergence from the Belarusian layer next door: be's
    // 82 dot-decimals were mostly genuine; ba's 98 are almost all PERCENT-ENCODED wiki anchors, plus a
    // lens aperture and a page range. Zero are numbers, so the dot is left exactly where it was.
    [InlineData("f/0.7", "f/0.7")]
    [InlineData("6.5-66", "6.5-66")]
    // Signs, and the two the corpus refuses.
    [InlineData("−41 градус", "минус 41 градус")]                // U+2212, not a hyphen
    [InlineData("5 = 5", "5 тигеҙ 5")]
    [InlineData("6 × 6", "6 тапҡыр 6")]
    [InlineData("a^{-1}=e", "a^{-1}=e")]                         // `=` is digit-gated
    // ⚠ NO DIVISION RULE AT ALL: the corpus's single `÷` is `рН = 6,4÷6,7`, a RANGE in the Russian
    // convention, not a division. One instance of the opposite sense is not evidence for the sign.
    [InlineData("6,4÷6,7", "6,4÷6,7")]
    // Ranges are separated but NOT given a connective, and must survive a full stop (trap 58).
    [InlineData("300—600 мм", "300, 600 мм")]
    [InlineData("1-3 көн", "1, 3 көн")]
    [InlineData("120—135 көн.", "120, 135 көн.")]
    public void TheDotsTheSignsAndTheRanges(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Fact]
    public void ACenturyIsAnOrdinalAndTheDerivationIsSharedWithNormalize()
    {
        Assert.Equal("ун туғыҙынсы", RomanOrdinals.Ordinal(19));
        Assert.Equal("егерменсе", RomanOrdinals.Ordinal(20));
        Assert.Null(RomanOrdinals.Ordinal(101)); // above 100 a roman is a year; the cardinal is right
        // ⚠ THROUGH Phonemize, NOT THE RAW ENGINE: Core/Roman.cs runs in Registry.cs wrapping the engine.
        Assert.Equal("ˈun tuʁɯðɯnˈsɯ bɯˈwɑt", Say("XIX быуат"));
        Assert.Equal("jɪɡɪɾmɪnˈsɪ bɯwɑtˈtɑ", Say("XX быуатта")); // the noun keeps the case
        // ⚠ AND THE SAME SEAM FEEDS THE SUFFIX RULE: `III-сөнөң` reaches the normalizer as `3-сөнөң`,
        // whose written suffix runs PAST the ordinal's own tail (*өсөнсө* + a genitive). Spliced on the
        // overlap; a plain `endsWith` test fell through to the glue path and produced *өссөнөң*.
        Assert.Equal("æχˈmæt øsønsøˈnøŋ", Say("Әхмәт III-сөнөң"));
    }

    [Fact]
    public void InitialismsAreSpelled()
    {
        Assert.Equal("ˈɪs ˈɪs ˈɪs ˈɪɾ", Engine("СССР")); // was the cluster [sssɾ]
        Assert.Equal("ˈɑ ˈqɯ ˈʃɑ", Engine("АҠШ"));      // the USA, with the Bashkir-only letter names
    }

    [Fact]
    public void NoDigitLeakSentinelOrGapAcrossTwentyThousand()
    {
        for (var n = 0; n <= 20000; n++)
        {
            var words = string.Join(" ", Numbers.NumberToWords(n));
            Assert.Matches("^[^0-9]*$", words);
            Assert.NotEqual("", words);
        }
    }
}
