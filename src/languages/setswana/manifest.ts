/**
 * Loads the Setswana data manifest (setswana.jsonc) once at module init and exposes it typed. Holds the
 * context-free hand-authored DATA: the orthography→IPA grapheme table (dorsal aspirates, lateral affricates, the
 * ⟨g⟩→x divergence) + clause punctuation. The ALGORITHM (the greedy longest-match scan) stays in code.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface SetswanaManifest {
    language: string;
    name: string;
    script: readonly string[];
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        zero: string;
        units: string[]; // 1..9 (bo- counting series); index 0 unused
        ten: string;
        tensWord: string; // masome
        mult: string[]; // 2..9 tens/hundreds multiplier (ma- / participial -ang)
        hundred: string;
        hundredsWord: string; // makgolo
        thousand: string;
        thousandsWord: string; // dikete
        diMult: string[]; // 2..9 thousands multiplier (tse- / di- series)
        and: string; // le
        of: string; // a
        these: string; // tse
    };
}

/** The consolidated hand-authored Setswana data tables (see setswana.jsonc). */
export const MANIFEST = loadManifest<SetswanaManifest>(import.meta.url, "setswana.jsonc");

// Grapheme keys sorted LENGTH DESC so the greedy scan tries trigraphs (tšh, tsh, tlh) before digraphs before singles.
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);
