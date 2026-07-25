/**
 * Loads the Lithuanian data manifest (lithuanian.jsonc) once at module init and exposes it typed. Holds the
 * hand-authored DATA — vowel/consonant maps, digraphs, the front/back-vowel sets that drive palatalization + the
 * softening ⟨i⟩, and the voicing-assimilation pairs. The ALGORITHM (palatalization spread, voicing, ŋ-assimilation)
 * lives in g2p.ts (the Czech pattern).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface LithuanianManifest {
    language: string;
    name: string;
    script: string;
    vowels: Record<string, string>;
    vowelDigraphs: Record<string, string>;
    consonants: Record<string, string>;
    consonantDigraphs: Record<string, string>;
    frontVowels: string;
    backVowels: string;
    voicing: { toVoiceless: Record<string, string>; toVoiced: Record<string, string> };
    clausePunctuation: Record<string, string>;
}

/** The consolidated hand-authored Lithuanian data tables (see lithuanian.jsonc). */
export const MANIFEST = loadManifest<LithuanianManifest>(import.meta.url, "lithuanian.jsonc");
