/**
 * Marathi's ordinal rule declines above 2^53, as the number path does (#1463). Without the guard a 309+-digit
 * ordinal crashed the test host with a stack overflow.
 * Ported from test/marathi-ordinal-safe-integer.test.ts. Expectations are relational, never typed IPA.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class MarathiOrdinalSafeIntegerTests
{
    private static string Mr(string s) => Phonemizer.Phonemize(s, "mr");

    [Theory]
    [InlineData("वा")]
    [InlineData("व्या")]
    public void AboveTwoToThe53ReadsItsOwnDigits(string suffix)
    {
        var above = Mr($"9007199254740993{suffix}");
        Assert.NotEqual(Mr($"9007199254740992{suffix}"), above);
        Assert.Equal($"{Mr("9007199254740993")} {Mr(suffix)}", above);
        Assert.DoesNotMatch(@"\d", above);
    }

    [Fact]
    public void FourHundredDigitOrdinalDoesNotThrow()
    {
        var digits = new string('1', 400);
        var outp = Mr($"{digits}वा");
        Assert.Equal($"{Mr(digits)} {Mr("वा")}", outp);
        Assert.DoesNotMatch(@"\d", outp);
    }

    [Fact]
    public void LargestSafeIntegerStillComposes() =>
        Assert.NotEqual($"{Mr("9007199254740991")} {Mr("वा")}", Mr("9007199254740991वा"));
}
