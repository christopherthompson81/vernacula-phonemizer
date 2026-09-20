/**
 * THE STRESS PROJECTION IS THE INSTRUMENT, and every part of it that could invent evidence is pinned
 * here rather than left to a comment. Three of these tests exist because the first cut of the tool got
 * them wrong: a source with no primary was defaulted to nucleus 0 (which manufactured agreement on 156
 * Moby rows), the FIRST primary was taken rather than the last (which is not the one the engine
 * pronounces), and the remedy rewrote the whole row from gold rather than moving one digit.
 *
 * tools/english/en_stress_compare.mts — the stress axis of the triple-source audit.
 */
import { describe, expect, test } from "vitest";
import { inflections, malformed, moveprimary, primaryNucleus, refereePrimary, stressPattern } from "../tools/english/en_stress_compare.mts";

describe("what counts as the primary", () => {
    test("the pattern is the nuclei's digits and nothing else", () => {
        expect(stressPattern(["AW1", "T", "B", "IH2", "D"])).toEqual(["1", "2"]);
        expect(stressPattern(["S", "ER1", "K", "Y", "AH0", "L", "EY2", "SH", "AH0", "N"]))
            .toEqual(["1", "0", "2", "0"]);
    });

    // ⚠ THE LAST, BECAUSE THAT IS THE ONE `singlePrimary` KEEPS. 289 rows in the compared bucket carry
    // more than one — CMUdict declines to resolve compounds — and taking the first would score the
    // engine against a reading nothing produces.
    test("a multi-primary row is scored at the LAST primary, as the engine resolves it", () => {
        expect(primaryNucleus(["B", "EY1", "S", "B", "AO1", "L"])).toBe(1);
        expect(primaryNucleus(["AA1", "R", "CH", "B", "IH1", "SH", "AH0", "P"])).toBe(1);
    });

    // ⚠ THIS TEST USED TO ASSERT `toBe(0)`, "because `enforceSinglePrimary` promotes the first vowel",
    // AND THAT MODEL IS WRONG THREE TIMES OVER — see the tool's header. `enforceSinglePrimary` does not
    // run on the dictionary path at all; what can rescue such a word is `promoteFirstVowel` in
    // `english.ts`, which is CLAUSE-scoped and usually does not fire; and where it does it inserts
    // before the first IPA vowel CHARACTER, which is not the first nucleus. A row with no stress-1 has
    // no tonic, so there is no placement to compare and the audit abstains.
    test("a row with no primary has no placement, because the engine gives it none", () => {
        expect(primaryNucleus(["AH0", "K", "R", "EH2", "D", "AH0", "T"])).toBeUndefined();
        expect(malformed(["AH0", "K", "R", "EH2", "D", "AH0", "T"])).toBe(true);
        expect(malformed(["AH0", "K", "R", "EH1", "D", "AH0", "T"])).toBe(false);
        expect(malformed(["AH0", "V"])).toBe(false);          // a monosyllable is not malformed
    });

    test("a monosyllable has no placement to disagree about", () => {
        expect(primaryNucleus(["AH0", "V"])).toBeUndefined();
        expect(primaryNucleus(["S", "T", "R", "EH1", "NG", "K", "TH"])).toBeUndefined();
    });

    // ⚠ THE SAME FALLBACK APPLIED TO A SOURCE WOULD INVENT EVIDENCE — "the source puts it on the first
    // syllable" when the source marked nothing at all. 28,646 Moby rows carry no `'` anywhere and 156 of
    // them land in the compared bucket.
    // ⚠ AND IT COSTS NOTHING, WHICH IS WHY IT IS PINNED RATHER THAN JUSTIFIED BY A NUMBER: measured both
    // ways, the candidate count is 233 either way. What moves is the accounting of the rows that are NOT
    // candidates — "Moby records our placement" 421 → 413 and "Moby differs" 131 → 123, 16 rows that
    // stop casting a vote nobody cast. The guard is here because a manufactured vote is wrong even when
    // it happens not to change the answer.
    test("a referee that marked no primary abstains rather than defaulting to nucleus 0", () => {
        expect(refereePrimary(["AH0", "K", "R", "EH2", "D", "AH0", "T"])).toBeUndefined();
        expect(refereePrimary(["AH0", "K", "R", "EH1", "D", "AH0", "T"])).toBe(1);
    });
});

describe("the remedy moves the primary and nothing else", () => {
    // ⚠ NOT GOLD'S ROW. Gold's row also carries gold's SEGMENTS and gold's SECONDARIES, and this
    // relation adjudicates neither — #1377 moved a primary on a stress-BLIND agreement and got `mosel`
    // wrong for the mirror-image reason.
    test("our own segments survive, including the AH/IH the comparison merges", () => {
        // gold's `accredit` is AH0 K R EH1 D IH0 T; only the digit is licensed.
        expect(moveprimary(["AH0", "K", "R", "EH2", "D", "AH0", "T"], 1))
            .toEqual(["AH0", "K", "R", "EH1", "D", "AH0", "T"]);
    });

    test("the vacated primary becomes a secondary, which is what both referees write there", () => {
        expect(moveprimary(["AW1", "T", "B", "IH2", "D"], 1)).toEqual(["AW2", "T", "B", "IH1", "D"]);
    });

    test("a second primary is demoted too, so the row stops being malformed", () => {
        expect(moveprimary(["B", "EY1", "S", "B", "AO1", "L"], 0)).toEqual(["B", "EY1", "S", "B", "AO2", "L"]);
    });

    test("a secondary that is not the vacated primary is left exactly as ours", () => {
        expect(moveprimary(["S", "ER1", "K", "Y", "AH0", "L", "EY2", "SH", "AH0", "N"], 2))
            .toEqual(["S", "ER2", "K", "Y", "AH0", "L", "EY1", "SH", "AH0", "N"]);
    });
});

describe("the paradigm sweep's sibling enumerator", () => {
    // ⚠ E-ELISION IS THE BUG THIS PINS. A version that only concatenated looked `overcome` + `ing` up as
    // `overcomeing`, found nothing, and reported ten fore-stressed `-ing` rows as a clean paradigm.
    test("an e-final stem elides before -ing/-ed/-es", () => {
        expect(inflections("overcome")).toContain("overcoming");
        expect(inflections("outpace")).toEqual(expect.arrayContaining(["outpaced", "outpaces", "outpacing"]));
        expect(inflections("downgrade")).toContain("downgrading");
    });

    test("a consonant + y takes -ies/-ied", () => {
        expect(inflections("anchovy")).toContain("anchovies");
        expect(inflections("rhinoplasty")).toContain("rhinoplasties");
    });

    test("plain concatenation still holds for everything else", () => {
        expect(inflections("overpay")).toEqual(expect.arrayContaining(["overpays", "overpaying", "overpayed"]));
        expect(inflections("outbid")).toContain("outbids");
    });

    // ⚠ NOT DERIVATION. `government` → `governmental` legitimately moves the primary, and a version of
    // the sweep that enumerated `-ly`/`-ment`/`-al`/`-ness` reported 32 false alarms against 27 real ones.
    test("derivational suffixes are not siblings", () => {
        const i = inflections("government");
        for (const d of ["governmental", "governmentally", "governmentness"]) expect(i).not.toContain(d);
    });
});
