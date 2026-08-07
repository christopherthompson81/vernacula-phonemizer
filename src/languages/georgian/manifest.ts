/**
 * Loads the Georgian data manifest (georgian.jsonc) once at module init and exposes it typed. Georgian (Mkhedruli) is
 * an essentially ONE-LETTER-ONE-PHONEME orthography, so the g2p is a greedy longest-match scan (georgian.ts) over the
 * 33-letter grapheme table + ONE context rule (word-final voiced-stop devoicing, in georgian.ts). No digraphs; every
 * table key is a single letter.
 */
import { loadManifest } from "../../core/loadManifest.ts";

/** A Georgian numeral that has two shapes: `bare` (group-final) and `comb` — the final ⟨ი⟩-less form used when a
 *  smaller number FOLLOWS it (ასი → ას ერთი, ათასი → ათას ცხრაას …). */
export interface GeorgianNumeralPair {
    bare: string;
    comb: string;
}

export interface GeorgianManifest {
    language: string;
    name: string;
    script: readonly string[];
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        teens: string[];
        /** Vigesimal score words indexed by the score count 1–4 (20, 40, 60, 80). */
        scores: { bare: string[]; comb: string[] };
        /** Round-hundred words indexed by the hundreds digit 1–9. */
        hundreds: { bare: string[]; comb: string[] };
        magnitudes: {
            thousand: GeorgianNumeralPair;
            million: GeorgianNumeralPair;
            billion: GeorgianNumeralPair;
        };
    };
}

/** The consolidated hand-authored Georgian data tables (see georgian.jsonc). */
export const MANIFEST = loadManifest<GeorgianManifest>(import.meta.url, "georgian.jsonc");

// Grapheme keys sorted LENGTH DESC (all length 1 for Georgian, but the shared pattern keeps the scan uniform).
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);
