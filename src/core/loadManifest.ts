/**
 * Load a per-language JSONC data manifest relative to the calling module. Collapses the readFileSync +
 * path-resolution + parseJsonc boilerplate that every src/languages/<lang>/manifest.ts otherwise repeats.
 * Pass `import.meta.url` and the manifest filename; the file is resolved beside the caller and parsed once.
 *
 *   export const MANIFEST = loadManifest<XManifest>(import.meta.url, "x.jsonc");
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseJsonc } from "./jsonc.ts";

export function loadManifest<T>(metaUrl: string, filename: string): T {
    const dir = dirname(fileURLToPath(metaUrl));
    return parseJsonc<T>(readFileSync(join(dir, filename), "utf8"));
}

/**
 * Load a plain-JSON file beside the calling module — like loadManifest but with a direct JSON.parse and no
 * JSONC comment-stripping. Use for large generated models (e.g. a multi-MB g2p model) where the character-by-
 * character JSONC scan would be wasted work.
 */
export function loadJson<T>(metaUrl: string, filename: string): T {
    const dir = dirname(fileURLToPath(metaUrl));
    return JSON.parse(readFileSync(join(dir, filename), "utf8")) as T;
}
