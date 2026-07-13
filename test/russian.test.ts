import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/russian/russian.ts";

// Canonical-IPA goldens for Russian (ru) — standard Moscow Russian, espeak-independent. Stress is lexical
// (stress.tsv, from kaikki); the rule g2p derives palatalization (Cʲ), iotation (я/е/ё/ю → jV), stress-based
// reduction (akanye/ikanye), final devoicing + regressive voicing assimilation, and the ɵ/æ/ʉ frontings.
// Stress mark is placed before the stressed VOWEL (repo convention); monosyllables carry none.
describe("russian canonical IPA", () => {
    test("vowel reduction (akanye/ikanye)", () => {
        expect(phonemizeWord("молоко")).toBe("məɫɐkˈo"); // мə-lɐ-ˈko (2nd-pretonic ə, 1st-pretonic ɐ)
        expect(phonemizeWord("голова")).toBe("ɡəɫɐvˈa");
        expect(phonemizeWord("город")).toBe("ɡˈorət"); // post-tonic ə, final д → t (devoiced)
        expect(phonemizeWord("собака")).toBe("sɐbˈakə");
        expect(phonemizeWord("хорошо")).toBe("xərɐʂˈo");
    });

    test("palatalization, iotation, frontings ɵ/æ", () => {
        expect(phonemizeWord("дядя")).toBe("dʲˈædʲə"); // æ between soft C, final я → ə
        expect(phonemizeWord("тётя")).toBe("tʲˈɵtʲə"); // ё after soft → ɵ
        expect(phonemizeWord("боксёр")).toBe("bɐksʲˈɵr");
        expect(phonemizeWord("язык")).toBe("jɪzˈɨk"); // initial я → jɪ (unstressed)
        expect(phonemizeWord("человек")).toBe("t͡ɕɪɫɐvʲˈek");
    });

    test("devoicing, sibilants, geminates, affrication", () => {
        expect(phonemizeWord("друг")).toBe("druk"); // final г → k
        expect(phonemizeWord("жизнь")).toBe("ʐɨznʲ"); // и after ж → ɨ
        expect(phonemizeWord("русский")).toBe("rˈusːkʲɪj"); // geminate сс → sː
        expect(phonemizeWord("детский")).toBe("dʲˈet͡skʲɪj"); // тс → t͡s
        expect(phonemizeWord("пятиться")).toBe("pʲˈætʲɪt͡sːə"); // -ться → t͡sː
        expect(phonemizeWord("джинсы")).toBe("d͡ʐˈɨnsɨ"); // дж → affricate d͡ʐ
    });

    test("stress dictionary + monosyllable (no mark)", () => {
        expect(phonemizeWord("что")).toBe("ʂto"); // irregular ч→ʂ is in the dict; monosyllable, no ˈ
        expect(phonemizeWord("кот")).toBe("kot");
        expect(phonemizeWord("большой")).toBe("bɐlʲʂˈoj");
    });

    test("Phase 2: genitive г→v + loanword hard е/и", () => {
        expect(phonemizeWord("красного")).toBe("krˈasnəvə"); // genitive -ого → v
        expect(phonemizeWord("большого")).toBe("bɐlʲʂˈovə");
        expect(phonemizeWord("много")).toBe("mnˈoɡə"); // adverb exception → keeps ɡ
        expect(phonemizeWord("тест")).toBe("tɛst"); // loanword hard т → tɛ (not tʲe)
        expect(phonemizeWord("отель")).toBe("ɐtˈɛlʲ");
        expect(phonemizeWord("форель")).toBe("fɐrˈɛlʲ");
        expect(phonemizeWord("тема")).toBe("tʲˈemə"); // native → stays soft
        expect(phonemizeWord("дорогого")).toBe("dərɐɡˈovə"); // genitive adjective (not the adverb дорого) → v
        expect(phonemizeWord("стенд")).toBe("stɛnt"); // loanword: с re-hardens before hard т (no stranded sʲ)
    });

    test("OOV stress: ё-restoration + adjective-lemma inference", () => {
        expect(phonemizeWord("еще")).toBe("jɪɕːˈɵ"); // ё written as е → ещё (ё stressed)
        expect(phonemizeWord("пришел")).toBe("prʲɪʂˈɵɫ"); // пришёл
        expect(phonemizeWord("которые")).toBe("kɐtˈorɨje"); // ← который (stem stress)
        expect(phonemizeWord("большое")).toBe("bɐlʲʂˈoje"); // ← большой (not comparative больший)
        expect(phonemizeWord("маленькая")).toBe("mˈalʲɪnʲkəjə"); // ← маленький (soft stem, -ая spelling)
    });

    // Transliterated foreign (mostly English) proper names. These are NOT stress-dict failures: the Cyrillic
    // transliteration already encodes the Russian-adapted reading (э forces hard mɛ, H→Г→ɡ), and the first-vowel
    // default matches English's predominant INITIAL stress (DAN-ny, MA-ry, EM-ily). This behaviour is intentional
    // and correct; only final-stressed borrowings (Мишель) would need per-name stress data.
    test("transliterated foreign names (adapted pronunciation, initial-stress default) — intentional", () => {
        expect(phonemizeWord("дэнни")).toBe("dˈɛnʲːɪ");
        expect(phonemizeWord("мэри")).toBe("mˈɛrʲɪ");
        expect(phonemizeWord("гарри")).toBe("ɡˈarʲːɪ"); // H → Г, read as ɡ
        expect(phonemizeWord("эмили")).toBe("ˈɛmʲɪlʲɪ");
        expect(phonemizeWord("джонни")).toBe("d͡ʐˈonʲːɪ"); // дж affricate
        expect(phonemizeWord("алекс")).toBe("ˈalʲɪks");
        expect(phonemizeWord("сара")).toBe("sˈarə");
    });

    test("numbers", () => {
        expect(phonemize("21", "ru")).toBe("dvˈat͡sətʲ ɐdʲˈin"); // двадцать один
        expect(phonemize("100", "ru")).toBe("sto"); // сто
        expect(phonemize("2024", "ru")).toBe(
            "dvʲe tˈɨsʲət͡ɕɪ dvˈat͡sətʲ t͡ɕɪtˈɨrʲe",
        ); // две тысячи…
    });

    // Independent adjudicated micro-gold (tools/ru-gold.tsv) — hand-transcribed Moscow Russian, not Wiktionary.
    test("adjudicated micro-gold (independent referee)", () => {
        const rows = readFileSync(
            new URL("../tools/ru-gold.tsv", import.meta.url),
            "utf8",
        ).split("\n");
        let match = 0,
            total = 0;
        for (const line of rows) {
            if (line === "" || line.startsWith("#") || !line.includes("\t"))
                continue;
            const [word, gold] = line.split("\t");
            total++;
            if (phonemizeWord(word!) === gold!.trim()) match++;
        }
        expect(total).toBeGreaterThan(120);
        expect(match / total).toBeGreaterThanOrEqual(0.96); // ≥96% (allows variable post-tonic я + 1 lexicon gap)
    });

    test("text: reduction + punctuation", () => {
        expect(phonemize("Я люблю русский язык.", "ru")).toBe(
            "ja lʲʊblʲˈu rˈusːkʲɪj jɪzˈɨk .",
        );
    });
});
