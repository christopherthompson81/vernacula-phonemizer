/**
 * Luo / Dholuo (luo) — Western Nilotic (Luo group), the Latin orthography, canonical IPA, ~4–5M around
 * Lake Victoria. Signatures: the DENTAL vs ALVEOLAR contrast (⟨th dh⟩=θ ð vs ⟨t d⟩=t d); PRENASALISED
 * voiced stops (⟨mb⟩=ᵐb, ⟨nd⟩=ⁿd, ⟨nj⟩=ⁿd͡ʒ, ⟨ng⟩=ᵑɡ); ⟨ng'⟩=ŋ vs ⟨ng⟩=ᵑɡ; ⟨ny⟩=ɲ; the palatals
 * ⟨ch⟩=t͡ʃ, ⟨j⟩=d͡ʒ; ⟨r⟩=ɾ; the conservative high-vowel glide (⟨i⟩+{a,e}→j). The 9-vowel ±ATR and register
 * TONE are UNWRITTEN → +ATR/toneless default.
 *
 * The portable half of test/luo.test.ts. Every expected value is the TypeScript engine's own output. The
 * normalize cases pin both the rewrites and the REFUSALS (percent, ¥, degrees, plus, the season, the
 * designation) — worth as much as the rewrites: a class with no sourceable word must keep reading as it did.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Luo;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class LuoTests
{
    private static string Word(string s) => LuoPhonemizer.PhonemizeWord(s);
    private static string Norm(string s) => Normalize.NormalizeLuo(s);
    private static string Text(string s) => Registry.GetPhonemizer("luo").Text(s).Trim();

    [Theory]
    [InlineData("dhano", "ðano")]     // 'person' — ⟨dh⟩→ð (dental)
    [InlineData("thum", "θum")]       // 'music' — ⟨th⟩→θ (dental)
    [InlineData("adek", "adek")]      // 'three' — ⟨d⟩→d, ⟨k⟩→k (alveolar)
    [InlineData("kidi", "kidi")]      // 'stone' — ⟨d⟩→d alveolar (not dental)
    public void TheDentalVsAlveolarContrast(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    [Theory]
    [InlineData("rech", "ɾet͡ʃ")]      // 'fish' — ⟨ch⟩→t͡ʃ, ⟨r⟩→ɾ
    [InlineData("wich", "wit͡ʃ")]      // 'head'
    [InlineData("nyang'", "ɲaŋ")]     // 'crocodile' — ⟨ny⟩→ɲ, ⟨ng'⟩→ŋ
    [InlineData("ng'ato", "ŋato")]    // 'someone' — word-initial ⟨ng'⟩→ŋ
    [InlineData("nyaroya", "ɲaɾoja")] // ⟨y⟩→j
    public void ThePalatalsAndVelarNasal(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    [Theory]
    [InlineData("ndalo", "ⁿdalo")]    // 'time' — ⟨nd⟩→ⁿd
    [InlineData("mbaka", "ᵐbaka")]    // ⟨mb⟩→ᵐb
    [InlineData("ngano", "ᵑɡano")]    // 'story' — ⟨ng⟩→ᵑɡ (prenasalised, vs ⟨ng'⟩→ŋ)
    public void ThePrenasalisedStops(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    [Theory]
    [InlineData("dhiang'", "ðjaŋ")]    // 'cow' — ⟨i⟩+a → j glide, after dental ð
    [InlineData("chíeng'", "t͡ʃjeŋ")]   // 'sun' — ⟨i⟩+e → j (tone-marked citation → base)
    [InlineData("dholuo", "ðoluo")]    // the endonym — ⟨u⟩+o is HIATUS, NOT glided to ðolwo
    [InlineData("guok", "ɡuok")]       // 'dog' — ⟨u⟩+o kept as a vowel sequence (no ⟨u⟩→w glide)
    public void TheConservativeGlide(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    [Theory]
    [InlineData("kelo", "kelo")]       // ⟨e⟩,⟨o⟩ emitted +ATR by default
    [InlineData("kuno", "kuno")]       // ⟨u⟩,⟨o⟩ +ATR default
    [InlineData("ang'o", "aŋo")]       // ASCII apostrophe
    [InlineData("ang’o", "aŋo")]       // ’ U+2019
    [InlineData("angʼo", "aŋo")]       // ʼ U+02BC, the letter apostrophe
    public void TheAposTropheIsRobustAndAtrIsDefault(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    [Theory]
    [InlineData("Dhano gi rech.", "ðano ɡi ɾet͡ʃ .")]
    [InlineData("Adek 3.", "adek adek .")]  // the digit is now read as adek
    public void TextWordsClausePunctuationAndNumbers(string input, string expected) =>
        Assert.Equal(expected, Text(input));

    /**
     * NUMBERS — DECIMAL, bespoke for the coordinator gi 'and': it ELIDES to a solid g- before a
     * vowel-initial word (apar + gi + achiel → apar gachiel) but stays free before the consonant-initial
     * magnitude words (mia ariyo gi piero adek). 1000+ uses the everyday borrowed elfu/milion/bilion.
     */
    [Theory]
    [InlineData(0, "nono")]
    [InlineData(7, "abiriyo")]
    [InlineData(10, "apar")]
    [InlineData(11, "apar gachiel")]               // gi + achiel → gachiel (elided)
    [InlineData(20, "piero ariyo")]                // the multiplier FOLLOWS piero
    [InlineData(21, "piero ariyo gachiel")]
    [InlineData(42, "piero ang'wen gariyo")]
    [InlineData(99, "piero ochiko gochiko")]
    [InlineData(100, "mia achiel")]
    [InlineData(101, "mia achiel gachiel")]
    [InlineData(555, "mia abich gi piero abich gabich")]  // gi + piero → free gi
    [InlineData(1000, "elfu achiel")]
    [InlineData(12345, "elfu apar gariyo gi mia adek gi piero ang'wen gabich")]
    [InlineData(1000000, "milion achiel")]
    [InlineData(1000000000, "bilion achiel")]
    public void TheDecimalSeries(int n, string expected) =>
        Assert.Equal(expected, Numbers.NumberToWords(n));

    /** End-to-end: the numeral is phonemized, not passed through as digits — the glide applies inside too. */
    [Theory]
    [InlineData("20", "pjeɾo aɾijo")]   // piero ariyo — the ⟨i⟩+V glide inside the numerals
    [InlineData("4", "aŋwen")]          // ang'wen — ⟨ng'⟩ → ŋ
    public void NumbersEndToEndThroughTheScan(string input, string expected) =>
        Assert.Equal(expected, Text(input));

    /**
     * ⚠ THE 2^53-AND-ABOVE ARM, WHICH THE TS SUITE DOES NOT PIN. Above the safe-integer bound the double
     * has lost its low digits, so the composer must read the RAW TOKEN's digits, not the double's.
     */
    [Fact]
    public void AboveTheComposedRangeTheDigitsAreReadFromTheRawToken()
    {
        // 1e12 is the first out-of-range value; the raw token's thirteen digits are read one at a time.
        Assert.Equal(
            "achiel nono nono nono nono nono nono nono nono nono nono nono nono",
            Numbers.NumberToWords(1000000000000d, "1000000000000"));
    }

    // ─── NORMALIZE: the grouping comma, the largest defect in the corpus ────────────────────────────────

    [Theory]
    [InlineData("nengo mar kind ¥2,500 kod ¥130,000", "nengo mar kind ¥2500 kod ¥130000")]
    [InlineData("welo maromo 5,000,000 edwe", "welo maromo 5000000 edwe")]  // deepest: two joins
    [InlineData("pipni 55,000.", "pipni 55000.")]   // clause-final figure still de-groups
    [InlineData("dola bilion $2.3.", "dola bilion 2 nukta 3.")]  // clause-final decimal still decimates
    public void TheGroupingCommaAndClauseFinalFigures(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Fact]
    public void AGroupedFigureIsOneNumberWithNoInteriorPause() =>
        Assert.Equal("elfu at͡ʃjel ɡi mja aut͡ʃjel", Text("1,600"));

    /** The DECIMAL DOT reads `nukta`; the fractional digits are spaced so they are spoken one at a time. */
    [Theory]
    [InlineData("kilomita 12.8 kata mail 8", "kilomita 12 nukta 8 kata mail 8")]
    [InlineData("lach mar mita 3.50 moro ka moro", "lach mar mita 3 nukta 5 0 moro ka moro")]  // never "fifty"
    [InlineData("inji 6.34 e rapim", "inji 6 nukta 3 4 e rapim")]
    public void TheDecimalDotReadsNukta(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /** The DOT ALSO CLOCKS, and the writer's own `saa` / `UTC` is the discriminator. */
    [Theory]
    [InlineData("ne ochiwo ripot mare e saa 12.00 GMT", "ne ochiwo ripot mare e saa 12 00 GMT")]
    [InlineData("seche mag pinyno (15.00 UTC)", "seche mag pinyno (15 00 UTC)")]
    [InlineData("Whistler (riembo mar saa 1.5 kowuok", "Whistler (riembo mar saa 1 nukta 5 kowuok")]  // one-digit fraction = a decimal of hours
    public void TheDotClocksAndSaaIsTheDiscriminator(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /** The COLON is a clock ELEVEN times of fourteen; `saa` is already written, so the colon is spent. */
    [Theory]
    [InlineData("kar saa 11:35 otieno.", "kar saa 11 35 otieno.")]
    [InlineData("e kar saa 9:30 okinyi", "e kar saa 9 30 okinyi")]
    [InlineData("E kind seche mag 10:00-11:00 otieno", "E kind seche mag 10 00 nyaka 11 00 otieno")]  // the clock RANGE, claimed whole
    public void TheColonClockAndTheClockRange(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /** REFUSED: `2:2` is a lower-second-class DEGREE, and the sports times are not clocks. */
    [Theory]
    [InlineData("moyudo 2:2 (digri man piny", "moyudo 2:2 (digri man piny")]  // fails [0-5]\d
    [InlineData("gi dakika 1:09.02 mos", "gi dakika 1:09 nukta 0 2 mos")]     // the colon is untouched
    public void RefusedTheDegreeAndTheSportsTimes(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /** RANGES take `nyaka`, the corpus's own joiner — and it reads SCORES too (a digit-count, not ascending). */
    [Theory]
    [InlineData("jolweny dhod Qing (1644-1912) nokaw", "jolweny dhod Qing (1644 nyaka 1912) nokaw")]
    [InlineData("mar 5-3 mane giloyo", "mar 5 nyaka 3 mane giloyo")]          // a descending score
    [InlineData("loch mayom mar 26-00 e kindgi", "loch mayom mar 26 nyaka 00 e kindgi")]
    [InlineData("higni tara 4.2-3.9 mokalo", "higni tara 4 nukta 2 nyaka 3 nukta 9 mokalo")]  // a genuine descending span
    [InlineData("higa mar 1995-96, ka Jaromir", "higa mar 1995-96, ka Jaromir")]  // the SEASON: a truncated endpoint, refused
    [InlineData("ndege mar 2-76s bang' masirano", "ndege mar 2-76s bang' masirano")]  // a DESIGNATION, refused
    public void RangesTakeNyakaAndRefuseTheSeasonAndDesignation(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /** The DOTTED DESIGNATION is spent silently, and a decimal glued to a unit is not one. */
    [Theory]
    [InlineData("kodok chien gi 802.11a, 802.11b", "kodok chien gi 802 11a, 802 11b")]
    [InlineData("duto mag 22.4Ghz to kod 5.0Ghz.", "duto mag 22 nukta 4Ghz to kod 5 nukta 0Ghz.")]  // three-letter run = a decimal
    public void TheDottedDesignation(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /** CURRENCY: the noun already precedes, so the sign is claimed only where it does not. */
    [Theory]
    [InlineData("mwandu ma dirom dola bilion $2.3", "mwandu ma dirom dola bilion 2 nukta 3")]  // dola already said
    [InlineData("maromo dola $1000 kuom keth", "maromo dola 1000 kuom keth")]
    [InlineData("nengo molandi mar tara £27.", "nengo molandi mar paund tara 27.")]  // the noun HOPS THE MAGNITUDE
    [InlineData("mar $5 kuom keth", "mar dola 5 kuom keth")]                          // unglossed: still read
    [InlineData("mar AUD$45 milion.", "mar AUD$45 milion.")]  // the ISO code is spoken; the sign is declined
    public void CurrencyClaimsOnlyWhereUnsaid(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /** REFUSED: percent, degrees and the plus — each priced, none of them made worse. */
    [Theory]
    [InlineData("oriwo 3% mar pinyno.", "oriwo 3% mar pinyno.")]   // no percent word in any source
    [InlineData("moloyo +30°C.", "moloyo +30°C.")]                 // the sign is left in place, C and all
    [InlineData("e yimbo mar 35° Ugwe.", "e yimbo mar 35° Ugwe.")] // Ugwe is WEST
    [InlineData("no (UTC+1) e Whitehall", "no (UTC+1) e Whitehall")] // the one contentful plus, unattested
    public void RefusedPercentDegreesAndPlus(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /** The SPACED DASH is a clause break — and one name that must not gain one. */
    [Theory]
    [InlineData("mopuodhi - kata mana Armenia - mane", "mopuodhi, kata mana Armenia, mane")]
    [InlineData("nochakore chon — pichni mag", "nochakore chon, pichni mag")]
    [InlineData("kuonde 26 - mang'eny moloyo", "kuonde 26, mang'eny moloyo")]  // a clause dash after a NUMBER
    [InlineData("mar White Sea–Baltic Canal", "mar White Sea–Baltic Canal")]   // the en dash is a NAME JOINER
    [InlineData("loch mar Ruoth Sejon (1418 - 1450).", "loch mar Ruoth Sejon (1418 nyaka 1450).")]  // step 5 claimed the spaced RANGE
    public void TheSpacedDashIsAClauseBreak(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /** Nothing bites a Dholuo word — the ⟨ng'⟩ apostrophe is a LETTER, in all three encodings. */
    [Fact]
    public void NoRuleBitesTheNgAposTropheInAnyEncoding()
    {
        var plain = "Ng'wech mar chieng' kod maduong’ gi ngʼato";
        Assert.Equal(plain, Norm(plain));
        Assert.Equal("Kwom aoche matindo maromo gana.", Norm("Kwom aoche matindo maromo gana."));
    }

    /** End-to-end: the clause pause survives, the number is one number, and the clock is not cut in half. */
    [Theory]
    [InlineData("pipni 55,000.", "pipni elfu pjeɾo abit͡ʃ ɡabit͡ʃ .")]
    [InlineData("kar saa 11:35 otieno.", "kaɾ saa apaɾ ɡat͡ʃjel pjeɾo adek ɡabit͡ʃ otjeno .")]
    public void EndToEndThroughTheRealPhonemizer(string input, string expected) =>
        Assert.Equal(expected, Text(input));

    [Fact]
    public void RegistryWiring() => Assert.Equal("ðano ɡi ɾet͡ʃ .", Phonemizer.Phonemize("Dhano gi rech.", "luo").Trim());
}
