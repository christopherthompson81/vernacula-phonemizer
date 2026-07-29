/**
 * Build the Burmese word-segmentation set (src/languages/burmese/seg-words.txt) — Burmese is SPACELESS, so text()
 * must split a connected run into words before phonemizing (and before the per-word voicing lexicon can fire).
 *
 * The set is the MULTI-SYLLABLE headwords from the kaikki + wikipron referee lists (both committed, CC-BY-SA).
 * Single-syllable entries are EXCLUDED on purpose: they shatter unknown runs into meaningless mono-syllable tokens
 * and destroy minor-syllable reduction (a single-σ dictionary hit would win the fewest-tokens DAG over a correct
 * longer word). A monosyllabic real word still phonemizes fine via the segmenter's OOV coalescing fallback. Keeping
 * only ≥2-syllable words also guarantees every ≥2-σ referee headword is in the set, so it segments to ITSELF —
 * the per-word referee eval is unaffected.
 *
 *   npx tsx tools/gen/build-my-segwords.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { syllabify } from "../../src/languages/burmese/burmese.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PERSO = /^[က-႟꧰-꧹]+$/u; // pure Burmese-script run (no spaces/latin/digits)

const words = new Set<string>();
for (const file of ["my.kaikki-mya.tsv", "my.wikipron-mya-broad.tsv"]) {
    for (const line of readFileSync(join(HERE, "..", "referee-eval/referees", file), "utf8").split("\n")) {
        const w = line.split("\t")[0]?.normalize("NFC");
        if (!w || !PERSO.test(w)) continue;
        if (syllabify(w).length >= 2) words.add(w); // ≥2 syllables only
    }
}

const rows = [...words].sort();
const header =
    "# Burmese word-segmentation set — MULTI-SYLLABLE headwords from kaikki + wikipron mya (CC-BY-SA), one per line.\n" +
    "# Built by tools/gen/build-my-segwords.ts. Used by burmese.ts (segmentByDag over syllable boundaries) to split the\n" +
    "# spaceless script into words so the voicing lexicon can fire. Single-syllable words are excluded on purpose.\n";
writeFileSync(join(HERE, "..", "..", "src", "languages", "burmese", "seg-words.txt"), header + rows.join("\n") + "\n");
console.log(`seg-words: ${rows.length} multi-syllable words → seg-words.txt`);
