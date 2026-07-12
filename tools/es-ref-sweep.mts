// Validate the native Spanish g2p against the espeak 1.52 canonical reference (3000 words). Folds our
// deliberate divergences (ɛ→e, ɔ→o laxing) before comparing; buckets the residual by diff-core.
import { readFileSync } from "node:fs";
import { phonemizeWord } from "../src/languages/spanish/spanish.ts";
// Fold espeak's narrow allophony we deliberately leave broad (referee-aligned): vowel laxing ɛ/ɔ, nasal
// place assimilation (ŋ before velars, m before labials), and heuristic secondary stress ˌ.
const fold = (s: string): string => s.replace(/ɛ/g, "e").replace(/ɔ/g, "o").replace(/ŋ/g, "n").replace(/ˌ/g, "");
const ref = readFileSync("/tmp/es_canonical_ref.tsv", "utf8").split("\n").filter(Boolean);
let match = 0, total = 0;
const buckets = new Map<string, { n: number; ex: string[] }>();
for (const line of ref) {
  const [w, exp] = line.split("\t");
  if (!w || !exp) continue;
  total++;
  const a = phonemizeWord(w), b = fold(exp);
  if (a === b) { match++; continue; }
  let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0; while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const key = `«${a.slice(p, a.length - s) || "∅"}» ≠ «${b.slice(p, b.length - s) || "∅"}»`;
  const bk = buckets.get(key) || { n: 0, ex: [] };
  bk.n++; if (bk.ex.length < 4) bk.ex.push(`${w}:${a}|${b}`);
  buckets.set(key, bk);
}
console.log(`agreement: ${match}/${total} = ${(100 * match / total).toFixed(1)}%`);
const sorted = [...buckets.entries()].sort((a, b) => b[1].n - a[1].n);
console.log(`mismatch buckets: ${sorted.length}`);
for (const [k, v] of sorted.slice(0, 22)) console.log(`  ${String(v.n).padStart(4)}  ${k}   e.g. ${v.ex.slice(0,2).join("  ")}`);
