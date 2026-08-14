import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/mongolian/mongolian.ts";

// Canonical-IPA goldens for Standard Khalkha Mongolian (mn), Cyrillic. Cyrillic Khalkha is a
// DEEP orthography: only the first-syllable vowel is realised full; a non-initial SHORT vowel reduces to ə or deletes
// word-finally (final vowel drop + epenthesis into the resulting cluster). Signatures: the ASPIRATED-vs-UNASPIRATED
// stop system (б=p т=tʰ), л→ɮ (voiced lateral fricative), back-harmony г→ɢ/х→χ, final н→ŋ, final в→f devoicing,
// doubled vowels → long.
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
        expect(phonemize("Сайн байна уу?", "mn").trim()).toBe("saiŋ pain ʊː ?"); // уу→ʊː long
    });

    test("loanword (mixed vowel harmony) keeps non-initial vowels full", () => {
        expect(phonemizeWord("Герман")).toBe("ɡermaŋ"); // е(front)+а(back) → loanword: а stays full, not reduced ə
    });

    test("traditional Mongolian script (Mongol bichig) front-end → transliterate → engine", () => {
        expect(phonemizeWord("ᠮᠣᠩᠭᠣᠯ")).toBe("mɔŋɢʊɮ"); // classical mongɣol → монгол → mɔŋɢʊɮ (same as Cyrillic Монгол)
    });

    test("cardinal numbers (absolute/attributive: гурав→гурван, хорь→хорин)", () => {
        expect(phonemize("1","mn").trim()).toBe("neɡ"); // нэг
        expect(phonemize("10","mn").trim()).toBe("arəf"); // арав
        expect(phonemize("25","mn").trim()).toBe("χɔrəŋ tʰaf"); // хорин тав (attr 20 + abs 5)
        expect(phonemize("100","mn").trim()).toBe("t͡sʊː"); // зуу
        expect(phonemize("2000","mn").trim()).toBe("χɔjʊr maŋəɢ"); // хоёр мянга
    });

    test("⟨ъ⟩ keeps the GLIDE of the following iotated letter (томъёо → tʰɔmjɔː), not just a break", () => {
        // Found by the silent-deletion detector: the hard sign is written precisely to say that ⟨ё/я/ю/е⟩
        // after it is [j]+V, and treating it as a bare separator dropped the [j] — `томъёоны → tʰɔmʊʊn`.
        expect(phonemizeWord("томъёоны")).toBe("tʰɔmjʊʊn");
        expect(phonemizeWord("Сахъяа")).toBe("saχjə");
    });

    test("⟨ї⟩ U+0457 is a legacy-codepage ⟨ү⟩ — a vowelless word, not a Ukrainian letter", () => {
        // Pre-Unicode Mongolian fonts borrowed the Ukrainian codepoint for ⟨ү⟩; ×8 in the artifact against
        // ⟨ү⟩ ×2,703, and outside the letter tables it read as nothing: `бїр → pr`, `їр → r`.
        expect(phonemizeWord("бїр")).toBe(phonemizeWord("бүр"));
        expect(phonemizeWord("бїлэг")).toBe(phonemizeWord("бүлэг"));
        expect(phonemizeWord("їр")).toBe("ur");
    });
});
