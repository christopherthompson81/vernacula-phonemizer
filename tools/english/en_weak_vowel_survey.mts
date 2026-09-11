/**
 * WHERE THE WEAK VOWEL ᵻ SITS, per slot, against the referee — the measure the headline eval gives up.
 *
 * ⚠ THIS EXISTS BECAUSE A FOLD WAS ADDED THAT HIDES SOMETHING REAL. `tools/referee-eval/langs/en.jsonc`
 * folds `ᵻ → ɪ` (#1282), because the referee's inventory has no `ᵻ` and leaving it unfolded mapped a
 * documented house convention to ALWAYS-WRONG across 5,580 lexicon rows — which distorted every decision
 * that touched it (the correct `-es` change in #1275 scored −7 for being right).
 *
 * ⚠ BUT THE FOLD IS NOT FREE, and the house rule is that a fold must not delete an axis. The referee
 * PARTIALLY resolves `ᵻ`: our `ᵻ` and our full `ɪ` draw measurably different rates from it, so an `ᵻ`
 * written where a full `ɪ` belongs was catchable before the fold and is not after. This is where that
 * stays visible. Run it when `isBarredI` changes; a class placed wrongly shows as a bucket whose `ɪ`-rate
 * has moved toward the `ə` column.
 *
 * ⚠ REBUILD THE LEXICON FIRST after an `isBarredI` change — `npx tsx tools/english/en_rebuild_lexicon.mts
 * --write`. This reads each word back through the engine, which resolves an in-lexicon word from the flat
 * file; the rule reaches the OOV and tagger paths but NOT that file until it is regenerated. Change the
 * rule, run this without rebuilding, and every bucket reports the OLD placement unchanged — the one failure
 * the `slots === 0` guard cannot catch, because the slots are all still there.
 *
 *   npx tsx tools/english/en_weak_vowel_survey.mts          the US referee (en)
 *   npx tsx tools/english/en_weak_vowel_survey.mts --gb     the UK referee (en-GB)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phonemize } from "../../src/index.ts";
import { phonemizeWordRules as enGbRules } from "../../src/languages/english-gb/english-gb.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * ⚠ en-GB IS NOT AN AFTERTHOUGHT — it is the half the measurement rests on. The fold moved `en` by 81 words
 * and `en-GB` by 1,828, because the UK referee has 76,284 rows against the US referee's 4,558. A survey
 * that could only audit `en` would leave the convincing half of #1282 with no instrument at all.
 */
const VARIETY = process.argv.includes("--gb") ? "en-GB" : "en";
const REFEREE = join(ROOT, "tools", "referee-eval", "referees",
    VARIETY === "en-GB" ? "en-gb.wikipron-uk.tsv" : "en.wikipron-eng-latn-us-broad.tsv");
const LEXICON = join(ROOT, "data", "languages", "english", "accent-lexicon.tsv");

/** Vowel letters of BOTH inventories. `ᵻ` is ours alone — the referee never writes it, which is the point. */
// ⚠ INCLUDES ɐ ʉ ɵ, which the NARROW UK referee writes and `en-GB.jsonc` folds to ə/u. Omitting them made
// those rows fail the nucleus count and drop out silently instead of landing in the `ə` baseline the `ᵻ`
// bucket is measured against. Tiny here (46/18/7 rows of 76,284) but a real asymmetry with the gate.
const VOWEL = /[ɪiɨɘəɜɝɚeɛæaɑɒɔoʊuʌyøɐʉɵ]/u;

/**
 * ⚠ THE TWO SIDES SPELL A DIPHTHONG DIFFERENTLY, so both are normalised to ONE token before anything is
 * counted. We write a superscript offglide (`eᶦ`, and for RP `əᶷ`); the US referee writes two
 * space-separated phones (`e ɪ`); the UK referee writes two characters (`əʊ`). Left alone, our one nucleus
 * faces the referee's two and every word carrying one is lost.
 *
 * ⚠ AND THE MERGE MUST BE SYMMETRIC. The first version merged only the REFEREE's pairs, which fixed the
 * count for `en` — whose GOAT onset is `o`, not a surveyed symbol — while making `en-GB` WORSE: RP GOAT is
 * `əᶷ`, so every recovered slot compared our bare `ə` against the referee's merged `əʊ` and could never
 * match, dragging the `ə` bucket from 78.4% to 70.6% on 22,216 slots. A one-sided fold is not a fix, it is
 * a different bug with better coverage.
 *
 * ⚠ AND THE SET WAS US-SHAPED. It omitted `əʊ` (RP GOAT) and `ʌɪ` (the narrow-RP PRICE variant the UK
 * referee writes), which silently dropped 2,369 en-GB words and let 67 through MISALIGNED, because the
 * referee's syllabic `n̩`/`l̩` against our `ən`/`əl` cancelled the extra nucleus. `broken`, `boastful`,
 * `cobblestone` scored our `-en`/`-ful` schwa against the referee's GOAT offglide — in the survey that
 * exists to keep this fold honest, on the variety that carries its evidence.
 */
const DIPHTHONG = new Set(["eɪ", "oʊ", "aɪ", "aʊ", "ɔɪ", "əʊ", "ʌɪ"]);

/** Our superscript offglides, to the referee's plain spelling, so both sides tokenize identically. */
const OFFGLIDE: readonly (readonly [RegExp, string])[] = [[/ᶦ/gu, "ɪ"], [/ᶷ/gu, "ʊ"]];

const referee = new Map<string, string[][]>();
for (const line of readFileSync(REFEREE, "utf8").split("\n")) {
    if (!line) continue;
    const [word, ...rest] = line.split("\t");
    const first = rest[0];
    if (!word || first === undefined) continue;
    // ⚠ THE TWO REFEREES ARE NOT THE SAME SHAPE. The US broad file is SPACE-SEPARATED phones; the UK file
    // is one unsegmented IPA string per row (and carries variant columns — the first is taken). Splitting
    // the UK file on spaces gives ONE token per word, so every comparison becomes a count mismatch and the
    // survey silently reports on nothing.
    // ⚠ EVERY VARIANT, NOT THE FIRST. The eval credits a word when ANY of the referee's readings matches
    // (eval.ts's per-referee alternatives), and 16,337 of the UK file's 76,284 rows carry more than one.
    // Surveying only `rest[0]` measured a different object than the gate it justifies: a word whose second
    // variant writes `ə` where the first writes `ɪ` counted as pure ɪ-support, with a bias of unknown sign.
    referee.set(word.toLowerCase(), rest.filter((r) => r.trim().length > 0).map(
        (r) => (VARIETY === "en-GB" ? [...r.replace(/\s+/gu, "")] : r.trim().split(" "))));
}

/**
 * OUR reading of each word the referee covers.
 *
 * ⚠ IT IS THE ENGINE'S OUTPUT, NOT THE LEXICON FILE, and for en-GB that is not a refinement but the
 * difference between measuring the variety and measuring the wrong one: `accent-lexicon.tsv` holds the
 * GenAm reading, and en-GB is an ACCENT DELTA applied on top of it (english-gb.ts, toRP). Reading the file
 * would have compared American vowels against a British referee and called the result an en-GB survey.
 */
const ours = new Map<string, string>();
for (const line of readFileSync(LEXICON, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const word = line.split("\t")[0];
    if (!word || !referee.has(word)) continue;
    // ⚠ en-GB TAKES THE RULES PATH, NOT THE SHIPPED ONE. `phonemizeWord` applies BATH/CLOTH/PALM word
    // lists MINED FROM THIS REFEREE, so the shipped reading is circular against it — which is exactly why
    // the eval scores `phonemizeWordRules` for this variety. An auditing instrument on the circular path
    // would be a worse version of the problem it exists to check.
    ours.set(word, VARIETY === "en-GB" ? enGbRules(word) : phonemize(word, VARIETY));
}

/** Nuclei of a phone list, with the diphthong pairs merged — THE SAME function for both sides. */
function nuclei(phones: string[]): string[] {
    const bare = phones.map((p) => p.replace(/[ːˑ]/gu, ""));
    const out: string[] = [];
    for (let i = 0; i < bare.length; i++) {
        const p = bare[i]!;
        if (!VOWEL.test(p) && p !== "ᵻ") continue;
        const next = bare[i + 1];
        if (next !== undefined && DIPHTHONG.has(p + next)) { out.push(p + next); i++; continue; }
        out.push(p);
    }
    return out;
}

/** Our IPA as a phone list in the referee's spelling: offglides plain, then one character per phone. */
function ourPhones(ipa: string): string[] {
    let s2 = ipa;
    for (const [re, rep] of OFFGLIDE) s2 = s2.replace(re, rep);
    return [...s2];
}

/** For every slot where WE wrote `symbol`, what did the referee write there?
 *  ⚠ NOT named `ours` — that is the map of our readings in the enclosing scope, and shadowing it made this
 *  loop iterate a STRING's characters instead, reporting zero slots for everything. */
function survey(symbol: string): { slots: number; counts: Map<string, number>; words: number; skipped: number } {
    const counts = new Map<string, number>();
    let slots = 0, words = 0, skipped = 0;
    for (const [word, ipa] of ours) {
        const ref = referee.get(word);
        if (ref === undefined) continue;
        const mine = nuclei(ourPhones(ipa));
        // ⚠ A COUNT MISMATCH IS SKIPPED, NOT GUESSED AT. What remains after the diphthong merge is a real
        // structural disagreement (the referee's non-syllabic `n` for our `ən`, or a different
        // syllabification), and aligning those by position would manufacture the contamination above.
        const aligning = ref.map(nuclei).filter((t) => t.length === mine.length && t.length > 0);
        if (aligning.length === 0) { skipped++; continue; }
        words++;
        for (let i = 0; i < mine.length; i++) {
            if (mine[i] !== symbol) continue;
            slots++;
            // Each aligning variant contributes a fraction, so a multi-variant word cannot outvote a
            // single-variant one purely by having been transcribed twice.
            for (const t of aligning) counts.set(t[i]!, (counts.get(t[i]!) ?? 0) + 1 / aligning.length);
        }
    }
    return { slots, counts, words, skipped };
}

console.log(`${VARIETY} — referee's vowel in the slot, bucketed by WHICH SYMBOL WE WROTE there\n`);
const cols = ["ɪ", "ə", "i", "ɛ"];
console.log(`${"we wrote".padEnd(12)} ${"slots".padStart(6)}  ${cols.map((c) => `ref ${c}`.padStart(8)).join("")}`);
let aligned = 0, dropped = 0;
for (const sym of ["ᵻ", "ɪ", "ə"]) {
    const { slots, counts, words, skipped } = survey(sym);
    aligned = words; dropped = skipped;
    // ⚠ ZERO SLOTS IS A LOUD FAILURE, NOT A ROW OF NaN%. If a rule change removes the symbol, or a path
    // changes so nothing matches, the instrument has gone BLIND — and this is the table meant to notice.
    if (slots === 0) {
        console.log(`${sym.padEnd(12)} ${"0".padStart(6)}  ⚠ NO SLOTS — absent from the lexicon, or the alignment is broken`);
        continue;
    }
    const cells = cols.map((c) => `${((100 * (counts.get(c) ?? 0)) / slots).toFixed(1)}%`.padStart(8)).join("");
    console.log(`${sym.padEnd(12)} ${String(slots).padStart(6)}  ${cells}`);
}
console.log(`\naligned ${aligned} words, skipped ${dropped} on a nucleus-count mismatch`);
console.log(
    "\n⚠ THE SHAPE IS THE SIGNAL, not any single number. `ᵻ` should sit BETWEEN `ɪ` and `ə` — that is what a\n"
    + "  weak vowel looks like to a referee that has no symbol for one. If `ᵻ` moves toward the `ə` column it\n"
    + "  is being written where a schwa belongs; if it reaches `ɪ`'s rate it may have stopped being a\n"
    + "  distinct category at all. The headline eval cannot see either, since #1282 folds `ᵻ → ɪ`.",
);
