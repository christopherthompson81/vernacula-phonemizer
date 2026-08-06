/**
 * German morphological decomposition — now a thin CONFIG over the shared West-Germanic engine
 * (core/germanicMorphology.ts). The algorithm (prefix/suffix stripping, recursive compound split with the
 * over-split guards) lives in the core; this file supplies German's facts: the affix lists + linking elements +
 * validation onsets from the manifest, the content-stem lexicon (lexicon.tsv, word→flags), and German's specific
 * quirks (un- negation, mit- real-word gate, the ⟨sch⟩ digraph guard, the st/sp/sch element-initial seam, the
 * keep-whole -en verb). Output is byte-identical to the former private module.
 */

import { MANIFEST } from "./manifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { makeDecompose, BOUNDARY as CORE_BOUNDARY, type MorphologyConfig, type Decomp, type Kind } from "../../core/germanicMorphology.ts";

export const BOUNDARY = CORE_BOUNDARY;
export type { Decomp, Kind };

// Closed affix lists (this list IS the affix "flag table") — data in german.jsonc, consumed by german.ts too.
export const PREFIX_UNSTRESSED = MANIFEST.morphology.prefixUnstressed;
export const PREFIX_STRESSED = MANIFEST.morphology.prefixStressed;
export const SUFFIXES = MANIFEST.morphology.suffixes;
export const PREFIX_IPA = MANIFEST.morphology.prefixIpa;
export const SUFFIX_IPA = MANIFEST.morphology.suffixIpa;

// Morphological lexicon: word → flags. k = compound constituent; N = noun; s = takes Fugen-s.
let LEXICON: Map<string, string> | undefined;
function lexicon(): Map<string, string> {
    if (LEXICON === undefined) LEXICON = loadTsvMap(import.meta.url, "lexicon.tsv", undefined, { optional: true });
    return LEXICON;
}
const flags = (w: string): string => lexicon().get(w) ?? "";

const LINKS_DEFAULT = MANIFEST.morphology.linkingElements;

const CONFIG: MorphologyConfig = {
    vowels: "aeiouäöüy",
    prefixUnstressed: PREFIX_UNSTRESSED,
    prefixStressed: PREFIX_STRESSED,
    ambiguousPrefixes: new Set(MANIFEST.morphology.ambiguousPrefixes), // be-/ge-/er- also root-initial → need a real word
    suffixes: SUFFIXES,
    vowelInitialSuffixes: new Set(MANIFEST.morphology.vowelInitialSuffixes),
    reliableConsSuffixes: new Set(["nis"]), // bünd·nis, ergeb·nis — loose-strip when the stem ends in b/d/g
    linksFor: (head) => (flags(head).includes("s") ? ["s", ...LINKS_DEFAULT] : LINKS_DEFAULT), // promote Fugen-s if flagged
    validOnsets: new Set(MANIFEST.morphology.validOnsets),
    stKeep: new Set(MANIFEST.morphology.stKeepWords),
    isWord: (w) => lexicon().has(w),
    isConstituent: (w) => w.length >= 3 && flags(w).includes("k"),
    negationPrefix: "un", // un- strips only before another prefix (unge-/unbe-/unver-/unzer-/unent-)
    negationFollows: /^(ge|be|ver|zer|ent)/,
    realWordStressedPrefixes: new Set(["mit"]), // mit- needs a real-word stem (mit·teilen ✓, not mit·tel)
    suffixDigraphGuard: (s, stem) => s.startsWith("ch") && stem.endsWith("s"), // don't split inside ⟨sch⟩ (rausch·en)
    seamElementInitial: /^(st|sp|sch)/, // fest·stellen / klar·stellen reset element-initial (st→ʃt)
    wholeVerbSuffix: "en", // keep a known -en verb whole (schreiben → schreib·en, not schrei·ben)
};

/** Decompose a German word into ordered morphemes with a stress hint. */
export const decompose = makeDecompose(CONFIG);
