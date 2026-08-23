/**
 * Resolve a module's data file inside the repo-root `data/` tree — the SHARED asset store.
 * (C# mirror of src/core/dataPath.ts.)
 *
 * ⚠ DATA IS OWNED BY NO ENGINE. The TypeScript engine and the C# port (csharp/) load the same 317
 * files by the same keys: a module at `src/languages/thai/` asking for `syllables.tsv` gets
 * `data/languages/thai/syllables.tsv`, and the C# `DataPath.Resolve("languages/thai/syllables.tsv")`
 * returns the identical file. Assets living beside the TS modules made the TS engine their implicit
 * owner and every other consumer a path-guesser into someone else's source tree.
 *
 * The key space is the module-relative path WITHOUT any src/ or data/ prefix — identical to the TS
 * side, where the mapping is mechanical from `import.meta.url` (the module's directory under `src/`
 * is mirrored under `data/`).
 *
 * `VERNACULA_DATA_DIR` overrides the root for deployments that ship assets elsewhere.
 */
namespace Vernacula.Phonemizer.Core;

public static class DataPath
{
    private static string? _root;
    private static readonly object Gate = new();

    /// <summary>The `data/` root. Resolution order: VERNACULA_DATA_DIR if set; else walk up from
    /// AppContext.BaseDirectory to the first directory containing a `data/` directory that itself
    /// contains `core/phonology.jsonc` (the existence check avoids matching an unrelated data/).</summary>
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

    /// <summary>Resolve a data file by its module-relative key (e.g. "languages/thai/syllables.tsv",
    /// "core/phonology.jsonc" — no src/ or data/ prefix; forward slashes fine on every OS).
    /// Throws with the key and the attempted root when the file is absent — optionality is the
    /// CALLER's decision (LoadTsv's `optional`), which probes existence before calling this.</summary>
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
    /// that handle absence themselves (TS `loadTsv`'s `optional: true`).</summary>
    public static string ResolveAllowMissing(string relative) =>
        Path.Combine(Root(), relative.Replace('/', Path.DirectorySeparatorChar));
}
