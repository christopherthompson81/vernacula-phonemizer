/*
 * The portable half of test/trace.test.ts — `PhonemizeTrace` (#1150 stage 1).
 *
 * ⚠ THE CONTRACT IS THAT IT IS A SECOND VIEW, NEVER A SECOND READING: `Ipa` must equal `Phonemize`. The
 * parity gate is 136 languages × 26,827 rows across two engines, and a second output shape that could drift
 * from the first would be a fork wearing a feature's clothes.
 */
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class TraceTests
{
    [Theory]
    [InlineData("Łódź ne 1244", "lg")]
    [InlineData("el gato negro", "es")]
    [InlineData("the cat sat", "en")]
    [InlineData("le chat noir", "fr")]
    [InlineData("中国 hello 世界", "cmn")]
    [InlineData("Это Windows компьютер", "ru")]
    [InlineData("Obugazi: 1 244.7 km²", "lg")]
    public void TheTraceDoesNotChangeTheReading(string text, string lang) =>
        Assert.Equal(Phonemizer.Phonemize(text, lang), Phonemizer.PhonemizeTrace(text, lang).Ipa);

    /**
     * ⚠ AN UNTRACED ENGINE MUST NOT LOOK LIKE A CLEAN ONE — an empty token list is indistinguishable from a
     * correct trace, the very defect this API exists to expose. The four engines that hand-roll their
     * tokenizer loop (english, french, mandarin, burmese) report explicitly rather than through the seam.
     */
    [Theory]
    [InlineData("the cat sat", "en", "the|cat|sat")]
    [InlineData("le chat noir", "fr", "le|chat|noir")]
    [InlineData("中国 hello 世界", "cmn", "中国|hello|世界")]
    [InlineData("မြန်မာ ABC", "my", "မြန်မာ|ABC")]
    [InlineData("Obugazi ne Łódź", "lg", "Obugazi|ne|Łódź")]
    public void EveryEngineReportsItsTokensWithUsableSpans(string text, string lang, string want)
    {
        var t = Phonemizer.PhonemizeTrace(text, lang);
        Assert.True(t.Traced, $"{lang} reported no trace at all");
        Assert.Equal(want, string.Join("|", t.Tokens.Select(k => k.Surface)));
        foreach (var k in t.Tokens) Assert.Equal(k.Surface, t.Normalized[k.Start..k.End]);
    }

    /** The input-side rewrite that leaves no mark on the output — the step behind #1131, #1139, #1140. */
    [Fact]
    public void NativisedRecordsTheFoldThatLeavesNoMark()
    {
        Assert.Equal("Lodz", Phonemizer.PhonemizeTrace("Łódź", "lg").Tokens[0].Nativised);
        Assert.Equal("gato", Phonemizer.PhonemizeTrace("ɡato", "es").Tokens[0].Nativised); // #1132's U+0261
        Assert.Null(Phonemizer.PhonemizeTrace("gato", "es").Tokens[0].Nativised); // untouched → absent
    }

    /** One source token, many readings — the number path, in both a seam engine and a hand-rolled one. */
    [Theory]
    [InlineData("1244", "lg")]
    [InlineData("I have 1244 cats.", "en")]
    public void OneTokenCanEmitManyReadings(string text, string lang)
    {
        var n = Phonemizer.PhonemizeTrace(text, lang).Tokens.First(k => k.Surface == "1244");
        Assert.True(n.Emitted.Count > 3, $"expected a numeral to expand, got {n.Emitted.Count}");
    }

    /**
     * ⚠ A post-assembly pass means `Emitted` is NOT a substring of `Ipa`, so the discrepancy must carry its
     * cause. Spanish spirantizes across word boundaries after the clause string is assembled.
     */
    [Fact]
    public void APostAssemblyRewriteIsAnEvent()
    {
        var t = Phonemizer.PhonemizeTrace("el gato negro", "es");
        Assert.Equal(new[] { "ɡˈato" }, t.Tokens.First(k => k.Surface == "gato").Emitted);
        Assert.Contains("ɣˈato", t.Ipa);
        var r = Assert.Single(t.Rewrites, x => x.Stage == "spirantize-across-words");
        Assert.Contains("ɣˈato", r.After);
    }

    /** Normalization is reported for every engine at once — including when it REORDERS. */
    [Fact]
    public void NormalizationIsAnEventEvenWhenItReorders()
    {
        var t = Phonemizer.PhonemizeTrace("Obugazi: 1 244.7 km²", "lg");
        var n = Assert.Single(t.Rewrites, x => x.Stage == "normalize");
        Assert.Equal("Obugazi: 1 244.7 km²", n.Before);
        Assert.Equal(t.Normalized, n.After);
        // the unit's reading precedes the figure it FOLLOWED — why a span cannot be mapped back (stage 2)
        Assert.True(n.After.IndexOf("kiromita", StringComparison.Ordinal) < n.After.IndexOf("1244", StringComparison.Ordinal));
    }

    [Fact]
    public void AStageThatChangedNothingEmitsNoEvent() =>
        Assert.Empty(Phonemizer.PhonemizeTrace("the cat", "en").Rewrites);

    /** The recorder is ambient, so prove a nested engine cannot steal or drop the outer engine's readings. */
    [Fact]
    public void ANestedEngineDoesNotStealTheOuterEnginesTokens()
    {
        var t = Phonemizer.PhonemizeTrace("Это Windows компьютер", "ru");
        Assert.Equal("Это|Windows|компьютер", string.Join("|", t.Tokens.Select(k => k.Surface)));
        // ⚠ the embedded run's reading BELONGS to a token — leaving it out attributed real IPA to nothing
        Assert.NotEmpty(t.Tokens.First(k => k.Surface == "Windows").Emitted);
    }

    [Fact]
    public void AThrowingCallLeavesNoStateForTheNext()
    {
        Assert.ThrowsAny<Exception>(() => Phonemizer.PhonemizeTrace("x", "definitely-not-a-language"));
        var t = Phonemizer.PhonemizeTrace("ŋŋamba", "lg");
        Assert.Single(t.Tokens);
        Assert.Equal(Phonemizer.Phonemize("ŋŋamba", "lg"), t.Ipa);
    }
}
