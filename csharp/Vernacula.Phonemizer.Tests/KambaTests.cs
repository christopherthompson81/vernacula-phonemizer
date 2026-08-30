// Canonical-IPA goldens for Kamba / Kikamba (kam) — the C# mirror of test/kamba.test.ts.
using KamEngine = Vernacula.Phonemizer.Languages.Kamba.KambaPhonemizer;
using KamNormalize = Vernacula.Phonemizer.Languages.Kamba.Normalize;
using KamNumbers = Vernacula.Phonemizer.Languages.Kamba.Numbers;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class KambaTests
{
    [Theory]
    // The 5 en.wiktionary anchors (HUMAN IPA, tone + prenasal-notation folded).
    [InlineData("mbiti", "ᵐbiti")]
    [InlineData("mũkonyo", "mokɔɲɔ")]
    [InlineData("mũtĩ", "mote")]
    [InlineData("ngingo", "ᵑɡiᵑɡɔ")]
    [InlineData("ũtukũ", "otuko")]
    public void TheWiktionaryAnchors(string word, string want) =>
        Assert.Equal(want, KamEngine.PhonemizeWord(word));

    [Theory]
    // 7-vowel ATR: the TILDE is vowel QUALITY not nasal — ⟨ĩ⟩=e, ⟨ũ⟩=o; ⟨e⟩=ɛ, ⟨o⟩=ɔ; doubling = length.
    [InlineData("mũndũ", "moⁿdo")]
    [InlineData("kĩlũngũ", "keloᵑɡo")]
    [InlineData("kaa", "kaː")]
    [InlineData("muundu", "muːⁿdu")]
    public void TheSevenVowelAtrSystem(string word, string want) =>
        Assert.Equal(want, KamEngine.PhonemizeWord(word));

    [Theory]
    // KAMBA-SPECIFIC consonants: ⟨v⟩=β, ⟨sy⟩=ʃ, ⟨ky⟩=tʃ, ⟨th⟩=ð, ⟨nth⟩=ⁿð (differ from Kikuyu).
    [InlineData("ngavu", "ᵑɡaβu")]
    [InlineData("mavindu", "maβiⁿdu")]
    [InlineData("syana", "ʃana")]
    [InlineData("kyama", "tʃama")]
    [InlineData("thandatu", "ðaⁿdatu")]
    [InlineData("nthakame", "ⁿðakamɛ")]
    public void TheKambaSpecificConsonants(string word, string want) =>
        Assert.Equal(want, KamEngine.PhonemizeWord(word));

    [Theory]
    // Prenasalized units + velar nasal: ⟨mb⟩=ᵐb, ⟨nz⟩=ⁿz, ⟨ny⟩=ɲ, ⟨ng'⟩=ŋ (distinct from ⟨ng⟩).
    [InlineData("ng'ombe", "ŋɔᵐbɛ")]
    [InlineData("nyama", "ɲama")]
    [InlineData("nzoka", "ⁿzɔka")]
    [InlineData("itong'o", "itɔŋɔ")]
    [InlineData("king'abwe", "kiŋaβwɛ")]
    public void ThePrenasalizedUnits(string word, string want) =>
        Assert.Equal(want, KamEngine.PhonemizeWord(word));

    [Fact]
    public void TheClauseAssembly() =>
        Assert.Equal("moⁿdo ne mosɛɔ .", KamEngine.CreateKamba().Text("Mũndũ nĩ mũseo.").Trim());

    [Theory]
    // Loan/name consonants are kept, not silently dropped (⟨d⟩=d, ⟨c⟩=tʃ).
    [InlineData("Daudi", "daudi")]
    [InlineData("daktari", "daktaɾi")]
    public void TheLoanConsonantsAreKept(string word, string want) =>
        Assert.Equal(want, KamEngine.PhonemizeWord(word));

    [Theory]
    // The ⟨ng'⟩ apostrophe: all three variants normalise (straight ', curly ’ U+2019, modifier-letter ʼ U+02BC).
    [InlineData("ng'ombe")]
    [InlineData("ng\u2019ombe")]
    [InlineData("ng\u02bcombe")]
    public void TheApostropheVariants(string word) =>
        Assert.Equal("ŋɔᵐbɛ", KamEngine.CreateKamba().Text(word).Trim());

    [Fact]
    public void AQuotedWordInjectsNoGlottal() =>
        Assert.Equal("mote", KamEngine.CreateKamba().Text("'mũtĩ'").Trim());

    [Theory]
    [InlineData(0, "noti")]
    [InlineData(7, "mũonza")]
    [InlineData(11, "ĩkũmi na ĩmwe")]
    [InlineData(20, "miongo ĩlĩ")]
    [InlineData(40, "miongo ina")] // ina here, but inya as the bare numeral 4
    [InlineData(4, "inya")]
    [InlineData(90, "miongo keenda")]
    public void UnitsTensAndTeens(double n, string want) =>
        Assert.Equal(want, KamNumbers.NumberToWords(n));

    [Theory]
    // Quoted VERBATIM from the manual's running text — they pin both the hundreds concord series
    // (maana + cl.6 a-) and the composition rule ("na" before the LAST component only).
    [InlineData(100, "ĩana yĩmwe")]
    [InlineData(150, "ĩana na miongo ĩtano")]
    [InlineData(250, "maana elĩ na miongo ĩtano")]
    [InlineData(1957, "ngili ĩmwe maana keenda miongo ĩtano na mũonza")]
    public void TheAttestedCompounds(double n, string want) =>
        Assert.Equal(want, KamNumbers.NumberToWords(n));

    [Theory]
    [InlineData(1000, "ngili ĩmwe")]
    [InlineData(10000, "ngili ĩkũmi")]
    [InlineData(1000000, "milioni ĩmwe")]
    [InlineData(1000000000, "milioni ngili ĩmwe")] // 10⁹ is a THOUSAND MILLION
    public void ThousandsAndMillions(double n, string want) =>
        Assert.Equal(want, KamNumbers.NumberToWords(n));

    [Fact]
    public void TheNumbersRunThroughTheG2p()
    {
        Assert.Equal("miɔᵑɡɔ ele", Phonemizer.Phonemize("20", "kam").Trim());
        Assert.Equal("maːna ɛle na miɔᵑɡɔ etanɔ", Phonemizer.Phonemize("250", "kam").Trim()); // ⟨aa⟩→aː
    }

    [Fact]
    public void TheTildeConfusablesAreTildeVowels()
    {
        // ⟨ĩ⟩ is /e/ and ⟨ũ⟩ is /o/, so the substitution silently swaps the ATR vowel.
        Assert.Equal("nthĩ ĩla kĩla nũndũ maũũ", KamNormalize.NormalizeKamba("nthî îla kîla nûndû maúú"));
        Assert.Equal("ⁿðe", Phonemizer.Phonemize("nthî", "kam").Trim());
        Assert.Equal("aⁿdo", Phonemizer.Phonemize("andû", "kam").Trim());
        Assert.Equal("eolo", Phonemizer.Phonemize("íúlú", "kam").Trim());
        Assert.Equal("maoː", Phonemizer.Phonemize("maúú", "kam").Trim());
    }

    [Theory]
    // The fold's guard is the ALPHABET — this corpus's six foreign-diacritic words are untouched.
    [InlineData("Gürses")]
    [InlineData("Müslüm")]
    [InlineData("São")]
    [InlineData("Asámi")]
    [InlineData("Erdoğan")]
    [InlineData("Erkoḉ")]
    public void TheForeignDiactricWordsAreUntouched(string word) =>
        Assert.Equal(word, KamNormalize.NormalizeKamba(word));

    [Fact]
    public void ThePercentWordIsTheEnglishBorrowingPostposed()
    {
        Assert.Equal("18 percenti ya andu", KamNormalize.NormalizeKamba("18% ya andu"));
        Assert.Equal("Nadal akwatie poindi 88 percenti syusie", KamNormalize.NormalizeKamba("Nadal akwatie poindi 88% syusie"));
        // …and the tier's suppression keeps it from doubling where the writer already wrote it.
        Assert.Equal("mbee wa 46 percenti ya kula", KamNormalize.NormalizeKamba("mbee wa 46 percenti ya kula"));
    }

    [Fact]
    public void TheUnitSymbolsAreDeclaredNounFirst()
    {
        Assert.Equal("milimita 5 (1/5 inzi)", KamNormalize.NormalizeKamba("5mm (1/5 inzi)"));
        Assert.Equal("kĩthĩmo kya sendimita 69", KamNormalize.NormalizeKamba("kĩthĩmo kya 69cm"));
        Assert.Equal("ilomita 1600 (maili 1000)", KamNormalize.NormalizeKamba("ilomita 1,600 (1,000 mi)"));
        Assert.Equal(
            "nginya kilomita 480 kwa isaa (mita 133 kwa sekondi; maili 300 kwa isaa)",
            KamNormalize.NormalizeKamba("nginya 480 km/h (133 m/s; 300 mph)"));
        // ⚠ CLAUSE-FINAL: the corpus's only bare `m` sits at a full stop.
        Assert.Equal("kĩla kĩna ũasa wa mita 4892.", KamNormalize.NormalizeKamba("kĩla kĩna ũasa wa 4892m."));
    }

    [Fact]
    public void TheSquareMeasureWordPrecedesItsUnit()
    {
        Assert.Equal("kikavite sikwea kilomita 19500 na", KamNormalize.NormalizeKamba("kikavite 19,500 km2 na"));
        Assert.Equal(
            "kilomita 783562 (sikwea sya maili 300948)",
            KamNormalize.NormalizeKamba("kilomita 783,562 (300,948 sq mi)"));
    }

    [Fact]
    public void TheCurrencyNounIsConsumedAndPutBack()
    {
        Assert.Equal("ma ndola 5 na ndola 100", KamNormalize.NormalizeKamba("ma ndola $5 na ndola $100"));
        // US$ AND AUD$ ARE THEIR OWN KEYS — a letter runs into the mark and the bare key cannot match.
        Assert.Equal("kuma ndola 11000 nginya ndola 22500", KamNormalize.NormalizeKamba("kuma US$11,000 nginya US$22,500"));
        // …and the sign before a MAGNITUDE, which the tier's number-adjacency cannot reach on its own.
        Assert.Equal("kũnengane ndola milioni 45 sya", KamNormalize.NormalizeKamba("kũnengane AUD$ milioni 45 sya"));
        // REFUSED: the £. The only pound candidate in the corpus is the WEIGHT — the sign stays unread.
        Assert.Equal("kwa ndĩvi ya milioni £27", KamNormalize.NormalizeKamba("kwa ndĩvi ya milioni £27"));
    }

    [Fact]
    public void TheCommaOnlyGroupsAndTheDotMostlyDecimates()
    {
        Assert.Equal("vinya wa aũme 2400 yakĩlaa", KamNormalize.NormalizeKamba("vinya wa aũme 2.400 yakĩlaa"));
        Assert.Equal("inzi 6 34 kithimini", KamNormalize.NormalizeKamba("inzi 6.34 kithimini"));
        // ⚠ THE WHOLE NUMBER AT ONCE — three groups, which a per-pass join reads as two numbers.
        Assert.Equal("kawaita 5000000 twi", KamNormalize.NormalizeKamba("kawaita 5,000,000 twi"));
        // ⚠ AND A CLAUSE-FINAL FIGURE MUST STILL DE-GROUP AND STILL SPLIT.
        Assert.Equal("kwa myaka 9000.", KamNormalize.NormalizeKamba("kwa myaka 9,000."));
        Assert.Equal("sĩsya ĩvĩsa ya 1 1.", KamNormalize.NormalizeKamba("sĩsya ĩvĩsa ya 1.1."));
    }

    [Fact]
    public void DottedDesignationsAreNotDecimals()
    {
        Assert.Equal("vamwe na 802 11a, 802 11b na 802 11g", KamNormalize.NormalizeKamba("vamwe na 802.11a, 802.11b na 802.11g"));
        Assert.Equal("18.55.6.215", KamNormalize.NormalizeKamba("18.55.6.215")); // three dots ⇒ never a decimal
    }

    [Fact]
    public void TheColonIsAClockOnlyEightTimesInFourteen()
    {
        Assert.Equal("Saa 1 15 sya kioko", KamNormalize.NormalizeKamba("Saa 1:15 sya kioko"));
        Assert.Equal("masaa ma nthĩ ĩsu (09 19 p.m. GMT)", KamNormalize.NormalizeKamba("masaa ma nthĩ ĩsu (09:19 p.m. GMT)"));
        // NOT the RATIO, NOT the UK degree class, NOT the three downhill-ski SPORTS TIMES.
        Assert.Equal("yailwe ithwa yi 3:2.", KamNormalize.NormalizeKamba("yailwe ithwa yi 3:2."));
        Assert.Equal("akwete 2:2 (ndikilii)", KamNormalize.NormalizeKamba("akwete 2:2 (ndikilii)"));
        Assert.Equal("ya ndatika 4 41 30, ndatika 2 41 60", KamNormalize.NormalizeKamba("ya ndatika 4:41.30, ndatika 2:41.60"));
        // AND THE DOT IS ALSO A CLOCK SEPARATOR — one rule, two notations, identical output.
        Assert.Equal("mawonanyo moo saa 12 00 GMT", KamNormalize.NormalizeKamba("mawonanyo moo saa 12.00 GMT"));
    }

    [Fact]
    public void TheRangeJoinerIsTheCorpusOwnDash()
    {
        Assert.Equal("ĩa ya kilomita 2 kũthi 3.", KamNormalize.NormalizeKamba("ĩa ya kilomita 2-3."));
        Assert.Equal("kati wa 120 kũthi 160 kubik mita", KamNormalize.NormalizeKamba("kati wa 120-160 kubik mita"));
        Assert.Equal("Sejong (1418 kũthi 1450).", KamNormalize.NormalizeKamba("Sejong (1418-1450)."));
        // ASCENDING ONLY: the non-ascending pairs are SCORES and a truncated season.
        Assert.Equal("itina wa uvika 6-6.", KamNormalize.NormalizeKamba("itina wa uvika 6-6."));
        Assert.Equal("Nadal na Muukananda usu ni 7-2.", KamNormalize.NormalizeKamba("Nadal na Muukananda usu ni 7-2."));
        Assert.Equal("kuma 1955-96, ila", KamNormalize.NormalizeKamba("kuma 1955-96, ila"));
    }

    [Fact]
    public void TheTwoGuardsForOneAircraft()
    {
        // The corpus writes the Ilyushin twice with ROMAN `II`, and core/roman.ts runs in registry.ts
        // WRAPPING text(), so this layer sees `2-76s` and `2 -76`.
        Assert.Equal("2-76s itina", KamNormalize.NormalizeKamba("2-76s itina")); // a LETTER after the second operand
        Assert.Equal("2 -76 yithiitwe", KamNormalize.NormalizeKamba("2 -76 yithiitwe")); // spacing is not symmetric
        Assert.Equal("ele miɔᵑɡɔ moɔⁿza na ðaⁿðato s", Phonemizer.Phonemize("II-76s", "kam").Trim());
        // AND `:` IS IN BOTH RANGE GUARDS.
        Assert.Equal("wa saa 10 00-11:000 wĩyoo", KamNormalize.NormalizeKamba("wa saa 10:00-11:000 wîyoo"));
        // AND RANGES RUN ABOVE THE DECIMAL STEP: a DESCENDING span of millions of years.
        Assert.Equal("kuma miaka 4 2- 3 9 tene muno", KamNormalize.NormalizeKamba("kuma miaka 4.2- 3.9 tene muno"));
    }

    [Fact]
    public void TheDegreeWordIsSuppressedWhenTheWriterSaidIt()
    {
        Assert.Equal("uvyuvu wa ndikilii +30 na", KamNormalize.NormalizeKamba("uvyuvu wa ndikilii +30°C na"));
        Assert.Equal("ndikilii 20", KamNormalize.NormalizeKamba("20°C"));
    }

    [Fact]
    public void ASpacedDashIsAPause()
    {
        Assert.Equal("Kukuia angi, Ndukaatate", KamNormalize.NormalizeKamba("Kukuia angi - Ndukaatate"));
        Assert.Equal("kulisa iima na kutulila, indi", KamNormalize.NormalizeKamba("kulisa iima na kutulila -- indi"));
        // LAST, so the range step has already claimed every dash between two numbers.
        Assert.Equal("usindi museo wa 26 - 00 meisindana", KamNormalize.NormalizeKamba("usindi museo wa 26 - 00 meisindana"));
    }

    [Fact]
    public void TheAmpersandAndTheX()
    {
        Assert.Equal("Mwiso muthyani, B na Bs isindanaa", KamNormalize.NormalizeKamba("Mwiso muthyani, B&Bs isindanaa"));
        Assert.Equal("ateo 4 kwa 4 vendaa", KamNormalize.NormalizeKamba("ateo 4x4 vendaa"));
    }

    [Fact]
    public void TheRefusals()
    {
        // THE MINUS IS REFUSED WHERE SWAHILI CLAIMS IT, and the difference is one measured instance.
        Assert.Contains("II -76", KamNormalize.NormalizeKamba("Russia kwa ivinda ikuvi niyaungamisye II -76 itina"));
        Assert.Equal("kindu saa 11 00 (UTC+1) Whitehall", KamNormalize.NormalizeKamba("kindu saa 11:00 (UTC+1) Whitehall"));
        // = < > × ÷ ± are all ×0 in the corpus.
        foreach (var sign in new[] { "=", "<", ">", "±", "÷" })
            Assert.Equal($"5 {sign} 6", KamNormalize.NormalizeKamba($"5 {sign} 6"));
        // AND NO FRACTION RULE.
        Assert.Contains("1/5 inzi", KamNormalize.NormalizeKamba("5mm (1/5 inzi)"));
    }

    /**
     * ⚠ A LONE SURROGATE MUST NOT THROW. `PhonemizeWord` normalizes the RAW WORD to NFC before the scan,
     * and .NET's `string.Normalize` refuses a string carrying an unpaired half where JS returns it
     * unchanged. Found by an astral/surrogate walk during the port review — 2,949 of 12,672 words threw.
     * A g2p that indexes UTF-16 units hands the halves over one at a time, so this is a designed-for input.
     * #1199's class; the fix is the shared `Js.Normalize`. Every expectation is the TypeScript's own answer.
     */
    [Theory]
    [InlineData("lone high", "\ud83d", "")]
    [InlineData("lone low", "\ude00", "")]
    [InlineData("trailing half", "a\ud83d", "a")]
    [InlineData("leading half", "\ud83da", "a")]
    [InlineData("stranded mid-word", "a\ud83db", "aβ")]
    [InlineData("inside a Kamba word", "k\ud83dtu", "ktu")]
    public void PhonemizeWordSurvivesALoneSurrogate(string label, string word, string want) =>
        Assert.Equal((label, want), (label, KamEngine.PhonemizeWord(word)));

    /**
     * …and the same for the NORMALIZE pass, which is reachable from the SHIPPED `Phonemize()`. Its opening
     * `Renormalize` carried the identical hazard in the SHARED CORE, so this threw for every engine whose
     * normalize begins with a renormalization — 25 languages before the fix, 4 after.
     */
    [Theory]
    [InlineData("bare half", "\ud83d", "\ud83d")]
    [InlineData("half between words", "ki \ud83d ta", "ki \ud83d ta")]
    [InlineData("half inside a digit run", "1\ud83d000", "1\ud83d000")]
    [InlineData("half after a decimal", "1.5 \ud83d", "1 5 \ud83d")]
    [InlineData("half before a degree letter", "30\ud83dC", "30\ud83dC")]
    public void NormalizeSurvivesALoneSurrogate(string label, string input, string want) =>
        Assert.Equal((label, want), (label, KamNormalize.NormalizeKamba(input)));

    [Theory]
    [InlineData("ki \ud83d ta", "ki ta")]
    [InlineData("1\ud83d000", "emwɛ nɔti")]
    public void TheShippedPathSurvivesALoneSurrogate(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "kam").Trim());
}
