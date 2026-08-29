// The bare-° rule's SKIP CLASS is [CFKКСФ] — six letters, three of them Cyrillic.
//
// ⚠ THE 200-ROW GOLDEN HAS NO °К, so the gate cannot see this class at all. The port dropped Cyrillic К
// (U+041A) and case-insensitivity does not rescue it: Latin K folds to U+212A, never to U+041A. Pinned
// here because only a differential found it.
using AbNormalize = Vernacula.Phonemizer.Languages.Abkhaz.Normalize;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class AbkhazDegreeTests
{
    [Theory]
    // A STANDALONE scale letter after ° suppresses the bare rule — Kelvin and Fahrenheit have no
    // sourceable word, so the raw ° is left for the leak gate rather than glued into *градусК.
    [InlineData("135 °К", "135 °К")]
    [InlineData("5° К", "5° К")]
    [InlineData("135 °F", "135 °F")]
    [InlineData("0°Ф", "0°Ф")]
    // …but a WORD starting with one of them is not standalone, so the bare rule still fires.
    [InlineData("60° Кырҭтәыла",
                "60 градус Кырҭтәыла")]
    // ⟨С⟩ may be Cyrillic — the Celsius arm holds both letters, and both take the unit NAME.
    [InlineData("23 °С", "23 Цельси иградус")]
    [InlineData("135 °C", "135 Цельси иградус")]
    public void TheSkipClassHoldsBothScripts(string input, string want) =>
        Assert.Equal(want, AbNormalize.NormalizeAbkhaz(input));

    [Theory]
    // `symbols.scales` names a KEY in `numbers`; each abbreviation must reach its OWN word.
    [InlineData("3 млн доллар",
                "3 миллион доллар")]
    [InlineData("7 млрд. Аҟәа",
                "7 миллиард. Аҟәа")]
    public void EachScaleAbbreviationReachesItsOwnWord(string input, string want) =>
        Assert.Equal(want, AbNormalize.NormalizeAbkhaz(input));
}
