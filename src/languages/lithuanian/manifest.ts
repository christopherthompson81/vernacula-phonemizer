/**
 * Loads the Lithuanian data manifest (lithuanian.jsonc) once at module init and exposes it typed. Holds the
 * hand-authored DATA — vowel/consonant maps, digraphs, the front/back-vowel sets that drive palatalization + the
 * softening ⟨i⟩, and the voicing-assimilation pairs. The ALGORITHM (palatalization spread, voicing, ŋ-assimilation)
 * lives in g2p.ts (the Czech pattern).
 */
import { loadManifest } from "../../core/loadManifest.ts";

/** A Lithuanian counted noun's three concord forms: nom sg (…1), nom pl (…2–9), gen pl (…0 / …11–19). */
export interface LithuanianAgreement {
    sg: string;
    pl: string;
    gen: string;
    /** The noun is FEMININE, so the numeral's 1–9 component takes the feminine form (*keturios valandos*,
     *  never *keturi valandos*). Only `normalization.countedNouns` sets this; the magnitude nouns are all
     *  masculine. See `numbers.unitsFem`. */
    fem?: boolean;
}

export interface LithuanianManifest {
    language: string;
    name: string;
    script: readonly string[];
    vowels: Record<string, string>;
    vowelDigraphs: Record<string, string>;
    consonants: Record<string, string>;
    consonantDigraphs: Record<string, string>;
    frontVowels: string;
    backVowels: string;
    voicing: { toVoiceless: Record<string, string>; toVoiced: Record<string, string> };
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        /** The FEMININE 1–9. See `LithuanianAgreement.fem`. */
        unitsFem: string[];
        teens: string[];
        tens: string[];
        magnitudes: {
            hundred: LithuanianAgreement;
            thousand: LithuanianAgreement;
            million: LithuanianAgreement;
            billion: LithuanianAgreement;
        };
    };
    /** Text-normalization data (normalize.ts). Every entry's source + sense is recorded in lithuanian.jsonc. */
    normalization: {
        /** Counted nouns, in the same three-way concord as `numbers.magnitudes` — see `agree()`. */
        countedNouns: Record<
            | "percent" | "degree" | "hour" | "minute"
            | "kilometre" | "metre" | "millimetre" | "centimetre" | "kilogram" | "hectare" | "tonne"
            | "gram" | "milligram"
            | "dollar" | "euro" | "pound" | "litas" | "squared",
            LithuanianAgreement
        >;
        /** Invariant words the rules insert (decimal point, signs, range correlative, date vocabulary). */
        words: Record<
            | "decimalPoint" | "minus" | "plus" | "celsius" | "fahrenheit"
            | "rangeFrom" | "rangeTo" | "and"
            | "yearInstr" | "yearGen" | "day" | "centuryGen" | "month"
            | "eraBefore" | "eraOur" | "thatIs" | "forExample" | "etCetera"
            | "number" | "page" | "inhabitants",
            string
        >;
        /** Month names in the GENITIVE — the discriminator between a full date and a bare year. */
        monthsGen: readonly string[];
        /** Lowercase letter → its Lithuanian NAME, for core/initialisms.ts. */
        letterNames: Record<string, string>;
        /** Lowercase acronyms spelled out although pronounceable — a lexical fact (core/initialisms.ts). */
        acronymLetters: readonly string[];
    };
}

/** The consolidated hand-authored Lithuanian data tables (see lithuanian.jsonc). */
export const MANIFEST = loadManifest<LithuanianManifest>(import.meta.url, "lithuanian.jsonc");
