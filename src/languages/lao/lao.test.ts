import { describe, expect, test } from "vitest";
import { phonemizeWord } from "./lao.ts";

// Diagnostic gold for the Lao (lo) authored g2p — verified-correct common words + one per structural feature
// (leading-vowel reorder, discontinuous vowels, ຫ-led high sonorant, Cວ→uːə, ຳ→am, tone-mark extraction).
// Tone is APPROXIMATE (Chao letters; the referee eval strips them — the segmental g2p is 93.8% vs kaikki Lao); the
// assertions include the current tone as a regression baseline. See docs/investigations/lo_native_bringup_investigation.md.
describe("Lao (lo) g2p — diagnostic gold", () => {
    for (const [word, ipa] of [
        ["ລາວ", "laː˥w"], // "Lao/he"
        ["ຄົນ", "kʰo˥n"], // "person" — ົ short o + ນ coda
        ["ນ້ຳ", "na˥m"], // "water" — ຳ → am, tone mark extracted
        ["ຂ້າວ", "kʰaː˥˩w"], // "rice" — ້ tone mark before the vowel
        ["ເມືອງ", "mɯːə˥ŋ"], // "city" — ເ◌ືອ centring diphthong
        ["ສະບາຍດີ", "sa˧˩.baː˧j.diː˧"], // "hello" — 3-syllable, ◌າຍ → aːj
        ["ຫນັງສື", "na˩˧ŋ.sɯː˩˧"], // "book" — ຫນ → [n] HIGH class
        ["ໂຮງຮຽນ", "hoː˥ŋ.hiːə˥n"], // "school" — ໂ leading + ◌ຽ diphthong
        ["ຄວາຍ", "kʰuːə˥j"], // "buffalo" — ຄວາ → kʰ + uːə (vowel, not kʷ cluster)
        ["ສອງ", "sɔː˩˧ŋ"], // "two" — ◌ອ → ɔː
        ["ໄກ່", "ka˧j"], // "chicken" — ໄ leading → aj
        ["ເດັກ", "de˧k̚"], // "child" — ເ◌ັ short e + dead stop coda
    ] as const) {
        test(`${word} → ${ipa}`, () => {
            expect(phonemizeWord(word)).toBe(ipa);
        });
    }
});
