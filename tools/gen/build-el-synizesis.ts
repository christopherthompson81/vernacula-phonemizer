/**
 * Build the Greek SYNIZESIS lexicon (src/languages/greek/greek-synizesis.tsv) from the CROSS-SOURCE CONSENSUS of
 * wikipron ∩ kaikki. A word is added iff: (a) the two referees AGREE on its pronunciation (consensus), (b) our
 * rule engine's DEFAULT output differs from that consensus, and (c) forcing synizesis at every site EXACTLY matches
 * the consensus. So the lexicon records the lexical fact "this word fully synizes", verified by two referees and
 * expressed in OUR own convention (the forced-synizesis output) — not by memorising arbitrary referee IPA. Applied
 * on the shipped path only; the referee eval uses phonemizeWordRules, so the measured % stays non-circular.
 *
 *   npx tsx tools/gen/build-el-synizesis.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { phonemizeWordRules, phonemizeWordForced } from "../../src/languages/greek/greek.ts";

const REF = "tools/referee-eval/referees";
const OUT = "src/languages/greek/greek-synizesis.tsv";

// Mirror the eval's backbone + folds so "consensus" means the same thing the eval measures.
const clean = (s: string): string =>
    s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[ˈˌːˑ‿͜͡\s.]/g, "")
        .replace(/ɾ/g, "r");

function load(path: string): Map<string, string[]> {
    const m = new Map<string, string[]>();
    for (const line of readFileSync(path, "utf8").trim().split("\n")) {
        const [w, ...vars] = line.split("\t");
        if (w) m.set(w, vars);
    }
    return m;
}

const wp = load(`${REF}/el.wikipron-ell-grek.tsv`);
const kk = load(`${REF}/el.kaikki-greek.tsv`);

const out: string[] = [];
let considered = 0;
for (const [w, wpVars] of wp) {
    const kkVars = kk.get(w);
    if (!kkVars) continue;
    // Consensus = a cleaned form both referees list.
    const wpSet = new Set(wpVars.map(clean));
    const consensus = kkVars.map(clean).find((c) => wpSet.has(c));
    if (consensus === undefined) continue;
    const rule = clean(phonemizeWordRules(w));
    if (rule === consensus) continue; // rule already right → no lexicon entry
    considered++;
    if (clean(phonemizeWordForced(w)) === consensus) out.push(w.toLowerCase());
}

const uniq = [...new Set(out)].sort();
writeFileSync(OUT, uniq.map((w) => `${w}\tsyn`).join("\n") + "\n");
console.log(`synizesis lexicon: ${uniq.length} words (of ${considered} rule-vs-consensus mismatches where forcing synizesis was tested) → ${OUT}`);
