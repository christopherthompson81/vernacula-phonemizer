/**
 * Russian referee sweep: score the native engine against kaikki (Wiktionary) IPA. kaikki marks stress before
 * the syllable ONSET; our engine (like es/pt) marks it before the VOWEL — both are relocated to pre-vowel to
 * compare. kaikki's optional-palatalization ⁽ʲ⁾ and optional (j) / secondary ˌ are folded. Buckets the
 * mismatches. Usage: npx tsx tools/ru-ref-sweep.mts
 */
import { readFileSync } from "node:fs";

import { phonemizeWord } from "../src/languages/russian/russian.ts";

const ref = new Map<string, string>();
for (const line of readFileSync("/mnt/data/ru_kaikki.tsv", "utf8").split("\n")) {
  const tab = line.indexOf("\t");
  if (tab < 0) continue;
  const w = line.slice(0, tab).toLowerCase();
  if (!/^[а-яё]+$/.test(w) || ref.has(w)) continue;
  ref.set(w, line.slice(tab + 1));
}

const V = "aɐəeɛiɪɨoɔuʊæɵ";
// relocate ˈ to immediately before the next vowel (past onset consonants)
const preVowel = (s: string): string => s.replace(new RegExp(`ˈ([^${V}ˈ]*)([${V}])`, "g"), "$1ˈ$2");
const foldRef = (s: string): string => preVowel(s.replace(/⁽ʲ⁾/g, "").replace(/[⁽⁾()ˌ]/g, ""));

const keys = [...ref.keys()];
const stride = Math.max(1, Math.floor(keys.length / 4000));
const sample = keys.filter((_, i) => i % stride === 0);

let match = 0, total = 0;
const buckets = new Map<string, { n: number; ex: string[] }>();
for (const w of sample) {
  const gold = foldRef(ref.get(w)!);
  const ours = phonemizeWord(w);
  total++;
  if (ours === gold) { match++; continue; }
  let p = 0;
  while (p < ours.length && p < gold.length && ours[p] === gold[p]) p++;
  let s = 0;
  while (s < ours.length - p && s < gold.length - p && ours[ours.length - 1 - s] === gold[gold.length - 1 - s]) s++;
  const key = `«${ours.slice(p, ours.length - s) || "∅"}»≠«${gold.slice(p, gold.length - s) || "∅"}»`;
  const b = buckets.get(key) ?? { n: 0, ex: [] };
  b.n++;
  if (b.ex.length < 3) b.ex.push(`${w}:${ours}|${gold}`);
  buckets.set(key, b);
}
console.log(`kaikki referee, sample ${total}: match ${match}/${total} = ${(100 * match / total).toFixed(1)}%\n`);
for (const [k, v] of [...buckets.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 16)) {
  console.log(`  ${String(v.n).padStart(3)} ${k}   ${v.ex[0]}`);
}
