/**
 * A CREOLE NATIVISER MUST NOT INHERIT GENERAL-AMERICAN NOTATION.
 * Ported from test/english-syllabic.test.ts.
 *
 * ⚠ THIS EXISTS BECAUSE THE PORT DIVERGED AND EVERY GATE STAYED GREEN. #1319 added the reduced slot
 * (syllabic consonants and the extra-short schwa) to the English lexicon, and added the strip at the
 * creole boundary to the TS side ONLY. C# Naija then read `innocent` as *inasn̩t* where TS read
 * *inasant* — 56 rows across pcm.
 *
 * The C# suite passed throughout. Nothing in it replays the goldens fleet-wide; the runner that does
 * (csharp/tools/parity) is a standalone program and is not part of `dotnet test`, so the divergence
 * survived a merge and was only found by running that program by hand. This test is the cheap part of
 * that gap closed — a marker word through the creole path, in the suite.
 */
using System.Linq;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class CreoleCitationTests
{
    /// <summary>
    /// Naija nativises English-etymological words through the English dict, and `Nativise` already
    /// strips aspiration and the voicing diacritic because those are facts about General American
    /// rather than Nigerian Pidgin. The reduced-slot marks are the same kind of fact.
    /// </summary>
    [Theory]
    [InlineData("innocent")]   // the word the parity runner caught: EY→ inasant, not inasn̩t
    [InlineData("people")]     // syllabic l in the parent (pˈiːpɫ̩)
    [InlineData("analyze")]    // extra-short schwa in the parent (ˈænə̆lˌaᶦz)
    [InlineData("normal")]
    public void NoGenAmReducedSlotMarkReachesNaija(string word)
    {
        var got = Phonemizer.Phonemize(word, "pcm");
        Assert.DoesNotContain("̩", got);   // syllabic diacritic
        Assert.DoesNotContain("̆", got);   // extra-short breve
    }

    /// <summary>And the parent still HAS the marks — otherwise the test above passes vacuously.</summary>
    [Theory]
    [InlineData("people", "̩")]
    [InlineData("analyze", "̆")]
    public void TheParentStillCarriesThem(string word, string mark)
    {
        var got = Phonemizer.Phonemize(word, "en");
        Assert.True(got.Contains(mark), $"{word} -> {got} (codepoints: {string.Join(",", got.Select(c => ((int)c).ToString("X4")))})");
    }
}
