// Validate French against wikipron fra. Reports the full SYSTEM (Lexique lexicon → g2p OOV) and g2p-ALONE,
// on a corpus given as argv[2] (default the frequency-ranked gold). Shows the lexicon's contribution.
import { readFileSync } from "node:fs";
import { phonemizeWord } from "../src/languages/french/french.ts";
import { toIpa } from "../src/languages/french/g2p.ts";
const goldPath = process.argv[2] ?? "/tmp/fr_freq_gold.tsv";
const ref = readFileSync(goldPath, "utf8").split("\n").filter(Boolean);
let sys = 0, g2p = 0, cov = 0, total = 0;
for (const line of ref) {
  const [w, exp] = line.split("\t");
  if (!w || !exp) continue;
  total++;
  if (phonemizeWord(w) === exp) sys++;
  if (toIpa(w) === exp) g2p++;
  if (phonemizeWord(w) !== toIpa(w)) cov++;  // lexicon hit that differs from g2p (proxy for coverage)
}
console.log(`corpus: ${goldPath.split("/").pop()}  (${total} words)`);
console.log(`  SYSTEM (lexicon → g2p): ${sys}/${total} = ${(100 * sys / total).toFixed(1)}%`);
console.log(`  g2p ALONE:              ${g2p}/${total} = ${(100 * g2p / total).toFixed(1)}%`);
console.log(`  lexicon overrode g2p on ${cov} words (${(100 * cov / total).toFixed(1)}%)`);
