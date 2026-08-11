import { describe, expect, test } from "vitest";

import { phonemizeWord, createSomali } from "../src/languages/somali/somali.ts";
import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Somali / Af-Soomaali (so) — Cushitic, 1972 Latin orthography. A shallow near-phonemic
// rule g2p; the signature Cushitic consonants ⟨c⟩→ʕ, ⟨x⟩→ħ (pharyngeals), ⟨dh⟩→ɖ (retroflex), ⟨q⟩→q (uvular),
// ⟨'⟩→ʔ; doubled letters geminate (→ Cː), doubled vowels are long (→ Vː). Tone (grammatical, unwritten) is
// deferred. Referees: epitran som-Latn + kaikki so.
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

    // ── NORMALIZATION ────────────────────────────────────────────────────────────────────────────────
    // Counts from the language-filtered so.wikipedia dump (70,854 paragraphs; so.wikipedia is 88.5% Somali,
    // so the filter matters far less here than for su, but it is applied and recorded in the artifact).
    describe("text normalization", () => {
        // ⚠ SOMALI WRITES THE ENGLISH CONVENTION — comma groups, period marks the decimal — 19:1 and 37:1.
        // Both separators were clause punctuation, so a grouped number came apart into three spoken clauses.
        test("thousands and decimals, English convention", () => {
            expect(phonemize("2,381,741 km", "so")).toContain("maljuːn"); // ×3,598 — was three clauses
            expect(phonemize("0.53 hektar", "so")).toContain("ɖibiʕ"); // ×3,082
            expect(phonemize("84.3 boqolkiiba", "so")).toContain("ɖibiʕ");
            expect(phonemize("1,234.56", "so")).toContain("ɖibiʕ"); // ×49 carry BOTH separators
        });

        // ⚠ THE LANGUAGE'S BIGGEST CLASS IS LEFT ALONE (trap 16). Somali binds morphology to a numeral with a
        // hyphen ×7,498 (-kii ×3,023, -aad ×1,436, -meeyadii ×800) and it already reads correctly, because the
        // TOKEN splits on the hyphen and both halves are ordinary Somali. The range rule requires digits on
        // BOTH sides precisely so it cannot claim this pattern.
        test("the bound-suffix numeral is untouched, and the range rule stays off it", () => {
            expect(phonemize("2010-kii", "so")).toBe("laba kun ijo toban kiː");
            expect(phonemize("1980-meeyadii", "so")).toContain("meːjadiː");
            expect(phonemize("1aad", "so")).toBe("kow aːd");
            expect(phonemize("Febraayo 2019-February 2020", "so")).not.toContain("ilaː"); // number-hyphen-WORD
            expect(phonemize("1268-69", "so")).toContain("ilaː"); // ×2,690 — digits both sides IS a range
        });

        // ⚠ THE ERA MARKERS ARE THE LARGEST CLASS THIS LAYER REPAIRS, and Somali has its own pair alongside the
        // borrowed ones. `C.H.` ×121 and `C.D` ×213 are glossed by the corpus itself (Ciise Hortiis / Ciise
        // Dabadiis); the GLUED calendar letters are bigger than every spaced marker combined (H ×567, M ×25).
        test("era markers, including the glued calendar letters", () => {
            expect(phonemize("607 C.H.", "so")).toContain("ʕiːse hortiːs");
            expect(phonemize("70 C.D. Rooma", "so")).toContain("ʕiːse dabadiːs");
            expect(phonemize("728H", "so")).toContain("hid͡ʒri"); // ×567
            expect(phonemize("sanadkii 18H", "so")).toContain("hid͡ʒri"); // ×305 are two-digit years
            expect(phonemize("1999M", "so")).toContain("miːlaːdi"); // 3-4 digits = the YEAR
            // ⚠ …but one or two digits is MILLION, not a year (`$2M`, `8M oo higtar`, ×21). Reading the short
            // form as an era would date a sum of money to the year 2.
            expect(phonemize("8M oo higtar", "so")).toContain("miljan");
            expect(phonemize("$2M", "so")).toBe("laba miljan doːlar"); // and the magnitude must hop the noun
            // ⚠ `CD-yada` is compact discs, in this same corpus — the leading digit is what excludes it.
            expect(phonemize("CD-yada iyo Internetka", "so")).not.toContain("dabadiːs");
        });

        test("units, percent, signs and the c=/ʕ/ abbreviations", () => {
            expect(phonemize("30 km", "so")).toContain("kiːloːmitir");
            expect(phonemize("2 km²", "so")).toContain("laba d͡ʒibaːran"); // laba jibaaran ×123
            expect(phonemize("50 cm³", "so")).toContain("ʕubo"); // cubo ×4 — `saddex jibaaran` scores ZERO
            expect(phonemize("26%", "so")).toContain("boqolkiːba"); // ×499
            // ⟨c⟩ is /ʕ/, so these were not merely unread but audibly wrong: °C was *ʕ*, BC was *bʕ*.
            expect(phonemize("25 °C", "so")).toContain("darad͡ʒo");
            expect(phonemize("A & B", "so")).toContain("ijo"); // ×1,116
            expect(phonemize("1/2", "so")).toBe("nus");
            expect(phonemize("-5", "so")).toContain("laɡa d͡ʒaraj");
        });
    });
});
