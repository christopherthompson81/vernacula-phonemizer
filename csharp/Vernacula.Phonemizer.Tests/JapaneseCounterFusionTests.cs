/**
 * The number+counter fusion, and the compound guard that suppresses it.
 *
 * ⚠ NO GOLDEN COVERS THIS. The fix these pin changed 0 of the 200 ja golden rows — the guard fires 10
 * times there and all ten are genuine kanji+kanji compounds — so the parity gate is blind to the branch
 * in both directions: it would not have caught the bug, and it does not protect the fix. Hence a
 * behavioural test on both engines (the TypeScript half lives in test/japanese.test.ts).
 *
 * The rule: `headsCompound` suppresses the euphonic counter reading only when the counter kanji heads a
 * KANJI+KANJI compound (3時間 must stay さんじかん, not さんじ + 間). 126 reading keys begin with a counter
 * and continue in kana — verb conjugations (分かつ, 回す, 着く, 足す, 泊まる) and a few noun phrases
 * (本の, 日の丸, 人たち). None of those readings can follow a DIGIT, so the counter must win there.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class JapaneseCounterFusionTests
{
    [Theory]
    // a kana-continued reading entry is NOT a compound → the counter fuses
    [InlineData("1本のペン", "ippo̞nno̞pe̞ɴ")]      // いっぽんのペン, not いち + ほんの
    [InlineData("3回した", "säŋkäiꜜɕitä")]          // さんかい — 回す the verb cannot follow a digit
    [InlineData("2人たち", "ɸɯᵝtäɾität͡ɕi")]        // ふたり, not に + 人たち
    // a genuine kanji+kanji compound still suppresses the fusion
    [InlineData("3時間", "säɴ d͡ʑikäɴ")]
    [InlineData("3年生", "säɴ ne̞nse̞ː")]
    // and the ordinary euphony is untouched
    [InlineData("1本", "iꜜppo̞ɴ")]
    [InlineData("3本", "säꜜmbo̞ɴ")]
    [InlineData("10本", "d͡ʑɯᵝppo̞ɴ")]
    [InlineData("1冊読む", "issät͡sɯᵝ jo̞ꜜmɯᵝ")]
    public void CounterFusionMatchesTypeScript(string text, string expected) =>
        Assert.Equal(expected, Phonemizer.Phonemize(text, "ja"));
}
