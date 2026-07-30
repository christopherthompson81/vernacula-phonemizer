import { describe, expect, test } from "vitest";

import { phonemizeWord, createSerbian } from "../src/languages/serbian/serbian.ts";

// Canonical-IPA goldens for Serbian / српски (sr) — South Slavic, DUAL SCRIPT (Cyrillic + Gaj's Latin), fully
// phonemic. Both scripts map to the same IPA. Signature: ⟨в/v⟩→ʋ (labiodental approximant), ⟨ђ⟩→d͡ʑ / ⟨ћ⟩→t͡ɕ
// (alveolo-palatal affricates), ⟨џ/dž⟩→d͡ʒ, ⟨љ/lj⟩→ʎ / ⟨њ/nj⟩→ɲ, ⟨х/h⟩→x, syllabic ⟨r⟩; NO vowel reduction. The
// lexical pitch accent + length are unwritten → deferred (no accent mark). Validated at 98.4% vs wikipron hbs
// latin + 99.2% vs epitran. See docs/investigations/sr_native_bringup_investigation.md.
describe("Serbian canonical IPA", () => {
    test("Latin: v→ʋ, the alveolo-palatal + palatal series, syllabic r", () => {
        expect(phonemizeWord("voda")).toBe("ʋoda"); // v → ʋ
        expect(phonemizeWord("ljubav")).toBe("ʎubaʋ"); // lj → ʎ
        expect(phonemizeWord("čovek")).toBe("t͡ʃoʋek"); // č → t͡ʃ
        expect(phonemizeWord("đak")).toBe("d͡ʑak"); // đ → d͡ʑ
        expect(phonemizeWord("ćao")).toBe("t͡ɕao"); // ć → t͡ɕ
        expect(phonemizeWord("džep")).toBe("d͡ʒep"); // dž → d͡ʒ
        expect(phonemizeWord("srce")).toBe("srt͡se"); // syllabic r + c → t͡s
        expect(phonemizeWord("njega")).toBe("ɲeɡa"); // nj → ɲ
    });

    test("Cyrillic maps to the SAME IPA", () => {
        expect(phonemizeWord("вода")).toBe("ʋoda");
        expect(phonemizeWord("љубав")).toBe("ʎubaʋ");
        expect(phonemizeWord("ђак")).toBe("d͡ʑak"); // ђ → d͡ʑ
        expect(phonemizeWord("срце")).toBe("srt͡se");
        expect(phonemizeWord("хвала")).toBe("xʋala"); // х → x
    });

    test("numbers (Slavic count agreement on hiljada)", () => {
        const d = createSerbian();
        expect(d.text("21").trim()).toBe("dʋadeset jedan"); // dvadeset jedan
        expect(d.text("234").trim()).toBe("dʋesta trideset t͡ʃetiri"); // dvesta trideset četiri
        expect(d.text("1000").trim()).toBe("xiʎadu"); // hiljadu
        expect(d.text("5000").trim()).toBe("pet xiʎada"); // pet hiljada (5+ → many)
    });

    // GENDER on the magnitude noun: hiljada is FEMININE, so the multiplier is dve / jedna (Serbian is ekavian →
    // dve, not the ijekavian dvije). milion is masculine and keeps dva.
    test("numbers: gender agreement on the FEMININE hiljada", () => {
        const d = createSerbian();
        expect(d.text("1000").trim()).toBe("xiʎadu"); // hiljadu — the standalone form
        expect(d.text("2000").trim()).toBe("dʋe xiʎade"); // dve hiljade — FEM two (not *dva hiljade)
        expect(d.text("5000").trim()).toBe("pet xiʎada"); // pet hiljada — gen.pl
        expect(d.text("21000").trim()).toBe("dʋadeset jedna xiʎada"); // dvadeset jedna hiljada — …1 → fem sg
        expect(d.text("1000000").trim()).toBe("jedan milion"); // jedan milion — masculine
        expect(d.text("2000000").trim()).toBe("dʋa miliona"); // dva miliona — masculine keeps dva
    });
});
