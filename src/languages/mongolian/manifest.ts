/**
 * Loads the Mongolian data manifest (mongolian.jsonc) once at module init and exposes it typed. Holds the
 * hand-authored letter→IPA tables (single vowels, doubled long vowels, diphthongs, consonants), the back-harmony
 * trigger set, and clause punctuation. The ALGORITHMS that read them stay in code: the greedy Cyrillic scan +
 * harmony (g2p.ts) and the deep-orthography reduction/deletion + final devoicing (mongolian.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface MongolianManifest {
    language: string;
    name: string;
    script: readonly string[];
    vowels: Record<string, string>;
    longVowels: Record<string, string>;
    diphthongs: Record<string, string>;
    consonants: Record<string, string>;
    backVowels: string;
    /** Cyrillic letter → its NAME, for `core/initialisms.ts` (see the sourcing note in mongolian.jsonc). */
    letterNames: Record<string, string>;
    /** Acronyms read letter-by-letter although their lowercase form is a readable word. Empty; see the manifest. */
    acronymLetters: readonly string[];
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        unitsAttr: string[];
        tens: string[];
        tensAttr: string[];
        hundred: string;
        hundredAttr: string;
        thousand: string;
        thousandAttr: string;
        million: string;
        billion: string;
    };
}

/** The consolidated hand-authored Mongolian data tables (see mongolian.jsonc). */
export const MANIFEST = loadManifest<MongolianManifest>(import.meta.url, "mongolian.jsonc");
