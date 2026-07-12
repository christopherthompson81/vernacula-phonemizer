// Full referee sweep for cmn. Compares our segmental IPA against independent referees after normalizing
// away notation conventions, then buckets the residual so real defects separate from convention diffs.
import { readFileSync } from "node:fs";

const args = new Set(process.argv.slice(2));
const LENIENT = args.has("--lenient"); // also fold adjudicated vowel-quality conventions

/** Normalize an IPA string to a convention-neutral comparison form. */
function norm(s) {
  let x = s.normalize("NFD");
  x = x.replace(/[˥˦˧˨˩¹²³⁴⁵]/g, "");          // tones
  x = x.replace(/[ \t]/g, "");
  x = x.replace(/͡/g, "");                  // tie ͡  (ʈ͡ʂ → ʈʂ)
  x = x.replace(/[ᶦⁱᵢ]/g, "i").replace(/[ᵘᶷᵁ]/g, "u"); // our superscript offglides → base (U+2071/U+1D58/…)
  x = x.replace(/̯/g, "");                  // referee subscript inverted breve (i̯ → i)
  x = x.replace(/w/g, "u").replace(/j/g, "i");   // onset glides w/j ↔ u/i (no phonemic contrast in cmn)
  // apical/retroflex syllabic vowel: unify ʐ̩ z̩ ɻ̩ ɹ̩ → one class
  x = x.replace(/[ʐzɻɹʑ]̩/g, "ɹ̩");
  x = x.replace(/ɪ/g, "i").replace(/ii+/g, "i").replace(/uu+/g, "u");
  if (LENIENT) {
    x = x.replace(/ä/g, "a").replace(/ɑ/g, "a"); // ä, ɑ → a
    x = x.replace(/ɔ/g, "o");                          // ɔ → o (our -uo/-o convention)
    x = x.replace(/ʊ/g, "o");                          // ʊ → o (our -ong convention)
  }
  return x.normalize("NFC");
}

function loadTsv(path, sep = "\t") {
  const m = new Map();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf(sep);
    if (i > 0) m.set(line.slice(0, i), line.slice(i + 1));
  }
  return m;
}

const ours = loadTsv("src/languages/mandarin/syllable-ipa.tsv");
const epi = loadTsv("/tmp/cmn_epitran.tsv");

let match = 0, total = 0;
const buckets = new Map();
for (const [syl, ref] of epi) {
  if (ref === "ERR" || !ours.has(syl)) continue;
  total++;
  const a = norm(ours.get(syl)), b = norm(ref);
  if (a === b) { match++; continue; }
  // diff-core: strip shared prefix/suffix so systematic substitutions aggregate.
  let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0; while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const key = `«${a.slice(p, a.length - s) || "∅"}» ≠ «${b.slice(p, b.length - s) || "∅"}»`;
  const bk = buckets.get(key) || { n: 0, ex: [] };
  bk.n++; if (bk.ex.length < 4) bk.ex.push(syl);
  buckets.set(key, bk);
}
console.log(`\n=== cmn vs epitran cmn-Latn ${LENIENT ? "(lenient: +vowel folds)" : "(notation-only)"} ===`);
console.log(`agreement: ${match}/${total} = ${(100 * match / total).toFixed(1)}%`);
const sorted = [...buckets.entries()].sort((a, b) => b[1].n - a[1].n);
console.log(`mismatch buckets: ${sorted.length}`);
for (const [k, v] of sorted.slice(0, 25)) console.log(`  ${String(v.n).padStart(3)}  ${k}   e.g. ${v.ex.join(",")}`);
