/**
 * Loads the Abkhaz data manifest (abkhaz.jsonc) once at module init and exposes it typed. Both readers import
 * it from HERE rather than each calling loadManifest: abkhaz.ts already imports numbers.ts, so having
 * numbers.ts import the parsed manifest back from abkhaz.ts would close an import cycle, and two loadManifest
 * calls would read and JSONC-parse the same file twice at startup.
 */
import { loadManifest } from "../../core/loadManifest.ts";

/** An Abkhaz numeral with two shapes: `bare` (group-final) and `comb` — the -и connective form used when a
 *  smaller number FOLLOWS it (шәкы → шәи акы, ҩажәа → ҩажәи жәаба). */
export interface AbkhazNumeralSeries {
    bare: string[];
    comb: string[];
}

export interface AbkhazManifest {
    language: string;
    name: string;
    script: readonly string[];
    /** Base letter + modifier (⟨ь⟩ palatal / ⟨ә⟩ labial / ⟨'⟩ pharyngeal) → the specific IPA cluster. */
    clusters: Record<string, string>;
    base: Record<string, string>;
    modifiers: Record<string, string>;
    /** Letters that write a vowel — the environment for the ⟨у⟩/⟨и⟩ glide-vs-syllabic rule in abkhaz.ts. */
    vowelLetters: readonly string[];
    /** [abbreviation, expansion] — LONGEST FIRST; the scan applies them in order. */
    abbreviations: readonly (readonly [string, string])[];
    numbers: {
        units: string[];
        teens: string[];
        /** Vigesimal score words indexed by the score count 1–4 (20, 40, 60, 80). */
        scores: AbkhazNumeralSeries;
        /** Round-hundred words indexed by the hundreds digit 1–9. */
        hundreds: AbkhazNumeralSeries;
        /** Fused thousands by multiplier 1–10, the fused 100 000, and the free-standing нызқь. */
        thousands: { fused: string[]; hundred: string; word: string };
        million: string;
        milliard: string;
        /** ⟨тәи⟩ — the ordinal suffix; the numeral takes а- in front and this behind. */
        ordinalSuffix: string;
        /** ⟨актәи⟩ — suppletive, because the cardinal акы would give *акытәи. */
        ordinalOne: string;
        rangeFrom: string;
        rangeTo: string;
    };
    /** Words for symbols (%, °, currency, км², the clock) — attested in FULL ab.wikipedia text, not the
     *  sampled corpus artifact; sourcing in docs/abkhaz_vocabulary_investigation.md. */
    symbols: {
        percent: string;
        degree: string;
        /** ⟨Цельси иградус⟩ — the attested unit NAME, used verbatim; Цельси is never attested bare. */
        celsius: string;
        /** ⟨асааҭ⟩ — goes BEFORE the number ("асааҭ 6 рзы"). */
        hour: string;
        /** [symbol, word] — km/m, in the corpus's own digit-adjacent spellings (километра, метра). */
        units: readonly (readonly [string, string])[];
        /** ⟨квадрат⟩ — postposed measure word for ²; no cubed word is sourceable. */
        squared: string;
        /** [symbol, word] — the symbol precedes the number in text, the word follows it in speech.
         *  Compound keys (US$, B£) included, because the shared tier letter-bounds a bare sign. */
        currencies: readonly (readonly [string, string])[];
        /** Scale abbreviation (млрд/млн) → the KEY in `numbers` holding its word — a reference, so the
         *  word cannot drift from the copy the number path reads. */
        scales: Readonly<Record<string, "million" | "milliard">>;
    };
}

/** The consolidated hand-authored Abkhaz data tables (see abkhaz.jsonc). */
export const MANIFEST = loadManifest<AbkhazManifest>(import.meta.url, "abkhaz.jsonc");
