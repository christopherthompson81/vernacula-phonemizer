/**
 * Dutch morphological decomposition — a config over the shared West-Germanic engine (core/germanicMorphology.ts).
 * Dutch compounds like German/Afrikaans (stadhuis, voetbalveld); dutch.ts uses this to find the COMPOUND (stem·stem)
 * boundaries and phonemize each element with its own stress + coda devoicing. The g2p already handles a word's own
 * prefix reduction and suffix schwa, so only stem·stem splits are consumed downstream. The affix lists come from
 * dutch.jsonc; the stem lexicon is a frequency wordlist (nl-stems.txt, hunspell nl.dic base forms). No per-stem
 * Fugen flags → a static linking-element order, and none of German's language-specific quirks apply.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { makeDecompose, type MorphologyConfig } from "../../core/germanicMorphology.ts";
import { MANIFEST } from "./manifest.ts";

const M = MANIFEST.morphology;

// The stem lexicon: a frequency wordlist of Dutch words (one per line). A word ≥3 letters is a valid compound
// constituent. Optional — absent → no splitting (every word stays whole, the pre-morphology behaviour).
let STEMS: Set<string> | undefined;
function stems(): Set<string> {
    if (STEMS === undefined) {
        STEMS = new Set();
        try {
            const path = join(dirname(fileURLToPath(import.meta.url)), "nl-stems.txt");
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
    vowels: "aeiouyáéíóúàèäëïöü",
    prefixUnstressed: M.prefixUnstressed,
    prefixStressed: M.prefixStressed,
    ambiguousPrefixes: new Set(M.ambiguousPrefixes),
    suffixes: M.suffixes,
    vowelInitialSuffixes: new Set(M.vowelInitialSuffixes),
    reliableConsSuffixes: new Set(),
    linksFor: () => LINKS, // no per-stem Fugen flags in Dutch → a static order
    validOnsets: new Set(M.validOnsets),
    stKeep: new Set(M.stKeep),
    isWord: (w) => stems().has(w),
    isConstituent: (w) => w.length >= 3 && stems().has(w),
    // Dutch separable prefixes (aan/af/op/over…) are letters that also begin many roots (aandeel, overheid); with no
    // constituent flags, require the remainder to be a REAL word so they aren't peeled off a monomorpheme.
    realWordStressedPrefixes: new Set(M.prefixStressed),
    minTrailingConstituent: 4, // reject 3-letter inflectional-lookalike tails (druk·ken, af·slui·ten, dring·end)
    dontSplitKnownWords: true, // a whole dictionary entry is ONE morpheme — don't tear schakelen → scha·kelen
};

/** Is `w` a single known dictionary word? A monomorphemic entry (minister, hamster, spelling) must NOT be compound-
 *  split — with no constituent flags every short lexicon word (ter, ken, ster) would else be a spurious second part. */
export const isLexicalWord = (w: string): boolean => stems().has(w);

/** Decompose a Dutch word into ordered morphemes with a stress hint. */
export const decompose = makeDecompose(CONFIG);
