/**
 * A unit symbol may not be a slot in an alphanumeric code.
 * Ported from test/english-normalize.test.ts — see Languages/English/Normalize.cs for the reasoning.
 *
 * ⚠ THIS MIRROR DID NOT EXIST, AND THAT IS THE WHOLE STORY OF #1421. The TypeScript half of this block
 * has been green since the guards landed; the C# `UNIT_RE` never received them, so `V6L 2T5` read "vee
 * six LITRES two tee five" and `L4W 5M1` "el four WATTS five em one" — the two spellings the TypeScript
 * comment names VERBATIM as already fixed.
 *
 * ⚠ AND THE PARITY GATE READ 189 BYTE-IDENTICAL THE WHOLE TIME. It is golden-driven and no golden row
 * carries a postal code, so this was not a check that was too weak — the class was outside what the
 * check ranges over. A cross-engine sweep of 64,233 generated `A#A #A#` codes and unit idioms was
 * byte-identical after the fix and diverged on 23,044 rows (35.9%) with the guards reverted, which is
 * the measurement that says these assertions are load-bearing rather than decorative.
 *
 * ⚠ THE POSITIVE CONTROLS BELOW ARE HALF THE POINT OF THE FILE. Every failure the TypeScript guard's
 * comments record came from a looser spelling that refused a REAL unit — ⟨mm⟩ in `A4 210mm`, ⟨m⟩ in
 * `2x3m`, ⟨ft⟩ in `5ft11`. A mirror that kept only the postal-code cases would go green for a C# guard
 * narrowed until it ate `a 5L jug`, which is the same class of defect in the other direction.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishCodeSlotUnitTests
{
    private static string Norm(string s) => Languages.English.Normalize.NormalizeEnglish(s);

    /// <summary>
    /// ⚠ A CANADIAN POSTAL CODE IS `A1A 1A1`, so every digit in it sits against a letter — and ⟨L⟩ and
    /// ⟨W⟩ are units. Only those two can collide: one-letter symbols resolve case-sensitively (#763),
    /// so uppercase ⟨G⟩/⟨T⟩/⟨M⟩ are not gram/ton/metre, which is why `T2G` was already clean and the
    /// leak looked narrower than it was.
    /// </summary>
    [Theory]
    [InlineData("T2G 0L1")]   // unit followed by a digit
    [InlineData("M5V 3L9")]
    [InlineData("V6L 2T5")]   // unit at the end of a group, preceded by a letter
    [InlineData("N2L 3G1")]
    [InlineData("L4W 5M1")]   // ⟨W⟩, the other case-sensitive one-letter unit
    public void APostalCodeKeepsItsLetters(string code)
    {
        Assert.Equal(code, Norm(code));
        Assert.DoesNotContain("liter", Norm(code));
        Assert.DoesNotContain("watt", Norm(code));
    }

    /// <summary>
    /// ⚠ THE EXPONENT IS A SEPARATE HOLE AND THE DIGIT GUARD CANNOT SEE IT: in `0L2` the `2` is consumed
    /// as an exponent, so the match ends at the token boundary quite legitimately and reads "zero SQUARE
    /// litres". A square litre is not a quantity — the litre is already a volume — so an ASCII exponent
    /// is only meaningful on a length.
    /// </summary>
    [Fact]
    public void AnAsciiExponentBelongsToALengthNotToWhateverLetterPrecedesIt()
    {
        Assert.Equal("T2G 0L2", Norm("T2G 0L2"));
        Assert.DoesNotContain("liter", Norm("Suite 5L2"));
        Assert.DoesNotContain("gram", Norm("Model 3G3"));
    }

    /// <summary>
    /// ⚠ EVERY LOOSER SPELLING OF THIS GUARD DROPS A REAL UNIT. The shape refused is the CODE GROUP
    /// exactly — a token-initial letter, one digit, a one-letter unit. In `2x3m` the letter is preceded
    /// by a DIGIT, and the `x`→`by` rewrite runs LATER than the unit rule, so at unit time the text
    /// really is `2x3m`.
    /// </summary>
    [Theory]
    [InlineData("2x3m rug", "2 by 3 meters rug")]
    [InlineData("a 4x8m field", "a 4 by 8 meters field")]
    [InlineData("5x5W LEDs", "5 by 5 watts LEDs")]
    [InlineData("100x100L tanks", "100 by 100 liters tanks")]
    [InlineData("1.5x2m", "1.5 by 2 meters")]
    [InlineData("3×5m", "3 by 5 meters")]   // the ⟨×⟩ spelling that never broke
    public void ADimensionIdiomKeepsItsUnit(string text, string expected)
        => Assert.Equal(expected, Norm(text));

    /// <summary>A multi-letter unit glued to digits is not a code slot — `A4 210mm` is millimetres.</summary>
    [Theory]
    [InlineData("A4 210mm wide", "millimeters")]
    [InlineData("B5 100mm", "millimeters")]
    [InlineData("A4 210m", "meters")]
    public void AMultiLetterUnitGluedToDigitsIsNotACodeSlot(string text, string expected)
        => Assert.Contains(expected, Norm(text));

    /// <summary>
    /// ⚠ THE TRAILING-DIGIT REFUSAL IS ALSO ONE-LETTER-ONLY. Applied to every unit it took the feet with
    /// it — `he is 5ft11` stopped reading "feet" — and ⟨ft⟩ is not a code slot either.
    /// </summary>
    [Theory]
    [InlineData("he is 5ft11")]
    [InlineData("6ft0 tall")]
    public void FeetAndInchesKeepsItsUnit(string text) => Assert.Contains("feet", Norm(text));

    /// <summary>
    /// …and a one-letter unit still reads wherever it is NOT in a code — glued to its number included.
    /// </summary>
    [Theory]
    [InlineData("100W bulb", "100 watts bulb")]
    [InlineData("a 5L jug", "a 5 liters jug")]
    [InlineData("12km run", "12 kilometers run")]
    [InlineData("500ml bottle", "500 milliliters bottle")]
    public void AGluedOneLetterUnitStillReads(string text, string expected)
        => Assert.Equal(expected, Norm(text));

    /// <summary>
    /// …and none of it costs the real units, including the ASCII exponent on the lengths that take one.
    /// </summary>
    [Theory]
    [InlineData("5 L of water", "5 liters of water")]
    [InlineData("a 100 W bulb", "a 100 watts bulb")]
    [InlineData("3 m2 of floor", "3 square meters of floor")]
    [InlineData("19,500 km2", "19,500 square kilometers")]
    [InlineData("19,500 km\u00b2", "19,500 square kilometers")]
    [InlineData("1 L", "1 liter")]
    public void TheUnitsThemselvesStillRead(string text, string expected)
        => Assert.Equal(expected, Norm(text));

    /// <summary>
    /// ⚠ AND THE EXPONENT RULE TESTS THE UNIT'S SHAPE, NOT A LIST OF LENGTHS. Spelled as a length list it
    /// declined the whole match for every other unit, putting a RAW µ into the g2p.
    /// </summary>
    [Fact]
    public void AMicroUnitWithAnAsciiExponentStillReadsSignAndAll()
    {
        Assert.Equal("5 square micrograms", Norm("5 µg2"));
        Assert.DoesNotContain("µ", Norm("5 µm2"));
    }
}
