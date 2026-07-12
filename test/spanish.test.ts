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
});
