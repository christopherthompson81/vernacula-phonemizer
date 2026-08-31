/**
 * The portable half of test/luxembourgish.test.ts — Luxembourgish (lb), West Germanic (Moselle
 * Franconian), Latin script (~390k). A German-derived orthography (⟨w⟩→v, ⟨ch⟩→χ, initial
 * st/sp→ʃt/ʃp) + a distinctive diphthong system + French loans. The engine is a greedy longest-match
 * grapheme scan + German-style rules (stressed ⟨e⟩→æ, geminate collapse, devoicing).
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Luxembourgish;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class LuxembourgishTests
{
    private static string Word(string s) => LuxembourgishPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "lb").Trim();
    private static string Norm(string s) => Normalize.NormalizeLuxembourgish(s);

    [Theory]
    // The diphthong system: ⟨ei/ai⟩→ai̯, ⟨au⟩→æu̯, ⟨ou⟩→əu̯, ⟨éi⟩→ei̯.
    [InlineData("Haus", "hˈæu̯s")]   // ⟨au⟩ → æu̯ ("house")
    [InlineData("Kou", "kˈəu̯")]     // ⟨ou⟩ → əu̯ ("cow")
    [InlineData("Dréi", "drˈei̯")]   // ⟨éi⟩ → ei̯ ("turn")
    [InlineData("Méi", "mˈei̯")]     // ⟨éi⟩ → ei̯ ("more")
    public void TheDiphthongSystem(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // The German-style consonants: ⟨w⟩→v, ⟨ch⟩→χ, ⟨z⟩→t͡s, ⟨qu⟩→kv, ⟨é⟩ alone→eː.
    [InlineData("Waasser", "vˈaːsər")]   // ⟨w⟩→v, ⟨aa⟩→aː ("water")
    [InlineData("Buch", "bˈuχ")]         // ⟨ch⟩ → χ ("book")
    [InlineData("zéng", "t͡sˈeːŋ")]       // ⟨z⟩→t͡s, ⟨é⟩ alone→eː, ⟨ng⟩→ŋ ("ten")
    [InlineData("Quell", "kvˈæl")]       // ⟨qu⟩→kv, ⟨e⟩→æ, ⟨ll⟩ collapse ("spring")
    [InlineData("Been", "bˈeːn")]        // ⟨ee⟩ → eː ("leg")
    public void TheGermanStyleConsonants(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // Initial ⟨st/sp⟩ → [ʃt ʃp] + single ⟨s⟩ → [z] as an onset (⟨ss⟩ stays [s]).
    [InlineData("Strooss", "ʃtrˈoːs")]   // initial st→ʃt, ⟨oo⟩→oː, ⟨ss⟩→s ("street")
    [InlineData("Spill", "ʃpˈil")]       // initial sp→ʃp ("game")
    [InlineData("Sonn", "zˈon")]         // onset ⟨s⟩→z, ⟨nn⟩ collapse ("sun")
    [InlineData("Iesel", "ˈiəzəl")]      // ⟨ie⟩→iə, intervocalic ⟨s⟩→z ("donkey")
    public void TheInitialClustersAndVoicedSOnset(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // Short stressed ⟨e⟩ → [æ], reduced ⟨e⟩ → [ə] (the ⟨-en⟩ ending + the ⟨ge-⟩ prefix).
    [InlineData("Belsch", "bˈælʃ")]      // monosyllable → stressed [æ] ("Belgium")
    [InlineData("Decken", "dˈækən")]     // stressed e→æ, ⟨-en⟩ ending→ə ("blankets")
    [InlineData("Gemeng", "ɡəmˈæŋ")]     // ⟨ge-⟩ prefix unstressed→ə, stressed e→æ ("municipality")
    public void ShortStressedEAndReducedE(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // PRIMARY STRESS — the mark the engine was already computing for the æ/ə choice, now emitted.
    // ⚠ THE REFEREE CANNOT CHECK THE MARK. It CAN check the placement indirectly, through the vowel
    // quality the same decision drives.
    [InlineData("Belsch", "bˈælʃ")]          // no prefix → the first nucleus
    [InlineData("Gemeng", "ɡəmˈæŋ")]         // ⟨ge-⟩ shifts it to σ2
    [InlineData("erfuerdert", "ərfˈuərdərt")] // ⟨er-⟩ likewise ("requires")
    // ⚠ ⟨ver⟩ BEFORE A VOWEL — exempt from the consonant guard the other prefixes keep.
    [InlineData("veränneren", "fərˈænərən")]  // "to change"
    // A MONOSYLLABIC root is protected by the vowel-count guard even though it matches the prefix letters.
    [InlineData("Bett", "bˈæt")]              // one nucleus → no shift ("bed")
    // ⚠ THE KNOWN FAILURE MODE, PINNED RATHER THAN HIDDEN. A disyllabic root that merely BEGINS with the
    // prefix letters is mislocated; fixing it needs a morpheme lexicon, not a better regex.
    [InlineData("Becher", "bəχˈær")]          // WRONG, and measured — "cup"
    // No nucleus, no mark: the two clitics in the referee are the whole of this class.
    [InlineData("'t", "t")]
    public void PrimaryStressFirstNucleusOrSecondPastAPrefix(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // Geminate collapse + devoicing (word-final, regressive, and ⟨g⟩→χ/k).
    [InlineData("Flott", "flˈot")]   // ⟨tt⟩ → single ("nice")
    [InlineData("Hand", "hˈant")]    // word-final ⟨d⟩ → t ("hand")
    [InlineData("Abt", "ˈapt")]      // regressive: ⟨b⟩ → p before [t] ("abbot")
    [InlineData("Dag", "dˈaχ")]      // final ⟨g⟩ → χ after a vowel ("day")
    [InlineData("Alg", "ˈalk")]      // final ⟨g⟩ → k after a consonant ("alga")
    public void GeminateCollapseAndDevoicing(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // ⟨n⟩→[ŋ] before a velar + intervocalic g-spirantization ⟨g⟩→[ʁ].
    [InlineData("Bankrott", "bˈaŋkrot")]  // n→ŋ before [k] ("bankruptcy")
    [InlineData("Lager", "lˈaʁər")]       // intervocalic ⟨g⟩ → [ʁ] ("camp/store")
    [InlineData("Dag", "dˈaχ")]           // word-final ⟨g⟩ still → [χ] (not spirantized)
    public void VelarNasalAndGlenition(string word, string want) => Assert.Equal(want, Word(word));

    [Fact]
    public void ClauseAssembly() =>
        Assert.Equal("ˈæχ ʃvˈæt͡sən lˈət͡səbuərɡəʃ .", Say("Ech schwätzen Lëtzebuergesch."));

    [Fact]
    public void RegistryWiring() => Assert.Equal("ˈæχ ʃvˈæt͡sən lˈət͡səbuərɡəʃ .", Say("Ech schwätzen Lëtzebuergesch."));

    [Theory]
    // CARDINAL NUMBERS — units-first compounds + the Eifeler Regel on the an/a connector: "an"
    // survives before ⟨n d t z h⟩ and vowels, but reduces to "a" before other consonants.
    [InlineData(0, "null")]
    [InlineData(21, "eenanzwanzeg")]       // before ⟨z⟩ → "an" kept
    [InlineData(31, "eenandrësseg")]       // before ⟨d⟩ → kept
    [InlineData(35, "fënnefandrësseg")]    // the Wikipedia example
    [InlineData(45, "fënnefavéierzeg")]    // before ⟨v⟩ → n DELETED
    [InlineData(55, "fënnefafofzeg")]      // before ⟨f⟩ → deleted
    [InlineData(65, "fënnefasiechzeg")]    // before ⟨s⟩ → deleted
    [InlineData(85, "fënnefanachtzeg")]    // before a VOWEL → kept
    [InlineData(95, "fënnefannonzeg")]     // before ⟨n⟩ → kept
    public void NumbersUnitsFirstPlusTheEifelerRegel(double n, string want) =>
        Assert.Equal(want, Numbers.NumberToWords(n));

    [Theory]
    // Numbers: closed German-style magnitudes.
    [InlineData(100, "honnert")]
    [InlineData(101, "honnerteent")]
    [InlineData(555, "fënnefhonnertfënnefafofzeg")]
    [InlineData(1000, "dausend")]
    [InlineData(12345, "zwielefdausend dräihonnertfënnefavéierzeg")]
    [InlineData(1000000, "eng Millioun")]
    [InlineData(1000000000, "eng Milliard")]
    public void NumbersClosedGermanStyleMagnitudes(double n, string want) =>
        Assert.Equal(want, Numbers.NumberToWords(n));

    [Theory]
    // Numbers wired into the phonemizer.
    [InlineData("21", "ˈeːnant͡svant͡səχ")]   // eenanzwanzeg
    [InlineData("45", "fˈənəfafei̯ərt͡səχ")]  // fënnefavéierzeg (n-deleted)
    public void NumbersWiredIntoThePhonemizer(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // The ordinal STEM has five branches and the corpus exercises only some of them: the suppletive
    // table, the +t path, the doubled-t collapse at 8, the +st path from 20, and the multi-word
    // carrier where the ending must land on the last word only. 8, 100 and 1922 are NOT in the corpus.
    [InlineData(1, "éischt")]
    [InlineData(3, "drëtt")]
    [InlineData(7, "siwent")]
    [InlineData(8, "aacht")]                                   // the tt COLLAPSE — unattested in the corpus
    [InlineData(19, "nonzéngt")]                                // the last +t
    [InlineData(20, "zwanzegst")]                               // the first +st — the branch boundary
    [InlineData(24, "véieranzwanzegst")]                        // compound
    [InlineData(100, "honnertst")]
    [InlineData(1922, "dausend nénghonnertzweeanzwanzegst")]    // ending on the LAST word
    public void OrdinalStemEveryBranch(double n, string want) => Assert.Equal(want, Normalize.OrdinalStem(n));

    [Theory]
    // The ending is -en plus the language's own final-n deletion; `der` takes -er.
    [InlineData("am 16. Joerhonnert", "am siechzéngte Joerhonnert")]   // ⟨j⟩ → n DELETED
    [InlineData("den 1. Dag vum Mount", "den éischten Dag vum Mount")] // ⟨d⟩ → n KEPT
    [InlineData("den 3. August", "den drëtten August")]                // a VOWEL → n kept
    [InlineData("de 14. Mäerz", "de véierzéngte Mäerz")]               // ⟨m⟩ → deleted
    [InlineData("op der 3. Plaz", "op der drëtter Plaz")]              // feminine dative → -er
    public void OrdinalEndingTheEifelerRegelDecides(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // Ordinal licensing: article + noun, and coordinated lists.
    [InlineData("den 190. vun der Lëscht", "den honnertnonzegste vun der Lëscht")]  // article + lowercase word
    [InlineData("Säin 1 000. Timber", "Säin dausendsten Timber")]                   // needs the de-grouping first
    [InlineData("am 11., 12. an 13. Joerhonnert", "am eeleften, zwieleften an dräizéngte Joerhonnert")] // ⟨n⟩ kept before the pause
    [InlineData("tëschent dem 10. bis 11. an dem 14. Joerhonnert", "tëschent dem zéngte bis eeleften an dem véierzéngte Joerhonnert")]
    public void OrdinalLicensingArticleNounAndLists(string input, string want) => Assert.Equal(want, Norm(input));

    [Fact]
    // A sentence-final numeral is NOT an ordinal: an ordinal is licensed by what FOLLOWS, and a
    // sentence period has nothing after it.
    public void ASentenceFinalNumeralIsNotAnOrdinal()
    {
        Assert.Equal("an Afghanistan 1979.", Norm("an Afghanistan 1979."));
        Assert.Equal("am Joer 2020.", Norm("am Joer 2020.")); // `Joer` is deliberately not a licenser
        Assert.Equal("d'Wanterolympiad 2010.", Norm("d'Wanterolympiad 2010."));
        Assert.Equal("Kapitel 5. Dat ass gutt", Norm("Kapitel 5. Dat ass gutt")); // content word before
        Assert.True(Say("an Afghanistan 1979.").EndsWith(".")); // the PAUSE survives
    }

    [Theory]
    // The crux: one character, four jobs, separated by fraction length and by what follows.
    [InlineData("vun 1.000 Dollar", "vun 1000 Dollar")]                    // THREE digits ⇒ grouping
    [InlineData("um 7.19 Auer", "um 7 Auer 19")]                           // TWO digits + a licenser ⇒ clock
    [InlineData("am 16. Joerhonnert", "am siechzéngte Joerhonnert")]       // nothing after ⇒ ordinal
    [InlineData("Den 802.11n-Standard", "Den 802.11n-Standard")]           // a version dot: untouched
    [InlineData("Ofbildung 1.1.", "Ofbildung 1.1.")]                       // a figure number: untouched
    [InlineData("4.41,30", "4 41 Komma 3 0")]                              // a sports time: NOT a clock, NOT a decimal
    public void ThePeriodGroupingVsClockVsOrdinalVsVersion(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // The colon is a score in Luxembourgish, never a clock.
    [InlineData("7:2", "7:2")]
    [InlineData("D'Endresultat war 21:20", "D'Endresultat war 21:20")]
    [InlineData("mat 3:2 bezeechent", "mat 3:2 bezeechent")]
    public void TheColonIsAScoreNeverAClock(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // Clock: `Auer` is re-emitted, a zone label is put back, and hour 1 is feminine.
    [InlineData("um 20.30 Auer Lokalzäit (15.00 UTC)", "um 20 Auer 30 Lokalzäit (15 Auer UTC)")]
    [InlineData("Tëschent 22.00 an 23.00 Auer MDT", "Tëschent 22 Auer an 23 Auer MDT")]
    [InlineData("E Samschdeg um 1.15 Auer", "E Samschdeg um eng Auer 15")] // the numeral must AGREE, so it is words-ified
    [InlineData("tëschent 6.30 a 7.30 Auer", "tëschent 6 Auer 30 a 7 Auer 30")] // licensed both ways
    // An UNLICENSED period-pair is left alone: the decimal rule takes a one-digit fraction only,
    // because in this language a two-digit fraction after a dot is the clock shape.
    [InlineData("De Programm ass 20.30 lassgaangen", "De Programm ass 20.30 lassgaangen")]
    [InlineData("12.5 Kilometer", "12 Komma 5 Kilometer")]                 // one digit ⇒ the decimal branch
    public void ThePeriodClock(string input, string want) => Assert.Equal(want, Norm(input));

    [Fact]
    // Thousands: both the period and the three space characters the corpus uses.
    public void ThousandsPeriodAndSpaceForms()
    {
        Assert.Equal("130000 Yen", Norm("130.000 Yen"));
        Assert.Equal("55000 Barrellen", Norm("55 000 Barrellen"));   // plain space
        Assert.Equal("9000 Leit", Norm("9\u00a0000 Leit"));          // NBSP
        Assert.Equal("4830 Kilometer", Norm("4\u202f830 Kilometer")); // NARROW NBSP
        Assert.Equal("nˈeːŋdæu̯zənt", Say("9\u00a0000"));             // NBSP again, end-to-end
    }

    [Theory]
    // Decimals: the comma is the decimal point, the fraction is read digit by digit.
    [InlineData("1,5 Kilometer", "1 Komma 5 Kilometer")]
    [InlineData("7,74 Meter", "7 Komma 7 4 Meter")]
    [InlineData("Whistler (1.5 Fuerstonne)", "Whistler (1 Komma 5 Fuerstonne)")] // the dot form too
    [InlineData("ofgeschloss, 12 Leit", "ofgeschloss, 12 Leit")]                  // a clause comma is untouched
    public void TheCommaIsTheDecimalPoint(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // Ranges: the joiner is `bis`, and it triggers n-deletion on the left operand.
    // ⚠ THE DASHES BELOW ARE NBSP-FLANKED (U+00A0), not plain spaces, because that is how the
    // corpus writes them. The parenthetical-dash case is NBSP then a PLAIN space.
    [InlineData("(1894\u00a0–\u00a01895)", "(1894 bis 1895)")]
    [InlineData("vun 2\u00a0–\u00a03 km Äis", "vun 2 bis 3 km Äis")]     // right operand stays DIGITS for the tier
    [InlineData("7\u00a0–\u00a08 Deeg", "siwe bis 8 Deeg")]              // *siwen* → *siwe*
    [InlineData("1000000\u00a0–\u00a02000000", "1000000 bis 2000000")]   // *eng Millioun*: stem ⟨n⟩, NOT deleted
    [InlineData("ers 1995\u00a0–\u00a01996, pan", "ers 1995 bis 1996, pan")] // the clause comma survives
    [InlineData("gëtt\u00a0– duerch", "gëtt\u00a0– duerch")]              // the PARENTHETICAL dash is untouched
    public void RangesTheJoinerIsBis(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // Fractions: the table, the composition, and the numerator's own n-deletion.
    [InlineData("5 mm (1/5 Zoll)", "5 mm (ee Fënneftel Zoll)")]  // the corpus's only fraction
    [InlineData("1/3 vum Land", "een Drëttel vum Land")]          // ⟨d⟩ keeps the n
    [InlineData("1/4 Stonn", "ee Véierel Stonn")]                 // the IRREGULAR noun, unattested in the corpus
    [InlineData("1/2 Zoll", "een hallef Zoll")]                   // 2 is an adjective, not a noun
    [InlineData("3/4 vun der Zäit", "dräi Véierel vun der Zäit")] // numerator > 1
    [InlineData("2/3 vun de Leit", "zwee Drëttel vun de Leit")]
    public void FractionsTheTableTheCompositionAndTheNumerator(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // Era, abbreviations and the ones deliberately left alone.
    [InlineData("am 10. Joerhonnert v.\u00a0Chr. ass", "am zéngte Joerhonnert vir Christus ass")] // NBSP inside `v. Chr.`
    [InlineData("(1000\u00a0–\u00a01300 n.\u00a0Chr.)", "(1000 bis 1300 no Christus)")]
    [InlineData("z.\u00a0B. de Pennsylvania Wilds", "zum Beispill de Pennsylvania Wilds")] // NBSP inside `z. B.`
    [InlineData("Kéis, Thon asw.", "Kéis, Thon an sou weider.")]  // the sentence break survives
    [InlineData("Nëss, Iessen asw., déi", "Nëss, Iessen an sou weider, déi")] // no DOUBLED pause
    [InlineData("den Dr. Damadian", "den Dokter Damadian")]
    [InlineData("Six Flags St. Louis", "Six Flags St. Louis")]    // NOT expanded: *Sankt* is unsourced
    public void EraAbbreviationsAndTheOnesLeftAlone(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // Degrees and signs — and the compound hyphens that must not become a minus.
    [InlineData("bei 32\u00a0°C Hëtzt", "bei 32 Grad Celsius Hëtzt")] // NBSP before the degree sign
    [InlineData("12\u00a0°F", "12 Grad Fahrenheit")]
    [InlineData("iwwer +30 Grad Celsius", "iwwer plus 30 Grad Celsius")]
    [InlineData("(UTC+1)", "(UTC plus 1)")]
    [InlineData("Typ-1-Diabetes an COVID-19", "Typ-1-Diabetes an COVID-19")] // no minus
    [InlineData("Standard-35-mm-Film", "Standard-35-mm-Film")]
    public void DegreesSignsAndTheCompoundHyphens(string input, string want) => Assert.Equal(want, Norm(input));

    [Fact]
    // `Meile` is the writer's own Eifeler form and must not be pluralised; only the RATE is claimed.
    public void MeileIsNotPluralisedOnlyTheRateIsClaimed()
    {
        Assert.Equal("50 Kilometer (31 Meile) vu Buenos Aires", Norm("50 Kilometer (31 Meile) vu Buenos Aires"));
        Assert.Equal(Say("20 km (15 Meilen) nord"), Say("20 Kilometer (15 Meilen) nord"));
        Assert.Equal("165 km/h (105 Meilen an der Stonn)", Norm("165 km/h (105 Meile/h)")); // km/h → the tier
        Assert.Equal("300 Meilen an der Stonn", Norm("300 mph"));
    }

    [Fact]
    // The squared/cubed unit fuses German-style.
    public void TheSquaredCubedUnitFusesGermanStyle()
    {
        Assert.Equal(Say("19500 Quadratkilometer"), Say("19 500 km²"));
        Assert.Equal(Say("5 Quadratmeter"), Say("5 m²"));
        Assert.Equal(Say("7 Kubikmeter"), Say("7 m³"));
    }

    [Theory]
    // No sign class is silently dropped.
    [InlineData("College of Arts & Sciences", "College of Arts an Sciences")]
    [InlineData("x = y", "x ass gläich y")]
    [InlineData("5 < 6", "5 méi kleng ewéi 6")]
    [InlineData("7 > 6", "7 méi grouss ewéi 6")]
    [InlineData("6 × 6 cm", "6 mol 6 cm")]
    [InlineData("12 ÷ 4", "12 dividéiert duerch 4")]
    [InlineData("4x4", "4x4")] // the ASCII x is a LETTER here and stays one
    public void NoSignClassIsSilentlyDropped(string input, string want) => Assert.Equal(want, Norm(input));

    [Fact]
    // The shared symbol tier, reached through the engine so the words are proved to pass the g2p.
    public void TheSymbolTierPercentCurrencyUnitsAndRateIdioms()
    {
        Assert.Equal(Say("88 Prozent"), Say("88\u202f%"));     // NARROW NBSP U+202F
        Assert.Equal(Say("30 Dollar"), Say("30\u202f$"));      // NARROW NBSP U+202F
        Assert.Equal(Say("165 Kilometer an der Stonn"), Say("165 km/h")); // corpus idiom
        Assert.Equal(Say("133 Meter pro Sekonn"), Say("133 m/s"));        // corpus idiom
        Assert.Equal(Say("7 Zentimeter"), Say("7 cm"));
        Assert.Equal(Say("0 Kilogramm"), Say("0 kg"));
    }

    [Fact]
    // The PARENTHETICAL EN DASH was dropped outright in 31 utterances, running two clauses together.
    // It reads as the short break `;` and `:` already map to.
    public void AParentheticalEnDashIsAPauseNotSilence()
    {
        Assert.Equal("klˈotərən ˈa ʃprˈaŋən , ərfˈuərdərt ˈavər trˈai̯niŋ .",
            Say("Kloteren a Sprangen – erfuerdert awer Training."));
        // A numeric range never reaches the tokenizer as a dash, so this must still be `bis`.
        Assert.Contains("bis", Norm("vun 2 – 3 km"));
    }

    [Fact]
    // A cardinal's unstressed -en obeys the Eifeler Regel before the next word.
    public void ACardinalsUnstressedEnObeysTheEifelerRegel()
    {
        Assert.Equal("ˈæt zˈin zˈivə kˈilomətər .", Say("Et sinn 7 Kilometer.")); // dropped before K
        Assert.Equal("ˈæt zˈin zˈivən dˈeːχ .", Say("Et sinn 7 Deeg."));         // kept before d
        Assert.Equal("ˈæt zˈin zˈivən ˈæu̯ər .", Say("Et sinn 7 Auer."));         // kept before a vowel
        // BEFORE A PAUSE THE ⟨n⟩ IS RETAINED.
        Assert.Equal("ˈæt zˈin zˈivən .", Say("Et sinn 7."));
        // THE STEM OF *Millioun* IS NOT AN INFLECTIONAL ⟨-en⟩ — a bare final-n test read *eng Milliou*.
        Assert.Equal("ˈæt zˈin ˈæŋ mˈiliəu̯n kˈilomətər .", Say("Et sinn 1000000 Kilometer."));
    }

    [Fact]
    // A magnitude between the number and its unit.
    public void AMagnitudeBetweenTheNumberAndItsUnit() =>
        Assert.Equal("ˈivər t͡svˈeː kˈoma t͡svˈeː mˈiliəu̯nə kvˈadratkilomətər fˈum ˈot͡səan",
            Say("iwwer 2,2 Millioune km² vum Ozean"));

    [Fact]
    // #1080 — the bignum fallback used to re-read the float it exists to bypass.
    // 9007199254740993 is 2^53+1; as a double it IS 2^53, so re-stringifying reads …992.
    public void TheLowDigitsAreTheTokensNotTheDoubles()
    {
        var words = Say("9007199254740993").Split(' ');
        Assert.Equal("drˈæi", words[^1]); // …993, was its neighbour's …992
    }

    [Fact]
    // And above 1e21, where String(n) is exponent form, every digit is still read.
    public void AboveOneETwentyOneEveryDigitIsStillRead() =>
        Assert.Equal(22, Say("1000000000000000000000").Split(' ').Length);
}
