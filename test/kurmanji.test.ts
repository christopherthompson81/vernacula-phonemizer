import { describe, expect, test } from "vitest";

import { phonemizeWord, createKurmanji } from "../src/languages/kurmanji/kurmanji.ts";

// Canonical-IPA goldens for Kurmanji / Kurdî (kmr) — Northern Kurdish, Iranian, the LATIN (Hawar) alphabet
// (vowels written, so no restoration — unlike Persian/Pashto abjads). Near-phonemic: ⟨c⟩→d͡ʒ / ⟨ç⟩→t͡ʃ (reverse of
// Romance), ⟨j⟩→ʒ, ⟨ş⟩→ʃ, ⟨q⟩→q, ⟨x⟩→x, ⟨xw⟩→xʷ; long a/ê/î/o/û → ɑː eː iː oː uː vs short e/i/u → ɛ ɪ ʊ;
// final-syllable stress; n→ŋ before k/ɡ. Aspiration/pharyngealisation are allophonic/unwritten → not emitted.
// Referees: wikipron kmr + epitran.
describe("Kurmanji canonical IPA", () => {
    test("the reversed affricates ⟨c⟩→d͡ʒ / ⟨ç⟩→t͡ʃ, ⟨j⟩→ʒ, ⟨ş⟩→ʃ", () => {
        expect(phonemizeWord("çav")).toBe("t͡ʃˈɑːv"); // ç → t͡ʃ, a → ɑː
        expect(phonemizeWord("roj")).toBe("rˈoːʒ"); // j → ʒ, o → oː
        expect(phonemizeWord("şêr")).toBe("ʃˈeːr"); // ş → ʃ, ê → eː
        expect(phonemizeWord("pênc")).toBe("pˈeːnd͡ʒ"); // c → d͡ʒ
    });

    test("the long/short vowel system + xw labialization + final stress", () => {
        expect(phonemizeWord("av")).toBe("ˈɑːv"); // a → ɑː
        expect(phonemizeWord("jin")).toBe("ʒˈɪn"); // short i → ɪ
        expect(phonemizeWord("kurd")).toBe("kˈʊrd"); // short u → ʊ
        expect(phonemizeWord("xwarin")).toBe("xʷɑːrˈɪn"); // xw → xʷ, final stress
        expect(phonemizeWord("name")).toBe("nɑːmˈɛ"); // final-syllable stress on ɛ
    });

    test("n → ŋ before a velar (nasal place assimilation)", () => {
        expect(phonemizeWord("bang")).toBe("bˈɑːŋɡ"); // n → ŋ before ɡ
    });

    test("numbers (tens û units with the û connector)", () => {
        const d = createKurmanji();
        expect(d.text("21").trim()).toBe("bˈiːst ˈuː jˈɛk"); // bîst û yek
        expect(d.text("100").trim()).toBe("sˈɛd"); // sed
        expect(d.text("234").trim()).toBe("dˈʊ sˈɛd ˈuː sˈiː ˈuː t͡ʃˈɑːr"); // du sed û sî û çar
    });
});
