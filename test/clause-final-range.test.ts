/**
 * A RANGE THAT ENDS A CLAUSE IS STILL A RANGE — fleet-wide, in CI.
 *
 * ⚠ WHY THIS EXISTS RATHER THAN LIVING IN `review.ts`. The clause-final check is already there, but its two
 * RANGE probes are declared UNGATED (`review.ts` → `CLAUSE_FINAL`, the `false` flag), so a language that
 * declines `1990-1995.` prints a `note` and still reports `[ ok ] clause-final`. And `review.ts` is a manual
 * instrument that CI never runs. The result was a defect class that was simultaneously known, measured and
 * invisible: a fleet sweep found it live in 36 treated languages, 25 of them with real corpus instances —
 * `ht` ×26, `et` ×14, `ln`/`so`/`st`/`su` ×13, `lg` ×12 — while every one of those languages' own gate was
 * green. This test is the sweep, pinned, so the number can only go down.
 *
 * THE DEFECT is playbook trap 58: a trailing guard written to keep a decimal or a chained hyphen out
 * (`(?![,\d…])`) also refuses the ordinary clause mark that follows a range at the end of a sentence. The
 * rule is then correct about every range that happens not to end a clause, which is why it survives review.
 *
 * THE FIX is always the same shape and is worth stating once: reject a DIGIT, never a bare mark — `,\d`
 * instead of `,` in the lookahead. That keeps `1990-1995,5` and `2020-05-17` out and lets `137–151,` through.
 * ⚠ THE COMMA IS THE ONLY CHARACTER ANY OF THEM GOT WRONG. Four of the eleven (ak, bm, et, pbt) deliberately
 * ADMIT a dot-decimal after a range and have passing tests pinning it, so writing `[.,]\d` everywhere — the
 * first cut of this sweep — changed behaviour those layers had chosen. Per-layer, the edit is: take the bare
 * `,` out of the reject class, put `,\d` in the alternation, and touch nothing else. ELEVEN languages were repaired this way in one pass — ht, ln, st, tn, wo, ak, bm, et,
 * mad, pbt, yue — after their regexes turned out to carry the identical trailing class, which is the argument
 * for fixing the class rather than the language: the same six characters were wrong in eleven files.
 *
 * ⚠ THE ALLOWLIST IS A BACKLOG, NOT A DECISION. Every entry is a language whose range rule still declines a
 * clause mark. Entries are removed by fixing the language, never by re-measuring; a new language must not be
 * added without an argument, and "it has no corpus instances" is not one — trap 8, since zero instances in a
 * 460-segment sample says nothing about a 400,000-paragraph corpus. The count beside each is how many of the
 * four probe/mark combinations it fails, which is a rough proxy for whether one mark or both are affected.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { lostTokens } from "../tools/normalization/review.ts";

/** Languages whose range rule still gives up at a clause mark. Remove an entry by FIXING the language. */
const NOT_YET_REPAIRED = new Set([
    // both marks (4/4 probes) — these decline the period as well as the comma
    "bo", "ceb", "cjy", "gan", "gu", "hmn", "hsn", "mr", "ne", "om", "sk", "sl", "sv", "sw", "syl", "xh", "zu",
    // one mark (2/4) — the period is already handled and the comma is not, or vice versa
    "ff", "ga", "ha", "jv", "lg", "so", "su", "wuu",
]);

const CODE_COLUMN = "code";
const NORMALIZATION_COLUMN = "normalization";
const CATALOGUE = "tools/language-catalogue/catalogue.tsv";

/** Every language the catalogue records as having its own normalization layer. */
function treatedLanguages(): string[] {
    const lines = readFileSync(CATALOGUE, "utf8").split("\n").filter(Boolean);
    const header = lines[0]!.split("\t");
    const code = header.indexOf(CODE_COLUMN);
    const norm = header.indexOf(NORMALIZATION_COLUMN);
    return lines
        .slice(1)
        .map((l) => l.split("\t"))
        .filter((r) => (r[norm] ?? "") === "done")
        .map((r) => r[code]!);
}

/**
 * ⚠ TWO PROBES, BECAUSE THE ASCII HYPHEN AND THE EN DASH ARE DIFFERENT RULES in several layers — one may be
 * guarded correctly and the other not. Both marks, because the period and the comma are separately guarded.
 */
const PROBES = ["1990-1995", "137–151"] as const;
const MARKS = [".", ","] as const;

describe("a trailing clause mark never costs a language its range reading", () => {
    const treated = treatedLanguages();

    test("the catalogue is readable and the fleet is the size we think", () => {
        expect(treated.length).toBeGreaterThan(100);
    });

    test("no repaired language loses a reading at a clause end", () => {
        const broken: string[] = [];
        for (const code of treated) {
            if (NOT_YET_REPAIRED.has(code)) continue;
            for (const probe of PROBES) {
                let bare: string;
                try {
                    bare = phonemize(probe, code).trim();
                } catch {
                    continue; // the engine has no path for a bare figure pair; nothing to compare
                }
                for (const mark of MARKS) {
                    /**
                     * ⚠ THE MARKED PROBE NEEDS ITS OWN GUARD. Only the bare call was wrapped, so a language
                     * that resolves `1990-1995` and throws on `1990-1995.` would abort the whole fleet test
                     * with an exception instead of appearing as one entry — the opposite of a countable
                     * backlog, and it would take every language after it down with it.
                     */
                    let marked: string;
                    try {
                        marked = phonemize(probe + mark, code).trim();
                    } catch (e) {
                        broken.push(`${code} ${probe}${mark} THREW: ${String(e).slice(0, 60)}`);
                        continue;
                    }
                    const lost = lostTokens(bare, marked);
                    if (lost.length > 0) broken.push(`${code} ${probe}${mark} lost: ${lost.join(" ")}`);
                }
            }
        }
        expect(broken, `trap 58 — a range rule declined a clause mark:\n${broken.join("\n")}`).toEqual([]);
    });

    /**
     * ⚠ THE ALLOWLIST MUST STAY HONEST. An entry that no longer fails is an entry someone fixed without
     * removing it, and a stale allowlist is how a shrinking backlog quietly stops shrinking.
     */
    test("every allowlisted language still actually fails, or it should have been removed", () => {
        const stale: string[] = [];
        for (const code of NOT_YET_REPAIRED) {
            if (!treated.includes(code)) {
                stale.push(`${code} (not a treated language any more)`);
                continue;
            }
            let fails = false;
            for (const probe of PROBES) {
                let bare: string;
                try {
                    bare = phonemize(probe, code).trim();
                } catch {
                    continue;
                }
                for (const mark of MARKS) {
                    try {
                        if (lostTokens(bare, phonemize(probe + mark, code).trim()).length > 0) fails = true;
                    } catch {
                        fails = true; // a throw is a failure too, and keeps the entry honestly allowlisted
                    }
                }
            }
            if (!fails) stale.push(`${code} (now passes — delete it from NOT_YET_REPAIRED)`);
        }
        expect(stale, `stale allowlist entries:\n${stale.join("\n")}`).toEqual([]);
    });
});
