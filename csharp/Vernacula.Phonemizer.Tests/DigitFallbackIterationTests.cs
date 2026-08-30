/**
 * THE DIGIT-BY-DIGIT FALLBACK ITERATES WHATEVER ITS TYPESCRIPT DOES — no more, no less.
 *
 * Three ports in a row (gn, haw, hil) shipped a fallback that iterated a C# string, which yields UTF-16
 * CODE UNITS, where their TypeScript spread it with `[...]`, which yields CODE POINTS. An astral character
 * then came back as TWO LONE SURROGATES with a space between them — malformed UTF-16 in the phoneme
 * stream, which is worse than either sensible reading of the character. A sweep found the same shape in
 * six more languages.
 *
 * ⚠ AND THE FIX IS NOT "ALWAYS USE CODE POINTS", WHICH IS THE POINT OF THE CONTROLS BELOW. Two of these
 * engines' TypeScript uses `.split("")` rather than `[...]`, and `String.prototype.split("")` splits by
 * CODE UNIT. For those, iterating chars is the faithful thing and switching to code points would be a new
 * divergence. Faithful means matching the source, not applying a house rule — so `afrikaans` and
 * `georgian` assert the SURROGATE-PAIR reading on purpose.
 *
 * Every expected value here was taken from the TypeScript engine, not from the implementation.
 * Unreachable from `text()` in each language (the number branch is `\d+`), but every one of these entry
 * points is public and the TypeScript answers it.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class DigitFallbackIterationTests
{
    /** The six that spread in the TS: an astral character survives whole. */
    [Theory]
    [InlineData("cebuano", "usa 😀 duha")]
    [InlineData("maori", "tahi 😀 rua")]
    [InlineData("aragonese", "un 😀 dos")]
    [InlineData("umbundu", "mosi 😀 vali")]
    [InlineData("occitan", "un 😀 dos")]
    [InlineData("asturian", "un 😀 dos")]
    public void ASpreadingComposerReadsCodePoints(string lang, string want)
    {
        var got = lang switch
        {
            "cebuano" => Languages.Cebuano.Numbers.NumberToWords(double.NaN, "1😀2"),
            "maori" => Languages.Maori.Numbers.NumberToWords(double.NaN, "1😀2"),
            "aragonese" => Languages.Aragonese.Numbers.NumberToWords(double.NaN, "1😀2"),
            "umbundu" => Languages.Umbundu.Numbers.NumberToWords(double.NaN, "1😀2"),
            "occitan" => Languages.Occitan.Numbers.NumberToWords(double.NaN, "1😀2"),
            _ => Languages.Asturian.Numbers.NumberToWords(double.NaN, "1😀2"),
        };
        Assert.Equal(want, got);
    }

    /**
     * ⚠ THE CONTROL: afrikaans' TypeScript uses `.split("")`, which is CODE UNITS, so the surrogate pair
     * is split and this reading is the FAITHFUL one. Asserted so a later "tidy-up" to code points has to
     * argue with the source.
     */
    [Fact]
    public void ASplittingComposerReadsCodeUnitsAndThatIsCorrect() =>
        Assert.Equal("een \ud83d \ude00 twee", Languages.Afrikaans.Numbers.NumberToWords(double.NaN, "1😀2"));

    /** …and georgian, likewise `.split("")`. */
    [Fact]
    public void GeorgianReadDigitsAlsoReadsCodeUnits() =>
        Assert.Equal("ერთი \ud83d \ude00 ორი", Languages.Georgian.Numbers.ReadDigits("1😀2"));

    /**
     * ⚠ AND THE GUARD MUST BE THE ASCII-DIGIT TEST, NOT `Js.Number`. Georgian's guard was
     * `Js.Number(d)` — equivalent until `Js.Number` was made JS-faithful (#1183), at which point
     * `Number(" ")` became 0, the guard passed, and a SPACE inside a digit run read as ნული, the word for
     * ZERO. #1165's invented zero, arriving by a different door.
     */
    [Fact]
    public void ASpaceInADigitRunIsNotTheWordZero() =>
        Assert.Equal("ერთი   ორი", Languages.Georgian.Numbers.ReadDigits("1 2"));

    /**
     * ⚠ A FRACTIONAL INDEX IS `undefined` IN JS, NOT A TRUNCATION. `ONES[1.5]` is `undefined` — JS array
     * indexing converts the index to a property key and "1.5" is not one — so the TS emits an empty slot.
     * A C# `(int)` cast truncated to 1 and said ஒன்று, "one": a quantity invented out of a value the TS
     * declines to read.
     */
    [Theory]
    [InlineData(1.5, "")]
    [InlineData(0.5, "")]
    [InlineData(2.25, "")]
    [InlineData(100.5, "நூற்றி ")]
    public void AFractionalIndexReadsAsNothing(double n, string want) =>
        Assert.Equal(want, Languages.Tamil.TamilNumbersComposer.NumberToWords(n));
}
