/**
 * The portable half of test/totontepecmixe.test.ts — Totontepec Mixe / ayöök (mto), Mixe-Zoquean, the
 * modern SIL practical orthography. AUTHORED from Crawford, *Totontepec Mixe Phonotagmemics* (SIL 1963):
 * the consonants + allophony are Crawford-grounded and the goldens below reproduce his own transcriptions
 * (mpahk→[mbahk]); the vowel-orthography mapping is reconstructed from his example words.
 *
 * ⚠ THIS FILE IS THIS LANGUAGE'S GOLDEN. `mto` has NO `csharp/goldens/mto.tsv` — deliberately, since its
 * ASJP list carries only three usable headwords (`tools/gen_parity_goldens.mts:142`) — so the parity,
 * provenance and ipaspans gates all report ZERO ROWS for it. These authored values and the TS↔C#
 * differential in `docs/investigations/mto/mto_port_investigation.md` are the whole gate.
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.TotontepecMixe;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class TotontepecMixeTests
{
    private static string Word(string s) => TotontepecMixePhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "mto");

    [Theory]
    // the vowel anchors (Crawford example words) — the reconstructed central/back series.
    [InlineData("kääm", "kæːm")] // 'pig' — ⟨ä⟩=/æ/ (Crawford /kæːm/); doubled = length
    [InlineData("këp", "kɨp")] // 'tree' — ⟨ë⟩=/ɨ/
    [InlineData("üts", "ʌt͡s")] // 'I' — ⟨ü⟩=/ʌ/; ⟨ts⟩=[t͡s]
    [InlineData("ök", "ʊk")] // 'dog' — ⟨ö⟩=/ʊ/
    public void TheVowelAnchors(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // consonants: the affricates, the retroflex, and the saltillo.
    [InlineData("tsaa", "t͡saː")] // 'stone'
    [InlineData("caacy", "kaːt͡ʃ")] // 'tortilla' — ⟨c⟩=[k], ⟨cy⟩=[t͡ʃ] (palatalized)
    [InlineData("tsojx", "t͡sohʃ")] // 'knife' — ⟨j⟩=[h], ⟨x⟩=[ʃ]
    [InlineData("joꞌc", "hoʔk")] // 'owl' — saltillo ⟨ꞌ⟩=[ʔ]
    public void Consonants(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // the Crawford ALLOPHONY: post-nasal voicing + intervocalic lenition + the palatal and voiceless nasals.
    [InlineData("cumantoc", "kumandok")] // 'nahualism' — POST-NASAL: ⟨nt⟩→[nd]
    [InlineData("tocu̱nágu̱c", "tokunaɣuk")] // 'toad' — intervocalic ⟨g⟩→[ɣ]; the UNDERLINE and the ACUTE stress-mark are stripped (not emitted), so the vowel is READ, not dropped
    [InlineData("mpahk", "mbahk")] // Crawford's own example: ⟨mp⟩→[mb] ('your bone')
    [InlineData("nyuhm", "ɲum̥")] // ⟨ny⟩→[ɲ]; ⟨hm⟩ → the VOICELESS nasal [m̥] (§1.121)
    public void TheCrawfordAllophony(string word, string want) => Assert.Equal(want, Word(word));

    [Fact]
    public void RegistryWiring() => Assert.Equal("kæːm", Say("kääm").Trim());

    [Fact]
    /**
     * ⚠ A LETTER THAT REACHES `LatinPhone` IS CLASSIFIED, NOT ASSUMED CONSONANTAL. The scan's miss branch
     * used to push `Vowel = false` unconditionally while the TS's own `isVowel` helper sat unused — so
     * `LatinPhone`'s genuine VOWEL returns (å→[oː], æ, and every accented vowel the strip pass leaves
     * standing: ⟨â ã ê î ï ô õ û⟩ in Latin-1 plus the macron/breve/ogonek/caron/double-grave series beyond
     * it, 62 lowercase letters in all) were invisible to the intervocalic ⟨d g⟩ lenition and the word-final
     * ⟨v⟩ terminus, both of which ask whether the NEIGHBOUR is a vowel. ⚠ ⟨ø⟩ and ⟨œ⟩ are NOT among them —
     * `IsVowel` does not know them, and the last two assertions pin that residual.
     * ⚠ AND THE SHIPPED PATH HID IT: `Text()` nativises first, so it was reachable only through the
     * exported `PhonemizeWord` — which this file and referee-eval call.
     */
    public void ALatinPhoneVowelCountsAsAVowel()
    {
        Assert.Equal("aoða", Word("aoda"));   // the control: a TABLE vowel lenites the ⟨d⟩
        Assert.Equal("aoːða", Word("aåda"));  // …and so does a miss-branch one (was *aoːda*)
        Assert.Equal("aæɣa", Word("aæga"));   // (was *aæɡa*)
        Assert.Equal("aæf", Word("aæv"));     // the word-final ⟨v⟩ terminus (was *aæv*)
        Assert.Equal("aiða", Word("aîda"));   // the circumflex series reaches it too
        Assert.Equal("aiða", Word("aïda"));   // …and the diaeresis: ⟨ä ë ö ü⟩ are TABLE keys, ⟨ï⟩ is not
        // ⚠ NO CONS VALUE IS AFFECTED — none of them begins with a vowel character.
        Assert.Equal("kumandok", Word("cumantoc"));
        Assert.Equal("ɲum̥", Word("nyuhm"));
        // ⚠ AND THE RESIDUAL IS STATED RATHER THAN WIDENED. `IsVowel` recognises this language's OWN
        // inventory (aeiouæɨʌʊ), so ⟨ø⟩ and ⟨œ⟩ are still classified consonantal and still do not lenite.
        Assert.Equal("aøda", Word("aøda"));
        Assert.Equal("aœda", Word("aœda"));
    }

    [Theory]
    // Cardinal numbers. VIGESIMAL: the real bases are the four TWENTIES and 30/50/70/90 are those plus the
    // ten-word; everything below 100 is written SOLID. Crawford is a PHONOLOGY with no numerals, so the data
    // is cited to "Of Languages and Numbers" (variety-specific to mto) over Schoenhals & Schoenhals,
    // *Vocabulario Mixe de Totontepec* (ILV, 1965). Attested range 1-999.
    [InlineData(1, "to'c")]
    [InlineData(7, "vuxtojtu̱c")]
    [InlineData(10, "majc")]
    [InlineData(11, "macto'c")]
    [InlineData(15, "macmó̱cx")]
    [InlineData(19, "mactaxtojt")]
    [InlineData(20, "ii'px")]
    [InlineData(21, "ii'pxto'c")] // attested: score + unit, solid, no linker
    [InlineData(30, "ii'pxmajc")] // 20 + 10 — no ⟨u̱c⟩ after ii'px
    [InlineData(35, "ii'pxmacmó̱cx")] // attested
    [InlineData(40, "vu̱jxtcupx")]
    [InlineData(50, "vu̱jxtcupxu̱cmajc")] // the ⟨u̱c⟩ linker appears from 40 up
    [InlineData(60, "toogupx")]
    [InlineData(62, "toogupxme̱jtsc")] // attested: no linker before a bare unit
    [InlineData(80, "majctupx")]
    [InlineData(90, "majctupxu̱cmajc")]
    [InlineData(96, "majctupxu̱cmactojt")] // attested
    [InlineData(99, "majctupxu̱cmactaxtojt")]
    [InlineData(100, "mó̱cupx")] // bare — no multiplier
    [InlineData(101, "mó̱cupx to'c")]
    [InlineData(200, "me̱jtsc mó̱cupx")]
    [InlineData(555, "mugo̱o̱xc mó̱cupx vu̱jxtcupxu̱cmacmó̱cx")]
    [InlineData(999, "taxtojtu̱c mó̱cupx majctupxu̱cmactaxtojt")] // top of the attested range
    public void CardinalNumbers(int n, string want) => Assert.Equal(want, Numbers.NumberToWords(n));

    [Fact]
    /** The TS suite's property test: no sentinel and no raw digit anywhere in the attested range. */
    public void NoGapsOrSentinelsAcrossTheAttestedRange()
    {
        for (var n = 0; n <= 999; n++)
        {
            var w = Numbers.NumberToWords(n);
            Assert.DoesNotContain("undefined", w, StringComparison.Ordinal);
            Assert.DoesNotContain("NaN", w, StringComparison.Ordinal);
            Assert.DoesNotContain(w, c => char.IsAsciiDigit(c));
        }
    }

    [Fact]
    // The source states outright that only 1-999 can be counted accurately; there is NO attested thousand,
    // so >= 1000 reads digit-by-digit. The zero word is a disclosed Spanish loan stopgap.
    public void AboveTheAttestedRangeAndTheZeroStopgap()
    {
        Assert.Equal("sero", Numbers.NumberToWords(0));
        Assert.Equal("to'c sero sero sero", Numbers.NumberToWords(1000));
    }

    [Theory]
    // end-to-end: the numeral is phonemized, not passed through as digits.
    [InlineData("21", "iːʔpʃtoʔk")] // ii'pxto'c
    [InlineData("100", "mokupʃ")] // mó̱cupx — the underline/acute are stripped by the g2p
    public void TheNumeralIsPhonemized(string n, string want) => Assert.Equal(want, Say(n));
}
