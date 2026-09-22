/**
 * A hyphenated `re-` is the prefix, not the note of the scale (#1430).
 * Ported from test/english-re-prefix.test.ts.
 *
 * ⚠ THE SAME COLLISION AS THE `Re:` RULE, reached through a hyphen instead of a colon and reported the
 * same way — *"re-machined -> ray-machined"*. The hyphen makes `re` a token of its own and CMUdict
 * records the bare word as `R EY1`.
 */
using Vernacula.Phonemizer.Languages.English;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishRePrefixTests
{
    private static string Norm(string s) => Normalize.NormalizeEnglish(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "en");

    [Theory]
    [InlineData("re-machined")]
    [InlineData("re-measured")]
    [InlineData("re-entry")]
    [InlineData("re-work")]
    [InlineData("re-test")]
    [InlineData("re-examine")]
    public void AHyphenatedRePrefixReadsRee(string w)
    {
        Assert.StartsWith("ɹˈiː ", Say(w));
        Assert.DoesNotContain("ɹˈeᶦ", Say(w));
    }

    [Fact]
    public void InAFrame() => Assert.Equal("a ree-machined part", Norm("a re-machined part"));

    /// <summary>
    /// ⚠ THE GUARD THAT MATTERS: in `do-re-mi` the `re` IS the note, and it sits between two hyphens,
    /// so the lookbehind refuses a preceding hyphen as well as a preceding letter.
    /// </summary>
    [Fact]
    public void TheNoteOfTheScaleIsUntouched()
    {
        Assert.Equal("do-re-mi", Norm("do-re-mi"));
        Assert.Equal("Do-Re-Mi", Norm("Do-Re-Mi"));
        Assert.Equal("sol-re-mi", Norm("sol-re-mi"));
        Assert.Contains("ɹˈeᶦ", Say("do-re-mi"));
        Assert.Equal("re", Norm("re"));
        Assert.Equal("regarding subject", Norm("Re: subject"));   // the colon rule still owns this
    }

    /// <summary>
    /// ⚠ A POSITIONAL HYPHEN GUARD LEFT THE REPORTED DEFECT STANDING HERE. Refusing any preceding
    /// hyphen kept `do-re-mi` but also suppressed the fix wherever `re-` legitimately follows one.
    /// </summary>
    [Theory]
    [InlineData("non-re-entrant")]
    [InlineData("pre-re-heat")]
    public void AReAfterAnotherHyphenIsStillThePrefix(string w)
    {
        Assert.Contains("\u0279\u02c8i\u02d0", Say(w));
        Assert.DoesNotContain("\u0279\u02c8e\u1da6", Say(w));
    }

    /// <summary>
    /// ⚠ THE PRECEDING SEGMENT, NOT THE FOLLOWING ONE: `re-do` is an ordinary prefixed word whose
    /// SECOND element is a solfège syllable, so a following-segment test would read it as the note.
    /// </summary>
    [Theory]
    [InlineData("re-do")]
    [InlineData("re-mix")]
    public void ThePrefixNotTheNote(string w) => Assert.Contains("\u0279\u02c8i\u02d0", Say(w));

    /// <summary>
    /// ⚠ THE ACCEPTED COST, pinned so it is a decision and not a surprise: a solfège sequence that
    /// OPENS on the note is not protected. Far rarer than the prefix, and not separable by shape.
    /// </summary>
    [Fact]
    public void ASolfegeSequenceThatOpensOnReIsNotProtected()
        => Assert.Equal("ree-mi-fa-sol", Norm("re-mi-fa-sol"));

    /// <summary>⚠ A letter before it is someone else's `re`.</summary>
    [Theory]
    [InlineData("pre-machined")]
    [InlineData("core-machined")]
    [InlineData("genre-bending")]
    [InlineData("spare-part")]
    public void ALetterBeforeItIsSomeoneElsesRe(string w) => Assert.Equal(w, Norm(w));

    /// <summary>⚠ It needs a letter after the hyphen.</summary>
    [Theory]
    [InlineData("re-")]
    [InlineData("re-2")]
    public void ItNeedsALetterAfterTheHyphen(string w) => Assert.Equal(w, Norm(w));

    /// <summary>
    /// ⚠ THE CASE IS ECHOED, AND THAT IS NOT COSMETIC. The initialism pass decides whether a document is
    /// SHOUTING by looking for any lowercase letter, so a lowercase `ree` injected into an all-caps
    /// document flips that test and changes how every OTHER run in it is read. Measured before the echo
    /// went in: `RE-WORK ORDER NHS` turned ˌɛnˌeᶦt͡ʃˈɛs — the fused, one-stress reading the initialism
    /// module explicitly prefers — into three separate letter tokens.
    /// </summary>
    [Fact]
    public void AnAllCapsDocumentStaysAsShoutyAsItWas()
    {
        Assert.Equal("REE-MACHINED", Norm("RE-MACHINED"));
        Assert.Equal("Ree-machined", Norm("Re-machined"));
        Assert.Contains("ˌɛnˌeᶦt͡ʃˈɛs", Say("RE-MACHINED NHS PARTS"));
        Assert.Contains("ˌɛnˌeᶦt͡ʃˈɛs", Say("RE-WORK ORDER NHS"));
        Assert.Contains("dˌʌbəɫjuːdˈiː", Say("RE-TESTED WD 40 SAMPLES"));
    }

    /// <summary>
    /// ⚠ The unhyphenated forms were already right, which is what says this is one lexical collision
    /// rather than a gap in how prefixes are read.
    /// </summary>
    [Fact]
    public void TheJoinedSpellingsAreUnchanged()
    {
        Assert.Equal("ɹˌiːɹˈʌn", Say("rerun"));
        Assert.Equal("remeasured", Norm("remeasured"));
    }
}
