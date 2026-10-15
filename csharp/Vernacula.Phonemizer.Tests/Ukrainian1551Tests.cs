/**
 * #1551 (uk): a leading-zero minute is read with *нуль* (the Kyiv Dictionary's own example), and a capital
 * initial-shaped letter before a name is an initial. Ported from test/ukrainian-1551.test.ts.
 */
using Xunit;
using UkNormalize = Vernacula.Phonemizer.Languages.Ukrainian.Normalize;

namespace Vernacula.Phonemizer.Tests;

public class Ukrainian1551Tests
{
    private static string N(string s) => UkNormalize.NormalizeUkrainian(s);

    [Fact] public void TheSourcesExample() => Assert.Equal("о восьмій нуль п'ять", N("о 8:05"));
    [Fact] public void NonZeroLedMinutesAndTheFullHourAreUnchanged()
    {
        Assert.DoesNotContain("нуль", N("о 10:10"));
        Assert.DoesNotContain("нуль", N("о 9:00"));
    }
    [Fact] public void ACapitalRBeforeASurnameIsTheInitial()
    {
        Assert.Equal(Phonemizer.Phonemize("ер Шухевич був", "uk"), Phonemizer.Phonemize("Р. Шухевич був", "uk"));
        Assert.Equal(Phonemizer.Phonemize("ер ер Шухевич", "uk"), Phonemizer.Phonemize("Р. Р. Шухевич", "uk"));
    }
    [Fact] public void TheLowercaseYearAbbreviationStillExpands()
    {
        Assert.Equal(N("у 1990 року. Потім"), N("у 1990 р. Потім"));
        Assert.Equal(N("у 1990 року потім"), N("у 1990 р. потім"));
    }
}
