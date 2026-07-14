/**
 * Loads the Welsh data manifest (welsh.jsonc) once at module init and exposes it typed. The hand-authored DATA
 * (digraph + consonant maps, vowel-cluster lookup, length sets, obscure-y clitics, number words) lives in the
 * JSONC; the ALGORITHMS (g2p.ts, welsh.ts, numbers.ts) read it.
 */

import { loadManifest } from "../../core/loadManifest.ts";

export interface WelshManifest {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    longVowel: Record<string, string>;
    lengthenBefore: string;
    obscureY: string[];
    clausePunctuation: Record<string, string>;
    numbers: { ones: string[] };
}

/** The consolidated hand-authored Welsh data tables (see welsh.jsonc). */
export const MANIFEST = loadManifest<WelshManifest>(import.meta.url, "welsh.jsonc");
