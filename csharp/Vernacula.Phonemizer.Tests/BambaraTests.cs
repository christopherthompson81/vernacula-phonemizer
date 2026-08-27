// The portable half of test/bambara.test.ts — Bambara / Bamanankan (bm), Mande, Latin + N'Ko.
// See the TS test and src/languages/bambara/normalize.ts for the corpus evidence behind each fixture.
//
// ⚠ THE BRANCHES ARE PINNED, NOT THE CORPUS'S INSTANCES, so several cases below are deliberately shapes the
// corpus does NOT contain — the descending span beside the ascending one, the V'C apostrophe beside the C'V
// one, the 27-group alphabet listing beside the four-group initialism.
using System.Text;
using Vernacula.Phonemizer;
using BmEngine = Vernacula.Phonemizer.Languages.Bambara.BambaraPhonemizer;
using BmNormalize = Vernacula.Phonemizer.Languages.Bambara.Normalize;
using BmNumbers = Vernacula.Phonemizer.Languages.Bambara.Numbers;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class BambaraTests
{
    /** The g2p emits combining marks (nasal ã = a + U+0303) to match the referee; NFC for stable literals. */
    private static string Word(string w) => BmEngine.PhonemizeWord(w).Normalize(NormalizationForm.FormC);

    private static string Nfc(string s) => s.Normalize(NormalizationForm.FormC);

    private static string Text(string s) => Phonemizer.Phonemize(s, "bm").Normalize(NormalizationForm.FormC);

    [Theory]
    // Affricates and the sibilant.
    [InlineData("cɔnkɔ", "t͡ʃɔ̃kɔ")]
    [InlineData("jan", "d͡ʒã")]
    [InlineData("shinye", "ʃiɲe")]   // ⟨sh⟩ → ʃ, ⟨ny⟩ → ɲ
    // NASALISATION — a syllable-final ⟨n⟩ nasalises the preceding vowel and drops; an onset ⟨n⟩ stays [n].
    [InlineData("ban", "bã")]
    [InlineData("dɔn", "dɔ̃")]
    [InlineData("kunun", "kunũ")]    // ku.nun — the ONSET n stays, only the FINAL one nasalises
    [InlineData("na", "na")]
    [InlineData("kalan", "kalã")]
    // The palatal, and the word-initial prenasal that keeps its nasal.
    [InlineData("nya", "ɲa")]
    [InlineData("mburu", "mburu")]
    [InlineData("sanga", "sãɡa")]
    [InlineData("ala", "ala")]
    [InlineData("kelen", "kelẽ")]
    public void TheGreedyScanAndTheNasalRule(string word, string want) => Assert.Equal(Nfc(want), Word(word));

    [Theory]
    // ⚠ THE N'KO VOWEL NAMING IS THE TRAP: LETTER EE = /e/, LETTER E = /ɛ/, LETTER OO = /o/, LETTER O = /ɔ/.
    [InlineData("ߒߞߏ", "ŋko")]      // N + KA + OO(=/o/); the standalone N → ŋ before k
    [InlineData("ߘߋߣ", "dẽ")]       // da + EE(=/e/) + na → nasal ẽ
    [InlineData("ߖߐ߲", "d͡ʒɔ̃")]     // ja + O(=/ɔ/) + NASALIZATION MARK
    [InlineData("ߓߊ߲", "bã")]       // ba + a + NASALIZATION MARK
    public void TheNkoFrontEndTransliteratesToIdenticalIpa(string word, string want) =>
        Assert.Equal(Nfc(want), Word(word));

    [Fact]
    public void NkoAndTheLatinSpellingAreTheSameWord() => Assert.Equal(Word("ban"), Word("ߓߊ߲"));

    // NUMBERS — decimal. 10 tan and 20 mugan are lexical while 30–90 are solid bi- derivations, and every
    // magnitude noun takes a FOLLOWING multiplier except 100, which is the bare kɛmɛ. Slots join with ni.
    [Theory]
    [InlineData(7, "wolonwula")]
    [InlineData(10, "tan")]
    [InlineData(11, "tan ni kelen")]
    [InlineData(20, "mugan")]                    // lexical, not *bifila
    [InlineData(21, "mugan ni kelen")]
    [InlineData(42, "binaani ni fila")]
    [InlineData(8, "segin")]                     // Bamadaba headword; seegin is its listed variant
    [InlineData(66, "biwɔɔrɔ ni wɔɔrɔ")]        // the wiki glosses this itself — bi- is ×10, not ×20
    [InlineData(80, "bisegin")]
    [InlineData(99, "bikɔnɔntɔn ni kɔnɔntɔn")]  // 90 KEEPS its medial ⟨n⟩, against the wiki's minority form
    [InlineData(100, "kɛmɛ")]                    // the multiplier is omitted for exactly 100
    [InlineData(101, "kɛmɛ ni kelen")]
    [InlineData(555, "kɛmɛ duuru ni biduuru ni duuru")]
    [InlineData(1000, "ba kelen")]               // the thousand DOES keep its multiplier
    [InlineData(12345, "ba tan ni fila ni kɛmɛ saba ni binaani ni duuru")]
    [InlineData(200000, "ba kɛmɛ fila")]         // the wiki's own `tone ba kɛmɛ fila (200 000 tonnes)`
    [InlineData(1000000, "miliyɔn kelen")]
    [InlineData(2000000, "miliyɔn fila")]
    [InlineData(1000000000, "miliyari kelen")]
    [InlineData(1500000000, "miliyari kelen ni miliyɔn kɛmɛ duuru")]
    // Above miliyari there is no attested numeral — read the digits rather than invent a "trillion".
    [InlineData(1e12, "kelen fu fu fu fu fu fu fu fu fu fu fu fu")]
    public void TheDecimalComposer(double n, string want) => Assert.Equal(want, BmNumbers.NumberToWords(n));

    [Fact]
    public void BothRegisteredDigitSetsRead()
    {
        Assert.Equal(Nfc("muɡã ni kelẽ"), Text("21").Trim());
        Assert.Equal(Text("21"), Text("߂߁")); // N'Ko digits fold to ASCII → identical IPA
    }

    // ── TEXT NORMALIZATION ────────────────────────────────────────────────────────────────────────────
    // Asserted on the STRING the pass produces, not on IPA, because that is the layer under test.

    [Theory]
    [InlineData("40%", "40 kɛmɛsarada")]
    [InlineData("50.5%", "50 5 kɛmɛsarada")]                              // the decimal branch still runs after
    // The sign is a token boundary, so the replacement has to supply one (`10%ye`, corpus).
    [InlineData("a 10%ye bagangena", "a 10 kɛmɛsarada ye bagangena")]
    // ONE intervening word is allowed — `ye`/`ma`/`dɔrɔn`/`dafa`, 10 corpus instances.
    [InlineData("hakɛ ye 52 ye %", "hakɛ ye 52 ye kɛmɛsarada")]
    // ⚠ The corpus writes the word AND the sign; say it once.
    [InlineData("bikɔnɔtɔn kɛmɛsarada 90%", "bikɔnɔtɔn kɛmɛsarada 90")]
    public void PercentIsPostposedAndSaidOnce(string input, string want) =>
        Assert.Equal(want, BmNormalize.NormalizeBambara(input));

    [Theory]
    [InlineData("5km", "kilomɛtɛrɛ 5")]
    [InlineData("619,745 km²", "kilomɛtɛrɛ kɛnɛ 619745")]                 // de-grouped first
    [InlineData("13000 Km2", "kilomɛtɛrɛ kɛnɛ 13000")]                    // ⚠ CAPITAL K, the corpus form
    // The magnitude hop, and the decimal tail still reaches step 11 afterwards.
    [InlineData("30.2 million km²", "kilomɛtɛrɛ kɛnɛ 30 2 million")]
    [InlineData("5-10 cm", "santimɛtɛrɛ 5 fo 10")]                        // one unit, two endpoints
    [InlineData("120 m2", "mɛtɛrɛ kɛnɛ 120")]                             // declared as km²'s neighbour
    [InlineData("152 000 m³", "152000 m³")]                               // ⚠ no cube word is sourceable
    public void TheUnitNounGoesBeforeTheNumber(string input, string want) =>
        Assert.Equal(want, BmNormalize.NormalizeBambara(input));

    [Theory]
    [InlineData("619,745", "619745")]
    [InlineData("114.983", "114983")]
    [InlineData("241 038", "241038")]
    [InlineData("1.231.238", "1231238")]
    // The SAME two marks are the decimal separators; a non-3-digit tail is left for step 11.
    [InlineData("7,62", "7 6 2")]
    [InlineData("1.8 milion", "1 8 milion")]
    // A trailing CLAUSE comma must survive rather than being eaten as a fourth group.
    [InlineData("san 24,000, nka", "san 24000, nka")]
    public void DeGroupingAllThreeSeparators(string input, string want) =>
        Assert.Equal(want, BmNormalize.NormalizeBambara(input));

    [Theory]
    [InlineData("(1965-1969)", "(1965 fo 1969)")]
    [InlineData("san 40 - 10 ɲɔgɔnna", "san 40 - 10 ɲɔgɔnna")]           // descending → declined
    [InlineData("9500- 9500", "9500- 9500")]                              // equal → declined
    // An ISBN is claimed whole, so its inner pairs never reach the range rule.
    [InlineData("ISBN 978-84-8168-394-3.", "ISBN 9 7 8 8 4 8 1 6 8 3 9 4 3.")]
    // ⚠ A RANGE THAT ENDS A CLAUSE KEEPS `fo` — the guard used to reject a following `.` too, and both of
    // this corpus's clause-final spans (reference page ranges) read as two juxtaposed cardinals.
    [InlineData("pp. 86–99.", "pp. 86 fo 99.")]
    [InlineData("san 1954 -1981.", "san 1954 fo 1981.")]
    [InlineData("1965-1969, ni", "1965 fo 1969, ni")]
    // …and step 11 still reads a decimal right operand's tail whole.
    [InlineData("10-15.5", "10 fo 15 5")]
    public void RangesJoinWithFoAndOnlyWhenAscending(string input, string want) =>
        Assert.Equal(want, BmNormalize.NormalizeBambara(input));

    /** ⚠ A DECIMAL RIGHT OPERAND STILL DECLINES: a trailing `,` can open a fractional part, and Bambara
     *  writes a decimal comma ×42. The guard is `[.,]\d`, so a fraction is refused and a clause comma is not. */
    [Fact]
    public void ADecimalRightOperandIsNotARange() =>
        Assert.DoesNotContain(" fo ", BmNormalize.NormalizeBambara("1965-1969,5"));

    [Theory]
    [InlineData("k'a ta san 1914", "ka ta san 1914")]
    [InlineData("i n’a fɔ", "i na fɔ")]      // the curly apostrophe too
    [InlineData("y'i", "yi")]
    // ⚠ THE SAME MARK ALSO SPLITS A PRONOUN OFF THE NEXT WORD in this wiki's non-standard orthography — a
    // boundary, not an elision, and gluing it would fuse two words. A vowel on the left is what separates them.
    [InlineData("u'be taa", "u'be taa")]
    [InlineData("N'ko", "N'ko")]             // C'C — the script's own name is untouched
    public void TheElisionApostropheGluesOnlyCV(string input, string want) =>
        Assert.Equal(want, BmNormalize.NormalizeBambara(input));

    [Theory]
    [InlineData("304 K.Ɲ. fo san 232 K.Ɲ.", "304 Krisita ɲɛ fo san 232 Krisita ɲɛ.")]
    [InlineData("A.R.P. bangera", "ARP bangera")]
    [InlineData("kengani U.S.A. Awa katti", "kengani USA. Awa katti")]    // a capital follows → keep the dot
    // ⚠ The 27-group alphabet listing is left alone rather than half-claimed.
    [InlineData("A.B.C.D.E.Ɛ.F.", "A.B.C.D.E.Ɛ.F.")]
    public void DottedAbbreviationsAndTheSentencePeriod(string input, string want) =>
        Assert.Equal(want, BmNormalize.NormalizeBambara(input));

    [Theory]
    [InlineData("$4", "dolar 4")]
    [InlineData("dolar miliyar $4", "dolar miliyar 4")]                   // named already, magnitude in the way
    [InlineData("dolar wari US$ 1.25", "dolar wari US 1 2 5")]            // the code keeps its boundary
    [InlineData("S&P", "S ani P")]                                        // spaced, so `A&B` is not one token
    public void CurrencyAndAmpersand(string input, string want) =>
        Assert.Equal(want, BmNormalize.NormalizeBambara(input));

    [Theory]
    [InlineData("25 %", "muɡã ni duuru kɛmɛsarada")]
    [InlineData("5 km²", "kilomɛtɛrɛ kɛnɛ duuru")]
    [InlineData("$5", "dolar duuru")]
    public void EveryEmittedWordComesFromTheG2p(string input, string want) =>
        Assert.Equal(Nfc(want), Text(input).Trim());

    /** ⚠ THE N'KO PATH IS UNTOUCHED BY THE NORMALIZER — no rule in that layer keys on a character N'Ko uses. */
    [Fact]
    public void TheNkoPathSurvivesNormalization() => Assert.Equal(Text("ߒߞߏ 21"), Text("ߒߞߏ ߂߁"));

    // HOMOGLYPHS. None of ε U+03B5 / ԑ U+0511 / ᴐ U+1D10 / ɳ U+0273 is in this g2p's grapheme table and none
    // is ASCII, so the tokenizer ENDED THE WORD at the character and dropped it — `Ntεnεndon` came out in
    // three fragments. ⚠ Not foldable globally: `Unicode.FoldLatinConfusables` would send ε to `e`, and /e/
    // and /ɛ/ are two different Bambara phonemes.
    [Theory]
    [InlineData("Ntεnεndon", "Ntɛnɛndon")]
    [InlineData("sԑbԑn sᴐrᴐ", "sɛbɛn sɔrɔ")]
    [InlineData("A boɳa", "A boɲa")]
    [InlineData("ʃi fɔcogo", "ʃi fɔcogo")]   // ×3 with an unsettled target — deliberately left alone
    public void HomoglyphsFoldToTheLanguagesOwnLetters(string input, string want) =>
        Assert.Equal(want, BmNormalize.NormalizeBambara(input));

    [Theory]
    [InlineData("Ntεnεndon ne bε Taa", "Ntɛnɛndon ne bɛ Taa")]
    [InlineData("A boɳa bɛ", "A boɲa bɛ")]
    public void AFoldedWordIsWholeAgain(string typed, string correct) => Assert.Equal(Text(correct), Text(typed));
}
