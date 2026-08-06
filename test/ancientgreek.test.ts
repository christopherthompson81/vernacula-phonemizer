import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/ancientgreek/ancientgreek.ts";
import { numberToWords } from "../src/languages/ancientgreek/numbers.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Ancient Greek / Ἑλληνική (grc) — the reconstructed 5th-c. BCE CLASSICAL ATTIC
// pronunciation (Allen, Vox Graeca), polytonic Greek script. The aspirates θ φ χ→[tʰ pʰ kʰ], ζ→[zd], η/ω long
// mid, υ→[y], diphthongs, γ-nasal, rough breathing→[h], pitch accent. Validated 99.4% folded / 99.7% symbol vs
// wikipron grc (human, {{grc-IPA}} Attic row, 33709).
describe("Ancient Greek (Attic) canonical IPA", () => {
    test("aspirates θ/φ/χ + long η/ω + the γ-nasal", () => {
        expect(phonemizeWord("λόγος")).toBe("lóɡos"); // γ→[ɡ]
        expect(phonemizeWord("ἄνθρωπος")).toBe("ántʰrɔːpos"); // θ→[tʰ], ω→[ɔː]
        expect(phonemizeWord("θεός")).toBe("tʰeós"); // θ→[tʰ]; the acute stays on the ⟨ο⟩
        expect(phonemizeWord("ἄγγελος")).toBe("áŋɡelos"); // ⟨γγ⟩→[ŋɡ] (the γ-nasal)
    });

    test("rough breathing → [h], diphthongs, υ→[y], ζ/ξ/ψ", () => {
        expect(phonemizeWord("ἵππος")).toBe("híppos"); // ROUGH BREATHING → prefixed [h]
        expect(phonemizeWord("αὐτός")).toBe("au̯tós"); // ⟨αυ⟩→[au̯] diphthong
        expect(phonemizeWord("ψυχή")).toBe("psykʰɛː́"); // ⟨ψ⟩→[ps], ⟨υ⟩→[y], ⟨χ⟩→[kʰ], ⟨η⟩→[ɛː]
        expect(phonemizeWord("ζῷον")).toBe("zdɔːí̯on"); // ⟨ζ⟩→[zd]; iota subscript ⟨ῳ⟩→[ɔːi̯] (circumflex on it)
    });

    test("σ→[z] before a voiced consonant + aspirate assimilation", () => {
        expect(phonemizeWord("Λέσβια")).toBe("lézbia"); // ⟨σ⟩→[z] before ⟨β⟩
        expect(phonemizeWord("Βάκχε")).toBe("bákʰkʰe"); // ⟨κχ⟩→[kʰkʰ] (aspirate assimilation)
        expect(phonemizeWord("ῥήτωρ")).toBe("r̥ɛː́tɔːr"); // word-initial ⟨ῥ⟩ → the VOICELESS [r̥]
    });

    test("registry wiring", () => {
        expect(getPhonemizer("grc").text("λόγος").trim()).toBe("lóɡos");
    });
});

// CARDINAL NUMBERS (src/languages/ancientgreek/numbers.ts). Source: Smyth, *Greek Grammar* §§347–354.
// Two structural features: ★ καί-LINKED compounds — Smyth gives both orders for 21–99 and this engine picks the
// TENS-FIRST (descending) one uniformly (εἴκοσι καὶ εἷς), so the spoken order tracks the digits; and ★ MYRIAD
// (10⁴) grouping rather than a thousands ladder — μυριάς/μυριάδες with a genitive μυριάδων per extra level
// (Archimedes' μυριὰς μυριάδων = 10⁸), so 10⁶ is ἑκατόν μυριάδες. Citation form: masculine nominative.
describe("Ancient Greek numbers", () => {
    for (const [n, expected] of [
        [0, "οὐδέν"],                                    // Classical Greek has no zero cardinal
        [1, "εἷς"],                                      // masculine nominative citation form (neuter ἕν unused)
        [3, "τρεῖς"],
        [4, "τέτταρες"],                                 // ATTIC (not the Ionic/koine τέσσαρες)
        [10, "δέκα"],
        [12, "δώδεκα"],
        [13, "τρεῖς καὶ δέκα"],                          // Smyth's own units-first phrase for 13/14
        [15, "πεντεκαίδεκα"],                            // 15–19 are FUSED
        [16, "ἑκκαίδεκα"],
        [20, "εἴκοσι"],
        [21, "εἴκοσι καὶ εἷς"],                          // ★ tens-first καί-linked compound (the chosen order)
        [25, "εἴκοσι καὶ πέντε"],
        [99, "ἐνενήκοντα καὶ ἐννέα"],
        [100, "ἑκατόν"],
        [101, "ἑκατόν καὶ εἷς"],
        [555, "πεντακόσιοι καὶ πεντήκοντα καὶ πέντε"],
        [1000, "χίλιοι"],
        [2000, "δισχίλιοι"],                             // the multiplicative χίλιοι series
        [4000, "τετρακισχίλιοι"],
        [10000, "μυριάς"],                               // ★ the myriad is a magnitude, not "ten thousand"
        [12345, "μυριάς καὶ δισχίλιοι καὶ τριακόσιοι καὶ τετταράκοντα καὶ πέντε"],
        [20000, "δύο μυριάδες"],
        [1000000, "ἑκατόν μυριάδες"],                    // ★ 10⁶ = a hundred myriads
        [1000000000, "δέκα μυριάδες μυριάδων"],          // ★ the genitive nesting (10⁸ = μυριὰς μυριάδων)
    ] as const) {
        test(`${n} → ${expected}`, () => expect(numberToWords(n)).toBe(expected));
    }

    test("no digit leak, sentinel or gap across 0..20000", () => {
        for (let n = 0; n <= 20000; n++) expect(numberToWords(n), `n=${n}`).not.toMatch(/undefined|NaN|[0-9]/u);
    });

    test("end-to-end: the numeral is phonemized, not spelled out digit-wise", () => {
        expect(phonemize("21", "grc")).toBe("eː́kosi kaí̯ heː́s"); // εἴκοσι καὶ εἷς — εἷς keeps its rough-breathing [h]
        expect(phonemize("10000", "grc")).toBe("myriás"); // μυριάς
    });
});
