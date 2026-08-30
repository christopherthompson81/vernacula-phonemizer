/**
 * Ewe (ee) — Eʋegbe, a Gbe language (Niger-Congo, Kwa) of Ghana and Togo, the Latin-based African alphabet.
 * Signatures: the labial-velars ⟨gb kp⟩→[ɡ͡b k͡p], the bilabial ⟨ƒ⟩→[ɸ]/⟨ʋ⟩→[β] against the labiodental
 * ⟨f v⟩, the affricates ⟨dz ts⟩, ⟨ny⟩→[ɲ] and ⟨x⟩→[x]; written nasalization (the tilde is kept); TONELESS,
 * because tone is unmarked in the orthography. The two non-obvious allophonies (Jalloh's grammar) are
 * ⟨w⟩→[w] before a rounded vowel but [ɰ] before an unrounded one, and ⟨r⟩→[l] in an onset cluster.
 *
 * The portable half of test/ewe.test.ts. Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Ewe;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EweTests
{
    private static string Word(string s) => EwePhonemizer.PhonemizeWord(s);
    private static string Text(string s) => Registry.GetPhonemizer("ee").Text(s).Trim();
    private static string Norm(string s) => Normalize.NormalizeEwe(s);

    [Theory]
    [InlineData("Eʋegbe", "eβeɡ͡be")]        // the language name — ⟨ʋ⟩→[β], ⟨gb⟩→[ɡ͡b]
    [InlineData("agbe", "aɡ͡be")]            // 'life' — labial-velar ⟨gb⟩
    [InlineData("atsiaƒu", "at͡siaɸu")]      // 'sea' — ⟨ts⟩→[t͡s], bilabial ⟨ƒ⟩→[ɸ]
    [InlineData("nyɔnu", "ɲɔnu")]           // 'woman' — ⟨ny⟩→[ɲ]
    public void LabialVelarsBilabialsAffricatesAndNy(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    [Theory]
    [InlineData("wɔ", "wɔ")]                 // ⟨w⟩ before a ROUNDED vowel → [w]
    [InlineData("Xawa", "xaɰa")]             // ⟨x⟩→[x]; ⟨w⟩ before UNROUNDED [a] → [ɰ]
    [InlineData("ɣ", "ɰ")]                   // ⟨ɣ⟩ → the velar approximant [ɰ]
    public void WRoundingAllophonyAndXAndGamma(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    [Theory]
    [InlineData("adre", "adle")]             // 'seven' — ⟨r⟩ after a consonant → [l]
    [InlineData("agbalẽ", "aɡ͡balẽ")]        // 'book' — nasalized ⟨ẽ⟩ kept
    [InlineData("fukpekpe", "fuk͡pek͡pe")]   // ⟨kp⟩ labial-velar
    [InlineData("ŋusẽ", "ŋusẽ")]             // 'strength' — ⟨ŋ⟩→[ŋ], nasal ⟨ẽ⟩
    public void RIsLInAClusterWrittenNasalizationKpAndEng(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    /** The public-API path: NFC precomposed vowels and the uppercase ⟨Ɖ⟩ must both survive tokenization. */
    [Fact]
    public void TextTokenizesPrecomposedVowelsAndUppercaseEd()
    {
        Assert.Equal("aɡ͡balẽ", Text("agbalẽ".Normalize(System.Text.NormalizationForm.FormC)));
        Assert.Equal("ɖekawo", Text("Ɖekawo"));
    }

    /**
     * NUMBERS — DECIMAL, but with PREFIXING morphology no data-only composer can express: the teens are
     * wui- + unit stem and the round tens are bla- + unit stem (bla- is a multiplicative TEN prefix, so
     * blaeve 20 is 'ten×two' and blaene 40 is 'ten×four' — NOT a base-20 series), 21–99 link with `vɔ`
     * 'plus', and the magnitude nouns alafa/akpe/miliɔn take a FOLLOWING multiplier with `kple` between
     * slots. Sources: Omniglot "Numbers in Ewe" + desmotsetdeslangues.eklablog.com/ewe.
     */
    [Theory]
    [InlineData(7, "adre")]
    [InlineData(10, "ewo")]
    [InlineData(11, "wuiɖeke")]              // wui- + the unit stem
    [InlineData(20, "blaeve")]               // bla- (×10) + eve → 10×2
    [InlineData(21, "blaeve vɔ ɖeka")]       // TENS vɔ UNIT
    [InlineData(42, "blaene vɔ eve")]
    [InlineData(99, "blaasieke vɔ asieke")]
    public void UnitsWuiTeensBlaTensAndVoCompounds(int n, string expected) =>
        Assert.Equal(expected, Numbers.NumberToWords(n));

    [Theory]
    [InlineData(100, "alafa ɖeka")]
    [InlineData(101, "alafa ɖeka kple ɖeka")]
    [InlineData(555, "alafa atɔ̃ kple blaatɔ̃ vɔ atɔ̃")]
    [InlineData(1000, "akpe ɖeka")]
    [InlineData(12345, "akpe wuieve kple alafa etɔ̃ kple blaene vɔ atɔ̃")]
    [InlineData(1_000_000, "miliɔn ɖeka")]
    [InlineData(2_000_000, "miliɔn eve")]
    public void AlafaHundredsAkpeThousandsAndMilionMillions(int n, string expected) =>
        Assert.Equal(expected, Numbers.NumberToWords(n));

    [Theory]
    [InlineData("20", "blaeve")]
    [InlineData("1000", "ak͡pe ɖeka")]       // ⟨kp⟩ → the labial-velar k͡p
    public void NumbersEndToEndThroughTheScan(string input, string expected) =>
        Assert.Equal(expected, Text(input));

    /**
     * ⚠ THE MAGNITUDE CEILING, WHICH THE TS SUITE DOES NOT PIN. There is no attested Ewe numeral above
     * `miliɔn`, so ≥10⁹ reads DIGIT-BY-DIGIT rather than inventing a "billion" — and the digit arm takes the
     * RAW TOKEN, not a re-stringified double, because above 2^53 the double has already lost its low digits.
     * `9007199254740993` is 2^53+1: the double rounds it to …992, so a composer reading the number would
     * read a figure the text does not contain. Both engines read the token's own digits.
     */
    [Theory]
    [InlineData(1_000_000_000d, "1000000000", "ɖeka naneke o naneke o naneke o naneke o naneke o naneke o naneke o naneke o naneke o")]
    [InlineData(9007199254740993d, "9007199254740993", "asieke naneke o naneke o adre ɖeka asieke asieke eve atɔ̃ ene adre ene naneke o asieke asieke etɔ̃")]
    public void AboveTheAttestedMagnitudesTheDigitsAreReadFromTheRawToken(double n, string raw, string expected) =>
        Assert.Equal(expected, Numbers.NumberToWords(n, raw));

    // ── TEXT NORMALIZATION (Normalize.cs) ────────────────────────────────────────────────────────────

    /**
     * ⚠ THE HOMOGLYPH FOLD, which is why the normalization layer exists at all. ⟨Ð⟩ U+00D0 (×19 in the
     * corpus) and ⟨Đ⟩ U+0110 stand in for Ewe's ⟨Ɖ⟩ U+0189; ⟨Ƞ⟩ U+0220 for ⟨Ŋ⟩; U+0342 COMBINING GREEK
     * PERISPOMENI for the nasalization tilde U+0303. The first three are outside TOKEN, so the WORD ENDED
     * and the fragment went to the English fallback as a letter name; the fourth deleted a phoneme contrast
     * in silence. Pinned through the public API, because the defect is in tokenization and not in the scan.
     */
    [Theory]
    [InlineData("Ðasefowo", "ɖasefowo")]     // was *dˈiː asefowo* — the letter name "dee"
    [InlineData("Đoɖo", "ɖoɖo")]
    [InlineData("Ƞkɔ", "ŋkɔ")]               // was *ƞ kɔ* — the raw ⟨ƞ⟩ ALSO reached the IPA
    [InlineData("ha͂", "hã")]                 // was *ha* — /hã/ and /ha/ are two words
    [InlineData("kata͂", "katã")]
    public void TheHomoglyphFold(string input, string expected) => Assert.Equal(expected, Text(input));

    /** …and the same fold must reach the word identically however the wiki encoded it. */
    [Fact]
    public void TheFoldedAndTheNativeSpellingReadAlike() =>
        Assert.Equal(Text("Ɖasefowo"), Text("Ðasefowo"));

    /**
     * ⚠ THE LOOKALIKES THAT ARE NOT HOMOGLYPHS — the negative half of the census, pinned so a later
     * widening of the fold has to argue with it. ⟨ʊ⟩ U+028A looks exactly like ⟨ʋ⟩ and every instance in
     * this corpus is inside an ENGLISH pronunciation gloss the wiki writes in parentheses; ⟨ð⟩ and ⟨ƞ⟩
     * lowercase are ×0 and are live IPA characters. The fold is capitals-only and attested-only (trap 9).
     */
    [Theory]
    [InlineData("/boʊnˈfoʊ ɑːbˈæs/")]
    [InlineData("ð đ ƞ")]
    public void LookalikesAreLeftAlone(string s) => Assert.Equal(s, Norm(s));

    /** Percent is POSTPOSED — `le alafa me`, "in a hundred". A SPAN takes the word once, after the second
     *  operand, which is why percent runs before ranges. */
    [Theory]
    [InlineData("90%", "blaasieke le alafa me")]
    [InlineData("25–33%", "blaeve vɔ atɔ̃ va ɖo blaetɔ̃ vɔ etɔ̃ le alafa me")]
    public void PercentIsPostposedAndASpanTakesItOnce(string input, string expected) =>
        Assert.Equal(expected, Text(input));

    /** Currency is PREPOSED. ⚠ `dɔla` is the SERVANT (×3 on ee.wikipedia); the money word is `dɔlar` (×48). */
    [Theory]
    [InlineData("$400", "dɔlar 400")]
    [InlineData("GH¢ 1", "cedi 1")]
    [InlineData("€200", "euro 200")]
    [InlineData("£7,500", "pound 7500")]
    public void CurrencyIsPreposedAndGhCedeOutranksTheBareSign(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /**
     * Units: the noun goes BEFORE the figure, which is Ewe's own order (`kilometa 240`, `meta 100`) and is
     * why the shared postposing tier cannot express it. ⚠ `km2` reads as the bare unit noun — this wiki's
     * own way of writing an area — rather than leaving the trap-53 "kilometres TWO" the ASCII exponent
     * produces.
     */
    [Theory]
    [InlineData("5 km", "kilometa 5")]
    [InlineData("100,210 km2", "kilometa 100210")]
    [InlineData("56.52m", "meta 56 5 2")]    // a hammer-throw distance, ×6 in the corpus
    [InlineData("$400mm", "dɔlar 400mm")]    // a MAGNITUDE after a sign, not millimetres
    [InlineData("5 kg", "5 kg")]             // no kilogram word is attested — left raw, on purpose
    public void UnitsReorderToNounFirstAndKm2IsNotANumber(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /**
     * Ranges take `va ɖo`, whose bare numeric infix is the attested frame ("0.5 va ɖo 2 °C").
     * ⚠ THE THREE BRANCHES ARE PINNED SEPARATELY (trap 13): ascending claims, descending does not, and a
     * pair of SINGLE digits is refused because the corpus's are football and tennis SCORES, not spans.
     */
    [Theory]
    [InlineData("1648-1654", "1648 va ɖo 1654")]
    [InlineData("7000–3300", "7000–3300")]                     // BCE, descending
    [InlineData("7–6", "7–6")]                                 // a tennis set
    [InlineData("Luka 19:28-44", "Luka 19:28-44")]             // scripture; there is no clock rule
    [InlineData("ISBN 0-582-49219-X", "ISBN 0-582-49219-X")]
    public void RangesAscendingOnlyNeverAScoreNeverAScriptureReference(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /**
     * ⚠ THE CLAUSE-FINAL BRANCH, PINNED SEPARATELY. A sentence period is not part of a number, and while
     * the trailing guard rejected one, every range that ENDED A CLAUSE was declined and stayed the bare
     * juxtaposition. The `,` goes with it — Ewe writes the decimal POINT, so a following comma is a clause
     * comma; and the two branches above, not the comma, are what keep the tennis scores out.
     */
    [Theory]
    [InlineData("207-213.", "207 va ɖo 213.")]
    [InlineData("le May 10-11, 2007", "le May 10 va ɖo 11, 2007")]
    [InlineData("7–6, 4–6", "7–6, 4–6")]                       // both single digits — still a score
    [InlineData("Mateo 21:1-11.", "Mateo 21:1-11.")]           // still scripture
    public void ARangeThatEndsAClauseOrPrecedesACommaIsStillARange(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    /**
     * De-grouping first, or the separator is read as clause punctuation and the tail as its own number. The
     * decimal point is REMOVED and the tail spaced: no Ewe point word is attested, so what this fixes is the
     * spurious SENTENCE BREAK, not the missing word.
     */
    [Fact]
    public void GroupingIsSpentAndTheDecimalPointStopsBeingAPause()
    {
        Assert.Equal(
            "miliɔn blaatɔ̃ vɔ ɖeka k͡ple ak͡pe alafa ene k͡ple blaene vɔ ade k͡ple alafa eve k͡ple ɖeka",
            Text("51,446,201"));
        Assert.Equal("10955000", Norm("10 955 000"));
        Assert.Equal("0 5", Norm("0.5"));
        Assert.Equal("44 4 le alafa me", Norm("44.4%"));
    }

    /**
     * Interior dots only — the letters are left where they were, because no letter-name table exists and no
     * era expansion is attested. ⚠ `\p{L}`, NOT the fleet's usual ASCII `[^\W\d_]`: Ewe's own era marker is
     * `D.M.Ŋ.` and ⟨Ŋ⟩ is not in `\w` even under the `u` flag (trap 1).
     */
    [Fact]
    public void DottedAbbreviationsLoseTheirInteriorDotsIncludingAcrossEng()
    {
        Assert.Equal("US.", Norm("U.S."));
        Assert.Equal("DMŊ.", Norm("D.M.Ŋ."));
        Assert.Equal("etɔ̃ edition", Text("3rd edition")); // the English suffix no longer reaches the IPA
    }

    /**
     * The entity forms come first, or `&nbsp;` is read as "and" plus four letters — and two of this wiki's
     * are UNTERMINATED. `kple` is Ewe's ordinary coordinator.
     */
    [Fact]
    public void HtmlEntitiesBeforeTheAmpersandWhichReadsKple()
    {
        Assert.Equal("cedi 1", Norm("GH¢&nbsp;1"));
        // ⚠ THE `;` IS OPTIONAL — two of this wiki's entities are unterminated, and the substituted space is
        // left beside the original one rather than trimmed (a trim would erase a real boundary).
        Assert.Equal("meter 3  (afɔ 10 )", Norm("meter 3&nbsp (afɔ 10&nbsp)"));
        Assert.Equal("dunt͡sker k͡ple humblot", Text("Duncker & Humblot"));
    }

    /** ⚠ AN ORDINARY EWE SENTENCE MUST SURVIVE ALL OF IT — the sample-tier question in one assertion. */
    [Fact]
    public void OrdinaryTextIsUntouched()
    {
        const string s = "Wodzi Ephraim le Peki-Avetile le Anyɔnyɔ 13 le ƒe 1899 me.";
        Assert.Equal(s, Norm(s));
    }

    [Fact]
    public void RegistryWiring() => Assert.Equal("aɡ͡be", Phonemizer.Phonemize("agbe", "ee").Trim());
}
