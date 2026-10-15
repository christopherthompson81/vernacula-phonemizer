/**
 * #1550: an unstressed prefix shifts the stress onto a reduced stem ⟨e⟩. Ported from
 * test/dutch-1550-prefix-stem-e.test.ts. Relational: built from words the engine already reads right.
 */
using Xunit;
using DutchEngine = Vernacula.Phonemizer.Languages.Dutch.DutchPhonemizer;

namespace Vernacula.Phonemizer.Tests;

public class Dutch1550Tests
{
    private static string Nl(string w) => DutchEngine.PhonemizeWord(w);
    private static string PrefixOf(string whole, string stem)
    {
        var w = Nl(whole); var s = Nl(stem);
        Assert.EndsWith(s, w, StringComparison.Ordinal);
        return w[..^s.Length];
    }

    [Theory]
    [InlineData("vertellen", "verkopen", "kopen", "tellen")]
    [InlineData("vergeten", "verkopen", "kopen", "geten")]
    [InlineData("herkennen", "herhalen", "halen", "kennen")]
    [InlineData("bestellen", "bekijken", "kijken", "stellen")]
    [InlineData("gezellig", "gekocht", "kocht", "zellig")]
    public void APrefixedStemReadsAsPrefixPlusStem(string word, string refWhole, string refStem, string stem) =>
        Assert.Equal(PrefixOf(refWhole, refStem) + Nl(stem), Nl(word));

    [Theory]
    [InlineData("geven")]
    [InlineData("beter")]
    [InlineData("tegen")]
    [InlineData("verder")]
    [InlineData("tegenstander")]
    public void AnEndingRootKeepsFirstSyllableStress(string w)
    {
        var ipa = Nl(w);
        var v = ipa.IndexOfAny("aeiouyɑɛɪɔʏəøœ".ToCharArray());
        Assert.True(v >= 0 && ipa.IndexOf('ˈ') < v, ipa);
    }
}
