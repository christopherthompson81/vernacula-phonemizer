/**
 * Two Japanese defects the Rust port found by reading (#1463), fixed TS-first.
 * Ported from test/japanese-rust-port-findings.test.ts.
 *
 * 1. っ geminated whatever followed unless a first-character test called it a vowel. So it copied a bare
 *    vowel letter before う/え/お (ɯᵝ, e̞, o̞ are two units), and it geminated ー, ん and a second っ. The rule
 *    is positive now: っ geminates only a consonant+vowel mora, and otherwise it is the glottal stop.
 * 2. `pH` was applied with `string.Replace`, which poisons provenance, so every token of its row lost
 *    `InputSpan`. It also matched inside a longer Latin word.
 *
 * Every IPA expectation is built from the engine's own phones (MANIFEST, KanaToMorae, GLOTTAL), never typed.
 */
using Vernacula.Phonemizer.Languages.Japanese;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class JapaneseRustPortFindingsTests
{
    private static List<string> Morae(string w) => Kana.KanaToMorae(w)!;

    private static List<string> Concat(params IEnumerable<string>[] parts) => parts.SelectMany(p => p).ToList();

    [Theory]
    [InlineData("あ")]
    [InlineData("い")]
    [InlineData("う")]
    [InlineData("え")]
    [InlineData("お")]
    public void SokuonBeforeAVowelIsAGlottalStop(string v)
    {
        Assert.Equal(Concat(Morae("あ"), [Kana.GLOTTAL], Morae(v)), Morae("あっ" + v));
        Assert.Equal(Morae("あっ" + v), Morae("アッ" + v));
    }

    [Theory]
    [InlineData("ー")]
    [InlineData("ん")]
    [InlineData("っか")]
    public void SokuonBeforeAnOnsetlessMoraIsAGlottalStopOnBothPaths(string rest)
    {
        // What follows the glottal stop: the length mark (read off あー), moraic ん, and a second っ's geminate.
        var tail = rest == "ー" ? Morae("あー").Skip(1) : Morae(rest);
        var want = Concat(Morae("あ"), [Kana.GLOTTAL], tail);
        Assert.Equal(want, Morae("あっ" + rest));
        Assert.Equal(want, Kana.SegmentsToMorae(["あっ" + rest]));
    }

    [Fact]
    public void SegmentFinalSokuonAgreesWithTheOneWordReading()
    {
        Assert.Equal(Morae("あっっか"), Kana.SegmentsToMorae(["あっ", "っか"]));
        Assert.Equal(Morae("あっお"), Kana.SegmentsToMorae(["あっ", "お"]));
    }

    [Theory]
    [InlineData("かった", "た")]
    [InlineData("あっきゃ", "きゃ")]
    [InlineData("あっうぃ", "うぃ")]
    public void AConsonantOnsetStillGeminates(string w, string next)
    {
        var m = Morae(w);
        Assert.Equal(Morae(next)[0][..1], m[^2]);
        Assert.Equal(m, Kana.SegmentsToMorae([w[..^next.Length], next]));
    }

    [Fact]
    public void TheGlottalStopReachesPhonemize()
    {
        var v = Manifest.MANIFEST.Vowels;
        Assert.Equal(string.Concat(Morae("あっお")), Phonemizer.Phonemize("あっお", "ja"));
        Assert.Contains(v["a"] + Kana.GLOTTAL + v["o"], Phonemizer.Phonemize("あっお", "ja"));
        Assert.Contains(Kana.GLOTTAL + v["u"], Phonemizer.Phonemize("うわっうそ", "ja"));
    }

    [Fact]
    public void GeminateSokuonLeavesKanaToMoraeUnchanged()
    {
        // The kana singles and pairs of the ja-kana dump, plus っ + every pair.
        var singles = new List<string> { "ー", "ｰ", "ッ", "ゝ" };
        for (var c = 0x3041; c <= 0x3096; c++) singles.Add(char.ConvertFromUtf32(c));
        for (var c = 0x30a1; c <= 0x30fa; c++) singles.Add(char.ConvertFromUtf32(c));
        var words = new HashSet<string>(StringComparer.Ordinal);
        foreach (var a in singles)
        {
            words.Add(a);
            foreach (var b in singles) { words.Add(a + b); words.Add("っ" + a + b); }
        }
        var checkedCount = 0;
        var bad = new List<string>();
        foreach (var w in words)
        {
            var m = Kana.KanaToMorae(w);
            if (m is null) continue;
            checkedCount++;
            if (!Kana.GeminateSokuon([.. m]).SequenceEqual(m)) bad.Add(w);
        }
        Assert.True(checkedCount > 30_000, $"only {checkedCount} words checked");
        Assert.Empty(bad);
    }

    private static IEnumerable<KeyValuePair<string, string>> MixedCaseKeys =>
        Normalize.WORD_ACRONYM.Where(kv => kv.Key.Any(char.IsAsciiLetterLower));

    [Fact]
    public void EachMixedCaseKeyIsReadAsItsAcronymIncludingAdjacentRepeats()
    {
        Assert.NotEmpty(MixedCaseKeys);
        foreach (var (k, v) in MixedCaseKeys)
        {
            Assert.Equal(v + "の値", Normalize.NormalizeJapanese(k + "の値"));
            Assert.Equal(v + v + "の値", Normalize.NormalizeJapanese(k + k + "の値"));
            Assert.Equal(v + " " + v, Normalize.NormalizeJapanese(k + " " + k));
        }
    }

    [Theory]
    [InlineData("pHの値")]
    [InlineData("水のpHは")]
    [InlineData("pH7の水")]
    [InlineData("pHpHの値")]
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
        Assert.Equal(Phonemizer.Phonemize(Normalize.WORD_ACRONYM["pH"] + "の値", "ja"), Phonemizer.Phonemize(text, "ja"));
    }

    [Theory]
    [InlineData("DepHi")]
    [InlineData("ApH")]
    [InlineData("pHD")]
    [InlineData("pHé")]
    [InlineData("pHp")]
    public void PhDoesNotMatchInsideALongerLatinWord(string w) =>
        Assert.Equal(w + "は", Normalize.NormalizeJapanese(w + "は"));
}
