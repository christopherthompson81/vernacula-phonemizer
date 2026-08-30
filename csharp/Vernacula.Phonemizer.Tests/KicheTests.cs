/**
 * K'iche' (quc) — Qatzijob'al, the largest MAYAN language (~1.1M, Guatemala), Latin (ALMG).
 * The hallmark is the EJECTIVE/glottalized series ⟨b'⟩→[ɓ], ⟨k'⟩→[kʼ], ⟨q'⟩→[qʼ], ⟨ch'⟩→[t͡ʃʼ],
 * ⟨tz'⟩→[t͡sʼ], ⟨t'⟩→[tʼ] — CONTRASTING with the aspirated plain stops ⟨k⟩→[kʰ], ⟨ch⟩→[t͡ʃʰ], ⟨q⟩→[qʰ],
 * ⟨t⟩→[tʰ], ⟨tz⟩→[t͡sʰ]; ⟨x⟩→[ʃ], ⟨j⟩→[x], ⟨w⟩→[ʋ], ⟨r⟩→[ɻ], ⟨'⟩→[ʔ], ⟨ä⟩→[ə] (the sixth vowel). Vowel
 * length is UNWRITTEN (not emitted); FINAL stress. Referee: English Wiktionary (127, single-source).
 *
 * The portable half of test/kiche.test.ts. Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Kiche;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class KicheTests
{
    private static string Word(string s) => KicheePhonemizer.PhonemizeWord(s);
    private static string Text(string s) => Registry.GetPhonemizer("quc").Text(s).Trim();

    [Theory]
    [InlineData("kʼicheʼ", "kʼiˈt͡ʃʰeʔ")]   // the name — EJECTIVE ⟨k'⟩→[kʼ] vs aspirated ⟨ch⟩→[t͡ʃʰ], final ⟨'⟩→[ʔ]
    [InlineData("chʼaqabaʼ", "t͡ʃʼaqʰaˈɓaʔ")] // EJECTIVE ⟨ch'⟩→[t͡ʃʼ], ⟨b⟩→[ɓ], ⟨q⟩→[qʰ]
    [InlineData("kej", "ˈkʰex")]            // 'deer' — plain ⟨k⟩→[kʰ] aspirated, ⟨j⟩→[x]
    [InlineData("abaʼq", "aˈɓaʔqʰ")]        // ⟨b⟩→[ɓ] implosive, ⟨'⟩→[ʔ], ⟨q⟩→[qʰ] uvular
    public void TheEjectiveVsAspiratedContrast(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    [Theory]
    [InlineData("utz", "ˈut͡sʰ")]          // 'good' — ⟨tz⟩→[t͡sʰ]
    [InlineData("achi", "aˈt͡ʃʰi")]        // 'man' — ⟨ch⟩→[t͡ʃʰ]
    [InlineData("ixim", "iˈʃim")]          // 'maize' — ⟨x⟩→[ʃ]
    [InlineData("wuqüb", "ʋuˈqʰuɓ")]       // 'seven' — ⟨w⟩→[ʋ], ⟨ü⟩→[u], ⟨b⟩→[ɓ]
    [InlineData("abäj", "aˈɓəx")]          // 'stone' — the sixth vowel ⟨ä⟩→[ə] (vs plain ⟨a⟩→[a])
    [InlineData("dios", "diˈos")]          // Spanish loan — ⟨d⟩ kept (not silently dropped)
    public void TzXJWAndTheSixthVowel(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    /** THE APOSTROPHE GLYPHS NORMALISE TO ʼ BEFORE THE SCAN — the referee never writes the ASCII form,
     *  so this is pinned here rather than only in the golden. */
    [Theory]
    [InlineData("k'iche'", "kʼiˈt͡ʃʰeʔ")]  // ASCII apostrophes
    [InlineData("q'o", "ˈqʼo")]
    [InlineData("K’iche’", "kʼiˈt͡ʃʰeʔ")]  // curly + the case fold
    [InlineData("k`iche`", "kʼiˈt͡ʃʰeʔ")]  // the backtick
    public void TheApostropheGlyphsFoldToTheModifier(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    /** A multi-word phrase (some referee headwords) splits so EACH word gets its own final stress. */
    [Fact]
    public void AMultiWordPhraseGetsOneStressPerWord()
    {
        Assert.Equal("aˈɓəx ˈtʰeʋ", Word("abäj tew"));
    }

    /**
     * NUMBERS — VIGESIMAL (base 20), with the score series split across THREE bases — ⟨winaq⟩ (20, 40),
     * ⟨k'al⟩ (60, then 100–380), ⟨much'⟩ (80 — NOT 400) and ⟨q'o⟩ (400). Every form is verbatim from
     * ALMG, *Gramática Normativa del Idioma K'iche'* §1.7.4. Composition is ADDITIVE; Classical Mayan
     * OVERCOUNTING is deliberately not generated. See Numbers.cs / the TS for the sourcing.
     */
    [Theory]
    [InlineData(1, "jun")]
    [InlineData(7, "wuqub'")]
    [InlineData(10, "lajuj")]
    [InlineData(15, "jolajuj")]                 // ALMG's form (Christenson has o'lajuj)
    [InlineData(19, "b'elejlajuj")]
    [InlineData(20, "juwinaq")]                 // ⟨winaq⟩ 'person' = 20
    [InlineData(21, "juwinaq jun")]             // additive, attested verbatim
    [InlineData(40, "kawinaq")]
    [InlineData(42, "kawinaq keb'")]
    [InlineData(60, "oxk'al")]                  // the base switches to ⟨k'al⟩
    [InlineData(61, "oxk'al jun")]
    [InlineData(80, "jumuch'")]                 // ⟨much'⟩ = 80
    [InlineData(81, "jumuch' jun")]
    [InlineData(99, "jumuch' b'elejlajuj")]
    [InlineData(100, "jok'al")]                 // NATIVE 5×20, not a Spanish loan
    [InlineData(101, "jok'al jun")]
    [InlineData(200, "lajk'al")]
    [InlineData(380, "b'elejlajk'al")]
    [InlineData(399, "b'elejlajk'al b'elejlajuj")]
    [InlineData(400, "juq'o")]                  // ⟨q'o⟩ = 400
    [InlineData(401, "juq'o jun")]
    [InlineData(800, "kaq'o'")]
    [InlineData(1000, "kaq'o' lajk'al")]        // 800 + 200 — attested
    [InlineData(3999, "b'elejq'o' b'elejlajk'al b'elejlajuj")] // top of the composed range
    public void TheVigesimalSeries(int n, string expected) =>
        Assert.Equal(expected, Numbers.NumberToWords(n));

    [Fact]
    public void NoGapsOrSentinelsAcrossZeroThroughThreeNineNineNine()
    {
        for (var n = 0; n <= 3999; n++)
        {
            var w = Numbers.NumberToWords(n);
            Assert.DoesNotContain("undefined", w);
            Assert.DoesNotContain("NaN", w);
            Assert.DoesNotContain("0", w);
            Assert.DoesNotContain("1", w);
            Assert.DoesNotContain("2", w);
            Assert.DoesNotContain("3", w);
            Assert.DoesNotContain("4", w);
            Assert.DoesNotContain("5", w);
            Assert.DoesNotContain("6", w);
            Assert.DoesNotContain("7", w);
            Assert.DoesNotContain("8", w);
            Assert.DoesNotContain("9", w);
        }
    }

    /** ≥ 4000 has NO documented K'iche' numeral, so it reads digit-by-digit. ⟨majb'al⟩ for zero is a
     *  popular neologism, not ALMG-normative — flagged in the TS header. */
    [Theory]
    [InlineData(0, "majb'al")]
    [InlineData(4000, "kajib' majb'al majb'al majb'al")]
    public void AboveTheAttestedRangeTheDigitsAreRead(int n, string expected) =>
        Assert.Equal(expected, Numbers.NumberToWords(n));

    /**
     * ⚠ THE 2^53 ARM, WHICH THE TS SUITE DOES NOT PIN. Above 2^53 the double has already lost its low
     * digits, so the composer must read the RAW TOKEN's digits, not the double's. `9007199254740993` is
     * 2^53+1: the double rounds it to …992, so a composer reading the number would read a figure the
     * text does not contain. Both engines read the token's own digits.
     */
    [Fact]
    public void AboveTwoToTheFiftyThreeTheDigitsAreReadFromTheRawToken()
    {
        Assert.Equal(
            "b'elejeb' majb'al majb'al wuqub' jun b'elejeb' b'elejeb' keb' job' kajib' wuqub' kajib' majb'al b'elejeb' b'elejeb' oxib'",
            Numbers.NumberToWords(9007199254740993d, "9007199254740993"));
        Assert.Equal(
            "ɓeleˈxeɓ maxˈɓal maxˈɓal ʋuˈqʰuɓ ˈxun ɓeleˈxeɓ ɓeleˈxeɓ ˈkʰeɓ ˈxoɓ kʰaˈxiɓ ʋuˈqʰuɓ kʰaˈxiɓ maxˈɓal ɓeleˈxeɓ ɓeleˈxeɓ oˈʃiɓ",
            Text("9007199254740993"));
    }

    /** End-to-end: the numeral is phonemized, not passed through as digits. */
    [Theory]
    [InlineData("21", "xuʋiˈnaqʰ ˈxun")]   // juwinaq jun
    [InlineData("100", "xoˈkʼal")]         // jok'al
    public void NumbersEndToEndThroughTheScan(string input, string expected) =>
        Assert.Equal(expected, Text(input));

    [Fact]
    public void RegistryWiring() => Assert.Equal("kʼiˈt͡ʃʰeʔ", Phonemizer.Phonemize("k'iche'", "quc").Trim());
}
