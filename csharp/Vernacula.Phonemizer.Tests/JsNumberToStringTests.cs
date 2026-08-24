/**
 * `Js.NumberToString` must render a double exactly as JS `String(n)` does.
 *
 * ⚠ THE ENGINES READ THIS OUTPUT ALOUD DIGIT BY DIGIT. Every language's number path has an out-of-range
 * branch shaped like `[...String(Math.abs(n))].map(digitWord)`, so a wrong rendering is not a formatting
 * nit — it is a different sequence of spoken numerals. ja's `99999999999999999999個` read
 * *kʲɯᵝːninisän…* against JS's *it͡ɕi* + れい×20, because the old `(long)` cast overflowed Int64 silently.
 *
 * ⚠ NO GOLDEN CAN CATCH THIS: none of the 5,000 rows carries a number above 2^53, so the parity gate is
 * blind to the whole branch. Hence a direct differential test.
 *
 * The two rules that make it non-obvious, both pinned below:
 *   · above 2^53 JS prints the SHORTEST ROUND-TRIP digits, not the double's exact value — String(2**62)
 *     is "4611686018427388000" where the double really is 4611686018427387904;
 *   · JS is positional for 1e-7 < |n| < 1e21 and exponential outside it, with its own casing ("1e+21").
 * Every expectation here was produced by Node, and a 4,000-value randomized differential over the same
 * range passes alongside these.
 */
using Vernacula.Phonemizer.Core;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class JsNumberToStringTests
{
    [Theory]
    // small integers — the exact-cast fast path
    [InlineData(0d, "0")]
    [InlineData(1d, "1")]
    [InlineData(-1d, "-1")]
    [InlineData(123456d, "123456")]
    // the safe-integer boundary, where exact and shortest-round-trip still agree
    [InlineData(9007199254740991d, "9007199254740991")]
    [InlineData(9007199254740992d, "9007199254740992")]
    [InlineData(9007199254740994d, "9007199254740994")]
    // above 2^53: shortest round-trip, NOT the exact binary value
    [InlineData(4611686018427387904d, "4611686018427388000")] // 2^62
    [InlineData(9223372036854775808d, "9223372036854776000")] // 2^63 — overflows Int64
    [InlineData(-9223372036854775808d, "-9223372036854776000")]
    [InlineData(1e19, "10000000000000000000")]
    [InlineData(1e20, "100000000000000000000")]
    [InlineData(1.2345678901234568e20, "123456789012345680000")]
    // 1e21 is where JS switches to exponential
    [InlineData(1e21, "1e+21")]
    [InlineData(1.5e21, "1.5e+21")]
    [InlineData(1e100, "1e+100")]
    // small magnitudes: positional down to 1e-6, exponential from 1e-7
    [InlineData(0.1, "0.1")]
    [InlineData(1.25, "1.25")]
    [InlineData(-0.001, "-0.001")]
    [InlineData(1e-6, "0.000001")]
    [InlineData(1e-7, "1e-7")]
    [InlineData(1e-100, "1e-100")]
    public void MatchesJavaScriptStringOf(double value, string expected) =>
        Assert.Equal(expected, Js.NumberToString(value));
}
