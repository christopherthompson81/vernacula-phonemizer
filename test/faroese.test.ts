import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/faroese/faroese.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Faroese / føroyskt (fo) — North Germanic (Insular Scandinavian, sibling of Icelandic),
// one of the deepest orthographies in the fleet. The core rule is that vowel LENGTH conditions vowel QUALITY
// (open syllable → long/diphthongal, closed → short/monophthong); plus b/d/g→p/t/k, intervocalic ð/g→glide,
// g/k→t͡ʃ before front vowels, skerping, ng-palatalization. Validated 57.1% folded / 88.6% symbol vs wikipron
// fao_latn_broad (human, 3024). See docs/investigations/fo_native_bringup_investigation.md.
describe("Faroese (føroyskt) canonical IPA", () => {
    test("length-conditioned vowel quality (open→long, closed→short) + b/d/g→p/t/k", () => {
        expect(phonemizeWord("maður")).toBe("mɛaːvʊɹ"); // open: a→[ɛaː] long; ð→[v] (round u); m man
        expect(phonemizeWord("land")).toBe("lant"); // closed: a→[a] short (before cluster); d→[t]
        expect(phonemizeWord("dagur")).toBe("tɛaːvʊɹ"); // d→[t]; open a→[ɛaː]; intervocalic g→[v] (round u)
        expect(phonemizeWord("bátur")).toBe("pɔɑːtʊɹ"); // b→[p]; á→[ɔɑː] long
    });

    test("intervocalic ⟨g ð⟩ glide by neighbour (front→j, round→v) + front-vowel affrication", () => {
        expect(phonemizeWord("vegur")).toBe("veːvʊɹ"); // g→[v] (round u wins; e is neutral)
        expect(phonemizeWord("Eyður")).toBe("ɛiːjʊɹ"); // ð→[j] (the i-offglide of ⟨ey⟩ wins over round u)
        expect(phonemizeWord("kirkja")).toBe("t͡ʃɪɹt͡ʃa"); // ⟨k⟩→[t͡ʃ] before front ⟨i⟩ and ⟨kj⟩→[t͡ʃ]
        expect(phonemizeWord("gøta")).toBe("køːta"); // ⟨g⟩ before ⟨ø⟩ is NOT affricated → [k]; ø→[øː] long
    });

    test("the Faroese hallmarks — skerping + ng-palatalization", () => {
        expect(phonemizeWord("dúgva")).toBe("tɪkva"); // SKERPING: ú→[ɪ] before ⟨gv⟩
        expect(phonemizeWord("nýggjur")).toBe("nʊt͡ʃʊɹ"); // SKERPING before ⟨ggj⟩: ý drops the offglide → [ʊ]; gg+j→[t͡ʃ]
        expect(phonemizeWord("gangi")).toBe("kɛɲt͡ʃɪ"); // ng: ⟨n⟩→[ɲ] before the affricate, a→[ɛ]; ⟨g⟩→[t͡ʃ]
        expect(phonemizeWord("fólk")).toBe("fœlk"); // ó→[œ] short (before cluster)
        expect(phonemizeWord("hús")).toBe("hʉuːs"); // ú→[ʉuː] long
    });

    test("registry wiring", () => {
        expect(getPhonemizer("fo").text("land").trim()).toBe("lant");
    });
});
