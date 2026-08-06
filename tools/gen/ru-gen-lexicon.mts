/**
 * Generate the Russian loanword hard-е/и correction table (src/languages/russian/hard-e.tsv) from kaikki. For
 * each word we run the rule engine and record the vowel ordinals where the engine emits a SOFT-context e/i but
 * the referee has a HARD-consonant ɛ/ɨ (loanword: тест → tɛst, not tʲest). Row: word<TAB>ord[,ord...].
 * Usage: npx tsx tools/ru-gen-lexicon.mts
 */
import { readFileSync, writeFileSync } from "node:fs";

import { toIpa } from "../../src/languages/russian/g2p.ts";

const V = "aɐəeɛiɪɨoɔuʊæɵ";
const vowels = (s: string): string[] => [...s.matchAll(new RegExp(`[${V}]`, "g"))].map((m) => m[0]);
const foldRef = (s: string): string => s.replace(/⁽ʲ⁾/g, "").replace(/[⁽⁾()ˌ]/g, "");

// stress ordinal (same extraction as stress.tsv) — needed to phonemize.
const stress = new Map<string, number>();
for (const line of readFileSync("src/languages/russian/stress.tsv", "utf8").split("\n")) {
  if (line === "" || line.startsWith("#")) continue;
  const tab = line.indexOf("\t");
  if (tab > 0) stress.set(line.slice(0, tab), Number(line.slice(tab + 1)));
}

const rows: string[] = [];
const seen = new Set<string>();
for (const line of readFileSync((process.env["DUMPS"] ?? ".") + "/ru_kaikki.tsv", "utf8").split("\n")) {
  const tab = line.indexOf("\t");
  if (tab < 0) continue;
  const w = line.slice(0, tab).toLowerCase();
  if (!/^[а-яё]+$/.test(w) || seen.has(w)) continue;
  seen.add(w);
  const ord = stress.get(w);
  if (ord === undefined) continue;
  const ours = vowels(toIpa(w, ord));
  const gold = vowels(foldRef(line.slice(tab + 1)));
  const cyrV = [...w].filter((c) => "аеёиоуыэюя".includes(c)); // Cyrillic vowel letters, in order
  if (ours.length !== gold.length || ours.length !== cyrV.length) continue; // align only when all three match
  const hard: number[] = [];
  for (let i = 0; i < ours.length; i++) {
    if (cyrV[i] === "е" && ours[i] === "e" && gold[i] === "ɛ") hard.push(i);      // hard е (loanword): soft e → ɛ
    else if (cyrV[i] === "и" && ours[i] === "i" && gold[i] === "ɨ") hard.push(i); // hard и (loanword): soft i → ɨ
  }
  if (hard.length) rows.push(`${w}\t${hard.join(",")}`);
}
rows.sort();
writeFileSync("src/languages/russian/hard-e.tsv",
  "# Russian loanword hard-consonant-before-е/и corrections — word<TAB>vowel-ordinals (тест → tɛst). From kaikki.\n" + rows.join("\n") + "\n");
console.log(`wrote ${rows.length} hard-е/и correction rows`);
