/**
 * Cherokee (chr) — ᏣᎳᎩ, Iroquoian, written in the CHEROKEE SYLLABARY (Sequoyah, 85 characters). The g2p is
 * a deterministic per-character lookup whose table is BUILT from the ordered syllable values, so the
 * syllabary's own ordering is the only index.
 *
 * ⚠ THE SYLLABARY IS A SHALLOW PHONEMIC SKELETON: obstruents are phonemically VOICELESS (Cherokee contrasts
 * aspiration, not voicing), and tone, vowel length, the glottal stop and the intrusive /h/ are never
 * written. The engine recovers the segmental melody only.
 *
 * The portable half of test/cherokee.test.ts. Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Cherokee;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class CherokeeTests
{
    private static string Word(string s) => CherokeePhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Registry.GetPhonemizer("chr").Text(s).Trim();
    private static string Full(string s) => Phonemizer.Phonemize(s, "chr").Trim();
    private static string Norm(string s) => Normalize.NormalizeCherokee(s);

    [Theory]
    [InlineData("ᏣᎳᎩ", "t͡salaki")]        // the endonym
    [InlineData("ᎠᎹ", "ama")]              // 'water'
    [InlineData("ᎠᏍᎦᏯ", "askaja")]        // 'man'
    [InlineData("ᎦᏬᏂᎯᏍᏗ", "kawonihisti")] // 'language'
    [InlineData("ᎤᏔᎾ", "utʰana")]         // the ASPIRATED split cell Ꮤ→tʰ
    [InlineData("ᎬᎾ", "kə̃na")]            // ⟨v⟩→[ə̃], the nasal mid-central vowel
    // The single-character corners of the built table.
    [InlineData("Ᏽ", "mə̃")]               // U+13F5 MV — "the non-existent sound", mapped pragmatically
    [InlineData("Ꭷ", "kʰa")]              // the aspirated split cell
    [InlineData("Ꮖ", "kʷa")]              // the labialised velar
    [InlineData("Ꮬ", "t͡ɬa")]              // the lateral affricate
    [InlineData("Ꮝ", "s")]                // bare Ꮝ = /s/, the only non-CV entry besides ⟨nah⟩
    // ⚠ THE SUPPLEMENT LOWERCASE FOLDS ON via ToUpperInvariant — an unfolded character looks up to nothing
    // and is SILENTLY DROPPED, which is why the fold was checked against JS across all 86 codepoints.
    [InlineData("ꭰꮉ", "ama")]
    public void ReadsTheSyllabary(string input, string expected) => Assert.Equal(expected, Word(input));

    [Theory]
    // ⚠ THE TENS CLIP BEFORE A UNIT (ᏔᎵᏍᎪᎯ 20 → ᏔᎵᏍᎪ ᏌᏊ 21) — the Nation's syllabary poster spells all 79
    // compounds that way, and it wins over the grammar's unclipped example because it is syllabary-native.
    [InlineData("21", "tʰalisko sakʷu")]
    [InlineData("100", "skohit͡sikʷa")]      // the hundred is the TENS word + ᏥᏆ, not the unit word
    public void ComposesTheCardinals(string input, string expected) => Assert.Equal(expected, Full(input));

    /** ⚠ AT 10⁶ THERE IS NO MODERN NUMERAL THIS FILE TRUSTS, so it falls back to digit-by-digit rather than
     *  invent one — the 1828 *Cherokee Phoenix* offers ᎠᎦᏴᎵᏯ but says it "is not universally known". */
    [Fact]
    public void AboveTheTrustedRangeItReadsDigitByDigit() =>
        Assert.Equal("ᏌᏊ ᏃᏘ ᏃᏘ ᏃᏘ ᏃᏘ ᏃᏘ ᏃᏘ", Numbers.NumberToWords(1000000));

    [Theory]
    // ⚠ THE COMMA GROUPS AND NEVER DECIMATES — the round's largest defect. `17,000` read as *seventeen
    // zero*, a silent 1000× error in well-formed Cherokee that no gate could see.
    [InlineData("ᎬᏩᏚᏫᏛ 17,000 ᏣᎳᎩ", "ᎬᏩᏚᏫᏛ 17000 ᏣᎳᎩ")]
    [InlineData("ᎾᏂᎥ ᏴᏫ 1,028,737,436.", "ᎾᏂᎥ ᏴᏫ 1028737436.")]
    [InlineData("ᎾᏂᎥ ᏴᏫ 33,625,989.", "ᎾᏂᎥ ᏴᏫ 33625989.")]
    // …but a comma that is NOT a thousands group is left alone (a date list).
    [InlineData("ᏀᎾ ᎦᎶᏂ 28, 1838, ᎠᎴ", "ᏀᎾ ᎦᎶᏂ 28, 1838, ᎠᎴ")]
    // The decimal dot is SPENT, not spoken — no decimal word is sourceable here.
    [InlineData("ᎢᎦᏘᎭ ᎢᎬᏁᎸ 29.53 ᎯᎸᏍᎩ", "ᎢᎦᏘᎭ ᎢᎬᏁᎸ 29 53 ᎯᎸᏍᎩ")]
    // …and a sentence-final dot after a year is NOT a decimal.
    [InlineData("ᎢᎬᏁᎸ 1907. ᎯᎠ", "ᎢᎬᏁᎸ 1907. ᎯᎠ")]
    // The span dash becomes a pause, between digits and between words.
    [InlineData("ᏃᏱ ᎠᎾᏅᏯ 20–25%,", "ᏃᏱ ᎠᎾᏅᏯ 20, 25%,")]
    [InlineData("ᎢᎾᎨ ᎡᎯ ᏒᎩ — ᎠᎹ", "ᎢᎾᎨ ᎡᎯ ᏒᎩ, ᎠᎹ")]
    // A unit and a colon are left exactly as they were — no vocabulary is sourceable for either.
    [InlineData("ᏂᎬᎢ 243,610 km².", "ᏂᎬᎢ 243610 km².")]
    [InlineData("ᏄᏍᏛ ᏗᎧᏃᏗ: ᎢᏅ ᎢᎦᏘ", "ᏄᏍᏛ ᏗᎧᏃᏗ: ᎢᏅ ᎢᎦᏘ")]
    // ⚠ EVERY MATH SIGN IS REFUSED — the corpus has 5 sign instances and no word for any of them.
    [InlineData("x = y · 5 < 6 · 6 × 6 · ±5 · +5", "x = y · 5 < 6 · 6 × 6 · ±5 · +5")]
    public void TheNormalizerSpendsSeparatorsAndRefusesTheRest(string input, string expected) =>
        Assert.Equal(expected, Norm(input));

    [Theory]
    [InlineData("ᎬᏩᏚᏫᏛ 17,000 ᏣᎳᎩ", "kə̃watuwitə̃ kalikʷatu ijakajə̃li t͡salaki")]
    [InlineData("ᎢᎾᎨ ᎡᎯ ᏒᎩ — ᎠᎹ", "inake ehi sə̃ki , ama")]
    [InlineData("ᏧᏴᏢ ᎠᎹᏰᎵ-Ꭿ", "t͡sujə̃t͡ɬə̃ amajeli hi")]
    [InlineData("ᏄᏍᏛ ᏗᎧᏃᏗ: ᎢᏅ ᎢᎦᏘ", "nustə̃ tikʰanoti , inə̃ ikatʰi")]
    public void TheWholePipeline(string input, string expected) => Assert.Equal(expected, Full(input));
}
