/**
 * ⚠ A LONE SURROGATE IS A VALID JS STRING AND AN INVALID CODE POINT, and .NET refuses one where JS is
 * indifferent. That hazard has now surfaced FOUR times in this port:
 *
 *   1. `LatinPhones.LatinPhone` — guarded from the start, with a comment naming the problem.
 *   2. `Js.ToLowerCase` — via `char.ConvertFromUtf32` (#1195, found by the ga g2p walk).
 *   3. `Rewriter.Renormalize` — `s.Normalize(form)` on the PIPELINE STRING (#1200, found by the kam fuzz).
 *      That one site alone accounted for 21 of the 25 languages then crashing from `Phonemize()`.
 *   4. 76 further `.Normalize` sites on raw words across 60 files (#1199).
 *
 * It keeps recurring because it is INVISIBLE TO EVERY OTHER GATE: no golden row carries a surrogate half,
 * so parity, poison, provenance and the IPA-span gates all stay green while the engine throws. This file
 * is the gate that can see it — and it walks EVERY registered language rather than a sample, because the
 * per-language ports are exactly where the shape comes back.
 *
 * ⚠ A g2p that indexes UTF-16 code units hands the halves of an astral character over ONE AT A TIME, which
 * the Ewe, Irish and Kamba scans do BY DESIGN. This is a designed-for input, not a pathological one.
 */
using System.Reflection;
using Vernacula.Phonemizer.Core;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class LoneSurrogateTests
{
    /** The halves of U+1F600, alone and in every adjacency a tokenizer can hand over. */
    private static readonly string[] Probes =
    [
        "a\ud83d", "\ud83da", "a\ud83db", "\ud83d", "\ude00", "a\ud83d b\ude00 c", "1\ud83d000",
    ];

    /** Every code `Registry.cs` routes — read from the source, because the registry has no enumeration
     *  export and a hand-kept list here would silently rot as languages land. */
    private static IEnumerable<string> AllCodes()
    {
        var path = Path.Combine(DataPath.Root(), "..", "csharp", "Vernacula.Phonemizer", "Registry.cs");
        var re = JsRegex.Compile("^\\s*case \"([^\"]+)\":", "gmu");
        return re.Matches(File.ReadAllText(path)).Select(m => m.Groups[1].Value).Distinct(StringComparer.Ordinal)
            .OrderBy(c => c, StringComparer.Ordinal);
    }

    /** ⚠ THE SHIPPED SURFACE. A throw here is a crash for anyone calling the public API. */
    [Fact]
    public void NoLanguageThrowsOnALoneSurrogateFromPhonemize()
    {
        var bad = new SortedSet<string>(StringComparer.Ordinal);
        foreach (var code in AllCodes())
            foreach (var p in Probes)
            {
                try { Phonemizer.Phonemize(p, code); }
                catch (ArgumentException e) when (e.Message.Contains("Unicode code points", StringComparison.Ordinal))
                { bad.Add(code); }
                catch { /* port-pending and other refusals are a different question */ }
            }
        Assert.True(bad.Count == 0, $"languages throwing on a lone surrogate: {string.Join(" ", bad)}");
    }

    /**
     * ⚠ AND THE PER-WORD SURFACE, WHICH IS WIDER. `PhonemizeWord` and friends are public and are what
     * `tools/referee-eval` and the lexicon builders call; the tokenizer is usually what keeps a surrogate
     * half out of `Phonemize()`, so it hides these. Found by reflection so no engine can be missed by an
     * out-of-date list — 620 throws across 68 sites when this was first measured.
     */
    [Fact]
    public void NoPublicSingleStringEntryPointThrowsOnALoneSurrogate()
    {
        var bad = new SortedSet<string>(StringComparer.Ordinal);
        var asm = typeof(Phonemizer).Assembly;
        foreach (var t in asm.GetTypes().Where(t =>
                     t.Namespace?.StartsWith("Vernacula.Phonemizer.Languages", StringComparison.Ordinal) == true))
            foreach (var m in t.GetMethods(BindingFlags.Public | BindingFlags.Static))
            {
                var ps = m.GetParameters();
                if (m.ReturnType != typeof(string) || ps.Length != 1 || ps[0].ParameterType != typeof(string)) continue;
                foreach (var p in Probes)
                {
                    try { m.Invoke(null, [p]); }
                    catch (TargetInvocationException tie) when (tie.InnerException is ArgumentException ae
                        && ae.Message.Contains("Unicode code points", StringComparison.Ordinal))
                    { bad.Add($"{t.Name}.{m.Name}"); }
                    catch { /* an engine may legitimately refuse an input; only the surrogate throw is the bug */ }
                }
            }
        Assert.True(bad.Count == 0, $"entry points throwing on a lone surrogate:\n  {string.Join("\n  ", bad)}");
    }
}
