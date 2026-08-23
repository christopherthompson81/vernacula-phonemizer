/**
 * Load a per-language JSONC data manifest relative to the calling module. Collapses the readFileSync +
 * path-resolution + parseJsonc boilerplate that every src/languages/<lang>/manifest.ts otherwise repeats.
 * Pass `import.meta.url` and the manifest filename; the file is resolved beside the caller and parsed once.
 *
 *   export const MANIFEST = loadManifest<XManifest>(import.meta.url, "x.jsonc");
 *
 * C# PORT NOTE: `import.meta.url` becomes `moduleDir`, the caller's directory relative to src/ — see
 * LoadTsv.cs for the convention.
 */
using System.Text.Json;

namespace Vernacula.Phonemizer.Core;

public static class LoadManifest
{
    public static T Load<T>(string moduleDir, string filename) =>
        Jsonc.ParseJsonc<T>(File.ReadAllText(DataPath.Resolve(moduleDir + "/" + filename)));

    /**
     * Load a plain-JSON file beside the calling module — like loadManifest but with a direct JSON.parse and no
     * JSONC comment-stripping. Use for large generated models (e.g. a multi-MB g2p model) where the character-by-
     * character JSONC scan would be wasted work.
     */
    public static T LoadJson<T>(string moduleDir, string filename) =>
        JsonSerializer.Deserialize<T>(File.ReadAllText(DataPath.Resolve(moduleDir + "/" + filename)), Jsonc.JsonOpts)
        ?? throw new JsonException("JSON document deserialized to null");
}
