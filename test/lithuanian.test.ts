import { describe, expect, test } from "vitest";

import { phonemizeWord, createLithuanian } from "../src/languages/lithuanian/lithuanian.ts";

// Canonical-IPA goldens for Lithuanian / lietuvių (lt) — Baltic (Indo-European), Latin script, ~3M. A RULE-based g2p
// (g2p.ts): a left-to-right scan + the hard/soft PALATALIZATION contrast (Cʲ before front vowels / the softening ⟨i⟩,
// spreading leftward through clusters) + regressive VOICING assimilation + n→ŋ before velars. Scored 85.7% folded /
// 98.5% symbol against the wikipron lit_latn_narrow referee (HUMAN, 15,513 words) — the folds strip the lexical PITCH
// accents (¹/²), stress-conditioned length (ː) + vowel quality (ɑ→ɐ, æ→ɛ), and narrow allophony (dark ɫ, v~ʋ, the
// glide j~ɪ̯). Several golds are referee-verified (exact after folds). Stress is lexical → not marked. See
// docs/investigations/lt_bringup_investigation.md.
describe("Lithuanian canonical IPA — rule g2p (palatalization + voicing)", () => {
    test("PALATALIZATION: consonants → Cʲ before a front vowel ⟨e ę ė i į y⟩", () => {
        expect(phonemizeWord("katinas")).toBe("kɐtʲɪnɐs"); // ⟨t⟩ soft before ⟨i⟩; ⟨k n⟩ hard before ⟨a⟩ (referee-verified)
        expect(phonemizeWord("penki")).toBe("pʲɛŋʲkʲɪ"); // ⟨p⟩ soft before ⟨e⟩, ⟨k⟩ soft before ⟨i⟩, ⟨n⟩→ŋʲ (verified)
        expect(phonemizeWord("šeši")).toBe("ʃʲɛʃʲɪ"); // ⟨š⟩ soft before front vowels — uniform ʲ notation
        expect(phonemizeWord("medis")).toBe("mʲɛdʲɪs"); // "tree" — mʲ, dʲ
    });

    test("VELARS ⟨k ɡ⟩ do NOT receive leftward palatalization spread (soften only DIRECTLY before a front vowel)", () => {
        expect(phonemizeWord("knyga")).toBe("knʲiːɡɐ"); // "book" — ⟨k⟩ HARD before soft ⟨nʲ⟩; ⟨n⟩ soft before ⟨y⟩=iː
        expect(phonemizeWord("naktis")).toBe("nɐktʲɪs"); // ⟨k⟩ HARD before soft ⟨tʲ⟩ (referee-verified)
    });

    test("the softening ⟨i⟩ (⟨Cia Ciu⟩): silent, palatalizes the preceding consonant; ⟨a⟩ then fronts to ɛ", () => {
        expect(phonemizeWord("čia")).toBe("t͡ʃʲɛ"); // "here" — ⟨i⟩ silent, ⟨č⟩ soft, ⟨a⟩→ɛ after the soft consonant
        expect(phonemizeWord("ačiū")).toBe("ɐt͡ʃʲuː"); // "thanks" — ⟨i⟩ silent softener before back ⟨ū⟩
    });

    test("rising diphthongs ⟨ie⟩=iɛ / ⟨uo⟩=uɔ (⟨ie⟩ palatalizes the preceding consonant)", () => {
        expect(phonemizeWord("Dievas")).toBe("dʲiɛʋɐs"); // "God" — ⟨d⟩ soft before ⟨ie⟩ (referee-verified)
        expect(phonemizeWord("lietuva")).toBe("lʲiɛtʊʋɐ"); // "Lithuania" — ⟨l⟩ soft before ⟨ie⟩ (referee-verified)
        expect(phonemizeWord("aštuoni")).toBe("ɐʃtuɔnʲɪ"); // "eight" — ⟨uo⟩=uɔ
    });

    test("regressive VOICING assimilation in obstruent clusters + non-palatalizing back context", () => {
        expect(phonemizeWord("dirbti")).toBe("dʲɪrʲpʲtʲɪ"); // ⟨b⟩→[p] before voiceless ⟨t⟩ (keeps softness: bʲ→pʲ)
        expect(phonemizeWord("žmogus")).toBe("ʒmoːɡʊs"); // "man" — hard before back vowels; ⟨o⟩=oː
        expect(phonemizeWord("kalba")).toBe("kɐlbɐ"); // "language" — all hard (referee-verified)
    });

    test("clause assembly: words + punctuation", () => {
        expect(createLithuanian().text("Labas, Lietuva!").trim()).toBe("lɐbɐs  ,  lʲiɛtʊʋɐ  !");
    });
});
