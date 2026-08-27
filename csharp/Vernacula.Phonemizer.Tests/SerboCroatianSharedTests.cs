// The rules sr, hr and bs SHARE, asserted against each standard's own public entry point.
//
// ⚠ THIS FILE EXISTS BECAUSE OF THE #1074 FINDING: a fix does not propagate along a shared core unless the
// rule itself is shared. Three of Croatian's four defects that wave were a sibling's repair that never
// crossed the module boundary — the era marker's case guard, and a hyphen-suffix ordinal whose guard made it
// dead in running text — and two of them cited the Croatian corpus while leaving Croatian broken. A rule
// identical in all three standards belongs to the core, and asserting it in all three is what keeps it there.
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class SerboCroatianSharedTests
{
    [Theory]
    // ⚠ A 100× ERROR, NOT A MISPRONUNCIATION. Replacing the decimal comma leaves the fractional run as its
    // own token and a numeric parse of "001" is 1, so this read *nula zarez jedan* — "zero point one".
    // Every standard had its own copy of the one-line rule, so it was one defect in three places.
    [InlineData("sr", "0,001 grama", "nˈu˥˩la zˈarez nˈu˥˩la nˈu˥˩la jˈe˩˥dan ɡrˈama")]
    [InlineData("hr", "0,001 grama", "nˈu˥˩la zˈarez nˈu˥˩la nˈu˥˩la jˈe˩˥dan ɡrˈama")]
    [InlineData("bs", "0,001 grama", "nˈu˥˩la zˈarez nˈu˥˩la nˈu˥˩la jˈe˩˥dan ɡrˈama")]
    // …and a fractional part with no leading zero keeps its whole-number reading, which is correct.
    [InlineData("sr", "1,5 km", "jˈe˩˥dan zˈarez peː˥˩t kˈilometara")]
    [InlineData("hr", "1,5 km", "jˈe˩˥dan zˈarez peː˥˩t kˈilometara")]
    [InlineData("bs", "1,5 km", "jˈe˩˥dan zˈarez peː˥˩t kˈilometara")]
    // ⚠ THE ONE SHAPE THE CORPUS ACTUALLY WRITES — `5,0`, ×1 in sr and ×1 in hr — reads identically before
    // and after the fix. That is why this moves no golden row and is pinned rather than gated.
    [InlineData("sr", "5,0", "peː˥˩t zˈarez nˈu˥˩la")]
    [InlineData("hr", "5,0", "peː˥˩t zˈarez nˈu˥˩la")]
    [InlineData("bs", "5,0", "peː˥˩t zˈarez nˈu˥˩la")]
    public void ADecimalsLeadingZerosSurviveTheCommaInEveryStandard(string lang, string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, lang));
}
