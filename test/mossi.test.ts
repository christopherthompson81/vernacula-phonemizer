import { describe, expect, test } from "vitest";

import { phonemizeWord, createMossi } from "../src/languages/mossi/mossi.ts";

// Canonical-IPA goldens for Mossi / Mooré (mos) — Niger-Congo GUR (Oti-Volta), Latin (Burkinabé) orthography,
// the FIRST Gur language in the fleet. Hand-adjudicated against en.wiktionary Moore (Wiktionary). The greedy g2p
// + gemination scores 94.9% folded vs the referee (tools/referee-eval, 39 words) — the two residuals are referee
// artifacts (a gemination-notation inconsistency + a y/j typo), so the segmental backbone is ~100%. Signatures:
// dedicated ATR letters ⟨ɛ ɩ ʋ⟩, ⟨o⟩=o always (no ⟨ɔ⟩), DOUBLING = length, TILDE = nasal, ⟨r⟩=ɾ, ⟨y⟩=j. TONE
// (2-tone H/L) is not written in the orthography → not emitted; numbers deferred. See
// docs/investigations/mos_native_bringup_investigation.md.
describe("Mooré canonical IPA — greedy g2p + gemination", () => {
    test("dedicated ATR letters ⟨ɛ⟩=ɛ, ⟨ɩ⟩=ɪ, ⟨ʋ⟩=ʊ; ⟨o⟩=o always (no ɔ)", () => {
        expect(phonemizeWord("lakrɛ")).toBe("lakɾɛ"); // ⟨ɛ⟩ → ɛ
        expect(phonemizeWord("malɛka")).toBe("malɛka"); // "angel" — ⟨ɛ⟩ → ɛ
        expect(phonemizeWord("fɩnetre")).toBe("fɪnetɾe"); // ⟨ɩ⟩ → ɪ
        expect(phonemizeWord("boko")).toBe("boko"); // ⟨o⟩ → o (not ɔ)
        expect(phonemizeWord("laloa")).toBe("laloa"); // /ɔ/ is written as the hiatus ⟨oa⟩, not a letter
    });

    test("DOUBLING = LENGTH (aa→aː, ee→eː, ɛɛ→ɛː, uu→uː, ʋʋ→ʊː)", () => {
        expect(phonemizeWord("baare")).toBe("baːɾe"); // ⟨aa⟩ → aː
        expect(phonemizeWord("lɛɛre")).toBe("lɛːɾe"); // ⟨ɛɛ⟩ → ɛː
        expect(phonemizeWord("weefo")).toBe("weːfo"); // ⟨ee⟩ → eː
        expect(phonemizeWord("fulfuugu")).toBe("fulfuːɡu"); // ⟨uu⟩ → uː
        expect(phonemizeWord("faktɩʋʋre")).toBe("faktɪʊːɾe"); // ⟨ʋʋ⟩ → ʊː (long ʊ)
    });

    test("NASAL = TILDE (ã ẽ ĩ õ ũ); the nasal-long digraph ⟨ãa⟩ → ãː", () => {
        expect(phonemizeWord("burkĩna")).toBe("buɾkĩna"); // ⟨ĩ⟩ → ĩ (nasal i)
        expect(phonemizeWord("rõde")).toBe("ɾõde"); // ⟨õ⟩ → õ
        expect(phonemizeWord("esãase")).toBe("esãːse"); // ⟨ãa⟩ → ãː (nasal long a)
    });

    test("⟨r⟩=ɾ (tap), ⟨y⟩=j, ⟨g⟩=ɡ; CONSONANT GEMINATION (doubled → Cː)", () => {
        expect(phonemizeWord("zirga")).toBe("ziɾɡa"); // ⟨r⟩ → ɾ, ⟨g⟩ → ɡ
        expect(phonemizeWord("lay")).toBe("laj"); // ⟨y⟩ → j
        expect(phonemizeWord("yelle")).toBe("jelːe"); // ⟨y⟩ → j, ⟨ll⟩ → lː (geminate)
    });

    test("NASAL place assimilation: ⟨n⟩ → ŋ before a velar g/k (FSI /n/=[n,ŋ])", () => {
        expect(phonemizeWord("tenga")).toBe("teŋɡa"); // "village" — ⟨ng⟩ → ŋɡ (FSI tengá→teŋɡa)
        expect(phonemizeWord("sh")).toBe("ʃ"); // ⟨sh⟩ → ʃ (FSI /s/ allophone spelling)
    });

    test("text: words + clause punctuation (tone + numbers deferred)", () => {
        expect(createMossi().text("Burkĩna Faso. Yelle?")).toBe("buɾkĩna faso  .  jelːe  ? ");
    });
});
