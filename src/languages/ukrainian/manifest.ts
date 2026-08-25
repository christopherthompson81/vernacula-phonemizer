/**
 * Loads the Ukrainian data manifest (ukrainian.jsonc) once at module init and exposes it typed. The
 * hand-authored DATA tables (phoneme maps, number words, the ordinal and oblique-cardinal paradigms, letter
 * names, phonotactics, the abbreviation and sign words, the symbol tier's units) live in the JSONC; the
 * ALGORITHMS that consume them stay in the sibling modules (ukrainian.ts, normalize.ts, numbers.ts,
 * romanOrdinals.ts).
 *
 * ⚠ ONE LOAD, MODULE-LEVEL. normalize.ts, romanOrdinals.ts and the symbol tier in ukrainian.ts all read this
 * object — several of them read the SAME key (the metre forms, the squared adjective, `signWords.times`), which
 * is the point: before the lift each held its own byte-identical copy and nothing kept the copies together.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { CountForms, SignWords } from "../../core/normalizeSymbols.ts";
import type { EastSlavicNumbers } from "./numbers.ts";

/** One ordinal adjective ending, hard stem and soft (третій), under the case name the clock rule selects by. */
export interface OrdinalEnding {
    case: string;
    hard: string;
    soft: string;
}

export interface UkrainianManifest {
    vowels: Record<string, string>;
    iotated: Record<string, string>;
    palatalizers: readonly string[];
    vowelLetters: readonly string[];
    plainVowels: readonly string[];
    consonants: Record<string, string>;
    /** Western/Slavic base table + the magnitude count forms, feminine 1/2, and the decimal-comma name. */
    numbers: EastSlavicNumbers & { decimalConnector: string };
    clausePunctuation: Record<string, string>;
    /** Acronyms spelled out although they are phonotactically readable; see ukrainian.jsonc. */
    acronymLetters: string[];
    /** MASCULINE nominative — the citation form; `romanOrdinals` is the neuter table and is not a duplicate. */
    ordinals: {
        oneToNineteen: string[];
        tens: string[];
        hundreds: string[];
        thousands: string[];
        /** ⚠ PREFERENCE ORDER, not paradigm order — the first `endsWith` match wins. */
        endings: OrdinalEnding[];
    };
    genitiveCardinals: { oneToNineteen: string[]; tens: string[]; hundreds: string[] };
    /** NEUTER — the century noun (століття) is neuter. `context` deliberately omits вік; see the jsonc. */
    romanOrdinals: {
        oneToNineteen: string[];
        tens: string[];
        hundredth: string;
        context: string[];
    };
    letterNames: Record<string, string>;
    phonotactics: { vowels: string; onsets: string[]; codas: string[] };
    /** Preposition → the `ordinals.endings` case name it governs, plus the unprepositioned default. */
    clock: { prepositionCase: Record<string, string>; defaultCase: string };
    degree: CountForms;
    temperatureScales: Record<string, string>;
    dottedAbbrev: Record<string, string>;
    /** ⚠ ORDERED — `до н. е.` must precede `н. е.` or the longer reading is unreachable. */
    multiDotAbbrev: { written: string; reading: string }[];
    numberSign: string;
    rangeWord: string;
    signWords: SignWords;
    symbolTier: {
        percent: CountForms;
        currency: Record<string, CountForms>;
        units: Record<string, CountForms>;
        unitPer: string;
        rateDenominators: Record<string, string>;
        exponentWords: { squared: CountForms; cubed: CountForms; position: "before" | "after" };
        magnitudes: string[];
    };
}

/** The consolidated hand-authored Ukrainian data tables (see ukrainian.jsonc). */
export const MANIFEST = loadManifest<UkrainianManifest>(import.meta.url, "ukrainian.jsonc");
