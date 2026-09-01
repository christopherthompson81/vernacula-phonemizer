/**
 * Load a per-language JSONC data manifest relative to the calling module. Collapses the read +
 * path-resolution + parseJsonc boilerplate that every src/languages/<lang>/manifest.ts otherwise repeats.
 * Pass `import.meta.url` and the manifest filename; the file is resolved beside the caller and parsed once.
 *
 *   export const MANIFEST = loadManifest<XManifest>(import.meta.url, "x.jsonc");
 */
import { dataFile } from "./dataPath.ts";
import { readDataText } from "./dataSource.ts";
import { parseJsonc } from "./jsonc.ts";

export function loadManifest<T>(metaUrl: string, filename: string): T {
    return parseJsonc<T>(readDataText(dataFile(metaUrl, filename)));
}

/**
 * Load a plain-JSON file beside the calling module — like loadManifest but with a direct JSON.parse and no
 * JSONC comment-stripping. Use for large generated models (e.g. a multi-MB g2p model) where the character-by-
 * character JSONC scan would be wasted work.
 */
export function loadJson<T>(metaUrl: string, filename: string): T {
    return JSON.parse(readDataText(dataFile(metaUrl, filename))) as T;
}
