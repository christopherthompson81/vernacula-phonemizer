import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/aromanian/aromanian.ts";

// Canonical-IPA goldens for Aromanian (rup) — armãneashti, an Eastern (Balkan) Romance sibling of Romanian, the Cunia
// Latin orthography. Signatures: the Aromanian DIGRAPHS ⟨ts⟩→[t͡s], ⟨dz⟩→[d͡z], ⟨sh⟩→[ʃ], ⟨nj⟩→[ɲ], ⟨lj⟩→[ʎ],
// ⟨dh⟩→[ð], ⟨th⟩→[θ]; ⟨ã⟩→[ə]; the shared Romance c/g softening + rising diphthongs ⟨ea⟩→[e̯a], ⟨oa⟩→[o̯a] + the
// word-final ⟨-u⟩ desyllabification. Referee: wikipron rup narrow + kaikki. See docs/investigations/rup_native_bringup_investigation.md.
describe("Aromanian (armãneashti) canonical IPA", () => {
    test("★ the Aromanian digraphs ⟨ts dz sh nj lj dh th⟩", () => {
        expect(phonemizeWord("tsintsi")).toBe("t͡sint͡si"); // 'five' — ⟨ts⟩→[t͡s]
        expect(phonemizeWord("dzatsi")).toBe("d͡zat͡si"); // 'ten' — ⟨dz⟩→[d͡z]
        expect(phonemizeWord("njic")).toBe("ɲik"); // 'small' — ⟨nj⟩→[ɲ]
        expect(phonemizeWord("oclju")).toBe("okʎu"); // 'eye' — ⟨lj⟩→[ʎ]
        expect(phonemizeWord("cathi")).toBe("kaθi"); // 'each' — ⟨th⟩→[θ]
        expect(phonemizeWord("dhoarã")).toBe("ðo̯arə"); // ⟨dh⟩→[ð]; ⟨oa⟩→[o̯a]; ⟨ã⟩→[ə]
    });

    test("★ ⟨ã⟩→[ə], the rising diphthongs ⟨ea oa⟩, and the endonym", () => {
        expect(phonemizeWord("armãneashti")).toBe("arməne̯aʃti"); // 'Aromanian' — ⟨ã⟩→[ə], ⟨ea⟩→[e̯a], ⟨sh⟩→[ʃ]
        expect(phonemizeWord("noaptea")).toBe("no̯apte̯a"); // 'the night' — ⟨oa⟩→[o̯a], ⟨ea⟩→[e̯a]
        expect(phonemizeWord("limba")).toBe("limba"); // 'the tongue/language'
    });

    test("Romance c/g softening + the word-final ⟨-u⟩ desyllabification", () => {
        expect(phonemizeWord("Crãciun")).toBe("krət͡ʃun"); // 'Christmas' — ⟨ci⟩→[t͡ʃ] (silent softener i)
        expect(phonemizeWord("ghine")).toBe("ɡine"); // 'well' — ⟨gh⟩→[ɡ] (matches 2/3 of the referee; the ɣ~ɡ fold covers the rest)
        expect(phonemizeWord("cãntãtor")).toBe("kəntətor"); // 'singer' — ⟨ã⟩→[ə]
        expect(phonemizeWord("acatsu")).toBe("akat͡s"); // final ⟨-u⟩ after a single consonant → desyllabified (dropped)
        expect(phonemizeWord("amintu")).toBe("amintu"); // final ⟨-u⟩ after a CLUSTER (nt) stays syllabic [u]
    });

    test("⟨y⟩→[ɣ] (Greek gamma), and ⟨ndz⟩→[ndʒ] (the soft-g reflex)", () => {
        expect(phonemizeWord("anyedz")).toBe("anɣed͡z"); // ⟨y⟩ → [ɣ] (the Greek-gamma letter, NOT the glide [j])
        expect(phonemizeWord("sãndze")).toBe("sənd͡ʒe"); // ⟨ndz⟩ before a front vowel → [ndʒ] (Latin *sanguine*)
        expect(phonemizeWord("dzinire")).toBe("d͡zinire"); // plain ⟨dz⟩ (no preceding n) stays [d͡z]
    });
});
