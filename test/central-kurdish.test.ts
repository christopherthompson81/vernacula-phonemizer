import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { normalizeCentralKurdish } from "../src/languages/central-kurdish/normalize.ts";

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

// #562 — the normalization layer. Counts are measured over the FLEURS ckb_iq corpus (column 3).
describe("central kurdish normalization", () => {
    // ★ THE HEADLINE. The tokenizer's letter class is [ؠ-ۿ] = U+0620–U+06FF, which CONTAINS the
    // Arabic-Indic digits U+0660–U+0669 — so a native digit run was claimed by the LETTER branch and
    // phonemized to an EMPTY STRING. That is the majority digit system here: 2036 against 1705 ASCII.
    test("native Arabic-Indic digits are read, not swallowed", () => {
        expect(phonemize("٢٠٢٤", "ckb")).not.toBe("");
        expect(phonemize("٢٠٢٤", "ckb")).toBe(phonemize("2024", "ckb"));
        expect(phonemize("١٠٠٠٠", "ckb")).toBe(phonemize("10000", "ckb"));
    });

    // ⚠ Kurdish uses the ENGLISH numeric conventions — comma groups, period decimates — the opposite of
    // Danish, Romanian and Bulgarian. Reading `30,000` as a decimal makes it "thirty point zero zero zero".
    test("comma groups and period decimates, unlike the European languages before it", () => {
        expect(normalizeCentralKurdish("30,000")).toBe("30000");
        expect(normalizeCentralKurdish("2.4")).toBe("2 خاڵ 4");
    });

    // Kurdish PREPOSES the percent phrase, and the corpus writes the sign on either side of the number.
    test("percent is preposed, and the sign is claimed in both placements", () => {
        expect(normalizeCentralKurdish("٨٨%")).toBe("لە سەدا 88");
        expect(normalizeCentralKurdish("%٨٨")).toBe("لە سەدا 88");
    });

    test("clock and ranges", () => {
        expect(normalizeCentralKurdish("11:00")).toBe("11 00");
        expect(normalizeCentralKurdish("1990-1995")).toBe("1990 بۆ 1995");
    });

    // A timezone offset is written directly against its abbreviation, so the boundary must admit a
    // letter before the sign — and the replacement needs a leading space or the word fuses on.
    test("a signed number after letters (UTC+1)", () => {
        expect(normalizeCentralKurdish("UTC+1")).toBe("UTC کۆ 1");
    });

    test("ordinary Kurdish text is untouched", () => {
        expect(normalizeCentralKurdish("کوردی زمانێکە.")).toBe("کوردی زمانێکە.");
    });
});
