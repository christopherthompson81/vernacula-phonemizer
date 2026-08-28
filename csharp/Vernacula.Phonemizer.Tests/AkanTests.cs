// The portable half of test/akan.test.ts — the branches the 131-row golden cannot reach.
//
// ⚠ ONE OF THE GOLDEN'S 131 ROWS IS BLOCKED, NOT WRONG: it carries an embedded Tibetan run
// (`འབྲུག་ཡུལ་`), and `bo` is unported, so the C# reads the sentence without it and the gate reports
// `PortPending: tibetan`. The corpus differential agrees exactly — 260 of 261 lines identical in BOTH sync
// and async, and the single difference is that same run.
//
// ⚠ SINGLE-SOURCE LANGUAGE: the only referee is a small kaikki human-gold set, with no wikipron and no
// epitran Akan, so nothing here is cross-checked against an independent transcription.
using AkanEngine = Vernacula.Phonemizer.Languages.Akan.AkanPhonemizer;
using AkanNormalize = Vernacula.Phonemizer.Languages.Akan.Normalize;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class AkanTests
{
    [Theory]
    // The palatal digraph series ⟨ky gy hy ny⟩.
    [InlineData("kyerɛ", "t͡ɕɪrɛ")]   // ky → t͡ɕ; ⟨e⟩ → [ɪ] via ATR harmony (−ATR word)
    [InlineData("gyina", "d͡ʑina")]
    [InlineData("ɔhyɛ", "ɔɕɛ")]
    [InlineData("nyansa", "ɲansa")]
    // The LABIALISED series — the signature Akan labial-palatalisation.
    [InlineData("twi", "t͡ɕʷi")]      // the language's own name
    [InlineData("dwom", "d͡ʑʷom")]
    [InlineData("kwan", "kʷan")]
    [InlineData("hwɛ", "ɕʷɛ")]
    [InlineData("akwaaba", "akʷaaba")]
    // Glide Formation, Labial Nasalization and coda place assimilation (Paster 2010).
    [InlineData("boa", "bwa")]        // round V before another V → w
    [InlineData("mba", "mma")]        // /b/ → [m] after a nasal
    [InlineData("nkran", "ŋkran")]    // n → ŋ before k (Accra)
    // ATR harmony resolving the unwritten [+ATR]/[−ATR] merger on ⟨e⟩/⟨o⟩.
    [InlineData("bisa", "bisa")]      // +ATR (has i); ⟨a⟩ is neutral
    [InlineData("ɔkɔtɔ", "ɔkɔtɔ")]   // −ATR (ɔ), no ambiguous mid
    [InlineData("obue", "obwe")]      // +ATR (has u) → ⟨o⟩→o, ⟨e⟩→e, plus glide formation
    public void TheRulePathReadsWhatItClaims(string word, string want) =>
        Assert.Equal(want, AkanEngine.PhonemizeWordRules(word));

    [Theory]
    // TONE (H/L) + vowel nasality — LEXICAL, from the mined lexicon, and on the SHIPPED path only.
    [InlineData("papa", "pa˩pa˥")]
    [InlineData("ɔkɔtɔ", "ɔ˩kɔ˥tɔ˩")]
    [InlineData("huu", "hu˥u˩")]
    [InlineData("mifi", "mĩ˩fi˥")]   // L H, and the first vowel is NASAL
    public void TheShippedPathOverlaysLexicalTone(string word, string want) =>
        Assert.Equal(want, AkanEngine.PhonemizeWord(word));

    [Fact]
    public void TheRulePathStaysToneFree() =>
        // ⚠ The non-circularity guarantee: the referee eval scores this path, and the tone lexicon is mined
        // from the same kaikki readings the referee comes from. A tone here would be scoring itself.
        Assert.Equal("papa", AkanEngine.PhonemizeWordRules("papa"));

    [Theory]
    [InlineData("12", "du mmienu")]
    [InlineData("100", "ɔha")]
    [InlineData("4", "nnan")]
    [InlineData("40", "adwanan")]
    [InlineData("44", "adwanan nnan")]
    [InlineData("21", "adwonu baako")]
    [InlineData("555", "ahanum adwonum nnum")]
    [InlineData("1000", "apem")]
    [InlineData("2000", "mpem mmienu")]
    // ⚠ 10⁶/10⁹ need their OWN branch. Without one the multiplier indexes past the end of the hundreds
    // table and the undefined slot stringifies straight into the output ("mpem undefined").
    [InlineData("1000000", "ɔpɪpɪm")]        // ɔpepem, with ⟨e⟩ → ɪ by −ATR harmony
    [InlineData("1000000000", "ɔpɪpɪpɪm")]   // ɔpepepem
    public void NumbersComposeThroughTheSameG2p(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "ak").Trim());

    [Theory]
    // The normalizer's arms, asserted on its own output where that is the thing under test.
    [InlineData("50%", "ɔha mu nkyekyɛmu 50")]                       // the word is PREPOSED
    [InlineData("ɔha mu nkyekyɛmu 49.6%", "ɔha mu nkyekyɛmu 49 akyiri pɔ 6")] // …and said ONCE
    [InlineData("24 km", "24 kilomita")]
    [InlineData("5 km²", "5 kilomita ahinanan")]                     // the square-measure word FOLLOWS the unit
    [InlineData("GH₵ 500", "sidi 500")]                              // the ISO prefix before the bare ₵
    [InlineData("US$ 1,000", "dɔla 1000")]                           // de-grouped, then the preposed noun
    [InlineData("2017-2022", "2017 kosi 2022")]                      // the range infix
    [InlineData("2022-2017", "2022-2017")]                           // …declined when it does not ascend
    [InlineData("3.14", "3 akyiri pɔ 14")]                           // a short tail reads as a number
    [InlineData("0.05", "0 akyiri pɔ 0 5")]                          // …a leading zero, digit-at-a-time
    [InlineData("U.S.A.", "USA.")]                                   // INTERIOR dots only
    [InlineData("21st", "21")]                                       // the English ordinal suffix
    [InlineData("A & B", "A ne B")]
    [InlineData("n'adwuma", "nadwuma")]                              // the elision apostrophe
    public void TheNormalizerRewritesWhatItClaims(string input, string want) =>
        Assert.Equal(want, AkanNormalize.NormalizeAkan(input));

    [Fact]
    public void HomoglyphsForTheAkanVowelsAreFolded() =>
        // ⟨ε⟩ is Greek epsilon and ⟨כ⟩ is Hebrew kaf — folded immediately after NFC, before any rule that
        // reads an Akan letter, or every one of them is blind to the word.
        Assert.Equal("ɛ na ɔ", AkanNormalize.NormalizeAkan("ε na כ"));

    [Fact]
    public void ABareUnitIsStillReadWhenItsNumeralIsOutOfReach() =>
        // Every arm of the unit step needs a numeral, so a caption or table header went to the phoneme sink
        // as raw ASCII — invisible to every leak gate in a Latin-script language.
        Assert.Contains("kilomita", AkanNormalize.NormalizeAkan("bare km here"), StringComparison.Ordinal);
    // The literal letter ⟨ŋ⟩ (#1139) — the g2p's deliberate rule for it was unreachable because NATIVE_CLASS
    // excluded the letter, so the nativiser folded ŋ→n first. ⟨ŋ⟩ is ×0 in the golden, so these are the
    // instrument. Asserted through Phonemize, not PhonemizeWord: the defect lived in the gap between them.
    [Theory]
    [InlineData("ŋa", "ŋa")]           // was na
    [InlineData("aŋa", "aŋa")]
    [InlineData("dwoŋ", "d͡ʑʷoŋ")]     // word-final; was d͡ʑʷon
    [InlineData("Ŋa", "ŋa")]           // the class carries both cases (flags are "u", not "iu")
    [InlineData("ŋw", "ŋw")]           // ⚠ literal: ⟨ŋ⟩ enters none of the ⟨nw ng ny⟩ digraphs
    [InlineData("ŋg", "ŋɡ")]
    [InlineData("ŋy", "ŋj")]
    [InlineData("Ŋgozi", "ŋɡozi")]     // ⚠ the typed ⟨g⟩ survives
    [InlineData("ŋp", "ŋp")]           // and never assimilates — ⟨np⟩ is mp, but explicit ŋ states its place
    [InlineData("np", "mp")]
    [InlineData("nw", "ŋʷ")]           // ⚠ the standard spellings are untouched
    [InlineData("ng", "ŋ")]
    [InlineData("ny", "ɲ")]
    public void TheLiteralVelarNasal(string word, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(word, "ak").Trim());

}
