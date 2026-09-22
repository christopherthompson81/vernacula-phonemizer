/**
 * Loads the English data manifest (english.jsonc) once at module init and exposes it typed. Holds the closed,
 * hand-authored FACTS of English — heteronyms, function words, number words, the ARPABET→IPA correspondence,
 * and the small closed word-lists — that the algorithms (english.ts, numbers.ts, englishArpabet.ts, and the
 * pure englishG2p.ts via injection) read. The bulk statistical models stay referenced as files (see the jsonc's
 * "models" block); only authorable data lives here.
 */

import { loadManifest } from "../../core/loadManifest.ts";
import type { ArpabetDef } from "./englishArpabet.ts";

/**
 * A FOLLOWING-WORD CONDITION on a heteronym slot, for the pairs no POS tag separates.
 *
 * ⚠ `used to` IS THE CASE THIS EXISTS FOR AND THE MEASUREMENT IS THE WHOLE JUSTIFICATION. `used` is
 * rank 125, and the habitual /juːst/ and the passive /juːzd/ are both VBD-or-VBN before an infinitival
 * `to`. Counted over the 101 `used to` tokens in the UD English treebanks, scored with THIS tagger:
 *
 *     41%  today (always juːzd)          81%  tag is VBD
 *     59%  next word is `to` (flat)       85%  tag is VBD, OR the next tag is IN
 *
 * so the condition is BOTH a word and a tag test: `tags` selects the marked reading, and `nextTags`
 * selects it too — the second is what reaches "be/get used to <noun|gerund>", where `to` is a
 * PREPOSITION (IN) rather than the infinitive marker (TO) and the reading is /juːst/ as well.
 * ⚠ A FLAT BIGRAM WOULD HAVE BEEN NET POSITIVE AND IS NOT WHAT SHIPPED: 59% beats 41%, and 85% beats
 * both. The issue proposed the flat form; the corpus said the tags were worth another 26 points.
 */
export interface BeforeCondition {
    /** The following surface word, lower-cased. */
    word: string;
    /** Tags of THIS word that select the marked reading. */
    tags?: string[];
    /** Tags of the FOLLOWING word that select it, independently of `tags`. */
    nextTags?: string[];
    /** Which slot the condition drives. The slot is true exactly when the condition fires. */
    slot: "verb" | "noun" | "past" | "adj";
}

export interface HeteronymEntry {
    default: string;
    verb?: string;
    noun?: string;
    past?: string;
    /** The ADJECTIVE reading, where it differs from the default — `arithmetic` the property versus
     *  arithmetic the subject. See `PosExpectation.adj`. */
    adj?: string;
    /** See {@link BeforeCondition}. */
    before?: BeforeCondition;
}

export interface EnglishManifest {
    heteronyms: Record<string, HeteronymEntry>;
    acronymLetters: string[];
    unstressedWords: string[];
    clausePunctuation: Record<string, string>;
    nonTonicFinal: string[];
    whSecondary: string[];
    clauseInitialStressed: Record<string, string>;
    arpabet: ArpabetDef;
    numbers: {
        ones: string[]; // 0–19
        tens: string[]; // ×10 (index 2–9)
        hundred: string;
        scale: string[]; // thousand, million, … nonillion (10^3 … 10^30)
        ordinals: Record<string, string>;
    };
    // ARPABET phonetic-class sets consumed (via injection) by the pure OOV G2P. `vowels` is NOT here — the OOV
    // G2P reuses arpabet.vowels (single source of truth for the ARPABET vowel bases), spliced in at build time.
    g2pClasses: {
        vowelLetters: string[];
        voiceless: string[];
        sibilants: string[];
        stopPieces: string[];
        stemStressPrefixes: string[];
    };
    /** ⚠ ALSO INJECTED INTO THE OOV G2P as part of `G2pClasses`, so the splitter recognises an
     *  initialism row. Declared once here; `normalize.ts` and `englishG2p.ts` read the same value. */
    /** ⚠ NOT a letter-name table — CMUdict already names all 26. Only the ⟨a⟩ exception is data. */
    letterNameExceptions: Record<string, string>;
    phonotactics: { vowels: string; onsets: string[]; codas: string[] };
}

/** The consolidated hand-authored English data facts (see english.jsonc). */
export const MANIFEST = loadManifest<EnglishManifest>(import.meta.url, "english.jsonc");
