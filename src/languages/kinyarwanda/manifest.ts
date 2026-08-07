/**
 * Loads the Kinyarwanda data manifest (kinyarwanda.jsonc) once at module init and exposes it typed. Holds the
 * context-free hand-authored DATA: the orthography→IPA grapheme table (palatals, prenasals, length) + clause
 * punctuation + number words. The ALGORITHMS (the greedy longest-match scan, the cardinal compositor) stay in code
 * (kinyarwanda.ts / numbers.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

/**
 * The Rwanda-Rundi cardinal word table — one instance per language (rw / rn), identical shape, because the two
 * share the compositor in numbers.ts. Each magnitude carries its OWN multiplier series: Kinyarwanda/Kirundi
 * numerals 1–7 take the noun-class concord of what they count (8/9/10 are invariable), so mirongo (tens),
 * magana (hundreds) and ibihumbi (thousands) each select a different prefix series.
 */
export interface RwandaRundiNumbers {
    units: string[]; // 0–9, bare-numeral citation form
    ten: string; // 10
    tens: string[]; // full words for 20–90 at indices 2–9 (indices 0/1 unused)
    hundred: string; // 100
    hundreds: string; // plural "hundreds" noun
    hundredsMul: string[]; // class-6 multiplier at indices 2–9
    thousand: string; // 1000
    thousands: string; // plural "thousands" noun
    thousandsMul: string[]; // class-8 multiplier at indices 2–9
    million: string; // 10⁶
    and: string; // the "na" connector
}

export interface KinyarwandaManifest {
    language: string;
    name: string;
    script: readonly string[];
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: RwandaRundiNumbers;
}

/** The consolidated hand-authored Kinyarwanda data tables (see kinyarwanda.jsonc). */
export const MANIFEST = loadManifest<KinyarwandaManifest>(import.meta.url, "kinyarwanda.jsonc");

// Grapheme keys sorted LENGTH DESC so the greedy scan tries trigraphs (shy) before digraphs before singles.
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);
