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
 *   npx tsx tools/english/en_weak_vowel_survey.mts          the US referee (en)
 *   npx tsx tools/english/en_weak_vowel_survey.mts --gb     the UK referee (en-GB)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phonemize } from "../../src/index.ts";

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
const VOWEL = /[ɪiɨɘəɜɝɚeɛæaɑɒɔoʊuʌyø]/u;

/**
 * ⚠ THE REFEREE WRITES A DIPHTHONG AS TWO PHONES AND WE WRITE IT AS ONE NUCLEUS — `e ɪ` against our `eᶦ` —
 * so these are merged before anything is counted, or the two sides disagree about how many nuclei a word
 * has and every FACE/GOAT/PRICE/MOUTH/CHOICE word is lost.
 *
 * ⚠ AND LOSING THEM WAS NOT THE WORST OF IT. The first version of this tool skipped on a nucleus-count
 * mismatch — 626 of 756 skipped words went for this reason alone — but 34 more SLIPPED THROUGH, because a
 * second asymmetry (the referee's non-syllabic `n` where we write `ən`) cancelled the offglide's extra
 * nucleus and restored the count while leaving every slot after the diphthong shifted by one.
 * `disqualification` scored our `-tion` schwa against the referee's FACE offglide. Contaminated rows in the
 * one table meant to keep the folded axis honest is the worst failure this tool could have had.
 */
const REF_DIPHTHONG = new Set(["eɪ", "oʊ", "aɪ", "aʊ", "ɔɪ"]);

const referee = new Map<string, string[]>();
for (const line of readFileSync(REFEREE, "utf8").split("\n")) {
    if (!line) continue;
    const [word, ...rest] = line.split("\t");
    const first = rest[0];
    if (!word || first === undefined) continue;
    // ⚠ THE TWO REFEREES ARE NOT THE SAME SHAPE. The US broad file is SPACE-SEPARATED phones; the UK file
    // is one unsegmented IPA string per row (and carries variant columns — the first is taken). Splitting
    // the UK file on spaces gives ONE token per word, so every comparison becomes a count mismatch and the
    // survey silently reports on nothing.
    referee.set(word.toLowerCase(), VARIETY === "en-GB" ? [...first.replace(/\s+/gu, "")] : first.trim().split(" "));
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
    ours.set(word, phonemize(word, VARIETY));
}

const ourNuclei = (ipa: string): string[] => [...ipa].filter((c) => VOWEL.test(c) || c === "ᵻ");

function refNuclei(phones: string[]): string[] {
    const bare = phones.map((p) => p.replace(/[ːˑ]/gu, ""));
    const out: string[] = [];
    for (let i = 0; i < bare.length; i++) {
        const p = bare[i]!;
        if (!VOWEL.test(p)) continue;
        const next = bare[i + 1];
        if (next !== undefined && REF_DIPHTHONG.has(p + next)) { out.push(p + next); i++; continue; }
        out.push(p);
    }
    return out;
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
        const mine = ourNuclei(ipa), theirs = refNuclei(ref);
        // ⚠ A COUNT MISMATCH IS SKIPPED, NOT GUESSED AT. What remains after the diphthong merge is a real
        // structural disagreement (the referee's non-syllabic `n` for our `ən`, or a different
        // syllabification), and aligning those by position would manufacture the contamination above.
        if (mine.length !== theirs.length || mine.length === 0) { skipped++; continue; }
        words++;
        for (let i = 0; i < mine.length; i++) {
            if (mine[i] !== symbol) continue;
            slots++;
            const t = theirs[i]!;
            counts.set(t, (counts.get(t) ?? 0) + 1);
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
