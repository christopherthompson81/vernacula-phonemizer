/**
 * Build data/languages/punjabi/gurmukhi-lexicon.tsv — the Gurmukhi EXCEPTIONS lexicon, mined from the
 * wikipron pan_guru referee exactly as km-lexicon.tsv is mined from khm: every referee word whose EVAL
 * reading (`phonemizeWordEval` — the function the referee eval scores) disagrees with every gold reading
 * under the eval's own folds gets an entry carrying the referee's first reading.
 *
 * ⚠ THE EVAL MUST NEVER CONSULT THE OUTPUT — it is the answer key. `phonemizeWordEval` stays lexicon-free
 * (of THIS lexicon; the cross-script layer's readings are our own g2p over voweled Gurmukhi and stay).
 * Shipped `phonemizeWord` consults it first. The house pattern: af/en-GB/tl/ilo/km.
 *
 * ⚠ FOLDS, NOT RAW, decide membership — the mining must use the eval's own fold pipeline, because deriving
 * the class with any reimplementation manufactures phantoms (investigation Run 3: a 106-word "final-ə class"
 * that existed only in the analysis script's cruder fold).
 *
 * Readings are stored as the referee writes them (joined, NFC) — tone letters, breves and all. The shipped
 * output for these words therefore follows the referee's notation rather than the engine's, the km
 * arrangement, disclosed here rather than silently normalized.
 *
 * Run: npx tsx tools/gen/build-pa-guru-lexicon.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeFold } from "../referee-eval/eval.ts";
import { CONFIG } from "../referee-eval/config.ts";
import { phonemizeWordEval } from "../../src/languages/punjabi/punjabi.ts";

const isEntryPoint = process.argv[1] !== undefined
    && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isEntryPoint) main();

function main(): void {
    const here = dirname(fileURLToPath(import.meta.url));
    const fold = makeFold(CONFIG.pa!);
    const gold = new Map<string, string[]>();
    for (const l of readFileSync(join(here, "../referee-eval/referees/pa.wikipron-pan-broad.tsv"), "utf8").split("\n")) {
        if (!l.trim() || l.startsWith("#") || !l.includes("\t")) continue;
        const [w, i] = l.split("\t");
        gold.set(w!, [...(gold.get(w!) ?? []), i!.replace(/\s+/gu, "").normalize("NFC")]);
    }
    const rows: [string, string][] = [];
    for (const [w, gs] of gold) {
        const ours = fold(phonemizeWordEval(w));
        if (gs.some((g) => fold(g) === ours)) continue;   // rules already right → dead weight
        rows.push([w, gs[0]!]);
    }
    rows.sort((a, b) => a[0].localeCompare(b[0]));
    const out = join(here, "../../data/languages/punjabi/gurmukhi-lexicon.tsv");
    writeFileSync(out, `# Gurmukhi EXCEPTIONS lexicon — word → IPA for the words the eval path gets wrong, carrying the
# wikipron pan_guru referee's own readings (first reading of a multi-pronunciation word).
#
# SOURCE:  wikipron pan_guru broad (en.wiktionary via wikipron) — CC-BY-SA, LICENSES/PROVENANCE.md §3.
# ⚠ THE REFEREE EVAL MUST NEVER READ THIS FILE — it was mined FROM that referee (phonemizeWordEval is the
#   scored function and stays clear; shipped phonemizeWord consults this first). House pattern: af/km.
# ⚠ Readings are the referee's notation verbatim (tone letters, ə̆) — the km arrangement, disclosed.
# Mostly the medial-schwa class proven lexical three ways: audio adjudication (FLEURS, Runs 1-2), two failed
# rule derivations (Run 4), and the 52:40 population split on the final-cluster context.
# Regenerate: npx tsx tools/gen/build-pa-guru-lexicon.mts
# ENTRIES: ${rows.length}
${rows.map(([w, p]) => `${w}\t${p}`).join("\n")}\n`, "utf8");
    console.log(`  ${rows.length} entries → ${out}`);
}
