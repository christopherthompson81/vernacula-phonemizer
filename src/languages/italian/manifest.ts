/**
 * Loads the Italian data manifest (italian.jsonc) once at module init and exposes it typed. The hand-authored
 * DATA tables live in the JSONC; the ALGORITHMS that consume them stay in the sibling modules (italian.ts,
 * normalize.ts, romanOrdinals.ts).
 *
 * ⚠ ONE LOAD, MODULE-LEVEL. italian.ts declared this shape inline and loaded the file itself; normalize.ts
 * needed three more tables and would have loaded it a second time.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { CountForms, SignWords } from "../../core/normalizeSymbols.ts";

export interface ItalianNumbers {
    units: string[];
    teens: string[];
    tens: string[];
    hundred: string;
    thousand: string;
    thousands: string;
    million: string;
    millions: string;
    and: string;
}

export interface ItalianManifest {
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    accented: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: ItalianNumbers;
    /** Readable letter runs Italian nevertheless spells out; see italian.jsonc for what is absent and why. */
    acronymLetters: string[];
    letterNames: Record<string, string>;
    phonotactics: { vowels: string; onsets: string[]; codas: string[] };
    dottedAbbrev: Record<string, string>;
    /** 1–10 only — everything above is COMPOSED from the cardinal, so there is no tens/hundreds row. */
    ordinals: Record<string, string>;
    fractions: { denominators: Record<string, string> };
    /** ⚠ ONE FACT, TWO CALLERS: *un quinto* (fraction) and *un grado* (degree) are the same apocope. */
    apocopatedOne: string;
    eraMarkers: { beforeChrist: string; afterChrist: string };
    numberSign: string;
    /** Agrees with the count: exactly 1 → `singular` + the apocopated numeral; otherwise `plural`. */
    degree: { singular: string; plural: string; celsius: string; fahrenheit: string };
    compass: Record<string, string>;
    decimalWord: string;
    signWords: SignWords;
    symbolTier: {
        percent: CountForms;
        currency: Record<string, CountForms>;
        currencyStems: string[];
        magnitudes: string[];
        magnitudeConnective: string;
        units: Record<string, CountForms>;
        exponentWords: { squared: CountForms; cubed: CountForms };
        bareExponent: { squared: string; cubed: string; power: string; negative: string };
    };
}

/** The consolidated hand-authored Italian data tables (see italian.jsonc). */
export const MANIFEST = loadManifest<ItalianManifest>(import.meta.url, "italian.jsonc");
