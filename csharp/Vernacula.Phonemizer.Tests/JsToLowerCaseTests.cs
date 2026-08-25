using Vernacula.Phonemizer.Core;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

/**
 * `Js.ToLowerCase` must be JS's `toLowerCase`, which `ToLowerInvariant` is not.
 *
 * ⚠ THE GREEK FINAL SIGMA IS THE WHOLE DIFFERENCE, and .NET has no culture that implements it — invariant,
 * el-GR and current were all checked and all return σ. JS applies the Unicode SpecialCasing `Final_Sigma`
 * condition, so `"ΠΟΙΟΣ".toLowerCase()` is `ποιος`. The Greek g2p's consonant test excludes ς BY NAME, so
 * the two engines took different branches and `ΠΟΙΟΣ` read `pios` in C# against `pços` in Node.
 *
 * ⚠ Found by an off-golden probe, not by the gate: no golden row contains an all-caps unaccented Greek word.
 * The expectations below were verified against Node over 1,785 generated sigma strings, 0 differing.
 */
public class JsToLowerCaseTests
{
    [Theory]
    // A cased letter before and nothing cased after ⇒ FINAL sigma.
    [InlineData("ΠΟΙΟΣ", "ποιος")]
    [InlineData("ΟΔΟΣ", "οδος")]
    [InlineData("ΑΣ", "ας")]
    [InlineData("ΑΣ.", "ας.")]
    [InlineData("ΑΣ ", "ας ")]
    // A cased letter follows ⇒ medial sigma.
    [InlineData("ΣΟΦΟΣ", "σοφος")]
    [InlineData("ΑΣΑ", "ασα")]
    [InlineData("ΣΣ", "σς")]
    // Nothing cased before ⇒ medial, even at the end of the string.
    [InlineData("Σ", "σ")]
    [InlineData("1Σ", "1σ")]
    // A digit is not case-ignorable, so it blocks the "cased before" search.
    [InlineData("Σ1", "σ1")]
    // Non-Greek text is untouched, and takes the fast path.
    [InlineData("ABC", "abc")]
    [InlineData("Ünïcödé", "ünïcödé")]
    public void MatchesJavaScript(string input, string expected) =>
        Assert.Equal(expected, Js.ToLowerCase(input));

    [Fact]
    public void DiffersFromToLowerInvariantExactlyOnTheFinalSigma()
    {
        Assert.Equal("ποιοσ", "ΠΟΙΟΣ".ToLowerInvariant()); // ⚠ what .NET does
        Assert.Equal("ποιος", Js.ToLowerCase("ΠΟΙΟΣ"));    // ⚠ what JS does
    }
}
