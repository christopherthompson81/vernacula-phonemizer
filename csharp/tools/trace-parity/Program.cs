// The TRACE parity gate (#1419) — the half `parity` and `check-goldens` cannot see.
//
// ⚠ BOTH EXISTING GATES COMPARE IPA STRINGS. `PhonemizeTrace` — the token list, `Span`, `InputSpan`,
// `IpaSpan` — is in NEITHER, so a port divergence in the trace cannot fail anything. That is how #1408
// got out: the first `PhonemizeTrace` of `ja` in a C# process returned every `InputSpan` null while the
// TypeScript was correct cold and warm, it reached a downstream consumer, and parity stayed green
// throughout — correctly, because the READINGS never differed.
//
// ⚠ A DIVERGENCE IN ORDINARY SPANS LANDS AS SILENTLY-WRONG HIGHLIGHTING, not as anything visibly
// broken. A null is legible; a wrong offset is not. That asymmetry is the reason this gate exists.
//
// ⚠ ONE PROCESS PER SIDE, COLD. The TypeScript half runs in its own `npx tsx` process and writes a
// dump; this runs in its own. Neither side may be warmed by the other, and neither check can live in
// `dotnet test` — #1408 established that an assembly-resident check is VACUOUS against the cold-init
// class, because a shared test process has already warmed every language.
//
//   npx tsx tools/dump-traces.mts <dump.tsv>          # side 1, in its own process
//   dotnet run --project csharp/tools/trace-parity -- <dump.tsv>
using System.Text;
using Vernacula.Phonemizer;

var dump = args.FirstOrDefault(a => !a.StartsWith('-'));
if (dump is null || !File.Exists(dump))
{
    Console.Error.WriteLine("usage: trace-parity <dump.tsv>   (write it with tools/dump-traces.mts)");
    return 2;
}

var goldens = Path.Combine(AppContext.BaseDirectory, "../../../../../goldens");
if (!Directory.Exists(goldens)) goldens = "csharp/goldens";

// ⚠ THE SAME `[codes…]` FILTER AS THE DUMPER, and it is not a convenience. Without it a subset run
// has TypeScript reach `hak` in a COLD process while C# reaches it after phonemizing a hundred earlier
// languages — which, with a process-wide foreign-OOV memo, is exactly the condition that manufactures a
// false diff. It also kept a one-language repro paying for a full 36,495-row pass.
var only = args.Where(a => !a.StartsWith('-')).Skip(1).ToHashSet(StringComparer.Ordinal);

/** One token as `span:inputSpan:ipaSpan`, each `a-b`, empty when the span is absent. */
static string Pair((int Start, int End)? s) => s is null ? "" : $"{s.Value.Start}-{s.Value.End}";

// ── the expected side, read once ────────────────────────────────────────────────────────────────────
var expected = new Dictionary<string, string>(StringComparer.Ordinal);
foreach (var line in File.ReadLines(dump))
{
    if (line.Length == 0) continue;
    // ⚠ A MALFORMED DUMP MUST SAY SO, NOT CRASH. A file truncated by an interrupted write, or hand
    // trimmed, otherwise reached `line[..-1]` and the user got a stack trace instead of "rerun the dump".
    var tab = line.IndexOf('\t');
    var tab2 = tab < 0 ? -1 : line.IndexOf('\t', tab + 1);
    if (tab2 < 0)
    {
        Console.Error.WriteLine($"not a trace dump (a line has fewer than two tabs): {dump}");
        Console.Error.WriteLine("rerun `npm run dump:traces`");
        return 2;
    }
    expected[line[..tab2]] = line[(tab2 + 1)..];
}

var rows = 0; var walked = 0; var differ = 0; var structural = 0; var langs = new SortedSet<string>();
var shown = 0;

void Report(string what, string key, string a, string b)
{
    differ++;
    if (shown++ < 25) Console.WriteLine($"  {key}  {what}\n    ts: {a}\n    cs: {b}");
}

// ⚠ SHARES THE SAME BUDGET AS `Report`. In the systemic case this gate exists to catch — a span
// regression affecting every row — an uncapped print buries the summary under 36,495 lines.
void Structural(string key, string what)
{
    structural++;
    if (shown++ < 25) Console.WriteLine($"  {key}  {what}");
}

foreach (var path in Directory.EnumerateFiles(goldens, "*.tsv").OrderBy(p => p, StringComparer.Ordinal))
{
    var code = Path.GetFileNameWithoutExtension(path);
    if (only.Count > 0 && !only.Contains(code)) continue;
    // ⚠ PER LANGUAGE, as the parity runner and check-goldens both do — the foreign-OOV memo is
    // PROCESS-WIDE, so without this a row's trace is a function of what ran before it. It matters more
    // here than anywhere else: the memo's CONTENT is port-specific, so an uncleared one can report a
    // divergence whose real cause is a different language, or let two contaminations cancel.
    Vernacula.Phonemizer.Core.Foreign.ClearForeignOov();
    var row = 0;
    foreach (var line in File.ReadLines(path))
    {
        var text = line.Split('\t')[0];
        if (text.Length == 0) continue;
        row++;
        walked++;
        var key = $"{code}\t{row}";
        if (!expected.TryGetValue(key, out var want)) continue;  // the TS side skipped this code
        rows++;
        langs.Add(code);

        string got;
        try
        {
            var t = Phonemizer.PhonemizeTrace(text, code);
            var toks = string.Join(" ", t.Tokens.Select(k =>
                $"{k.Start}-{k.End}:{Pair(k.InputSpan)}:{Pair(k.IpaSpan)}"));
            got = $"{(t.Traced ? "T" : "F")}\t{t.Tokens.Count}\t{toks}";

            // ── structural, this side only ──────────────────────────────────────────────────────────
            // ⚠ MEASURED, NOT ASSUMED. Over the whole corpus: `Span` is disjoint and strictly ascending
            // and NEVER shared, but it does NOT TILE — 34,772 of 36,495 rows leave gaps at whitespace,
            // so "the spans tile the input" would have failed almost everywhere. `InputSpan` is
            // all-or-nothing per row (0 rows have only some) and IS shared by adjacent tokens in 12,103
            // rows, which is why sharing is not an error here — see #1420, where a token spanning the
            // WHOLE input was the real defect and distinctness was the wrong thing to assert.
            var prevEnd = 0;
            var withInput = 0;
            var bailed = false;
            foreach (var k in t.Tokens)
            {
                if (k.Start < 0 || k.End > t.Normalized.Length || k.Start > k.End)
                { Structural(key, $"span out of range: {k.Start}-{k.End} of {t.Normalized.Length}"); bailed = true; break; }
                if (k.Start < prevEnd)
                { Structural(key, $"spans overlap or go backwards at {k.Start}-{k.End}"); bailed = true; break; }
                prevEnd = k.End;
                if (k.InputSpan is { } sp)
                {
                    withInput++;
                    if (sp.Start < 0 || sp.End > text.Length || sp.Start > sp.End)
                    { Structural(key, $"inputSpan out of range: {sp.Start}-{sp.End} of {text.Length}"); bailed = true; break; }
                    if (t.Tokens.Count > 1 && sp.Start == 0 && sp.End == text.Length)
                    { Structural(key, "a token spans the WHOLE input (#1420)"); bailed = true; break; }
                }
            }
            // ⚠ ONLY WHEN THE TOKEN LOOP RAN TO COMPLETION. After a `break` this count covers the tokens
            // inspected so far, so it would report "inputSpan on only 4 of 10" for a row that actually
            // tripped an overlap at token 5 — a second failure for one defect, naming a shape the corpus
            // has zero instances of.
            if (!bailed && withInput != 0 && withInput != t.Tokens.Count)
                Structural(key, $"inputSpan on only {withInput} of {t.Tokens.Count} tokens");
        }
        catch (Exception e) { got = "THREW"; if (want != "THREW") Report($"threw: {e.GetType().Name}", key, want, got); }

        if (got != want && !(got == "THREW" && want == "THREW"))
        {
            if (got != "THREW") Report("trace differs", key, want, got);
        }
    }
}

Console.WriteLine();
Console.WriteLine($"{langs.Count} languages, {rows} rows compared ({walked} golden rows walked)");

// ⚠ ZERO ROWS IS A FAILURE, NOT A PASS — the same rule `check-goldens.mts` states for an empty golden.
// Every row is skipped when the dump does not cover it, so a STALE `.trace-parity/ts.tsv` from an
// earlier subset dump, a dump written for a code that does not exist, or goldens regenerated since the
// dump, all printed "traces identical across ports" and exited 0. A success signal that is also what
// the no-op prints is worse than no gate, because it is believed.
if (rows == 0)
{
    Console.Error.WriteLine("⚠ NOTHING WAS COMPARED. The dump covers none of the goldens walked — it is stale,");
    Console.Error.WriteLine("  empty, or for other codes. Rerun `npm run dump:traces`.");
    return 2;
}
// ⚠ AND A PARTIAL DUMP IS A FAILURE TOO, unless a subset was asked for explicitly. Silently comparing
// 200 of 36,495 rows and reporting success is the same defect one step in.
if (only.Count == 0 && rows != walked)
{
    Console.Error.WriteLine($"⚠ THE DUMP IS PARTIAL: {rows} of {walked} golden rows are covered.");
    Console.Error.WriteLine("  Rerun `npm run dump:traces`, or pass the same [codes…] to both sides.");
    return 2;
}

Console.WriteLine(differ == 0 && structural == 0
    ? "traces identical across ports, and every span is in range and ordered"
    : $"⚠ {differ} rows differ between ports, {structural} structural failures");
return differ == 0 && structural == 0 ? 0 : 1;
