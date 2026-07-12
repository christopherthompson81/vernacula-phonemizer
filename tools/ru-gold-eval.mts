/**
 * Evaluate the native Russian phonemizer against the ADJUDICATED micro-gold (tools/ru-gold.tsv) — an
 * independent, hand-transcribed EP referee (not Wiktionary-derived). Exact match in our own convention (no
 * folding), so every mismatch is a candidate finding: an engine bug, a stress.tsv / lexicon error, or a gold
 * typo. Usage: npx tsx tools/ru-gold-eval.mts
 */
import { readFileSync } from "node:fs";

import { phonemizeWord } from "../src/languages/russian/russian.ts";

const rows = readFileSync(new URL("./ru-gold.tsv", import.meta.url), "utf8").split("\n");
let match = 0, total = 0;
const misses: string[] = [];
for (const line of rows) {
  if (line === "" || line.startsWith("#") || !line.includes("\t")) continue;
  const tab = line.indexOf("\t");
  const word = line.slice(0, tab);
  const gold = line.slice(tab + 1).trim();
  const ours = phonemizeWord(word);
  total++;
  if (ours === gold) match++;
  else misses.push(`  ${word.padEnd(12)} ours ${ours.padEnd(16)} gold ${gold}`);
}
console.log(`adjudicated gold: ${match}/${total} = ${(100 * match / total).toFixed(1)}%\n`);
if (misses.length) console.log("Mismatches (candidate findings):\n" + misses.join("\n"));
