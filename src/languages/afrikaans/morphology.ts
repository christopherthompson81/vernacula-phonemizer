/**
 * Afrikaans morphological decomposition — a config over the shared West-Germanic engine
 * (core/germanicMorphology.ts). Afrikaans compounds like Dutch/German (aandete, afwesigheid); splitting into
 * morphemes lets afrikaans.ts phonemize each element with its own stress + coda devoicing. The affix lists + linking
 * elements + onsets come from afrikaans.jsonc; the stem lexicon is a wordlist (af-stems.txt, provenance in
 * af-stems.PROVENANCE.md). ⚠ Afrikaans has no per-stem Fugen flags, so the linking-element order is static, and
 * none of German's language-specific quirks (un-/mit-/sch/seams/-en) apply.
 */

import { makeDecompose, type MorphologyConfig } from "../../core/germanicMorphology.ts";
import { MANIFEST } from "./manifest.ts";
import { dataFile } from "../../core/dataPath.ts";
import { readDataText } from "../../core/dataSource.ts";

const M = MANIFEST.morphology;

// The stem lexicon: a frequency wordlist of Afrikaans words (one per line). A word ≥3 letters is a valid compound
// constituent. Optional — absent → no splitting (every word stays whole, the pre-morphology behaviour).
let STEMS: Set<string> | undefined;
function stems(): Set<string> {
    if (STEMS === undefined) {
        STEMS = new Set();
        try {
            const key = dataFile(import.meta.url, "af-stems.txt");
            for (const line of readDataText(key).split("\n")) {
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
    // No per-stem Fugen flags in Afrikaans, so the order is static — EXCEPT that a head already ending in ⟨s⟩
    // may not take the linking ⟨s⟩. Without that, trying ⟨s⟩ first (see the manifest note on why it must be
    // first) re-splits tuis·span as tuiss·pan, pols·slag as polss·lag, tennis·span as tenniss·pan: the head's
    // own final ⟨s⟩ gets read as the Fugen and the next element loses its onset. Measured: −32 without it.
    linksFor: (head) => (head.endsWith("s") ? LINKS.filter((l) => l !== "s") : LINKS),
    validOnsets: new Set(M.validOnsets),
    stKeep: new Set(M.stKeep),
    isWord: (w) => stems().has(w),
    isConstituent: (w) => w.length >= 3 && stems().has(w),
    // Afrikaans separable prefixes (aan/af/op/uit…) are letters that also begin many roots (aand, afdeling); with no
    // constituent flags, require the remainder to be a REAL word before peeling one off.
    // ⚠ THIS GUARD DOES NOT SAVE aandete, which it was once documented as saving: "dete" IS in af-stems.txt (a
    // frequency wordlist carries fragments), so the guard passes and the word is torn to aan·dete — the stressed-
    // prefix strip runs before splitCompound, which would otherwise have found aand·ete. Measured cost: 1 word.
    realWordStressedPrefixes: new Set(M.prefixStressed),
};

/** Decompose an Afrikaans word into ordered morphemes with a stress hint. */
export const decompose = makeDecompose(CONFIG);
