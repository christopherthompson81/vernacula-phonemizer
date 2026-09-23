/**
 * EQUIVALENCE-CLASS PROBE for the English normalizer — the text→words axis, with NO external oracle.
 *
 * WHY THIS EXISTS. Eleven defects were reported from listening to TTS output (#1421–#1437) and the referee
 * eval could not have caught one of them: it scores word→IPA on 4,037 bare citation words, of which ZERO
 * contain a digit, a symbol or a second token. The measurement is in
 * `docs/investigations/en/en_heard_defects_vs_referee_residual_investigation.md`. The gap was never a
 * missing number — it was a missing corpus.
 *
 * ⚠ AND THE FIRST DESIGN FOR THIS TOOL WAS espeak-ng AS A DIFFERENTIAL ORACLE, WHICH MEASURED BADLY.
 * espeak reads `(a)` as the indefinite article, `µin` as "micro I N" and `CoCr` as "co C R" — i.e. it is
 * WRONG on most of the shapes this class is about, so it would have flagged our CORRECT behaviour as the
 * divergence. A detector whose disagreements are usually the detector's fault is not worth the licence
 * question it costs.
 *
 * WHAT IT DOES INSTEAD. Two checks that need no second system at all:
 *
 *   A. EQUIVALENCE — two spellings of the SAME THING must normalize to the same words. `0.015"` and
 *      `0.015″` are the same measurement; `5 um` and `5 µm` are the same length. Nothing external is
 *      needed to know they must agree, and the ASCII member of each pair is the one real documents
 *      actually contain. ⚠ THIS IS WHERE THE YIELD IS: the Unicode member is what gets reported and
 *      fixed, because it is what a person notices; the ASCII member then sits unfixed and far more
 *      common. 8 of the first 12 pairs disagreed.
 *
 *   B. SURVIVAL — a symbol the normalizer claims to handle must not still be in the output. A `Ω` that
 *      reaches the word layer is read as the LETTER NAME, and `omeɣa` put a Greek phoneme into English
 *      output; a `″` that survives is a dropped unit.
 *
 * ⚠ NEITHER CHECK CAN TELL WHICH SIDE IS RIGHT, only that the pair disagrees. Every hit is adjudicated
 * by hand — this is a DETECTOR, in the same sense §5.1 permits the espeak binary as a search step.
 *
 *   npx tsx tools/normalization/en-shape-equivalence.mts            report
 *   npx tsx tools/normalization/en-shape-equivalence.mts --ipa      also show the phonemes
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { phonemizeAsync, phonemizeTrace } from "../../src/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const showIpa = process.argv.includes("--ipa");

/** The pipeline string — text after every normalization pass, before the word layer. */
const normalized = (t: string): string =>
    (phonemizeTrace(t, "en") as unknown as { normalized: string }).normalized;

interface Row { kind: "eq" | "survive"; name: string; a: string; b: string }

const rows: Row[] = readFileSync(join(HERE, "en-shape-corpus.tsv"), "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.startsWith("#"))
    .map((l) => l.split("\t"))
    .filter((c) => c.length >= 3)
    .map((c) => ({ kind: c[0] as Row["kind"], name: c[1]!, a: c[2]!, b: c[3] ?? "" }));

let fails = 0;
const report = async (r: Row): Promise<void> => {
    if (r.kind === "eq") {
        const na = normalized(r.a), nb = normalized(r.b);
        if (na === nb) return;
        fails++;
        console.log(`⚠ DIFF  ${r.name}`);
        console.log(`          ${JSON.stringify(r.a).padEnd(20)} -> ${JSON.stringify(na)}`);
        console.log(`          ${JSON.stringify(r.b).padEnd(20)} -> ${JSON.stringify(nb)}`);
        if (showIpa) {
            console.log(`          ${" ".repeat(20)}    ${await phonemizeAsync(r.a, "en")}`);
            console.log(`          ${" ".repeat(20)}    ${await phonemizeAsync(r.b, "en")}`);
        }
        return;
    }
    // SURVIVAL: `b` is a character class that must NOT appear in the normalized string.
    const na = normalized(r.a);
    const re = new RegExp(r.b, "u");
    if (!re.test(na)) return;
    fails++;
    console.log(`⚠ SURVIVES  ${r.name}`);
    console.log(`          ${JSON.stringify(r.a).padEnd(20)} -> ${JSON.stringify(na)}`);
    if (showIpa) console.log(`          ${" ".repeat(20)}    ${await phonemizeAsync(r.a, "en")}`);
};

for (const r of rows) await report(r);
const eq = rows.filter((r) => r.kind === "eq").length;
console.log(`\n${rows.length} rows (${eq} equivalence pairs, ${rows.length - eq} survival checks) — ${fails} FAILING`);
// ⚠ EXIT 0 EVEN WHEN FAILING. This is a probe to read, not a gate to go green: the disagreements are
// real work queued, and a red exit would either get the tool disabled or get the rows deleted to quiet
// it. When a class here is settled it graduates into test/english-reported-misreadings.test.ts, which IS
// a gate.
