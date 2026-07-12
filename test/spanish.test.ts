import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Spanish (es) — broad Castilian, rule-based (no lexicon). Convention: distinción
// (θ), lleísmo (ʎ / ʝ), spirantization (β ð ɣ), rr/r trill/tap, j/ge/gi → x, glides j/w (onset) & ᶦ/ᶷ
// (offglide). Validated vs the espeak 1.52 shim (93.5% folded) + epitran spa-Latn (95.8% dialect-folded);
// vowel laxing (e→ɛ), nasal place assimilation, and secondary stress are folded to broad, matching referees.
describe("spanish canonical IPA", () => {
  test("core g2p: distinción, lleísmo, j→x, spirantization", () => {
    expect(phonemize("llave", "es")).toBe("ʎˈaβe");      // ll → ʎ, intervocalic b → β
    expect(phonemize("cielo", "es")).toBe("θjˈelo");     // c before e → θ, onglide j
    expect(phonemize("zapato", "es")).toBe("θapˈato");   // z → θ
    expect(phonemize("gente", "es")).toBe("xˈente");     // g before e → x
    expect(phonemize("agua", "es")).toBe("ˈaɣwa");       // intervocalic g → ɣ, onglide w
    expect(phonemize("verbo", "es")).toBe("bˈeɾβo");     // word-initial b stop, intervocalic b → β
  });

  test("trill vs tap, digraphs, glides", () => {
    expect(phonemize("perro", "es")).toBe("pˈero");      // rr → r (trill)
    expect(phonemize("pero", "es")).toBe("pˈeɾo");       // intervocalic r → ɾ (tap)
    expect(phonemize("rojo", "es")).toBe("rˈoxo");       // word-initial r → trill, j → x
    expect(phonemize("chico", "es")).toBe("t͡ʃˈiko");     // ch → t͡ʃ
    expect(phonemize("muy", "es")).toBe("mˈuᶦ");         // final y → offglide ᶦ
    expect(phonemize("año", "es")).toBe("ˈaɲo");         // ñ → ɲ
  });

  test("stress: written accent, penult/final rule", () => {
    expect(phonemize("España", "es")).toBe("espˈaɲa");   // ends in vowel → penult
    expect(phonemize("español", "es")).toBe("espaɲˈol"); // ends in consonant → final
    expect(phonemize("estás", "es")).toBe("estˈas");     // written accent overrides
    expect(phonemize("hola", "es")).toBe("ˈola");        // h silent
  });

  test("numbers → words → g2p", () => {
    expect(phonemize("100", "es")).toBe("θjˈen");                    // cien
    expect(phonemize("101", "es")).toBe("θjˈento ˈuno");             // ciento uno
    expect(phonemize("1500", "es")).toBe("mˈil kinjˈentos");         // mil quinientos
    expect(phonemize("2000000", "es")).toBe("dˈos miʎˈones");        // dos millones
    expect(phonemize("31", "es")).toBe("tɾˈeᶦnta i ˈuno");           // treinta y uno
  });

  test("text: punctuation → pause, ¿¡ silent, function words de-accented", () => {
    expect(phonemize("Hola, ¿cómo estás?", "es")).toBe("ˈola , kˈomo estˈas ?");
    expect(phonemize("Me llamo Juan.", "es")).toBe("me ʎˈamo xwˈan .");   // 'me' clitic de-accented
    expect(phonemize("el gato", "es")).toBe("el ɡˈato");                  // 'el' article de-accented
  });

  // Regression tests for review-caught defects.
  test("uppercase words ending in n/s stress the penult (case-insensitive rule)", () => {
    expect(phonemize("EXAMEN", "es")).toBe("eksˈamen");
    expect(phonemize("CRISIS", "es")).toBe("kɾˈisis");
  });

  test("a clause-final period/comma glued to a number stays a pause", () => {
    expect(phonemize("Son 100.", "es")).toBe("sˈon θjˈen .");
  });

  test("Spanish decimal comma reads 'coma'; oversized numbers never empty", () => {
    expect(phonemize("3,14", "es")).toBe("tɾˈes kˈoma ˈuno kwˈatɾo"); // comma = decimal
    expect(phonemize("1.500", "es")).toBe("mˈil kinjˈentos");         // dot = thousands
    expect(phonemize("1000000000000", "es")).toBe("un biʎˈon");       // 10¹² → un billón (was empty)
  });

  test("qu before a/o keeps /w/; word-initial x is /s/", () => {
    expect(phonemize("quark", "es")).toBe("kwˈaɾk");   // qua → kw (not que/qui, which silence u)
    expect(phonemize("queso", "es")).toBe("kˈeso");    // que → k (u silent)
    expect(phonemize("xenón", "es")).toBe("senˈon");   // word-initial x → s
    expect(phonemize("examen", "es")).toBe("eksˈamen"); // non-initial x → ks
  });
});
