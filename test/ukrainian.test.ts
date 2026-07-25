import { describe, expect, test } from "vitest";

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
        expect(getPhonemizer("uk").text("1000").trim()).toBe("tɪsʲat͡ʃa"); // тисяча — bare (no leading "один"), via westernNumberWords
        expect(getPhonemizer("uk").text("2").trim()).toBe("dʋa"); // два
    });
});
