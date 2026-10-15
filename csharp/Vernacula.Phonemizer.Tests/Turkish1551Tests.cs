/**
 * #1551 (tr): the pre-accent rule narrowed to the suffixes its sources list. Ported from
 * test/turkish-1551-pre-accent.test.ts; each expectation is the 1-based stressed syllable the sources give.
 */
using System.Text;
using Xunit;
using TurkishEngine = Vernacula.Phonemizer.Languages.Turkish.TurkishPhonemizer;

namespace Vernacula.Phonemizer.Tests;

public class Turkish1551Tests
{
    private static int Stressed(string w)
    {
        var ipa = TurkishEngine.PhonemizeWord(w).Normalize(NormalizationForm.FormD);
        int n = 0; var inV = false;
        foreach (var ch in ipa[..ipa.IndexOf('ˈ')]) { var v = "aeiouyɯøœɛɑ".Contains(ch); if (v && !inV) n++; inV = v; }
        return n + 1;
    }

    [Theory]
    [InlineData("gelmedi", 1)] [InlineData("gelmiyor", 1)] [InlineData("gelmeden", 1)] [InlineData("olmayan", 1)] [InlineData("olmasa", 1)]
    [InlineData("olsa", 2)] [InlineData("gelse", 2)] [InlineData("hastaysa", 2)] [InlineData("gelirse", 2)] [InlineData("varsa", 1)]
    [InlineData("vardır", 1)] [InlineData("yoktur", 1)] [InlineData("güzeldir", 2)] [InlineData("nedeniyle", 3)] [InlineData("gelirken", 2)]
    [InlineData("evdeyim", 2)] [InlineData("deniz", 2)] [InlineData("dokuz", 2)] [InlineData("yıldız", 2)] [InlineData("koruma", 3)]
    [InlineData("kele", 2)] [InlineData("geldim", 2)]
    public void TheStressedSyllableIsTheSourcesOne(string word, int syl) => Assert.Equal(syl, Stressed(word));
}
