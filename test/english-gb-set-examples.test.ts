/**
 * THE MEMBERSHIPS NAMED IN PROSE ARE CLAIMS ABOUT GENERATED FILES, AND GENERATED FILES MOVE.
 *
 * ⚠ THIS EXISTS BECAUSE A COMMENT WENT STALE IN BOTH HALVES AT ONCE. `english-gb.ts` said the marry
 * mapping lives in a word list "exactly as `lotr` carries `sorry` and `bath` carries `dramatize`" —
 * and `sorry` is not in `en-gb-lotr.tsv` at all, while `dramatize` left `en-gb-bath.tsv` at #1391.
 * Neither half was true when a review checked them, and nothing had noticed, because a comment naming
 * a row in a GENERATED artifact is exactly the kind of claim no gate covers.
 *
 * ⚠ IT IS DELIBERATELY TINY. The six sets have their own freshness ritual (`npm run check:en-gb-sets`)
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

    it("keeps TRAP's discriminator honest in both directions", () => {
        // ⚠ TRAP (#1414) IS THE SET THAT FIXES #1411's RESIDUE: dropping 121 words from PALM moved 41 of
        // them from one wrong vowel to another, because no set expressed `ɑː → æ`. These are the words
        // whose TRAP reading the primary referee attests with a properly-spelled `æ` row — which #1414
        // said it could not do, and which is the premise that turned out to be wrong.
        const trap = members("trap");
        for (const w of ["pasta", "taco", "drachma", "regatta", "natasha", "salsa", "dacha", "piazza"])
            expect([w, trap.has(w)]).toEqual([w, true]);
        // ⚠ AND THE DISCRIMINATOR IS THE HALF THAT WOULD BREAK QUIETLY. A referee that attests our
        // UN-EDITED `ɒ` as well is saying the LOT reading is real, and on these our current output is
        // simply right — `squad skwɒd`, `wan wɒn`, `guam ɡwɒm`, `aquatic əkwɒtɪk`. It refuses 14 of 189
        // claims, TEN OF THEM THE /w/ ENVIRONMENT, so it is doing phonological work and not filtering
        // noise. Without it the set would regress 7.4% of what it touches.
        for (const w of ["squad", "wan", "guam", "aquatic", "taiwan", "genealogy", "wandle", "rwanda",
            "falafel"]) expect([w, trap.has(w)]).toEqual([w, false]);
        // ⚠ `falafel` IS IN THAT LIST BECAUSE A COMMENT NAMED IT AS A MEMBER AND IT IS NOT ONE. The referee
        // lists `fəlɒfəl` beside `fəlæfəl`, so the discriminator refused the claim and the word still ships
        // `fəlˈɒfɫ̩` — review caught the prose, not a gate, which is the exact failure this FILE exists for
        // showing up in the comment that introduces the set. Pinned on the refused side so it cannot drift
        // back into a list of members.
        // `antipasto` is refused for a THIRD reason and is the positional check: its referee TRAP vowel
        // (`æntipɑstəʊ`) is in the first syllable and the segment the LOT rule produced is in the third.
        expect([...trap]).not.toContain("antipasto");
    });

    it("drops the words #1391's length tell was written to remove", () => {
        // ⚠ BOTH DIRECTIONS, because a detector verified only on positives takes good rows with it —
        // the lesson #1404's exclusion regex learned across four drafts.
        const bath = members("bath");
        for (const w of ["platform", "platforms", "fang", "dramatize", "amatory", "intaglio"])
            expect([w, bath.has(w)]).toEqual([w, false]);
    });
});
