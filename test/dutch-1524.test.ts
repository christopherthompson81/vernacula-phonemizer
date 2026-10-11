import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { toSegments } from "../src/languages/dutch/g2p.ts";
import { phonemizeWord } from "../src/languages/dutch/dutch.ts";

// #1524: defects the Rust port found in nl. Expectations are RELATIONAL (an input reads as a spelling the engine
// already reads correctly) or structural (a nucleus exists, a vowel is not schwa) — never typed IPA.
const nl = (s: string): string => phonemize(s, "nl");

describe("nl #1524", () => {
    test.each([
        ["3.000,50 euro", "3000,50 euro"],
        ["1.000.000,25 euro", "1000000,25 euro"],
        ["1.000, dan", "1000, dan"],
    ])("1) a grouped amount keeps its decimal: %s reads as %s", (a, b) => {
        expect(nl(a)).toBe(nl(b));
    });

    test.each([["però", "pero"], ["lì", "li"], ["più", "piu"]])("2) %s reads its grave vowel as %s", (a, b) => {
        expect(nl(a)).toBe(nl(b));
    });
    test("2) a grave vowel is a nucleus", () => {
        const segs = toSegments("però");
        expect(segs[segs.length - 1]!.vowel).toBe(true);
    });

    // 3) a be-/ge-/te- spelling whose ⟨e⟩ is part of a vowel digraph is not a prefix: no shift, no schwa.
    test.each(["beenhouwer", "geelzucht", "beurtman", "geilheid", "teelbal"])("3) %s keeps its first nucleus", (w) => {
        const ipa = phonemizeWord(w);
        expect(ipa.startsWith(`${w[0] === "g" ? "ɣ" : w[0]}ˈ`)).toBe(true);
        expect(ipa.slice(0, 4)).not.toContain("ə");
    });
    test.each(["beginnen", "gebruiken", "beëdigen", "beamen", "verkopen"])("3) %s still shifts", (w) => {
        expect(phonemizeWord(w).slice(0, 2)).not.toContain("ˈ");
    });
});
