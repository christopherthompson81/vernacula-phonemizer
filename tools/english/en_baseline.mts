import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createEnglishG2p, type EnglishG2pModel } from "../../src/languages/english/englishG2p.ts";
import { MANIFEST } from "../../src/languages/english/manifest.ts";

const EN = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "languages", "english");
const full = new Map<string, string[]>();
for (const l of readFileSync(join(EN, "g2p-dict.tsv"), "utf8").split("\n")) {
    if (l.startsWith("#") || !l.includes("\t")) continue;
    const [w, ph] = l.split("\t"); const wl = w!.toLowerCase();
    if (/^[a-z]+$/.test(wl)) full.set(wl, ph!.split(" "));
}
const heldout = (w: string) => BigInt("0x" + createHash("md5").update("en:" + w).digest("hex")) % 10n === 0n;
const train = new Map<string, string[]>(), te: [string, string[]][] = [];
for (const [w, p] of full) (heldout(w) ? te.push([w, p]) : train.set(w, p));
console.log(`train ${train.size} / held-out ${te.length}`);

const model = JSON.parse(readFileSync(join(EN, "g2p-model.json"), "utf8")) as EnglishG2pModel;
const common = new Set(readFileSync(join(EN, "g2p-common.txt"), "utf8").split("\n").map(s => s.trim()).filter(Boolean));
const classes = { ...MANIFEST.g2pClasses, vowels: MANIFEST.arpabet.vowels };
const g2p = createEnglishG2p(model, train, common, (ph: string[]) => ph.join(" "), classes);

const destress = (ts: string[]) => ts.map(t => t.replace(/[012]$/, ""));
let exact = 0, stressless = 0; const src: Record<string, number> = { C: 0, M: 0, N: 0 };
for (const [w, truth] of te) {
    const d = g2p.decompose(w); src[d.source]!++;
    if (d.phones.join(" ") === truth.join(" ")) exact++;
    if (destress(d.phones).join(" ") === destress(truth).join(" ")) stressless++;
}
const n = te.length;
console.log(`\nCURRENT OOV pipeline (compound→morph→n-gram) held-out (${n} words):`);
console.log(`  WORD exact (incl. stress):   ${exact}/${n} = ${(100 * exact / n).toFixed(1)}%`);
console.log(`  WORD exact (stress-indep):   ${stressless}/${n} = ${(100 * stressless / n).toFixed(1)}%`);
console.log(`  path used: compound ${src.C} / morph ${src.M} / n-gram ${src.N}`);
