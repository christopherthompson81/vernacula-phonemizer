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

/** One token as `span:inputSpan:ipaSpan`, each `a-b`, empty when the span is absent. */
static string Pair((int Start, int End)? s) => s is null ? "" : $"{s.Value.Start}-{s.Value.End}";

// ── the expected side, read once ────────────────────────────────────────────────────────────────────
var expected = new Dictionary<string, string>(StringComparer.Ordinal);
foreach (var line in File.ReadLines(dump))
{
    if (line.Length == 0) continue;
    var tab = line.IndexOf('\t');
    var tab2 = line.IndexOf('\t', tab + 1);
    expected[line[..tab2]] = line[(tab2 + 1)..];
}

var rows = 0; var differ = 0; var structural = 0; var langs = new SortedSet<string>();
var shown = 0;

void Report(string what, string key, string a, string b)
{
    differ++;
    if (shown++ < 25) Console.WriteLine($"  {key}  {what}\n    ts: {a}\n    cs: {b}");
}

foreach (var path in Directory.EnumerateFiles(goldens, "*.tsv").OrderBy(p => p, StringComparer.Ordinal))
{
    var code = Path.GetFileNameWithoutExtension(path);
    var row = 0;
    foreach (var line in File.ReadLines(path))
    {
        var text = line.Split('\t')[0];
        if (text.Length == 0) continue;
        row++;
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
            foreach (var k in t.Tokens)
            {
                if (k.Start < 0 || k.End > t.Normalized.Length || k.Start > k.End)
                { structural++; Console.WriteLine($"  {key}  span out of range: {k.Start}-{k.End} of {t.Normalized.Length}"); break; }
                if (k.Start < prevEnd)
                { structural++; Console.WriteLine($"  {key}  spans overlap or go backwards at {k.Start}-{k.End}"); break; }
                prevEnd = k.End;
                if (k.InputSpan is { } sp)
                {
                    withInput++;
                    if (sp.Start < 0 || sp.End > text.Length || sp.Start > sp.End)
                    { structural++; Console.WriteLine($"  {key}  inputSpan out of range: {sp.Start}-{sp.End} of {text.Length}"); break; }
                    if (t.Tokens.Count > 1 && sp.Start == 0 && sp.End == text.Length)
                    { structural++; Console.WriteLine($"  {key}  a token spans the WHOLE input (#1420)"); break; }
                }
            }
            if (withInput != 0 && withInput != t.Tokens.Count)
            { structural++; Console.WriteLine($"  {key}  inputSpan on only {withInput} of {t.Tokens.Count} tokens"); }
        }
        catch (Exception e) { got = "THREW"; if (want != "THREW") Report($"threw: {e.GetType().Name}", key, want, got); }

        if (got != want && !(got == "THREW" && want == "THREW"))
        {
            if (got != "THREW") Report("trace differs", key, want, got);
        }
    }
}

Console.WriteLine();
Console.WriteLine($"{langs.Count} languages, {rows} rows compared");
Console.WriteLine(differ == 0 && structural == 0
    ? "traces identical across ports, and every span is in range and ordered"
    : $"⚠ {differ} rows differ between ports, {structural} structural failures");
return differ == 0 && structural == 0 ? 0 : 1;
