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
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Read a data file beside `metaUrl`, returning its non-blank, non-`#`-comment lines. `optional` → [] on a
 *  missing file (else rethrows). Shared by loadTsvMap and loadLines so both parse lines identically. */
function readDataLines(
    metaUrl: string,
    filename: string,
    optional: boolean,
): string[] {
    const path = join(dirname(fileURLToPath(metaUrl)), filename);
    let text: string;
    try {
        text = readFileSync(path, "utf8");
    } catch (err) {
        if (optional) return [];
        throw err;
    }
    return text.split(/\r?\n/).filter((l) => l !== "" && !l.startsWith("#"));
}

export function loadTsvMap<V = string>(
    metaUrl: string,
    filename: string,
    parse: (value: string, key: string) => V | undefined = (v) =>
        v as unknown as V,
    opts: { optional?: boolean } = {},
): Map<string, V> {
    const map = new Map<string, V>();
    for (const line of readDataLines(metaUrl, filename, opts.optional ?? false)) {
        const tab = line.indexOf("\t");
        if (tab <= 0) continue;
        const v = parse(line.slice(tab + 1), line.slice(0, tab));
        if (v !== undefined) map.set(line.slice(0, tab), v);
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
export function loadLines(
    metaUrl: string,
    filename: string,
    opts: { optional?: boolean } = {},
): string[] {
    return readDataLines(metaUrl, filename, opts.optional ?? false);
}
