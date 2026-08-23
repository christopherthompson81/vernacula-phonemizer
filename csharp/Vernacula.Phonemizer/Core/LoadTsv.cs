/**
 * Load a `key<TAB>value` TSV beside the calling module into a Map, skipping blank and `#`-comment lines.
 * Collapses the readFileSync + split + comment-skip + tab-split boilerplate that the per-language dictionary
 * loaders (stress / tone / rhyme / lexicon tables) otherwise repeat.
 *
 *   const STRESS = loadTsvMap(import.meta.url, "stress.tsv", Number, { optional: true });
 *
 * `parse(value, key)` maps the raw post-tab string to the stored value (default: the raw string). Returning
 * `undefined` skips the row (for loaders that filter, e.g. reject non-numeric values). `optional: true` makes a
 * missing file yield an empty Map instead of throwing (for lexicons that may be absent).
 *
 * C# PORT NOTE: the TS resolves data beside the calling module via `import.meta.url`. Here the caller passes
 * `moduleDir`, the calling module's directory RELATIVE TO the repo's `src/` (e.g. "core",
 * "languages/amharic"), and the file is resolved through DataPath — the data files are not ported
 * (PORTING.md: one source of truth, zero drift).
 */

namespace Vernacula.Phonemizer.Core;

public static class LoadTsv
{
    private static readonly JsRe LineSplit = JsRegex.Compile("\\r?\\n");

    /** Read a data file beside `moduleDir` (relative to src/), returning its non-blank, non-`#`-comment lines.
     *  `optional` → [] on a missing file (else rethrows). Shared by LoadTsvMap and LoadLines so both parse
     *  lines identically. */
    private static List<string> ReadDataLines(string moduleDir, string filename, bool optional)
    {
        var path = DataPath.Resolve(moduleDir + "/" + filename);
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

    public static Dictionary<string, V> LoadTsvMap<V>(
        string moduleDir,
        string filename,
        Func<string, string, V?> parse,
        bool optional = false) where V : class
    {
        var map = new Dictionary<string, V>();
        foreach (var line in ReadDataLines(moduleDir, filename, optional))
        {
            var tab = line.IndexOf('\t');
            if (tab <= 0) continue;
            var v = parse(line[(tab + 1)..], line[..tab]);
            if (v is not null) map[line[..tab]] = v;
        }
        return map;
    }

    /// <summary>Value-type variant of <see cref="LoadTsvMap{V}(string,string,Func{string,string,V},bool)"/> —
    /// e.g. `Number` parses in the TS become `double?` parses here; a null skips the row.</summary>
    public static Dictionary<string, V> LoadTsvMapV<V>(
        string moduleDir,
        string filename,
        Func<string, string, V?> parse,
        bool optional = false) where V : struct
    {
        var map = new Dictionary<string, V>();
        foreach (var line in ReadDataLines(moduleDir, filename, optional))
        {
            var tab = line.IndexOf('\t');
            if (tab <= 0) continue;
            var v = parse(line[(tab + 1)..], line[..tab]);
            if (v.HasValue) map[line[..tab]] = v.Value;
        }
        return map;
    }

    /**
     * Load a one-token-per-line membership list beside the calling module, skipping blank and `#`-comment lines.
     * The value-less counterpart of loadTsvMap, for word-lists that back a Set (Japanese adverbs, Thai seg-words).
     *
     *   const ADVERBS = new Set(loadLines(import.meta.url, "adverbs.txt"));
     *
     * `optional: true` makes a missing file yield [] instead of throwing.
     */
    public static List<string> LoadLines(string moduleDir, string filename, bool optional = false) =>
        ReadDataLines(moduleDir, filename, optional);
}
