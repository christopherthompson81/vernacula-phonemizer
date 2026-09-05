/**
 * Load a `key<TAB>value` TSV into a Map, and its value-less counterpart for membership word-lists;
 * blank and `#`-comment lines are skipped.
 * Ported from src/core/loadTsv.ts — see that file for the rationale.
 *
 * C# PORT NOTE: the TS resolves data beside the calling module via `import.meta.url`. Here the caller
 * passes `moduleDir`, its directory RELATIVE TO the repo's `src/` (e.g. "core", "languages/amharic"),
 * and the file is resolved through DataPath — the data files are not ported.
 */
namespace Vernacula.Phonemizer.Core;

public static class LoadTsv
{
    private static readonly JsRe LineSplit = JsRegex.Compile("\\r?\\n");

    /** Non-blank, non-`#`-comment lines of a data file; `optional` → [] on a missing file. Shared by
     *  LoadTsvMap and LoadLines so both parse lines identically. */
    private static List<string> ReadDataLines(string moduleDir, string filename, bool optional)
    {
        // Optionality is decided HERE, not in DataPath, which throws on a missing file by design.
        var path = DataPath.ResolveAllowMissing(moduleDir + "/" + filename);
        string text;
        try
        {
            text = File.ReadAllText(path);
        }
        catch (IOException) when (optional)
        {
            return new List<string>();
        }
        catch (SystemException e) when (optional && e is FileNotFoundException or DirectoryNotFoundException or UnauthorizedAccessException)
        {
            return new List<string>();
        }
        var lines = new List<string>();
        foreach (var l in LineSplit.Re.Split(text))
            if (l != "" && !l.StartsWith("#", StringComparison.Ordinal))
                lines.Add(l);
        return lines;
    }

    /// <summary>Insertion-ordered like a JS Map (C# Dictionary preserves insertion order as long as nothing
    /// is removed, which holds here — noted because some consumers iterate).</summary>
    public static Dictionary<string, string> LoadTsvMap(string moduleDir, string filename, bool optional = false) =>
        LoadTsvMap<string>(moduleDir, filename, (v, _) => v, optional);

    /// <summary>⚠ <c>fold</c> MAKES A LEXICON REACHABLE THROUGH ITS OWN ENGINE'S NATIVISER (#1068). An engine
    /// folds a word to its declared inventory BEFORE looking it up, so a headword spelled with a letter the
    /// fold rewrites can never be matched from Text() — the word silently takes the OOV path and gets a
    /// plausible wrong reading. Passing the engine's own nativiser adds the folded spelling as an ALIAS for
    /// the same value.
    /// <para>⚠ AN UNFOLDED KEY ALREADY IN THE FILE WINS, ALWAYS — an alias is written only into a FREE slot,
    /// so no LEXICON-RESOLVED reading can change. ⚠ That is not "no golden moves": a free slot is free
    /// because the word was an OOV miss, and the fallback rule's answer is in the goldens. See the TS.</para>
    /// <para>⚠ AND THE ITERATION IS OVER THE FILE'S ROWS IN ORDER, which is why the rows are collected into a
    /// list first. Two keys can fold onto the same free slot, and "first wins" only means anything if the
    /// order is the file's. A Dictionary happens to preserve insertion order here, but relying on that for a
    /// tie-break would be relying on an implementation detail the TS side does not share.</para>
    /// See docs/investigations/normalization/nativiser_lexicon_seam_investigation.md and test/lexicon-reachability.</summary>
    public static Dictionary<string, V> LoadTsvMap<V>(
        string moduleDir,
        string filename,
        Func<string, string, V?> parse,
        bool optional = false,
        Func<string, string>? fold = null) where V : class
    {
        var map = new Dictionary<string, V>();
        var rows = new List<(string Key, V Value)>();
        foreach (var line in ReadDataLines(moduleDir, filename, optional))
        {
            var tab = line.IndexOf('\t');
            if (tab <= 0) continue;
            var v = parse(line[(tab + 1)..], line[..tab]);
            if (v is not null) { map[line[..tab]] = v; rows.Add((line[..tab], v)); }
        }
        if (fold is not null)
            foreach (var (k, v) in rows)
            {
                var f = fold(k);
                if (f != k && !map.ContainsKey(f)) map[f] = v;
            }
        return map;
    }

    /// <summary>Value-type variant of <see cref="LoadTsvMap{V}(string,string,Func{string,string,V},bool)"/>:
    /// the TS `Number` parses become `double?` here, and a null skips the row as `undefined` does there.
    /// <para>⚠ <c>fold</c> CARRIES THE SAME CONTRACT AS THE REFERENCE-TYPE OVERLOAD — unfolded key wins, and
    /// the alias pass iterates the FILE'S ROWS IN ORDER rather than the dictionary. See that overload.</para></summary>
    public static Dictionary<string, V> LoadTsvMapV<V>(
        string moduleDir,
        string filename,
        Func<string, string, V?> parse,
        bool optional = false,
        Func<string, string>? fold = null) where V : struct
    {
        var map = new Dictionary<string, V>();
        var rows = new List<(string Key, V Value)>();
        foreach (var line in ReadDataLines(moduleDir, filename, optional))
        {
            var tab = line.IndexOf('\t');
            if (tab <= 0) continue;
            var v = parse(line[(tab + 1)..], line[..tab]);
            if (v.HasValue) { map[line[..tab]] = v.Value; rows.Add((line[..tab], v.Value)); }
        }
        if (fold is not null)
            foreach (var (k, v) in rows)
            {
                var f = fold(k);
                if (f != k && !map.ContainsKey(f)) map[f] = v;
            }
        return map;
    }

    /** One token per line, for word-lists that back a HashSet. */
    public static List<string> LoadLines(string moduleDir, string filename, bool optional = false) =>
        ReadDataLines(moduleDir, filename, optional);
}
