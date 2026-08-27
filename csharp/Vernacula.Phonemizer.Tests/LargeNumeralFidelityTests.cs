// The C# half of test/large-numeral-fidelity.test.ts — a digit run too long for a double must still read
// its own digits (#1059, #1080, #1095).
//
// ⚠ THE DEFECT WAS USING A FLOAT AS A CARRIER OF DIGITS. Every engine's overflow fallback exists precisely
// because the double cannot be trusted, and ~77 of them then derived the digits from that same double.
// Above 2^53 it has rounded; above 1e21 `String(n)` is EXPONENT form, so `1000000000000000000000` read as
// the three characters of `1e+21` — *waːħid iθnaːn waːħid*, "one two one".
//
// The fleet sweep lives in the TS, where every registry code is reachable. What is pinned here is that the
// PORTED composers thread the token, at the level the C# owns them.
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class LargeNumeralFidelityTests
{
    private const string A = "1000000000000000000001";
    private const string B = "1000000000000000000009";

    [Theory]
    // Threaded in #1095: the parameter already existed and the CALL SITE dropped it — the hr/bs shape.
    [InlineData("ar")]
    [InlineData("arz")]   // …and the nine dialects that share the Arabic composer
    [InlineData("apc")]
    [InlineData("pt")]
    [InlineData("pt-BR")]
    [InlineData("ff")]
    // Threaded in #1095: no parameter at all, but a complete digit table behind it.
    [InlineData("grc")]
    [InlineData("af")]
    [InlineData("ta")]
    public void TwoTwentyTwoDigitRunsDifferingOnlyInTheLastDigitDoNotReadAlike(string code) =>
        Assert.NotEqual(Phonemizer.Phonemize(A, code).Trim(), Phonemizer.Phonemize(B, code).Trim());

    /**
     * ⚠ AND IT IS NOT ONLY THE 2^53 CASE. Fula's decimal falls to the SAME fallback — `3.50` is not a safe
     * integer — and `Js.NumberToString(3.5)` has already thrown the trailing zero away, so a shipped golden
     * row read *three five* for three-point-five-zero. The `raw` string still has the digits the writer
     * typed, which is the whole point of threading it.
     */
    [Theory]
    [InlineData("3.50", "tˈati toɓːˈeɾe d͡ʒˈoji mˈeːɾe")]
    [InlineData("3.5", "tˈati toɓːˈeɾe d͡ʒˈoji")]
    [InlineData("12.00", "sˈapːo ˈe ɗˈiɗi toɓːˈeɾe mˈeːɾe mˈeːɾe")]
    public void ADecimalKeepsItsTrailingZeros(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "ff").Trim());

    /** The reading is DIGITS, not silence and not exponent notation. */
    [Theory]
    [InlineData("ar")]
    [InlineData("pt")]
    [InlineData("grc")]
    [InlineData("af")]
    [InlineData("ta")]
    [InlineData("ff")]
    public void TwentyTwoDigitsReadAsTwentyTwoDigits(string code)
    {
        var got = Phonemizer.Phonemize(A, code).Trim();
        Assert.NotEqual("", got);
        // "1 e 2 1" is four digits' worth of phonemes; twenty-two is far longer in every engine here.
        Assert.True(got.Length > 30, $"{code} → {got}");
    }
}
