/**
 * #1551 (nl): a dotted number after a section word (hoofdstuk, artikel, figuur, versie, …) is not a clock. How the
 * number is spoken is not sourced, so it is only released from the clock rule: `hoofdstuk 3.12` must read as the
 * engine already reads `figuur 1.1` (the corpus's own section number), never as *drie uur twaalf*. Relational; no
 * IPA is typed. Inputs are synthetic.
 */
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

const nl = (s: string): string => phonemize(s, "nl");

describe("nl #1551: section numbers", () => {
    for (const [section, plain] of [
        ["Zie hoofdstuk 3.12 hier", "Zie hoofdstuk 3 . 12 hier"],
        ["In Hoofdstuk 2.10 staat het", "In Hoofdstuk 2 . 10 staat het"],
        ["Volgens art. 4.15 mag dat", "Volgens art. 4 . 15 mag dat"],
        ["versie 3.12 is uit", "versie 3 . 12 is uit"],
    ] as const)
        test(`${section} is not a clock`, () => expect(nl(section)).toBe(nl(plain)));

    test("a real clock still reads as one", () => {
        expect(nl("Het begint om 12.30 uur")).toBe(nl("Het begint om 12:30 uur"));
        expect(nl("rond 07.19 uur")).toBe(nl("rond 07:19 uur"));
    });
});
