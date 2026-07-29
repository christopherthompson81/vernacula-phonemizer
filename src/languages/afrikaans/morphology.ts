/**
 * Afrikaans morphological decomposition — a config over the shared West-Germanic engine
 * (core/germanicMorphology.ts). Afrikaans compounds like Dutch/German (aandete, afwesigheid); splitting into
 * morphemes lets afrikaans.ts phonemize each element with its own stress + coda devoicing. The affix lists + linking
 * elements + onsets come from afrikaans.jsonc; the stem lexicon is a wordlist (af-stems.txt — afwiki + OpenSubtitles
 * + kaikki union, see af-stems.PROVENANCE.md). Afrikaans has no per-stem Fugen flags → a static linking-element order, and
 * none of German's language-specific quirks (un-/mit-/sch/seams/-en) apply. See the af investigation doc.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { makeDecompose, type MorphologyConfig } from "../../core/germanicMorphology.ts";
import { MANIFEST } from "./manifest.ts";

const M = MANIFEST.morphology;

// The stem lexicon: a frequency wordlist of Afrikaans words (one per line). A word ≥3 letters is a valid compound
// constituent. Optional — absent → no splitting (every word stays whole, the pre-morphology behaviour).
let STEMS: Set<string> | undefined;
function stems(): Set<string> {
    if (STEMS === undefined) {
        STEMS = new Set();
        try {
            const path = join(dirname(fileURLToPath(import.meta.url)), "af-stems.txt");
            for (const line of readFileSync(path, "utf8").split("\n")) {
                const w = line.trim().toLowerCase();
                if (w) STEMS.add(w);
            }
        } catch { /* no lexicon → empty, splitter is a no-op */ }
    }
    return STEMS;
}

const LINKS = M.linkingElements;
const CONFIG: MorphologyConfig = {
    vowels: "aeiouyêôûîëïéèáàóúü",
    prefixUnstressed: M.prefixUnstressed,
    prefixStressed: M.prefixStressed,
    ambiguousPrefixes: new Set(M.ambiguousPrefixes),
    suffixes: M.suffixes,
    vowelInitialSuffixes: new Set(M.vowelInitialSuffixes),
    reliableConsSuffixes: new Set(),
    linksFor: () => LINKS, // no per-stem Fugen flags in Afrikaans → a static order
    validOnsets: new Set(M.validOnsets),
    stKeep: new Set(M.stKeep),
    isWord: (w) => stems().has(w),
    isConstituent: (w) => w.length >= 3 && stems().has(w),
    // Afrikaans separable prefixes (aan/af/op/uit…) are letters that also begin many roots (aand, afdeling); with no
    // constituent flags, require the remainder to be a REAL word so aandete isn't torn to aan·dete.
    realWordStressedPrefixes: new Set(M.prefixStressed),
};

/** Decompose an Afrikaans word into ordered morphemes with a stress hint. */
export const decompose = makeDecompose(CONFIG);
