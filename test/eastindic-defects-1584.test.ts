/**
 * #1584: bn and as defects found by the Rust port of the eastindic group. All inputs are synthetic. Mirrored in C#
 * (`EastIndicDefects1584Tests.cs`) and Rust (the `bengali` and `assamese` module tests).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { BENGALI_DIGITS } from "../src/core/unicode.ts";
import { phonemizeAsync } from "../src/index.ts";
import { normalizeAssamese } from "../src/languages/assamese/normalize.ts";

const haveEnModel = existsSync(join(import.meta.dirname, "../data/languages/english/en-g2p-tagger.int8.onnx"));

/** Every Bengali digit folded to ASCII, so a Bengali-digit reading can be compared with the ASCII one. */
const fold = (s: string): string => [...s].map((c) => BENGALI_DIGITS[c] ?? c).join("");

describe("#1584", () => {
    /** bn's best path built its engine with `getPhonemizer("en").text`, which skips the foreign-OOV memo. */
    test.skipIf(!haveEnModel)("bn best reads an embedded OOV English word as en best does", async () => {
        for (const word of ["Quexington", "Zorblatt"]) {
            const en = await phonemizeAsync(word, "en");
            const bn = (await phonemizeAsync(`আমি ${word} যাব`, "bn")).split(" ");
            expect(bn[1], word).toBe(en);
        }
    });

    /** The `<`, `>` and `×` rules keyed on ASCII `\d`; the header says every rule accepts both digit scripts. */
    test("as: the sign rules read Bengali digits as they read ASCII ones", () => {
        for (const [bengali, ascii] of [["৩ < ৫", "3 < 5"], ["৯ > ২", "9 > 2"], ["৪ × ৬", "4 × 6"], ["৪×6", "4×6"]]) {
            const got = normalizeAssamese(bengali!);
            expect(got, bengali).not.toBe(bengali);
            expect(fold(got), bengali).toBe(normalizeAssamese(ascii!));
        }
    });
});
