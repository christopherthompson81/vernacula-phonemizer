/**
 * Loads the Lithuanian data manifest (lithuanian.jsonc) once at module init and exposes it typed. Holds the
 * hand-authored DATA — vowel/consonant maps, digraphs, the front/back-vowel sets that drive palatalization + the
 * softening ⟨i⟩, and the voicing-assimilation pairs. The ALGORITHM (palatalization spread, voicing, ŋ-assimilation)
 * lives in g2p.ts (the Czech pattern).
 */
import { loadManifest } from "../../core/loadManifest.ts";

/** A Lithuanian counted noun's three concord forms: nom sg (…1), nom pl (…2–9), gen pl (…0 / …11–19). */
export interface LithuanianAgreement {
    sg: string;
    pl: string;
    gen: string;
}

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
    numbers: {
        units: string[];
        teens: string[];
        tens: string[];
        magnitudes: {
            hundred: LithuanianAgreement;
            thousand: LithuanianAgreement;
            million: LithuanianAgreement;
            billion: LithuanianAgreement;
        };
    };
}

/** The consolidated hand-authored Lithuanian data tables (see lithuanian.jsonc). */
export const MANIFEST = loadManifest<LithuanianManifest>(import.meta.url, "lithuanian.jsonc");
