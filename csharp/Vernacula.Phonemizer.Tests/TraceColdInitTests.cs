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
        // ⚠ ANCHORED ON THE ASSEMBLY, NOT THE WORKING DIRECTORY, like every other test here
        // (TraceTests, LanguageInitializationTests, Core/DataPath). VSTest happens to set CWD to
        // bin/<cfg>/<tfm> today; a runner that leaves it at the repo root would resolve five levels
        // ABOVE the repo, the child would not find csharp/goldens, and the failure would be reported
        // as a provenance defect that is not there.
        var repo = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
        var psi = new ProcessStartInfo("dotnet", "run --project csharp/tools/trace-cold -c Release -- csharp/goldens")
        { WorkingDirectory = repo, RedirectStandardOutput = true, RedirectStandardError = true };
        using var p = Process.Start(psi)!;
        // ⚠ BOTH PIPES ARE READ CONCURRENTLY, AND THE TIMEOUT IS ON THE READ. Draining stdout to
        // completion first deadlocks the moment the child fills the ~64KB stderr buffer — a restore or
        // build failure from `dotnet run` is the concrete trigger. And a `WaitForExit(n)` placed AFTER
        // two blocking reads is inert: the reads have already waited forever, so the timeout could
        // never fire and a hung child would hang the whole `dotnet test` run instead of failing.
        var outTask = p.StandardOutput.ReadToEndAsync();
        var errTask = p.StandardError.ReadToEndAsync();
        if (!Task.WhenAll(outTask, errTask).Wait(TimeSpan.FromMinutes(10)))
        {
            try { p.Kill(entireProcessTree: true); } catch { /* already gone */ }
            Assert.Fail("trace-cold did not finish within 10 minutes");
        }
        p.WaitForExit();
        var stdout = outTask.Result;
        var stderr = errTask.Result;
        // ⚠ EXIT 1 IS THE DEFECT; ANYTHING ELSE IS THE HARNESS. Exit 2 is "goldens not found", and a
        // build or restore failure exits non-zero too — reporting those as a provenance bug sends the
        // next reader after something that is not there.
        Assert.True(p.ExitCode is 0 or 1, $"trace-cold could not run (exit {p.ExitCode}):\n{stdout}\n{stderr}");
        Assert.True(p.ExitCode == 0, $"trace-cold reported a cold-trace defect:\n{stdout}");
        Assert.Contains("no poisons", stdout);
    }
}
