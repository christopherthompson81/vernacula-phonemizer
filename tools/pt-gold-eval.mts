/**
 * Evaluate the native EP phonemizer against the ADJUDICATED micro-gold (tools/pt-gold.tsv) — an independent,
 * hand-transcribed EP referee (not Wiktionary-derived). Exact match in our own convention (no folding), so
 * every mismatch is a candidate finding: an engine bug, a lexicon (open/close, x) error, or a gold typo.
 * Usage: npx tsx tools/pt-gold-eval.mts
 */
import { readFileSync } from "node:fs";

import { phonemizeWord } from "../src/languages/portuguese/portuguese.ts";

const rows = readFileSync(new URL("./pt-gold.tsv", import.meta.url), "utf8").split("\n");
let match = 0;
let total = 0;
const misses: string[] = [];
for (const line of rows) {
  if (line === "" || line.startsWith("#")) continue;
  const tab = line.indexOf("\t");
  if (tab < 0) continue;
  const word = line.slice(0, tab);
  const gold = line.slice(tab + 1).trim();
  const ours = phonemizeWord(word);
  total++;
  if (ours === gold) match++;
  else misses.push(`  ${word.padEnd(12)} ours ${ours.padEnd(14)} gold ${gold}`);
}
console.log(`adjudicated gold: ${match}/${total} = ${(100 * match / total).toFixed(1)}%\n`);
if (misses.length) console.log("Mismatches (candidate findings):\n" + misses.join("\n"));
