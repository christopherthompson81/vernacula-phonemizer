/**
 * Validate the Hebrew rule g2p against the UNANIMOUS 3-referee consensus gold (tools/hebrew/consensus-gold.tsv,
 * where Wiktionary + Phonikud + ReNikud agree). This is the OBJECTIVE gate for a phase-1 rule change: run it before
 * and after, and accept the change iff the agreement % goes UP. Where the three referees disagreed, the word was
 * excluded from the gold, so this never penalises a genuine convention/ambiguity.
 *
 *   npx tsx tools/hebrew/validate-consensus.ts            # print the agreement %
 *   npx tsx tools/hebrew/validate-consensus.ts --miss     # + list the disagreements (gold <TAB> ours)
 *
 * (Run 11) and build-consensus-gold.py (regeneration).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { phonemizeWord } from "../../src/languages/hebrew/hebrew.ts";

// Canonicalise away notation so only phonemic content is compared (matches the gold builder): strip stress, the tie
// bar (t͡s → ts), and unwrap the Wiktionary optional-parens (ʔ)/(h)/(ʕ) that the gold already folded.
const canon = (s: string): string => s.replace(/[ˈˌ]/g, "").replace(/͡/g, "").replace(/[()]/g, "").replace(/\s+/g, " ").trim();

const goldPath = join(dirname(fileURLToPath(import.meta.url)), "consensus-gold.tsv");
const rows = readFileSync(goldPath, "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));

let ok = 0;
const miss: string[] = [];
for (const [voc, gold] of rows) {
    const ours = canon(phonemizeWord(voc!));
    if (ours === gold) ok++;
    else miss.push(`${gold}\t${ours}\t(${voc})`);
}
console.log(`rule g2p vs unanimous 3-referee consensus: ${ok}/${rows.length} = ${(100 * ok / rows.length).toFixed(1)}%`);
if (process.argv.includes("--miss")) for (const m of miss) console.log("  " + m);
