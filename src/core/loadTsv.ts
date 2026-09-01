/**
 * Load a `key<TAB>value` TSV beside the calling module into a Map, skipping blank and `#`-comment lines.
 * Collapses the read + split + comment-skip + tab-split boilerplate that the per-language dictionary
 * loaders (stress / tone / rhyme / lexicon tables) otherwise repeat.
 *
 *   const STRESS = loadTsvMap(import.meta.url, "stress.tsv", Number, { optional: true });
 *
 * `parse(value, key)` maps the raw post-tab string to the stored value (default: the raw string). Returning
 * `undefined` skips the row (for loaders that filter, e.g. reject non-numeric values). `optional: true` makes a
 * missing file yield an empty Map instead of throwing (for lexicons that may be absent).
 */
import { dataFile } from "./dataPath.ts";
import { readDataText } from "./dataSource.ts";

/** Read a data file beside `metaUrl`, returning its non-blank, non-`#`-comment lines. `optional` → [] on a
 *  missing file (else rethrows). Shared by loadTsvMap and loadLines so both parse lines identically. */
function readDataLines(
    metaUrl: string,
    filename: string,
    optional: boolean,
): string[] {
    let text: string;
    try {
        text = readDataText(dataFile(metaUrl, filename));
    } catch (err) {
        if (optional) return [];
        throw err;
    }
    return text.split(/\r?\n/).filter((l) => l !== "" && !l.startsWith("#"));
}

/**
 * ⚠ `fold` MAKES A LEXICON REACHABLE THROUGH ITS OWN ENGINE'S NATIVISER (#1068). An engine folds a word to
 * its declared inventory BEFORE looking it up, so a headword spelled with a letter the fold rewrites can
 * never be matched from `text()` — it does not throw and it does not drop a phone, the word just takes the
 * OOV path and gets a plausible wrong reading. Passing the engine's own `nat` here adds the folded spelling
 * as an ALIAS for the same value, which is what closes the gap. Measured in
 * `docs/investigations/nativiser_lexicon_seam_investigation.md`; guarded by `test/lexicon-reachability`.
 *
 * ⚠ AN UNFOLDED KEY ALREADY IN THE FILE WINS, ALWAYS. An alias is written only into a FREE slot, so no
 * reading the engine already resolves THROUGH THE LEXICON can change. Without this, Slovene alone would
 * have 99 keys where the two spellings disagree about which nucleus is stressed (`bləste`=0 against
 * `bleste`=1) and the loser would be decided by file order.
 *
 * ⚠ …BUT THAT IS NOT "THE GOLDENS CANNOT MOVE", AND #1072 SAID SO AND WAS WRONG. A free slot is free
 * because the word was an OOV MISS, and an OOV miss is not silence — it is the engine's fallback rule,
 * which the goldens record. Slovene's 684 orphan aliases are 680 new headwords, and eight of `sl.tsv`'s
 * 200 rows moved from the penultimate fallback onto the lexicon (`umrl` → *umˈərl* where the fallback said
 * *ˈumərl*). No gate caught it because sl was unported at the time, so nothing ran its golden; the sl port
 * regenerated it. The invariant to state is about LEXICON-RESOLVED readings, not about goldens.
 *
 * ⚠ AND THE RAW KEY IS KEPT, not replaced. Aliasing is additive: some callers (evals, `phonemizeWord` used
 * bare) look words up without nativising first, and dropping the original spelling would break them for no
 * gain — the alias is what the shipped path needs, not the absence of the original.
 *
 * ⚠ ITERATION IS OVER THE FILE'S ROWS IN ORDER, not over the Map. Two different keys can fold onto the same
 * free slot, so "first one wins" must mean first IN THE FILE — a Map happens to preserve insertion order and
 * .NET's Dictionary does not, and a port that iterated the dictionary would silently pick a different winner.
 */
export function loadTsvMap<V = string>(
    metaUrl: string,
    filename: string,
    parse: (value: string, key: string) => V | undefined = (v) =>
        v as unknown as V,
    opts: { optional?: boolean; fold?: (key: string) => string } = {},
): Map<string, V> {
    const map = new Map<string, V>();
    const rows: Array<[string, V]> = [];
    for (const line of readDataLines(metaUrl, filename, opts.optional ?? false)) {
        const tab = line.indexOf("\t");
        if (tab <= 0) continue;
        const v = parse(line.slice(tab + 1), line.slice(0, tab));
        if (v !== undefined) {
            map.set(line.slice(0, tab), v);
            rows.push([line.slice(0, tab), v]);
        }
    }
    if (opts.fold) {
        for (const [k, v] of rows) {
            const f = opts.fold(k);
            if (f !== k && !map.has(f)) map.set(f, v);
        }
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
