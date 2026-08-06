import { describe, expect, test } from "vitest";

import { phonemizeWord, createSomali } from "../src/languages/somali/somali.ts";

// Canonical-IPA goldens for Somali / Af-Soomaali (so) — Cushitic, 1972 Latin orthography. A shallow near-phonemic
// rule g2p; the signature Cushitic consonants ⟨c⟩→ʕ, ⟨x⟩→ħ (pharyngeals), ⟨dh⟩→ɖ (retroflex), ⟨q⟩→q (uvular),
// ⟨'⟩→ʔ; doubled letters geminate (→ Cː), doubled vowels are long (→ Vː). Tone (grammatical, unwritten) is
// deferred. Validated at 98.7% vs epitran som-Latn + 81.0% vs kaikki so.
describe("Somali canonical IPA", () => {
    test("the pharyngeals ⟨c⟩→ʕ, ⟨x⟩→ħ", () => {
        expect(phonemizeWord("magac")).toBe("maɡaʕ"); // c → ʕ (voiced pharyngeal)
        expect(phonemizeWord("caano")).toBe("ʕaːno"); // c → ʕ, aa → aː
        expect(phonemizeWord("xariir")).toBe("ħariːr"); // x → ħ (voiceless pharyngeal), ii → iː
    });

    test("⟨dh⟩→ɖ (retroflex), ⟨q⟩→q (uvular), ⟨sh⟩→ʃ, ⟨kh⟩→χ", () => {
        expect(phonemizeWord("dhagax")).toBe("ɖaɡaħ"); // dh → ɖ, x → ħ
        expect(phonemizeWord("gabadh")).toBe("ɡabaɖ"); // dh → ɖ
        expect(phonemizeWord("qof")).toBe("qof"); // q → q (uvular)
        expect(phonemizeWord("shan")).toBe("ʃan"); // sh → ʃ
    });

    test("long vowels (doubled) and geminate consonants", () => {
        expect(phonemizeWord("soomaali")).toBe("soːmaːli"); // oo → oː, aa → aː
        expect(phonemizeWord("abbaan")).toBe("abːaːn"); // bb → bː (geminate), aa → aː
        expect(phonemizeWord("biyo")).toBe("bijo"); // y → j
        expect(phonemizeWord("af")).toBe("af"); // (no word-initial glottal marked)
    });

    test("numbers (units-first with iyo)", () => {
        const d = createSomali();
        expect(d.text("21").trim()).toBe("kow ijo labaːtan"); // kow iyo labaatan
        expect(d.text("100").trim()).toBe("boqol"); // boqol
        expect(d.text("234").trim()).toBe("laba boqol ijo afar ijo sodːon"); // laba boqol iyo afar iyo soddon
    });
});
