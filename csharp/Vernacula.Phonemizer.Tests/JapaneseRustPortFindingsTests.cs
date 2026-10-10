/**
 * Two Japanese defects the Rust port found by reading (#1463), fixed TS-first.
 * Ported from test/japanese-rust-port-findings.test.ts.
 *
 * 1. っ before う/え/お copied a bare vowel letter instead of the glottal stop: the vowel test looked at the
 *    first character only, and ɯᵝ, e̞, o̞ are two units each.
 * 2. `pH` was applied with `string.Replace`, which poisons provenance, so every token of its row lost
 *    `InputSpan`; it also matched inside a longer Latin word.
 */
using Vernacula.Phonemizer.Languages.Japanese;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class JapaneseRustPortFindingsTests
{
    [Theory]
    [InlineData("あ")]
    [InlineData("い")]
    [InlineData("う")]
    [InlineData("え")]
    [InlineData("お")]
    public void SokuonBeforeAVowelIsAGlottalStop(string v)
    {
        // The vowel mora as the engine reads it, never hand-typed.
        var expected = new List<string>(Kana.KanaToMorae("あ")!) { "ʔ" };
        expected.AddRange(Kana.KanaToMorae(v)!);
        Assert.Equal(expected, Kana.KanaToMorae("あっ" + v));
        Assert.Equal(Kana.KanaToMorae("あっ" + v), Kana.KanaToMorae("アッ" + v));
    }

    [Theory]
    [InlineData("あっお", "äʔo̞")]
    [InlineData("うわっうそ", "ɯᵝwäʔɯᵝso̞")]
    public void SokuonReproMatchesTypeScript(string text, string expected) =>
        Assert.Equal(expected, Phonemizer.Phonemize(text, "ja"));

    [Fact]
    public void GeminateSokuonLeavesAGlottalStopBeforeEveryVowel()
    {
        var a = Manifest.MANIFEST.Vowels["a"];
        foreach (var v in Manifest.MANIFEST.Vowels.Values)
            Assert.Equal(new List<string> { a, "ʔ", v }, Kana.GeminateSokuon(new List<string> { a, "ʔ", v }));
        Assert.Equal(Kana.KanaToMorae("あっお"), Kana.SegmentsToMorae(new[] { "あっ", "お" }));
        // A consonant onset still geminates.
        Assert.Equal(Kana.KanaToMorae("かった"), Kana.SegmentsToMorae(new[] { "か", "っ", "た" }));
        Assert.Equal("t", Kana.KanaToMorae("かった")![1]);
    }

    [Theory]
    [InlineData("pHの値")]
    [InlineData("水のpHは")]
    [InlineData("pH7の水")]
    public void PhKeepsEveryInputSpan(string text)
    {
        var tr = Phonemizer.PhonemizeTrace(text, "ja");
        Assert.NotEmpty(tr.Tokens);
        foreach (var k in tr.Tokens) Assert.NotNull(k.InputSpan);
    }

    [Fact]
    public void PhSpansCoverTheInput()
    {
        const string text = "pHの値";
        var tr = Phonemizer.PhonemizeTrace(text, "ja");
        Assert.Equal(new[] { "pHの", "値" }, tr.Tokens.Select(k => text[k.InputSpan!.Value.Start..k.InputSpan.Value.End]));
        Assert.Equal("ピーエイチの値", Normalize.NormalizeJapanese(text));
        Assert.Equal(Phonemizer.Phonemize("ピーエイチの値", "ja"), Phonemizer.Phonemize(text, "ja"));
    }

    [Theory]
    [InlineData("DepHi")]
    [InlineData("ApH")]
    [InlineData("pHD")]
    [InlineData("pHé")]
    public void PhDoesNotMatchInsideALongerLatinWord(string w) =>
        Assert.Equal(w + "は", Normalize.NormalizeJapanese(w + "は"));
}
