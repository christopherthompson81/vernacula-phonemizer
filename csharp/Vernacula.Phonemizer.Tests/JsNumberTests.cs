/**
 * `Js.Number` against JS `Number()` — the four classes where they used to disagree (#1183).
 *
 * The function is documented as a port of `Number()`, and 714 call sites take that at its word. A
 * 72-probe differential against node found 22 divergences, and they were not one class but four; each is
 * pinned below with the value node actually prints, so the docstring's claim stays measured.
 *
 * ⚠ THE PRACTICAL EDGE IS THE FIRST CLASS. `Number("")` and `Number(" ")` are +0 in JS, and the
 * whitespace in question is exactly the fleet's own grouping-separator set — space, NBSP, NNBSP, thin
 * space — so the difference sat directly under every de-grouping and numeral path.
 */
using Vernacula.Phonemizer.Core;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class JsNumberTests
{
    /** CLASS 1 — the empty and whitespace-only strings are +0, not NaN. JS `ToNumber` trims first and
     *  maps the empty result to zero. */
    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("  ")]
    [InlineData("\t")]
    [InlineData("\n")]
    [InlineData("\r")]
    [InlineData("\v")]
    [InlineData("\f")]
    [InlineData(" ")]  // NBSP — a grouping separator in a dozen normalizers
    [InlineData(" ")]  // NNBSP
    [InlineData(" ")]  // thin space
    [InlineData("﻿")]  // BOM / ZWNBSP
    [InlineData("　")]  // ideographic space
    public void WhitespaceOnlyIsZeroNotNaN(string s) => Assert.Equal(0d, Js.Number(s));

    /** CLASS 2 — the trim is the JS whitespace set, not .NET's ASCII one, so a NON-ASCII space around a
     *  numeral must not make it unparseable. */
    [Theory]
    [InlineData(" 1 ", 1d)]
    [InlineData(" 1 ", 1d)]
    [InlineData("﻿1", 1d)]
    [InlineData("1﻿", 1d)]
    [InlineData("　1　", 1d)]
    public void SurroundingJsWhitespaceIsTrimmed(string s, double want) => Assert.Equal(want, Js.Number(s));

    /** CLASS 3 — the radix literals ARE numbers to JS; `NumberStyles.Float` reads none of them. */
    [Theory]
    [InlineData("0x10", 16d)]
    [InlineData("0X10", 16d)]
    [InlineData("0xff", 255d)]
    [InlineData("0b11", 3d)]
    [InlineData("0B11", 3d)]
    [InlineData("0o17", 15d)]
    [InlineData("0O17", 15d)]
    public void RadixLiteralsAreRead(string s, double want) => Assert.Equal(want, Js.Number(s));

    /** …and an ill-formed or signed one is NaN, as in JS. */
    [Theory]
    [InlineData("0x")]
    [InlineData("0b")]
    [InlineData("0o")]
    [InlineData("0b12")]   // 2 is not a binary digit
    [InlineData("0o18")]   // 8 is not an octal digit
    [InlineData("0xzz")]
    [InlineData("-0x10")]  // JS allows no sign on a radix literal
    public void IllFormedRadixLiteralsAreNaN(string s) => Assert.True(double.IsNaN(Js.Number(s)));

    /**
     * CLASS 4 — and this one ran the OTHER WAY: .NET's parser accepts `"infinity"` and `"nan"`
     * case-insensitively, so `Js.Number` was the MORE permissive of the two. JS spells the infinities
     * exactly.
     */
    [Theory]
    [InlineData("Infinity", double.PositiveInfinity)]
    [InlineData("+Infinity", double.PositiveInfinity)]
    [InlineData("-Infinity", double.NegativeInfinity)]
    public void TheInfinitiesAreSpelledExactly(string s, double want) => Assert.Equal(want, Js.Number(s));

    [Theory]
    [InlineData("infinity")]
    [InlineData("INFINITY")]
    [InlineData("Inf")]
    [InlineData("nan")]
    [InlineData("NAN")]
    public void ACaseFoldedWordFormIsNaN(string s) => Assert.True(double.IsNaN(Js.Number(s)));

    /** …and the ordinary readings, which never moved. */
    [Theory]
    [InlineData("0", 0d)]
    [InlineData("007", 7d)]
    [InlineData("1234567890", 1234567890d)]
    [InlineData("0.5", 0.5d)]
    [InlineData(".5", 0.5d)]
    [InlineData("5.", 5d)]
    [InlineData("1e3", 1000d)]
    [InlineData("1E3", 1000d)]
    [InlineData("-1", -1d)]
    [InlineData("+1", 1d)]
    public void TheOrdinaryNumeralStringsAreUnchanged(string s, double want) => Assert.Equal(want, Js.Number(s));

    [Theory]
    [InlineData("1,000")]   // a grouping comma is NOT a number to JS
    [InlineData("1 000")]
    [InlineData("1_000")]
    [InlineData("1.2.3")]
    [InlineData("١٢")]      // Arabic-Indic digits are not ASCII digits
    [InlineData("--1")]
    [InlineData("e")]
    [InlineData(".")]
    public void TheUnparseableStringsAreStillNaN(string s) => Assert.True(double.IsNaN(Js.Number(s)));
}
