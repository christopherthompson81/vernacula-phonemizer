/**
 * Danish rule-probe: for each word in the aligned lexicon (/tmp/da_aligned.tsv, word<TAB>"g:tag …"), reconstruct the
 * gold IPA (concat of tags), fold it and the RULE engine's output identically, and write the words the rules get
 * WRONG → /tmp/da_wrong.txt. mine_da_rules.py then ranks hot contexts by their frequency in these wrong words.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { CONFIG } from "../referee-eval/config.ts";
import { makeFold } from "../referee-eval/eval.ts";
import { phonemizeWordRules } from "../../src/languages/danish/danish.ts";
const cfg = CONFIG["da"]!, fold = makeFold(cfg, cfg.referees[0]!.folds);
const wrong: string[] = [];
for (const line of readFileSync("/tmp/da_aligned.tsv", "utf8").split("\n")) {
    if (!line.trim()) continue;
    const [w, tags] = line.split("\t");
    const gold = (tags ?? "").split(" ").map((p) => p.split(":").slice(1).join(":")).join("");
    if (fold(gold) !== fold(phonemizeWordRules(w!))) wrong.push(w!);
}
writeFileSync("/tmp/da_wrong.txt", wrong.join("\n"));
console.log(`rule engine wrong on ${wrong.length} lexicon words → /tmp/da_wrong.txt`);
