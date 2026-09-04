// The C# half of test/rate-half-reading.test.ts — an unreadable rate reads its NUMERATOR and strands only
// the denominator (#1093 → #1098 → #1249).
//
// ⚠ THIS CONTRACT HAS BEEN BOTH WAYS ROUND. `km/h` is a unit plus a denominator NOUN, and a language that
// has not sourced the noun cannot say it. The arm first matched the numerator anyway and left `/h` outside
// the match; #1098 called that a half reading and rejected the whole match, so the abbreviation would stay
// where the leak gates can see it. #1249 measured that the abbreviation stays there EITHER WAY — the residue
// after the slash is character-for-character the same — while declining additionally throws away a reading
// the language has, and in 34 of the 193 registry codes hands the raw `km` to the English foreign reader,
// which says the LETTER NAMES. So the tier reads what it can read and strands what has no word behind it.
//
// The fleet-wide sweep lives in the TS, where every registry code is reachable. What is pinned here is the
// TIER CONTRACT itself, at the level the C# owns it, plus the two counter-examples #1098 measured — both
// unaffected, since neither was ever an ASCII-Latin denominator.
using Vernacula.Phonemizer.Core;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class RateHalfReadingTests
{
    private static readonly Func<string, string> Plain = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "kilometre" }, ["m"] = new[] { "metre" }, ["cm"] = new[] { "centimetre" },
            ["mg"] = new[] { "milligram" }, ["ml"] = new[] { "millilitre" },
        },
    });

    private static readonly Func<string, string> WithRate = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Units = new Dictionary<string, IReadOnlyList<string>> { ["km"] = new[] { "kilometre" } },
        UnitPer = "per",
        RateDenominators = new Dictionary<string, string> { ["h"] = "hour" },
        ExponentWords = new ExponentWordsDef { Squared = new[] { "square" }, Position = ExponentPosition.Before },
    });

    [Theory]
    // An UNDECLARED denominator: the NUMERATOR reads and the symbol is CONSUMED AND DROPPED (#1255). It was
    // stranded here under #1249, on the argument that it stayed visible; measured over 193 codes it was not
    // visible but SPOKEN — an English letter name in a non-Latin host, a literal IPA `h` in a Latin one, a
    // native phone in eleven more. Missing word ≥ wrong word.
    [InlineData("5 m/s", "5 metre")]
    [InlineData("5 km/h", "5 kilometre")]
    // ⚠ …BUT `yr` KEEPS ITS SLASH, and that is the vowel test doing its job rather than an inconsistency:
    // the drop is restricted to VOWEL-FREE runs (`isBareUnitKey`'s discriminator), because a short run WITH
    // a vowel may be a word the host reads — nl `km/uur` is *ˈyr*, sw `km/saa` is *sˈaː*. `y` counts as a
    // vowel there, so `yr` is on the conservative side and keeps today's behaviour.
    [InlineData("2-3 cm/yr", "2-3 centimetre/yr")]
    // …and the EXPONENT still comes with the numerator, in both spellings — #1249's own second finding.
    [InlineData("5 m³/s", "5 metre³")]
    [InlineData("5 km²/h", "5 kilometre²")]
    [InlineData("5 m2/s", "5 metre²")]
    [InlineData("5 km2/h", "5 kilometre²")]
    public void AnUnreadableRateReadsItsNumerator(string input, string want) => Assert.Equal(want, Plain(input));

    [Theory]
    // ⚠ THE TWO MEASURED COUNTER-EXAMPLES. A DIGIT after the slash is a RATIO of two readable quantities —
    // Min Nan's blood-sugar article writes `120mg/100ml`, where this arm reads the first and its own next
    // match reads the second, so declining would leak BOTH units raw.
    [InlineData("120mg/100ml", "120 milligram/100 millilitre")]
    // A NON-LATIN denominator is a word the host engine reads. Declining `12.8 km/秒` took a Japanese golden
    // row from `12.8 kilometre byou` — very nearly right — to the ENGLISH LETTER NAMES for `km`.
    [InlineData("12.8 km/秒", "12.8 kilometre/秒")]
    public void ADenominatorThatIsNotABareAbbreviationIsNotAStranding(string input, string want) =>
        Assert.Equal(want, Plain(input));

    [Theory]
    // ⚠ THE GUARD MUST NOT COST A LANGUAGE THE READINGS IT HAS SOURCED.
    [InlineData("5 km/h", "5 kilometre per hour")]
    [InlineData("5 km²/h", "5 square kilometre per hour")]
    [InlineData("5 km2/h", "5 square kilometre per hour")]
    [InlineData("5 km²", "5 square kilometre")]
    // …and an undeclared denominator is dropped where a rate IS declared, without costing the numerator.
    [InlineData("5 km/s", "5 kilometre")]
    public void ADeclaredRateStillReads(string input, string want) => Assert.Equal(want, WithRate(input));

    [Theory]
    // A plain digit after the unit is a DIFFERENT class (`2005 MM13`, `約20 km15マイル`) and is deliberately
    // left alone here — see the TS for the two goldens that measurement moved in opposite directions.
    [InlineData("20 km15", "20 kilometre15")]
    [InlineData("5 km", "5 kilometre")]
    public void APlainDigitAfterTheUnitIsNotThisDefect(string input, string want) =>
        Assert.Equal(want, Plain(input));
}
