/**
 * Build referees/km.google-lexicon.tsv — Khmer's SECONDARY referee, from google/language-resources.
 *
 * Run: npx tsx tools/referee-eval/build-km-google-referee.ts <km/data/lexicon.tsv>
 *   source: https://github.com/google/language-resources — km/data/lexicon.tsv, CC BY 4.0, © 2018 Google Inc.
 *
 * ## Why this is a legitimate referee when the SAME data is also a shipped lexicon tier
 *
 * The eval scores `phonemizeWordRules`, which reads NO lexicon — so scoring the rules against this file is
 * non-circular regardless of what `phonemizeWord` consumes. The circularity constraint runs the other way and
 * is already enforced where it matters: the SHIPPED path must never be scored against this referee, because
 * its dictionary tier IS this data (same reason the exceptions lexicon is never scored against wikipron).
 *
 * ⚠ UNLIKE `km-lexicon-dict.tsv`, THIS FILE EXCLUDES NOTHING. The lexicon tier drops every wikipron-settled
 * word (adding them was a measured regression of the shipped output); a referee is measurement data, not
 * output, so the overlap is exactly what makes cross-source comparison possible and it stays in.
 *
 * The phone conversion is the dict tier's own `convert()` (derived by iteration against wikipron; see
 * tools/gen/build-km-dict-lexicon.mts). Multi-pronunciation words keep one row per reading — eval.ts credits
 * a match against any row of a word.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { convert } from "../gen/build-km-dict-lexicon.mts";

const src = process.argv[2];
if (src === undefined) {
    console.error("usage: build-km-google-referee.ts <km/data/lexicon.tsv from google/language-resources>");
    process.exit(2);
}

const KHMER_WORD = /^[ក-៓ៜ-៝]+$/u;
const rows: [string, string][] = [];
const seen = new Set<string>();
for (const line of readFileSync(src, "utf8").split("\n")) {
    if (line.startsWith("#") || !line.includes("\t")) continue;
    const [word, ipa] = line.split("\t").map((x) => x?.trim());
    if (!word || !ipa || !KHMER_WORD.test(word)) continue;
    const out = convert(ipa);
    const key = `${word}\t${out}`;
    if (seen.has(key)) continue; // upstream carries exact-duplicate rows
    seen.add(key);
    rows.push([word, out]);
}
rows.sort((a, b) => a[0].localeCompare(b[0]));

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "referees/km.google-lexicon.tsv");
writeFileSync(out, `# Khmer SECONDARY referee — google/language-resources km/data/lexicon.tsv, converted to this
# project's IPA by tools/gen/build-km-dict-lexicon.mts's convert() (the mapping derived against wikipron).
# LICENSE: CC BY 4.0 — "Copyright 2018 Google Inc. All Rights Reserved."; attribution in NOTICE.md.
# ⚠ NON-Wiktionary lineage — the point of this file. The primary (wikipron) and kaikki are the same source;
#   this is the independent second tradition. Multi-pronunciation words carry one row per reading.
# ⚠ THE SHIPPED phonemizeWord MUST NEVER BE SCORED AGAINST THIS FILE — its dictionary tier is this same data.
#   The eval scores phonemizeWordRules, which reads no lexicon; that is what keeps this referee non-circular.
# Regenerate: npx tsx tools/referee-eval/build-km-google-referee.ts <km/data/lexicon.tsv>
# ENTRIES: ${rows.length}
${rows.map(([w, p]) => `${w}\t${p}`).join("\n")}\n`, "utf8");
console.log(`  ${rows.length.toLocaleString()} rows → ${out}`);
