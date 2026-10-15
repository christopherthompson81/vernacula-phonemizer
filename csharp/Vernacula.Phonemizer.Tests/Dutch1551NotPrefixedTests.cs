/**
 * #1551 (nl): a word that only looks prefixed keeps first-syllable stress; a real prefix still shifts. Ported from
 * test/dutch-1551-not-prefixed.test.ts. Structural, never typed IPA.
 */
using Xunit;
using DutchEngine = Vernacula.Phonemizer.Languages.Dutch.DutchPhonemizer;

namespace Vernacula.Phonemizer.Tests;

public class Dutch1551NotPrefixedTests
{
    private static bool FirstStressedFull(string w)
    {
        var ipa = DutchEngine.PhonemizeWord(w);
        var v = ipa.IndexOfAny("aeiouyɑɛɪɔʏəøœ".ToCharArray());
        return v >= 0 && ipa.IndexOf('ˈ') < v && ipa[v] != 'ə';
    }

    [Theory]
    [InlineData("tennis")] [InlineData("hertog")] [InlineData("hersenen")] [InlineData("generaal")]
    [InlineData("verreweg")] [InlineData("tempo")] [InlineData("technisch")] [InlineData("hersenletsel")]
    public void APrefixSpellingThatIsNotAPrefixKeepsFirstStress(string w) => Assert.True(FirstStressedFull(w), DutchEngine.PhonemizeWord(w));

    [Theory]
    [InlineData("vertellen")] [InlineData("bestellen")] [InlineData("gezellig")] [InlineData("verkopen")] [InlineData("geloven")]
    public void ARealPrefixStillShifts(string w) => Assert.False(FirstStressedFull(w), DutchEngine.PhonemizeWord(w));
}
