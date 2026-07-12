// Second referee: our syllable segments vs wikipron cmn (Hanzi→IPA), over the full char inventory. For each
// char we credit a match if wikipron's segments equal ANY of our attested readings (isolating segment
// quality from polyphone selection). Same normalizer as the epitran sweep.
import { readFileSync } from "node:fs";
const LENIENT = process.argv.includes("--lenient");
function norm(s: string): string {
  let x = s.normalize("NFD").replace(/[˥˦˧˨˩¹²³⁴⁵]/g, "").replace(/[ \t]/g, "").replace(/͡/g, "");
  x = x.replace(/[ᶦⁱᵢ]/g, "i").replace(/[ᵘᶷᵁ]/g, "u").replace(/̯/g, "");
  x = x.replace(/w/g, "u").replace(/j/g, "i").replace(/[ʐzɻɹʑ]̩/g, "ɹ̩");
  x = x.replace(/ɪ/g, "i").replace(/ii+/g, "i").replace(/uu+/g, "u");
  if (LENIENT) x = x.replace(/a\u0308/g, "a").replace(/ä/g, "a").replace(/ɑ/g, "a").replace(/ɔ/g, "o").replace(/ʊ/g, "o");
  return x.normalize("NFC");
}
const table = new Map<string, string>();
for (const l of readFileSync("src/languages/mandarin/syllable-ipa.tsv", "utf8").split("\n")) {
  if (!l || l.startsWith("#")) continue; const i = l.indexOf("\t"); if (i > 0) table.set(l.slice(0, i), l.slice(i + 1));
}
const chars = new Map<string, string[]>();
for (const l of readFileSync("src/languages/mandarin/chars.tsv", "utf8").split("\n")) {
  if (!l || l.startsWith("#")) continue; const i = l.indexOf("\t"); if (i > 0) chars.set(l.slice(0, i), l.slice(i + 1).split(","));
}
const W = "/home/chris/Programming/espeak-ng-portable/tools/multi-referee/.cache/wikipron_cmn_hani_standard_broad.tsv";
let match = 0, total = 0, noread = 0;
const buckets = new Map<string, { n: number; ex: string[] }>();
const seen = new Set<string>();
for (const l of readFileSync(W, "utf8").split("\n")) {
  const [ch, ref] = l.split("\t");
  if (!ch || !ref || [...ch].length !== 1 || seen.has(ch)) continue;
  seen.add(ch);
  const reads = chars.get(ch); if (!reads) continue;
  const ourSegs = reads.map((r) => table.get(r.replace(/[1-5]$/, ""))).filter(Boolean).map((s) => norm(s!));
  if (ourSegs.length === 0) { noread++; continue; }
  total++;
  const b = norm(ref);
  if (ourSegs.includes(b)) { match++; continue; }
  const key = `«${ourSegs[0]}» ≠ «${b}»`;
  const bk = buckets.get(key) || { n: 0, ex: [] }; bk.n++; if (bk.ex.length < 3) bk.ex.push(ch); buckets.set(key, bk);
}
console.log(`\n=== cmn vs wikipron (Hanzi, credit-any-reading) ${LENIENT ? "(lenient)" : "(notation-only)"} ===`);
console.log(`agreement: ${match}/${total} = ${(100 * match / total).toFixed(1)}%  (chars with no covered reading: ${noread})`);
const sorted = [...buckets.entries()].sort((a, b) => b[1].n - a[1].n);
console.log(`mismatch buckets: ${sorted.length}`);
for (const [k, v] of sorted.slice(0, 18)) console.log(`  ${String(v.n).padStart(4)}  ${k}   e.g. ${v.ex.join(",")}`);
