import { describe, expect, test } from "vitest";
import { phonemizeWord } from "./lao.ts";

// Diagnostic gold for the Lao (lo) authored g2p — verified-correct common words + one per structural feature
// (leading-vowel reorder, discontinuous vowels, ຫ-led high sonorant, Cວ→uːə, ຳ→am, tone-mark extraction).
// Tone is the Vientiane 5-tone system (Chao letters), DERIVED from and VERIFIED against the kaikki Lao referee:
// 100% of single-syllable segmentally-correct words match, and per-syllable tone is ~100% where syllable counts
// agree (the segmental g2p is 97.7% vs kaikki Lao). See docs/investigations/lo_native_bringup_investigation.md.
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
