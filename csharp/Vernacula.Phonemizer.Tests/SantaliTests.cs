// Canonical-IPA goldens for Santali (sat) — ᱥᱟᱱᱛᱟᱲᱤ, Munda (Austroasiatic), the OL CHIKI alphabet
// (U+1C50–1C7F). A grapheme scan + sign rules: ⟨ᱷ⟩ aspirates the preceding stop (ᱵᱷ→bʱ), ⟨ᱹ⟩ modifies the
// vowel (ᱟᱹ→ə), ⟨ᱸ⟩ nasalizes it (ᱟᱸ→ã), and the HALLMARK — a word-final voiced stop is CHECKED
// (ᱫᱟᱜ→dakʼ, ᱢᱮᱫ→metʼ). Ported 1:1 from test/santali.test.ts; the evidence for every rule is in
// src/languages/santali/normalize.ts's header.
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Santali;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class SantaliTests
{
    private static string Word(string s) => SantaliPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "sat").Trim();

    // ── THE GRAPHEME SCAN AND THE SIGN RULES ──────────────────────────────────────────────────────────

    /** Word-final CHECKED stops — the Santali hallmark. A sonorant is not checked. */
    [Theory]
    [InlineData("ᱫᱟᱜ", "dakʼ")]      // 'water' — final ⟨ᱜ⟩ ɡ→checked [kʼ]
    [InlineData("ᱢᱮᱫ", "metʼ")]      // 'eye' — final ⟨ᱫ⟩ d→[tʼ]
    [InlineData("ᱪᱮᱫ", "cetʼ")]      // 'what' — ⟨ᱪ⟩→c, final ⟨ᱫ⟩→[tʼ]
    [InlineData("ᱦᱚᱲ", "hɔɽ")]       // 'person/Santal' — ⟨ᱲ⟩→ɽ, no checking on a sonorant
    public void WordFinalCheckedStops(string olchiki, string want) => Assert.Equal(want, Word(olchiki));

    /** Nasalization ⟨ᱸ⟩, vowel-mod ⟨ᱹ⟩→ə, aspiration ⟨ᱷ⟩. */
    [Theory]
    [InlineData("ᱪᱟᱸᱫᱚ", "cãdɔ")]     // 'moon' — ⟨ᱟᱸ⟩→[ã], ⟨ᱚ⟩→ɔ
    [InlineData("ᱯᱟᱹᱨᱥᱤ", "pərsi")]   // 'language' — ⟨ᱟᱹ⟩→[ə]
    [InlineData("ᱵᱷᱟᱨᱚᱛ", "bʱarɔt")]  // 'India' — ⟨ᱵᱷ⟩→[bʱ] aspirated
    public void NasalizationVowelModAndAspiration(string olchiki, string want) => Assert.Equal(want, Word(olchiki));

    /** Palatal ⟨ᱡ⟩→ɟ, the script's own name, and a multi-word phrase (checking applies PER WORD). */
    [Theory]
    [InlineData("ᱚᱡᱚ", "ɔɟɔ")]
    [InlineData("ᱥᱟᱱᱛᱟᱲᱤ", "santaɽi")]
    [InlineData("ᱚᱞ ᱪᱮᱢᱮᱫ", "ɔl cemetʼ")]
    public void PalatalScriptNameAndMultiWord(string olchiki, string want) => Assert.Equal(want, Word(olchiki));

    /** ⟨ᱽ AHAD⟩ blocks final checking; ⟨ᱶ OV⟩→w̃; a nasalized/ɛ nucleus still checks. */
    [Theory]
    [InlineData("ᱨᱳᱜ", "rokʼ")]        // final ⟨ᱜ⟩ ɡ→checked [kʼ]
    [InlineData("ᱨᱳᱜᱽ", "roɡ")]        // + ⟨ᱽ AHAD⟩ → PLAIN, unchecked (the minimal pair)
    [InlineData("ᱥᱟᱶ", "saw̃")]         // ⟨ᱶ OV⟩ = the NASAL glide [w̃] (vs ⟨ᱣ⟩ [w])
    [InlineData("ᱥᱮᱺᱜᱮᱹᱞ", "sɛ̃ɡɛl")]   // ⟨ᱮᱺ⟩ → lowered + nasalized [ɛ̃]
    public void AhadBlocksCheckingAndTheNasalGlide(string olchiki, string want) => Assert.Equal(want, Word(olchiki));

    // ── CARDINALS — the NATIVE MUNDA decimal series with the IA loan magnitudes above it ───────────────

    /** Native ᱜᱮᱞ decimal, SPACED, purely additive. The multiplier ONE is WRITTEN (100 = ᱢᱤᱫ ᱥᱟᱭ). */
    [Theory]
    [InlineData("0", "sun")]                    // ᱥᱩᱱ — an IA loan; no native Munda zero exists
    [InlineData("5", "mɔɳe")]                   // ᱢᱚᱬᱮ
    [InlineData("11", "ɡel mitʼ")]              // ᱜᱮᱞ ᱢᱤᱫ — SPACED in Ol Chiki practice
    [InlineData("25", "bar ɡel mɔɳe")]          // ᱵᱟᱨ ᱜᱮᱞ ᱢᱚᱬᱮ — attested; 'two-ten-five'
    [InlineData("47", "pun ɡel ejaj")]          // Ghosh's own worked example
    [InlineData("100", "mitʼ saj")]             // ᱢᱤᱫ ᱥᱟᱭ, never bare ᱥᱟᱭ
    public void NativeDecimalCardinals(string text, string want) => Assert.Equal(want, Say(text));

    /** IA loan magnitudes + Indian 2-2-3 grouping — there is no Santali "million" or "billion". */
    [Theory]
    [InlineData("1200", "mitʼ haɟar bar saj")]  // attested in prose
    [InlineData("5000", "mɔɳe haɟar")]          // attested
    [InlineData("100000", "mitʼ lakʰ")]         // 10⁵ is a LAKH, not "hundred thousand"
    [InlineData("1000000", "ɡel lakʰ")]         // ten lakh — Santali has no "million"
    [InlineData("10000000", "mitʼ kɔrɔɽ")]      // 10⁷ is a CRORE
    public void LoanMagnitudesAndIndianGrouping(string text, string want) => Assert.Equal(want, Say(text));

    /** OL CHIKI digits ᱐-᱙ compose exactly like Western ones — ᱒᱕ is the same number as 25. */
    [Fact]
    public void OlChikiDigitsComposeLikeWesternOnes() => Assert.Equal("bar ɡel mɔɳe", Say("᱒᱕"));

    // ── TEXT NORMALIZATION ────────────────────────────────────────────────────────────────────────────

    /**
     * ⚠ THE LARGEST DEFECT IN THE LANGUAGE, and it is not a number rule: sat.wikipedia types
     * ⟨ᱹ GAAHLAA⟩ as an ASCII PERIOD (246×). Each one split its word, inserted a clause pause AND left
     * the vowel unmodified. The invariant is an EQUALITY — the corpus's own minimal pair, 55 of its 142
     * dotted forms having their signed twin in the same 242 segments.
     */
    [Theory]
    [InlineData("ᱞᱟ.ᱜᱤᱫ", "ᱞᱟᱹᱜᱤᱫ")]        // 'for' — the commonest, ×9
    [InlineData("ᱟ.ᱰᱤ", "ᱟᱹᱰᱤ")]            // 'very'
    [InlineData("ᱠᱟ.ᱢᱤ", "ᱠᱟᱹᱢᱤ")]          // 'work'
    [InlineData("ᱢᱤᱫᱴᱟ.ᱝ", "ᱢᱤᱫᱴᱟᱹᱝ")]      // 'one'
    [InlineData("ᱨᱩᱣᱟ.", "ᱨᱩᱣᱟᱹ")]          // 'fever' — the WORD-FINAL branch, a different arm
    [InlineData("ᱴᱷᱟ.ᱣᱠᱟ.ᱱ", "ᱴᱷᱟᱹᱣᱠᱟᱹᱱ")]  // two dots in one word
    public void TheDottedSpellingReadsAsTheSignedOne(string dotted, string signed) =>
        Assert.Equal(Say(signed), Say(dotted));

    /** …and it is the RIGHT reading, not merely a matching one. */
    [Fact]
    public void TheDottedSpellingReadsCorrectly()
    {
        Assert.Equal("ləɡitʼ", Say("ᱞᱟ.ᱜᱤᱫ"));
        Assert.Equal("ruwə", Say("ᱨᱩᱣᱟ."));
    }

    /**
     * ⚠ THE ADVERSARIAL NEIGHBOUR, and the reason the rule keys on ⟨ᱟ⟩ rather than the vowel class: a
     * wider class rewrote PSLV's first dot to a GAAHLAA and glued the acronym shut (*pies el bʱi*).
     */
    [Theory]
    [InlineData("ᱯᱤ.ᱮᱥ.ᱮᱞ.ᱵᱷᱤ", "pi es el bʱi")]   // PSLV — letter names, not one word
    [InlineData("ᱟᱨ.ᱮᱱ.ᱟᱭ", "ar en aj")]            // RNI
    [InlineData("ᱭᱩ.ᱴᱤ.ᱥᱤ", "ju ʈi si")]            // UTC
    // ⚠ THE ERA MARKER IS DELIBERATELY NOT EXPANDED — `ᱠ.ᱞ.` is a corpus hapax the wiki never spells
    // out, so it reads as its letters rather than a guessed phrase. Pinning this pins the REFUSAL.
    [InlineData("᱑᱙᱓ ᱠ.ᱞ.", "mitʼ saj are ɡel pe k l")]
    public void ADotAfterAConsonantIsAnInitialismSeparator(string text, string want) => Assert.Equal(want, Say(text));

    /** The ASCII hyphen is ⟨ᱼ PHAARKAA⟩ before the verb enclitic — and NOT in a compound. */
    [Fact]
    public void TheAsciiHyphenIsPhaarkaaOnlyBeforeTheEnclitic()
    {
        Assert.Equal(Say("ᱢᱮᱱᱟᱜᱼᱟ"), Say("ᱢᱮᱱᱟᱜ-ᱟ"));
        Assert.Equal("menakʼa", Say("ᱢᱮᱱᱟᱜ-ᱟ"));   // was *menakʼ a*, two words
        Assert.Equal("hujukʼa", Say("ᱦᱩᱭᱩᱜ-ᱟ"));
        // The ~29 genuine compound hyphens keep their word boundary, which is what they mean.
        Assert.Equal("ɔl tɔl", Say("ᱚᱞ-ᱛᱚᱞ"));
        Assert.Equal("inɖɔ ejrɔ", Say("ᱤᱱᱰᱚ-ᱮᱭᱨᱚ"));
    }

    /**
     * Both decimal conventions now AGREE. ⚠ NO DECIMAL WORD IS EMITTED and that refusal is priced:
     * stripping the separator would invent a quantity (`᱒᱒.᱓᱓` → *twenty-two thirty-three*).
     */
    [Fact]
    public void TheGaahlaaDecimalSeparatorFoldsOntoTheAsciiOne()
    {
        Assert.Equal(Say("᱓᱐.᱑"), Say("᱓᱐ᱹ᱑"));
        Assert.Equal(Say("᱒᱓.᱔᱔"), Say("᱒᱓ᱹ᱔᱔"));
        Assert.NotEqual(Say("᱓᱐᱑"), Say("᱓᱐ᱹ᱑"));   // and it is NOT read as a single number
    }

    /** De-grouping handles western 3-3-3 and Indian 2-2-3 alike. */
    [Fact]
    public void DeGroupingHandlesBothConventions()
    {
        Assert.Equal("ɡel haɟar", Say("᱑᱐,᱐᱐᱐"));
        Assert.Equal(Say("123456"), Say("᱑,᱒᱓,᱔᱕᱖"));        // Indian grouping — the 2-digit arm
        Assert.Equal(Say("299792458"), Say("᱒᱙᱙,᱗᱙᱒,᱔᱕᱘"));  // the speed of light, one number at last
        // A comma with ONE digit after it is not a group.
        Assert.Contains(",", Say("᱑᱒,᱕"));
    }

    /** Ranges take the attested INFIX ᱠᱷᱚᱱ — hyphen, en dash and ⟨ᱼ PHAARKAA⟩ alike. */
    [Fact]
    public void RangesTakeTheAttestedInfix()
    {
        Assert.Equal("bar kʰɔn pe ɡidrə", Say("᱒-᱓ ᱜᱤᱫᱽᱨᱟᱹ"));
        Assert.Contains("kʰɔn", Say("᱑᱙᱔᱕-᱑᱙᱔᱖"));
        Assert.Contains("kʰɔn", Say("᱑᱘᱔᱘ ᱼ ᱔᱙"));   // PHAARKAA used as a dash, ×4 digit-flanked
        Assert.Contains("kʰɔn", Say("᱑᱙᱓᱐ – ᱑᱙᱔᱘"));
    }

    /**
     * ⚠ THE GUARD IS THE POINT (trap 55). The SAME corpus writes subtraction and a true negative in its
     * arithmetic article, and a bare digit-hyphen-digit rule would read both as spans.
     */
    [Theory]
    [InlineData("᱑ - ᱐ = ᱑")]      // subtraction, not a span
    [InlineData("᱐ - ᱑ = -᱑")]     // and a genuine negative RESULT
    [InlineData("᱑᱐:᱓᱐ - ᱑᱑")]     // a clock field is not an operand
    public void TheRangeRuleRefusesArithmeticAndClockFields(string text) =>
        Assert.DoesNotContain("kʰɔn", Say(text));

    /** The sourced sign vocabulary, in the language's own POSTPOSED order. */
    [Theory]
    [InlineData("᱕᱐%", "mɔɳe ɡel sajkɔɽa")]                  // ᱥᱟᱭᱠᱚᱲᱟ, "per hundred"
    [InlineData("$᱕᱐᱐", "mɔɳe saj ɖɔlar")]
    [InlineData("₹᱕᱐᱐", "mɔɳe saj ʈaka")]
    [InlineData("US$᱑᱐᱐", "mitʼ saj ɖɔlar")]                 // the compound key; a bare `$` cannot match
    [InlineData("᱕ km", "mɔɳe kilɔmiʈɔr")]                   // was *mɔɳe ˈʊkm*, raw Latin
    [InlineData("᱕ km²", "mɔɳe bɔrɡɔ kilɔmiʈɔr")]            // ᱵᱚᱨᱜᱚ PRECEDES; was English *skwˈɛɹd*
    [InlineData("᱑᱐᱕ ᱠ.ᱢ.", "mitʼ saj mɔɳe kilɔmiʈɔr")]      // the NATIVE dotted abbreviation
    public void PercentCurrencyUnitsAndTheExponent(string text, string want) => Assert.Equal(want, Say(text));

    /** °C and the bare ° are read; °F and a Latin-direction coordinate are refused WHOLE (trap 53). */
    [Fact]
    public void TheDegreeAndWhatItRefuses()
    {
        Assert.Equal("pe ɡel ɖiɡri selsijɔs", Say("᱓᱐ °C"));
        Assert.Equal("pun ɡel ɖiɡri selsijɔs", Say("᱔᱐°C"));
        // The corpus's DOMINANT shape: a bare ° with the noun already spelled out in Santali.
        Assert.Equal("bar ɡel are ɖiɡri kʰɔn pe ɡel turuj ɖiɡri selsijɔs", Say("᱒᱙° ᱠᱷᱚᱱ ᱓᱖° ᱥᱮᱞᱥᱤᱭᱚᱥ"));
        // ⚠ REFUSED WHOLE, never half: no Fahrenheit word and no sourced direction words.
        Assert.DoesNotContain("ɖiɡri", Say("᱑᱐᱔°F"));
        Assert.DoesNotContain("ɖiɡri", Say("22.33°N"));
    }

    /** ZWNJ/ZWJ inside a word are stripped rather than splitting it (they are outside TOKEN's class). */
    [Theory]
    [InlineData("ᱦᱚ‌ᱲ", "hɔɽ")]   // U+200C ZWNJ — was *hɔ ɽ*
    [InlineData("ᱦᱚ‍ᱲ", "hɔɽ")]   // U+200D ZWJ
    public void ZeroWidthCharactersAreStrippedNotSplitOn(string text, string want) => Assert.Equal(want, Say(text));

    /**
     * ⚠ ⟨ᱻ RELAA⟩ IS THE VOWEL-LENGTH MARK and had no branch at all — it read as the EMPTY STRING inside
     * a live word. Repaired to PHAARKAA only after a CONSONANT, where the length reading is impossible.
     */
    [Fact]
    public void RelaaIsRepairedAfterAConsonantAndLengthensAfterAVowel()
    {
        Assert.Equal(Say("ᱦᱩᱭᱩᱜᱼᱟ"), Say("ᱦᱩᱭᱩᱜᱻᱟ"));
        Assert.Equal(Say("ᱱᱟᱜᱟᱨᱼᱮ"), Say("ᱱᱟᱜᱟᱨᱻᱮ"));
        Assert.Equal("miːmitʼ", Say("ᱢᱤᱻᱢᱤᱫ"));   // was "mimitʼ" — the sign was silent
        Assert.Equal("ɟiː", Say("ᱡᱤᱻ"));           // wiktionary's only RELAA headword, romanised *jiː*
    }

    /**
     * ⚠ AND THE LENGTH MARK SURVIVES THE OTHER VOWEL SIGNS — relaa is written AFTER ⟨ᱹ GAAHLAA⟩ and
     * combines with a NASAL vowel as readily as an oral one. A one-character guard destroyed both.
     */
    [Theory]
    [InlineData("ᱟᱹᱻ", "əː")]
    [InlineData("ᱟᱸᱻ", "ãː")]
    [InlineData("ᱟᱻ", "aː")]
    public void RelaaLengthensThroughGaahlaaAndMu(string text, string want) => Assert.Equal(want, Say(text));

    /** An orphan ⟨ᱺ MU-GAHLA⟩ is a colon; an attached one is still the lowering nasal sign. */
    [Fact]
    public void AnOrphanMuGahlaIsAColon()
    {
        Assert.Equal("sʈaɖijɔm , nɔɖe", Say("ᱥᱴᱟᱰᱤᱭᱚᱢ ᱺ ᱱᱚᱰᱮ"));   // was "sʈaɖijɔm nɔɖe"
        Assert.Equal("sə̃ɡiɲ", Say("ᱥᱟᱺᱜᱤᱧ"));                       // attached: unchanged
    }

    /**
     * ⚠ ORDINARY TEXT MUST SURVIVE, and a sentence end must not be lost. The dot rule rewrites a
     * character that is also this layer's clause punctuation, so this is the check that matters most.
     */
    [Fact]
    public void OrdinaryProseKeepsItsMucaadPausesAndGainsNoNewOnes()
    {
        var outp = Say("ᱦᱚᱲ ᱠᱚ ᱫᱚ ᱟ.ᱰᱤ ᱦᱩᱭᱩᱜ-ᱟ ᱾ ᱟᱨ ᱞᱟ.ᱜᱤᱫ ᱠᱟ.ᱢᱤ ᱢᱮᱱᱟᱜᱼᱟ ᱿");
        Assert.Equal("hɔɽ kɔ dɔ əɖi hujukʼa . ar ləɡitʼ kəmi menakʼa .", outp);
        Assert.Equal(2, outp.Count(c => c == '.'));   // exactly the two native terminators, no extras
    }

    /** An English ordinal goes to English WHOLE — `1st` is not *street*. */
    [Fact]
    public void AnEnglishOrdinalGoesToEnglishWhole()
    {
        Assert.Equal("fˈɝst", Say("1st"));                                   // was "mitʼ stɹˈiːt"
        Assert.Equal("θˈɝtʰˈiːnθ", Say("13th"));                             // was "ɡel pe tʰˈiːʲˈeᶦt͡ʃ"
        Assert.Equal("fˈɔːɹθ sˈɛnt͡ʃɚi bˈiː sˈiː ˈiː", Say("4th century BCE"));
        // ⚠ THE NEIGHBOUR IT MUST REFUSE: an Ol Chiki numeral takes no Latin ordinal suffix, and a plain
        // ASCII number is still read in SANTALI, not handed to English.
        Assert.Equal("ɡel pe", Say("13"));
        Assert.Equal("ɡel pe", Say("᱑᱓"));
    }

    /** `sq mi` and `ft` read as their attested Santali words — both were wrong in BOTH languages. */
    [Fact]
    public void SqMiAndFtReadAsTheirAttestedWords()
    {
        Assert.Contains("bɔrɡɔ majil", Say("(302,455 sq mi)"));   // was "sk mˈiː"
        Assert.Contains("pʰiʈ", Say("12,389 ft"));                // was the raw Latin `ft`
        // ⚠ THE NEIGHBOUR: no number, no unit. A bare `mi` is NOT a declared key and must stay English.
        Assert.Equal("mˈiː", Say("mi"));
    }

    /** A year range keeps its ᱠᱷᱚᱱ before a LIST colon, and still refuses a clock. */
    [Fact]
    public void AYearRangeKeepsItsInfixBeforeAListColon()
    {
        Assert.Contains("kʰɔn", Say("᱑᱙᱙᱘ᱼ᱑᱙᱙᱙: ᱠᱟᱞᱤᱫᱟᱥ"));
        Assert.DoesNotContain("kʰɔn", Say("᱑᱐:᱓᱐ - ᱑᱑"));
    }
}
