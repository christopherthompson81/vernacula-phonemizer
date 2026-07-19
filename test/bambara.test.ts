import { describe, expect, test } from "vitest";

import { phonemizeWord as raw } from "../src/languages/bambara/bambara.ts";

// The g2p emits combining marks (nasal ã = a + U+0303) to match the referee; normalise NFC for stable literals.
const phonemizeWord = (w: string) => raw(w).normalize("NFC");

// Canonical-IPA goldens for Bambara / Bamanankan (bm) — Mande (Manding), Latin orthography. Hand-adjudicated
// against kaikki Bambara (Wiktionary, narrow). The greedy g2p + nasalisation scores 86.5% folded vs the referee
// (tools/referee-eval, 74 words) — the folds strip TONE (2-level H/L + downstep) and vowel LENGTH, both lexical
// and absent from the standard orthography. These goldens pin the segmental + nasalisation backbone. Tone,
// length, and numbers are deferred; N'Ko is a second script, deferred.
// See docs/investigations/bm_native_bringup_investigation.md.
describe("Bambara canonical IPA — greedy g2p + nasalisation", () => {
    test("affricates and sibilant: ⟨c⟩→t͡ʃ, ⟨j⟩→d͡ʒ, ⟨sh⟩→ʃ", () => {
        expect(phonemizeWord("cɔnkɔ")).toBe("t͡ʃɔ̃kɔ".normalize("NFC")); // ⟨c⟩ → t͡ʃ (+ nasal ɔ̃)
        expect(phonemizeWord("jan")).toBe("d͡ʒã".normalize("NFC")); // ⟨j⟩ → d͡ʒ (+ nasal ã)
        expect(phonemizeWord("shinye")).toBe("ʃiɲe".normalize("NFC")); // ⟨sh⟩ → ʃ, ⟨ny⟩ → ɲ
    });

    test("NASALISATION: a syllable-final ⟨n⟩ nasalises the preceding vowel; an onset ⟨n⟩ stays [n]", () => {
        expect(phonemizeWord("ban")).toBe("bã".normalize("NFC")); // word-final n → nasal ã (n dropped)
        expect(phonemizeWord("dɔn")).toBe("dɔ̃".normalize("NFC")); // → dɔ̃
        expect(phonemizeWord("kunun")).toBe("kunũ".normalize("NFC")); // ku.nun → the ONSET n stays [n], only the final n nasalises
        expect(phonemizeWord("na")).toBe("na".normalize("NFC")); // onset n before a vowel → [n]
        expect(phonemizeWord("kalan")).toBe("kalã".normalize("NFC")); // → kalã
    });

    test("palatal ⟨ny⟩/⟨ɲ⟩ → ɲ; word-initial prenasal keeps the nasal", () => {
        expect(phonemizeWord("nya")).toBe("ɲa".normalize("NFC")); // ⟨ny⟩ → ɲ
        expect(phonemizeWord("mburu")).toBe("mburu".normalize("NFC")); // word-initial ⟨mb⟩ prenasal → m + b
        expect(phonemizeWord("sanga")).toBe("sãɡa".normalize("NFC")); // medial: ⟨n⟩ nasalises a, ⟨g⟩ stays ɡ
    });

    test("oral vowels + a common word", () => {
        expect(phonemizeWord("ala")).toBe("ala".normalize("NFC")); // "God"
        expect(phonemizeWord("kelen")).toBe("kelẽ".normalize("NFC")); // "one" — final n → nasal ẽ
    });
});
