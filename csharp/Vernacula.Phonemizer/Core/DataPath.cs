// Data files (.tsv, .jsonc, .txt, .onnx — 150 MB) are NOT ported; they are loaded at runtime from the
// repo's `src/` tree (PORTING.md: one source of truth, zero drift). The TS modules resolve data beside
// themselves via `import.meta.url`; the C# port resolves the same files via this class instead, keyed by
// the path RELATIVE TO `src/` (e.g. DataPath.Resolve("languages/thai/seg-words.txt")).

namespace Vernacula.Phonemizer.Core;

public static class DataPath
{
    private static string? _srcRoot;
    private static readonly object Gate = new();

    /// <summary>The repo's `src/` directory. Resolution order: the VERNACULA_DATA_DIR environment
    /// variable if set (pointing at the repo root or its src/), else walk up from
    /// AppContext.BaseDirectory looking for a directory containing src/registry.ts.</summary>
    public static string SrcRoot()
    {
        lock (Gate)
        {
            if (_srcRoot is not null) return _srcRoot;

            var env = Environment.GetEnvironmentVariable("VERNACULA_DATA_DIR");
            if (!string.IsNullOrEmpty(env))
            {
                // Accept either the repo root (containing src/registry.ts) or the src/ directory itself.
                if (File.Exists(Path.Combine(env, "src", "registry.ts")))
                    return _srcRoot = Path.Combine(env, "src");
                if (File.Exists(Path.Combine(env, "registry.ts")))
                    return _srcRoot = env;
                throw new DirectoryNotFoundException(
                    $"VERNACULA_DATA_DIR is set to \"{env}\" but neither \"{Path.Combine(env, "src", "registry.ts")}\" " +
                    $"nor \"{Path.Combine(env, "registry.ts")}\" exists. Point it at the vernacula-phonemizer repo root (or its src/).");
            }

            for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
            {
                if (File.Exists(Path.Combine(dir.FullName, "src", "registry.ts")))
                    return _srcRoot = Path.Combine(dir.FullName, "src");
            }

            throw new DirectoryNotFoundException(
                "Could not locate the vernacula-phonemizer data tree: no ancestor of " +
                $"\"{AppContext.BaseDirectory}\" contains src/registry.ts, and VERNACULA_DATA_DIR is not set. " +
                "Set VERNACULA_DATA_DIR to the repo root, or run from inside the repo.");
        }
    }

    /// <summary>Resolve a data file by its path relative to the repo's `src/` directory
    /// (forward slashes fine on every OS).</summary>
    public static string Resolve(string relative) =>
        Path.Combine(SrcRoot(), relative.Replace('/', Path.DirectorySeparatorChar));
}
