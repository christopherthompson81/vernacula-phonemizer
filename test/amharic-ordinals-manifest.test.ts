/**
 * AMHARIC: the ordinal table, the decimal point and the range frame, read from the manifest.
 *
 * ⚠ THE TABLE IS DATA AND THE INFLECTION IS NOT, which is the line this lift draws. The cardinal→ordinal
 * pairing is a fact about Amharic vocabulary (አንድ→አንደኛ, and ⚠ a consonant-final 6th-order cardinal takes its
 * 1st-order counterpart first: ድ→ደ, ት→ተ, ኝ→ነ, ር→ረ). Which WORD of a composed numeral gets inflected — the
 * last one — and the ኛው definite re-attachment are the algorithm, and they stay in normalize.ts.
 *
 * ⚠ `rangeFrom` IS THE ONE THAT WAS INVISIBLE. `እስከ` had a named constant on both sides while the `ከ` that
 * opens the same frame was typed straight into the replacement template, so two thirds of the range frame
 * were declared and the third was not. Same word either way; what differs is whether anything can find it.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { MANIFEST as AM } from "../src/languages/amharic/manifest.ts";

const say = (s: string): string => phonemize(s, "am").replace(/[ˈˌ]/gu, "");

describe("am reads its ordinals from the manifest", () => {
    test("a unit ordinal is the declared form, not the cardinal plus a suffix", () => {
        // ⚠ THE POINT OF THE TABLE: `አንድ` does NOT simply take ኛ — the final consonant changes order first
        // (ድ→ደ). Emptying the map leaves the CARDINAL and a stranded ኛ as two tokens, which is the reading
        // this asserts against.
        // ⚠ NOT `not.toContain(say("አንድ"))` — the ordinal [andəɲa] legitimately CONTAINS the cardinal [and]
        // as a prefix, so a substring test fails on correct data. The comparison has to be whole-token.
        expect(AM.ordinals["አንድ"]).toBe("አንደኛ");
        expect(say("1ኛ ቦታ")).toBe(say("አንደኛ ቦታ"));
        expect(say("1ኛ ቦታ").split(" ")).toHaveLength(2);
        expect(say("1ኛ ቦታ")).not.toBe(say("አንድ ኛ ቦታ"));
    });

    test("a teen composes አስራ with the UNIT's ordinal — the algorithm, over the table", () => {
        // 16 = አስራ + ስድስት→ስድስተኛ. The table holds the unit; the composition is code.
        expect(say("16ኛው ክፍለ ዘመን")).toContain(say(AM.ordinals["ስድስት"]!.slice(0, -1)));
    });

    test("every declared ordinal is its own cardinal plus ኛ, after the order change", () => {
        for (const [card, ord] of Object.entries(AM.ordinals)) {
            expect(ord.endsWith("ኛ"), `${card} → ${ord} does not end in ኛ`).toBe(true);
            expect(ord.length).toBeGreaterThanOrEqual(card.length);
        }
    });
});

describe("am reads the decimal point and BOTH halves of the range frame", () => {
    test("the decimal point is the declared word", () => {
        expect(say("12.5 ሜትር")).toContain(say(AM.words.decimalPoint));
    });

    test("a hyphenated range is rewritten with `from … until …`, both from the manifest", () => {
        const said = say("ከ120-160 ሜትር");
        // ⚠ WHOLE-TOKEN, NOT `toContain`. Unwiring `rangeFrom` makes the emitted word the EMPTY STRING, and
        // `toContain("")` is vacuously true — the sabotage pass caught this test passing with the key gone.
        expect(said.split(" ")[0]).toBe(say(AM.words.rangeFrom));
        expect(said.split(" ")).toContain(say(AM.words.rangeUntil));
        // And the hyphen itself is gone — the frame replaced it rather than being read beside it.
        expect(said).not.toContain("-");
    });
});
