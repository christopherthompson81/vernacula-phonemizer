import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/nahuatl/nahuatl.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Classical Nahuatl / nāhuatlahtōlli (nci) — Uto-Aztecan (the fleet's FIRST), the
// traditional Spanish-based orthography. AUTHORED from Andrews, *Introduction to Classical Nahuatl* (§2). Vowel
// length is unwritten in traditional texts → short vowels (the referee's ː is backbone-folded). Two corroborating
// human referees (wikipron 886 / kaikki 2329) at ~93% folded / ~98.8% symbol. See
// docs/investigations/nci_native_bringup_investigation.md.
describe("Classical Nahuatl (nāhuatlahtōlli) canonical IPA", () => {
    test("the affricates + digraphs + saltillo", () => {
        expect(phonemizeWord("nahuatl")).toBe("nawat͡ɬ"); // ⟨hu⟩→[w], ⟨tl⟩→[t͡ɬ]
        expect(phonemizeWord("Ahuitzotl")).toBe("awit͡sot͡ɬ"); // ⟨tz⟩→[t͡s]
        expect(phonemizeWord("xochitl")).toBe("ʃot͡ʃit͡ɬ"); // 'flower' — ⟨x⟩→[ʃ], ⟨ch⟩→[t͡ʃ]
        expect(phonemizeWord("tlahtolli")).toBe("t͡ɬaʔtolli"); // 'word' — the SALTILLO ⟨h⟩→[ʔ] (after a vowel)
    });

    test("★ the c/qu/cu/uc context rules (§2.4)", () => {
        expect(phonemizeWord("cihuatl")).toBe("siwat͡ɬ"); // 'woman' — ⟨c⟩ before i → [s]; ⟨hu⟩→[w]
        expect(phonemizeWord("quimichin")).toBe("kimit͡ʃin"); // ⟨qu⟩ before i → [k]
        expect(phonemizeWord("cuauhtli")).toBe("kʷawt͡ɬi"); // 'eagle' — ⟨cu⟩+V→[kʷ], ⟨uh⟩ coda→[w]
        expect(phonemizeWord("teuctli")).toBe("tekʷt͡ɬi"); // 'lord' — ⟨uc⟩ coda → [kʷ]
    });

    test("★ the ⟨chu⟩ trap + word-initial ⟨h⟩ is not a saltillo", () => {
        expect(phonemizeWord("cachuah")).toBe("kakwaʔ"); // ⟨chu⟩ = [k]-coda + ⟨hu⟩[w] (=/kakwa/), NOT [t͡ʃ]
        expect(phonemizeWord("yehhuatl")).toBe("jeʔwat͡ɬ"); // ⟨h⟩→[ʔ] then ⟨hu⟩→[w]; ⟨y⟩→[j]
        expect(phonemizeWord("he")).toBe("e"); // word-initial ⟨h⟩ is silent (saltillo only occurs AFTER a vowel)
    });

    test("registry wiring", () => {
        expect(getPhonemizer("nci").text("nahuatl").trim()).toBe("nawat͡ɬ");
    });
});
