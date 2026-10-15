/**
 * #1504: an -able/-ible word reads from its DICTIONARY STEM, preferring the stem without ⟨e⟩. Ported from
 * test/english-1504-able.test.ts. Expectations come from the dictionary's own rows and from one engine path
 * against the other; no IPA is typed.
 */
using Xunit;
using Vernacula.Phonemizer.Languages.English;

namespace Vernacula.Phonemizer.Tests;

public class English1504AbleTests
{
    private static readonly string[] ABLE = { "AH0", "B", "AH0", "L" };
    private static readonly Lazy<Dictionary<string, string[]>> Dict = new(() =>
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "data", "languages", "english", "g2p-dict.tsv")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        var d = new Dictionary<string, string[]>(StringComparer.Ordinal);
        foreach (var l in File.ReadLines(Path.Combine(dir!.FullName, "data", "languages", "english", "g2p-dict.tsv")))
        {
            var i = l.IndexOf('\t');
            if (i > 0) d[l[..i]] = l[(i + 1)..].Split(' ');
        }
        return d;
    });
    private static readonly Lazy<EnglishPhonemizer> En = new(EnglishFactory.CreateEnglish);

    [Theory]
    [InlineData("castable", "cast")]
    [InlineData("pastable", "past")]
    [InlineData("tasteable", "taste")]
    [InlineData("spinnable", "spin")]
    [InlineData("surfable", "surf")]
    [InlineData("lovable", "love")]
    [InlineData("reliable", "rely")]
    public void TheStemIsTheDictionaryWord(string word, string stem)
    {
        Assert.True(Dict.Value.ContainsKey(stem));
        var d = En.Value.G2pForTests.Decompose(word);
        Assert.Equal("M", d.Source);
        Assert.Equal(Dict.Value[stem].Concat(ABLE), d.Phones);
    }

    [Theory]
    [InlineData("castable", "en")]
    [InlineData("pastable", "en")]
    [InlineData("tasteable", "en")]
    [InlineData("castable", "en-GB")]
    [InlineData("pastable", "en-GB")]
    [InlineData("tasteable", "en-GB")]
    public async Task TheBestPathAgreesWithTheSyncPath(string word, string lang) =>
        Assert.Equal(Phonemizer.Phonemize(word, lang), await Phonemizer.PhonemizeAsync(word, lang));
}
