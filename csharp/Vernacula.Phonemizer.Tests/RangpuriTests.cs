/**
 * ⚠ THE rkt GOLDEN IS HINDI TEXT RE-RENDERED, NOT RANGPURI. csharp/goldens/rkt.tsv is derived from
 * csharp/goldens/hi.tsv by tools/gen_variant_golden.mts — Rangpuri has no FLEURS corpus, no mined artifact
 * and no attested file — so 200/200 pins C#↔TS parity on the shared Devanagari machinery and nothing about
 * whether the KRNB-specific readings are the ones the manifest claims. These tests carry that half,
 * mirroring test/rangpuri.test.ts row for row, against the Toulmin (2006) Appendix-A Rangpur referee.
 */
using Vernacula.Phonemizer.Languages.Rangpuri;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class RangpuriTests
{
    public RangpuriTests() => Languages.Bootstrap.EnsureRegistered();

    [Theory]
    // DEAFFRICATION: च → [s], ज → [d͡z].
    [InlineData("काचे", "kˈase")]
    [InlineData("गाजोर", "ɡˈad͡zoɾ")]
    // VOICED aspirates RETAINED; VOICELESS aspirates POSITIONAL (initial kept, elsewhere deaspirated).
    [InlineData("घर", "ɡʱˈɔɾ")]
    [InlineData("आधाचेर", "ˈad̪ʱaseɾ")]
    [InlineData("ठीक", "ʈʰˈik")]
    [InlineData("आठ", "ˈaʈ")]
    [InlineData("खलान", "kʰˈɔlan")]
    // Dental त/द, retroflex ट; inherent [ɔ]; final-inherent deletion.
    [InlineData("आगोत", "ˈaɡot̪")]
    [InlineData("आदा", "ˈad̪a")]
    [InlineData("आगोन", "ˈaɡon")]
    [InlineData("आम", "ˈam")]
    // Sibilants and the long/short merger (KRNB has no phonemic vowel length).
    [InlineData("आकाश", "ˈakaʃ")]
    [InlineData("बिष", "bˈiʃ")]
    [InlineData("आलु", "ˈalu")]
    public void WordReadsTheKrnbDivergence(string word, string ipa) =>
        Assert.Equal(ipa, RangpuriPhonemizer.PhonemizeWord(word));

    [Fact]
    public void ClauseAssembly() =>
        Assert.Equal("ˈam kʰˈɔlan .", Phonemizer.Phonemize("आम खलान।", "rkt").Trim());

    [Theory]
    // ⚠ INHERITED HINDI WORDS IN KRNB SOUND. rkt declares no symbolTier and no normalizer override, so
    // Hindi's shared symbol tier and Hindi's clock/unit words reach it — the shape rangpuri.ts flags as
    // "confidently wrong" and leaves flagged rather than guessed at.
    [InlineData("₹500", "pˈãs sˈɔj ɾˈupje")]
    [InlineData("50%", "pˈɔsas pɾˈɔt̪iʃɔt̪")]
    [InlineData("11:20", "ˈeɡaɾo bˈɔd͡zkɔɾ bˈis mˈinɔʈ")]
    [InlineData("5 किमी", "pˈãs kˈilomiʈɔɾ")]
    [InlineData("16वीं", "ʃˈolwĩ")]
    // Indian lakh/crore grouping over NATIVE digits — the tokenizer spans \p{Nd}, not ASCII \d.
    // ⚠ 21-99 have NO `compound` spelling in this manifest ("numbers deferred"), so the composer's
    // documented unit-then-tens fallback renders them as two words: 34 = चाइर + तिस, 56 = छय + पचास.
    [InlineData("१२३४५६७८९", "bˈaɾo kˈoʈi sˈaiɾ t̪ˈis lˈak sˈɔj pˈɔsas ɦˈad͡zaɾ sˈat̪ sˈɔj nˈɔj ˈais")]
    public void TextReadsTheInheritedHindiWords(string text, string ipa) =>
        Assert.Equal(ipa, Phonemizer.Phonemize(text, "rkt"));
}
