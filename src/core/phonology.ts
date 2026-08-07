/**
 * Loader for the shared native-abugida phonology tables (`phonology.jsonc`, beside this module).
 * Universal, output-affecting DATA (place-of-articulation + homorganic nasal) — see that file's header
 * for the data-vs-code split. Memoized: the file is read once.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseJsonc } from "./jsonc.ts";

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

const SHARED_DIR = dirname(fileURLToPath(import.meta.url)); // phonology.jsonc sits beside this module

let cached: Phonology | undefined;

/** Read + parse the shared phonology tables (JSONC — strip comments). Memoized after first call. */
export function loadSharedPhonology(): Phonology {
    if (cached === undefined) {
        cached = parseJsonc<Phonology>(readFileSync(join(SHARED_DIR, "phonology.jsonc"), "utf8"));
    }
    return cached;
}
