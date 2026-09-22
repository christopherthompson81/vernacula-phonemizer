/**
 * ⚠ A STATIC INITIALIZER MUST NOT RUN A TRACKED REWRITE — the fleet-wide cold-trace check (#1408).
 *
 * ⚠ AND IT IS A TOOL RATHER THAN AN xunit TEST BECAUSE THE DEFECT IS ONCE PER PROCESS. `ja`'s static
 * constructor runs on the FIRST trace of `ja` and never again, so inside the shared test assembly some
 * other test has already warmed it and both a poison-sink sweep AND a direct span assertion pass with
 * the defect fully present — verified, not assumed. A cold-process assertion needs a cold process.
 *
 * ⚠ ONE PROCESS STILL COVERS EVERY LANGUAGE, which is what makes it affordable: each language's static
 * initializers run on ITS first trace, so all 189 cost ~15-25s together.
 *
 *   dotnet run --project csharp/tools/trace-cold -c Release
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Core;

var bad = new List<string>();
var current = "(before any trace)";
Provenance.OnPoison((expected, got) =>
    bad.Add($"{current}: tracked=\"{Trim(expected)}\" got=\"{Trim(got)}\""));
static string Trim(string s) => s.Length > 48 ? s[..48] + "…" : s;

var dir = args.Length > 0 ? args[0] : "csharp/goldens";
if (!Directory.Exists(dir)) { Console.Error.WriteLine($"goldens not found: {dir}"); return 2; }

var traced = 0;
var noSpans = new List<string>();
// ⚠ A SKIPPED LANGUAGE IS A HOLE IN THE GUARD AND MUST BE COUNTED. A bare `catch` that silently drops
// a language leaves the tool printing "traced 139 languages / no poisons" and exiting 0 while a quarter
// of its coverage is gone — green, and three quarters of a guard.
var skipped = new List<string>();
foreach (var f in Directory.GetFiles(dir, "*.tsv").OrderBy(x => x))
{
    var lang = Path.GetFileNameWithoutExtension(f);
    var first = File.ReadLines(f).FirstOrDefault(l => l.Contains('\t'));
    if (first is null) continue;
    current = lang;
    try
    {
        var t = Phonemizer.PhonemizeTrace(first.Split('\t')[0], lang);
        traced++;
        // ⚠ THE SECOND HALF: a language whose tokens ALL lack an input span on its first trace is the
        // same defect wearing a different face — `Provenance.For` withholding rather than poisoning.
        // Four engines hand-roll their tokenizer and emit no tokens at all; those are not this.
        if (t.Tokens.Count > 0 && t.Tokens.All(k => k.InputSpan is null)) noSpans.Add(lang);
    }
    catch (Exception e) { skipped.Add($"{lang} ({e.GetType().Name})"); }
}

var files = Directory.GetFiles(dir, "*.tsv").Length;
Console.WriteLine($"traced {traced} of {files} languages");
if (skipped.Count > 0) Console.WriteLine("\u26a0 SKIPPED (a language that throws is not covered):\n  " + string.Join(" ", skipped));
if (bad.Count > 0) Console.WriteLine("⚠ POISONED:\n  " + string.Join("\n  ", bad));
if (noSpans.Count > 0) Console.WriteLine("⚠ NO INPUT SPANS ON THE COLD TRACE:\n  " + string.Join(" ", noSpans));
if (bad.Count == 0 && noSpans.Count == 0) Console.WriteLine("no poisons, every traced language carries input spans");
// ⚠ A COLLAPSE IN COVERAGE FAILS TOO. `traced` was printed and never compared against anything, so a
// regression that made 50 languages throw would have kept this green.
if (traced < files - 5) { Console.WriteLine($"\u26a0 COVERAGE COLLAPSED: only {traced} of {files} traced"); return 1; }
return bad.Count == 0 && noSpans.Count == 0 ? 0 : 1;
