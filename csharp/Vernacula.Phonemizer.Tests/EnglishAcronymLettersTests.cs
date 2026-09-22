/**
 * Acronyms read letter-by-letter although their lowercase form is a word (#1422).
 * Ported from test/english-acronym-letters.test.ts.
 *
 * ⚠ THE DICTIONARY CANNOT EXPRESS THIS CLASS. CMUdict is keyed lowercase, so `tso` is General Tso and
 * `ado` is the word — and `isRecorded` then hands the ALL-CAPS token to the dictionary and it reads as
 * that word. The list is consulted BEFORE `isRecorded` and only for all-caps runs.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishAcronymLettersTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "en");

    /// <summary>
    /// What the pass EMITS when it spells a token out — the letters with `letterNameExceptions` applied.
    /// ⚠ Phonemizing the BARE letters is contaminated by #1423: ⟨A⟩ reads as the indefinite article.
    /// </summary>
    private static string Letters(string w) => Say(string.Join(" ", w.ToLowerInvariant()
        .Select(c => c == 'a' ? "ay" : c == 'i' ? "eye" : c.ToString())));

    /// <summary>⚠ The reported case, and the pair the dictionary cannot hold.</summary>
    [Fact]
    public void TsoIsLettersAndTsoTheDishIsNot()
    {
        Assert.Equal("tʰˈiː ˈɛs ˈoᶷ", Say("TSO"));
        Assert.Contains("tʰˈiː ˈɛs ˈoᶷ", Say("The TSO issued a notice."));
        Assert.Contains("tsˈoᶷz", Say("General Tso's chicken"));
    }

    /// <summary>
    /// ⚠ Every row has two signals: espeak-ng's curated `$abbrev` list names it, AND the engine's own
    /// reading was an invented word. Asserted against the spelled form, so the expectation is derived.
    /// </summary>
    [Theory]
    [InlineData("EXE")]
    [InlineData("IOS")]
    [InlineData("IPA")]
    [InlineData("OS")]
    [InlineData("LA")]
    [InlineData("EST")]
    [InlineData("GI")]
    [InlineData("AE")]
    [InlineData("UUID")]
    [InlineData("NYSE")]
    [InlineData("SAE")]
    [InlineData("XY")]
    [InlineData("ADO")]
    [InlineData("EG")]
    [InlineData("DIY")]
    [InlineData("IMO")]
    [InlineData("OTOH")]
    [InlineData("ISP")]
    [InlineData("IRC")]
    [InlineData("UEFI")]
    public void ItSpellsOut(string w) => Assert.Equal(Letters(w), Say(w));

    /// <summary>
    /// ⚠ THE LIST IS CASE-GATED, AND THAT IS THE POINT — only an all-caps run reaches the pass, which
    /// is what makes adding `ado`, `la`, `os`, `est` and `gi` safe. espeak marks those same rows
    /// `$allcaps`, the same gate reached independently.
    /// </summary>
    [Theory]
    [InlineData("ado", "ədˈuː")]
    [InlineData("la", "lˈɑː")]
    [InlineData("os", "ˈɑːs")]
    [InlineData("est", "ˈɛst")]
    [InlineData("gi", "ɡˈɪ")]
    public void TheLowercaseWordSurvives(string w, string ipa) => Assert.Equal(ipa, Say(w));

    [Fact]
    public void InRunningProseTheWordsSurvive()
    {
        Assert.Contains("ədˈuː", Say("much ado about nothing"));
        Assert.Contains("lˈɑː", Say("he lives in la"));
    }

    /// <summary>
    /// ⚠ Four espeak rows are deliberately absent: `AAA` is "triple-A"; `ESPN` and `LAPD` are FUSED
    /// letter readings the initialism module explicitly prefers; `dr` has its own rule in normalize.ts.
    /// </summary>
    [Theory]
    [InlineData("AAA", "tɹˌɪpəlˈeᶦ")]
    [InlineData("ESPN", "ˌiːʲˌɛspˌiːʲˈɛn")]
    [InlineData("LAPD", "ˌɛlˌeᶦpʰˌiːdˈiː")]
    [InlineData("DR", "dɹˈaᶦv")]
    public void TheExclusionsKeepTheirExistingReading(string w, string ipa) => Assert.Equal(ipa, Say(w));

    /// <summary>
    /// ⚠ A SHOUTING DOCUMENT STILL WINS, and the ordering is deliberate: the pass returns early when
    /// the text has no lowercase at all, BEFORE this list is consulted, because capitals carry no
    /// signal there. Pinned so it reads as the documented trade and not as a gap.
    /// </summary>
    [Fact]
    public void AnAllCapsDocumentIsStillExempt()
    {
        Assert.Contains("tsˈoᶷ", Say("TSO NOTICE BOARD LIST"));
        Assert.Contains("tʰˈiː ˈɛs ˈoᶷ", Say("The TSO notice board"));
    }
}
