/**
 * #1477: the Urdu FRACTION rule's two guards are mirrors, as Mandarin's are. Ported from
 * test/urdu-fraction-guard.test.ts. Expectations are relational — a declined fraction reads as its two numbers,
 * a read one as itself — never typed IPA.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class UrduFractionGuardTests
{
    private static string Ur(string s) => Phonemizer.Phonemize(s, "ur");

    [Theory]
    [InlineData("1/2.5", "1 2.5")] // a decimal on the right
    [InlineData("1.5/2", "1.5 2")] // a decimal on the left
    [InlineData("1/1,000,000", "1 1,000,000")] // a thousands group on the right
    [InlineData("5,000/10,000", "5,000 10,000")] // on both sides
    [InlineData("1/2.5/3", "1 2.5 3")] // the declined decimal does not leave `5/3` to be read
    [InlineData("١/٢٫٥", "1 2.5")] // Arabic-Indic digits, ARABIC DECIMAL SEPARATOR
    [InlineData("١/١٬٠٠٠", "1 1,000")] // ARABIC THOUSANDS SEPARATOR
    [InlineData("۵،۰۰۰/۱۰،۰۰۰", "5,000 10,000")] // Extended Arabic-Indic, ، as a grouping mark
    public void ANumberBesideTheFractionDeclinesIt(string input, string parts) =>
        Assert.Equal(Ur(parts), Ur(input));

    [Theory]
    [InlineData("1/2,3/4", "1/2, 3/4")] // a list comma: both fractions read
    [InlineData("3/4,5", "3/4, 5")]
    [InlineData("3,4/5", "3, 4/5")]
    [InlineData("پانی,1/2", "پانی, 1/2")]
    [InlineData("۱/۲،۳/۴", "1/2، 3/4")]
    public void AListCommaIsNotANumber(string input, string spaced) =>
        Assert.Equal(Ur(spaced), Ur(input));

    [Fact]
    public void ASentenceFinalFractionStillReads()
    {
        Assert.Equal(Ur("یہ 1/2 ."), Ur("یہ 1/2."));
        Assert.NotEqual(Ur("1 2"), Ur("1/2"));
    }
}
