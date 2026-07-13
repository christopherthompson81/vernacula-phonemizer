/**
 * Generate the Portuguese lexical CORRECTION table (src/languages/portuguese/lexicon.tsv) from wikipron
 * European Portuguese. For each word we run the rule engine and record ONLY what it cannot predict:
 *   - the STRESSED mid vowel is open (ɛ/ɔ) where the engine defaults close (e/o),
 *   - grapheme x realizes as s/z/ks (not the default ʃ), and
 *   - a word-initial e is e/ɛ (overriding the default i-raising).
 * Open/init detection is aligned to the stressed / initial nucleus by vowel index (NOT a blind substring
 * search — a pretonic ɛ/ɔ must not open the stressed vowel). Robust to the referee's betacism / affricate via
 * folding. Usage: npx tsx tools/pt-gen-lexicon.mts
 */
import { readFileSync, writeFileSync } from "node:fs";

import { renderWord, type Corr } from "../src/languages/portuguese/portuguese.ts";

const REF = "/mnt/data/wp_por_latn_po_broad_filtered.tsv";
const OUT = "src/languages/portuguese/lexicon.tsv";

// word → first pronunciation, kept SPACE-separated (phones) for per-vowel alignment.
const ref = new Map<string, string>();
for (const line of readFileSync(REF, "utf8").split("\n")) {
  const tab = line.indexOf("\t");
  if (tab < 0) continue;
  const word = line.slice(0, tab);
  if (!/^[a-zà-ÿ]+$/i.test(word)) continue;
  const key = word.toLowerCase();
  if (!ref.has(key)) ref.set(key, line.slice(tab + 1).trim());
}

const fold = (s: string): string => s.replace(/ˈ/g, "").replace(/ɫ/g, "l").replace(/t͡ʃ/g, "ʃ").replace(/v/g, "b");
const GLIDES = new Set(["j", "w", "j̃", "w̃"]);
// Ordered vowel nuclei of our output; each notes whether it carries the stress mark.
const ourVowels = (s: string): { v: string; stressed: boolean }[] =>
  [...s.matchAll(/(ˈ)?([aɐɛeiɔouɨ])/g)].map((m) => ({ v: m[2]!, stressed: !!m[1] }));
// Ordered vowel nuclei of the (space-separated) referee pronunciation, glides excluded.
const goldVowels = (g: string): string[] =>
  g.split(" ").filter((p) => /^[aɐɛeiɔouɨ]/.test(p) && !GLIDES.has(p));

const rows: string[] = [];
const counts = { open: 0, x: 0, initE: 0 };
for (const [word, gold] of ref) {
  const base = renderWord(word);
  const bv = ourVowels(base);
  const gv = goldVowels(gold);
  const corr: Corr = {};

  if (bv.length === gv.length) {                                   // aligned only when the nucleus counts agree
    const si = bv.findIndex((x) => x.stressed);
    if (si >= 0) {
      const gs = gv[si]!;                                          // the referee's STRESSED vowel
      if (bv[si]!.v === "e" && gs.startsWith("ɛ")) corr.open = "ɛ";
      else if (bv[si]!.v === "o" && gs.startsWith("ɔ")) corr.open = "ɔ";
    }
    // Word-initial e: engine raised it to i, but the referee's first vowel is e/ɛ.
    if (word[0] === "e" && bv[0] && bv[0]!.v === "i" && !bv[0]!.stressed && (gv[0] === "e" || gv[0] === "ɛ")) {
      corr.initE = gv[0];
    }
  }

  if (word.includes("x")) {                                        // x: the realization that folds to the referee
    for (const cand of ["s", "z", "ks"]) {
      if (fold(renderWord(word, { ...corr, x: cand })) === fold(gold.replace(/ /g, ""))) { corr.x = cand; break; }
    }
  }

  const codes: string[] = [];
  if (corr.open) { codes.push(corr.open); counts.open++; }
  if (corr.x) { codes.push(`x:${corr.x}`); counts.x++; }
  if (corr.initE) { codes.push(`e:${corr.initE}`); counts.initE++; }
  if (codes.length) rows.push(`${word}\t${codes.join("|")}`);
}

rows.sort();
const header = `# European Portuguese lexical correction table — word<TAB>code. ɛ|ɔ = stressed mid vowel opens;\n`
  + `# x:s|x:z|x:ks = grapheme x; e:e|e:ɛ = word-initial e (vs the default i). Engine handles everything else.\n`
  + `# Derived from wikipron EP (por_latn_po) — tools/pt-gen-lexicon.mts.\n`;
writeFileSync(OUT, header + rows.join("\n") + "\n");
console.log(`wrote ${rows.length} rows (${counts.open} open, ${counts.x} x, ${counts.initE} initial-e) from ${ref.size} entries → ${OUT}`);
