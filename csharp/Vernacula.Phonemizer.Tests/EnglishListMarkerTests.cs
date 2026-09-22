/**
 * An enumerated list lead-in, and the one letter of 26 that was read as a word (#1423).
 * Ported from test/english-list-markers.test.ts.
 *
 * ⚠ ⟨a⟩ IS THE ONLY LETTER THIS HAPPENS TO — a CLAIMING problem, not a naming one. The other 25 already
 * give their letter name; CMUdict records `a` as the reduced article AH0, and `letterNameExceptions`
 * already held the right value with nothing asking it.
 */
using Vernacula.Phonemizer.Languages.English;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishListMarkerTests
{
    private static string Norm(string s) => Normalize.NormalizeEnglish(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "en");

    /// <summary>⚠ The letter name AND a pause, both of which the report asked for.</summary>
    [Theory]
    [InlineData("(a) the first item", "ay, the first item")]
    [InlineData("(b) second", "b, second")]
    [InlineData("a) foo", "ay, foo")]
    [InlineData("(A) foo", "ay, foo")]
    [InlineData("  (c) indented", "  c, indented")]
    [InlineData("(1) one", "1, one")]
    public void AListLeadInGetsItsNameAndAPause(string text, string expected)
        => Assert.Equal(expected, Norm(text));

    [Fact]
    public void TheMarkerIsNoLongerTheArticle()
    {
        Assert.DoesNotContain("ə ðə", Say("(a) the first item"));
        Assert.Contains("ˈeᶦ", Say("(a) the first item"));
        Assert.Contains(",", Say("(a) the first item"));
    }

    /// <summary>⚠ A reference is not a lead-in: the letter name, but no pause.</summary>
    [Fact]
    public void AReferenceGetsTheNameAndNoPause()
    {
        Assert.Equal("See (ay) and (b).", Norm("See (a) and (b)."));
        Assert.Equal("P(ay) equals 1", Norm("P(A) = 1"));
    }

    /// <summary>
    /// ⚠ THE ARTICLE IS UNTOUCHED, which is the assertion that keeps this honest. The rules require a
    /// bracket or a closing `)`, which an article never has.
    /// </summary>
    [Theory]
    [InlineData("a bird sang")]
    [InlineData("and a cat")]
    [InlineData("it was a test")]
    [InlineData("a")]
    public void TheArticleIsUntouched(string w) => Assert.Equal(w, Norm(w));

    [Fact]
    public void TheArticleStillReduces() => Assert.StartsWith("ə ", Say("a bird sang"));

    /// <summary>⚠ Function notation and the optional plural are the shapes most like a marker.</summary>
    [Theory]
    [InlineData("f(x)")]
    [InlineData("form(s)")]
    [InlineData("g(y)")]
    public void FunctionNotationIsUntouched(string w) => Assert.Equal(w, Norm(w));

    /// <summary>
    /// ⚠ THE SAME GAP IN AN ALPHANUMERIC CODE, and the same one letter. The shared pass claimed a caps
    /// run BEFORE digits but not one AFTER them, so a code's last letter fell to the OOV g2p — where
    /// ⟨A⟩ alone reads as a word. `K1A 0B1` read "kay one UH zero bee one". It takes no unit with it:
    /// the unit rules run BEFORE that pass. Fleet-wide, zero golden rows move.
    /// </summary>
    [Theory]
    [InlineData("K1A", "k\u02b0\u02c8e\u1da6 w\u02c8\u028cn \u02c8e\u1da6")]
    [InlineData("1A 1", "w\u02c8\u028cn \u02c8e\u1da6 w\u02c8\u028cn")]
    public void ACodeSpellsItsTrailingLetter(string text, string ipa) => Assert.Equal(ipa, Say(text));

    [Fact]
    public void ACodeReadsEndToEndAndAUnitStillWins()
    {
        Assert.Equal(Say("ay one ay one ay one"), Say("A1A 1A1"));
        Assert.Equal("a 5 liters jug", Norm("a 5L jug"));
    }

    /// <summary>
    /// ⚠ ROMAN MARKERS ARE DELIBERATELY NOT CLAIMED, pinned so it reads as a decision: a letter series
    /// reaching `(i)` would read "one" while `(ii)` read "two", and the MIXED choice is worse than the
    /// defect. A single ⟨i⟩ IS claimed, as a one-character marker like any other.
    /// </summary>
    [Theory]
    [InlineData("(ii) two", "(ii) two")]
    [InlineData("(iv) four", "(iv) four")]
    [InlineData("(i) one", "eye, one")]
    public void RomanMarkers(string text, string expected) => Assert.Equal(expected, Norm(text));
}
