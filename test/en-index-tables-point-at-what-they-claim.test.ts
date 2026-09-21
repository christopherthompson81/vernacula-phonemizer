/**
 * TWO DATA FILES INDEX INTO `g2p-dict.tsv` BY POSITION, AND NOTHING CHECKED THAT THE POSITIONS STILL
 * MEAN ANYTHING.
 *
 * ⚠ `en-syllabic.tsv` and `en-nasal-seam.tsv` store INTEGER OFFSETS into the shipped ARPABET row, not
 * phone names. A dictionary correction that changes a row's LENGTH silently re-points every index to
 * its right — and the failure is invisible, because an index landing on the wrong phone does not throw:
 * the slot simply stops applying, or applies to something else.
 *
 * ⚠ THIS IS NOT HYPOTHETICAL AND IS WHY THE FILE EXISTS. #1378's block dropped a yod from `buccal`
 * (`B Y UW1 K AH0 L` → `B AH1 K AH0 L`) and inserted a `G` into `recognizance`, and both rows' syllabic
 * slots rotted: `bjˈuːkɫ̩` shipped as `bˈʌkəɫ` and `ɹᵻkʰˈɑːnəzn̩s` as `ɹᵻkʰˈɑːɡnəzəns`. 6,135 tests
 * stayed green. `en-nasal-seam.tsv` has its own pinned words in en-nasal-seam.test.ts, which is how
 * that table's indices have been kept honest; the syllabic table had nothing at all.
 *
 * The check is the one the generators already encode: an index must land on the phone CLASS its table
 * is about. It cannot tell a right slot from a wrong one — only a live one from a rotted one, which is
 * exactly the failure a length change produces.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const EN = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "languages", "english");

function rows(file: string): [string, number[]][] {
    const out: [string, number[]][] = [];
    for (const l of readFileSync(join(EN, file), "utf8").split("\n")) {
        if (l.startsWith("#") || !l.includes("\t")) continue;
        const [w, v] = l.split("\t");
        out.push([w!, v!.trim().split(",").map(Number)]);
    }
    return out;
}

const dict = new Map<string, string[]>();
for (const l of readFileSync(join(EN, "g2p-dict.tsv"), "utf8").split("\n")) {
    if (l.startsWith("#") || !l.includes("\t")) continue;
    const [w, p] = l.split("\t");
    dict.set(w!, p!.split(" "));
}

describe("the position-indexed tables still point at the phones they claim", () => {
    // ⚠ THE SONORANT TEST IS PART OF THE CLAIM, NOT A BONUS. A syllabic slot is "the schwa before
    // L/N/M is really the sonorant carrying the syllable" — an index on a reduced vowel with no
    // sonorant after it is as rotted as one on a consonant, and `buccal`'s bad index landed on the L.
    /**
     * ⚠ NINE ROWS WERE ALREADY ROTTED WHEN THIS CHECK WAS WRITTEN, and they are WAIVED rather than
     * repaired, because repairing them here would be guessing. Every one is an off-by-one — the
     * signature of a dict row that gained or lost a phone after the table was generated — and
     * `en_build_syllabic.mts --write` produces 1,615 MORE rows than the committed file, so the table
     * is long stale and regenerating it is its own piece of work with its own referee question.
     * ⚠ AND ONE OF THE NINE IS GENUINELY AMBIGUOUS, which is the reason not to hand-fix the set:
     * `unreasonable` (AH2 N R IY1 Z AH0 N AH0 B AH0 L) has TWO slots a reduced vowel before a sonorant
     * could mean, index 5 and index 9, and the rotted 8 is one step from each.
     */
    const PRE_EXISTING_ROT = new Set([
        "appreciable", "departmental", "extraordinary", "forbidden", "insignificance",
        "methuselah", "negotiable", "unreasonable", "vehicle",
    ]);

    test("every en-syllabic.tsv index is a reduced vowel followed by L, N or M", () => {
        const bad: string[] = [];
        for (const [w, idx] of rows("en-syllabic.tsv")) {
            const p = dict.get(w);
            if (p === undefined) continue;   // en-lexicon-covers-dict.test.ts owns coverage
            for (const i of idx) {
                const here = p[i], next = p[i + 1];
                if (here !== "AH0" && here !== "IH0") { bad.push(`${w}[${i}] = ${here ?? "(past end)"}`); continue; }
                if (next !== "L" && next !== "N" && next !== "M") bad.push(`${w}[${i}] → ${next ?? "(past end)"}`);
            }
        }
        expect(bad.filter((x) => !PRE_EXISTING_ROT.has(x.split("[")[0]!))).toEqual([]);
        // ⚠ AND THE WAIVER MAY NOT ROT EITHER. A row repaired by a future rebuild should leave this
        // list, not sit in it masking the next one — the same rule en-curation-gap.test.ts applies to
        // its known gaps, and the reason that test caught four stale waivers during #1334.
        const stillBad = new Set(bad.map((x) => x.split("[")[0]!));
        expect([...PRE_EXISTING_ROT].filter((w) => !stillBad.has(w))).toEqual([]);
    });

    test("every en-nasal-seam.tsv index is an N", () => {
        const bad: string[] = [];
        for (const [w, idx] of rows("en-nasal-seam.tsv")) {
            const p = dict.get(w);
            if (p === undefined) continue;
            for (const i of idx) if (p[i] !== "N") bad.push(`${w}[${i}] = ${p[i] ?? "(past end)"}`);
        }
        expect(bad).toEqual([]);
    });
});
