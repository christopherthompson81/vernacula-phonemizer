import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/faroese/faroese.ts";
import { getPhonemizer } from "../src/registry.ts";
import { numberToWords } from "../src/languages/faroese/numbers.ts";

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

    // CARDINAL NUMBERS — like Danish, Faroese is units-FIRST fused with "og" (einogtjúgu = 21) and chains magnitude
    // groups with "og". Two judgment calls: the modern DECIMAL tens (fimmti/seksti/sjeyti/áttati/níti) over the
    // Danish-derived vigesimal layer (hálvtrýss/trýss/hálvfjerðs/fýrs/hálvfems), and the NEUTER counting series
    // (eitt, tvey, trý) as the citation form. Sources: omniglot + faroeseonline. See faroese/numbers.ts.
    test("numbers: units-first og-compounds on the decimal tens, neuter citation forms", () => {
        expect(numberToWords(0)).toBe("null");
        expect(numberToWords(3)).toBe("trý"); // NEUTER counting form (not masc. tríggir)
        expect(numberToWords(21)).toBe("einogtjúgu"); // unit first, fused; compound "one" is ein-, not eitt-
        expect(numberToWords(55)).toBe("fimmogfimmti"); // decimal fimmti, not vigesimal hálvtrýss
        expect(numberToWords(99)).toBe("níggjuogníti");
        expect(numberToWords(100)).toBe("eitt hundrað");
        expect(numberToWords(555)).toBe("fimm hundrað og fimmogfimmti");
        expect(numberToWords(1000)).toBe("eitt túsund");
        expect(numberToWords(12345)).toBe("tólv túsund og trý hundrað og fimmogfýrati");
        expect(numberToWords(1000000)).toBe("ein millión");
        expect(numberToWords(1000000000)).toBe("ein milliard");
    });

    test("numbers: wired into the phonemizer", () => {
        expect(getPhonemizer("fo").text("21").trim()).toBe("aiːnɔkt͡ʃʏvʊ"); // einogtjúgu
        expect(getPhonemizer("fo").text("1000").trim()).toBe("ait tʉuːsʊnt"); // eitt túsund
    });

});
