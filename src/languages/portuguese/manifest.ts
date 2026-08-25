/**
 * Loads the European Portuguese data manifest (portuguese.jsonc) once at module init and exposes it typed. Holds
 * the context-free hand-authored DATA: accent letter classes, the vowel-letter→IPA table, the reduction and
 * nasalization maps, the voiced-consonant / liquid sets, the function-word list, clause punctuation, and the
 * number words. The ALGORITHMS that read them stay in code (g2p.ts / portuguese.ts / numbers.ts): the scan,
 * stress, reduction pass, sibilant voicing, and the cardinal compositor. The lexical correction table stays in
 * the sibling lexicon.tsv / lexicon-manual.tsv, which the manifest only references.
 */

import { loadManifest } from "../../core/loadManifest.ts";
import type { CountForms, SignWords } from "../../core/normalizeSymbols.ts";

export interface PortugueseManifest {
    /** Acronyms read letter-by-letter; see portuguese.jsonc. */
    acronymLetters: string[];
    accents: {
        toBase: Record<string, string>;
        acuteGrave: string;
        circumflex: string;
        tilde: string;
    };
    vowelLetters: string;
    frontLetters: string;
    vowelIpa: Record<string, string>;
    reduce: Record<string, string>;
    nasal: Record<string, string>;
    voicedConsonants: string[];
    liquids: string[];
    functionWords: string[];
    clausePunctuation: Record<string, string>;
    numbers: {
        small: string[];
        tens: string[];
        hundreds: string[];
        hundredExact: string;
        thousand: string;
        million: string;
        millionPlural: string;
        connector: string;
        decimalConnector: string;
    };
    months: string[];
    dottedAbbrev: Record<string, string>;
    letterNames: Record<string, string>;
    phonotactics: { vowels: string; onsets: string[]; codas: string[] };
    /** MASCULINE. ⚠ No `teens` row — Portuguese composes them regularly from `tens[1]` + a unit. */
    ordinals: { units: string[]; tens: string[]; hundreds: string[]; thousandth: string };
    /** ⚠ No `numeratorOne` — Portuguese does not apocopate before the fraction noun, unlike Spanish. */
    fractions: { denominators: Record<string, string> };
    feminineOne: string;
    /** Portuguese SPEAKS the clock noun where Spanish elides it — *sete horas e dezenove*. */
    clock: { hour: string; hours: string; connector: string };
    eraMarkers: { beforeChrist: string; afterChrist: string };
    numberSign: string;
    /** Agrees with the count: exactly 1 → `singular`, 0 and 2+ → `plural`. */
    degree: { singular: string; plural: string; celsius: string; fahrenheit: string };
    realWord: string;
    /** Dollar CODES folded to a bare `$` so the tier's declared key becomes reachable. */
    dollarCodes: string[];
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

/** The consolidated hand-authored European Portuguese data tables (see portuguese.jsonc). */
export const MANIFEST = loadManifest<PortugueseManifest>(import.meta.url, "portuguese.jsonc");
