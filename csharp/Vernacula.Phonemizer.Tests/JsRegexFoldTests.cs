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

    [Fact]
    public void TheMeasurementIsPresentAndPlausible()
    {
        var pairs = Pairs();
        Assert.True(pairs.Length > 2000, $"fold-pairs.json has only {pairs.Length} pairs — regenerate it");
        Assert.All(pairs, p => Assert.Equal(2, p.Length));
    }
}
