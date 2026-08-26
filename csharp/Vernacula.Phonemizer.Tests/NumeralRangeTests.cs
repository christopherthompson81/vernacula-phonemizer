// A NUMERAL COMPOSITOR MUST NOT THROW WHERE NODE ANSWERS.
//
// ⚠ THIS IS THE ONE FAILURE SHAPE THE PARITY GATE STRUCTURALLY CANNOT REPORT. The gate proves the two
// engines agree on the golden rows; no golden row carries a number near a compositor's ceiling, so a
// language can throw on 10¹¹ forever and stay green. Tamil did: above 10¹⁰ the crore count exceeds 999,
// `Below1000` runs off `HUND`, and .NET raised `IndexOutOfRangeException` — while the SAME overflow in
// JavaScript yielded `undefined`, `Array.join` rendered it as the empty string, and Node read 10¹⁰, 10¹¹
// and 10¹² all as the bare word கோடி. One bug, two engines, two different wrong answers, both invisible.
//
// The TypeScript side has the matching oracles in test/magnitude-ceiling.test.ts (nothing speaks the string
// "undefined"; distinct numbers read distinctly). This is the half only C# can check: no exception.
using Vernacula.Phonemizer.Core;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class NumeralRangeTests
{
    /// <summary>Every order of magnitude a compositor plausibly runs out at, plus remainder-bearing shapes
    /// and the grouped forms that reach the same code path through the de-grouping rules.</summary>
    private static readonly string[] Numbers =
    {
        "0", "1", "999", "1000", "999999", "1000000", "999999999", "1000000000",
        "1234567890", "9999999999", "10000000000", "100000000000", "1000000000000",
        "999999999999", "1234567890123", "12345678901234567",
        "1,234,567,890", "1.234.567.890", "1 234 567 890", "123,456,789,012",
        "1,234.5", "1.234,5", "0.001", "0,001",
    };

    /// <summary>The ported set, taken from the goldens the parity gate reads — the same definition of
    /// "ported" the gate uses, so this cannot drift from it.</summary>
    private static IEnumerable<string> PortedCodes() =>
        Directory.EnumerateFiles(Path.Combine(DataPath.Root(), "..", "csharp", "goldens"), "*.tsv")
            .Select(Path.GetFileNameWithoutExtension)
            .Where(c => c is not null)
            .Select(c => c!)
            .Where(c => { try { Registry.GetPhonemizer(c); return true; } catch { return false; } })
            .OrderBy(c => c, StringComparer.Ordinal);

    [Fact]
    public void NoPortedLanguageThrowsOnAnyMagnitude()
    {
        Registry.EnsureLanguages();
        var codes = PortedCodes().ToList();
        Assert.True(codes.Count >= 60, $"expected the ported set, found {codes.Count}");
        var failures = new List<string>();
        foreach (var code in codes)
        {
            foreach (var n in Numbers)
            {
                try { Phonemizer.Phonemize(n, code); }
                catch (Exception e) { failures.Add($"{code} @ {n}: {e.GetType().Name}"); }
            }
        }
        Assert.Empty(failures);
    }
}
