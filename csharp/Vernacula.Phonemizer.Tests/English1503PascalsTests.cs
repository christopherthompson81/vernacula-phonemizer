/**
 * #1503: an SI pressure unit after a number reads as its word, case-exactly. Ported from
 * test/english-1503-pascals.test.ts. Expectations are relational; no IPA is typed.
 */
using Xunit;
using EnglishNormalize = Vernacula.Phonemizer.Languages.English.Normalize;

namespace Vernacula.Phonemizer.Tests;

public class English1503PascalsTests
{
    public static IEnumerable<object[]> Reads()
    {
        var pairs = new[]
        {
            ("at 2 GPa", "at 2 gigapascals"), ("at 1 GPa", "at 1 gigapascal"), ("at 101.3 kPa", "at 101.3 kilopascals"),
            ("1013 hPa", "1013 hectopascals"), ("200 MPa", "200 megapascals"), ("5 mPa", "5 millipascals"),
            ("5 Pa", "5 pascals"), ("1 Pa", "1 pascal"), ("2 million Pa", "2 million pascals"),
        };
        foreach (var lang in new[] { "en", "en-GB" })
            foreach (var (unit, word) in pairs) yield return new object[] { lang, unit, word };
    }

    [Theory]
    [MemberData(nameof(Reads))]
    public void AUnitReadsAsItsWord(string lang, string unit, string word) =>
        Assert.Equal(Phonemizer.Phonemize(word, lang), Phonemizer.Phonemize(unit, lang));

    [Theory]
    [InlineData("a 3.8 GPA")]
    [InlineData("2 PA students")]
    [InlineData("5 pa")]
    [InlineData("5 PA")]
    [InlineData("5 gpa")]
    [InlineData("GPa alone")]
    public void AFoldedNearMissIsLeftAsWritten(string kept) => Assert.Equal(kept, EnglishNormalize.NormalizeEnglish(kept));
}
