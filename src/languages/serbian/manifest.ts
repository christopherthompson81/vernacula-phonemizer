/**
 * Loads the Serbian data manifest (serbian.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the Latin digraph table, the single-letter→IPA table (both scripts), clause punctuation,
 * and the number words. The ALGORITHMS (the digraph-aware dual-script scan, the cardinal compositor) stay in code
 * (serbian.ts / numbers.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

interface SlavicMagnitude {
    one: string;
    few?: string;
    many: string;
}

export interface SerbianManifest {
    digraphs: Record<string, string>;
    letters: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        teens: string[];
        tens: string[];
        hundreds: string[];
        thousand: SlavicMagnitude;
        million: SlavicMagnitude;
    };
}

/** The consolidated hand-authored Serbian data tables (see serbian.jsonc). */
export const MANIFEST = loadManifest<SerbianManifest>(import.meta.url, "serbian.jsonc");
