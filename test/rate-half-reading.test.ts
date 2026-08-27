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
 * ⚠ STILL HALF-READING, LISTED BY CODE SO THE LIST CAN ONLY SHRINK.
 *
 * Most of these keep a LOCAL unit rewrite in their own engine — the shape a language reaches for when its
 * unit noun PRECEDES the number, since the shared tier can only postpose — and each such arm hand-wrote its
 * trailing guard instead of taking the shared one. The core fix cannot reach them, and every entry is a
 * per-file edit needing its own before/after, because the arms are all shaped differently.
 *
 * ⚠ THAT IS "MOST", NOT "EACH", AND THE DIFFERENCE IS DELIBERATE. Four of the codes here were checked by
 * reading the file (`en`, `nya`, `ckb`, `fa` — all local, though `nya` keeps its tier call in `chichewa.ts`
 * rather than `normalize.ts`, which a grep of the wrong file will miss); the rest are classified by
 * behaviour alone. Writing "each" would be the same unmeasured blanket #1095 was filed about.
 *
 * ⚠ EVERY ENTRY HERE IS PRE-EXISTING, verified by running this sweep on both sides of the change: the
 * fix moved 290 half readings to 37 and introduced none. `smj` was on an earlier draft of this list and
 * came off as a FALSE POSITIVE of the instrument — see `spokeAWord`.
 * ⚠ A NEW LANGUAGE MUST NOT JOIN THIS LIST. It exists to be emptied.
 */
const ACCEPTED_HALF = new Set(
    ("bg cjy ckb da en en-GB en-IN fa gan hak hmn hsn is ka ko lg lt mr ms my nb nso nya om or pbt ps " +
        "ro sd skr so ug wuu yo yue za zsm").split(" "),
);

const CODES = [
    ...new Set([...readFileSync("src/registry.ts", "utf8").matchAll(/^\s*case "([^"]+)":/gmu)].map((m) => m[1]!)),
];

/**
 * Did the unit contribute a WORD of its own, or is the engine just spelling the letters?
 *
 * ⚠ A LENGTH TEST IS NOT ENOUGH AND smj IS WHY. Lule Sámi reads `5 km` as *ˈvihtːɑ ˈkʰm* — the raw
 * letters, four characters, indistinguishable by length from Akan's genuine *mita*. It declares no unit
 * word at all, so `5 km/h` is a FULL leak and not half a reading, and an instrument that cannot see the
 * difference puts a language on this ledger for a defect it does not have. A unit word has a VOWEL in it;
 * a vowel-less run of consonants is the abbreviation itself.
 * ⚠ AND THE NUMERAL IS REMOVED WHEREVER IT SITS, not sliced off the front: ~30 engines are unit-PREFIX
 * (*mamita 5*), and a prefix test silently excused every one of them.
 */
const spokeAWord = (plain: string, five: string): boolean =>
    /[əaeiouɪʊɛɔɐæyøɘɤʌɯɵœɜɞʉɨɶɑɒʏ]/u.test(plain.replace(five, ""));

/**
 * ⚠ A RUN ROUTED TO THE ENGLISH READER IS A DIFFERENT CLASS — the language never claimed the unit, so
 * there is no numerator of its own to half-read. Detected by asking English what it would say rather than
 * by pattern-matching its output: an earlier `/kjˈuːbd|ˈɛm |skwˈɛəd/` missed `ˈɛm` at end-of-string and
 * put nine languages on this ledger for the foreign reader's behaviour.
 */
const EN_READS = new Map<string, string>();
const routedToEnglish = (plain: string, sym: string, code: string): boolean => {
    if (code === "en") return false;
    if (!EN_READS.has(sym)) EN_READS.set(sym, phonemize(sym, "en").trim());
    return plain.endsWith(EN_READS.get(sym)!);
};

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
                if (plain === null || rate === null || routedToEnglish(plain, sym, code)) continue;
                if (!spokeAWord(plain, five)) continue; // the unit contributed no word of its own
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
                if (plain === null || rate === null || routedToEnglish(plain, sym, code)) continue;
                if (!spokeAWord(plain, five) || !rate.startsWith(plain)) continue;
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
