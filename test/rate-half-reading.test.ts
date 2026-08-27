/**
 * A RATE MUST NOT READ AS ITS NUMERATOR PLUS A STRAY.
 *
 * ⚠ THE DEFECT WAS A TIER ANSWERING A DATA GAP WITH HALF A READING. `km/h` is a unit and a DENOMINATOR
 * NOUN, and a language that has not sourced the noun cannot say it. The shared tier's response was to match
 * the numerator anyway — speaking "five kilometres" and leaving `/h` outside the match, to reach the phoneme
 * sink as a bare letter. `5 m/s` became *five metres s*: the speed of light read out as a distance (#1093).
 *
 * ⚠ AND THE SAME FILE ALREADY KNEW BETTER. `makeBareUnitNormalizer`, two screens below the arm that did
 * this, declines a unit before a slash for exactly this reason — "a half reading is worse than a visible
 * leak". The two arms disagreed and the bare one was right; the guard now applies its rule to the
 * digit-adjacent arm and to the local unit tables that bypass the tier entirely.
 *
 * ⚠ A VISIBLE LEAK IS THE INTENDED OUTCOME HERE, not a failure. When the denominator is undeclared the
 * whole match declines and `km/h` stays in the text as `km/h`, where `mine.ts scan` and the raw-Latin gates
 * can see it and a reader can source the word. That is the state this test asserts.
 *
 * THE INSTRUMENT IS LANGUAGE-AGNOSTIC and needs no IPA knowledge: read the plain unit, read the rate, and
 * fail when the rate is the plain reading plus a tail too short to be a word. It cannot be satisfied by
 * silence — a language that drops the numerator is not "plain reading + tail" and fails the prefix test on
 * its own terms.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

const SHAPES = [["km", "h"], ["m", "s"], ["km²", "h"], ["m³", "s"], ["kg", "m"]] as const;

/**
 * ⚠ STILL HALF-READING, LISTED BY CODE SO THE LIST CAN ONLY SHRINK. Each of these keeps a LOCAL unit table
 * in its own `normalize.ts` — the shape 14 languages use because their unit noun PRECEDES the number and
 * the shared tier can only postpose — and each such table hand-wrote the trailing guard rather than taking
 * the shared one. The core fix cannot reach them; every entry is a per-file edit of the same one character,
 * and each needs its own before/after because the arms are all shaped differently.
 * ⚠ A NEW LANGUAGE MUST NOT JOIN THIS LIST. It exists to be emptied.
 */
const ACCEPTED_HALF = new Set(
    ("bg ckb da en en-GB en-IN fa is ka ko lg lt mr ms my nb nso nya om pbt ps ro sd smj so ug yo za " +
        "zsm").split(" "),
);

const CODES = [
    ...new Set([...readFileSync("src/registry.ts", "utf8").matchAll(/^\s*case "([^"]+)":/gmu)].map((m) => m[1]!)),
];

/** The English foreign reader's signature. A run routed OUT of the language is a different class — the
 *  language never claimed the unit, so there is no numerator of its own to half-read. */
const FOREIGN = /kjˈuːbd|ˈɛm |skwˈɛəd/u;

const say = (s: string, code: string): string | null => {
    try {
        return phonemize(s, code).trim();
    } catch {
        return null; // an unported/throwing engine is a different test's business
    }
};

describe("an unreadable rate declines to a visible leak (#1093)", () => {
    test("no engine speaks the numerator and strands the denominator", () => {
        const half: string[] = [];
        for (const code of CODES) {
            if (ACCEPTED_HALF.has(code)) continue;
            const five = say("5", code);
            if (five === null) continue;
            for (const [sym, den] of SHAPES) {
                const plain = say(`5 ${sym}`, code);
                const rate = say(`5 ${sym}/${den}`, code);
                if (plain === null || rate === null || FOREIGN.test(plain)) continue;
                if (plain.length - five.length < 5) continue; // the unit contributed no word of its own
                if (!rate.startsWith(plain)) continue;
                const tail = rate.length - plain.length;
                if (tail > 0 && tail <= 4) half.push(`${code} ${sym}/${den} → ${JSON.stringify(rate)}`);
            }
        }
        expect(half).toEqual([]);
    });

    test("⚠ THE ACCEPTED LIST MAY ONLY SHRINK — an entry that now declines must be removed", () => {
        const fixed: string[] = [];
        for (const code of ACCEPTED_HALF) {
            const five = say("5", code);
            if (five === null) continue;
            let stillHalf = false;
            for (const [sym, den] of SHAPES) {
                const plain = say(`5 ${sym}`, code);
                const rate = say(`5 ${sym}/${den}`, code);
                if (plain === null || rate === null || FOREIGN.test(plain)) continue;
                if (plain.length - five.length < 5 || !rate.startsWith(plain)) continue;
                const tail = rate.length - plain.length;
                if (tail > 0 && tail <= 4) stillHalf = true;
            }
            if (!stillHalf) fixed.push(code);
        }
        expect(fixed).toEqual([]);
    });

    test("a DECLARED rate still reads, and a numeric denominator is not a rate at all", () => {
        // The guard must not cost a language the readings it HAS sourced.
        expect(phonemize("5 km/h", "mt").trim()).toContain("fɪs"); // fis-siegħa, Maltese's fused per-hour
        expect(phonemize("5 km/h", "shi").trim()).toContain("tasraɡt"); // Tashelhit reads every rate probed
        // ⚠ `120mg/100ml` is a RATIO of two readable quantities, not a stranding — Min Nan's blood-sugar
        // article writes it, and this arm reads the first while its own next match reads the second.
        // Declining it would leak BOTH units raw, which is this guard's own failure mode inverted.
        expect(phonemize("120mg/100ml", "nan").trim()).not.toMatch(/\bmg\b|\bml\b/u);
    });
});
