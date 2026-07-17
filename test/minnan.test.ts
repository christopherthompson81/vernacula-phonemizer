import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/minnan/minnan.ts";

// Canonical-IPA goldens for Min Nan / Taiwanese Hokkien (nan) — Sinitic, tonal. Two front-ends, one converter:
// Han → Tâi-lô via dict.tsv (MOE 臺灣閩南語辭典) → IPA, and direct Tâi-lô/POJ → IPA. The converter (from the
// epitran nan-Latn-tl spec): strip the tone diacritic → [initial] + final → IPA + Chao tone. Sibilants palatalise
// before i (ts/tsh/s/j → t͡ɕ/t͡ɕʰ/ɕ/d͡ʑ), checked -p̚/-t̚/-k̚ + -h→ʔ, nasalised -nn vowels, syllabic m̩/ŋ̍. Phase 1:
// segmental + citation tone (sandhi deferred). See docs/investigations/nan_native_bringup_investigation.md.
describe("min nan (Taiwanese Hokkien) canonical IPA", () => {
    test("direct Tâi-lô: initials, finals, palatalisation, checked codas, tones", () => {
        const cases: [string, string][] = [
            ["Tâi", "tai̯˨˦"], // tone 5 ˨˦ (â)
            ["pe̍h", "peʔ˥"], // tone 8 ˥ (a̍), -h → ʔ
            ["tsia̍h", "t͡ɕi̯aʔ˥"], // ts+i palatalises → t͡ɕ
            ["kok", "kɔk̚˧˨"], // unmarked checked → tone 4 (陰入, LOW ˧˨ — distinct from tone 7 ˧), -k → k̚
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

    test("tone 4 (陰入, low ˧˨) is distinct from tone 7 (陽去, mid ˧); tone 8 (˥) shares pitch with tone 1 but is checked", () => {
        expect(phonemizeWord("kok")).toBe("kɔk̚˧˨"); // tone 4 — LOW checked
        expect(phonemizeWord("sī")).toBe("ɕi˧"); // tone 7 — mid open
        expect(phonemizeWord("Ji̍t")).toBe("d͡ʑit̚˥"); // tone 8 — high checked
        expect(phonemizeWord("si")).toBe("ɕi˥"); // tone 1 — high open (same ˥ as tone 8, distinguished by the coda)
    });

    test("word-internal tone SANDHI (連讀變調): every syllable but the last takes its sandhi tone", () => {
        // The Taiwanese tone circle: 1→7, 7→3, 3→2, 2→1, 5→7; checked -ptk 4↔8; checked -h 4→2, 8→3.
        expect(phonemizeWord("pîng-iú")).toBe("piə̯ŋ˧ i̯u˥˩"); // 朋友: pîng tone 5 → 7 (˧); iú tone 2 stays (final)
        expect(phonemizeWord("tāi-ke")).toBe("tai̯˨˩ ke˥"); // 大家: tāi tone 7 → 3 (˨˩)
        expect(phonemizeWord("ha̍k-sing")).toBe("hak̚˧˨ ɕiə̯ŋ˥"); // 學生: ha̍k tone 8 → 4 (˧˨, stop coda)
        expect(phonemizeWord("tsit-ê")).toBe("t͡ɕit̚˥ e˨˦"); // 一个: tsit tone 4 → 8 (˥, stop coda)
        expect(phonemizeWord("sian-sinn")).toBe("ɕi̯ɛn˧ ɕĩ˥"); // 先生: sian tone 1 → 7 (˧)
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
