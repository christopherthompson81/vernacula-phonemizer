/**
 * Generate the parity golden for NOGAI (nog) — a language the corpus-sourcing generator
 * (`tools/gen_parity_goldens.mts`) cannot serve.
 *
 * ⚠ WHY A DEDICATED GENERATOR. Nogai has no FLEURS split, no mined artifact, and no TSV under
 * `data/languages/nogai/` — the fleet generator's three tiers all come up empty for it. The only Nogai
 * TEXT in this repository is the 24 headwords of the coarse ASJP referee
 * (`tools/referee-eval/referees/nog.asjp-swadesh.tsv`) — the same source the TypeScript engine was
 * brought up against (docs/investigations/nog/nog_native_bringup_investigation.md) — plus the single kaikki
 * attestation (туькен), which Run 2 deliberately kept OUT of the folded referee so the coarse referee
 * stays internally consistent.
 *
 * ⚠ SO THIS GOLDEN IS THE REFEREE'S HEADWORDS, NOT A CORPUS. It pins C#↔TS parity over the 24 words
 * the TS engine was corroborated on, the one precise attestation, and a curated numeral list covering
 * every arm of the decimal composer (units, teens, the round tens, the hundred/thousand bir-omission
 * and its neighbours, the band tops, the million and billion words, and 2^53+1, which exercises the
 * raw-token digit-by-digit fallback that reads the digits the text wrote). It is not a claim of
 * coverage over any Nogai corpus — there is none in this repo — say so wherever the file is described.
 *
 * ⚠ ASYNC MODE, per the goldens' own convention — see the warning at the top of tools/parity/Program.cs.
 *
 *   npx tsx tools/gen_nog_golden.mts      # → csharp/goldens/nog.tsv
 */
import { readFileSync, writeFileSync } from "node:fs";
import { phonemizeAsync } from "../src/index.ts";
import { clearForeignOov } from "../src/core/foreign.ts";

const src = "tools/referee-eval/referees/nog.asjp-swadesh.tsv";
const dst = "csharp/goldens/nog.tsv";

// The 24 referee headwords (column 1), in referee order.
const headwords = readFileSync(src, "utf8")
    .split("\n")
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .map((l) => l.split("\t")[0]!);

// The one precise attestation — kaikki's /ty.ken/ — kept out of the folded referee.
const attestation = ["туькен"];

// One numeral per composer arm, plus the boundaries: 0 (ноль), units 1–9, 10 (он), the teens (он бир …),
// every round ten, the hundred/thousand bir-omission and its neighbours, the top of each band, the
// million and billion words, and 9007199254740993 (2^53+1): above it the double has lost its low digits,
// so the raw token must be read digit-by-digit.
const numerals = [
    ...Array.from({ length: 21 }, (_, n) => String(n)),
    "25", "30", "40", "50", "60", "70", "80", "90",
    "100", "101", "200", "555", "999",
    "1000", "1984", "9999", "12345", "100000",
    "1000000", "999999999", "1000000000", "9007199254740993",
];

const texts = [...headwords, ...attestation, ...numerals];

clearForeignOov();
const out: string[] = [];
for (const t of texts) out.push(`${t}\t${await phonemizeAsync(t, "nog")}`);
writeFileSync(dst, out.join("\n") + "\n");
console.log(`${dst}: ${out.length} rows (${headwords.length} headwords + ${attestation.length} attestation + ${numerals.length} numerals)`);
