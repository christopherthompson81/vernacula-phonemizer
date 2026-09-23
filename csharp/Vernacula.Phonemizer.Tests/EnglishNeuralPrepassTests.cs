/**
 * THE NEURAL OOV PRE-PASS MUST SEE THE NORMALIZED TEXT (#1452). Ported from test/en-neural-prepass.test.ts.
 *
 * ⚠ IT SCANNED THE CALLER'S RAW INPUT, so a word the NORMALIZER creates — `τ` → `tau`, `µin` →
 * `microinch`, `5 Ω` → `ohms`, `ξ` → `zye` — was never in it, never reached the tagger, and fell silently
 * to the weaker n-gram path. Exactly the normalizer-introduced words that are ALSO OOV, i.e. the ones
 * with no dictionary row to fall back on.
 *
 * ⚠ THE PORT HAD NO TEST FOR THIS AT ALL and `check:goldens` cannot cover it — 0 stale there means no
 * golden text contains a normalizer-introduced OOV word, not that the fix is exercised.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.English;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishNeuralPrepassTests
{
    private static string Norm(string s) => Normalize.NormalizeEnglish(s);

    /// ⚠ THE PREMISE FIRST. If these stop normalizing alike the assertion below becomes vacuous — it would
    /// be comparing two different texts and finding them equal by luck.
    [Theory]
    [InlineData("the τ value", "the tau value")]
    [InlineData("a 5 µin finish", "a 5 microinches finish")]
    [InlineData("set 5 Ω now", "set 5 ohms now")]
    [InlineData("the ξ value", "the zye value")]
    public void PairsThatNormalizeAlikeMustReadAlike(string a, string b)
    {
        Assert.Equal(Norm(a), Norm(b));
        Assert.Equal(Phonemizer.Phonemize(a, "en"), Phonemizer.Phonemize(b, "en"));
    }

    /// ⚠ AN ALPHANUMERIC TOKEN MUST STILL REACH THE TAGGER. A blanket "not adjacent to a digit" guard
    /// excluded pinyin with a tone number, unit abbreviations and identifiers — six golden rows across five
    /// languages regressed. The SYNC port has no tagger, so this asserts the shape survives the scan rather
    /// than the tagger's own reading; the TS twin pins that.
    [Theory]
    [InlineData("zhong1")]
    [InlineData("600Mbit")]
    [InlineData("35px")]
    [InlineData("zhi3")]
    public void AnAlphanumericTokenIsNotExcluded(string w) =>
        Assert.NotEqual("", Phonemizer.Phonemize(w, "en"));

    /// The ordinal fragment of a date is not a word: `2026-09-23` normalizes to `… september 23rd`, where a
    /// bare letter run matches the `rd`. The resolver never asks for it.
    [Fact]
    public void TheOrdinalFragmentOfADateIsNotAWord() =>
        Assert.Contains("23rd", Norm("on 2026-09-23"));
}
