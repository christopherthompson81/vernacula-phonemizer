/**
 * #1593: the xh/st/tn/sn defects the Rust port of the southern Bantu group found. Ported from
 * test/sbantu-defects-1593.test.ts. All inputs are synthetic and every assertion is relational, so no IPA is typed.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class SBantuDefects1593Tests
{
    private static string P(string text, string lang) => Phonemizer.Phonemize(text, lang);

    [Fact]
    public void XhPlusMinusIsRead()
    {
        Assert.Equal(P("Ubushushu bu- plas o mayinas 5 apha", "xh"), P("Ubushushu bu-±5 apha", "xh"));
        Assert.NotEqual(P("5", "xh"), P("±5", "xh"));
    }

    [Theory]
    [InlineData("Tsela ya R59 le N12 e kgolo")]
    [InlineData("ka R59.")]
    public void StARoadNumberIsNotMoney(string text) =>
        Assert.DoesNotContain(P("diranta", "st"), P(text, "st"), StringComparison.Ordinal);

    [Theory]
    [InlineData("ka R30,000,000")]
    [InlineData("ka R8 million")]
    [InlineData("ka R332 milione")]
    [InlineData("ka R2.3m")]
    [InlineData("ka R3,2 milione")]
    public void StARandAmountIsStillMoney(string text) =>
        Assert.Contains(P("diranta", "st"), P(text, "st"), StringComparison.Ordinal);

    [Fact]
    public void StABareBnReadsAsItsWord()
    {
        Assert.Equal(P("Ho ne ho le dibilione tse 1.5", "st"), P("Ho ne ho le 1.5bn", "st"));
        Assert.Equal(P("ka dimithara tse 915", "st"), P("ka 915 m", "st"));
    }

    [Fact]
    public void TnABareBnReadsAsItsWord() =>
        Assert.Equal(P("Go ne go le 1.5 dibilione", "tn"), P("Go ne go le 1.5bn", "tn"));

    [Fact]
    public void SnABnReadsAsItsWord()
    {
        Assert.Equal(P("Ne 1.5 bhiriyoni zvakare", "sn"), P("Ne 1.5bn zvakare", "sn"));
        Assert.Equal(P("Ne $1.5 bhiriyoni zvakare", "sn"), P("Ne $1.5bn zvakare", "sn"));
    }
}
