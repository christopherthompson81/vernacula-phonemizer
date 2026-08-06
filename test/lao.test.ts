import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/lao/lao.ts";

// Diagnostic gold for the Lao (lo) authored g2p — verified-correct common words + one per structural feature
// (leading-vowel reorder, discontinuous vowels, ຫ-led high sonorant, Cວ→uːə, ຳ→am, tone-mark extraction).
// Tone is the Vientiane 5-tone system (Chao letters), DERIVED from and VERIFIED against the kaikki Lao referee:
// 100% of single-syllable segmentally-correct words match, and per-syllable tone is ~100% where syllable counts
// agree (the segmental g2p is 97.7% vs kaikki Lao).
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
