import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/mongolian/mongolian.ts";

// Canonical-IPA goldens for Standard Khalkha Mongolian (mn), Cyrillic, espeak-independent. Cyrillic Khalkha is a
// DEEP orthography: only the first-syllable vowel is realised full; a non-initial SHORT vowel reduces to ə or deletes
// word-finally (final vowel drop + epenthesis into the resulting cluster). Signatures: the ASPIRATED-vs-UNASPIRATED
// stop system (б=p т=tʰ), л→ɮ (voiced lateral fricative), back-harmony г→ɢ/х→χ, final н→ŋ, final в→f devoicing,
// doubled vowels → long. See docs/investigations/mn_native_bringup_investigation.md.
describe("Mongolian (Khalkha) canonical IPA", () => {
    test("consonants: б→p, д→t, т→tʰ, л→ɮ, final н→ŋ, harmony г→ɢ/х→χ", () => {
        expect(phonemizeWord("Монгол")).toBe("mɔŋɢʊɮ"); // back-harmony ɢ, dark ɮ, non-initial о→ʊ
        expect(phonemizeWord("сайн")).toBe("saiŋ"); // diphthong ай, final н→ŋ
        expect(phonemizeWord("ном")).toBe("nɔm"); // о→ɔ
        expect(phonemizeWord("хот")).toBe("χɔtʰ"); // back х→χ, т→tʰ
        expect(phonemizeWord("улс")).toBe("ʊɮs"); // у→ʊ, dark ɮ
    });

    test("front harmony + rounded/soft vowels", () => {
        expect(phonemizeWord("хүн")).toBe("xuŋ"); // front х→x, ү→u, final н→ŋ
        expect(phonemizeWord("өдөр")).toBe("ɵtɵr"); // ө→ɵ, non-initial ө stays round
        expect(phonemizeWord("морь")).toBe("mœr"); // ь fronts о→œ
    });

    test("long vowels (doubled) + final в devoicing + reduction", () => {
        expect(phonemizeWord("сургууль")).toBe("sʊrɢuːɮ"); // уу→uː long, final ь
        expect(phonemizeWord("гурав")).toBe("ɢʊrəf"); // final в→f, non-initial а→ə
    });

    test("deep-orthography reduction: final-vowel deletion", () => {
        expect(phonemizeWord("байна")).toBe("pain"); // б→p, final а deleted
    });

    test("sentence: clause punctuation", () => {
        expect(phonemize("Сайн байна уу?", "mn").trim()).toBe("saiŋ pain ʊː  ?"); // уу→ʊː long
    });
});
