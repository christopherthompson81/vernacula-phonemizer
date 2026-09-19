import { readFileSync } from "node:fs";
import { mobyToArpabet } from "./tools/english/en_source_compare.mts";
import { makeArpabetToIpa } from "./src/languages/english/englishArpabet.ts";
import { MANIFEST } from "./src/languages/english/manifest.ts";
const syll = new Map<string, number[]>();
for (const l of readFileSync("data/languages/english/en-syllabic.tsv", "utf8").split("\n")) {
    if (!l || l.startsWith("#")) continue; const [w, i] = l.split("\t");
    if (w && i) syll.set(w, i.split(",").map(Number));
}
const toIpa = makeArpabetToIpa(MANIFEST.arpabet, syll);
// Do the repairs actually land? Pick words from each defect class straight out of Moby.
const want = new Set(["abidingness", "abstruseness", "aboriginally", "unilocular", "usucaption", "acetylate"]);
for (const line of readFileSync(process.env["MOBY"]!, "latin1").split(/\r\n|\r|\n/u)) {
    const sp = line.indexOf(" "); if (sp < 0) continue;
    const w = line.slice(0, sp).toLowerCase();
    if (!want.has(w)) continue;
    const a = mobyToArpabet(line.slice(sp + 1)); if (!a) continue;
    console.log(`  ${w.padEnd(16)} raw moby ${a.join(" ")}`);
}
