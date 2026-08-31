/**
 * The portable half of test/lulesami.test.ts — Lule Sami / julevsámegiella (smj), Uralic (Saami branch),
 * the 1983 Latin orthography. AUTHORED from Ylikoski, "Lule Saami": a TRANSPARENT SEGMENTAL scan, with the
 * complex morphophonology (consonant gradation, epenthetic vowels, labial harmony, unwritten length) left
 * as the deferred residual. The hallmark is the North-Saami-style VOICELESS ⟨b d g⟩ → [p t k]
 * (aspiration-not-voicing). First-syllable stress, always emitted.
 *
 * ⚠ THIS SUITE CARRIES MORE THAN THE TS SUITE'S ASSERTIONS, AND DELIBERATELY. smj has no FLEURS split, no
 * mined artifact and no lexicon, so `tools/gen_parity_goldens.mts` produces NO golden for it and the fleet
 * parity run covers this language with ZERO rows. That makes this file the only standing regression gate
 * the port has, so the multigraph longest-match order and the four number stem alternations — which are
 * data an ordinary golden would pin implicitly — are pinned explicitly here instead.
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Core;
using Xunit;
using SmjEngine = Vernacula.Phonemizer.Languages.LuleSami.LuleSamiPhonemizer;
using SmjNumbers = Vernacula.Phonemizer.Languages.LuleSami.Numbers;

namespace Vernacula.Phonemizer.Tests;

public class LuleSamiTests
{
    private static readonly JsRe WS = JsRegex.Compile("\\s+", "gu");
    private static string Word(string s) => SmjEngine.PhonemizeWord(s);
    private static string Say(string s) => Js.Trim(WS.Replace(Phonemizer.Phonemize(s, "smj"), " "));

    /** ⚠ THE ORTHOGRAPHY TRAP: word-initial ⟨b d g⟩ are VOICELESS [p t k], not voiced — and ⟨p t k⟩ are the
     *  marginal ASPIRATED loan series, word-initially only. Medially they stay PLAIN. */
    [Theory]
    [InlineData("bena", "ˈpenɑ")]           // 'dog' — ⟨b⟩→[p], NOT [b]; ⟨a⟩→[ɑ]
    [InlineData("giella", "ˈkielːɑ")]       // 'language' — ⟨g⟩→[k], ⟨ie⟩ diphthong, ⟨ll⟩ geminate
    [InlineData("guokta", "ˈkuoktɑ")]       // 'two' — medial ⟨k t⟩ are PLAIN, not [kʰ tʰ]
    [InlineData("tállá", "ˈtʰɑːlːɑː")]      // WORD-INITIAL ⟨t⟩ = the aspirated loan stop [tʰ]
    [InlineData("tjoarvve", "ˈt͡ʃoɑrvːe")] // 'horn' — ⟨tj⟩, ⟨oa⟩, ⟨vv⟩
    [InlineData("njunnje", "ˈɲuɲːe")]       // 'nose' — ⟨nj⟩→[ɲ], ⟨nnj⟩→[ɲː]
    [InlineData("biellje", "ˈpieʎːe")]      // 'ear' — ⟨b⟩→[p], ⟨ie⟩, ⟨llj⟩→[ʎː]
    [InlineData("sj", "ˈʃ")]
    [InlineData("tj", "ˈt͡ʃ")]
    [InlineData("dtj", "ˈd͡ʒ")]             // the voiced affricate
    [InlineData("ddj", "ˈɟː")]              // the geminate-only palatal stop
    [InlineData("á", "ˈɑː")]                // the one written vowel-length contrast
    public void ThePhonemizer(string word, string want) => Assert.Equal(want, Word(word));

    /**
     * ⚠ THE MULTIGRAPH LIST IS ORDERED DATA, AND THE ORDER IS THE ONLY THING THAT MAKES IT CORRECT. The scan
     * takes the FIRST entry that matches at the cursor, so every trigraph must precede the digraph it
     * begins with and every digraph must precede its own letters. Pinned explicitly because with no golden
     * nothing else would catch a reordered table — the rows below each fail if their trigraph is shadowed.
     */
    [Theory]
    [InlineData("ddja", "ˈɟːɑ")]     // ddj, not dd + j or d + dj
    [InlineData("dtja", "ˈd͡ʒɑ")]    // dtj, not d + tj
    [InlineData("dtsa", "ˈd͡zɑ")]    // dts, not d + ts
    [InlineData("ssja", "ˈʃːɑ")]     // ssj, not ss + j or s + sj
    [InlineData("ttja", "ˈt͡ʃːɑ")]   // ttj, not tt + j or t + tj
    [InlineData("ttsa", "ˈt͡sːɑ")]   // tts, not tt + s or t + ts
    [InlineData("nnja", "ˈɲːɑ")]     // nnj, not nn + j or n + nj
    [InlineData("llja", "ˈʎːɑ")]     // llj, not ll + j or l + lj
    [InlineData("dja", "ˈɟɑ")]
    [InlineData("tsa", "ˈt͡sɑ")]
    [InlineData("lja", "ˈʎɑ")]
    [InlineData("nja", "ˈɲɑ")]
    [InlineData("iea", "ˈieɑ")]
    [InlineData("uoa", "ˈuoɑ")]
    [InlineData("oaa", "ˈoɑɑ")]
    public void TheMultigraphOrderIsTheData(string word, string want) => Assert.Equal(want, Word(word));

    /** ⚠ ASPIRATION IS WORD-INITIAL ONLY, and only on a BARE ⟨p t k⟩ — a digraph or geminate starting with
     *  one of them has already been consumed, so it never reaches the aspiration branch. */
    [Theory]
    [InlineData("pa", "ˈpʰɑ")]
    [InlineData("ta", "ˈtʰɑ")]
    [InlineData("ka", "ˈkʰɑ")]
    [InlineData("apa", "ˈɑpɑ")]      // medial: plain
    [InlineData("tja", "ˈt͡ʃɑ")]     // the digraph wins, so no ʰ
    [InlineData("tta", "ˈtːɑ")]      // the geminate wins, so no ʰ
    [InlineData("ba", "ˈpɑ")]        // ⟨b⟩ is [p] and takes NO aspiration
    public void AspirationIsWordInitialAndBareOnly(string word, string want) => Assert.Equal(want, Word(word));

    /** Registry wiring, clause assembly, and the punctuation fold (everything but . ! ? becomes a comma). */
    [Theory]
    [InlineData("bena", "ˈpenɑ")]
    [InlineData("bena, giella", "ˈpenɑ , ˈkielːɑ")]
    [InlineData("bena. giella", "ˈpenɑ . ˈkielːɑ")]
    [InlineData("bena; giella", "ˈpenɑ , ˈkielːɑ")]   // `;` folds to a comma pause
    [InlineData("bena: giella", "ˈpenɑ , ˈkielːɑ")]
    [InlineData("bena… giella", "ˈpenɑ , ˈkielːɑ")]
    [InlineData("bena! giella?", "ˈpenɑ ! ˈkielːɑ ?")]
    public void TheClauseAssembly(string text, string want) => Assert.Equal(want, Say(text));

    /**
     * CARDINALS — native Uralic decimal, written SOLID (Finnish-style) below a million; only 10⁶/10⁹ are
     * separate words. Authored from the Divvun/Giellatekno digit→text transducer, whose own comments mark
     * the branch followed here as the one for text-to-speech.
     *
     * ⚠ THE FOUR STEM ALTERNATIONS ARE THE WHOLE POINT and each gets a row: free `lågev` 10, `-låhke` ×10
     * with no unit, `-låk-` ×10 before a unit, and the teen `lågenan-` which FLIPS to unit + `lågenan` when
     * it multiplies a magnitude.
     */
    [Theory]
    [InlineData(0, "nålla")]
    [InlineData(7, "gietjav")]
    [InlineData(10, "lågev")]                     // free-standing ten
    [InlineData(15, "lågenanvihtta")]             // ATTESTED (repo testdata)
    [InlineData(20, "guoktalåhke")]               // ×10 with NO following unit
    [InlineData(21, "guoktalåkakta")]             // ×10 BEFORE a unit → -låk-
    [InlineData(45, "nielljalåkvihtta")]          // ATTESTED
    [InlineData(100, "tjuohte")]                  // bare, no leading akta
    [InlineData(164, "tjuohteguhttalåkniellja")]  // ATTESTED
    [InlineData(333, "gålmmåtjuohtegålmmålåkgålmmå")] // ATTESTED
    [InlineData(1000, "tuvsán")]
    [InlineData(1001, "tuvsánakta")]              // the thousand and its remainder concatenate
    [InlineData(2509, "guoktatuvsánvihttatjuohteaktse")] // ATTESTED
    // ⚠ THE TEEN FLIPS as a magnitude multiplier: 12 000 is guokta+lågenan+tuvsán, not lågenan+guokta+…
    [InlineData(12000, "guoktalågenantuvsán")]
    [InlineData(12345, "guoktalågenantuvsángålmmåtjuohtenielljalåkvihtta")]
    [InlineData(1000000, "millijåvnnå")]
    [InlineData(1000000000, "millijárdda")]
    public void TheCardinalStemAlternations(double n, string want) =>
        Assert.Equal(want, SmjNumbers.NumberToWords(n));

    /** The same figures through the engine, which is what pins the solid-word shape end to end. */
    [Theory]
    [InlineData("0", "ˈnolːɑ")]
    [InlineData("7", "ˈkiet͡ʃɑv")]
    [InlineData("15", "ˈlokenɑnvihtːɑ")]
    [InlineData("20", "ˈkuoktɑlohke")]
    [InlineData("21", "ˈkuoktɑlokɑktɑ")]
    [InlineData("45", "ˈnieʎːɑlokvihtːɑ")]
    [InlineData("100", "ˈt͡ʃuohte")]
    [InlineData("164", "ˈt͡ʃuohtekuhtːɑloknieʎːɑ")]
    [InlineData("333", "ˈkolmːot͡ʃuohtekolmːolokkolmːo")]
    [InlineData("1000", "ˈtʰuvsɑːn")]             // initial ⟨t⟩ is the aspirated loan stop
    [InlineData("2509", "ˈkuoktɑtuvsɑːnvihtːɑt͡ʃuohteɑkt͡se")]
    [InlineData("12345", "ˈkuoktɑlokenɑntuvsɑːnkolmːot͡ʃuohtenieʎːɑlokvihtːɑ")]
    [InlineData("1000000", "ˈmilːijovnːo")]
    [InlineData("1000000000", "ˈmilːijɑːrtːɑ")]
    public void TheCardinalsThroughTheEngine(string text, string want) => Assert.Equal(want, Say(text));

    /**
     * ⚠ `ReadDigits` ITERATES CODE POINTS, NOT CODE UNITS — the TS spells it `[...digits]`, which keeps an
     * astral pair TOGETHER. That is the opposite of the Latvian and Lithuanian `split("")` sites, and
     * getting it the other way round would split an emoji into two surrogate halves.
     *
     * ⚠ Built in the body, not as `InlineData`: xUnit serializes theory arguments and a lone surrogate does
     * not survive that round trip — it returns as U+FFFD and the row goes on reporting green.
     */
    [Fact]
    public void ReadDigitsIteratesCodePointsNotCodeUnits()
    {
        const string pair = "😀"; // one astral character, two code units
        Assert.Equal($"akta {pair} guokta", SmjNumbers.ReadDigits($"1{pair}2"));
        Assert.Equal(pair, SmjNumbers.ReadDigits(pair));   // ONE token, not two halves
        Assert.Equal("nålla nålla gietjav", SmjNumbers.ReadDigits("007"));
        Assert.Equal("a b c", SmjNumbers.ReadDigits("abc"));
        Assert.Equal("", SmjNumbers.ReadDigits(""));
    }

    /** ⚠ A LONE SURROGATE MUST NOT THROW — `PhonemizeWord` NFC-normalizes the raw word, and .NET's
     *  `string.Normalize` throws on an unpaired half where JS is indifferent (#1199). The stranded half is
     *  simply dropped; note `a\ud83db` reads as "ˈɑp" because ⟨b⟩ is [p]. */
    [Fact]
    public void ALoneSurrogateDoesNotThrow()
    {
        const string hi = "\ud83d";
        Assert.Equal("", Word(hi));
        Assert.Equal("ˈɑ", Word($"a{hi}"));
        Assert.Equal("ˈɑp", Word($"a{hi}b"));
        Assert.Equal("", Word(""));
    }

    /**
     * The normalization layer is `separatorHygiene` and NOTHING ELSE, because this language has no corpus:
     * not one rule emits a word. A grouped figure stops reading as two or three sentences; every class that
     * needs evidence — `%`, currency, degrees, the clock, the hyphen, abbreviations — is left untouched and
     * still visible to the leak gates.
     */
    [Theory]
    // The DOT/COMMA multi-group form is claimed, so this is ONE number.
    [InlineData("1.234.567", "ˈmilːijovnːo ˈkuoktɑt͡ʃuotekolmːoloknieʎːɑtuvsɑːnvihtːɑt͡ʃuohtekuhtːɑlokkiet͡ʃɑv")]
    [InlineData("3,5", "ˈkolmːo ˈvihtːɑ")]              // a short decimal becomes two numbers, not a break
    [InlineData("1990–1995", "ˈtʰuvsɑːnɑkt͡set͡ʃuohteɑkt͡selohke , ˈtʰuvsɑːnɑkt͡set͡ʃuohteɑkt͡selokvihtːɑ")]
    [InlineData("5 %", "ˈvihtːɑ")]                      // no percent word is emitted — none is sourced
    [InlineData("€5", "ˈvihtːɑ")]                       // nor a currency word
    [InlineData("12:30", "ˈlokenɑnkuoktɑ , ˈkolmːolohke")] // no clock rule: the colon keeps its pause
    // ⚠ THE SPACE-GROUPED FORM IS NOT CLAIMED, AND THIS PINS THE DEFECT RATHER THAN THE INTENT. `1 000`
    // reads as *akta nålla* — "one zero", a silent 1000× error, which is precisely the class
    // `separatorHygiene` was built to close (its header's motivating case is `17,000` → *seventeen, ZERO*).
    // The space is neither claimed by the pass nor listed among its refusals, and it is the STANDARD
    // thousands separator in the Nordic orthography this language is written in. Filed as #1212; pinned as
    // it reads so that a fix has to change this line deliberately.
    [InlineData("1 000", "ˈɑktɑ ˈnolːɑ")]
    [InlineData("1 000 000", "ˈɑktɑ ˈnolːɑ ˈnolːɑ")]
    public void TheNormalizationIsSeparatorHygieneAndNothingElse(string text, string want) =>
        Assert.Equal(want, Say(text));
}
