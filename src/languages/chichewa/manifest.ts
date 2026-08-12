/**
 * Loads the Chichewa data manifest (chichewa.jsonc) once at module init and exposes it typed. Holds the
 * context-free hand-authored DATA: the orthography→IPA grapheme table (implosives, prenasalised clusters,
 * aspirates) + clause punctuation + number words. The ALGORITHM (the greedy longest-match scan) stays in code.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface ChichewaManifest {
    language: string;
    name: string;
    script: readonly string[];
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[]; // bare-numeral citation form (class-8/10 zi- concord)
        classSix: string[]; // multiplier form agreeing with the class-6 magnitudes makumi / mazana
        ten: string;
        tens: string;
        hundred: string;
        hundreds: string;
        thousand: string;
        thousands: string;
        million: string; // class-9 loan (singular), takes the classNineOne concord
        millions: string; // class-6 ma- plural, takes the classSix multiplier series
        billion: string; // short scale, 10⁹ — the sense is measured, see chichewa.jsonc
        billions: string;
        classNineOne: string; // "one" agreeing with a class-9 noun: miliyoni imodzi
        and: string;
    };
}

/** The consolidated hand-authored Chichewa data tables (see chichewa.jsonc). */
export const MANIFEST = loadManifest<ChichewaManifest>(import.meta.url, "chichewa.jsonc");

// Grapheme keys sorted LENGTH DESC so the greedy scan tries trigraphs (ng', nkh, ndz) before digraphs before singles.
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);
