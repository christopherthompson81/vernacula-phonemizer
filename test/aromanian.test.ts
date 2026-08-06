import { describe, expect, test } from "vitest";

import { createAromanian, phonemizeWord } from "../src/languages/aromanian/aromanian.ts";
import { numberToWords } from "../src/languages/aromanian/numbers.ts";

// Canonical-IPA goldens for Aromanian (rup) — armãneashti, an Eastern (Balkan) Romance sibling of Romanian, the Cunia
// Latin orthography. Signatures: the Aromanian DIGRAPHS ⟨ts⟩→[t͡s], ⟨dz⟩→[d͡z], ⟨sh⟩→[ʃ], ⟨nj⟩→[ɲ], ⟨lj⟩→[ʎ],
// ⟨dh⟩→[ð], ⟨th⟩→[θ]; ⟨ã⟩→[ə]; the shared Romance c/g softening + rising diphthongs ⟨ea⟩→[e̯a], ⟨oa⟩→[o̯a] + the
// word-final ⟨-u⟩ desyllabification. Referee: wikipron rup narrow + kaikki.
describe("Aromanian (armãneashti) canonical IPA", () => {
    const rup = createAromanian();

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

    // NUMBERS — Balkan Romance with its CONTACT vocabulary: 20 ⟨yinghits⟩ (opaque, where Romanian rebuilt
    // douăzeci), 100 ⟨sutã⟩ (the Slavic loan, not a *centum* reflex), 1000 ⟨njilji⟩. 21–29 fuse the ⟨-sprã-⟩
    // "over" infix over ⟨yinghits⟩; 31–99 take the ⟨shi⟩ connector. Sources cited in aromanian/numbers.ts.
    test("numbers: units, the fused twenties, the ⟨shi⟩ connector, hundreds, thousands, millions", () => {
        expect(numberToWords(7)).toBe("shapti");
        expect(numberToWords(16)).toBe("shasprãdzatsi"); // the ⟨-sprã-dzatsi⟩ over-ten series
        expect(numberToWords(20)).toBe("yinghits"); // ★ the opaque Latin *vīgintī* reflex
        expect(numberToWords(21)).toBe("unsprãyinghits"); // ★ one-over-TWENTY, fused (no connector)
        expect(numberToWords(31)).toBe("treidzãts shi unu"); // 30+ take ⟨shi⟩
        expect(numberToWords(100)).toBe("unã sutã"); // ★ the Slavic ⟨sutã⟩
        expect(numberToWords(555)).toBe("tsintsi suti tsindzãts shi tsintsi");
        expect(numberToWords(12345)).toBe("dosprãdzatsi njilj trei suti patrudzãts shi tsintsi");
        expect(numberToWords(1000000)).toBe("unã miliunã");
        expect(numberToWords(1000000000)).toBe("unã njilji miliunj"); // Cunia's own gloss: a thousand millions
    });

    test("numbers: the magnitude nouns are FEMININE, so 2 agrees as ⟨dau⟩", () => {
        expect(numberToWords(2)).toBe("doi"); // bare 2 — masculine
        expect(numberToWords(200)).toBe("dau suti"); // feminine before sutã
        expect(numberToWords(2000)).toBe("dau njilj"); // feminine before njilji
        expect(numberToWords(2000000)).toBe("dau miliunj"); // feminine before miliunã
    });

    test("numbers read through the g2p", () => {
        expect(rup.text("21").trim()).toBe("unsprəɣinɡit͡s"); // ⟨ã⟩→ə, ⟨y⟩→ɣ (Greek gamma), ⟨ts⟩→t͡s
        expect(rup.text("100").trim()).toBe("unə sutə");
    });
});
