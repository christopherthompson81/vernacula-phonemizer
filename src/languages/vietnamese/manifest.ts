/**
 * Loads the Vietnamese data manifest (vietnamese.jsonc) once at module init and exposes it typed. Holds the
 * context-free hand-authored DATA: the tone diacritic→Chao map, the ordered longest-match onset table, the vowel
 * letter/phoneme sets, clause punctuation, and the number words. The ALGORITHMS that read them stay in code
 * (g2p.ts / vietnamese.ts / numbers.ts): NFD tone extraction, onset parse, rhyme lookup + assembly, the
 * tokenizer, and the number compositor. The closed rhyme set stays in the sibling rhymes.tsv.
 */

import { loadManifest } from "../../core/loadManifest.ts";

export interface VietnameseManifest {
    tones: {
        diacritics: Record<string, string>;
        ngang: string;
    };
    onsets: [string, string][];
    vowelLetters: string;
    vowelIpa: string;
    clausePunctuation: Record<string, string>;
    numbers: {
        ones: string[];
        scales: string[];
        hundred: string;
        ten: string;
        tensMultiplier: string;
        unitOneAfterTen: string;
        unitFiveAfterTen: string;
        zeroTens: string;
    };
}

/** The consolidated hand-authored Vietnamese data tables (see vietnamese.jsonc). */
export const MANIFEST = loadManifest<VietnameseManifest>(import.meta.url, "vietnamese.jsonc");
