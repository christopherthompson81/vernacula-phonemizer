import { describe, expect, test } from "vitest";

import { phonemizeWord, createMossi } from "../src/languages/mossi/mossi.ts";
import { numberToWords } from "../src/languages/mossi/numbers.ts";

// Canonical-IPA goldens for Mossi / Mooré (mos) — Niger-Congo GUR (Oti-Volta), Latin (Burkinabé) orthography,
// Hand-adjudicated against en.wiktionary Moore (Wiktionary). The greedy g2p
// + gemination scores 94.9% folded vs the referee (tools/referee-eval, 39 words) — the two residuals are referee
// artifacts (a gemination-notation inconsistency + a y/j typo), so the segmental backbone is ~100%. Signatures:
// dedicated ATR letters ⟨ɛ ɩ ʋ⟩, ⟨o⟩=o always (no ⟨ɔ⟩), DOUBLING = length, TILDE = nasal, ⟨r⟩=ɾ, ⟨y⟩=j. TONE
// (2-tone H/L) is not written in the orthography → not emitted; numbers are composed in numbers.ts.
describe("Mooré canonical IPA — greedy g2p + gemination", () => {
    test("dedicated ATR letters ⟨ɛ⟩=ɛ, ⟨ɩ⟩=ɪ, ⟨ʋ⟩=ʊ; ⟨o⟩=o always (no ɔ)", () => {
        expect(phonemizeWord("lakrɛ")).toBe("lakɾɛ"); // ⟨ɛ⟩ → ɛ
        expect(phonemizeWord("malɛka")).toBe("malɛka"); // "angel" — ⟨ɛ⟩ → ɛ
        expect(phonemizeWord("fɩnetre")).toBe("fɪnetɾe"); // ⟨ɩ⟩ → ɪ
        expect(phonemizeWord("boko")).toBe("boko"); // ⟨o⟩ → o (not ɔ)
        expect(phonemizeWord("laloa")).toBe("laloa"); // /ɔ/ is written as the hiatus ⟨oa⟩, not a letter
    });

    test("DOUBLING = LENGTH (aa→aː, ee→eː, ɛɛ→ɛː, uu→uː, ʋʋ→ʊː)", () => {
        expect(phonemizeWord("baare")).toBe("baːɾe"); // ⟨aa⟩ → aː
        expect(phonemizeWord("lɛɛre")).toBe("lɛːɾe"); // ⟨ɛɛ⟩ → ɛː
        expect(phonemizeWord("weefo")).toBe("weːfo"); // ⟨ee⟩ → eː
        expect(phonemizeWord("fulfuugu")).toBe("fulfuːɡu"); // ⟨uu⟩ → uː
        expect(phonemizeWord("faktɩʋʋre")).toBe("faktɪʊːɾe"); // ⟨ʋʋ⟩ → ʊː (long ʊ)
    });

    test("NASAL = TILDE (ã ẽ ĩ õ ũ); the nasal-long digraph ⟨ãa⟩ → ãː", () => {
        expect(phonemizeWord("burkĩna")).toBe("buɾkĩna"); // ⟨ĩ⟩ → ĩ (nasal i)
        expect(phonemizeWord("rõde")).toBe("ɾõde"); // ⟨õ⟩ → õ
        expect(phonemizeWord("esãase")).toBe("esãːse"); // ⟨ãa⟩ → ãː (nasal long a)
    });

    test("⟨r⟩=ɾ (tap), ⟨y⟩=j, ⟨g⟩=ɡ; CONSONANT GEMINATION (doubled → Cː)", () => {
        expect(phonemizeWord("zirga")).toBe("ziɾɡa"); // ⟨r⟩ → ɾ, ⟨g⟩ → ɡ
        expect(phonemizeWord("lay")).toBe("laj"); // ⟨y⟩ → j
        expect(phonemizeWord("yelle")).toBe("jelːe"); // ⟨y⟩ → j, ⟨ll⟩ → lː (geminate)
    });

    test("NASAL place assimilation: ⟨n⟩ → ŋ before a velar g/k (FSI /n/=[n,ŋ])", () => {
        expect(phonemizeWord("tenga")).toBe("teŋɡa"); // "village" — ⟨ng⟩ → ŋɡ (FSI tengá→teŋɡa)
        expect(phonemizeWord("sh")).toBe("ʃ"); // ⟨sh⟩ → ʃ (FSI /s/ allophone spelling)
    });

    test("text: words + clause punctuation (tone deferred)", () => {
        expect(createMossi().text("Burkĩna Faso. Yelle?")).toBe("buɾkĩna faso . jelːe ?");
    });

    // NUMBERS — DECIMAL. Mooré 6–9 (yoobe, yopoe, nii, wɛ) are opaque stems with no living 5+n formation, so
    // there is nothing quinary to compose; the sources call the system flatly décimal. Bespoke because of two
    // Gur features: each unit has a full and a SHORT combining stem (yembre ~ ye, yiibu ~ yi, tãabo ~ tã), and a
    // bare unit inside a compound needs the numeral particle a (piig la a ye 11) while a tens phrase takes la
    // alone. Tens/hundreds/thousands are the noun-class PLURALS piiga→pisi/pis, koabga→kobs, tusri→tus.
    // Sources: desmotsetdeslangues.eklablog.com/moore, Peace Corps/Burkina Faso "Introduction to Mooré" (2006),
    // Lexique français-mooré (zaalem 'zero'). See src/languages/mossi/numbers.ts.
    test("numbers: units, piig la a teens, pis- tens, la a compounds", () => {
        expect(numberToWords(0)).toBe("zaalem");
        expect(numberToWords(7)).toBe("yopoe");
        expect(numberToWords(10)).toBe("piiga");
        expect(numberToWords(11)).toBe("piig la a ye"); // combining piig + la + particle a + SHORT stem
        expect(numberToWords(20)).toBe("pisi"); // the plural of piiga
        expect(numberToWords(21)).toBe("pisi la a ye");
        expect(numberToWords(42)).toBe("pis naase la a yi");
        expect(numberToWords(99)).toBe("pis wɛ la a wɛ");
    });

    test("numbers: koabga hundreds, tusri thousands; ≥ 10⁶ falls back to digit-by-digit", () => {
        expect(numberToWords(100)).toBe("koabga"); // singular; 200 takes the plural stem kobs
        expect(numberToWords(101)).toBe("koabga la a ye");
        expect(numberToWords(555)).toBe("kobs a nu la pis nu la a nu");
        expect(numberToWords(1000)).toBe("tusri");
        expect(numberToWords(12345)).toBe("tus piig la a yi la kobs a tã la pis naase la a nu");
        // No attested Mooré numeral above tusri → the digits are read out rather than inventing a "million".
        expect(numberToWords(1_000_000)).toBe("yembre zaalem zaalem zaalem zaalem zaalem zaalem");
    });

    test("numbers: end-to-end through the g2p (text path)", () => {
        expect(createMossi().text("20")).toBe("pisi");
        expect(createMossi().text("1000")).toBe("tusɾi"); // ⟨r⟩ → the tap ɾ
    });
});
