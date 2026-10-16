/**
 * #1595: the sw/rw/rn/nya/ln defects the Rust port of the ebantu group found. Ported from
 * test/ebantu-defects-1595.test.ts. Relational throughout, so no IPA is typed: each input must read
 * exactly as its written-out form. All inputs are synthetic.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EbantuDefects1595Tests
{
    [Theory]
    [InlineData("sw", "10-15°C", "nyuzi joto 10 hadi 15 Selsiasi")]
    [InlineData("sw", "2.5-3.5°F", "nyuzi joto 2.5 hadi 3.5 Fahrenheit")]
    [InlineData("sw", "10-15°", "nyuzi joto 10 hadi 15")]
    // Not ascending: a score-shaped pair is not a span, and falls through to the degree arm as before.
    [InlineData("sw", "15-10°C", "15-nyuzi joto 10 Selsiasi")]
    [InlineData("rw", "0.125", "0 1 2 5")]
    [InlineData("rw", "3.14159", "3 1 4 1 5 9")]
    [InlineData("rn", "0.125", "0 1 2 5")]
    [InlineData("rn", "3.14159", "3 1 4 1 5 9")]
    [InlineData("nya", "0.125", "0 1 2 5")]
    [InlineData("nya", "3.14159", "3 1 4 1 5 9")]
    [InlineData("ln", "1e5", "1 e 5")]
    [InlineData("ln", "2e6", "2 e 6")]
    [InlineData("ln", "2e", "ya 2")]
    public void ReadsAsItsWrittenOutForm(string lang, string input, string written) =>
        Assert.Equal(Phonemizer.Phonemize(written, lang), Phonemizer.Phonemize(input, lang));
}
