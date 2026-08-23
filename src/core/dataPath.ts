/**
 * Resolve a module's data file inside the repo-root `data/` tree — the SHARED asset store.
 *
 * ⚠ DATA IS OWNED BY NO ENGINE. The TypeScript engine and the C# port (csharp/) load the same 317
 * files by the same keys: a module at `src/languages/thai/` asking for `syllables.tsv` gets
 * `data/languages/thai/syllables.tsv`, and the C# `DataPath.Resolve("languages/thai/syllables.tsv")`
 * returns the identical file. Assets living beside the TS modules made the TS engine their implicit
 * owner and every other consumer a path-guesser into someone else's source tree.
 *
 * The mapping is mechanical: the module's directory under `src/` is mirrored under `data/`. Call
 * sites keep passing `import.meta.url` exactly as before — this is the single choke point that
 * redirects them, so the 264 modules that load data did not change when the files moved.
 *
 * `VERNACULA_DATA_DIR` overrides the root for deployments that ship assets elsewhere.
 */
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

export function dataFile(metaUrl: string, filename: string): string {
    const moduleDir = dirname(fileURLToPath(metaUrl));
    const marker = `${sep}src${sep}`;
    const i = moduleDir.lastIndexOf(marker);
    // ⚠ A caller OUTSIDE src/ (a test, a tool) gets plain module-relative resolution — the pre-move
    //   behaviour. Only engine modules are mirrored; an external caller names the data path itself.
    if (i < 0) return join(moduleDir, filename);
    const rel = moduleDir.slice(i + marker.length);
    const root = process.env.VERNACULA_DATA_DIR ?? join(moduleDir.slice(0, i), "data");
    return join(root, rel, filename);
}

/** The module's whole data DIRECTORY under `data/` — for the taggers that join several files. */
export function dataDir(metaUrl: string): string {
    return dirname(dataFile(metaUrl, "x"));
}
