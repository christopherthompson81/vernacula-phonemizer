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
}

/** The consolidated hand-authored Abkhaz data tables (see abkhaz.jsonc). */
export const MANIFEST = loadManifest<AbkhazManifest>(import.meta.url, "abkhaz.jsonc");
