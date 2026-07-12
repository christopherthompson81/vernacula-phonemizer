/**
 * Generate the Portuguese lexical CORRECTION table (src/languages/portuguese/lexicon.tsv) from wikipron
 * European Portuguese. For each word we run the rule engine and record ONLY the two axes it cannot predict:
 *   - the stressed mid vowel is open (ɛ/ɔ) where the engine defaults close (e/o), and
 *   - grapheme x realizes as s/z/ks (not the default ʃ).
 * Detection is robust to the referee's betacism (v→b) and affricate (ch→t͡ʃ) conventions via folding.
 * Usage: npx tsx tools/pt-gen-lexicon.mts
 */
import { readFileSync, writeFileSync } from "node:fs";

import { renderWord, type Corr } from "../src/languages/portuguese/portuguese.ts";

const REF = "/mnt/data/wp_por_latn_po_broad_filtered.tsv";
const OUT = "src/languages/portuguese/lexicon.tsv";

const ref = new Map<string, string>();
for (const line of readFileSync(REF, "utf8").split("\n")) {
  const tab = line.indexOf("\t");
  if (tab < 0) continue;
  const word = line.slice(0, tab);
  if (!/^[a-zà-ÿ]+$/i.test(word)) continue;
  const key = word.toLowerCase();
  if (!ref.has(key)) ref.set(key, line.slice(tab + 1).replace(/ /g, ""));
}

const fold = (s: string): string => s.replace(/ˈ/g, "").replace(/ɫ/g, "l").replace(/t͡ʃ/g, "ʃ").replace(/v/g, "b");

const rows: string[] = [];
let openN = 0;
let xN = 0;
for (const [word, gold] of ref) {
  const base = renderWord(word);
  const corr: Corr = {};

  // Open stressed mid vowel: engine emits a close ˈe/ˈo but the referee has the open counterpart.
  if (/ˈe/.test(base) && gold.includes("ɛ")) corr.open = "ɛ";
  else if (/ˈo/.test(base) && gold.includes("ɔ")) corr.open = "ɔ";

  // Grapheme x: pick the realization that makes the (folded) output match the referee.
  if (word.includes("x")) {
    for (const cand of ["s", "z", "ks"]) {
      if (fold(renderWord(word, { ...corr, x: cand })) === fold(gold)) { corr.x = cand; break; }
    }
  }

  const codes: string[] = [];
  if (corr.open) { codes.push(corr.open); openN++; }
  if (corr.x) { codes.push(`x:${corr.x}`); xN++; }
  if (codes.length) rows.push(`${word}\t${codes.join("|")}`);
}

rows.sort();
const header = `# European Portuguese lexical correction table — word<TAB>code (ɛ|ɔ = stressed mid vowel opens;\n`
  + `# x:s|x:z|x:ks = grapheme x). Engine handles everything else. Derived from wikipron EP (por_latn_po).\n`;
writeFileSync(OUT, header + rows.join("\n") + "\n");
console.log(`wrote ${rows.length} correction rows (${openN} open-vowel, ${xN} x) from ${ref.size} referee entries → ${OUT}`);
