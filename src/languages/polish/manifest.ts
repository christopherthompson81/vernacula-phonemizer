/** Loads the consolidated Polish data manifest (polish.jsonc) once and exposes it typed. Algorithms live in g2p.ts. */
import { loadManifest } from "../../core/loadManifest.ts";

/** A Slavic magnitude noun's three count forms: sg (1), paucal (2–4), gen-pl (5+ / 11–14). */
interface Agreement {
    sg: string;
    paucal: string;
    plural: string;
}

export interface PolishManifest {
    vowels: Record<string, string>;
    nasalVowels: Record<string, string>;
    consonants: Record<string, string>;
    digraphs: Record<string, string>;
    softI: Record<string, string>;
    voicing: {
        toVoiceless: Record<string, string>;
        toVoiced: Record<string, string>;
    };
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        teens: string[];
        tens: string[];
        hundreds: string[];
        magnitudes: { thousand: Agreement; million: Agreement; billion: Agreement };
    };
}

export const MANIFEST = loadManifest<PolishManifest>(import.meta.url, "polish.jsonc");
