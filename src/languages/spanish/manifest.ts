/**
 * Loads the Spanish data manifest (spanish.jsonc) once at module init and exposes it typed. Holds the context-
 * free hand-authored DATA: the vowel classes, the accented-vowel→base map, the nasal + spirantization sets, the
 * function-word list, clause punctuation, and the number words. The ALGORITHMS that read them stay in code
 * (g2p.ts / spanish.ts / numbers.ts): the scan, glide classification, spirantization, stress, and the compositor.
 */

import { loadManifest } from "../../core/loadManifest.ts";
import type { CountForms, SignWords } from "../../core/normalizeSymbols.ts";

export interface SpanishManifest {
    vowels: {
        strong: string;
        weakUnaccented: string;
        weakAccented: string;
        front: string;
    };
    /** Acronyms read letter-by-letter; see spanish.jsonc. */
    acronymLetters: string[];
    accents: Record<string, string>;
    nasals: string[];
    spirantize: Record<string, string>;
    functionWords: string[];
    clausePunctuation: Record<string, string>;
    numbers: {
        ones: string[];
        tens: string[];
        hundreds: string[];
        hundredExact: string;
        thousand: string;
        connector: string;
        decimalConnector: string;
        scales: { value: number; one: string; many: string }[];
    };
    months: string[];
    dottedAbbrev: Record<string, string>;
    /** ⚠ Also the source of the clock half-day reading: `a. m.` is ⟨a⟩ + ⟨m⟩ said as letter names. */
    letterNames: Record<string, string>;
    phonotactics: { vowels: string; onsets: string[]; codas: string[] };
    /** MASCULINE — the feminine is derived (-o → -a on every element of a compound). */
    ordinals: {
        units: string[];
        teens: string[];
        tens: string[];
        hundreds: string[];
        thousandth: string;
    };
    /** ⚠ `numeratorOne` is the APOCOPATED "un", a different word from `numbers.ones[1]`. */
    fractions: { denominators: Record<string, string>; numeratorOne: string };
    feminineOne: string;
    eraMarkers: { beforeChrist: string; afterChrist: string };
    unitedStates: string;
    numberSign: string;
    signWords: SignWords;
    symbolTier: {
        percent: CountForms;
        currency: Record<string, CountForms>;
        units: Record<string, CountForms>;
        exponentWords: { squared: CountForms; cubed: CountForms };
        bareExponent: { squared: string; cubed: string; power: string; negative: string };
        magnitudes: string[];
        magnitudeConnective: string;
    };
}

/** The consolidated hand-authored Spanish data tables (see spanish.jsonc). */
export const MANIFEST = loadManifest<SpanishManifest>(import.meta.url, "spanish.jsonc");
