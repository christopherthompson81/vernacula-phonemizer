import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/nahuatl/nahuatl.ts";
import { numberToWords } from "../src/languages/nahuatl/numbers.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Classical Nahuatl / nāhuatlahtōlli (nci) — Uto-Aztecan, the
// traditional Spanish-based orthography. AUTHORED from Andrews, *Introduction to Classical Nahuatl* (§2). Vowel
// length is unwritten in traditional texts → short vowels (the referee's ː is backbone-folded). Two corroborating
// human referees (wikipron 886 / kaikki 2329).
describe("Classical Nahuatl (nāhuatlahtōlli) canonical IPA", () => {
    test("the affricates + digraphs + saltillo", () => {
        expect(phonemizeWord("nahuatl")).toBe("nawat͡ɬ"); // ⟨hu⟩→[w], ⟨tl⟩→[t͡ɬ]
        expect(phonemizeWord("Ahuitzotl")).toBe("awit͡sot͡ɬ"); // ⟨tz⟩→[t͡s]
        expect(phonemizeWord("xochitl")).toBe("ʃot͡ʃit͡ɬ"); // 'flower' — ⟨x⟩→[ʃ], ⟨ch⟩→[t͡ʃ]
        expect(phonemizeWord("tlahtolli")).toBe("t͡ɬaʔtolli"); // 'word' — the SALTILLO ⟨h⟩→[ʔ] (after a vowel)
    });

    test("the c/qu/cu/uc context rules (§2.4)", () => {
        expect(phonemizeWord("cihuatl")).toBe("siwat͡ɬ"); // 'woman' — ⟨c⟩ before i → [s]; ⟨hu⟩→[w]
        expect(phonemizeWord("quimichin")).toBe("kimit͡ʃin"); // ⟨qu⟩ before i → [k]
        expect(phonemizeWord("cuauhtli")).toBe("kʷawt͡ɬi"); // 'eagle' — ⟨cu⟩+V→[kʷ], ⟨uh⟩ coda→[w]
        expect(phonemizeWord("teuctli")).toBe("tekʷt͡ɬi"); // 'lord' — ⟨uc⟩ coda → [kʷ]
    });

    test("the ⟨chu⟩ trap + word-initial ⟨h⟩ is not a saltillo", () => {
        expect(phonemizeWord("cachuah")).toBe("kakwaʔ"); // ⟨chu⟩ = [k]-coda + ⟨hu⟩[w] (=/kakwa/), NOT [t͡ʃ]
        expect(phonemizeWord("yehhuatl")).toBe("jeʔwat͡ɬ"); // ⟨h⟩→[ʔ] then ⟨hu⟩→[w]; ⟨y⟩→[j]
        expect(phonemizeWord("he")).toBe("e"); // word-initial ⟨h⟩ is silent (saltillo only occurs AFTER a vowel)
    });

    test("registry wiring", () => {
        expect(getPhonemizer("nci").text("nahuatl").trim()).toBe("nawat͡ɬ");
    });
});

// ---------------------------------------------------------------------------------------------------------
// Cardinal numbers. VIGESIMAL (base 20) and positional, with a magnitude noun per power of twenty:
// pōhualli 20 · tzontli 400 · xiquipilli 8000 · pōhualxiquipilli 160 000 · tzonxiquipilli 3 200 000 ·
// pōhualtzonxiquipilli 64 000 000. TWO joiners: the linker ⟨on-⟩ (⟨om-⟩ before a vowel or ⟨m⟩) inside the
// sub-400 part, and the relational ⟨īpan⟩ between groups from 400 up. Source: English Wiktionary's
// Module:number_list/data/nci (declared `base20`) + Appendix:Classical Nahuatl numerals; this compositor
// reproduces 212 of its 214 lemmatised cardinals exactly (the 2 divergences are errors in the source — see
// numbers.ts). Andrews §2, the g2p's source, does not tabulate numerals, hence the Wiktionary citation.
describe("Nahuatl numbers", () => {
    for (const [n, expected] of [
        [1, "cē"],
        [7, "chicōme"],
        [10, "mahtlāctli"],
        [11, "mahtlāctli oncē"],                       // no *11 word: 10 + 1 with the ⟨on-⟩ linker
        [12, "mahtlāctli omōme"],                      // ⟨on-⟩ → ⟨om-⟩ before a vowel
        [15, "caxtōlli"],
        [19, "caxtōlli onnāhui"],
        [20, "cempōhualli"],                           // 'one count'
        [21, "cempōhualli oncē"],
        [30, "cempōhualli ommahtlāctli"],              // ⟨om-⟩ before ⟨m⟩
        [35, "cempōhualli oncaxtōlli"],
        [42, "ōmpōhualli omōme"],
        [99, "nāppōhualli oncaxtōlli onnāhui"],        // 80 + 15 + 4
        [100, "mācuīlpōhualli"],                       // five counts
        [101, "mācuīlpōhualli oncē"],
        [200, "mahtlācpōhualli"],
        [220, "mahtlāctli oncempōhualli"],             // an 11 MULTIPLIER: 10 scores + 1 score
        [380, "caxtōlli onnāppōhualli"],               // a 19 multiplier: 15 + 4 scores
        [400, "centzontli"],
        [401, "centzontli īpan cē"],                   // ⟨īpan⟩ takes over from ⟨on-⟩ at 400
        [555, "centzontli īpan chicōmpōhualli oncaxtōlli"],
        [999, "ōntzontli īpan chiucnāppōhualli oncaxtōlli onnāhui"], // 800 + 180 + 15 + 4
        [1000, "ōntzontli īpan mahtlācpōhualli"],      // 800 + 200 — attested verbatim
        [8000, "cenxiquipilli"],
        [9000, "cenxiquipilli īpan ōntzontli īpan mahtlācpōhualli"], // attested verbatim
        [15000, "cenxiquipilli īpan caxtōlli omōntzontli īpan mahtlācpōhualli"], // attested verbatim
        [160000, "cempōhualxiquipilli"],
        [1000000, "chicuacempōhualxiquipilli īpan mācuīlxiquipilli"], // attested verbatim
        [3200000, "centzonxiquipilli"],
        [64000000, "cempōhualtzonxiquipilli"],
    ] as const) {
        test(`${n} → ${expected}`, () => expect(numberToWords(n)).toBe(expected));
    }

    test("159999, the densest attested composite, verbatim", () => {
        expect(numberToWords(159999)).toBe(
            "caxtōlli onnāuhxiquipilli īpan caxtōlli onnāuhtzontli īpan caxtōlli onnāppōhualli oncaxtōlli onnāhui",
        );
    });

    test("no gaps or sentinels across 0..20000", () => {
        for (let n = 0; n <= 20000; n++) expect(numberToWords(n), `n=${n}`).not.toMatch(/undefined|NaN|[0-9]/);
    });

    // 20⁷ = 1 280 000 000 has no further magnitude noun → digit-by-digit. Classical Nahuatl has no attested
    // numeral for zero; ⟨ahtle⟩ 'nothing' is a disclosed stopgap (see numbers.ts).
    test("above 20⁷ → digit-by-digit, and the zero stopgap", () => {
        expect(numberToWords(0)).toBe("ahtle");
        expect(numberToWords(20 ** 7)).toBe("cē ōme chicuēyi ahtle ahtle ahtle ahtle ahtle ahtle ahtle"); // 1 280 000 000
    });

    test("end-to-end: the numeral is phonemized, not passed through as digits", () => {
        expect(phonemize("21", "nci")).toBe("sempoːwalli onseː"); // cempōhualli oncē — ⟨ce⟩ = [se]
        expect(phonemize("400", "nci")).toBe("sent͡sont͡ɬi"); // centzontli
    });
});
