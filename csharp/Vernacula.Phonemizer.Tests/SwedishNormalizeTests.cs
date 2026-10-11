/**
 * The #1526 half of test/swedish.test.ts — the Swedish normalization shapes the goldens do not carry (osv/dvs as
 * a word prefix, a clock at a sentence end, `NNNN-tal` from 2000 up), so golden parity cannot see them.
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer.Languages.Swedish;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class SwedishNormalizeTests
{
    [Theory]
    [InlineData("Han var osviklig och osvensk.", "Han var osviklig och osvensk.")] // no expansion inside a word
    [InlineData("dvsbilen", "dvsbilen")]
    [InlineData("Det är, dvs, bra.", "Det är, det vill säga, bra.")]              // undotted, still read
    [InlineData("båtar osv. Sedan", "båtar och så vidare. Sedan")]                // terminal dot kept
    [InlineData("Mötet börjar kl. 20.30.", "Mötet börjar klockan 20 30.")]        // not a decimal
    [InlineData("Mellan 9.00 och 17.30.", "Mellan 9 0 0 och 17 30.")]
    [InlineData("datum 12.05.2020 här", "datum 12.05.2020 här")]                  // a date stays declined
    [InlineData("Vi ses klockan 12:00.", "Vi ses klockan 12 0 0.")]               // not the score rule
    [InlineData("Under 2000-talet.", "Under tvåtusentalet.")]
    [InlineData("2010-talet", "tvåtusentiotalet")]
    [InlineData("2100-talet", "tjugoetthundratalet")]
    [InlineData("1900-2000-talet", "nittonhundra till tvåtusentalet")]
    [InlineData("10000-talet", "10000-talet")]
    public void Issue1526Shapes(string input, string want) => Assert.Equal(want, Normalize.NormalizeSwedish(input));

    [Theory]
    [InlineData(1945, "nittonhundrafyrtiofem")]
    [InlineData(1000, "tusen")]
    [InlineData(2000, "tvåtusen")]
    [InlineData(2050, "tvåtusenfemtio")]
    [InlineData(2099, "tvåtusennittionio")]
    [InlineData(2100, "tjugoetthundra")]
    [InlineData(3000, "tretusen")]
    [InlineData(9999, "nittioniohundranittionio")]
    [InlineData(10000, null)]
    [InlineData(2000.5, null)]
    [InlineData(99, null)]
    public void CenturyYear(double n, string? want) => Assert.Equal(want, Normalize.CenturyYear(n));
}
