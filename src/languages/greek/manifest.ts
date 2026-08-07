/**
 * Loads the Modern Greek data manifest (greek.jsonc) once at module init. Holds the context-free hand-authored
 * DATA (vowel/consonant/digraph tables, palatalisation map, number words); the CONTEXT rules (palatalisation,
 * αυ/ευ + σ voicing, synizesis, double-consonant simplification) live in greek.ts.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface GreekManifest {
    language: string;
    name: string;
    script: readonly string[];
    vowels: Record<string, string>;
    /** Voiceless consonant letters — they take the voiceless glide [ç] under palatalisation. */
    voiceless: readonly string[];
    /** Letters AND digraphs that make ⟨αυ ευ⟩ voiced ([av ev] rather than [af ef]). */
    auVoiced: readonly string[];
    /** The shorter class that voices a preceding ⟨σ⟩ to [z]. */
    sigmaVoiced: readonly string[];
    vowelDigraphs: Record<string, string>;
    consonants: Record<string, string>;
    consonantDigraphs: Record<string, string>;
    palatal: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        ten: string;
        tens: string[];
        hundred: string;
        hundreds: string[];
        thousand: string;
        and: string;
    };
}

/** The consolidated hand-authored Modern Greek data tables (see greek.jsonc). */
export const MANIFEST = loadManifest<GreekManifest>(import.meta.url, "greek.jsonc");
