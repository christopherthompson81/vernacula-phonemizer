/**
 * Hindi's ordinal rule declines above 2^53, as its number path does, and a family member with no ordinal
 * data falls back to Hindi's (#1463, found by the Rust port).
 * Ported from test/hindi-ordinal-safe-integer.test.ts. Expectations are relational, never typed IPA.
 */
using Vernacula.Phonemizer.Languages.Hindi;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class HindiOrdinalSafeIntegerTests
{
    private static readonly HindiDef DEF = Languages.Hindi.Hindi.DEF;

    [Fact]
    public void UnsafeOrdinalIsLeftForTheNumberPath()
    {
        var norm = Normalize.MakeHindiNormalizer(DEF.Numbers, DEF);
        Assert.Equal("9007199254740993वाँ", norm("9007199254740993वाँ"));
        Assert.Equal("9007199254740992 वीं", norm("9007199254740992 वीं"));
        Assert.DoesNotMatch(@"\d", norm("9007199254740991वाँ"));
    }

    public static IEnumerable<object[]> Family() =>
        new[] { "hi", "bgc", "awa", "bho", "hne", "mag", "mai", "rkt" }.Select(l => new object[] { l });

    [Theory]
    [MemberData(nameof(Family))]
    public void AboveTwoToThe53ReadsItsOwnDigits(string lang)
    {
        var above = Phonemizer.Phonemize("9007199254740993वाँ", lang);
        Assert.NotEqual(Phonemizer.Phonemize("9007199254740992वाँ", lang), above);
        Assert.Equal($"{Phonemizer.Phonemize("9007199254740993", lang)} {Phonemizer.Phonemize("वाँ", lang)}", above);
        Assert.DoesNotMatch(@"\d", above);
    }

    [Theory]
    [MemberData(nameof(Family))]
    public void FourHundredDigitOrdinalDoesNotThrow(string lang)
    {
        var digits = new string('1', 400);
        var outp = Phonemizer.Phonemize($"{digits}वाँ", lang);
        Assert.Equal($"{Phonemizer.Phonemize(digits, lang)} {Phonemizer.Phonemize("वाँ", lang)}", outp);
        Assert.DoesNotMatch(@"\d", outp);
    }

    [Fact]
    public void NoOrdinalDataFallsBackToHindis()
    {
        var bare = Normalize.MakeHindiNormalizer(DEF.Numbers, new HindiDef());
        var hindi = Normalize.MakeHindiNormalizer(DEF.Numbers, DEF);
        foreach (var s in new[] { "16वीं", "1ला", "4था", "25 वें" })
        {
            Assert.Equal(hindi(s), bare(s));
            Assert.DoesNotMatch(@"\d", bare(s));
        }
    }

    [Fact]
    public void OnlyADeclaredEmptyTableTurnsTheRuleOff()
    {
        var off = Normalize.MakeHindiNormalizer(DEF.Numbers, new HindiDef { OrdinalSuffixes = new HindiOrdinalSuffixes() });
        Assert.Equal("16वीं", off("16वीं"));
    }
}
