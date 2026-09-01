/**
 * Loader for the shared native-abugida phonology tables (`phonology.jsonc`, beside this module).
 * Universal, output-affecting DATA (place-of-articulation + homorganic nasal) — see that file's header
 * for the data-vs-code split. Memoized: the file is read once.
 */
import { parseJsonc } from "./jsonc.ts";
import { dataFile } from "./dataPath.ts";
import { readDataText } from "./dataSource.ts";

/**
 * Universal (not language-specific) phonology tables, loaded from data/native/_shared/phonology.jsonc.
 * These decide WHICH phoneme is produced (the anusvara homorganic nasal), so they are declarative data;
 * the classification LOGIC (longest-prefix match over the ties/dentals) lives in the engine (abugidaG2p).
 */
export interface Phonology {
    /** IPA onset → place of articulation (matched by longest key prefix). */
    placeOfArticulation: Record<string, string>;
    /** place of articulation → homorganic nasal. */
    homorganicNasal: Record<string, string>;
}

const SHARED_KEY = dataFile(import.meta.url, "phonology.jsonc"); // it sits beside this module

let cached: Phonology | undefined;

/** Read + parse the shared phonology tables (JSONC — strip comments). Memoized after first call. */
export function loadSharedPhonology(): Phonology {
    if (cached === undefined) {
        cached = parseJsonc<Phonology>(readDataText(SHARED_KEY));
    }
    return cached;
}
