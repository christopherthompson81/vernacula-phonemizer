/**
 * Loads the Javanese data manifest (javanese.jsonc) once at module init and exposes it typed. The
 * hand-authored DATA tables live in the JSONC; the ALGORITHMS that consume them stay in the sibling modules
 * (javanese.ts, normalize.ts).
 *
 * ⚠ ONE LOAD, MODULE-LEVEL. javanese.ts declared this shape inline and loaded the file itself; normalize.ts
 * needed two more tables and would have loaded it a second time.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface JavaneseNumbers {
    units: string[];
    teens: string[];
    likur: string[];
    mult: string[];
    tens: Record<string, string>;
    magnitudes: { thousand: string[]; million: string[]; billion: string[] };
    hundredOne: string;
    hundred: string;
}

export interface JavaneseManifest {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: JavaneseNumbers;
    letterNames: Record<string, string>;
    phonotactics: { vowels: string; onsets: string[]; codas: string[] };
}

/** The consolidated hand-authored Javanese data tables (see javanese.jsonc). */
export const MANIFEST = loadManifest<JavaneseManifest>(import.meta.url, "javanese.jsonc");
