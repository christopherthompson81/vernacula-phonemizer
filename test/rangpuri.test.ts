import { describe, expect, test } from "vitest";

import { createRangpuri, phonemizeWord } from "../src/languages/rangpuri/rangpuri.ts";

// Rangpuri (rkt) — Eastern Indo-Aryan, the KRNB lect of Rangpur (Bangladesh) + adjacent India, in Devanagari. Reuses
// the shared Hindi abugida engine + a KRNB manifest. KRNB deltas: DEAFFRICATION (च/छ→s, ज→d͡z, झ→d͡zʱ); VOICED
// aspirates RETAINED (घ झ ढ ध भ → ɡʱ d͡zʱ ɖʱ d̪ʱ bʱ), VOICELESS aspirates positional (ख ठ थ फ keep ʰ word-initially,
// deaspirate elsewhere); inherent [ɔ], no vowel length, व→w, ण→n.
// Referee: the Toulmin (2006) Appendix-A Rangpur list (~370 Deva→IPA pairs), the only one — ⚠ and it was
// extracted from a TWO-COLUMN PDF, so part of the disagreement is extraction noise rather than engine error.
describe("Rangpuri (KRNB) canonical IPA — Devanagari abugida + KRNB deltas", () => {
    const rkt = createRangpuri();

    test("DEAFFRICATION: च → [s], ज → [d͡z]", () => {
        expect(phonemizeWord("काचे")).toBe("kˈase"); // ⟨च⟩ → s ("glass/raw")
        expect(phonemizeWord("गाजोर")).toBe("ɡˈad͡zoɾ"); // ⟨ज⟩ → d͡z ("carrot")
    });

    test("VOICED aspirates RETAINED (घ→ɡʱ, ध→d̪ʱ); voiceless aspirates POSITIONAL (initial kept, else deaspirated)", () => {
        expect(phonemizeWord("घर")).toBe("ɡʱˈɔɾ"); // ⟨घ⟩ → ɡʱ (voiced aspirate retained)
        expect(phonemizeWord("आधाचेर")).toBe("ˈad̪ʱaseɾ"); // ⟨ध⟩ → d̪ʱ (retained), ⟨च⟩ → s (deaffricated) ("half-ser")
        expect(phonemizeWord("ठीक")).toBe("ʈʰˈik"); // ⟨ठ⟩ → ʈʰ KEPT word-initially
        expect(phonemizeWord("आठ")).toBe("ˈaʈ"); // ⟨ठ⟩ → ʈ DEASPIRATED non-initially
        expect(phonemizeWord("खलान")).toBe("kʰˈɔlan"); // ⟨ख⟩ → kʰ initial, inherent → ɔ ("threshing floor")
    });

    test("dental त/द→t̪/d̪, retroflex ट→ʈ; inherent [ɔ], final-inherent deletion", () => {
        expect(phonemizeWord("आगोत")).toBe("ˈaɡot̪"); // ⟨त⟩ → t̪ ("ahead")
        expect(phonemizeWord("आदा")).toBe("ˈad̪a"); // ⟨द⟩ → d̪ ("ginger")
        expect(phonemizeWord("आगोन")).toBe("ˈaɡon"); // final inherent deleted (not *aɡonɔ) ("in front")
        expect(phonemizeWord("आम")).toBe("ˈam"); // ("mango")
    });

    test("sibilant ⟨श⟩→ʃ, ⟨स⟩→s; the ि-matra + long/short vowel merger (no length)", () => {
        expect(phonemizeWord("आकाश")).toBe("ˈakaʃ"); // ⟨श⟩ → ʃ ("sky")
        expect(phonemizeWord("बिष")).toBe("bˈiʃ"); // ⟨ि⟩ short-i (no length) ("poison")
        expect(phonemizeWord("आलु")).toBe("ˈalu"); // ⟨ु⟩ → u ("potato")
    });

    test("clause assembly", () => {
        expect(rkt.text("आम खलान।").trim()).toBe("ˈam kʰˈɔlan .");
    });
});
