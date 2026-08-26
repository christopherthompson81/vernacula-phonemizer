// The Kazakh INSTRUMENTAL after a digit is voicing-conditioned, and no golden row reaches it: `N-пен` /
// `N-бен` / `N-мен` occurs 0 times in FLEURS kk_kz and 0 times in the mined corpus, so the parity gate
// cannot pin this. Mirrors test/kazakh.test.ts — see src/languages/kazakh/normalize.ts for the measured
// bigram counts the three-way split comes from.
using Vernacula.Phonemizer.Languages.Kazakh;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class KazakhInstrumentalTests
{
    [Theory]
    [InlineData("5-пен", "беспен")]
    [InlineData("3-пен", "үшпен")]
    [InlineData("4-пен", "төртпен")]
    [InlineData("40-пен", "қырықпен")]
    [InlineData("60-пен", "алпыспен")]
    [InlineData("9-бен", "тоғызбен")]
    [InlineData("100-бен", "жүзбен")]
    [InlineData("7-мен", "жетімен")]
    [InlineData("1-мен", "бірмен")]
    [InlineData("1000-мен", "бір мыңмен")]
    [InlineData("20-мен", "жиырмамен")]
    public void InstrumentalIsVoicingConditioned(string input, string expected) =>
        Assert.Equal(expected, Normalize.NormalizeKazakh(input));
}
