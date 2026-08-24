/**
 * Load a per-language JSONC data manifest by module directory.
 * Ported from src/core/loadManifest.ts — see that file for the rationale.
 *
 * C# PORT NOTE: the TS passes `import.meta.url`; here the caller passes `moduleDir`, its directory
 * relative to `src/` — see LoadTsv.cs for the convention.
 */
using System.Text.Json;

namespace Vernacula.Phonemizer.Core;

public static class LoadManifest
{
    public static T Load<T>(string moduleDir, string filename) =>
        Jsonc.ParseJsonc<T>(File.ReadAllText(DataPath.Resolve(moduleDir + "/" + filename)));

    /** Plain JSON, no JSONC comment-stripping — for large generated models where the character-by-character
     *  JSONC scan would be wasted work. */
    public static T LoadJson<T>(string moduleDir, string filename) =>
        JsonSerializer.Deserialize<T>(File.ReadAllText(DataPath.Resolve(moduleDir + "/" + filename)), Jsonc.JsonOpts)
        ?? throw new JsonException("JSON document deserialized to null");
}
