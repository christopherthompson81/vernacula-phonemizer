import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/central-kurdish/central-kurdish.ts";

// Canonical-IPA goldens for Central Kurdish / Sorani / کوردیی ناوەندی (ckb) — Iranian, the Sorani Perso-Arabic
// alphabet (a near-FULL alphabet: writes all long vowels + short /a/, only the short /ɪ/ bizroke unwritten).
// Hand-adjudicated against wikipron ckb_arab_broad (94.9%) + kaikki ckb (94.2%), both human. Signatures: the
// pharyngeals ح→ħ, ع→ʕ; the velarised ڵ→ɫ; the trill ڕ→r vs tap ر→ɾ; ئ→ʔ (glottal onset). Complements Kurmanji
// (kmr). See docs/investigations/ckb_native_bringup_investigation.md.
describe("Central Kurdish (Sorani) canonical IPA — Perso-Arabic alphabet", () => {
    test("long vowels + ئ glottal onset (کوردی, ئاشتی, ئاسمان)", () => {
        expect(phonemizeWord("کوردی")).toBe("kuɾdiː"); // "Kurdish" — و→u, ی→iː
        expect(phonemizeWord("ئاشتی")).toBe("ʔaːʃtiː"); // "peace" — ئ→ʔ onset, ا→aː
        expect(phonemizeWord("ئاسمان")).toBe("ʔaːsmaːn"); // "sky"
    });

    test("the PHARYNGEAL ح→ħ, the velarised ڵ→ɫ, the trill ڕ→r", () => {
        expect(phonemizeWord("حەوت")).toBe("ħawt"); // "seven" — ح → ħ (pharyngeal)
        expect(phonemizeWord("ئاڵا")).toBe("ʔaːɫaː"); // "flag" — ڵ → ɫ (velarised l)
        expect(phonemizeWord("ڕۆژ")).toBe("roːʒ"); // "sun/day" — ڕ → r (trill), ۆ → oː, ژ → ʒ
    });

    test("ۆ→oː, و/ی glide vs vowel, ە→a (گەورە, خۆشەویستی)", () => {
        expect(phonemizeWord("گەورە")).toBe("ɡawɾa"); // و → w (glide, next to vowels), ە → a
        expect(phonemizeWord("خۆشەویستی")).toBe("xoːʃawiːstiː"); // "love" — خ→x, ۆ→oː
        expect(phonemizeWord("دەست")).toBe("dast"); // "hand"
    });
});
