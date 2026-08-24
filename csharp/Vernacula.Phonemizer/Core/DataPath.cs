/**
 * Resolve a module's data file inside the repo-root `data/` tree — the SHARED asset store.
 * Ported from src/core/dataPath.ts — see that file for the rationale.
 *
 * C# PORT NOTE: the TS derives the key space mechanically from `import.meta.url`; here every caller
 * passes the module directory relative to `src/` ("languages/thai"), so both engines resolve the same
 * files by the same keys. `VERNACULA_DATA_DIR` overrides the root in both.
 */
namespace Vernacula.Phonemizer.Core;

public static class DataPath
{
    private static string? _root;
    private static readonly object Gate = new();

    /// <summary>The `data/` root: VERNACULA_DATA_DIR if set; else the first ancestor of
    /// AppContext.BaseDirectory holding a `data/core/phonology.jsonc` (the file check is what keeps an
    /// unrelated `data/` directory from matching).</summary>
    public static string Root()
    {
        lock (Gate)
        {
            if (_root is not null) return _root;

            var env = Environment.GetEnvironmentVariable("VERNACULA_DATA_DIR");
            if (!string.IsNullOrEmpty(env)) return _root = env;

            for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
            {
                var candidate = Path.Combine(dir.FullName, "data");
                if (File.Exists(Path.Combine(candidate, "core", "phonology.jsonc")))
                    return _root = candidate;
            }

            throw new DirectoryNotFoundException(
                "Could not locate the vernacula-phonemizer data tree: no ancestor of " +
                $"\"{AppContext.BaseDirectory}\" contains data/core/phonology.jsonc, and VERNACULA_DATA_DIR " +
                "is not set. Set VERNACULA_DATA_DIR to the repo's data/ directory, or run from inside the repo.");
        }
    }

    /// <summary>Resolve a data file by its module-relative key ("languages/thai/syllables.tsv"; forward
    /// slashes on every OS). Throws when the file is absent — optionality is the CALLER's decision
    /// (LoadTsv's `optional`), which uses <see cref="ResolveAllowMissing"/> instead.</summary>
    public static string Resolve(string relative)
    {
        var path = Path.Combine(Root(), relative.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(path))
            throw new FileNotFoundException(
                $"vernacula-phonemizer data file \"{relative}\" not found under data root \"{Root()}\" " +
                $"(looked at \"{path}\").", path);
        return path;
    }

    /// <summary>As <see cref="Resolve"/> but WITHOUT the existence check — for optional-file callers
    /// that handle absence themselves.</summary>
    public static string ResolveAllowMissing(string relative) =>
        Path.Combine(Root(), relative.Replace('/', Path.DirectorySeparatorChar));
}
