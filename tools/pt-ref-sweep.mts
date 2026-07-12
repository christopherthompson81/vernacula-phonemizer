/**
 * Portuguese referee sweep: score the native engine against wikipron European Portuguese
 * (por_latn_po_broad_filtered). wikipron omits stress and coda-l velarization, so both sides are normalized
 * (strip ˈ, ɫ→l) to compare SEGMENTS only. Buckets the mismatches by the differing substring so the residual
 * composition (open/close vowels, x, real bugs, wikipron noise) is visible. Usage: npx tsx tools/pt-ref-sweep.mts
 */
import { readFileSync } from "node:fs";

import { phonemizeWord } from "../src/languages/portuguese/portuguese.ts";

const REF = "/mnt/data/wp_por_latn_po_broad_filtered.tsv";

// First pronunciation per (lowercased) word; skip multi-word and non-letter entries.
const ref = new Map<string, string>();
for (const line of readFileSync(REF, "utf8").split("\n")) {
  const tab = line.indexOf("\t");
  if (tab < 0) continue;
  const word = line.slice(0, tab);
  if (!/^[a-zà-ÿ]+$/i.test(word)) continue;
  const ipa = line.slice(tab + 1).replace(/ /g, "");
  const key = word.toLowerCase();
  if (!ref.has(key)) ref.set(key, ipa);
}

// Uniform sample across the alphabet (wikipron is alphabetical) so the measure isn't all "ab-" words.
const keys = [...ref.keys()];
const stride = Math.max(1, Math.floor(keys.length / 4000));
const sample = keys.filter((_, i) => i % stride === 0);

// Base normalization: wikipron omits stress and coda-l velarization.
const norm = (s: string): string => s.replace(/ˈ/g, "").replace(/ɫ/g, "l");
// Fold the referee's own conventions that differ from standard Lisbon EP: betacism (intervocalic v→b) and the
// conservative affricate ch→t͡ʃ (Lisbon standard is ʃ). Applied to BOTH sides purely to measure engine quality.
const fold = (s: string): string => norm(s).replace(/t͡ʃ/g, "ʃ").replace(/v/g, "b");

let match = 0;
let folded = 0;
let total = 0;
const buckets = new Map<string, { n: number; ex: string[] }>();
for (const w of sample) {
  const gold = norm(ref.get(w)!);
  const ours = norm(phonemizeWord(w));
  total++;
  if (fold(ref.get(w)!) === fold(phonemizeWord(w))) folded++;
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

console.log(`referee: wikipron por_latn_po (${ref.size} entries), sample ${total}`);
console.log(`SEGMENTAL match (stress + ɫ normalized): ${match}/${total} = ${(100 * match / total).toFixed(1)}%`);
console.log(`FOLDED match (+ betacism v↔b, ch t͡ʃ↔ʃ = referee convention): ${folded}/${total} = ${(100 * folded / total).toFixed(1)}%\n`);
console.log("Top mismatch buckets (ours ≠ gold):");
for (const [k, v] of [...buckets.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 16)) {
  console.log(`  ${String(v.n).padStart(3)} ${k}   ${v.ex.join("  ")}`);
}
