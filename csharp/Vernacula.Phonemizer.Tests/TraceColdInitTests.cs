/**
 * A STATIC INITIALIZER MUST NOT RUN A TRACKED REWRITE, fleet-wide (#1408).
 *
 * ⚠ THE DEFECT THIS EXISTS FOR WAS CORRECT THE SECOND TIME YOU LOOKED. The FIRST `PhonemizeTrace` of
 * `ja` in a process returned every `InputSpan` null and every call after it returned them populated:
 * `Normalize`'s static constructor builds its digit-kana table with `ToKatakana("れい")`, a static
 * constructor runs LAZILY on first use, and for that class first use is inside `NormalizeJapanese` —
 * inside the traced window. So it called `Provenance.StartTrack("れい")` while the tracked string was
 * the caller's whole sentence, the mismatch rule correctly refused it, and the mapping was POISONED.
 *
 * ⚠ AND NOTHING COULD SEE IT. `check-goldens` and the parity harness compare IPA STRINGS; the trace is
 * in neither, so a port divergence this visible reached a downstream consumer before any gate noticed.
 * The TypeScript twin uses a plain `s.replace` there and was always clean.
 *
 * ⚠ AND THE CHECK CANNOT LIVE IN THIS ASSEMBLY, WHICH I VERIFIED RATHER THAN ASSUMED. The defect is
 * ONCE PER PROCESS, so by the time any test here runs, another test has already warmed `ja` — with the
 * fix reverted, BOTH a poison-sink sweep over all 189 languages AND a direct "ja's first trace has
 * spans" assertion PASSED inside the test assembly. A cold-process assertion needs a cold process, so
 * the check is `csharp/tools/trace-cold` and this test spawns it. Same device as
 * test/engb-sets-shard.test.ts, and for the same reason: a warm process hides exactly this class.
 */
using System.Diagnostics;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class TraceColdInitTests
{
    [Fact]
    public void NoLanguagePoisonsItsProvenanceOnTheFirstTrace()
    {
        var repo = Path.GetFullPath(Path.Combine("..", "..", "..", "..", ".."));
        var psi = new ProcessStartInfo("dotnet",
            $"run --project csharp/tools/trace-cold -c Release -- csharp/goldens")
        { WorkingDirectory = repo, RedirectStandardOutput = true, RedirectStandardError = true };
        using var p = Process.Start(psi)!;
        var stdout = p.StandardOutput.ReadToEnd();
        var stderr = p.StandardError.ReadToEnd();
        p.WaitForExit(600_000);
        Assert.True(p.HasExited, "trace-cold did not finish");
        Assert.True(p.ExitCode == 0, $"trace-cold reported a cold-trace defect:\n{stdout}\n{stderr}");
        Assert.Contains("no poisons", stdout);
    }
}
