import { readFileSync } from "node:fs";
import { phonemizeWord } from "../src/languages/arabic/arabic.ts";
const args = new Set(process.argv.slice(2));
// Fold espeak's inconsistent gemination (doubled consonant CC ↔ Cː) to Cː, and its narrow n→m/ŋ place
// assimilation to broad n, and the trailing case-ending vowel (pausal difference).
const gemFold = (s: string): string => s.replace(/(d͡ʒ|sˤ|tˤ|dˤ|ðˤ|[btθħxdðrzsʃʕɣfqklmnhwjʔ])\1/g, "$1ː");
// espeak marks a final short case-vowel (contextual); we transcribe pausal (no case ending) → fold the ref.
const caseFold = (s: string): string => s.replace(/(?<=[btθd͡ʒħxdðrzsʃsˤdˤtˤðˤʕɣfqklmnhwjʔ])[aiu]$/, "");
const stripStress = (s: string): string => caseFold(gemFold(s.replace(/[ˈˌ]/g, "")));
const ref = readFileSync("/tmp/ar_canonical_ref.tsv", "utf8").split("\n").filter(Boolean);
let full = 0, seg = 0, total = 0;
const buckets = new Map<string, { n: number; ex: string[] }>();
for (const line of ref) {
  const [w, exp] = line.split("\t");
  if (!w || !exp) continue;
  total++;
  const a = phonemizeWord(w), b = exp;
  if (gemFold(a) === gemFold(b)) full++;   // full match, crediting equivalent gemination notation
  const sa = stripStress(a), sb = stripStress(b);
  if (sa === sb) { seg++; continue; }   // segment match (ignore stress)
  let p = 0; while (p < sa.length && p < sb.length && sa[p] === sb[p]) p++;
  let s = 0; while (s < sa.length - p && s < sb.length - p && sa[sa.length - 1 - s] === sb[sb.length - 1 - s]) s++;
  const key = `«${sa.slice(p, sa.length - s) || "∅"}» ≠ «${sb.slice(p, sb.length - s) || "∅"}»`;
  const bk = buckets.get(key) || { n: 0, ex: [] };
  bk.n++; if (bk.ex.length < 3) bk.ex.push(`${w}:${a}|${b}`);
  buckets.set(key, bk);
}
console.log(`full (seg+stress): ${full}/${total} = ${(100 * full / total).toFixed(1)}%`);
console.log(`segments only:     ${seg}/${total} = ${(100 * seg / total).toFixed(1)}%`);
const sorted = [...buckets.entries()].sort((a, b) => b[1].n - a[1].n);
console.log(`segment-mismatch buckets: ${sorted.length}`);
for (const [k, v] of sorted.slice(0, 18)) console.log(`  ${String(v.n).padStart(4)}  ${k}   e.g. ${v.ex[0]}`);
