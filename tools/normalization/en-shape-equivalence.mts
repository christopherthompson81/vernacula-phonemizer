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

import { type PhonemeTrace, phonemizeAsync, phonemizeTrace } from "../../src/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const showIpa = process.argv.includes("--ipa");

/**
 * The pipeline string — text after every normalization pass, before the word layer.
 *
 * ⚠ IT ASSERTS THAT THE TRACE ACTUALLY RECORDED, BECAUSE A BLIND RUN AND A CLEAN RUN LOOK IDENTICAL HERE.
 * `stopTrace` returns `normalized: ""` when no engine reached the traced seam, and that condition is not
 * hypothetical — `trace.ts` documents an earlier break of exactly it, where an untraced host claimed the
 * recording. With `normalized` empty every `eq` pair compares `"" === ""` and passes, every `survive`
 * check finds nothing in `""` and passes, and a tool whose entire purpose is to surface defects prints
 * `0 FAILING`. That is the same shape as this repo's standing "a success signal that matches the no-op".
 *
 * ⚠ AND THE `as unknown as { normalized: string }` CAST THIS USED TO CARRY MADE IT WORSE, NOT SAFER.
 * `phonemizeTrace` already returns a typed `PhonemeTrace` with both fields; the cast bought nothing and
 * only suppressed the compile error that renaming the field would otherwise raise — after which every row
 * would have compared `undefined === undefined` and again reported 0 failing.
 */
const normalized = (t: string): string => {
    const tr: PhonemeTrace = phonemizeTrace(t, "en");
    if (!tr.traced) throw new Error(`the trace did not record for ${JSON.stringify(t)} — the probe is blind, not clean`);
    if (t !== "" && tr.normalized === "") throw new Error(`empty \`normalized\` for non-empty ${JSON.stringify(t)} — the probe is blind, not clean`);
    return tr.normalized;
};

/**
 * ⚠ A CANARY BEFORE ANY ROW RUNS, because the per-call assertion above only catches a trace that reports
 * its own absence. This catches the other half: a seam that reports fine and normalizes nothing. If the
 * one normalization this tool is most certain about stops happening, every row is meaningless and the
 * report must not be believed.
 */
const CANARY_IN = "0.015\u2033 total", CANARY_OUT = "0.015 inches total";
{
    const got = normalized(CANARY_IN);
    if (got !== CANARY_OUT)
        throw new Error(`canary failed: ${JSON.stringify(CANARY_IN)} -> ${JSON.stringify(got)}, expected ${JSON.stringify(CANARY_OUT)}.\n`
            + "Either the normalizer changed (update the canary) or the trace seam is broken (fix that first) — "
            + "but do not read the report below until this passes.");
}

interface Row { kind: "eq" | "survive"; name: string; a: string; b: string }

const rows: Row[] = readFileSync(join(HERE, "en-shape-corpus.tsv"), "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.startsWith("#"))
    .map((l) => l.split("\t"))
    // ⚠ `>= 4`, NOT `>= 3`. Every kind needs all four columns, and a row that loses its last tab used to
    // survive with `b = ""` — and `"anything".includes("")` is TRUE, so that row reported a defect forever
    // regardless of what the normalizer did, and inflated the failing count this tool's own investigation
    // doc quotes. An `eq` row lost the same way compared against `normalized("")` and reported a phantom DIFF.
    .filter((c) => c.length >= 4)
    .map((c) => {
        const kind = c[0]!;
        // ⚠ THROW ON AN UNKNOWN KIND rather than falling through. The dispatch below used to be
        // `if (eq) … else <survival>`, so a typo (`EQ`, `equiv`) was silently run as a survival check with
        // the other spelling as its matcher — a wrong answer wearing a right one's clothes.
        if (kind !== "eq" && kind !== "survive") throw new Error(`unknown row kind ${JSON.stringify(kind)} for ${JSON.stringify(c[1])}`);
        return { kind, name: c[1]!, a: c[2]!, b: c[3]! };
    });

/**
 * THE CORPUS HEADER SAYS `a` IS THE ASCII SPELLING, and this is what holds it to that — the convention is
 * what tells a reader which side of a reported DIFF to prioritise, so a row that quietly breaks it gets
 * adjudicated on a false premise.
 *
 * ⚠ IT CHECKS ONLY WHERE THE CLAIM HAS CONTENT, which is narrower than the header's wording and is the
 * accurate statement — see the two failed drafts recorded at the comparison below. The `unicode-pair:`
 * prefix is a READER'S LABEL for the two-Unicode-spellings case rather than a load-bearing exemption:
 * those rows tie on the count and are skipped by the comparison anyway.
 */
const nonAscii = (x: string): number => [...x].filter((c) => c.codePointAt(0)! > 0x7f).length;
for (const r of rows) {
    if (r.kind !== "eq" || r.name.startsWith("unicode-pair:")) continue;
    // ⚠ TWO DRAFTS OF THIS CHECK WERE WRONG AND EACH SAID SO ON THE FIRST RUN, which is the argument for
    // writing it at all. Draft 1 asserted `a` is PURE ASCII and rejected `40°26'46"N`, whose `°` is SHARED
    // CONTEXT with no ASCII spelling — the feature under test there is `'`/`"` against `′`/`″`. Draft 2
    // asserted `a` has STRICTLY FEWER non-ASCII characters and rejected the case rows (`V6L 2T5` against
    // `v6l 2t5`), which are not spelling pairs at all and have nothing to compare.
    // ⚠ THE INVARIANT ONLY HAS CONTENT WHEN THE TWO SIDES DIFFER IN ASCII-NESS. Where they do, `a` must be
    // the more-ASCII one; where they do not, the pair is a case/punctuation variant or a two-Unicode class
    // and there is nothing to say. Stated that way it catches the real error — a SWAPPED pair — and is
    // vacuous everywhere it should be.
    if (nonAscii(r.a) > nonAscii(r.b))
        throw new Error(`eq row ${JSON.stringify(r.name)}: \`a\` (${JSON.stringify(r.a)}) is not the more-ASCII `
            + `spelling of \`b\` (${JSON.stringify(r.b)}). Swap them, or name the row \`unicode-pair:…\` if the `
            + "class has no ASCII member at all.");
}

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
    // SURVIVAL: `b` is a LITERAL string that must NOT appear in the normalized output.
    // ⚠ A LITERAL AND `includes`, NOT `new RegExp(r.b, "u")`. The corpus section this serves is called
    // "SYMBOLS THAT MUST NOT REACH THE WORD LAYER", so its obvious next rows are `+`, `(`, `*`, `?` — and
    // each of those THROWS as a pattern, killing the run partway through with a nonzero exit and skipping
    // every row after it. That directly contradicts the exit-0 contract at the bottom of this file. It also
    // removes the doc drift the two comments used to carry, where the TSV header called this column a regex
    // and the code called it a character class; the two readings disagree about whose job escaping is.
    const na = normalized(r.a);
    if (!na.includes(r.b)) return;
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
