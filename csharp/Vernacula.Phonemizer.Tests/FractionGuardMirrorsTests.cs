/**
 * The fraction rule's two guards are mirrors in hi gu mr ne ta lb, as in ur (#1477) and cmn (#1492); in ta and
 * lb the fraction also runs before the decimals. Ported from test/fraction-guard-mirrors.test.ts. Expectations
 * are relational — a declined fraction reads as its two numbers, a read one as itself — never typed IPA.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class FractionGuardMirrorsTests
{
    private static readonly Dictionary<string, int> NATIVE = new() { ["hi"] = 0x966, ["mr"] = 0x966, ["ne"] = 0x966, ["gu"] = 0xae6, ["ta"] = 0xbe6 };

    private static string Say(string lang, string s) => Phonemizer.Phonemize(s, lang);

    private static string Native(string lang, string s) =>
        string.Concat(s.Select(c => c is >= '0' and <= '9' ? char.ConvertFromUtf32(NATIVE[lang] + (c - '0')) : c.ToString()));

    public static readonly string[] INDIC = { "hi", "gu", "mr", "ne", "ta" };

    private static readonly (string Input, string Parts)[] DECLINED =
    {
        ("1/2.5", "1 2.5"), ("1.5/2", "1.5 2"), ("1/2.5/3", "1 2.5 3"),
        ("1/1,000,000", "1 1,000,000"), ("1/1,00,000", "1 1,00,000"), ("5,000/10,000", "5,000 10,000"),
    };

    private static readonly (string Input, string Spaced)[] READ =
    {
        ("1/2,3/4", "1/2, 3/4"), ("3,4/5", "3, 4/5"), ("1/2.", "1/2 ."),
    };

    public static IEnumerable<object[]> IndicDeclined() =>
        from l in INDIC from c in DECLINED select new object[] { l, c.Input, c.Parts };

    public static IEnumerable<object[]> IndicRead() =>
        from l in INDIC from c in READ select new object[] { l, c.Input, c.Spaced };

    public static IEnumerable<object[]> IndicLangs() => INDIC.Select(l => new object[] { l });

    [Theory]
    [MemberData(nameof(IndicDeclined))]
    public void ANumberBesideTheFractionDeclinesIt(string lang, string input, string parts) =>
        Assert.Equal(Say(lang, parts), Say(lang, input));

    [Theory]
    [MemberData(nameof(IndicRead))]
    public void AListCommaOrFullStopIsNotANumber(string lang, string input, string spaced) =>
        Assert.Equal(Say(lang, spaced), Say(lang, input));

    [Theory]
    [MemberData(nameof(IndicLangs))]
    public void NativeDigitsBehaveAsTheirAsciiTwins(string lang)
    {
        Assert.Equal(Say(lang, "1 2.5"), Say(lang, Native(lang, "1/2.5")));
        Assert.Equal(Say(lang, "1/2, 3/4"), Say(lang, Native(lang, "1/2,3/4")));
        Assert.NotEqual(Say(lang, "1 2"), Say(lang, "1/2"));
    }

    [Theory]
    [InlineData("1/2,5", "1 2,5")] // the language's own decimal comma
    [InlineData("1,5/2", "1,5 2")]
    [InlineData("1/2.5", "1 2.5")] // the anglicism dot decimal
    [InlineData("1.5/2", "1.5 2")]
    [InlineData("3/4,5", "3 4,5")]
    [InlineData("1/2:3", "1 2:3")] // a clock colon, mirrored from the left side
    public void LuxembourgishDecimalBesideTheFractionDeclinesIt(string input, string parts) =>
        Assert.Equal(Say("lb", parts), Say("lb", input));

    [Fact]
    public void LuxembourgishPlainFractionStillReads()
    {
        Assert.NotEqual(Say("lb", "1 2"), Say("lb", "1/2"));
        Assert.Equal(Say("lb", "1/5 ."), Say("lb", "1/5."));
    }
}
