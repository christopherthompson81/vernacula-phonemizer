import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/yoruba/yoruba.ts";

// Canonical-IPA goldens for Yoruba / Èdè Yorùbá (yo) — Volta-Niger (Niger-Congo), a highly phonemic three-tone
// Latin orthography. Validated against wikipron yor (89.6%) + kaikki yor (88.8%), both human. Signature features:
// the labial-velars ⟨gb⟩→ɡ͡b / ⟨p⟩→k͡p, ⟨j⟩→d͡ʒ, ⟨ṣ⟩→ʃ, ⟨r⟩→ɾ; dotted vowels ẹ→ɛ ọ→ɔ; coda-⟨n⟩ nasalisation
// (ọdún→ɔdũ) vs onset n (ẹni→ɛni); and three LEVEL tones as Chao letters — High ˥ / Mid ˧ / Low ˩.
// See docs/investigations/yo_native_bringup_investigation.md.
describe("yoruba canonical IPA", () => {
    test("three level tones (High ˥ / Mid ˧ / Low ˩)", () => {
        expect(phonemizeWord("bá")).toBe("ba˥"); // high (acute)
        expect(phonemizeWord("ba")).toBe("ba˧"); // mid (unmarked)
        expect(phonemizeWord("bà")).toBe("ba˩"); // low (grave)
        expect(phonemizeWord("Yorùbá")).toBe("jo˧ɾu˩ba˥"); // mid-low-high, r→ɾ, y→j
    });

    test("labial-velars, dotted vowels, ṣ, nasal vs onset n", () => {
        const cases: [string, string][] = [
            ["gbogbo", "ɡ͡bo˧ɡ͡bo˧"], // gb → ɡ͡b
            ["ọmọ", "ɔ˧mɔ˧"], // ọ → ɔ
            ["ẹni", "ɛ˧ni˧"], // ẹ → ɛ; onset n before a vowel stays n
            ["ọdún", "ɔ˧dũ˥"], // coda n → nasalised vowel ũ
            ["ṣé", "ʃe˥"], // ṣ → ʃ
            ["ilé", "i˧le˥"],
            ["omi", "o˧mi˧"],
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("running text: per-syllable tone", () => {
        expect(phonemize("ọmọ dára", "yo")).toContain("ɔ˧mɔ˧ da˥ɾa˧");
    });
});
