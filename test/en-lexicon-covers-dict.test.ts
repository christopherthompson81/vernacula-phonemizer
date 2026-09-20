/**
 * EVERY `g2p-dict.tsv` ROW MUST HAVE AN `accent-lexicon.tsv` ROW, or the engine never looks it up.
 *
 * ⚠ THIS EXISTS BECAUSE THE SUCCESS SIGNAL WAS INDISTINGUISHABLE FROM THE NO-OP. `en_rebuild_lexicon.mts`
 * WALKS the lexicon and looks each row's ARPABET up, so a word added to the dictionary and nowhere else
 * is not "unchanged", it is invisible — and the tool prints `would change: 0`, which reads exactly like
 * "already correct". #1386 added seven interjection rows (`brr`, `tsk`, `pfft`…), read that line, and
 * shipped a fix that did nothing at all. The tool's own header warned about it in prose and
 * `--add-missing` already existed; neither helped at the moment it was needed.
 *
 * ⚠ THE INVARIANT IS EXACT, NOT A BUDGET. The standing gap is zero, so this is assertable rather than a
 * threshold to be tuned — and a curated hand correction that never reaches the lexicon is inert by
 * construction, which is the case that actually shipped.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const EN = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "languages", "english");
const keys = (file: string): Set<string> =>
    new Set(readFileSync(join(EN, file), "utf8").split("\n")
        .filter((l) => l.includes("\t") && !l.startsWith("#"))
        .map((l) => l.split("\t")[0]!));

describe("the flat lexicon covers the dictionary", () => {
    const lexicon = keys("accent-lexicon.tsv");

    test("every dictionary word has a lexicon row", () => {
        expect([...keys("g2p-dict.tsv")].filter((w) => !lexicon.has(w))).toEqual([]);
    });

    // ⚠ THE CASE THAT ACTUALLY SHIPPED. A curated row is a HAND correction; if the word has no lexicon
    // row the correction reaches nothing, and every gate stays green because the dictionary does contain
    // the row it was asked to contain.
    test("every curated word has a lexicon row, so no hand correction is inert", () => {
        expect([...keys("g2p-curated.tsv")].filter((w) => !lexicon.has(w))).toEqual([]);
    });
});
