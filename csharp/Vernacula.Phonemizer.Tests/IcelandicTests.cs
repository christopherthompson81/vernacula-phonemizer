/**
 * The portable half of test/icelandic.test.ts — Icelandic (is), North Germanic (Insular), Latin +
 * ⟨þ ð æ ö⟩, one of the deepest orthographies in the fleet: NO voicing contrast in stops (the contrast
 * is ASPIRATION), the epenthetic-stop clusters, preaspiration, the pre-velar-nasal change, the ⟨í⟩
 * hiatus glide, and fixed initial stress. Referee: wikipron isl_latn_broad (human), with vowel LENGTH +
 * ASPIRATION folded.
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Icelandic;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class IcelandicTests
{
    private static string Word(string s) => IcelandicPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "is").Trim();
    private static string Norm(string s) => Normalize.NormalizeIcelandic(s);

    [Theory]
    // The vowel values: á→au, é→jɛ, í→i, ó→ou, u→ʏ, ú→u, æ→ai; ⟨þ ð⟩.
    [InlineData("hús", "hˈus")]
    [InlineData("sól", "sˈoul")]
    [InlineData("læra", "lˈaira")]
    [InlineData("þú", "θˈu")]
    [InlineData("ís", "ˈis")]
    public void TheVowelValues(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // NO voicing contrast: ⟨b d g⟩→[p t k], ⟨p t k⟩→[p t k]; intervocalic ⟨g⟩→[ɣ].
    [InlineData("bók", "pˈouk")]
    [InlineData("taka", "tˈaka")]
    [InlineData("dagur", "tˈaɣʏr")]
    [InlineData("góður", "kˈouðʏr")]
    public void NoVoicingContrast(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // ⟨k g⟩ → the palatal [c] before a front vowel.
    [InlineData("gelda", "cˈɛlta")]
    [InlineData("Bylgja", "pˈɪlca")]
    public void PalatalBeforeAFrontVowel(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // The epenthetic-stop + devoiced-sonorant clusters: ⟨ll⟩→tl, ⟨rl⟩→rtl, ⟨nn⟩→tn, ⟨hr hj⟩.
    [InlineData("fjall", "fjˈatl")]
    [InlineData("karl", "kˈartl")]
    [InlineData("Steinn", "stˈeitn")]
    [InlineData("Hrafn", "rˈapn")]
    [InlineData("hjörtur", "çˈœrtʏr")]
    public void TheEpentheticAndDevoicedSonorantClusters(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // PREASPIRATION [h]: fortis geminates + a fortis stop before a sonorant.
    [InlineData("Frakki", "frˈahcɪ")]
    [InlineData("Hekla", "hˈɛhkla")]
    public void Preaspiration(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // The pre-velar-nasal change: ⟨ng nk⟩→[ŋk] with the vowel diphthongizing.
    [InlineData("bang", "pˈauŋk")]
    [InlineData("gengur", "cˈeiŋkʏr")]
    [InlineData("Alþingi", "ˈalθiŋcɪ")]
    public void ThePreVelarNasalChange(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // ⟨g⟩→[ɣ] word-final / pre-voiced, ⟨k g⟩→[x] before a voiceless stop, no double preaspiration.
    [InlineData("lag", "lˈaɣ")]
    [InlineData("Sigmar", "sˈɪɣmar")]
    [InlineData("lukt", "lˈʏxt")]
    [InlineData("drukkna", "trˈʏhkna")]
    public void SpirantizationAndNoDoublePreaspiration(string word, string want) => Assert.Equal(want, Word(word));

    [Fact]
    public void ClauseAssembly() =>
        Assert.Equal("jˈɛɣ tˈala ˈislɛnskʏ .", Say("Ég tala íslensku."));

    [Theory]
    // CARDINAL NUMBERS — tens-FIRST with "og" before the final unit, plus GENDER CONCORD on 1–4: a
    // multiplier agrees with its magnitude noun (hundrað/þúsund neuter, milljón feminine, milljarður
    // masculine), while a bare numeral takes the MASCULINE citation series.
    [InlineData(0, "núll")]
    [InlineData(7, "sjö")]
    [InlineData(2, "tveir")]                     // bare numeral → MASCULINE citation form
    [InlineData(21, "tuttugu og einn")]          // tens first, "og" before the unit
    [InlineData(45, "fjörutíu og fimm")]
    [InlineData(99, "níutíu og níu")]
    [InlineData(100, "eitt hundrað")]
    [InlineData(101, "eitt hundrað og einn")]    // single-word remainder takes "og"
    [InlineData(121, "eitt hundrað tuttugu og einn")] // …but a tens+unit pair does NOT get a 2nd
    [InlineData(200, "tvö hundruð")]             // hundrað is NEUTER → tvö, not tveir
    [InlineData(555, "fimm hundruð fimmtíu og fimm")]
    [InlineData(1000, "eitt þúsund")]
    [InlineData(1001, "eitt þúsund og einn")]
    [InlineData(12345, "tólf þúsund þrjú hundruð fjörutíu og fimm")]
    [InlineData(1000000, "ein milljón")]         // milljón is FEMININE → ein
    [InlineData(2000000, "tvær milljónir")]      // …→ tvær
    [InlineData(1000000000, "einn milljarður")]  // milljarður is MASCULINE → einn
    [InlineData(2000000000, "tveir milljarðar")] // …→ tveir
    public void NumbersTensFirstWithGenderConcord(double n, string want) =>
        Assert.Equal(want, Numbers.NumberToWords(n));

    [Theory]
    // Numbers wired into the phonemizer.
    [InlineData("21", "tˈʏhtʏɣʏ ˈɔɣ ˈeitn")]     // tuttugu og einn
    [InlineData("1000000", "ˈein mˈɪtljoun")]    // ein milljón
    public void NumbersWiredIntoThePhonemizer(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // ⚠ THE HIATUS GLIDE MUST NOT REACH A DIPHTHONG — pinned because #748 nearly widened it there.
    // TWO SEPARATE GUARDS hold this: the ⟨í⟩-only trigger set keeps erkiengill glideless (its ⟨i⟩ is
    // plain), and VOWEL_PH omitting plain ⟨e⟩ is what keeps þríeyki glideless — the assertion guarding
    // that one.
    [InlineData("erkiengill", "ˈɛrcɪeiŋcɪtl")]   // referee: …ɪ e i ɲ… — plain ⟨i⟩, no trigger
    [InlineData("þríeyki", "θrˈieicɪ")]          // ⟨í⟩ IS a trigger — blocked by VOWEL_PH instead
    public void TheHiatusGlideDoesNotReachADiphthong(string word, string want) => Assert.Equal(want, Word(word));

    [Fact]
    public void TheHiatusGlideFiresBeforeAPlainVowel() =>
        Assert.Contains("ja", Word("Biblía")); // the rule's own example — plain-vowel hiatus

    [Theory]
    // ⚠ THE GLIDE IS ⟨í⟩'S ALONE — measured, not reasoned. Plain ⟨i⟩ and ⟨ý⟩ do NOT take it, ⟨í⟩ does.
    [InlineData("hýena", "hˈiɛna")]
    [InlineData("beitieski", "pˈeitɪɛscɪ")]
    [InlineData("blýantur", "plˈiantʏr")]
    [InlineData("Albanía", "ˈalpanija")]
    public void OnlyTheLongIGlides(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // PRIMARY STRESS — fixed on the first syllable, marked before the nucleus. The mark goes before the
    // NUCLEUS (repo convention: nˈaða, not ˈnaða), which is what the onset cases pin. ⚠ THE REFEREE
    // CANNOT CHECK THIS — it carries zero stress marks — so these assertions ARE the guard.
    [InlineData("dagur", "tˈaɣʏr")]      // simple onset — the mark follows it
    [InlineData("Alaska", "ˈalaska")]    // vowel-initial → mark at position 0
    [InlineData("strjáll", "strjˈautl")] // deep onset /strj/ + the ⟨á⟩ diphthong nucleus
    [InlineData("ég", "jˈɛɣ")]           // ⟨é⟩ scans to "jɛ" — its [j] is an ONSET, not the nucleus
    [InlineData("Hekla", "hˈɛhkla")]     // the preaspirating [h] belongs to the CODA of σ1
    [InlineData("Steinn", "stˈeitn")]    // ⟨ei⟩ is a nucleus — the one ⟨e⟩ VOWEL_PH omits
    public void PrimaryStressIsFixedOnTheFirstSyllable(string word, string want) => Assert.Equal(want, Word(word));

    [Fact]
    public void NoNucleusNoMark() => Assert.Equal("θ", Word("þ")); // the referee's letter-name rows

    [Theory]
    // Icelandic ordinals AGREE IN GENDER AND CASE: a month name takes the masculine nominative -i, the
    // oblique forms of `öld` take -u, and everything else takes -a (the default).
    [InlineData("3. maí", "þriðji maí")]       // month → masc NOM
    [InlineData("18. öld", "átjánda öld")]     // öld is feminine NOM
    [InlineData("18. aldar", "átjándu aldar")] // feminine OBLIQUE
    [InlineData("9. sæti", "níunda sæti")]     // neuter
    [InlineData("1. dag", "fyrsta dag")]       // masculine ACCUSATIVE
    public void TheOrdinalFormIsSelectedByWhatFollowsIt(string input, string want) =>
        Assert.Equal(want, Norm(input));

    [Fact]
    public void ASentenceEndingInAYearKeepsItsFullStop() =>
        Assert.Equal("Árið 1990. Hann kom", Norm("Árið 1990. Hann kom"));

    [Theory]
    // Period-grouped thousands, decimal comma, colon clock.
    [InlineData("1.234", "1234")]
    [InlineData("12,5", "12 komma 5")]
    [InlineData("11:00", "11 00")]
    public void GroupingDecimalAndClock(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    [InlineData("25 %", "25 prósent")]
    [InlineData("5 km", "5 kílómetrar")]
    [InlineData("km²", "ferkílómetrar")]
    [InlineData("1990-1995", "1990 til 1995")]
    public void PercentUnitsSquaredAndRanges(string input, string want) => Assert.Equal(want, Norm(input));

    [Fact]
    public void OrdinaryIcelandicTextIsUntouched() =>
        Assert.Equal("Íslenska er tungumál.", Norm("Íslenska er tungumál."));

    [Fact]
    public void TheCubedUnit()
    {
        Assert.Contains("rˈumɛtrar", Say("5 m³"));
        Assert.Contains("rˈumciloumɛtrar", Say("5 km³"));
    }

    [Fact]
    public void BareMStaysOutOfTheUnitTable() =>
        Assert.Matches(@" m$", Say("802.11m")); // still a letter, not a metre

    [Fact]
    public void TheRateInIcelandicsOwnAbbreviation()
    {
        // The plain unit loop's guard is `(?!\p{L})`, which a slash satisfies, so the rate rule runs first.
        Assert.Contains("cˈiloumɛtrar ˈau", Say("83 km/klst."));
        Assert.Contains("cˈiloumɛtrar ˈau", Say("120 km/h"));
        Assert.Contains(" s", Say("133 m/s")); // untouched: no word for it
    }

    [Theory]
    // DOTTED ABBREVIATIONS — the whole of this corpus's raw-Latin residual apart from `mph`.
    [InlineData("handlegginn o.s.frv.", "handlegginn og svo framvegis")]
    [InlineData("(James o.fl., 1995)", "(James og fleira, 1995)")]
    [InlineData("o.s.frv. og fleira", "og svo framvegis og fleira")]
    // a word that merely BEGINS with the letters is not the abbreviation — no dot, no match
    [InlineData("ofl og osfrv", "ofl og osfrv")]
    public void TheDottedAbbreviations(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // ⟨mph⟩ — a rate written as ONE token, so the `km/klst` rule has no slash to key on.
    [InlineData("300 mph", "300 mílur á klukkustund")]
    [InlineData("40 mph (64 km/klst)", "40 mílur á klukkustund (64 kílómetrar á klukkustund)")]
    public void MphIsARateInOneToken(string input, string want) => Assert.Equal(want, Norm(input));

    [Fact]
    public void MphWiredIntoThePhonemizer() => Assert.Contains("mˈilʏr ˈau", Say("300 mph"));

    [Fact]
    public void RegistryWiring() => Assert.Equal("jˈɛɣ tˈala ˈislɛnskʏ .", Say("Ég tala íslensku."));
}
