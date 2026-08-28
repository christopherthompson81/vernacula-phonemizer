// The portable half of test/kirundi.test.ts — Kirundi / Ikirundi (rn), Bantu JD62 over the Latin
// orthography. Tone (H/L) is unwritten and DEFERRED, so the output is segmental.
//
// ⚠ rn HAS NO FLEURS SPLIT (the catalogue says `fleurs 0` and there is no `rn` transcript directory), so
// PORTING.md's corpus-wide differential is unavailable in its usual form and the weight falls on these plus
// the off-golden probes. See docs/rn_port_investigation.md.
//
// ⚠ KINYARWANDA IS NOT A SOURCE FOR KIRUNDI — seven normalizer rules diverge after re-measurement, and the
// cases below pin the ones that would silently read as rw if the sibling's table were copied.
using Vernacula.Phonemizer;
using RnEngine = Vernacula.Phonemizer.Languages.Kirundi.KirundiPhonemizer;
using RnNormalize = Vernacula.Phonemizer.Languages.Kirundi.Normalize;
using RnNumbers = Vernacula.Phonemizer.Languages.Kirundi.Numbers;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class KirundiTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "rn").Trim();
    private static string Norm(string s) => RnNormalize.NormalizeKirundi(s);

    [Theory]
    // ⚠ THE ONE CONFIDENT KIRUNDI DELTA: ⟨j⟩ → d͡ʒ, the AFFRICATE, against Kinyarwanda's fricative ʒ.
    [InlineData("jana", "d͡ʒana")]
    [InlineData("ijwi", "id͡ʒwi")]
    // The Cox palatal series ⟨Cy⟩ → Cʲ, and the trigraph ⟨shy⟩ ahead of the digraphs.
    [InlineData("cyane", "kʲane")]
    [InlineData("shyashya", "ʃʲaʃʲa")]
    [InlineData("byinshi", "bʲinʃi")]
    [InlineData("ryari", "ɾʲaɾi")]
    // ⟨ny⟩ is the PHONEMIC palatal nasal, not palatalisation; ⟨ng⟩ is the plain velar nasal, NOT ŋɡ.
    [InlineData("nyene", "ɲene")]
    [InlineData("ngaha", "ŋaha")]
    // ⟨c⟩ → t͡ʃ, ⟨r⟩ → ɾ, and written vowel length IS emitted.
    [InlineData("canke", "t͡ʃanke")]
    [InlineData("kabiri", "kabiɾi")]
    [InlineData("gushika", "ɡuʃika")]
    public void TheGreedyScan(string word, string want) => Assert.Equal(want, RnEngine.PhonemizeWord(word));

    [Theory]
    // The shared Rwanda-Rundi compositor over rn's OWN table: 7 indwi, 9 icenda, 20 the regular
    // mirongo ibiri (not the fused Kinyarwanda makumyabiri), and 10⁶ umuriyoni.
    [InlineData(7, "indwi")]
    [InlineData(9, "icenda")]
    [InlineData(10, "icumi")]
    [InlineData(18, "icumi na umunani")]
    [InlineData(20, "mirongo ibiri")]
    [InlineData(100, "ijana")]
    [InlineData(500, "amajana atanu")]
    [InlineData(517, "amajana atanu na icumi na indwi")]
    [InlineData(1000, "igihumbi")]
    [InlineData(2000, "ibihumbi bibiri")]
    [InlineData(1000000, "umuriyoni")]
    public void TheCardinals(double n, string want) => Assert.Equal(want, RnNumbers.NumberToWords(n));

    [Fact]
    public void AboveTheTableCeilingTheDigitsComeFromRawNotFromTheDouble()
    {
        // ⚠ #1075 — rn's table has NO billion word, so 10⁹ and up degrade digit-by-digit. Re-stringifying
        // the double reads a DIFFERENT quantity above 2⁵³, which is why `raw` is threaded through.
        Assert.Equal("icenda zeru zeru indwi rimwe icenda icenda kabiri gatanu kane indwi kane zeru icenda icenda gatatu",
            RnNumbers.NumberToWords(9007199254740993d, "9007199254740993"));
    }

    [Theory]
    // DOTTED CAPITAL RUNS → the bare letters. ⚠ A DOT IS ONLY EVER KEPT, NEVER ADDED — the nya condition
    // would manufacture a sentence break inside an institution's own name.
    [InlineData("Ivyo bivugwa na U.S.A. muri Amerika", "Ivyo bivugwa na USA muri Amerika")]
    [InlineData("( E.P.E.L )", "( EPEL )")]
    [InlineData("L. L. Zamenhof yavutse", "LL Zamenhof yavutse")]
    // A DOTTED NUMERIC DATE — only the dots are spent; no month name is invented.
    [InlineData("26.08.1940", "26 08 1940")]
    [InlineData("11.3.1933", "11 3 1933")]
    public void TheDottedRuns(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // ⚠ KIRUNDI WRITES THREE GROUPING CONVENTIONS AT ONCE, where rw's space arm was near-idle.
    [InlineData("12.100.000", "12100000")]
    [InlineData("104 000 000 000", "104000000000")]
    [InlineData("9,984,670", "9984670")]
    // ⚠ THE ANGLO FORM MIXES THEM — comma grouping AND a dot decimal in ONE number, ×9 in the corpus. With
    // rw's trailing guard copied over, all nine kept a clause pause inside the figure.
    [InlineData("1,964.54", "1964 5 4")]
    [InlineData("Ibirometero kwadarato 1,457.40.", "Ibirometero kwadarato 1457 4 0.")]
    // The head must start 1–9, so a leading-zero identifier is not eaten.
    [InlineData("0 620 ni inomero", "0 620 ni inomero")]
    // A four-digit tail is not a grouped thousand.
    [InlineData("Ukuboza 26,2008", "Ukuboza 26,2008")]
    public void TheGroupingConventions(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // A UNIT ABBREVIATION WRITTEN BEFORE ITS NUMBER — structurally invisible to the shared tier.
    [InlineData("ikaba ifise km 1,965 kandi", "ikaba ifise ibirometero 1965 kandi")]
    [InlineData("km² 517", "ibirometero kwadarato 517")]
    [InlineData("mm 1.000", "milimetero 1000")]
    // Case-insensitive, because the corpus writes `Km`/`KM` alongside `km`.
    [InlineData("Km 1,965", "ibirometero 1965")]
    // ⚠ THE SPACE IS MANDATORY: the unspaced shape means something else entirely.
    [InlineData("km2 ni ikimenyetso", "km2 ni ikimenyetso")]
    // ⚠ #1135 IS FIXED, AND THE THREE PATHS NOW FAIL THE SAME WAY. No Kirundi cube word is attested, so an
    // undeclared power keeps the unit's reading and HANDS THE EXPONENT BACK — the shared tier's own
    // convention, which step 4 exists to converge with. Before the fix the two LOCAL arms gave a cube the
    // SQUARE's word while the tier did not, so one construct read three ways depending on where the number
    // sat. A wrong word is worse than a missing one.
    [InlineData("km³ 517", "ibirometero³ 517")]
    [InlineData("(233/km³)", "(233 kuri kirometero³)")]
    [InlineData("517 km³", "ibirometero³ 517")]
    [InlineData("mm³ 1000", "milimetero³ 1000")]
    // ⚠ THE SQUARE IS UNAFFECTED — it HAS a word, and all three paths still emit it.
    [InlineData("517 km²", "ibirometero kwadarato 517")]
    // ⚠ #1136 IS STILL OPEN and pinned as it SHIPS, so a fix meets a failing assertion here.
    // #1136: step 3's space-grouping arm runs FIRST and its lookbehind is satisfied by a preceding LETTER,
    // so it claims `2 517` inside `km2 517` — the figure becomes 2,517 and `km` leaks raw, the exact leak
    // step 4's mandatory space exists to close. ⚠ IT GENERALISES PAST UNITS: any letter+digit before a
    // three-digit block, `R2 500` included.
    [InlineData("km2 517", "km2517")]
    [InlineData("R2 500", "R2500")]
    // A UNIT AS A BARE DENOMINATOR takes the class-7 SINGULAR, where a quantity takes the class-8 plural.
    [InlineData("(233/km²)", "(233 kuri kirometero kwadarato)")]
    [InlineData("3372 hab/km²", "3372 hab kuri kirometero kwadarato")]
    public void TheUnitReadings(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // A pair of FOUR-DIGIT YEARS takes the full `kuva A gushika B` frame; anything else the bare infix.
    [InlineData("(1884-1885)", "(kuva 1884 gushika 1885)")]
    [InlineData("1997–2005", "kuva 1997 gushika 2005")]
    // ⚠ `kuva` IS SUPPRESSED when the text already supplies one — otherwise the word is said twice.
    [InlineData("kuva 2005 – 2007", "kuva 2005 gushika 2007")]
    [InlineData("kuva muri 2010 – 2012", "kuva muri 2010 gushika 2012")]
    // ⚠ A CLAUSE-FINAL SPAN KEEPS ITS JOINER — the trailing guard is `[.,]\d`, not a bare `[.,]` (trap 58).
    [InlineData("Tübingen 1997–2005.", "Tübingen kuva 1997 gushika 2005.")]
    [InlineData("kuva muri 2010 – 2012.", "kuva muri 2010 gushika 2012.")]
    // ⚠ A FOUR-DIGIT COUNT ALONE DOES NOT IDENTIFY A YEAR: these are ALTITUDES, and the SEPARATOR is the
    // second discriminator — all 14 dash spans are years, all 5 slash spans are measurements.
    [InlineData("metero 1.500 / 1.800", "metero 1500 gushika kuri 1800")]
    // ASCENDING ONLY, which is what declines the date span step 2 has just un-dotted.
    [InlineData("24 11 1949 - 17 12 2020", "24 11 1949 - 17 12 2020")]
    // A designation and a French grade range are kept out by the trailing-letter guard.
    [InlineData("COVID-19", "COVID-19")]
    [InlineData("Kindergaten –2ème année", "Kindergaten –2ème année")]
    // The slash guard rejects a date field and a verse reference; a denominator needs a digit after the slash.
    [InlineData("01/07/1962", "01/07/1962")]
    [InlineData("13/07/1982", "13/07/1982")]
    public void TheSpans(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // DEGREES — the sign was dropped and the scale letter reached the g2p as a PHONEME, ⟨C⟩ as [t͡ʃ].
    // ⚠ NO SCALE NAME IS EMITTED for either scale: the letter is claimed, the scale left unsaid.
    [InlineData("30 ° C", "dogere 30")]
    [InlineData("17°C", "dogere 17")]
    [InlineData("0,6 ° C", "dogere 0 6")]
    // ⚠ THE NOUN GOES OUTSIDE A LEADING SIGN, not between it and its digits.
    [InlineData("-39°C", "dogere -39")]
    // A COORDINATE — no compass table, because Kirundi spells the direction out as an ordinary word.
    [InlineData("hagati ya 9°55' na 10°40' mu buraruko", "hagati ya dogere 9 55' na dogere 10 40' mu buraruko")]
    [InlineData("45°", "dogere 45")]
    // ⚠ A TEMPERATURE SPAN TAKES THE PLAIN CONJUNCTION, NOT `gushika` — a different idiom, and using the
    // span rule for it was the mistake the first draft made.
    [InlineData("kuri 30/31 ° C", "kuri dogere 30 na 31")]
    [InlineData("dogere 22/25 ku mutaga", "dogere 22 na 25 ku mutaga")]
    // ⚠ THE NOUN IS SUPPRESSED WHEN THE CLAUSE ALREADY CARRIES IT, both ways round.
    [InlineData("hagati ya dogere 29 na 30/31 ° C", "hagati ya dogere 29 na 30 na 31")]
    public void TheDegreeReadings(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // A REDUNDANT PERCENT SIGN — the clause already SPELLS the word, so the sign is dropped and the words
    // kept. Both apostrophes, because the corpus writes `kw'ijana` and `kw’ijana` and they render alike.
    [InlineData("Ibice mirongo icenda kw'ijana (90%)", "Ibice mirongo icenda kw'ijana (90)")]
    [InlineData("bane kw’ijana (4%)", "bane kw’ijana (4)")]
    // Otherwise the tier attaches the POSTPOSED word — and rw's spelling `ku ijana` is ×0 in rn.
    [InlineData("30%", "30 kw'ijana")]
    [InlineData("68,7%", "68 7 kw'ijana")]
    public void ThePercentReadings(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // The currency noun PRECEDES its amount; ⟨l⟩ is not a Kirundi letter, so it is `amadorari`.
    // ⚠ THE `US$` COMPOUND KEY DOES NOT CLAIM THE SPACED FORM, AND ALL THREE CORPUS INSTANCES ARE SPACED —
    // so `US` still reaches the g2p as the word *us*. Pinned as it SHIPS, not as the TS header believes it
    // reads; filed as #1137, because both engines do this identically. See docs/rn_port_investigation.md.
    [InlineData("US $ 4,000", "US amadorari 4000")]
    [InlineData("US $ 7.34", "US amadorari 7 3 4")]
    [InlineData("US$4,000", "amadorari 4000")]   // the unspaced form the key WAS written for — ×0 in rn
    [InlineData("27 664 $", "amadorari 27664")]
    // COLONS: rn has NO clock — all six instances are Bible verses — so the colon is spent on a space and
    // nothing is invented.
    [InlineData("11:22", "11 22")]
    [InlineData("19:09, 27 Ruhuhuma 2023 (UTC)", "19 09, 27 Ruhuhuma 2023 (UTC)")]
    // DECIMALS, last: no separator word is emitted, and the trailing guard keeps a sentence-final one alive.
    [InlineData("196.7km²", "ibirometero kwadarato 196 7")]
    [InlineData("61,19", "61 1 9")]
    // ⚠ THE AMPERSAND is the engine's own conjunction — reading a conjunction sign as the conjunction
    // cannot be the wrong word.
    [InlineData("R & D", "R na D")]
    public void TheCurrencyColonsAndDecimals(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // End to end through the phonemizer.
    [InlineData("30%", "miɾoŋo itatu kw id͡ʒana")]  // the apostrophe SPLITS the token — `kw'ijana` is two words
    [InlineData("km² 517", "ibiɾometeɾo kwadaɾato amad͡ʒana atanu na it͡ʃumi na indwi")]
    [InlineData("(1884-1885)", "kuva iɡihumbi na amad͡ʒana inani na miɾoŋo inani na kane ɡuʃika iɡihumbi na amad͡ʒana inani na miɾoŋo inani na ɡatanu")]
    public void EndToEnd(string text, string want) => Assert.Equal(want, Say(text));
}
