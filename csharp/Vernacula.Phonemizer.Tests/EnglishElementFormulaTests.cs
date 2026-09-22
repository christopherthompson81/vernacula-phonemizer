/**
 * Listed element-symbol formulae (#1424) — `CoCr` read as the word *cocker*.
 * Ported from test/english-element-formula.test.ts.
 *
 * ⚠ THESE PIN A LIST, NOT A PARSER. A rule that tiled any token into element symbols was built and
 * thrown away: deciding that `CoCo` is not a compound needs valency and stoichiometry, not a spelling
 * test. The cases below assert what IS claimed — the listed tokens — and that a lookalike is left alone.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishElementFormulaTests
{
    private static string Norm(string s) => Languages.English.Normalize.NormalizeEnglish(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "en");

    [Theory]
    [InlineData("CoCr", "cobalt chromium")]
    [InlineData("a CoCr alloy", "a cobalt chromium alloy")]
    [InlineData("CoCrMo", "cobalt chromium molybdenum")]
    public void AListedFormulaReadsAsItsElementNames(string text, string expected)
        => Assert.Equal(expected, Norm(text));

    /// <summary>
    /// ⚠ LONGEST-FIRST, or `CoCrMo` is claimed as `CoCr` with a stranded ⟨Mo⟩ reaching the g2p as
    /// letters — the leak class this file's unit rules document at length.
    /// </summary>
    [Fact]
    public void TheLongerTokenWins() => Assert.DoesNotContain("cobalt chromium Mo", Norm("CoCrMo"));

    /// <summary>
    /// ⚠ THE CAPITALISATION IS THE SIGNAL. An element symbol is `[A-Z]` or `[A-Z][a-z]`, and case alone
    /// separates a formula from the word it spells — which the dictionary cannot do, since `sic`, `tin`
    /// and `nan` are all recorded entries.
    /// </summary>
    [Theory]
    [InlineData("cocr")]
    [InlineData("COCR")]
    [InlineData("Cocr")]
    public void TheLookupIsCaseSensitive(string w) => Assert.Equal(w, Norm(w));

    /// <summary>
    /// ⚠ AN UNLISTED LOOKALIKE IS LEFT ALONE, which is the property the list buys over a parser. `CoCo`
    /// is a name; nothing here claims to know that, and nothing here has to.
    /// </summary>
    [Theory]
    [InlineData("CoCo")]
    [InlineData("Coco Chanel")]
    [InlineData("CoCrX")]
    [InlineData("NaCl")]
    [InlineData("SiC")]
    [InlineData("InDesign")]
    [InlineData("Nano")]
    public void AnUnlistedTokenIsUntouched(string w) => Assert.Equal(w, Norm(w));

    /// <summary>
    /// ⚠ THE HYPHENATED SPELLINGS ARE ROWS, NOT AN ACCIDENT. The boundary deliberately does not exclude
    /// ⟨-⟩, so `CoCr-based` reads correctly — but that also meant `CoCr-Mo` matched `CoCr` and stranded
    /// a bare ⟨Mo⟩. A half-expansion is the worst outcome available, because it sounds finished.
    /// </summary>
    [Theory]
    [InlineData("CoCr-Mo", "cobalt chromium molybdenum")]
    [InlineData("Co-Cr-Mo", "cobalt chromium molybdenum")]
    [InlineData("Co-Cr", "cobalt chromium")]
    [InlineData("CoCr-based", "cobalt chromium-based")]
    [InlineData("a CoCr-based alloy", "a cobalt chromium-based alloy")]
    public void AHyphenatedSpellingOfAListedAlloyDoesNotHalfExpand(string text, string expected)
        => Assert.Equal(expected, Norm(text));

    /// <summary>
    /// ⚠ AND AN UNLISTED LONGER ALLOY IS REFUSED WHOLE. `Co-Cr-Mo-W` is real and not listed; matching
    /// the listed prefix would read "cobalt chromium molybdenum-W". Declining is where a list stops
    /// honestly — it claims only what it knows.
    /// </summary>
    [Theory]
    [InlineData("Co-Cr-Mo-W")]
    [InlineData("CoCr-X")]
    public void AnUnlistedLongerAlloyIsRefusedRatherThanHalfRead(string w) => Assert.Equal(w, Norm(w));

    [Theory]
    [InlineData("XCoCr")]
    [InlineData("CoCr2")]
    public void TheTokenIsBounded(string w) => Assert.Equal(w, Norm(w));

    /// <summary>⚠ DERIVED, NOT TYPED. Hand-written IPA in a test here has been wrong every time.</summary>
    [Fact]
    public void TheReportedReadingIsGone()
    {
        Assert.Equal(Say("cobalt chromium"), Say("CoCr"));
        Assert.NotEqual(Say("cocker"), Say("CoCr"));
    }
}
