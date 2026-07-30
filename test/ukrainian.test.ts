import { describe, expect, test } from "vitest";

import { ROMAN_POLICY } from "../src/languages/ukrainian/romanOrdinals.ts";
import { phonemizeWord } from "../src/languages/ukrainian/ukrainian.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Ukrainian / українська (uk) — East Slavic, Cyrillic. Ukrainian has NO vowel
// reduction, so the g2p is a flat scan (no stress dictionary). Signatures: г→[ɦ] (vs Russian ɡ), dark л→[ɫ], в
// as /w/ with allophony ([w] before о/у + coda, [ʋ] before а/е/и, [ʋʲ] before і), PALATALISATION (Cʲ before ь/і/
// iotated) + REGRESSIVE palatalisation (a coronal before a palatalised consonant). Validated at 95.1% vs
// wikipron ukr_cyrl narrow (50k, human). See docs/investigations/uk_native_bringup_investigation.md.
describe("Ukrainian canonical IPA", () => {
    test("г→ɦ (the Ukrainian hallmark), dark л→ɫ, palatalisation", () => {
        expect(phonemizeWord("голова")).toBe("ɦɔɫɔʋa"); // г→ɦ, dark ɫ, medial в→ʋ
        expect(phonemizeWord("день")).toBe("dɛnʲ"); // soft sign → nʲ
        expect(phonemizeWord("місто")).toBe("mʲistɔ"); // і palatalises м; о stays ɔ (no reduction)
    });

    test("в-allophony: [w] before о/у + coda, [ʋ] before а/е/и", () => {
        expect(phonemizeWord("вода")).toBe("wɔda"); // в before о → w
        expect(phonemizeWord("слово")).toBe("sɫɔwɔ"); // в before о → w (medial)
        expect(phonemizeWord("мова")).toBe("mɔʋa"); // в before а → ʋ
    });

    test("regressive palatalisation + palatalised geminates", () => {
        expect(phonemizeWord("Дніпро")).toBe("dʲnʲiprɔ"); // д before нʲ → dʲ (regressive)
        expect(phonemizeWord("Буття")).toBe("butʲːa"); // тть → geminate palatalised tʲː
    });

    test("iotated vowels (є→jɛ initial, palatalising after a consonant)", () => {
        expect(phonemizeWord("Європа")).toBe("jɛu̯rɔpa"); // Є initial → jɛ; в post-vocalic coda → [u̯]
        expect(phonemizeWord("сім'я")).toBe("sʲimja"); // apostrophe → no palatalisation, я → ja
    });

    test("numbers compose (Slavic decimal)", () => {
        expect(getPhonemizer("uk").text("100").trim()).toBe("stɔ"); // сто
        expect(getPhonemizer("uk").text("1000").trim()).toBe("tɪsʲat͡ʃa"); // тисяча — bare (no leading "один")
        expect(getPhonemizer("uk").text("2").trim()).toBe("dʋa"); // два
    });

    // MAGNITUDE-NOUN AGREEMENT (src/languages/ukrainian/numbers.ts). тисяча is a FEMININE noun, so the
    // multiplier must be feminine (дві, одна — not два, один), and the noun itself inflects for the count:
    // nom.sg after …1, nom.pl after …2–4, gen.pl after 5+/11–14. мільйон is masculine and keeps два.
    test("numbers: gender + count agreement on the magnitude nouns", () => {
        const uk = getPhonemizer("uk");
        expect(uk.text("1000").trim()).toBe("tɪsʲat͡ʃa"); // тисяча
        expect(uk.text("2000").trim()).toBe("dʲʋʲi tɪsʲat͡ʃʲi"); // дві тисячі — FEM two + nom.pl (not *два тисяча)
        expect(uk.text("5000").trim()).toBe("pjatʲ tɪsʲat͡ʃ"); // п'ять тисяч — gen.pl after 5
        expect(uk.text("21000").trim()).toBe("dʋadʲt͡sʲatʲ ɔdna tɪsʲat͡ʃa"); // двадцять одна тисяча — …1 → fem sg
        expect(uk.text("1000000").trim()).toBe("ɔdɪn mʲilʲjɔn"); // один мільйон — masc, multiplier KEPT
        expect(uk.text("2000000").trim()).toBe("dʋa mʲilʲjɔnɪ"); // два мільйони — nom.pl (not *два мільйон)
    });
});

// Roman-numeral ORDINAL policy (src/languages/ukrainian/romanOrdinals.ts). Ukrainian reads a century as an
// ordinal — XII століття → дванадцяте століття — and the century noun is NEUTER (століття/сторіччя), so the
// table is neuter -е, not the masculine -ий Russian and Polish need. вік is excluded from the context on
// purpose: a masculine head cannot take this table.
describe("Ukrainian roman-numeral ordinals", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal?.(n);

    test("neuter ordinal words; only the last element inflects above 20", () => {
        expect(ord(1)).toBe("перше");
        expect(ord(12)).toBe("дванадцяте");
        expect(ord(19)).toBe("дев'ятнадцяте");
        expect(ord(21)).toBe("двадцять перше"); // cardinal tens + neuter ordinal unit
        expect(ord(40)).toBe("сорокове"); // own stem
        expect(ord(50)).toBe("п'ятдесяте");
        expect(ord(63)).toBe("шістдесят третє"); // past 50 — anniversary / congress range
        expect(ord(100)).toBe("соте");
        expect(ord(101)).toBeUndefined(); // out of range → the caller falls back to the cardinal
    });

    test("context matches the inflected century forms, but NOT masculine вік", () => {
        for (const w of ["століття", "столітті", "століттю", "століттям", "століть", "сторіччя", "сторіч", "річниця"])
            expect(ROMAN_POLICY.ordinalAfter?.test(w)).toBe(true);
        expect(ROMAN_POLICY.ordinalAfter?.test("вік")).toBe(false);
        expect(ROMAN_POLICY.ordinalAfter?.test("віку")).toBe(false);
    });

    test("the ordinal reading phonemizes in context", () => {
        expect(getPhonemizer("uk").text("дванадцяте століття").trim()).toBe("dʋanadʲt͡sʲatɛ stɔlʲitʲːa");
        expect(getPhonemizer("uk").text("двадцяте сторіччя").trim()).toBe("dʋadʲt͡sʲatɛ stɔrʲit͡ʃt͡ʃʲa");
    });

    test("a bare roman numeral still reads as a CARDINAL", () => {
        expect(getPhonemizer("uk").text("xii").trim()).toBe("dʋanadʲt͡sʲatʲ"); // дванадцять, not дванадцяте
        expect(getPhonemizer("uk").text("xx вік").trim()).toBe("dʋadʲt͡sʲatʲ ʋʲik"); // masculine head → cardinal
    });
});
