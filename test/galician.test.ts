import { describe, expect, test } from "vitest";

import { createGalician, phonemizeWord } from "../src/languages/galician/galician.ts";

// Galician (gl, galego) — Ibero-Romance (~2.4M), sister of Portuguese. A shallow near-phonemic orthography, so the
// engine reuses the Spanish shape (left-to-right scan + vowel-run glide classifier + spirantization + rule-based
// stress). The Galician-specific deltas — all derived empirically from the wikipron glg_latn_broad referee (10,237
// human words, 90.9% folded / 98.4% symbol accuracy): ⟨x⟩/⟨j⟩→ʃ, ⟨g⟩→ɡ (no Castilian jota), ⟨nh⟩→ŋ, coda/pre-velar
// ⟨n⟩→ŋ, and the standard RAG distinción (⟨z⟩/⟨c+e,i⟩→θ). The 7-vowel open-mids ɛ/ɔ are lexical + unmarked in
// spelling → we emit close-mid e/o.
describe("Galician canonical IPA — Spanish-shaped Ibero-Romance engine + Galician deltas", () => {
    const gl = createGalician();

    test("⟨x⟩ = ʃ — THE Galician signature (Spanish's ks/jota is gone)", () => {
        expect(phonemizeWord("peixe")).toBe("pˈeᶦʃe"); // "fish" — x=ʃ, ei diphthong
        expect(phonemizeWord("xente")).toBe("ʃˈente"); // "people" — word-initial x=ʃ
        expect(phonemizeWord("caixa")).toBe("kˈaᶦʃa"); // "box"
        expect(phonemizeWord("baixo")).toBe("bˈaᶦʃo"); // "low/under"
    });

    test("⟨g⟩ is always the velar stop ɡ (no jota); intervocalic → spirant ɣ", () => {
        expect(phonemizeWord("galego")).toBe("ɡalˈeɣo"); // "Galician" — initial ɡ, intervocalic ɣ
        expect(phonemizeWord("xénero")).toBe("ʃˈeneɾo"); // ⟨g⟩-free but shows x=ʃ + é stress
    });

    test("⟨nh⟩ → ŋ and nasal velarization (coda / pre-velar ⟨n⟩ → ŋ)", () => {
        expect(phonemizeWord("unha")).toBe("ˈuŋa"); // ⟨nh⟩ = velar nasal
        expect(phonemizeWord("cinco")).toBe("θˈiŋko"); // ⟨n⟩ before velar → ŋ, ⟨c⟩ before i → θ
        expect(phonemizeWord("un")).toBe("ˈuŋ"); // word-final ⟨n⟩ → ŋ
    });

    test("the shared Ibero phonemes: ⟨ll⟩=ʎ, ⟨ñ⟩=ɲ, ⟨ch⟩=t͡ʃ, ⟨z/c⟩=θ, ⟨v⟩→b spirantized β", () => {
        expect(phonemizeWord("carballo")).toBe("kaɾβˈaʎo"); // ⟨ll⟩=ʎ (standard RAG), ⟨v⟩→β
        expect(phonemizeWord("ollo")).toBe("ˈoʎo"); // "eye"
        expect(phonemizeWord("mañá")).toBe("maɲˈa"); // ⟨ñ⟩=ɲ, á stress
        expect(phonemizeWord("chave")).toBe("t͡ʃˈaβe"); // ⟨ch⟩=t͡ʃ
    });

    test("⟨h⟩ silent, ⟨ou/au⟩ offglides; a falling-diphthong ending is oxytone", () => {
        expect(phonemizeWord("home")).toBe("ˈome"); // ⟨h⟩ silent
        expect(phonemizeWord("auga")).toBe("ˈaᶷɣa"); // ⟨au⟩ offglide, intervocalic ɣ
        expect(phonemizeWord("dous")).toBe("dˈoᶷs"); // ⟨ou⟩ offglide
        expect(phonemizeWord("cantou")).toBe("kantˈoᶷ"); // -ou preterite is OXYTONE (glide-final, not penult)
        expect(phonemizeWord("amei")).toBe("amˈeᶦ"); // -ei preterite oxytone
    });

    test("accented weak vowel breaks a diphthong into HIATUS (muíño→mu.í.ño), but a following weak stays offglide", () => {
        expect(phonemizeWord("muíño")).toBe("muˈiɲo"); // ⟨uí⟩ hiatus: u is its own nucleus (not the glide mwiɲo)
        expect(phonemizeWord("ruído")).toBe("ruˈiðo"); // ⟨uí⟩ hiatus
        expect(phonemizeWord("viúva")).toBe("biˈuβa"); // ⟨iú⟩ hiatus, ⟨v⟩→β
        expect(phonemizeWord("saíu")).toBe("saˈiᶷ"); // ⟨íu⟩ FOLLOWING weak stays a falling-diphthong offglide
    });

    test("the -ns plural cluster velarizes (cans→kaŋs); ⟨x⟩ before a consonant is [ks]", () => {
        expect(phonemizeWord("cans")).toBe("kˈaŋs"); // word-final -ns → ŋs
        expect(phonemizeWord("cancións")).toBe("kanθjˈoŋs"); // internal n stays, final -ns velarizes
        expect(phonemizeWord("texto")).toBe("tˈeksto"); // ⟨x⟩ before a consonant → [ks] (vs prevocalic ʃ)
    });

    test("cardinal numbers: ones 0..19 + tens with the connector 'e' (vinte e un)", () => {
        expect(gl.text("21").trim()).toBe("bˈinte e uŋ"); // vinte e un (⟨v⟩→b, final n→ŋ)
        expect(gl.text("35").trim()).toBe("tɾˈinta e θˈiŋko"); // trinta e cinco
        expect(gl.text("100").trim()).toBe("θˈeŋ"); // cen
        expect(gl.text("275").trim()).toBe("doᶷsθˈentos setˈenta e θˈiŋko"); // douscentos setenta e cinco
        expect(gl.text("1200").trim()).toBe("mˈil doᶷsθˈentos"); // mil douscentos
        expect(gl.text("3000000").trim()).toBe("tɾˈes miʎˈoŋs"); // tres millóns (-ns velarized)
        expect(gl.text("2000000000").trim()).toBe("dˈoᶷs mˈil miʎˈoŋs"); // 10⁹ = dous mil millóns (long scale)
    });

    test("clause assembly", () => {
        expect(gl.text("Bo día, Galicia!").trim()).toBe("bˈo dˈia , ɡalˈiθja !");
    });
});
