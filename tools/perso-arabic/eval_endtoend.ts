/**
 * End-to-end eval for the multilingual harakat restorer: predicted harakat →[deterministic g2p]→ IPA, compared to
 * the wikipron reference under the referee-eval fold, MODEL vs the bare-skeleton BASELINE (default schwa). This is
 * the real metric the restorer exists to move — does the model's vocalization make the g2p reproduce the reference,
 * and does it beat leaving the abjad bare. Run on the held-out eval split.
 *
 *   predict_harakat.py --in eval.tsv --out /tmp/pred.tsv   # first
 *   npx tsx eval_endtoend.ts /tmp/pred.tsv
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phonemizeWord as pa } from "../../src/languages/punjabi/punjabi.ts";
import { phonemizeWord as ur } from "../../src/languages/urdu/urdu.ts";
import { phonemizeWord as ps } from "../../src/languages/pashto/pashto.ts";
import { phonemizeWord as fa } from "../../src/languages/persian/persian.ts";
import { makeFold } from "../referee-eval/eval.ts";
import { CONFIG } from "../referee-eval/config.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PHON: Record<string, (w: string) => string> = { pa, ur, ps, fa };
const SILVER_CODE: Record<string, string> = { pa: "pan", ur: "urd", ps: "pus", fa: "fas" };

// Reference IPA per (skeleton, silver-code) from the wikipron silver set.
const ref = new Map<string, string>();
for (const line of readFileSync(join(HERE, "silver.tsv"), "utf8").split("\n")) {
    const p = line.split("\t");
    if (p.length >= 3) ref.set(`${p[1]}\t${p[0]}`, p[2]!);
}

const predFile = process.argv[2] ?? "/tmp/pred.tsv";
const fold: Record<string, (s: string) => string> = {};
for (const l of Object.keys(PHON)) fold[l] = makeFold(CONFIG[l]!);

const stat: Record<string, { n: number; base: number; model: number }> = {};
for (const line of readFileSync(predFile, "utf8").split("\n")) {
    const [skel, lang, voc] = line.split("\t");
    if (!skel || !lang || !PHON[lang]) continue;
    const r = ref.get(`${SILVER_CODE[lang]}\t${skel}`);
    if (r === undefined) continue;
    const target = fold[lang]!(r);
    const st = (stat[lang] ??= { n: 0, base: 0, model: 0 });
    st.n++;
    if (fold[lang]!(PHON[lang]!(skel)) === target) st.base++; // bare skeleton (default schwa)
    if (fold[lang]!(PHON[lang]!(voc!)) === target) st.model++; // model harakat → g2p
}

console.log(`\nEnd-to-end IPA match (held-out) — bare-skeleton BASELINE vs MODEL harakat → g2p:\n`);
console.log(`${"lang".padEnd(6)}${"n".padStart(6)}${"baseline".padStart(11)}${"model".padStart(9)}${"lift".padStart(9)}`);
console.log("-".repeat(41));
let tn = 0, tb = 0, tm = 0;
for (const lang of Object.keys(PHON)) {
    const s = stat[lang];
    if (!s || !s.n) continue;
    tn += s.n; tb += s.base; tm += s.model;
    const b = (100 * s.base / s.n), m = (100 * s.model / s.n);
    console.log(`${lang.padEnd(6)}${String(s.n).padStart(6)}${(b.toFixed(1) + "%").padStart(11)}${(m.toFixed(1) + "%").padStart(9)}${("+" + (m - b).toFixed(1)).padStart(9)}`);
}
console.log("-".repeat(41));
const b = (100 * tb / tn), m = (100 * tm / tn);
console.log(`${"ALL".padEnd(6)}${String(tn).padStart(6)}${(b.toFixed(1) + "%").padStart(11)}${(m.toFixed(1) + "%").padStart(9)}${("+" + (m - b).toFixed(1)).padStart(9)}`);
