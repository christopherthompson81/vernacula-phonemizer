// The portable half of test/slovak.test.ts — the branches the 200-row golden cannot reach: the g2p's context
// systems, the ordinal-case machinery, the three-way count agreement, and the normalize arms (licensed and
// general ordinals, the governed clock, the signs, and the initialism seam).
using Vernacula.Phonemizer;
using SlovakEngine = Vernacula.Phonemizer.Languages.Slovak.SlovakPhonemizer;
using SlovakNormalize = Vernacula.Phonemizer.Languages.Slovak.Normalize;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class SlovakTests
{
    [Theory]
    [InlineData("deň", "ɟˈeɲ")]            // d→ɟ before e, ň→ɲ
    [InlineData("deti", "ɟˈeci")]          // d→ɟ, t→c
    [InlineData("list", "ʎˈist")]          // l→ʎ before i
    [InlineData("milý", "mˈiliː")]         // ý is HARD → l stays plain l
    [InlineData("ľúbiť", "ʎˈuːbic")]      // ľ=ʎ, ú=uː, ť=c
    [InlineData("chlieb", "xʎˈɪ̯ep")]      // ch=x, l→ʎ, ie=ɪ̯e, final b→p
    [InlineData("kôň", "kˈu̯ɔɲ")]           // ô=u̯ɔ, ň=ɲ
    [InlineData("mäso", "mˈæsɔ")]           // ä=æ
    [InlineData("dievča", "ɟˈɪ̯evt͡ʃa")]     // d→ɟ, ie=ɪ̯e, v INERT before č
    [InlineData("vlk", "vˈl̩k")]            // syllabic l̩
    [InlineData("krv", "kˈr̩v")]            // syllabic r̩, v inert
    [InlineData("stĺp", "stˈl̩ːp")]         // long syllabic ĺ → l̩ː
    [InlineData("vták", "ftˈaːk")]          // ONSET v → f before voiceless t
    [InlineData("včera", "ft͡ʃˈera")]       // onset v → f before č
    [InlineData("stav", "stˈav")]           // final (coda) v stays v (NOT f)
    [InlineData("pravda", "prˈavda")]       // coda v before d stays v
    [InlineData("ch", "x")]                 // ch digraph = x
    public void PhonemizeWordReadsTheContextSystems(string word, string want) =>
        Assert.Equal(want, SlovakEngine.PhonemizeWord(word));

    [Theory]
    [InlineData("0", "nˈula")]
    [InlineData("15", "pˈætnaːsc")]          // pätnásť
    [InlineData("21", "dvˈatsacjˌeɟen")]     // dvadsaťjeden
    [InlineData("1000", "cˈisiːt͡s")]         // tisíc (t→c before i)
    [InlineData("2000", "dvˈa cˈisiːt͡se")]   // dva tisíce — masc. inan. (not *dve tisíce)
    [InlineData("5000", "pˈæc cˈisiːt͡s")]    // päť tisíc — indeclined after 5+
    [InlineData("21000", "dvˈatsacjˌeɟen cˈisiːt͡s")]
    [InlineData("1000000", "mˈiʎiɔːn")]     // milión — bare, no leading jeden
    [InlineData("2000000", "dvˈa mˈiʎiˌɔːni")] // dva milióny — masc. inan. (not *dve milióny)
    // >9 digits: read digit-by-digit (no miliarda tier; no float precision loss)
    [InlineData("1000000000", "jˈeɟen nˈula nˈula nˈula nˈula nˈula nˈula nˈula nˈula nˈula")]
    public void CardinalNumbers(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "sk").Trim());

    [Fact]
    public void WordsAndClausePunctuation() =>
        Assert.Equal("mˈestɔ jˈe pˈekneː .", Phonemizer.Phonemize("Mesto je pekné.", "sk").Trim());

    // The ordinal has three branches: the 1–19 TABLE, the tens+units COMPOSITION, and the BOUNDARY
    // (hundreds/thousands prefix stays cardinal while every ordinal element inflects).
    [Theory]
    [InlineData(16, "n.loc", "šestnástom")]
    [InlineData(3, "m.gen", "tretieho")]     // the ONLY soft ordinal: tretí → tretieho
    [InlineData(3, "n.loc", "treťom")]
    [InlineData(8, "m.gen", "ôsmeho")]       // rhythmic law: ôsmy → ôsmeho, never *ôsmého
    [InlineData(7, "m.instr", "siedmym")]
    [InlineData(24, "m.gen", "dvadsiateho štvrtého")] // BOTH elements inflect
    [InlineData(23, "m.gen", "dvadsiateho tretieho")]  // the soft tail inside a compound
    [InlineData(37, "f.instr", "tridsiatou siedmou")]
    [InlineData(190, "n.loc", "sto deväťdesiatom")]
    [InlineData(100, "m.gen", "stého")]      // the exact-hundred branch
    [InlineData(1918, "m.gen", "tisíc deväťsto osemnásteho")]
    public void OrdinalBranches(double n, string slot, string want) =>
        Assert.Equal(want, SlovakNormalize.OrdinalWords(n, slot));

    [Fact]
    public void AnExactThousandIsDeclined() =>
        Assert.Null(SlovakNormalize.OrdinalWords(1000, "m.nom"));

    [Theory]
    [InlineData("V 16. storočí sa Paraguaj.", "V šestnástom storočí sa Paraguaj.")]
    [InlineData("Do 17. septembra 1939", "Do sedemnásteho septembra 1939")]
    [InlineData("V 60. rokoch 20. storočia.", "V šesťdesiatych rokoch dvadsiateho storočia.")]
    [InlineData("na 190. mieste", "na sto deväťdesiatom mieste")]
    [InlineData("búrka 4. kategórie", "búrka štvrtej kategórie")]
    [InlineData("jeho 60. gólom", "jeho šesťdesiatym gólom")]
    [InlineData("v 11., 12. a 13. storočí", "v jedenástom, dvanástom a trinástom storočí")]
    [InlineData("z obdobia 19. a začiatku 20. storočia", "z obdobia devätnásteho a začiatku dvadsiateho storočia")]
    [InlineData("5. ročník", "piaty ročník")]
    // REGNAL: the agreement comes from the NAME's own ending, not the following word.
    [InlineData("kráľovná Alžbeta 2. mala byť", "kráľovná Alžbeta druhá mala byť")]
    [InlineData("kráľovnej Alžbety 2. mala", "kráľovnej Alžbety druhej mala")]
    [InlineData("náčelníka Lealofiho 3. viedol", "náčelníka Lealofiho tretieho viedol")]
    [InlineData("stanice Fort Greely 9.", "stanice Fort Greely 9.")] // an utterance END
    public void LicensedOrdinalsAgreeWithTheNoun(string input, string want) =>
        Assert.Equal(want, SlovakNormalize.NormalizeSlovak(input));

    // A `N.` that is a SENTENCE END must not be claimed: Slovak writes a year as a CARDINAL.
    [Theory]
    [InlineData("Charles Darwin v roku 1835.", "Charles Darwin v roku 1835.")]
    [InlineData("v roku 2020.", "v roku 2020.")]
    [InlineData("s počtom bodov 2 243.", "s počtom bodov 2243.")] // de-grouped, period kept
    [InlineData("t.j. 0 alebo 1. Tieto čísla", "to jest 0 alebo 1. Tieto čísla")]
    [InlineData("hladinou v roku 2005.“", "hladinou v roku 2005.“")]
    public void ASentenceFinalPeriodIsNotAnOrdinal(string input, string want) =>
        Assert.Equal(want, SlovakNormalize.NormalizeSlovak(input));

    [Theory]
    [InlineData("1 km a 2 km a 5 km a 22 km", "1 kilometer a 2 kilometre a 5 kilometrov a 22 kilometrov")]
    [InlineData("1 % a 3 % a 21 %", "1 percento a 3 percentá a 21 percent")]
    // the clock's hour noun is FEMININE, so the numeral is too: jedna/dve, never jeden/dva
    [InlineData("1:15 ráno", "jedna hodina pätnásť minút ráno")]
    [InlineData("(15:00 univerzálneho", "(pätnásť hodín univerzálneho")]
    public void ThreeWayCountAgreement(string input, string want) =>
        Assert.Equal(want, SlovakNormalize.NormalizeSlovak(input));

    [Theory]
    [InlineData("Presne o 8:46 ráno", "Presne o ôsmej štyridsaťšesť ráno")]
    [InlineData("Tesne po 11:00 demonštranti", "Tesne po jedenástej demonštranti")]
    [InlineData("do 23:35 hod uhasili.", "do dvadsiatej tretej tridsaťpäť uhasili.")] // `hod` consumed once
    [InlineData("o 12.00 GMT", "o dvanástej gé em té")] // the PERIOD clock, + step 15
    [InlineData("odchádza medzi 06:30 a 07:30.", "odchádza medzi šiestou tridsať a siedmou tridsať.")]
    [InlineData("oheň medzi 22:00 - 23:00 Horského", "oheň medzi dvadsiatou druhou a dvadsiatou treťou Horského")]
    [InlineData("zvíťazila 26:00 nad Zambiou", "zvíťazila 26:00 nad Zambiou")] // a SCORE
    [InlineData("je 7:2.", "je 7:2.")]
    public void ClockTheGoverningPrepositionPicksTheCase(string input, string want) =>
        Assert.Equal(want, SlovakNormalize.NormalizeSlovak(input));

    [Theory]
    [InlineData("získal 88 % čistých bodov", "získal 88 percent čistých bodov")]
    [InlineData("od 11 000 $ do 22 500 $", "od 11000 dolárov do 22500 dolárov")]
    [InlineData("teploty nad +30°C.", "teploty nad plus 30 stupňov Celzia.")]
    [InlineData("-5 stupňov", "mínus 5 stupňov")]
    [InlineData("negatív má 36x24 mm", "negatív má 36 krát 24 milimetrov")]
    [InlineData("B&B súťažia", "bé a bé súťažia")] // joined AND spelled
    [InlineData("5 < 6", "5 menší ako 6")]
    [InlineData("7 > 3", "7 väčší ako 3")]
    [InlineData("x = y", "x rovná sa y")]
    [InlineData("8 ÷ 2", "8 delené 2")]
    [InlineData("19 500 km²", "19500 štvorcových kilometrov")]
    [InlineData("64 km/h", "64 kilometrov na hodinu")]
    [InlineData("40 míľ/h", "40 míľ za hodinu")]
    public void EverySignClassIsRead(string input, string want) =>
        Assert.Equal(want, SlovakNormalize.NormalizeSlovak(input));

    [Theory]
    [InlineData("približne 4 800 km", "približne 4800 kilometrov")]
    [InlineData("2,4 GHz", "2 čiarka 4 gigahertzov")]
    [InlineData("často 160 – 320 km/h", "často 160 do 320 kilometrov na hodinu")]
    [InlineData("stavu 6-6 vyžiadalo", "stavu 6-6 vyžiadalo")] // equal endpoints ⇒ a SCORE
    [InlineData("typu Il-76.", "typu Il-76.")] // a designation, not a range
    [InlineData("štandardu 802.11n", "štandardu 802 bodka 11n")]
    [InlineData("356 pred n.l. Išlo o akt", "356 pred naším letopočtom. Išlo o akt")]
    [InlineData("okolo roku 400 n. l. a trvala", "okolo roku 400 nášho letopočtu a trvala")]
    [InlineData("výšku 4892 m n. m.", "výšku 4892 metrov nad morom.")]
    [InlineData("jedlá atď., obetovaných", "jedlá a tak ďalej, obetovaných")]
    [InlineData("tuniak atď.", "tuniak a tak ďalej.")]
    [InlineData("Dr. Ehud Ur", "doktor Ehud Ur")]
    [InlineData("kozmonaut č. 11", "kozmonaut číslo 11")]
    public void ThousandsDecimalsRangesVersionEraAbbreviations(string input, string want) =>
        Assert.Equal(want, SlovakNormalize.NormalizeSlovak(input));

    [Theory]
    [InlineData("3/4", "tri štvrtiny")]
    [InlineData("1/5", "jedna pätina")]
    [InlineData("2/3", "dve tretiny")] // feminine dve, not dva
    [InlineData("od roku 1995/96, ktorý", "od roku 1995/96, ktorý")]
    public void FractionsComposeAndASegmentIsNotAFraction(string input, string want) =>
        Assert.Equal(want, SlovakNormalize.NormalizeSlovak(input));

    [Theory]
    [InlineData("V 16. storočí.", "v ʃˈestnaːstɔm stˈɔrɔt͡ʃiː .")]
    [InlineData("88 %", "ˈɔsemɟˌesɪ̯atˌɔsem pˈert͡sent")]
    public void EndToEndTheNormalizedTextReachesTheG2p(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "sk").Trim());

    [Theory]
    [InlineData("USA a OSN", "ú es á a ó es en")]
    [InlineData("MRI a FBI", "em er í a ef bé í")]
    [InlineData("HDP vzrástol", "há dé pé vzrástol")]
    [InlineData("cez VPN", "cez vé pé en")]
    [InlineData("PTWC vydalo", "pé té dvojité vé cé vydalo")]
    [InlineData("J. S. Bach", "jé es Bach")]
    public void InitialismsSpelledOrLeftToTheOovG2p(string input, string want) =>
        Assert.Equal(want, SlovakNormalize.NormalizeSlovak(input));

    [Theory]
    [InlineData("UNESCO")]
    [InlineData("NASA")]
    [InlineData("OPEC")]
    [InlineData("SWAPO")]
    [InlineData("FIFA")]
    [InlineData("PALM")]
    public void AcronymsThatAreWordsStayWords(string word) =>
        Assert.Equal($"{word} uviedla", SlovakNormalize.NormalizeSlovak($"{word} uviedla"));

    // The seam's ordering constraint, pinned end-to-end: core/roman runs in the REGISTRY, before the engine.
    [Theory]
    [InlineData("Alžbeta II. navštívila", "ˈalʒbeta drˈuɦaː nˈavʃciːvˌila")]
    [InlineData("Ľudovít XIV. bol", "ʎˈudɔviːt ʃtˈr̩naːsti bˈɔl")]
    [InlineData("Ľudovít XV. bol", "ʎˈudɔviːt pˈætnaːsti bˈɔl")] // vowel-less Roman
    public void ARomanNumeralSurvivesTheInitialismPass(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "sk").Trim());

    [Fact]
    public void AnAllCapsLineIsLeftAlone() =>
        Assert.Equal("SPRÁVA O STAVE KRAJINY", SlovakNormalize.NormalizeSlovak("SPRÁVA O STAVE KRAJINY"));

    [Theory]
    [InlineData("v St. Louis v štáte", "v St Louis v štáte")]
    [InlineData("stanica st.", "stanica st.")] // sentence-final: pause kept
    public void StLosesItsDotAndKeepsItsSilence(string input, string want) =>
        Assert.Equal(want, SlovakNormalize.NormalizeSlovak(input));
}
