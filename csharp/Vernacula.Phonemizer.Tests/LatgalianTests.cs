/**
 * The portable half of test/latgalian.test.ts — Latgalian (ltg), an East Baltic language of eastern Latvia.
 * A greedy grapheme scan plus the Latgalian PALATALIZATION system (the whole ONSET softens before a front
 * vowel ⟨i ī e ē⟩, with /r/ OPAQUE in both directions), the ⟨v⟩→[w] coda rule, the t-epenthesis after a
 * nasal, and regressive Baltic voicing assimilation with word-final devoicing.
 *
 * Every expected value here is the TypeScript engine's own output, extracted mechanically from its suite.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Core;
using Xunit;
using LtgEngine = Vernacula.Phonemizer.Languages.Latgalian.LatgalianPhonemizer;
using LtgNormalize = Vernacula.Phonemizer.Languages.Latgalian.Normalize;
using LtgNumbers = Vernacula.Phonemizer.Languages.Latgalian.Numbers;

namespace Vernacula.Phonemizer.Tests;

public class LatgalianTests
{
    private static readonly JsRe WS = JsRegex.Compile("\\s+", "gu");
    private static string Word(string s) => LtgEngine.PhonemizeWord(s);
    private static string N(string s) => LtgNormalize.NormalizeLatgalian(s);
    private static string Say(string s) => Js.Trim(WS.Replace(Phonemizer.Phonemize(s, "ltg"), " "));

    /** The scan, the palatalization with its /r/ opacity, the ⟨v⟩ coda, t-epenthesis and voicing. */
    [Theory]
    [InlineData("cylvāks", "t͡sɨlvaːks")]
    [InlineData("byut", "bɨut")]
    [InlineData("acis", "at͡sʲis")]
    [InlineData("bet", "bʲæt")]
    [InlineData("bazneica", "bazʲnʲæit͡sa")]
    [InlineData("mute", "mutʲæ")]
    [InlineData("ķēneņš", "kʲæːnʲænʲt͡ʃ")]
    [InlineData("latgaļu", "ladɡalʲu")]
    [InlineData("sens", "sʲænt͡s")]
    [InlineData("akmiņs", "akʲmʲinʲt͡sʲ")]
    [InlineData("treis", "træis")]
    [InlineData("svareigs", "zvarʲæiks")]
    [InlineData("div", "dʲif")]
    [InlineData("volūda", "vɔluːda")]
    [InlineData("Latgola", "ladɡɔla")]
    [InlineData("atzeit", "ad͡zʲæit")]
    public void ThePhonemizer(string word, string want) => Assert.Equal(want, Word(word));

    /** The normalization pre-pass — the ordinal period, de-grouping, the tier, degrees, decimals, ranges. */
    [Theory]
    [InlineData("1577 g. — Ivana Borguo vodomi", "1577 g. — Ivana Borguo vodomi")]
    [InlineData("svors — 650—800 g.", "svors — 650, 800 g.")]
    [InlineData("Atostums da Rēzeknei — 80 km", "Atostums da Rēzeknei — 80 kilometri")]
    [InlineData("Ola irā 1 km iz DV", "Ola irā 1 kilometrs iz DV")]
    [InlineData("vaira kai 1,500 solu", "vaira kai 1500 solu")]
    [InlineData("548,000 cylvāku", "548000 cylvāku")]
    [InlineData("Vydyskais dziļums 12,8 m.", "Vydyskais dziļums 12 8 metri.")]
    [InlineData("apmāram 0,702804 latu", "apmāram 0 702804 latu")]
    [InlineData("mīsts ar 9 223 766 dzeivuotuojim", "mīsts ar 9223766 dzeivuotuojim")]
    [InlineData("joma 83 871 km².", "joma 83871 kvadratkilometrs.")]
    [InlineData("temperatura irā 5.2 °C", "temperatura irā 5 2 gradi pa Celseja skolai")]
    [InlineData("(, 17.12.1932 — 18.02.2004)", "(, 17.12.1932, 18.02.2004)")]
    [InlineData("Nu 1964. da 1968. godam", "Nu 1964 da 1968 godam")]
    [InlineData("1901.godā īsuoca vuiceibys", "1901 godā īsuoca vuiceibys")]
    [InlineData("2009, 143.–153. lpp.", "2009, 143, 153 lpp.")]
    [InlineData("mozuokais, 3000. Partū taidu", "mozuokais, 3000. Partū taidu")]
    [InlineData("Īstateišonys gods – 1957.", "Īstateišonys gods – 1957.")]
    [InlineData("juļa mienesī +17°C.", "juļa mienesī +17 gradi pa Celseja skolai.")]
    [InlineData("(–43 gradi C), i Daugpilī", "(–43 gradi pa Celseja skolai), i Daugpilī")]
    [InlineData("tik 9,6° augšuok horizonta", "tik 9 6 gradi augšuok horizonta")]
    [InlineData("krytuļu daudzums ap 650—700 mm", "krytuļu daudzums ap 650, 700 mm")]
    [InlineData("Vuicejusēs pamatškolā (1966-1970)", "Vuicejusēs pamatškolā (1966, 1970)")]
    [InlineData("XVI gs. vydā – jau 120-150.", "XVI gs. vydā – jau 120, 150.")]
    [InlineData("2003/2004 g. sezonā", "2003/2004 g. sezonā")]
    [InlineData("† ap 240 g. p. Kr.) – vīns nu", "† ap 240 g. pyrma Krystus) – vīns nu")]
    [InlineData("Ap 290 g. p. Kr.", "Ap 290 g. pyrma Krystus.")]
    [InlineData("viņ 26*26=676 kombinacejis", "viņ 26 reiz 26=676 kombinacejis")]
    [InlineData("(; * ap 310—305 g.", "(; * ap 310, 305 g.")]
    [InlineData("Inflaceja 2004 godā beja 3%.", "Inflaceja 2004 godā beja 3 procenti.")]
    [InlineData("dasnīdze 21%", "dasnīdze 21 procents")]
    [InlineData("15,3 % Igaunejis", "15 3 procenti Igaunejis")]
    [InlineData("budžets tur €151 miljonu", "budžets tur 151 miljonu euru")]
    [InlineData("aizjamūt 2,300 km² lelu pluotu", "aizjamūt 2300 kvadratkilometri lelu pluotu")]
    [InlineData("Peipuss — 3,555 km2 pluotā", "Peipuss — 3555 kvadratkilometri pluotā")]
    public void TheNormalizer(string input, string want) => Assert.Equal(want, N(input));


    [Fact]
    public void TheShippedPath() => Assert.Equal("txɔmas i xʲintɔn", Say("Thomas & Hinton"));

    /**
     * ⚠ `ReadDigits` ITERATES CODE UNITS, AND THAT IS THE FAITHFUL READING — the TypeScript spells it
     * `digits.split("")`, and `String.prototype.split("")` splits by UTF-16 CODE UNIT. So an astral
     * character comes back as TWO LONE SURROGATES with a space between them, exactly as the reference
     * engine does it. Spreading by code point — which #1193 corrected six OTHER languages TO — would be a
     * DIVERGENCE here, the same way it would be for afrikaans and georgian. Asserted on purpose so a later
     * tidy-up has to argue with the source.
     *
     * ⚠ AND THE STRINGS ARE BUILT IN THE BODY, NOT PASSED AS `InlineData`. xUnit serializes theory
     * arguments, and a LONE SURROGATE does not survive that round trip — it comes back as U+FFFD, so the
     * rows silently stop testing what they say. (The well-formed PAIR survives; only the halves do not.)
     * Same family as the duplicate-ID collapse: a theory row that cannot carry its own data is worse than
     * no row, because it still reports green.
     */
    [Fact]
    public void ReadDigitsIteratesCodeUnitsNotCodePoints()
    {
        const string hi = "\ud83d", lo = "\ude00";
        Assert.Equal($"vīns {hi} {lo} divi", LtgNumbers.ReadDigits($"1{hi}{lo}2"));
        Assert.Equal($"{hi} {lo}", LtgNumbers.ReadDigits($"{hi}{lo}"));
        Assert.Equal("a b c", LtgNumbers.ReadDigits("abc"));
        Assert.Equal("", LtgNumbers.ReadDigits(""));
    }

    /** ⚠ A LONE SURROGATE MUST NOT THROW — `PhonemizeWord` NFCs the raw word, which is #1199's shape.
     *  Built in the body for the same reason as above. ⚠ `a\ud83db` reads as "ap", not "ab": the stranded
     *  half is dropped and word-final DEVOICING then turns the /b/ into [p]. Taken from the TS, not guessed
     *  — the first draft of this pin asserted "ab" and was wrong. */
    [Fact]
    public void ALoneSurrogateDoesNotThrow()
    {
        const string hi = "\ud83d";
        Assert.Equal("", Word(hi));
        Assert.Equal("a", Word($"a{hi}"));
        Assert.Equal("ap", Word($"a{hi}b"));
    }

    /** ⚠ THE FEMININE THOUSANDS MULTIPLIER — the thing this number table exists for. */
    [Theory]
    [InlineData(1000, "tyukstūša")]
    [InlineData(6000, "sešys tyukstūšys")]
    [InlineData(1000000, "vīns miļjons")]
    [InlineData(0, "nulle")]
    [InlineData(21, "divdesmit vīns")]
    public void TheFeminineThousandAndTheCountConcord(double n, string want) =>
        Assert.Equal(want, LtgNumbers.NumberToWords(n));
}
