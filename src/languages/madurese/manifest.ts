/**
 * Loads the Madurese data manifest (madurese.jsonc) once at module init and exposes it typed. Holds the
 * context-free hand-authored DATA: the consonant register classes, the vowel + raising tables, final-devoicing
 * map, clause punctuation, number words. The ALGORITHM (the register-harmony scan + glide/glottal epenthesis +
 * gemination + final devoicing) stays in code (madurese.ts / numbers.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface MadureseManifest {
    language: string;
    name: string;
    script: string;
    raiseCons: Record<string, string>;
    lowCons: Record<string, string>;
    transpCons: Record<string, string>;
    vowelSpec: Record<string, [string, string]>;
    finalDevoice: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        ten: string;
        tens: string;
        hundred: string;
        thousand: string;
        and: string;
    };
}

/** The consolidated hand-authored Madurese data tables (see madurese.jsonc). */
export const MANIFEST = loadManifest<MadureseManifest>(import.meta.url, "madurese.jsonc");

// One orthography→(ipa, register) table, keys sorted LENGTH DESC so digraphs (bh, ng, ḍh) beat single letters.
export type Reg = "raise" | "low" | "transp";
export interface Cons {
    ipa: string;
    reg: Reg;
}
const consMap = new Map<string, Cons>();
for (const [k, v] of Object.entries(MANIFEST.raiseCons)) consMap.set(k, { ipa: v, reg: "raise" });
for (const [k, v] of Object.entries(MANIFEST.lowCons)) consMap.set(k, { ipa: v, reg: "low" });
for (const [k, v] of Object.entries(MANIFEST.transpCons)) consMap.set(k, { ipa: v, reg: "transp" });
export const CONS = consMap;
export const CONS_KEYS = [...consMap.keys()].sort((a, b) => b.length - a.length);
export const VOWEL_KEYS = Object.keys(MANIFEST.vowelSpec).sort((a, b) => b.length - a.length);
