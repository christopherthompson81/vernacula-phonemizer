import { describe, expect, it, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/lao/lao.ts";
import { normalizeLao } from "../src/languages/lao/normalize.ts";

// Diagnostic gold for the Lao (lo) authored g2p — verified-correct common words + one per structural feature
// (leading-vowel reorder, discontinuous vowels, ຫ-led high sonorant, Cວ→uːə, ຳ→am, tone-mark extraction).
// Tone is the Vientiane 5-tone system (Chao letters), DERIVED from and VERIFIED against the kaikki Lao referee:
// 100% of single-syllable segmentally-correct words match, and per-syllable tone is ~100% where syllable counts
// agree (the segmental g2p is refereed by kaikki Lao).
describe("Lao (lo) g2p — diagnostic gold", () => {
    for (const [word, ipa] of [
        ["ລາວ", "laː˧˥w"], // "Lao/he" — ລ low + live sonorant coda → rising
        ["ຄົນ", "kʰo˧˥n"], // "person" — ົ short o + ນ coda (low class, live → rising)
        ["ນ້ຳ", "na˥˨m"], // "water" — ຳ → am, ້ mai tho extracted (low class → high-falling)
        ["ຂ້າວ", "kʰaː˧˩w"], // "rice" — ້ mai tho before the vowel (high class → low-falling)
        ["ເມືອງ", "mɯːə˧˥ŋ"], // "city" — ເ◌ືອ centring diphthong (low, live → rising)
        ["ສະບາຍດີ", "sa˧˥.baː˩j.diː˩"], // "hello" — 3-syllable, ◌າຍ → aːj
        ["ຫນັງສື", "na˩ŋ.sɯː˩"], // "book" — ຫນ → [n] HIGH class (live → low)
        ["ໂຮງຮຽນ", "hoː˧˥ŋ.hiːə˧˥n"], // "school" — ໂ leading + ◌ຽ diphthong (low, live → rising)
        ["ຄວາຍ", "kʰuːə˧˥j"], // "buffalo" — ຄວາ → kʰ + uːə (vowel, not kʷ cluster; low, live → rising)
        ["ສອງ", "sɔː˩ŋ"], // "two" — ◌ອ → ɔː (high class, live → low)
        ["ໄກ່", "ka˧j"], // "chicken" — ໄ leading → aj, ່ mai ek → mid
        ["ເດັກ", "de˧˥k̚"], // "child" — ເ◌ັ short e + dead stop coda (mid class, dead-short → rising)
    ] as const) {
        test(`${word} → ${ipa}`, () => {
            expect(phonemizeWord(word)).toBe(ipa);
        });
    }
});

// Cardinal numbers — a Tai system, structurally Thai's: 20 is ຊາວ (and REPLACES "twenty": ຊາວສອງ = 22, no ສິບ),
// a final 1 in any compound ≥11 is ເອັດ, and 10⁴/10⁵ are their own words (ໝື່ນ / ແສນ). Numerals from Wiktionary
// "Category:Lao numerals"; the compositor emits Lao script and the g2p above reads it (see lao.ts).
describe("Lao (lo) cardinal numbers", () => {
    for (const [n, ipa] of [
        [0, "suː˩n"], // ສູນ
        [7, "t͡ɕe˧˥t̚"], // ເຈັດ
        [11, "si˧˥p̚ ʔe˧˥t̚"], // ສິບເອັດ — final 1 is ເອັດ, not ໜຶ່ງ
        [20, "saː˧˥w"], // ຊາວ — the irregular twenty (no ສິບ)
        [21, "saː˧˥w ʔe˧˥t̚"], // ຊາວເອັດ
        [42, "siː˧ si˧˥p̚ sɔː˩ŋ"], // ສີ່ສິບສອງ — regular unit+ສິບ decade
        [100, "nɯ˧ŋ hɔː˥˨j"], // ໜຶ່ງຮ້ອຍ
        [101, "nɯ˧ŋ hɔː˥˨j ʔe˧˥t̚"], // ໜຶ່ງຮ້ອຍເອັດ — ເອັດ after a hundred too
        [1000, "nɯ˧ŋ pʰa˧˥n"], // ໜຶ່ງພັນ
        [12345, "nɯ˧ŋ mɯː˧n sɔː˩ŋ pʰa˧˥n saː˩m hɔː˥˨j siː˧ si˧˥p̚ haː˧˩"], // ໝື່ນ myriad magnitude
        [1000000, "nɯ˧ŋ laː˥˨n"], // ໜຶ່ງລ້ານ
    ] as const) {
        test(`${n} → ${ipa}`, () => {
            expect(phonemize(String(n), "lo")).toBe(ipa);
        });
    }
});

// The layer's evidence and its counter-examples both live in src/languages/lao/normalize.ts; these pin the
// rule BRANCHES rather than the corpus's instances (trap 13).
describe("Lao text normalization", () => {
    // Two invisible characters needing OPPOSITE treatment — the header's opening finding.
    it("the soft hyphen goes and the zero width space stays", () => {
        expect(normalizeLao("ຊະ­ນິດ")).toBe("ຊະນິດ"); // U+00AD splits one word into two tokens
        expect(normalizeLao("ຝູງ​ສັດປ່າ")).toBe("ຝູງ​ສັດປ່າ"); // U+200B IS the word boundary
    });

    // era-marker is 1,648 in a 20,994-paragraph dump — this language's biggest class, and it read as bare
    // letters plus TWO clause pauses.
    it("the era markers expand, and cannot cross a sentence boundary", () => {
        expect(normalizeLao("ໃນປີ ຄ.ສ. 1990")).toBe("ໃນປີ ຄຣິດສັກກະລາດ 1990");
        expect(normalizeLao("ພ.ສ. 2500")).toBe("ພຸດທະສັກກະລາດ 2500");
        // ⟨ຄ⟩ and ⟨ສ⟩ begin ordinary Lao words, and this corpus writes a full stop with no space after it.
        expect(normalizeLao("ຫຼາຍ.ສະນັ້ນ")).toBe("ຫຼາຍ.ສະນັ້ນ");
    });

    it("both separator conventions, told apart by group size", () => {
        expect(normalizeLao("512,115")).toBe("512115"); // comma-3 = thousands (×86)
        expect(normalizeLao("52.201 ກິໂລແມ້ດ")).toBe("52201 ກິໂລແມ້ດ"); // period-3 = thousands (×25)
        expect(normalizeLao("0.75")).toBe("0 ຈຸດ 7 5"); // period-2 = decimal
        expect(normalizeLao("2,1")).toBe("2 ຈຸດ 1"); // comma-1 = decimal (×6)
        // The comma case had NO symptom a gate could see: `,` emits no pause here, so the value was
        // silently split into two numbers.
        expect(phonemize("49,600", "lo")).toBe(phonemize("49600", "lo"));
    });

    it("percent leads, currency follows, and the two powers sit on opposite sides", () => {
        expect(normalizeLao("21%")).toBe("ຮ້ອຍລະ 21");
        expect(normalizeLao("$ 35 ລ້ານ")).toBe("35 ລ້ານ ໂດລາ");
        expect(normalizeLao("700,000 m²")).toBe("700000 ຕາລາງແມັດ"); // fused PREFIX
        expect(normalizeLao("2.6 ລ້ານ m³")).toBe("2 ຈຸດ 6 ລ້ານ ແມັດກ້ອນ"); // fused SUFFIX
        expect(normalizeLao("A & B")).toBe("A ແລະ B");
    });

    it("degrees: Lao writes the scale letter FIRST", () => {
        expect(normalizeLao("20 °C")).toBe("20 ອົງສາ");
        expect(normalizeLao("0 - 2 c°")).toBe("0 - 2 ອົງສາ"); // the corpus's own order
        expect(normalizeLao("51 ອົງສາ 50 ລິບດາ")).toBe("51 ອົງສາ 50 ລິບດາ"); // already spelled out
    });

    // The range and the negative share both obvious contexts in Lao; what separates them is what precedes
    // the space.
    it("the minus is read and the range is not", () => {
        expect(normalizeLao("ໄປທາງຕາເວັນຕົກ -180 ອົງສາ")).toBe("ໄປທາງຕາເວັນຕົກ ລົບ 180 ອົງສາ");
        expect(normalizeLao("(−1, −2, −3)")).toBe("(ລົບ 1, ລົບ 2, ລົບ 3)");
        expect(normalizeLao("ໃນປີ 1642 -1647")).toBe("ໃນປີ 1642 -1647"); // a year span
        expect(normalizeLao("30 - 33 c°")).toBe("30 - 33 ອົງສາ"); // a temperature span
        expect(normalizeLao("p^e_{-1}")).toBe("p^e_{-1}"); // subscript markup
    });
});
