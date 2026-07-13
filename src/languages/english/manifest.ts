/**
 * Loads the English data manifest (english.jsonc) once at module init and exposes it typed. Holds the closed,
 * hand-authored FACTS of English — heteronyms, function words, number words, the ARPABET→IPA correspondence,
 * and the small closed word-lists — that the algorithms (english.ts, numbers.ts, englishArpabet.ts, and the
 * pure englishG2p.ts via injection) read. The bulk statistical models stay referenced as files (see the jsonc's
 * "models" block); only authorable data lives here.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseJsonc } from "../../core/jsonc.ts";
import type { ArpabetDef } from "./englishArpabet.ts";

interface HeteronymEntry {
    default: string;
    verb?: string;
    noun?: string;
    past?: string;
}

export interface EnglishManifest {
    heteronyms: Record<string, HeteronymEntry>;
    unstressedWords: string[];
    clausePunctuation: Record<string, string>;
    nonTonicFinal: string[];
    whSecondary: string[];
    arpabet: ArpabetDef;
    numbers: {
        ones: string[]; // 0–19
        tens: string[]; // ×10 (index 2–9)
        hundred: string;
        scale: string[]; // thousand, million, … nonillion (10^3 … 10^30)
        ordinals: Record<string, string>;
    };
    // ARPABET phonetic-class sets consumed (via injection) by the pure OOV G2P.
    g2pClasses: {
        vowelLetters: string[];
        vowels: string[];
        voiceless: string[];
        sibilants: string[];
        stopPieces: string[];
    };
}

const dir = dirname(fileURLToPath(import.meta.url));

/** The consolidated hand-authored English data facts (see english.jsonc). */
export const MANIFEST = parseJsonc<EnglishManifest>(
    readFileSync(join(dir, "english.jsonc"), "utf8"),
);
