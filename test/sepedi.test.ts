import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/sepedi/sepedi.ts";
import { phonemize } from "../src/index.ts";
import { numberToWords } from "../src/languages/sepedi/numbers.ts";

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

// CARDINAL NUMBERS (nso). The compositor emits the CITATION / COUNTING series (tee, pedi, tharo …) — the list the
// UNISA Northern Sotho course has a speaker recite — because a bare integer gives the adjectival 1–5 no noun to
// agree with. Sepedi is deliberately NOT derived from the Sesotho compositor: the stems differ (tee/tshela/šupa/
// seswai/senyane/lesome vs st nngwe/tshelela/supa/robedi/robong/leshome) and 11–99 / 200–900 are written
// CONJUNCTIVELY as one word. Sources + the orthographic normalisations are cited in sepedi.jsonc "numbers".
describe("Sepedi cardinal numbers — citation series + conjunctive compounds", () => {
    test("units are the counting series — and differ from Sesotho's", () => {
        expect(numberToWords(0)).toBe("lefeela");
        expect(numberToWords(1)).toBe("tee"); // st has nngwe
        expect(numberToWords(7)).toBe("šupa"); // st has supa
        expect(numberToWords(8)).toBe("seswai"); // st has robedi
        expect(numberToWords(9)).toBe("senyane"); // st has robong
    });
    test("teens + tens are CONJUNCTIVE single words", () => {
        expect(numberToWords(10)).toBe("lesome");
        expect(numberToWords(11)).toBe("lesometee");
        expect(numberToWords(20)).toBe("masomepedi");
        expect(numberToWords(21)).toBe("masomepedi tee"); // Omniglot's hyphen → a word boundary
        expect(numberToWords(90)).toBe("masomesenyane");
    });
    test("hundreds are the conjunctive makgolo+STEM series (UNISA)", () => {
        expect(numberToWords(100)).toBe("lekgolo");
        expect(numberToWords(200)).toBe("makgolopedi");
        expect(numberToWords(555)).toBe("makgolohlano le masomehlano hlano");
    });
    test("thousands (cl.8 tše concord) and millions", () => {
        expect(numberToWords(1000)).toBe("sekete");
        expect(numberToWords(2000)).toBe("dikete tše pedi");
        expect(numberToWords(12345)).toBe("dikete lesomepedi le makgolotharo le masomenne hlano");
        expect(numberToWords(1000000)).toBe("milione");
        expect(numberToWords(1000000000)).toBe("bilione");
    });
    test("end-to-end through the g2p", () => {
        expect(phonemize("21", "nso").trim()).toBe("mɑsɔmɛpʼɛdi tʼɛɛ");
        expect(phonemize("200", "nso").trim()).toBe("mɑkxɔlɔpʼɛdi");
    });
});
