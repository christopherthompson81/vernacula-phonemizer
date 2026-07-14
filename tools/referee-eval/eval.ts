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

import { phonemizeArabic as ar } from "../../src/languages/arabic/arabic.ts";
import { phonemizeWord as ca } from "../../src/languages/catalan/catalan.ts";
import { createEnglish } from "../../src/languages/english/english.ts";
import { phonemizeWord as ff } from "../../src/languages/fula/fula.ts";
import { phonemizeWord as ha } from "../../src/languages/hausa/hausa.ts";
import { createHindi } from "../../src/languages/hindi/hindi.ts";
import { phonemizeWord as ja } from "../../src/languages/japanese/japanese.ts";
import { phonemizeWord as ko } from "../../src/languages/korean/korean.ts";
import { createPinyinPhonemizer } from "../../src/languages/mandarin/mandarin.ts";
import { phonemizeWord as cs } from "../../src/languages/czech/czech.ts";
import { phonemizeWord as de } from "../../src/languages/german/german.ts";
import { phonemizeWord as es } from "../../src/languages/spanish/spanish.ts";
import { phonemizeWord as fr } from "../../src/languages/french/french.ts";
import { phonemizeWord as ga } from "../../src/languages/irish/irish.ts";
import { phonemizeWord as kk } from "../../src/languages/kazakh/kazakh.ts";
import { phonemizeWord as pt } from "../../src/languages/portuguese/portuguese.ts";
import { phonemizeWord as ru } from "../../src/languages/russian/russian.ts";
import { phonemizeWord as si } from "../../src/languages/sinhala/sinhala.ts";
import { phonemizeWord as sv } from "../../src/languages/swedish/swedish.ts";
import { phonemizeWord as ta } from "../../src/languages/tamil/tamil.ts";
import { phonemizeWord as th } from "../../src/languages/thai/thai.ts";
import { phonemizeWord as tr } from "../../src/languages/turkish/turkish.ts";
import { phonemizeWord as vi } from "../../src/languages/vietnamese/vietnamese.ts";
import { phonemizeWord as zu } from "../../src/languages/zulu/zulu.ts";
import { BACKBONE, CONFIG, type RefLang } from "./config.ts";

// Alphabetical; each maps a word → our canonical IPA (sync or async). ar goes through the async ONNX
// diacritizer pre-pass (phonemizeArabic) so the referee's voweled IPA is comparable. cmn is syllable-level. en
// and hi have no bare phonemizeWord export — instantiate their factory once and take the word through .text().
const cmn = createPinyinPhonemizer();
const enP = createEnglish();
const en = (w: string): string => enP.text(w);
const hiP = createHindi();
const hi = (w: string): string => hiP.text(w);
const PHON: Record<string, (w: string) => string | Promise<string>> =
  { ar, ca, cmn, cs, de, en, es, ff, fr, ga, ha, hi, ja, kk, ko, pt, ru, si, sv, ta, th, tr, vi, zu };
const HERE = dirname(fileURLToPath(import.meta.url));

/** Fold to the comparable segmental backbone: shared strip + the language's justified fold classes. */
export function makeFold(cfg: RefLang): (s: string) => string {
  return (s: string): string => {
    let out = s.normalize("NFD");
    for (const [re, rep] of cfg.preFolds ?? []) out = out.replace(re, rep); // before backbone (needs diacritics)
    for (const [re, rep] of BACKBONE) out = out.replace(re, rep);
    for (const [re, rep] of cfg.folds) out = out.replace(re, rep);
    return out.normalize("NFC");
  };
}

export interface RefereeResult {
  source: string;
  role: "primary" | "secondary";
  total: number;
  raw: number;
  folded: number;
  residual: { key: string; count: number; example: string }[];
}

/** Score a language's phonemizer against each of its independent referees (segmental backbone). Async because
 *  some phonemizers (ar's ONNX diacritizer) are async; sync ones resolve immediately. */
export async function evaluate(lang: string): Promise<RefereeResult[]> {
  const cfg = CONFIG[lang], phon = PHON[lang];
  if (!cfg || !phon) throw new Error(`no referee config for "${lang}"`);
  const fold = makeFold(cfg);
  const out: RefereeResult[] = [];
  for (const ref of cfg.referees) {
    const pairs = readFileSync(join(HERE, "referees", ref.file), "utf8").split("\n")
      .filter((l) => l.trim() !== "" && !l.startsWith("#"))
      .map((l) => l.split("\t")).filter((a) => a.length >= 2 && a[0] && a[1]) as [string, string][];
    let raw = 0, folded = 0;
    const diffClass: Record<string, number> = {};
    const example: Record<string, string> = {};
    for (const [w, refIpa] of pairs) {
      const ours = await phon(w);
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
    out.push({ source: ref.source, role: ref.role, total: pairs.length, raw, folded, residual });
  }
  return out;
}

async function main(): Promise<void> {
  const lang = process.argv[2];
  if (!lang || !CONFIG[lang]) { console.error(`usage: eval.ts <${Object.keys(CONFIG).join("|")}> [--examples N]`); process.exit(1); }
  const exIdx = process.argv.indexOf("--examples");
  const nEx = exIdx >= 0 ? Number(process.argv[exIdx + 1] ?? 25) : 12;
  for (const r of await evaluate(lang)) {
    console.log(`\n=== ${lang} vs ${r.source} [${r.role}] (${r.total} words) ===`);
    console.log(`raw exact:      ${r.raw}/${r.total} (${((100 * r.raw) / r.total).toFixed(1)}%)`);
    console.log(`folded backbone:${r.folded}/${r.total} (${((100 * r.folded) / r.total).toFixed(1)}%)  — after the config folds`);
    console.log(`residual divergence classes (top ${nEx}, count × folded-form; investigate, don't auto-fix):`);
    for (const d of r.residual.slice(0, nEx)) console.log(`  ${d.count}×  ${d.key}\n       e.g. ${d.example}`);
  }
  const gap = CONFIG[lang]!.secondaryGap;
  if (gap) console.log(`\n⚠ secondary-source gap: ${gap}`);
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
