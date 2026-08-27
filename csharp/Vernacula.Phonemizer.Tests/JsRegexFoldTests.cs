// The case-fold table, checked against the measurement it came from.
//
// ⚠ A TABLE NOBODY CAN RE-MEASURE IS A HAND-WRITTEN TABLE. Core/JsRegex.cs widens character classes
// so .NET's IgnoreCase reproduces JS's scf-based /iu. The widening list was measured (Node's answer
// for every case-equivalence group in the BMP, recorded in csharp/fold-pairs.json by
// tools/measure_case_folding.mts), but the .NET half of the comparison is a property of the RUNTIME
// and can change under an upgrade. So the .NET side is re-derived here at test time rather than
// frozen: if a future .NET starts or stops equating a pair, this fails instead of silently emitting
// a different phoneme.
using System.Text.Json;
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class JsRegexFoldTests
{
    private static int[][] Pairs()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "fold-pairs.json");
        return JsonSerializer.Deserialize<int[][]>(File.ReadAllText(path))!;
    }

    [Fact]
    public void EveryJsEquivalentPairMatchesUnderIU()
    {
        var failures = new List<string>();
        var divergent = 0;
        foreach (var pair in Pairs())
        {
            string a = char.ConvertFromUtf32(pair[0]), b = char.ConvertFromUtf32(pair[1]);
            var esc = Regex.Escape(a);
            if (!new Regex($"[{esc}]", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant).IsMatch(b)) divergent++;
            if (!JsRegex.Compile($"[{esc}]", "iu").IsMatch(b))
                failures.Add($"U+{pair[0]:X4} ~ U+{pair[1]:X4}");
        }
        Assert.Empty(failures);
        // The gap is what the table exists to close; if it ever reaches zero the runtime changed and
        // the widening became dead weight, which is worth knowing.
        Assert.True(divergent > 0, "no pair diverges any more — .NET's IgnoreCase changed, re-measure");
    }

    // ⚠ /iu WIDENS THE WORD-CHARACTER SET, WHICH MOVES \b. JS defines \w and \b over ASCII
    // [A-Za-z0-9_] — except with i and u BOTH set, where every character whose scf lands in that set
    // joins it. Exactly two do: U+017F LONG S and U+212A KELVIN. So under /iu there is NO boundary
    // between a long s and a following ASCII letter, and French's name-initial rule must decline
    // "ſt. Foo" rather than read the t as a letter name (#1127).
    //
    // The probe is `^.\b` — "is there a boundary AFTER the first character". A `\bx` probe cannot
    // measure this: under i the x matches the first character too, so the match lands at index 0 on
    // the start-of-string boundary and reports true whatever the pair does. Expected values are Node's.
    [Theory]
    [InlineData("\u017Ft", "iu", false)]   // long s is a word char under /iu — no boundary before the t
    [InlineData("\u017Ft", "u", true)]     // ...but not under /u alone
    [InlineData("\u017Ft", "i", true)]     // ...nor under legacy /i, which never folds onto ASCII
    [InlineData("\u017Ft", "", true)]
    [InlineData("\u212Ak", "iu", false)]   // KELVIN SIGN, the only other member
    [InlineData("\u212Ak", "u", true)]
    [InlineData("\u2126k", "iu", true)]    // OHM folds to ω, not onto ASCII — still a boundary
    [InlineData("st", "iu", false)]         // the ordinary pair the widened set must keep agreeing with
    [InlineData("\u017F ", "iu", true)]    // a word char before a space is still a boundary
    public void WordBoundaryFollowsTheFoldWidenedWordSet(string input, string flags, bool boundary)
        => Assert.Equal(boundary, JsRegex.Compile("^.\\b", flags).IsMatch(input));

    [Theory]
    [InlineData("\u017F", "iu", true)]
    [InlineData("\u017F", "u", false)]
    [InlineData("\u212A", "iu", true)]
    [InlineData("\u212A", "", false)]
    [InlineData("\u2126", "iu", false)]
    public void WordClassFollowsTheSameSet(string input, string flags, bool isWord)
    {
        Assert.Equal(isWord, JsRegex.Compile("^\\w$", flags).IsMatch(input));
        Assert.Equal(!isWord, JsRegex.Compile("^\\W$", flags).IsMatch(input));
    }

    [Fact]
    public void TheMeasurementIsPresentAndPlausible()
    {
        var pairs = Pairs();
        Assert.True(pairs.Length > 2000, $"fold-pairs.json has only {pairs.Length} pairs — regenerate it");
        Assert.All(pairs, p => Assert.Equal(2, p.Length));
    }
}
