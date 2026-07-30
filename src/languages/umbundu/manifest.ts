/**
 * Loads the Umbundu data manifest (umbundu.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the orthography→IPA grapheme table (prenasalised clusters, ⟨c⟩=t͡ʃ, ⟨ñ⟩=ɲ, ⟨ng'⟩=ŋ) + clause
 * punctuation. The ALGORITHM (the greedy longest-match scan + tone-accent stripping) stays in code (umbundu.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface UmbunduManifest {
    language: string;
    name: string;
    script: string;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: UmbunduNumbers;
}

/** The Umbundu cardinal number words (see umbundu.jsonc "numbers"; the compositor is numbers.ts). Each magnitude
 *  selects its OWN multiplier series — akwi takes the cl.6 a- concord, ovita the cl.8 vi- concord, and the slot
 *  after the connective "la" is its own (irregular) series — so these must stay four separate tables. */
export interface UmbunduNumbers {
    /** zero (a Portuguese loan; see the manifest note). */
    zero: string;
    /** the bare citation/counting forms 1–9 at indices 1–9; index 0 unused. */
    units: string[];
    /** the additive slot after "la"/"l'", indices 1–9 (irregular: 3 and 5 carry vi-, 2 and 4 do not). */
    additive: string[];
    /** ten (ekwi). */
    ten: string;
    /** the cl.6 plural of "ten" (akwi). */
    tens: string;
    /** the cl.6 a- multiplier after `tens`, indices 2–9. */
    tensMult: string[];
    /** exactly 100 (ocita). */
    hundredOne: string;
    /** the cl.8 plural of "hundred" (ovita). */
    hundreds: string;
    /** the cl.8 vi- multiplier after `hundreds`, indices 2–9. */
    hundredsMult: string[];
    /** "thousand" (ohulukãyi) — used invariant, see the manifest note. */
    thousand: string;
    /** "million" (ohulua); 10⁹ composes as ohulua ohulukãyi. */
    million: string;
    /** the additive connective (la). */
    and: string;
    /** the connective elided before a vowel (l'). */
    andElided: string;
}

/** The consolidated hand-authored Umbundu data tables (see umbundu.jsonc). */
export const MANIFEST = loadManifest<UmbunduManifest>(import.meta.url, "umbundu.jsonc");

// Grapheme keys sorted LENGTH DESC so the greedy scan tries the trigraph ⟨ng'⟩ before prenasal digraphs before singles.
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);
