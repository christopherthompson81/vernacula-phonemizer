// `String.prototype.trim` is NOT `string.Trim()`, and the gap runs in BOTH directions: .NET does not strip
// U+FEFF (which JS does, and a BOM is the commonest leading character a file-read string can carry) and does
// strip U+0085 (which JS does not). Measured, not assumed: `char.IsWhiteSpace` is FALSE for U+001C-U+001F on
// modern .NET, whatever .NET Framework used to do, so U+0085 is the whole of that half of the gap.
//
// ⚠ FOUND BY A PROBE, NOT BY THE GATE, and it was a C#-ONLY divergence — the TypeScript was already right.
// wuu's engine tests `WUGNIU.test(input.trim())` as a whole-string fast path, so "\uFEFFzaon2 he4" took the
// romanization path in Node and fell through to the ENGLISH foreign reader in .NET (*zˈæɑːn ɲi hˈiː sɿ*), while
// "\u0085zaon2 he4" did the exact reverse. No golden row carries either character.
using Vernacula.Phonemizer.Core;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class JsTrimTests
{
    /// <summary>The ECMAScript `WhiteSpace ∪ LineTerminator` set — every one of these is stripped.</summary>
    [Theory]
    [InlineData("\t")] [InlineData("\n")] [InlineData("\v")] [InlineData("\f")] [InlineData("\r")]
    [InlineData("\u0020")] [InlineData("\u00A0")] [InlineData("\u1680")] [InlineData("\u2000")] [InlineData("\u2001")]
    [InlineData("\u2002")] [InlineData("\u2003")] [InlineData("\u2004")] [InlineData("\u2005")] [InlineData("\u2006")]
    [InlineData("\u2007")] [InlineData("\u2008")] [InlineData("\u2009")] [InlineData("\u200A")] [InlineData("\u2028")]
    [InlineData("\u2029")] [InlineData("\u202F")] [InlineData("\u205F")] [InlineData("\u3000")] [InlineData("\uFEFF")]
    public void StripsTheEcmascriptWhitespaceSet(string ws)
    {
        Assert.Equal("x", Js.Trim(ws + "x" + ws));
        Assert.Equal("", Js.Trim(ws + ws));
    }

    /// <summary>NOT ECMAScript whitespace — `Js.Trim` keeps all five.</summary>
    [Theory]
    [InlineData("\u0085")] [InlineData("\u001C")] [InlineData("\u001D")] [InlineData("\u001E")] [InlineData("\u001F")]
    public void KeepsWhatJsKeeps(string c) => Assert.Equal(c + "x" + c, Js.Trim(c + "x" + c));

    /// <summary>…and U+0085 is the reachable one: `string.Trim()` strips it, `String.prototype.trim` does
    /// not. That is the second half of the wuu divergence, and the reason the shim exists.</summary>
    [Fact]
    public void DotNetsOwnTrimStripsU0085() => Assert.Equal("x", "\u0085x\u0085".Trim());

    /// <summary>The lower bound: format characters NEITHER engine strips.</summary>
    [Theory]
    [InlineData("\u180E")] [InlineData("\u200B")] [InlineData("\u2060")]
    public void KeepsWhatNeitherStrips(string c) => Assert.Equal(c + "x" + c, Js.Trim(c + "x" + c));

    [Fact]
    public void EmptyAndAllWhitespaceStringsAreHandled()
    {
        Assert.Equal("", Js.Trim(""));
        Assert.Equal("", Js.Trim(" \t\r\n\uFEFF"));
        Assert.Equal("a b", Js.Trim("  a b  "));
    }

    /// <summary>The reachable consequence: wuu's and yue's whole-string romanization fast path.</summary>
    [Fact]
    public void TheSiniticFastPathSeesThroughAByteOrderMark()
    {
        Assert.Equal(Phonemizer.Phonemize("zaon2 he4", "wuu"), Phonemizer.Phonemize("\uFEFFzaon2 he4", "wuu"));
        Assert.Equal(Phonemizer.Phonemize("hoeng1 gong2", "yue"), Phonemizer.Phonemize("\uFEFFhoeng1 gong2", "yue"));
    }
}
