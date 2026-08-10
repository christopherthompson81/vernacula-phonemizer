import { describe, expect, test } from "vitest";
import { normalizeMinNan } from "../src/languages/minnan/normalize.ts";

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
        // sandhi tone (8→˨˩), which is how the phrase is actually said. ⚠ A citation ʔ˥ here would mean the
        // dict LACKS the word: 食 and 飯 fall to separate single-char lookups, each with its citation tone.
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

describe("nan POJ → Tâi-lô fold (the converter was Tâi-lô-only)", () => {
    // ⚠ WHY: `minnan.jsonc`'s finals table is the epitran nan-Latn-tl spec — the TÂI-LÔ spellings — so POJ
    // input worked only where the two orthographies coincide and fell through to "leave the romanization
    // visible" everywhere else. The corpus IS POJ, so 533 of 3,805 word types (1,482 tokens) emitted raw
    // romanization instead of IPA. See docs/investigations/nan_normalization_investigation.md Run 3–4.
    test("every correspondence the two orthographies differ on now converges", () => {
        for (const [poj, tailo] of [
            ["peng", "ping"],       // eng ↔ ing
            ["le̍k", "li̍k"],        // ek  ↔ ik
            ["gō͘", "gōo"],         // o͘   ↔ oo   (U+0358) — ⚠ TONE-MATCHED pairs, or only the tone differs
            ["hoaⁿ", "huann"],      // ⁿ   ↔ nn
            ["chi", "tsi"],         // ch  ↔ ts
            ["chhi", "tshi"],       // chh ↔ tsh
            ["koan", "kuan"],       // oa  ↔ ua
            ["hoe", "hue"],         // oe  ↔ ue
        ] as const)
            expect(phonemizeWord(poj), `${poj} vs ${tailo}`).toBe(phonemizeWord(tailo));
    });

    test("⚠ the MIDDLE DOT spelling of ⟨o͘⟩ is folded too — running text writes both", () => {
        // 234 combining-dot instances against 141 middle-dot ones in the corpus.
        expect(phonemizeWord("thò·")).toBe(phonemizeWord("thòo"));
        expect(phonemizeWord("sò͘")).toBe(phonemizeWord("sòo"));
    });

    test("⚠ the fold is a NO-OP on Tâi-lô, which is what keeps the Han path safe", () => {
        // Every left-hand side is a spelling Tâi-lô does not use, so a dict reading passes through unchanged.
        for (const w of ["ping", "li̍k", "goo", "huann", "tsi", "tshi", "kuan", "hue", "hong", "tang"])
            expect(phonemizeWord(w), w).not.toMatch(/[A-Z]|g(?![̊])/u);
        expect(phonemizeWord("台灣")).toBe(phonemizeWord("tâi-uân"));
    });

    test("⚠ canonical IPA uses ɡ U+0261, never ASCII g — which is what exposed the leak", () => {
        // wuu/cmn/yue/jv emit zero ASCII `g`; nan emitted 1,482 across the corpus, all unmapped syllables.
        expect(phonemizeWord("gō͘")).toContain("\u0261");
        expect(phonemizeWord("gō͘")).not.toContain("g");
        expect(phonemizeWord("pêng-hong")).not.toMatch(/[a-z]*g[a-z]*/u);
    });
});

describe("nan text normalization", () => {
    // Evidence, refusals and dead ends: docs/investigations/nan_normalization_investigation.md.
    // ⚠ SOURCED IN POJ, EMITTED IN HAN. nan.wikipedia is romanized (268 Han characters against 38,490 Latin
    // in the retained corpus), which is where every word was sourced — but users write Han, and the POJ
    // spellings LEAK ASCII through the converter, so the emitted forms are Han. See the file header.
    test("⚠ a POJ spelling of the fraction word leaks ASCII; the Han one does not", () => {
        // This is why the layer emits Han: `hun chi` came out *hun chi˥*, the 之 syllable unmapped.
        // ⚠ THE ASSERTION NAMES THE LEAK, it does not test for "any Latin": IPA is WRITTEN in ASCII
        // letters, so a `[A-Za-z]` test here is meaningless (the same trap the Wu tests hit).
        // The old POJ output was *ɡɔ˧ hun˥ **chi˥*** — the literal string `chi`, unmapped.
        expect(phonemize("1/5", "nan")).toBe("ɡɔ˧ hun˥ t͡ɕi˥ it̚˧˨");
        expect(phonemize("50%", "nan")).toBe("paʔ˥˩ hun˥ t͡ɕi˥ ɡɔ˨˩ t͡sap̚˥");
        // ⚠ 1/5 reads the LITERARY ⟨it⟩, not the colloquial ⟨tsi̍t⟩ of a bare 一 — and that is exactly what
        // the corpus writes: `Tē-kiû ê gō͘ hun chi it`.
        expect(phonemize("1/5", "nan")).not.toBe(phonemize("五分之一", "nan"));
    });

    test("⚠ °C in HAN running text — the shape the POJ corpus could never show", () => {
        // `溫度10°C到2°C` read *un-tō͘ tsa̍p **toc** kàu…*: the guard was `(?!\p{L})`, a Han character IS
        // `\p{L}`, so the rule declined and the bare-degree rule fused ⟨tō͘⟩ onto the stranded ⟨C⟩.
        // The defect was a fused Latin token — *…t͡sap̚˥ **toc**˥ kau̯…* — so the assertion names it.
        expect(phonemize("溫度10°C到2°C", "nan")).not.toContain("toc");
        expect(normalizeMinNan("溫度10°C到2°C")).toBe("溫度攝氏10度到攝氏2度");
        // ⟨攝氏⟩ is a dict WORD reading Liap-sī — the term this corpus defines: `Liap-sī 0 tō͘ (0 °C)`.
        expect(normalizeMinNan("10°C")).toBe("攝氏10度");
    });

    test("the grouping comma destroys the value, and this corpus is English-format", () => {
        // comma groups ×45 against 3 dot-groups; dot decimals ×55 against 2 comma-decimals.
        expect(normalizeMinNan("1,000")).toBe("1000");
        expect(normalizeMinNan("181,040 km²")).toBe("181040 平方公里");
        expect(normalizeMinNan("3.5")).toBe("3點五");
        // ⚠ the fractional part is HAN digits, one at a time — joined, `1.797` read the CARDINAL
        // *chhit-pah káu-cha̍p chhit*, "seven hundred ninety-seven".
        expect(normalizeMinNan("1.797")).toBe("1點七九七");
    });

    test("⚠ EN DASH and TILDE are ranges; the ASCII HYPHEN is not, and POJ is why", () => {
        // 5/5 and 4/4 genuine against 26 ASCII hyphens that are mostly the `ISO 8859-N` block, an ISBN,
        // arithmetic — and POJ's own word-internal syllable joiner.
        expect(normalizeMinNan("15–16 sè-kí")).toBe("15 到 16 sè-kí");
        expect(normalizeMinNan("32~64 mg/kg")).toBe("32 到 64 mg/kg");
        expect(normalizeMinNan("ISO 8859-1")).toBe("ISO 8859-1");
        expect(normalizeMinNan("ko͘-1-ê")).toBe("ko͘-1-ê"); // a POJ compound, not a range
        // ⚠ THE LEFT ENDPOINT MAY CARRY ITS UNIT — captured and PUT BACK so step 3 still sees `25°C`.
        // Asserted end-to-end because ℃ is folded to `°C` by the REGISTRY, upstream of this function.
        expect(phonemize("25℃~30℃", "nan")).toBe(phonemize("攝氏25度到攝氏30度", "nan"));
    });

    test("units, exponent, rate and currency — all corpus-sourced, several glossed by the corpus", () => {
        expect(phonemize("36,000 km²", "nan")).toContain(phonemizeWord("平方"));
        expect(phonemize("3~4 km/biáu", "nan")).toContain(phonemizeWord("每"));
        // `Bí-kim 1 kho͘ (US$1)` — the corpus supplies both signs and their readings in one parenthesis.
        expect(phonemize("$500", "nan")).toContain(phonemizeWord("箍"));
        expect(phonemize("US$3", "nan")).toContain(phonemizeWord("美金"));
        // ⟨佮⟩ kap ×114 — Min Nan's own conjunction, not the 和 the other Sinitic layers use.
        expect(phonemize("A&B", "nan")).toContain(phonemizeWord("佮"));
    });

    test("a coordinate reads its degrees; the arc marks are dropped, not guessed", () => {
        // ⟨tō͘⟩ is attested (`lâm-hūi 65-tō͘`); no arc-minute or arc-second word is.
        expect(normalizeMinNan("118°04'04\"")).toBe("118度 04 04");
        expect(normalizeMinNan("24°26'")).toBe("24度 26");
    });
});
