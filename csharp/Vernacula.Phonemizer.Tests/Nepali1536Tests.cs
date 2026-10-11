/**
 * #1536: the ordinal for 6 is the corpus's छैठौं, not a declined numeral plus a stray suffix syllable.
 * Mirrors test/nepali.test.ts. Expectations are relational — never typed IPA.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class Nepali1536Tests
{
    private static string Ne(string s) => Phonemizer.Phonemize(s, "ne");

    [Theory]
    [InlineData("6 औं")]
    [InlineData("6औँ")]
    [InlineData("६ औं")]
    public void SixOrdinalReadsAsTheWrittenOutWord(string digits) =>
        Assert.Equal(Ne("छैठौं"), Ne(digits));
}
