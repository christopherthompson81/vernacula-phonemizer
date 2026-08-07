import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/sylheti/sylheti.ts";

// Canonical-IPA goldens for Sylheti / ꠍꠤꠟꠐꠤ ꠘꠣꠉꠞꠤ (syl) — Eastern Indo-Aryan, the SYLOTI NAGRI abugida.
// Hand-adjudicated against wikipron syl_sylo_broad (human, Syloti Nagri). The generic-abugida g2p (inherent ɔ,
// Bengali-style inherent deletion) + Sylheti spirantisation are scored against it, with the unwritten HIGH tone
// and notation folded. Sylheti's signature is SPIRANTISATION: ꠇ/ꠈ→x, ꠌ/ꠍ→s, ꠎ→z, ꠙ→ɸ, ꠚ→f,
// ꠡ→ʃ, ꠢ→ɦ. Tone (H/L, developed from lost breathy voice) is unwritten → deferred.
describe("Sylheti canonical IPA — Syloti Nagri abugida + spirantisation", () => {
    test("SPIRANTISATION: ꠇ→x, ꠌ/ꠍ→s, ꠎ→z (the split from Bengali)", () => {
        expect(phonemizeWord("ꠀꠇꠟ")).toBe("axɔl"); // ꠇ (ko) → x
        expect(phonemizeWord("ꠀꠇꠔꠣ")).toBe("axt̪a"); // ꠇ→x, ꠔ→t̪ (dental), medial inherent deleted
        expect(phonemizeWord("ꠀꠍꠦ")).toBe("ase"); // ꠍ (cho) → s
        expect(phonemizeWord("ꠀꠁꠎ")).toBe("aiz"); // ꠎ (jo) → z
    });

    test("inherent vowel ɔ + final/medial deletion; ꠋ anusvara → ŋ", () => {
        expect(phonemizeWord("ꠀꠉꠘ")).toBe("aɡɔn"); // ꠉ→ɡ; inherent ɔ; final inherent on ꠘ dropped
        expect(phonemizeWord("ꠉꠞꠝ")).toBe("ɡɔɾɔm"); // "hot" — inherent ɔ twice
        expect(phonemizeWord("ꠀꠋꠉꠥꠞ")).toBe("aŋɡuɾ"); // "grape" — ꠋ (anusvara) → ŋ, ꠥ (sign-u) → u
        expect(phonemizeWord("ꠝꠣꠛꠥꠖ")).toBe("mabud̪"); // ꠖ (do) → d̪ (dental)
    });
});
