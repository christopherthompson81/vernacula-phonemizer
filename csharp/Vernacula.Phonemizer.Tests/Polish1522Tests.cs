/**
 * #1522: Polish defects found by the Rust port. Ported from test/polish-1522.test.ts; the expectations were derived
 * by running the fixed TypeScript engine, never typed.
 */
using PolishEngine = Vernacula.Phonemizer.Languages.Polish.PolishPhonemizer;
using PolishNormalize = Vernacula.Phonemizer.Languages.Polish.Normalize;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class Polish1522Tests
{
    private static string N(string s) => PolishNormalize.NormalizePolish(s);

    [Fact]
    public void ClockNeedsALeftBoundary()
    {
        Assert.Equal("Wynik 123:45 i 21:01:05.", N("Wynik 123:45 i 21:01:05."));
        Assert.Equal("Spotkanie o dwunastej 30 i siódma 05.", N("Spotkanie o 12:30 i 7:05.")); // still reads
    }

    [Theory]
    [InlineData("Lata 90. były dobre.")]
    [InlineData("W Latach 20. było cicho.")]
    [InlineData("Latach 30. i")]
    public void CapitalisedDecadeHeadInflectsLikeTheLowercaseOne(string t)
    {
        var i = t.IndexOf('L');
        var lower = t[..i] + "l" + t[(i + 1)..];
        Assert.NotEqual(lower, N(lower)); // the lowercase head is read
        var nl = N(lower);
        var j = nl.IndexOf('l');
        Assert.Equal(nl[..j] + "L" + nl[(j + 1)..], N(t));
    }

    [Fact]
    public void DecadeValuesAndTheSentencePeriod()
    {
        Assert.Equal("Lata dziewięćdziesiąte były dobre.", N("Lata 90. były dobre."));
        Assert.Equal("Lata 90. Potem", N("Lata 90. Potem"));
    }

    [Theory]
    [InlineData("trąf", "trˈɔw̃f")]
    [InlineData("jąwszy", "jˈɔw̃fʂɨ")]
    [InlineData("kąpać", "kˈɔmpat͡ɕ")] // a labial STOP keeps [m]
    [InlineData("wąchać", "vˈɔŋxat͡ɕ")]
    public void NasalBeforeAFricative(string word, string ipa) =>
        Assert.Equal(ipa, PolishEngine.PhonemizeWord(word));

    [Fact]
    public void FractionBeforeAStopIsRead()
    {
        Assert.Equal("To jedna piąta i jedna druga.", N("To 1/5 i 1/2."));
        Assert.Equal("Pół to jedna druga, a ćwierć jedna czwarta.", N("Pół to 1/2, a ćwierć 1/4."));
        Assert.Equal("3/1/2 i 1/2,5 oraz 1,5/2", N("3/1/2 i 1/2,5 oraz 1,5/2"));
    }
}
