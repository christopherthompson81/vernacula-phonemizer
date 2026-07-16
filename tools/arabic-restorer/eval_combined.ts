/**
 * Two-layer eval, mirroring the Arabic diacritizer's architecture (neural BiLSTM + `restore.ts` lexicon):
 *   LEXICON (the mined harakat.<lang>.silver.tsv, exact skeleton→vocalized match) → else NEURAL prediction.
 * The lexicon is the Arabic `diacritization.tsv` analogue for the riders — for words we've seen (from wikipron),
 * we use the exact vocalization; novel words fall to the neural model. Reports, per language: lexicon coverage,
 * neural-only accuracy, and the combined system, on the FULL wikipron rider set.
 *
 * HONEST CAVEAT: lexicon-hit words match by construction (the labels were mined to reproduce this reference), so
 * "combined" ≈ coverage + neural-on-the-rest. This is TYPE-level on wikipron; production is TOKEN-level, where the
 * combined number is HIGHER (common words recur and are in the lexicon). It's the "for words we've seen, exact"
 * guarantee — not a held-out generalization metric (that's eval_endtoend on eval_set.tsv).
 *
 *   predict_harakat.py --in /tmp/allrider.tsv --out /tmp/allpred.tsv   # neural on the full rider set, first
 *   npx tsx eval_combined.ts /tmp/allpred.tsv
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
const fold: Record<string, (s: string) => string> = {};
for (const l of Object.keys(PHON)) fold[l] = makeFold(CONFIG[l]!);

// Reference: (silver-code \t skeleton) → set of FOLDED ref IPAs (a word has several wikipron pronunciations).
const ref = new Map<string, Set<string>>();
for (const line of readFileSync(join(HERE, "silver.tsv"), "utf8").split("\n")) {
    const p = line.split("\t");
    if (p.length < 3) continue;
    const lang = Object.keys(SILVER_CODE).find((l) => SILVER_CODE[l] === p[1]);
    if (!lang) continue;
    const key = `${p[1]}\t${p[0]}`;
    (ref.get(key) ?? ref.set(key, new Set()).get(key)!).add(fold[lang]!(p[2]!));
}

// Lexicon: skeleton → vocalized, per language (the mined labels).
const lex: Record<string, Map<string, string>> = {};
for (const l of Object.keys(PHON)) {
    lex[l] = new Map();
    for (const line of readFileSync(join(HERE, `harakat.${l}.silver.tsv`), "utf8").split("\n")) {
        const p = line.split("\t");
        if (p.length >= 3) lex[l]!.set(p[0]!, p[2]!);
    }
}

// Neural predictions on the full rider set.
const neural = new Map<string, string>();
for (const line of readFileSync(process.argv[2] ?? "/tmp/allpred.tsv", "utf8").split("\n")) {
    const [skel, lang, voc] = line.split("\t");
    if (skel && lang && voc !== undefined) neural.set(`${lang}\t${skel}`, voc);
}

const hit = (lang: string, voc: string, refs: Set<string>): boolean => refs.has(fold[lang]!(PHON[lang]!(voc)));

const stat: Record<string, { n: number; cov: number; neu: number; comb: number }> = {};
const done = new Set<string>();
for (const [key, refs] of ref) {
    const [code, skel] = key.split("\t");
    const lang = Object.keys(SILVER_CODE).find((l) => SILVER_CODE[l] === code);
    if (!lang || done.has(key)) continue;
    done.add(key);
    const s = (stat[lang] ??= { n: 0, cov: 0, neu: 0, comb: 0 });
    s.n++;
    const inLex = lex[lang]!.has(skel!);
    const neuVoc = neural.get(`${lang}\t${skel}`) ?? skel!;
    const combVoc = inLex ? lex[lang]!.get(skel!)! : neuVoc;
    if (inLex) s.cov++;
    if (hit(lang, neuVoc, refs)) s.neu++;
    if (hit(lang, combVoc, refs)) s.comb++;
}

console.log(`\nTwo-layer system on the FULL wikipron rider set (lexicon → neural):\n`);
console.log(`${"lang".padEnd(6)}${"n".padStart(7)}${"lex-cov".padStart(9)}${"neural".padStart(9)}${"combined".padStart(10)}`);
console.log("-".repeat(41));
for (const lang of Object.keys(PHON)) {
    const s = stat[lang];
    if (!s?.n) continue;
    const p = (x: number) => (100 * x / s.n).toFixed(1) + "%";
    console.log(`${lang.padEnd(6)}${String(s.n).padStart(7)}${p(s.cov).padStart(9)}${p(s.neu).padStart(9)}${p(s.comb).padStart(10)}`);
}
