/**
 * ⚠ A DOUBLED PLAIN SPACE INSIDE A CHARACTER CLASS IS A FOLDED NON-BREAKING SPACE, and this is the C# half of
 * the guard `test/doubled-space-class.test.ts` keeps on the TypeScript. A class written with two U+0020
 * characters LOOKS like "space or something else" and matches exactly what one space matches.
 *
 * The fleet carried 296 of them across 44 normalizers (#925). ⚠ THE WORST ONE WAS ON THIS SIDE AND IT WAS
 * MARKED AS COMPLIANT: `Core/NormalizeSymbols.cs` kept the doubled class under a `PAIRED-FIX PENDING` comment
 * saying the fix belonged in the TypeScript — where it had already landed, in #877. A stale marker is a fork
 * that documents itself as fidelity, and the parity gate cannot see it: no golden groups a numeral with a
 * NBSP. What saw it was a separator differential over every ported language (sw read `1\u00a0000 km` with the
 * unit postposed against the TS's prefixed *kilomìta mòja*).
 *
 * So the rule is the same on both sides: a spaces class is written with ESCAPES, never with literal exotic
 * spaces, because a literal one folds to a plain space in exactly the way that produced all 296.
 */
using System.Text.RegularExpressions;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class DoubledSpaceClassTests
{
    /// <summary>The engine's own source root, found by walking up from the test binary.</summary>
    private static string SourceRoot()
    {
        var dir = AppContext.BaseDirectory;
        while (dir is not null && !Directory.Exists(Path.Combine(dir, "Vernacula.Phonemizer", "Languages")))
            dir = Path.GetDirectoryName(dir);
        Assert.NotNull(dir);
        return Path.Combine(dir!, "Vernacula.Phonemizer");
    }

    /** A character class holding two ADJACENT plain spaces. */
    private static readonly Regex Doubled = new(@"\[[^\]\n]*  [^\]\n]*\]", RegexOptions.Compiled);

    [Fact]
    public void NoCharacterClassHoldsADoubledPlainSpace()
    {
        var offenders = new List<string>();
        foreach (var f in Directory.EnumerateFiles(SourceRoot(), "*.cs", SearchOption.AllDirectories))
        {
            if (f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}")
                || f.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}")) continue;
            var text = File.ReadAllText(f);
            foreach (Match m in Doubled.Matches(text))
            {
                var line = text[..m.Index].Count(c => c == '\n') + 1;
                offenders.Add($"{Path.GetFileName(f)}:{line}  {m.Value}");
            }
        }
        Assert.Empty(offenders);
    }
}
