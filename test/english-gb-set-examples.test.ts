/**
 * THE MEMBERSHIPS NAMED IN PROSE ARE CLAIMS ABOUT GENERATED FILES, AND GENERATED FILES MOVE.
 *
 * ⚠ THIS EXISTS BECAUSE A COMMENT WENT STALE IN BOTH HALVES AT ONCE. `english-gb.ts` said the marry
 * mapping lives in a word list "exactly as `lotr` carries `sorry` and `bath` carries `dramatize`" —
 * and `sorry` is not in `en-gb-lotr.tsv` at all, while `dramatize` left `en-gb-bath.tsv` at #1391.
 * Neither half was true when a review checked them, and nothing had noticed, because a comment naming
 * a row in a GENERATED artifact is exactly the kind of claim no gate covers.
 *
 * ⚠ IT IS DELIBERATELY TINY. The five sets have their own freshness ritual (`npm run check:en-gb-sets`)
 * and their own product goldens; this pins ONLY the handful of memberships that documentation points
 * at by name, so the prose and the data cannot drift apart silently.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const members = (set: string): Set<string> =>
    new Set(readFileSync(`data/languages/english-gb/en-gb-${set}.tsv`, "utf8")
        .split("\n").filter((l) => l.includes("\t") && !l.startsWith("#")).map((l) => l.split("\t")[0]!));

describe("the set memberships that documentation names", () => {
    it("english-gb.ts's marry comment names two live examples", () => {
        // ⚠ CHANGE THE COMMENT AND THIS TEST TOGETHER. If a set legitimately loses one of these, the
        // comment is what needs editing — the example, not the membership, is the thing being asserted.
        expect([...members("lotr")]).toContain("borrow");
        expect([...members("bath")]).toContain("chance");
    });

    it("keeps the words #1391's length tell was written to protect", () => {
        // The tell refuses a BATH claim whose supporting rows are ALL length-less. These four have a
        // properly-spelled ɑː row beside a TRAP or short one and must survive it — the "solely, not at
        // all" half of the rule, which is the half that would break quietly.
        const bath = members("bath");
        for (const w of ["bath", "chance", "path", "banana"]) expect([w, bath.has(w)]).toEqual([w, true]);
    });

    it("applies the same length tell to PALM, in both directions", () => {
        // ⚠ PALM IS THE EDIT THAT RUNS *AWAY* FROM RP (ɒ → ɑː, toward the GenAm LOT vowel), so a
        // length-less row there is not merely weak evidence but positively the other variety's. 121
        // members were claimed with no properly spelled support, including very ordinary British
        // vocabulary — `conservation` shipped as kʰˌɑːnsəvˈeᶦʃən.
        // ⚠ MEASURED ON THE SAME POSITIVE AXIS FOR BOTH SIDES: espeak reads ɑː for 64% of the members the
        // tell KEEPS and 11% of the ones it DROPS — 5.8× — and ɒ for 4% against 47%. An earlier version
        // scored "espeak does not say ɑː" as agreement with ɒ, which is a different claim and was not
        // like for like against a kept side scored on a positive. #1411.
        const palm = members("palm");
        for (const w of ["conservation", "bobsled", "beatbox", "contrabass", "chiffon"])
            expect([w, palm.has(w)]).toEqual([w, false]);
        for (const w of ["father", "spa", "drama", "calm"]) expect([w, palm.has(w)]).toEqual([w, true]);
    });

    it("drops the words #1391's length tell was written to remove", () => {
        // ⚠ BOTH DIRECTIONS, because a detector verified only on positives takes good rows with it —
        // the lesson #1404's exclusion regex learned across four drafts.
        const bath = members("bath");
        for (const w of ["platform", "platforms", "fang", "dramatize", "amatory", "intaglio"])
            expect([w, bath.has(w)]).toEqual([w, false]);
    });
});
