/**
 * Generate the parity golden for K'ICHE' (quc) — a language the corpus-sourcing generator
 * (`tools/gen_parity_goldens.mts`) cannot serve.
 *
 * ⚠ WHY A DEDICATED GENERATOR. K'iche' has no FLEURS split, no mined artifact, and no TSV under
 * `data/languages/kiche/` — the fleet generator's three tiers all come up empty for it (its lexicon
 * tier additionally requires a module .ts naming the code, which kiche.ts does not). The only K'iche'
 * TEXT in this repository is the 127 human headwords of the English-Wiktionary referee
 * (`tools/referee-eval/referees/quc.wiktionary-kiche.tsv`) — the same source the TypeScript engine was
 * brought up against (docs/investigations/quc/quc_native_bringup_investigation.md).
 *
 * ⚠ SO THIS GOLDEN IS THE REFEREE'S HEADWORDS, NOT A CORPUS. It pins C#↔TS parity over the 127 words
 * the TS engine was tuned on, plus a curated numeral list covering every arm of the vigesimal composer
 * (units, teens, the three score bases, the q'o' multiples, the ≥4000 digit-by-digit fallback, and
 * 2^53+1, which exercises the raw-token arm that reads the digits the text wrote). It is not a claim
 * of coverage over any K'iche' corpus — there is none in this repo — say so wherever the file is
 * described.
 *
 * ⚠ ASYNC MODE, per the goldens' own convention — see the warning at the top of tools/parity/Program.cs.
 *
 *   npx tsx tools/gen_quc_golden.mts      # → csharp/goldens/quc.tsv
 */
import { readFileSync, writeFileSync } from "node:fs";
import { phonemizeAsync } from "../src/index.ts";
import { clearForeignOov } from "../src/core/foreign.ts";

const src = "tools/referee-eval/referees/quc.wiktionary-kiche.tsv";
const dst = "csharp/goldens/quc.tsv";

// The 127 referee headwords (column 1), in referee order.
const headwords = readFileSync(src, "utf8")
    .split("\n")
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .map((l) => l.split("\t")[0]!);

// A couple of the same words spelled with the ASCII apostrophe, which the referee never uses — the
// glyph-normalisation arm (' ’ ` → ʼ) must be pinned in the golden itself, not only off-golden.
const asciiApostrophe = ["k'iche'", "q'o"];

// One numeral per composer arm, plus the boundaries: 0 (majb'al), units 1–10, teens 11–19, the 20 and
// 40 scores (the ⟨winaq⟩ base), 60/100 (the ⟨k'al⟩ base in and out of range), 80 (⟨much'⟩), score+unit
// joins (21, 42, 61, 81), the top of each band (99, 399, 3999), the q'o' multiples (400, 800, 1000 =
// kaq'o' lajk'al), and ≥4000, where nothing is documented and the reading is digit-by-digit.
// 9007199254740993 is 2^53+1: above it the double has lost low digits, so the raw token must be read.
const numerals = [
    ...Array.from({ length: 21 }, (_, n) => String(n)),
    "21", "40", "42", "60", "61", "80", "81", "99",
    "100", "101", "200", "380", "399",
    "400", "401", "800", "1000", "1999", "3999",
    "4000", "5000", "9999", "12345", "100000", "9007199254740993",
];

const texts = [...headwords, ...asciiApostrophe, ...numerals];

clearForeignOov();
const out: string[] = [];
for (const t of texts) out.push(`${t}\t${await phonemizeAsync(t, "quc")}`);
writeFileSync(dst, out.join("\n") + "\n");
console.log(`${dst}: ${out.length} rows (${headwords.length} headwords + ${asciiApostrophe.length} ascii-apostrophe + ${numerals.length} numerals)`);
