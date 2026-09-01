/**
 * The portable half of test/turkmen.test.ts — Standard Turkmen (tk), Türkmençe, Oghuz Turkic, Latin.
 * THE HALLMARK: the INTERDENTAL fricatives ⟨s⟩→[θ] and ⟨z⟩→[ð] (shared with Bashkir — söz→θøð). 9 vowels
 * with ⟨a⟩→[ɑ] (back), ⟨ä⟩→[æ], ⟨ö⟩→[ø], ⟨ü⟩→[y], ⟨y⟩→[ɯ]; ⟨ý⟩→j (the glide, vs the vowel ⟨y⟩), ⟨h⟩→x.
 * Word-final (oxytone) stress; unwritten phonemic length not emitted. Referees: wikipron + kaikki.
 *
 * ⚠ ROMAN NUMERALS ARE TESTED THROUGH `Phonemize`, NOT a constructed engine: Core/Roman.cs runs in the
 * Registry WRAPPING `Text()`, so a test on `CreateTurkmen()` never exercises the policy at all (trap 16).
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Turkmen;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class TurkmenTests
{
    private static string Word(string s) => TurkmenPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "tk");
    private static string Norm(string s) => Normalize.NormalizeTurkmen(s);

    [Theory]
    // the INTERDENTAL hallmark ⟨s⟩→θ, ⟨z⟩→ð.
    [InlineData("söz", "ˈθøð")] // 'word' — ⟨s⟩→θ, ⟨ö⟩→ø, ⟨z⟩→ð
    [InlineData("göz", "ˈɡøð")] // 'eye' — ⟨z⟩→ð
    [InlineData("suw", "ˈθuw")] // 'water' — ⟨s⟩→θ, ⟨w⟩→w
    [InlineData("ýazmak", "jɑðˈmɑk")] // 'to write' — ⟨z⟩→ð, ⟨a⟩→ɑ (back)
    public void TheInterdentalHallmark(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // the 9-vowel system + ⟨y⟩[ɯ] vs ⟨ý⟩[j].
    [InlineData("gyz", "ˈɡɯð")] // 'girl' — ⟨y⟩→ɯ (the vowel)
    [InlineData("ýyl", "ˈjɯl")] // 'year' — ⟨ý⟩→j (the glide) then ⟨y⟩→ɯ
    [InlineData("dünýä", "dynˈjæ")] // 'world' — ⟨ü⟩→y, ⟨ý⟩→j, ⟨ä⟩→æ
    [InlineData("köşk", "ˈkøʃk")] // 'palace' — ⟨ö⟩→ø, ⟨ş⟩→ʃ
    public void TheNineVowelSystem(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // special consonants ⟨ç ž ň h⟩ + word-final stress.
    [InlineData("çaga", "t͡ʃɑˈɡɑ")] // 'child' — ⟨ç⟩→t͡ʃ, final stress
    [InlineData("jaň", "ˈd͡ʒɑŋ")] // 'bell' — ⟨j⟩→d͡ʒ, ⟨ň⟩→ŋ
    [InlineData("žurnal", "ʒuɾˈnɑl")] // 'journal' — ⟨ž⟩→ʒ
    [InlineData("äheň", "æˈxeŋ")] // 'melody' — ⟨ä⟩→æ, ⟨h⟩→x, ⟨ň⟩→ŋ
    public void SpecialConsonants(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // final stress with maximal-onset syllabification (loanword clusters).
    [InlineData("türkmen", "tyɾkˈmen")] // ˈ before ⟨m⟩ — ⟨k⟩ is the coda of tü'rk, not part of the onset
    [InlineData("plan", "ˈplɑn")] // loan — ˈ before the whole ⟨pl⟩ onset
    [InlineData("sport", "ˈθpoɾt")] // loan — ⟨sp⟩→[θp] (s→θ), stress before the whole onset
    public void MaximalOnsetStress(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // NUMBERS — Turkic decimal: one lexeme per round ten, juxtaposed with no connector. Data +
    // provenance: turkmen.jsonc `numbers` (enedilim.com "Sanlar" + Wiktionary Appendix:Turkmen numerals).
    [InlineData("7", "jeˈdi")] // ýedi — a bare unit
    [InlineData("11", "ˈon ˈbiɾ")] // on bir — teens are TWO words in Turkmen (unlike Tatar's fused unbér)
    [InlineData("25", "jiɡɾiˈmi ˈbæʃ")] // ýigrimi bäş — the 21-99 compound, no connector
    [InlineData("100", "ˈjyð")] // ýüz — the multiplier \"bir\" is DROPPED before ýüz
    [InlineData("555", "ˈbæʃ ˈjyð elˈli ˈbæʃ")] // bäş ýüz elli bäş
    [InlineData("1984", "ˈbiɾ ˈmyŋ doˈkuð ˈjyð θeɡˈθen ˈdøɾt")] // …but \"bir\" IS kept before müň
    [InlineData("12345", "ˈon iˈki ˈmyŋ ˈyt͡ʃ ˈjyð ˈkɯɾk ˈbæʃ")] // on iki müň üç ýüz kyrk bäş
    [InlineData("1000000", "ˈbiɾ milliˈon")] // bir million
    public void CardinalNumbers(string n, string want) => Assert.Equal(want, Say(n));

    [Fact]
    // THE SPANISH TILDE FOR THE CARON — 157 words against 1,892, and nothing splits. Both letters are
    // Latin, so unlike Chuvash's twin defect the word does NOT break; the grapheme scan simply has no
    // rule for ⟨ñ⟩ and drops to a plain [n], deleting the velar nasal.
    public void TheTildeFold()
    {
        Assert.Equal(Say("öň"), Say("öñ"));
        Assert.Equal(Say("onuň"), Say("onuñ"));
        Assert.Equal(Say("biziň"), Say("biziñ"));
        Assert.Equal(Say("Koreýa"), Say("Koreÿa"));
        Assert.Equal("ˈøŋ", Say("öñ")); // was ˈøn
        // ⚠ THE GUARD IS "EVERY OTHER LETTER IS ONE TURKMEN USES", and its reach is exactly that far. A
        // foreign word carrying a letter the alphabet lacks is safe — ⟨c⟩ is not a Turkmen letter:
        Assert.Equal("München", Normalize.FoldTurkmenTildes("München"));
        Assert.Equal("Cañón", Normalize.FoldTurkmenTildes("Cañón"));
        // …and one spelled only with Turkmen letters is NOT. That is the honest cost of the fold, stated
        // rather than papered over: measured over this corpus it is zero (all 161 affected words are
        // Turkmen), and the alternative is deleting a phoneme from 8% of the genitives.
        Assert.Equal("seňor", Normalize.FoldTurkmenTildes("señor"));
    }

    [Theory]
    // the ORDINAL — the writer chooses the backness, the rule supplies the LINKING VOWEL.
    [InlineData(1, true, "birinji")]
    [InlineData(4, true, "dördünji")] // ⚠ the one stem that voices its final stop
    [InlineData(6, false, "altynjy")] // vowel-final: no linking vowel
    [InlineData(10, false, "onunjy")] // ⚠ monosyllable → labial harmony reaches the suffix
    [InlineData(30, false, "otuzynjy")] // ⚠ disyllable → it does NOT: never *otuzunjy*
    [InlineData(100, true, "ýüzünji")] // ⚠ ⟨ý⟩ is the GLIDE, not a vowel — counting it made `ýüz` look
    [InlineData(3, true, "üçünji")] //    disyllabic and gave *ýüzinji*
    public void TheOrdinalLinkingVowel(int n, bool front, string want) =>
        Assert.Equal(want, Normalize.OrdinalOf(n, front));

    [Fact]
    // …and in running text, where the suffix was reaching the g2p as the bare word [nd͡ʒɯ].
    public void TheOrdinalInRunningText()
    {
        Assert.Equal("jiɡɾiˈmi døɾdyˈnd͡ʒi ˈɡyn", Say("24-nji gün"));
        Assert.Equal("biɾiˈnd͡ʒi jɑɾɯˈmɯ", Say("1-nji ýarymy"));
    }

    [Fact]
    // DEGREES are both thermal and angular, and the corpus GLOSSES its own sign by writing the word
    // beside it — so the bare-sign rule must not double it.
    public void Degrees()
    {
        Assert.Equal("plˈjuθ ˈon ˈbiɾ ɡɾɑˈduθ", Say("+11° gradus"));
        Assert.Equal("plˈjuθ ˈon ɡɾɑduˈθdɑn", Say("+10° dan")); // the ablative glued to the sign
        // ⚠ `Selsi`, not `Selsiý` — the corpus's own "0 K (Kelwin)= -273,15°C (gradus Selsi)".
        Assert.Equal("elˈli ɡɾɑˈduθ θelθiˈe jeˈtjæɾ", Say("50 ° C-e ýetýär"));
        Assert.Equal("oˈtuð doˈkuð ɡɾɑˈduθ oˈtuð ˈbiɾ miˈnut ˈnol θeˈkunt n", Say("39°31′0″N"));
    }

    [Fact]
    // the FRACTION is bounded, because this corpus writes it BOTH ways round. Turkmen reads it
    // denominator-locative first: "dörtden üç".
    public void TheBoundedFraction()
    {
        Assert.Equal("døɾtˈden ˈyt͡ʃ bøleɡiˈne", Say("3/4 bölegine"));
        Assert.Equal("dokuˈðdɑn ˈbiɾ", Say("1/9"));
        // ⚠ `10/1 bölegini` is ONE TENTH in this corpus — the Turkic order — and nothing but the
        // numerator > denominator test separates it from an ordinary fraction. Refused, not guessed.
        Assert.Equal("10, 1 bölegini", Norm("10/1 bölegini"));
        Assert.Equal("2015, 16 ýyly", Norm("2015/16 ýyly")); // …and the year spans too
    }

    [Fact]
    // the ERA MARKER in the five spellings the corpus uses, tilde and all.
    public void TheEraMarker()
    {
        Assert.Equal("biziň eramyzdan öň üç ýüz otuzynjy", Norm("b.e. öñ 330-njy"));
        Assert.Equal("biziň eramyzdan öň VI asyrda", Norm("B.e.ö. VI asyrda"));
        Assert.Equal("biziň eramyzdan öňki III asyryň", Norm("B.e. öňki III asyryň"));
        Assert.Equal("500, 494 ýyl", Norm("500-494ý."));
    }

    [Fact]
    // ROMAN CENTURIES — and the backness the writer never typed. `OrdinalOf` takes it from the WRITTEN
    // suffix; a Roman numeral has none, so the policy derives it from the numeral's own last vowel.
    public void RomanCenturies()
    {
        Assert.Equal("jiɡɾimiˈnd͡ʒi ɑˈθɯɾ", Say("XX asyr"));
        Assert.Equal("ɑltɯˈnd͡ʒɯ ɑθɯɾˈdɑ", Say("VI asyrda"));
    }

    [Fact]
    // the symbol tier, the percent suffix, and the range's pause.
    public void TheSymbolTierAndRanges()
    {
        // ⚠ The tier reads `60%` but cannot see the `-ini` hanging off it, so Normalize.cs claims both.
        Assert.Equal("ɑltˈmɯʃ ɡøteɾimiˈni", Say("60%-ini"));
        Assert.Equal("oˈtuð , ˈyt͡ʃ milliˈon inedøɾˈdyl kiloˈmetɾ", Say("30,3 mln km²"));
        Assert.Equal("ˈjyð ɑltˈmɯʃ ˈyt͡ʃ milliˈmetɾ ɯˈɡɑl", Say("163 mm ygal"));
        Assert.Equal("belˈɡi ˈbæʃ", Say("№ 5"));
        // ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58).
        Assert.Equal("ˈbiɾ ˈmyŋ ɑlˈtɯ ˈjyð ɑlˈtɯ , ˈbiɾ ˈmyŋ ɑlˈtɯ ˈjyð ɑltˈmɯʃ doˈkuð .",
            Say("1606-1669."));
    }

    [Theory]
    // INITIALISMS — the caps runs that reached the g2p as consonant clusters.
    [InlineData("ABŞ", "ˈɑ ˈbe ˈʃe")] // the USA
    [InlineData("BMG", "ˈbe ˈem ˈɡe")] // the UN
    public void Initialisms(string run, string want) => Assert.Equal(want, Say(run));
}
