/**
 * Referee eval — validate a vernacula phonemizer's SEGMENTAL BACKBONE against INDEPENDENT referees (epitran /
 * wikipron), not against espeak. espeak-canonical parity is only a regression guard; this measures linguistic
 * corroboration. Per referee it reports raw + folded agreement and the top residual divergences — the folded
 * residual is the linguistic signal to adjudicate against published phonology (referees are fallible; a
 * divergence is a candidate, not a verdict). See config.ts for the per-language fold justifications.
 *
 * Usage:  npx tsx tools/referee-eval/eval.ts <zu|si|kk> [--examples N]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { phonemizeWord as zu } from "../../src/languages/zulu/zulu.ts";
import { phonemizeWord as si } from "../../src/languages/sinhala/sinhala.ts";
import { phonemizeWord as kk } from "../../src/languages/kazakh/kazakh.ts";
import { phonemizeWord as cs } from "../../src/languages/czech/czech.ts";
import { BACKBONE, CONFIG, type RefLang } from "./config.ts";

const PHON: Record<string, (w: string) => string> = { zu, si, kk, cs };
const HERE = dirname(fileURLToPath(import.meta.url));

/** Fold to the comparable segmental backbone: shared strip + the language's justified fold classes. */
function makeFold(cfg: RefLang): (s: string) => string {
  return (s: string): string => {
    let out = s.normalize("NFD");
    for (const [re, rep] of BACKBONE) out = out.replace(re, rep);
    for (const [re, rep] of cfg.folds) out = out.replace(re, rep);
    return out.normalize("NFC");
  };
}

export interface RefereeResult {
  source: string;
  total: number;
  raw: number;
  folded: number;
  residual: { key: string; count: number; example: string }[];
}

/** Score a language's phonemizer against each of its independent referees (segmental backbone). */
export function evaluate(lang: string): RefereeResult[] {
  const cfg = CONFIG[lang], phon = PHON[lang];
  if (!cfg || !phon) throw new Error(`no referee config for "${lang}"`);
  const fold = makeFold(cfg);
  return cfg.referees.map((ref) => {
    const pairs = readFileSync(join(HERE, "referees", ref.file), "utf8").split("\n")
      .filter((l) => l.trim() !== "" && !l.startsWith("#"))
      .map((l) => l.split("\t")).filter((a) => a.length >= 2 && a[0] && a[1]) as [string, string][];
    let raw = 0, folded = 0;
    const diffClass: Record<string, number> = {};
    const example: Record<string, string> = {};
    for (const [w, refIpa] of pairs) {
      const ours = phon(w);
      const refJoined = cfg.segmentJoin ? refIpa.replace(/\s+/g, "") : refIpa;
      if (ours === refJoined) raw++;
      const of = fold(ours), rf = fold(refJoined);
      if (of === rf) { folded++; continue; }
      const key = `${of}  ≠  ${rf}`;
      diffClass[key] = (diffClass[key] ?? 0) + 1;
      example[key] ??= `${w}: ${ours}  |  ${refIpa}`;
    }
    const residual = Object.entries(diffClass).sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count, example: example[key]! }));
    return { source: ref.source, total: pairs.length, raw, folded, residual };
  });
}

function main(): void {
  const lang = process.argv[2];
  if (!lang || !CONFIG[lang]) { console.error("usage: eval.ts <zu|si|kk> [--examples N]"); process.exit(1); }
  const exIdx = process.argv.indexOf("--examples");
  const nEx = exIdx >= 0 ? Number(process.argv[exIdx + 1] ?? 25) : 12;
  for (const r of evaluate(lang)) {
    console.log(`\n=== ${lang} vs ${r.source} (${r.total} words) ===`);
    console.log(`raw exact:      ${r.raw}/${r.total} (${((100 * r.raw) / r.total).toFixed(1)}%)`);
    console.log(`folded backbone:${r.folded}/${r.total} (${((100 * r.folded) / r.total).toFixed(1)}%)  — after the config folds`);
    console.log(`residual divergence classes (top ${nEx}, count × folded-form; investigate, don't auto-fix):`);
    for (const d of r.residual.slice(0, nEx)) console.log(`  ${d.count}×  ${d.key}\n       e.g. ${d.example}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
