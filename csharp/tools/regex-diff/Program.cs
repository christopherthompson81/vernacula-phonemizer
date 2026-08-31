// JS↔.NET differential harness for Core/JsRegex — the port's largest untested assumption.
//
// ⚠ WHY THIS EXISTS. ~7,000 patterns route through JsRegex.Compile, and a dialect mismatch there is
// SILENT: the pattern compiles, matches slightly different text, and the damage surfaces later as a
// wrong phoneme with nothing pointing back at the regex. Node's answers for 2,741 distinct patterns
// across a probe set chosen for the DIALECT GAP (ASCII vs Unicode digits, non-Latin scripts, word
// boundaries) are recorded in csharp/regex-corpus.jsonl; this replays them and diffs.
//
// A pattern JsRegex REFUSES is reported separately from one it gets WRONG: refusing is the designed
// behaviour for the unsupported subset (v-flag, astral literals) and is a loud, safe failure. Getting
// a different answer than Node is the actual bug class.
//
//   dotnet run --project csharp/tools/regex-diff
using System.Text.Json;
using Vernacula.Phonemizer.Core;

var path = args.FirstOrDefault(a => !a.StartsWith('-')) ?? "csharp/regex-corpus.jsonl";
if (!File.Exists(path)) { Console.Error.WriteLine($"corpus not found: {path}"); return 2; }

int ok = 0, mismatch = 0, refused = 0, threw = 0;
var examples = new List<string>();
var refusedPatterns = new List<string>();

foreach (var line in File.ReadLines(path))
{
    if (string.IsNullOrWhiteSpace(line)) continue;
    var doc = JsonDocument.Parse(line).RootElement;
    var pattern = doc.GetProperty("pattern").GetString()!;
    var flags = doc.GetProperty("flags").GetString()!;
    var file = doc.GetProperty("file").GetString()!;

    JsRe re;
    try { re = JsRegex.Compile(pattern, flags); }
    catch (NotSupportedException e) { refused++; if (refusedPatterns.Count < 10) refusedPatterns.Add($"  {pattern}  [{flags}]  — {e.Message}"); continue; }
    catch (Exception e) { threw++; if (examples.Count < 10) examples.Add($"  THREW {e.GetType().Name} compiling /{pattern}/{flags}\n    {file}"); continue; }

    bool global = re.Global;
    foreach (var pair in doc.GetProperty("matches").EnumerateArray())
    {
        // ⚠ THE SUBJECT IS DECODED TOO (#1227). It used to be read raw, which is why no probe could
        // carry a lone surrogate and why the `u`-mode negated-class divergence was invisible here.
        var input = Decode(pair[0].GetString()!);
        var want = pair[1].EnumerateArray().Select(x => Decode(x.GetString()!)).ToArray();
        string[] got;
        try
        {
            got = global
                ? re.Matches(input).Select(m => m.Value).ToArray()
                : new[] { re.Match(input) is { Success: true } m ? m.Value : "\u0000null" };
        }
        catch (Exception e) { threw++; if (examples.Count < 10) examples.Add($"  THREW {e.GetType().Name} matching /{pattern}/{flags} on {Show(input)}"); continue; }

        if (want.SequenceEqual(got)) { ok++; continue; }
        mismatch++;
        if (examples.Count < 10)
            examples.Add($"  /{pattern}/{flags}\n    input {Show(input)}\n    node  [{string.Join(", ", want.Select(Show))}]\n    .NET  [{string.Join(", ", got.Select(Show))}]\n    {file}");
    }
}

Console.WriteLine($"{ok} probe results identical, {mismatch} DIFFER, {threw} threw");
Console.WriteLine($"{refused} patterns refused by JsRegex (designed behaviour for the unsupported subset)");
foreach (var r in refusedPatterns) Console.WriteLine(r);
if (examples.Count > 0) { Console.WriteLine("\nmismatches:"); foreach (var e in examples) Console.WriteLine(e); }
return mismatch + threw == 0 ? 0 : 1;

// Undo the extractor's lone-surrogate sentinel (\0S + 4 hex): JSON cannot carry an unpaired
// surrogate, and a non-u pattern matching one is a result worth diffing, not discarding.
static string Decode(string s) =>
    s.Contains("\u0000S", StringComparison.Ordinal)
        ? System.Text.RegularExpressions.Regex.Replace(s, "\u0000S([0-9a-f]{4})",
            m => ((char)Convert.ToInt32(m.Groups[1].Value, 16)).ToString())
        : s;

static string Show(string s) => s == "\u0000null" ? "(no match)" : "\"" + s.Replace("\n", "\\n").Replace("\t", "\\t") + "\"";
