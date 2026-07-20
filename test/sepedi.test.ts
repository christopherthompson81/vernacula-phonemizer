import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/sepedi/sepedi.ts";

// Canonical-IPA goldens for Sepedi / Northern Sotho (nso) — Bantu (Sotho-Tswana), Latin. ⛔ CANNOT-VERIFY: authored
// from standard Sepedi phonology (Ziervogel & Mokgokong) with NO machine referee at all (no wikipron/kaikki/
// epitran) — these are hand examples of the distinctive graphemes, not a verified gold. Signatures: ⟨š⟩→ʃ,
// ⟨tš⟩→t͡ʃʼ, ⟨g⟩→x, ⟨kg⟩→kx, ⟨hl⟩→ɬ, EJECTIVE ⟨p t k⟩ (the Sotho-Tswana pattern, unverified for Sepedi). Tone
// deferred. See docs/investigations/nso_native_bringup_investigation.md.
describe("Sepedi (Northern Sotho) canonical IPA — Sotho-Tswana rule g2p (⛔ authored)", () => {
    test("distinctive graphemes: ⟨š⟩→ʃ, ⟨kg⟩→kx, ⟨g⟩→x, ⟨hl⟩→ɬ", () => {
        expect(phonemizeWord("kgoši")).toBe("kxɔʃi"); // kg→kx, š→ʃ
        expect(phonemizeWord("mošomo")).toBe("mɔʃɔmɔ"); // š→ʃ
        expect(phonemizeWord("hlogo")).toBe("ɬɔxɔ"); // hl→ɬ, g→x
    });
    test("aspirate ⟨th⟩→tʰ, ejective ⟨p⟩→pʼ", () => {
        expect(phonemizeWord("batho")).toBe("bɑtʰɔ"); // th→tʰ
        expect(phonemizeWord("sepedi")).toBe("sɛpʼɛdi"); // p→pʼ (ejective)
    });
});
