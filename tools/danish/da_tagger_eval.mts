/**
 * Danish tagger held-out eval — reports the perceptron tagger vs the rule engine on the SAME held-out OOV split,
 * folded identically (the da.jsonc folds + backbone). Run tools/danish/da_tagger_prototype.py first (it writes the
 * 90/10 held-out predictions to /tmp/da_holdout.tsv); this reports both folded %. See the investigation doc.
 */
import { readFileSync } from "node:fs";
import { CONFIG } from "/home/chris/Programming/vernacula-phonemizer/tools/referee-eval/config.ts";
import { makeFold } from "/home/chris/Programming/vernacula-phonemizer/tools/referee-eval/eval.ts";
import { phonemizeWordRules } from "/home/chris/Programming/vernacula-phonemizer/src/languages/danish/danish.ts";
const cfg = CONFIG["da"]!, fold = makeFold(cfg, cfg.referees[0]!.folds);
const rows = readFileSync("/tmp/da_holdout.tsv","utf8").split("\n").filter(l=>l.trim()).map(l=>l.split("\t"));
let tagOk=0, ruleOk=0, n=0;
const ex:string[]=[];
for (const [w, ref, tag] of rows) {
  if (!w||!ref) continue; n++;
  const t = fold(ref), a = fold(tag||""), r = fold(phonemizeWordRules(w));
  if (a===t) tagOk++;
  if (r===t) ruleOk++;
  if (ex.length<12 && a===t && r!==t) ex.push(`  TAGGER wins: ${w}  tag=${a}  rule=${r}  ref=${t}`);
}
console.log(`held-out (${n} OOV words), folded backbone:`);
console.log(`  RULE engine:   ${ruleOk}/${n} = ${(100*ruleOk/n).toFixed(1)}%`);
console.log(`  TAGGER (proto): ${tagOk}/${n} = ${(100*tagOk/n).toFixed(1)}%`);
for (const l of ex) console.log(l);
