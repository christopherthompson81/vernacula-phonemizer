/**
 * Loads the Dutch data manifest (dutch.jsonc) once at module init and exposes it typed. The hand-authored DATA
 * tables (vowel length maps, final-devoicing pairs, clause punctuation, number words) live in the JSONC; the
 * ALGORITHMS that consume them stay in the sibling modules (g2p.ts, dutch.ts, numbers.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface DutchManifest {
    vowelChars: string;
    consonantPhones: readonly string[];
    vowels: {
        long: Record<string, string>;
        short: Record<string, string>;
    };
    consonants: Record<string, string>;
    voicedFinal: Record<string, string>;
    clausePunctuation: Record<string, string>;
    /** Acronyms read LETTER-BY-LETTER although their lowercase form is readable, so neither a dictionary
     *  nor a phonotactic test can express it. Lowercase keys; consumed by core/initialisms.ts. */
    acronymLetters: string[];
    numbers: {
        ones: string[];
        tens: string[];
        connector: string;
        /** The connector after a vowel-final unit, with the trema (tweeën). */
        connectorTrema: string;
        decimalWord: string;
        hundred: string;
        thousand: string;
        million: { sg: string; pl: string };
        milliard: { sg: string; pl: string };
    };
    /** The ORTHOGRAPHIC vowel letters. ⚠ Not `vowelChars`, which is the IPA set. */
    vowelLetters: string;
    /** Function words / clitics → their reduced (schwa) IPA reading. */
    functionWords: Record<string, string>;
    morphology: {
        prefixUnstressed: string[];
        prefixStressed: string[];
        ambiguousPrefixes: string[];
        /** The subset of `prefixUnstressed` whose vowel also reduces to schwa — NOT `ambiguousPrefixes`. */
        prefixSchwa: string[];
        suffixes: string[];
        vowelInitialSuffixes: string[];
        linkingElements: string[];
        validOnsets: string[];
        stKeep: string[];
    };
}

/** The consolidated hand-authored Dutch data tables (see dutch.jsonc). */
export const MANIFEST = loadManifest<DutchManifest>(import.meta.url, "dutch.jsonc");
