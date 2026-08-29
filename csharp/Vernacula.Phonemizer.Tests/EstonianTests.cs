/**
 * Estonian (et) — eesti keel, Uralic (Finnic). Nearly as phonemic as Finnish at the SEGMENT level, so the
 * engine is a greedy grapheme scan + gemination + fixed first-syllable stress.
 *
 * ⚠ THE DEFINING CLASS IS THE ORDINAL, written as a bare `N.` — a digit and a period, which is also a
 * sentence end — and it must AGREE IN CASE with the noun that follows. The rule reads the head word,
 * derives its case from a noun-stem table, and composes the ordinal in that case.
 *
 * The portable half of test/estonian.test.ts. Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Estonian;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EstonianTests
{
    private static string Word(string s) => EstonianPhonemizer.PhonemizeWord(s);
    private static string Norm(string s) => Normalize.NormalizeEstonian(s);
    private static string Init(string s) => Normalize.NormalizeEstonianInitialisms(s);

    [Theory]
    [InlineData("õun", "ˈɤun")]              // õ→ɤ
    [InlineData("külm", "kˈylm")]
    [InlineData("töö", "tˈøː")]              // a doubled VOWEL is always long
    [InlineData("kõik", "kˈɤik")]
    [InlineData("pea", "pˈeɑ")]
    [InlineData("kass", "kˈɑsː")]            // a doubled consonant AFTER A VOWEL is a geminate
    [InlineData("tikk", "tˈikː")]
    [InlineData("raamat", "rˈɑːmɑt")]
    // ⚠ …but a doubled consonant after ANOTHER CONSONANT is a compound-boundary CLUSTER, not a geminate.
    [InlineData("keskkool", "kˈeskkoːl")]
    [InlineData("Eesti", "ˈeːsti")]
    [InlineData("linn", "lˈinː")]
    [InlineData("õpetaja", "ˈɤpetɑjɑ")]
    [InlineData("taxi", "tˈɑksi")]           // the non-native ⟨x⟩ nativises to [ks]
    public void ReadsTheGraphemeScan(string input, string expected) => Assert.Equal(expected, Word(input));

    [Theory]
    // The ordinal in the NOMINATIVE — the sentinel case.
    [InlineData(1, "esimene")]
    [InlineData(2, "teine")]
    [InlineData(3, "kolmas")]
    [InlineData(9, "üheksas")]
    [InlineData(10, "kümnes")]
    [InlineData(11, "üheteistkümnes")]
    [InlineData(19, "üheksateistkümnes")]
    [InlineData(20, "kahekümnes")]
    [InlineData(22, "kahekümne teine")]
    [InlineData(100, "sajas")]
    [InlineData(126, "saja kahekümne kuues")]
    [InlineData(900, "üheksasajas")]
    [InlineData(1000, "tuhandes")]
    [InlineData(2000, "kahe tuhandes")]
    public void ComposesTheNominativeOrdinal(int n, string expected) =>
        Assert.Equal(expected, Normalize.Ordinal(n, Normalize.NOMINATIVE));

    [Theory]
    // …and in an oblique case, where the STEM takes the noun's own ending.
    [InlineData(22, "l", "kahekümne teisel")]
    [InlineData(100, "l", "sajandal")]
    [InlineData(2011, "l", "kahe tuhande üheteistkümnendal")]
    [InlineData(1924, "l", "tuhande üheksasaja kahekümne neljandal")]
    [InlineData(9999, "", "üheksa tuhande üheksasaja üheksakümne üheksanda")]
    [InlineData(1920, "tel", "tuhande üheksasaja kahekümnendatel")]
    public void ComposesTheObliqueOrdinal(int n, string ending, string expected) =>
        Assert.Equal(expected, Normalize.Ordinal(n, ending));

    [Theory]
    // The ordinal agreeing with its head noun, across the case system.
    [InlineData("1924. aastal", "tuhande üheksasaja kahekümne neljandal aastal")]
    [InlineData("19. sajandil", "üheksateistkümnendal sajandil")]
    [InlineData("1913. aasta", "tuhande üheksasaja kolmeteistkümnenda aasta")]
    [InlineData("2005. aastast", "kahe tuhande viiendast aastast")]
    [InlineData("2012. aastaks", "kahe tuhande kaheteistkümnendaks aastaks")]
    [InlineData("1766. aastat", "tuhande seitsmesaja kuuekümne kuuendat aastat")]
    [InlineData("19. sajandini", "üheksateistkümnenda sajandini")]
    [InlineData("1920. aastatel", "tuhande üheksasaja kahekümnendatel aastatel")]
    [InlineData("1980. aastail", "tuhande üheksasaja kaheksakümnendail aastail")]
    [InlineData("9. augustil", "üheksandal augustil")]
    [InlineData("24. oktoober", "kahekümne neljas oktoober")]
    [InlineData("1868. aastani", "tuhande kaheksasaja kuuekümne kaheksanda aastani")]
    [InlineData("kuni 9. oktoobrini 1933", "kuni üheksanda oktoobrini 1933")]
    [InlineData("3.–8. sajandini", "kolmanda kaheksanda sajandini")]
    [InlineData("15.–16. eluaastani", "viieteistkümnenda kuueteistkümnenda eluaastani")]
    [InlineData("7. ja 6. sajandil", "seitsmendal ja kuuendal sajandil")]
    [InlineData("1. ametlik", "esimene ametlik")]
    // ⚠ …and the refusals. An unknown head noun means no case, so the figure is LEFT ALONE — a bare `N.`
    // is otherwise a sentence end, and guessing would put an ordinal into ordinary prose.
    [InlineData("1. tundmatu", "1. tundmatu")]
    [InlineData("1921. aastatel", "1921. aastatel")]   // plural ordinal of …21 has no composable form
    [InlineData("aastal 1964. See nägi ette", "aastal 1964. See nägi ette")]
    [InlineData("Historical Method. New York 1946.", "Historical Method. New York 1946.")]
    // De-grouping, ranges, the decimal comma and the genitive suffix.
    [InlineData("84 000 km²", "84000 km²")]
    [InlineData("2 831 741 elanikku", "2831741 elanikku")]
    [InlineData("28 150 000 eurot", "28150000 eurot")]
    [InlineData("tõsta 4-le", "tõsta neljale")]
    [InlineData("tõste on $2-le", "tõste on $2-le")]   // a currency-prefixed figure is not a numeral here
    [InlineData("5000–6000-ni", "5000–kuue tuhandeni")]
    [InlineData("63-aastaselt", "63-aastaselt")]
    [InlineData("2,6-trimetüül", "2 koma 6-trimetüül")]
    [InlineData("1,5% SKP-st", "1 koma 5% SKP-st")]
    // Degrees — ⚠ NOT SAID TWICE when `kraad…` is already in the clause window.
    [InlineData("25 °C", "25 kraadi")]
    [InlineData("46° ja 49° põhjalaiuse", "46 kraadi ja 49 kraadi põhjalaiuse")]
    [InlineData("ligikaudu 109°.", "ligikaudu 109 kraadi.")]
    [InlineData("Kraadini ulatub 26 °C", "Kraadini ulatub 26")]
    [InlineData("38°51' ja 41°16'", "38°51' ja 41°16'")]   // a coordinate, not a temperature
    [InlineData("5–13,7 °C", "5–13 koma 7 kraadi")]
    // Signs, era markers and the dotted abbreviations.
    [InlineData("alla −15 °C", "alla miinus 15 kraadi")]
    [InlineData("maakood on +376", "maakood on pluss 376")]
    [InlineData("322 eKr", "322 enne Kristust")]
    [InlineData("3.–4. sajandil pKr", "kolmandal neljandal sajandil pärast Kristust")]
    [InlineData("632 m.a.j.", "632 meie aja arvamise järgi")]
    [InlineData("vaata ka jt.", "vaata ka ja teised.")]
    [InlineData("nt. kass", "näiteks kass")]
    [InlineData("nr 665", "number 665")]
    [InlineData("sh hazara keel", "sealhulgas hazara keel")]
    [InlineData("u 1230 Werna", "umbes 1230 Werna")]
    // The clock needs `kell` before it; a bare `H.MM` is not a time of day.
    [InlineData("6.30 ja 7.30 vahel", "6.30 ja 7.30 vahel")]
    [InlineData("võit, 21:20, mis lõpetas", "võit, 21:20, mis lõpetas")]
    [InlineData("Standard 802.11n toimib", "Standard 802.11n toimib")]
    [InlineData("n o r t u ũ w y", "n o r t u ũ w y")]
    public void TheNormalizerSteps(string input, string expected) => Assert.Equal(expected, Norm(input));

    [Theory]
    // Initialisms — spelled letter by letter, with the inflectional suffix attaching to the LAST name.
    [InlineData("SKP kasvas", "ess kaa pee kasvas")]
    [InlineData("NATO ja UNESCO", "NATO ja UNESCO")]          // pronounceable → read as words
    [InlineData("Šveitsi ja USA turg", "Šveitsi ja uu ess aa turg")]
    [InlineData("1,5% SKP-st", "1,5% ess kaa peest")]
    [InlineData("ja USA-sse", "ja uu ess aasse")]
    [InlineData("SNCF-i liin", "ess enn tsee effi liin")]
    [InlineData("TGV-rongile", "tee gee vee-rongile")]
    [InlineData("SI-süsteemis", "SI-süsteemis")]             // two letters, pronounceable → left alone
    public void TheInitialismPass(string input, string expected) => Assert.Equal(expected, Init(input));

    [Fact]
    public void RegistryWiring() => Assert.Equal("ˈeːsti", Phonemizer.Phonemize("Eesti", "et").Trim());
}
