/**
 * #1495: the fraction rule's two guards are mirrors in the `\b…\b` family (en fr de es pt ru id) and in ht ln za uk
 * it; ht and ln also read fractions before decimals. Ported from test/fraction-guards-1495.test.ts. Expectations
 * are relational — a declined fraction reads as its numbers spaced, a read one as its spaced form — never typed IPA.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class FractionGuards1495Tests
{
    private static readonly (string, string)[] CHAIN = { ("3/1/2", "3 1 2"), ("1/2/3", "1 2 3") };
    private static readonly (string, string)[] READS = { ("1/2,3/4", "1/2, 3/4"), ("1/2.", "1/2 .") };
    private static readonly (string, string)[] DOT_DECIMAL =
        { ("1/2.5", "1 2.5"), ("1.5/2", "1.5 2"), ("1/1,000", "1 1,000"), ("1,000/2", "1,000 2") };
    private static readonly (string, string)[] COMMA_DECIMAL =
        { ("1/2,5", "1 2,5"), ("1,5/2", "1,5 2"), ("1/2.5", "1 2.5"), ("1.5/2", "1.5 2") };
    private static readonly (string, string)[] LETTER = { ("1/2abc", "1 2abc") };

    private static readonly Dictionary<string, (string, string)[]> LANGS = new()
    {
        ["en"] = [.. DOT_DECIMAL, .. CHAIN, .. READS],
        ["fr"] = [.. COMMA_DECIMAL, .. CHAIN, .. READS],
        ["de"] = [.. COMMA_DECIMAL, .. CHAIN, .. READS],
        ["es"] = [.. COMMA_DECIMAL, .. CHAIN, .. READS],
        ["pt"] = [.. COMMA_DECIMAL, .. CHAIN, .. READS],
        ["ru"] = [.. COMMA_DECIMAL, .. CHAIN, .. READS],
        ["id"] = [.. COMMA_DECIMAL, .. CHAIN, .. READS],
        ["uk"] = [.. COMMA_DECIMAL, .. CHAIN, .. READS],
        ["it"] = [.. COMMA_DECIMAL, .. CHAIN, .. READS],
        ["ht"] = [.. COMMA_DECIMAL, .. LETTER, .. READS],
        // ln: `1/2,3/4` reads both fractions but loses the pause (the decimal step re-reads the output digits);
        // unchanged by #1495, so only the full-stop case is pinned.
        ["ln"] = [.. COMMA_DECIMAL, .. LETTER, ("1/2.", "1/2 .")],
        ["za"] = [("1/2.5", "1 2.5"), ("1.5/2", "1.5 2"), .. LETTER, .. READS],
    };

    public static IEnumerable<object[]> Cases() =>
        from kv in LANGS from c in kv.Value select new object[] { kv.Key, c.Item1, c.Item2 };

    public static IEnumerable<object[]> Langs() => LANGS.Keys.Select(l => new object[] { l });

    [Theory]
    [MemberData(nameof(Cases))]
    public void ReadsAsItsSpacedForm(string lang, string input, string spaced) =>
        Assert.Equal(Phonemizer.Phonemize(spaced, lang), Phonemizer.Phonemize(input, lang));

    [Theory]
    [MemberData(nameof(Langs))]
    public void APlainFractionStillReads(string lang) =>
        Assert.NotEqual(Phonemizer.Phonemize("1 3", lang), Phonemizer.Phonemize("1/3", lang));
}
