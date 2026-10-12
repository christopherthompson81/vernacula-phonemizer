/**
 * #1533: en-IN's and en-GB's accent delta must not rewrite a run another reader read. Ported from
 * test/accent-variants-spare-foreign-runs.test.ts. The expected tokens are plain `en`'s; no IPA is typed.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class AccentVariantsSpareForeignRunsTests
{
    [Theory]
    [InlineData("en-IN", "She said नमस्ते to me.", new[] { 2 }, 1)]
    [InlineData("en-IN", "He wrote Привет, мир here.", new[] { 2, 4 }, 1)]
    [InlineData("en-IN", "The word θεός appears.", new[] { 2 }, 1)]
    [InlineData("en-GB", "She said नमस्ते to me.", new[] { 2 }, -1)]
    [InlineData("en-GB", "He wrote Привет, мир here.", new[] { 2, 4 }, -1)]
    [InlineData("en-GB", "The word θεός appears.", new[] { 2 }, -1)]
    public void ForeignRunMatchesPlainEnglish(string lang, string text, int[] foreign, int english)
    {
        var baseline = Phonemizer.Phonemize(text, "en").Split(' ');
        var got = Phonemizer.Phonemize(text, lang).Split(' ');
        Assert.Equal(baseline.Length, got.Length);
        foreach (var i in foreign) Assert.Equal(baseline[i], got[i]);
        if (english >= 0) Assert.NotEqual(baseline[english], got[english]); // the delta still applies
    }
}
