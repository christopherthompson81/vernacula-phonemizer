/**
 * Korean defects the Rust port found by reading (#1511), fixed TS-first.
 * Ported from test/korean-port-findings.test.ts.
 */
using G2p = Vernacula.Phonemizer.Languages.Korean.G2p;
using KoreanNumbers = Vernacula.Phonemizer.Languages.Korean.KoreanNumbers;
using Normalize = Vernacula.Phonemizer.Languages.Korean.Normalize;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class KoreanPortFindingsTests
{
    [Fact]
    public void FahrenheitTakesTheCelsiusGuard()
    {
        Assert.Equal("화씨 칠십도에서", Normalize.NormalizeKorean("70°F에서"));
        Assert.Equal("화씨 마이너스 오도에", Normalize.NormalizeKorean("-5°F에"));
        Assert.Equal("화씨 칠십도 정도", Normalize.NormalizeKorean("70°F 정도"));
    }

    [Fact]
    public void DecimalIntegerPartPast2To53FallsBackToItsDigits()
    {
        Assert.Equal($"{KoreanNumbers.SpellDigits("99999999999999999999")}점오", Normalize.NormalizeKorean("99999999999999999999.5"));
        Assert.Equal($"{KoreanNumbers.SpellDigits("12345678901234567890")}점이오배", Normalize.NormalizeKorean("12345678901234567890.25배"));
        Assert.Equal("삼점오", Normalize.NormalizeKorean("3.5"));
    }

    [Fact]
    public void GluedCounterStaysWithTheRightOperand()
    {
        Assert.Equal("값은 삼원과 같다", Normalize.NormalizeKorean("값=3원"));
        Assert.Equal("엑스는 세개와 같다", Normalize.NormalizeKorean("x=3개"));
        Assert.Equal("에이는 다섯명보다 작다", Normalize.NormalizeKorean("a<5명"));
        Assert.Equal("삼원은 값과 같다", Normalize.NormalizeKorean("3원=값"));
        Assert.Equal("엑스는 삼과 같다", Normalize.NormalizeKorean("x = 3"));
    }

    [Fact]
    public void LoneLatinLetterIsNotTakenOutOfAWord()
    {
        Assert.Equal("xy = z", Normalize.NormalizeKorean("xy = z"));
        Assert.Equal("ab < c", Normalize.NormalizeKorean("ab < c"));
        Assert.Equal("x = zebra", Normalize.NormalizeKorean("x = zebra"));
        Assert.Equal("엑스는 와이와 같다", Normalize.NormalizeKorean("x = y"));
    }

    [Fact]
    public void TensificationReachesAKeyCarryingParticles()
    {
        var bare = G2p.PhonemizeWord("가능성");
        Assert.Contains("s͈", bare, StringComparison.Ordinal);
        foreach (var w in new[] { "가능성이", "가능성은", "가능성에서는" })
            Assert.StartsWith(bare, G2p.PhonemizeWord(w), StringComparison.Ordinal);
    }

    [Fact]
    public void NotAfterAOneSyllableKeyNorBeforeANonParticle()
    {
        Assert.Contains("͈", G2p.PhonemizeWord("신"), StringComparison.Ordinal);
        Assert.DoesNotContain("͈", G2p.PhonemizeWord("신을"), StringComparison.Ordinal);
        Assert.Contains("͈", G2p.PhonemizeWord("가운"), StringComparison.Ordinal);
        Assert.DoesNotContain("͈", G2p.PhonemizeWord("가운데"), StringComparison.Ordinal);
    }
}
