import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/minnan/minnan.ts";

// Canonical-IPA goldens for Min Nan / Taiwanese Hokkien (nan) — Sinitic, tonal. Two front-ends, one converter:
// Han → Tâi-lô via dict.tsv (MOE 臺灣閩南語辭典) → IPA, and direct Tâi-lô/POJ → IPA. The converter (from the
// epitran nan-Latn-tl spec): strip the tone diacritic → [initial] + final → IPA + Chao tone. Sibilants palatalise
// before i (ts/tsh/s/j → t͡ɕ/t͡ɕʰ/ɕ/d͡ʑ), checked -p̚/-t̚/-k̚ + -h→ʔ, nasalised -nn vowels, syllabic m̩/ŋ̍. Phase 1:
// segmental + citation tone (sandhi deferred). See docs/nan_native_bringup_investigation.md.
describe("min nan (Taiwanese Hokkien) canonical IPA", () => {
    test("direct Tâi-lô: initials, finals, palatalisation, checked codas, tones", () => {
        const cases: [string, string][] = [
            ["Tâi", "tai̯˨˦"], // tone 5 ˨˦ (â)
            ["pe̍h", "peʔ˥"], // tone 8 ˥ (a̍), -h → ʔ
            ["tsia̍h", "t͡ɕi̯aʔ˥"], // ts+i palatalises → t͡ɕ
            ["kok", "kɔk̚˧"], // unmarked checked → tone 4 ˧, -k → k̚
            ["sann", "sã˥"], // -nn → nasal vowel ã, unmarked open → tone 1 ˥
            ["sī", "ɕi˧"], // s+i → ɕ, tone 7 ˧ (ā)
            ["gí", "ɡi˥˩"], // tone 2 ˥˩ (á)
            ["lâng", "laŋ˨˦"], // -ng nasal coda → aŋ
            ["hó", "hə˥˩"], // o → ə (ts-o), tone 2
            ["Ji̍t", "d͡ʑit̚˥"], // j+i → d͡ʑ, tone 8, -t → t̚
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("nasal-coda + syllabic-nasal finals (regression: these rimes were missing → raw passthrough)", () => {
        const cases: [string, string][] = [
            ["khan", "kʰan˥"], // -an (was raw 'khan')
            ["kham", "kʰam˥"], // -am
            ["kang", "kaŋ˥"], // -ang
            ["sin", "ɕin˥"], // -in
            ["tshun", "t͡sʰun˥"], // -un
            ["kuan", "ku̯an˥"], // -uan
            ["png", "pŋ̍˥"], // syllabic -ng after an initial
            ["sng", "sŋ̍˥"],
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("Han → Tâi-lô dict → IPA", () => {
        expect(phonemizeWord("一")).toBe("t͡ɕit̚˥"); // tsi̍t
        expect(phonemizeWord("人")).toBe("laŋ˨˦"); // lâng
        expect(phonemizeWord("好")).toBe("hə˥˩"); // hó
        expect(phonemizeWord("食")).toBe("t͡ɕi̯aʔ˥"); // tsia̍h
    });

    test("running Han text: word segmentation + citation tone", () => {
        expect(phonemize("我食飯", "nan")).toBe("ɡu̯a˥˩ t͡ɕi̯aʔ˥ pŋ̍˧"); // guá tsia̍h pn̄g (飯 → syllabic ŋ̍)
    });
});
