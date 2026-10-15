/**
 * #1551 (nl): a dotted number after a section word is not a clock. Ported from
 * test/dutch-1551-section-numbers.test.ts. Relational; no IPA is typed.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class Dutch1551SectionTests
{
    private static string Nl(string s) => Phonemizer.Phonemize(s, "nl");

    [Theory]
    [InlineData("Zie hoofdstuk 3.12 hier", "Zie hoofdstuk 3 . 12 hier")]
    [InlineData("In Hoofdstuk 2.10 staat het", "In Hoofdstuk 2 . 10 staat het")]
    [InlineData("Volgens art. 4.15 mag dat", "Volgens art. 4 . 15 mag dat")]
    [InlineData("versie 3.12 is uit", "versie 3 . 12 is uit")]
    public void ASectionNumberIsNotAClock(string section, string plain) => Assert.Equal(Nl(plain), Nl(section));

    [Fact]
    public void ARealClockStillReadsAsOne()
    {
        Assert.Equal(Nl("Het begint om 12:30 uur"), Nl("Het begint om 12.30 uur"));
        Assert.Equal(Nl("rond 07:19 uur"), Nl("rond 07.19 uur"));
    }
}
