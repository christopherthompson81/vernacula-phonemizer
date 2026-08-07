import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/minnan/minnan.ts";

// Canonical-IPA goldens for Min Nan / Taiwanese Hokkien (nan) — Sinitic, tonal. Two front-ends, one converter:
// Han → Tâi-lô via dict.tsv (MOE 臺灣閩南語辭典) → IPA, and direct Tâi-lô/POJ → IPA. The converter (from the
// epitran nan-Latn-tl spec): strip the tone diacritic → [initial] + final → IPA + Chao tone. Sibilants palatalise
// before i (ts/tsh/s/j → t͡ɕ/t͡ɕʰ/ɕ/d͡ʑ), checked -p̚/-t̚/-k̚ + -h→ʔ, nasalised -nn vowels, syllabic m̩/ŋ̍.
// segmental + citation tone (sandhi deferred).
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

    test("running Han text: word segmentation + within-word sandhi", () => {
        // 食飯 is a DICT WORD in the ChhoeTaigi rebuild (tsia̍h-pn̄g), so 食 takes its within-word
        // sandhi tone (8→˨˩), which is how the phrase is actually said. The old expectation
        // (citation ʔ˥ on 食) was an artifact of the MOE dict lacking the word — 食 and 飯 fell to
        // separate single-char lookups with citation tones.
        expect(phonemize("我食飯", "nan")).toBe("ɡu̯a˥˩ t͡ɕi̯aʔ˨˩ pŋ̍˧"); // guá tsia̍h-pn̄g (飯 → syllabic ŋ̍)
    });
});

// Cardinal numbers — Min Nan is Sinitic, so (exactly as in cantonese.ts) an integer is composed into the shared
// Chinese numeral string 零一二三四五六七八九 + 十百千萬億 and READ THROUGH THE SHIPPED HAN DICT: no numeral readings
// are authored, every character's Tâi-lô comes from dict-chars.tsv/dict.tsv. Two departures: the numeral string is
// read char-by-char (the word dict's 一百 entry is tsi̍t-pà, not the numeral tsi̍t-pah), and 一 is /it/ as a final
// unit digit vs /tsi̍t/ as a magnitude multiplier (十一 tsa̍p-it, cf. 十一叔 tsa̍p-it-tsik in dict.tsv).
describe("min nan (nan) cardinal numbers — composed Han, read through the shipped dict", () => {
    for (const [n, ipa] of [
        [0, "liə̯ŋ˨˦"], // 零 lîng
        [7, "t͡ɕʰit̚˧˨"], // 七 tshit
        [10, "t͡sap̚˥"], // 十 tsa̍p
        [11, "t͡sap̚˧˨ it̚˧˨"], // 十一 tsa̍p-it — final 一 is /it/, not /tsi̍t/
        [21, "d͡ʑi˨˩ t͡sap̚˧˨ it̚˧˨"], // 二十一 jī-tsa̍p-it (word-internal sandhi across the numeral)
        [42, "ɕi˥˩ t͡sap̚˧˨ d͡ʑi˧"], // 四十二 sì-tsa̍p-jī
        [100, "t͡ɕit̚˧˨ paʔ˧˨"], // 一百 tsi̍t-pah — 一 as a multiplier is /tsi̍t/
        [1000, "t͡ɕit̚˧˨ t͡ɕʰi̯ɛn˥"], // 一千
        [12345, "t͡ɕit̚˧˨ ban˨˩ d͡ʑi˨˩ t͡ɕʰi̯ɛn˧ sã˧ paʔ˥˩ ɕi˥˩ t͡sap̚˧˨ ɡɔ˧"], // 一萬二千三百四十五 — myriad grouping
        [1000000, "t͡ɕit̚˧˨ paʔ˥˩ ban˧"], // 一百萬 — no "million" word; 萬 10⁴ grouping
    ] as const) {
        test(`${n} → ${ipa}`, () => {
            expect(phonemize(String(n), "nan")).toBe(ipa);
        });
    }
});
