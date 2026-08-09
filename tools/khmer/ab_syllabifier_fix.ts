/**
 * A/B the PASS-2 guard fixes + the nikahit/⟨ង⟩ merge, per word, against the wikipron referee.
 *
 * Scores `phonemizeWordRules` BEFORE and AFTER on identical folds, so the comparison isolates the engine
 * change. The "before" copy is written by the caller from `git show HEAD:...` into /tmp/kmab/khmer_before.ts;
 * it is the same module, so both sides share the referee, the folds and the loader.
 *
 * Reports the headline delta, a per-class breakdown over the shapes each guard was aimed at, and — the part
 * that matters — every word that REGRESSED, so the trade can be read rather than assumed.
 */
import { readFileSync } from "node:fs";
import { makeFold } from "../referee-eval/eval.ts";
import { CONFIG } from "../referee-eval/config.ts";
import { phonemizeWordRules as after } from "../../src/languages/khmer/khmer.ts";

/**
 * ⚠ DYNAMIC, AND THE PATH IS BUILT RATHER THAN WRITTEN AS A LITERAL. The "before" copy is a scratch file that
 * exists only while an A/B is being run, so a static import would make `tsc --noEmit` fail for everyone else
 * the moment it is deleted. Built from a variable so the checker cannot try to resolve it.
 */
const BEFORE = "../../src/languages/khmer/khmer.before" + ".tmp.ts";
const before = (await import(BEFORE) as { phonemizeWordRules: (w: string) => string }).phonemizeWordRules;

const rows = readFileSync(new URL("../referee-eval/referees/km.wikipron-khm-broad.tsv", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => l.split("\t") as [string, string]);

const cfg = CONFIG.km!;
const fold = makeFold(cfg);
const ok = (out: string, ref: string): boolean => fold(out) === fold(ref.replace(/\s+/gu, ""));

const NIKAHIT = "ំ";
const BANTOC = "់";
const COENG = "្";
/** The shapes each guard targets, for the per-class table. Membership is orthographic, so a word can be in more
 *  than one class; the classes are diagnostic, not a partition. */
const CLASSES: [string, (w: string) => boolean][] = [
    ["bantaq-coda dropped syllable", (w) => w.includes(BANTOC)],
    ["medial-bare onset theft", (w) => new RegExp(`${NIKAHIT}[ក-អ][ក-អ]$`, "u").test(w)],
    ["nikahit + ⟨ង⟩ coda", (w) => w.includes(`${NIKAHIT}ង`)],
    ["final cluster (coeng)", (w) => w.includes(COENG)],
];

let bOk = 0;
let aOk = 0;
const gained: string[] = [];
const lost: [string, string, string, string][] = [];
const cls = new Map(CLASSES.map(([n]) => [n, { n: 0, b: 0, a: 0 }]));

for (const [w, ref] of rows) {
    const b = ok(before(w), ref);
    const a = ok(after(w), ref);
    if (b) bOk++;
    if (a) aOk++;
    if (!b && a) gained.push(w);
    if (b && !a) lost.push([w, ref, before(w), after(w)]);
    for (const [name, test] of CLASSES) {
        if (!test(w)) continue;
        const c = cls.get(name)!;
        c.n++;
        if (b) c.b++;
        if (a) c.a++;
    }
}

const pc = (x: number, n: number): string => `${((100 * x) / n).toFixed(1)}%`;
console.log(`words: ${rows.length}`);
console.log(`folded BEFORE: ${bOk} (${pc(bOk, rows.length)})`);
console.log(`folded AFTER:  ${aOk} (${pc(aOk, rows.length)})`);
console.log(`gained: ${gained.length}   lost: ${lost.length}   net: ${aOk - bOk >= 0 ? "+" : ""}${aOk - bOk}`);
console.log("\nper-class (orthographic shape, diagnostic not a partition):");
for (const [name, c] of cls) {
    console.log(`  ${name.padEnd(30)} n=${String(c.n).padStart(5)}  ${pc(c.b, c.n).padStart(6)} → ${pc(c.a, c.n).padStart(6)}`);
}
console.log(`\nREGRESSIONS (${lost.length}) — word | referee | before | after:`);
for (const [w, ref, b, a] of lost) console.log(`  ${w}\t${ref}\t${b}\t${a}`);
