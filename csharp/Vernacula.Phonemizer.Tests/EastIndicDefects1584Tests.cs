// #1584: bn and as defects found by the Rust port of the eastindic group. All inputs are synthetic. Mirrors
// test/eastindic-defects-1584.test.ts.
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Core;
using Xunit;
using AsNormalize = Vernacula.Phonemizer.Languages.Assamese.Normalize;

namespace Vernacula.Phonemizer.Tests;

public class EastIndicDefects1584Tests
{
    private static bool HaveEnModel()
    {
        try { return File.Exists(DataPath.ResolveAllowMissing("languages/english/en-g2p-tagger.int8.onnx")); }
        catch { return false; }
    }

    /// bn's best path built its engine with `GetPhonemizer("en").Text`, which skips the foreign-OOV memo.
    [Theory]
    [InlineData("Quexington")]
    [InlineData("Zorblatt")]
    public async Task BnBestReadsAnEmbeddedOovEnglishWordAsEnBestDoes(string word)
    {
        if (!HaveEnModel()) return;   // no optional model here: nothing to assert
        var en = await Phonemizer.PhonemizeAsync(word, "en");
        var bn = (await Phonemizer.PhonemizeAsync($"আমি {word} যাব", "bn")).Split(' ');
        Assert.Equal(en, bn[1]);
    }

    private static string Fold(string s) =>
        string.Concat(s.Select(c => Unicode.BENGALI_DIGITS.TryGetValue(c.ToString(), out var d) ? d : c.ToString()));

    /// The `<`, `>` and `×` rules keyed on ASCII `\d`; the header says every rule accepts both digit scripts.
    [Theory]
    [InlineData("৩ < ৫", "3 < 5")]
    [InlineData("৯ > ২", "9 > 2")]
    [InlineData("৪ × ৬", "4 × 6")]
    [InlineData("৪×6", "4×6")]
    public void AsSignRulesReadBengaliDigitsAsTheyReadAsciiOnes(string bengali, string ascii)
    {
        var got = AsNormalize.NormalizeAssamese(bengali);
        Assert.NotEqual(bengali, got);
        Assert.Equal(AsNormalize.NormalizeAssamese(ascii), Fold(got));
    }
}
