import { describe, expect, test } from "vitest";

import { createTashelhit, phonemizeWord } from "../src/languages/tashelhit/tashelhit.ts";
import { getPhonemizer } from "../src/registry.ts";

// Tashelhit / Shilha (shi) — Taclḥit, a Berber (Amazigh) language of SW Morocco (~7–9M). A near-1:1 phonemic
// Berber-Latin → IPA converter: emphatics (dot-below) ḍ→dˤ etc., pharyngeals ḥ→ħ / ɛ→ʕ, uvulars ɣ/x→χ/q, c→ʃ;
// labialisation C+ʷ→Cʷ; gemination (doubling)→Cː. Referees: wikipron shi_latn + kaikki Tashelhit — ⚠ both
// Wiktionary, so they are not independent of each other.
describe("Tashelhit (Shilha) canonical IPA — Berber Latin → IPA converter", () => {
    const shi = createTashelhit();

    test("emphatics (pharyngealised, dot-below), pharyngeals, uvulars", () => {
        expect(phonemizeWord("aḍaṛ")).toBe("adˤarˤ"); // ⟨ḍ⟩→dˤ, ⟨ṛ⟩→rˤ ("foot/leg")
        expect(phonemizeWord("Taclḥit")).toBe("taʃlħit"); // ⟨c⟩→ʃ, ⟨ḥ⟩→ħ (the endonym)
        expect(phonemizeWord("amaziɣ")).toBe("amaziɣ"); // ⟨ɣ⟩→ɣ ("Amazigh/Berber")
        expect(phonemizeWord("aɣrum")).toBe("aɣrum"); // ("bread")
    });

    test("gemination (doubling) → a long consonant [Cː], incl. emphatic + labialised geminates", () => {
        expect(phonemizeWord("azz")).toBe("azː"); // ⟨zz⟩ → zː
        expect(phonemizeWord("abaṭṭaḥ")).toBe("abatˤːaħ"); // ⟨ṭṭ⟩ emphatic geminate → tˤː
        expect(phonemizeWord("aggʷrn")).toBe("aɡʷːrn"); // ⟨ggʷ⟩ labialised geminate → ɡʷː
        expect(phonemizeWord("akkʷ")).toBe("akʷː"); // ⟨kkʷ⟩ → kʷː
    });

    test("labialisation C+⟨ʷ⟩ → [Cʷ]; ⟨e⟩→schwa; ⟨y⟩→j", () => {
        expect(phonemizeWord("awal")).toBe("awal"); // ⟨w⟩→w ("word/speech")
        expect(phonemizeWord("tamdint")).toBe("tamdint"); // ("town/city")
    });

    test("clause assembly", () => {
        expect(createTashelhit().text("Taclḥit d awal amaziɣ.").replace(/\s+/g, " ").trim())
            .toBe("taʃlħit d awal amaziɣ ."); // "Tashelhit is an Amazigh language"
    });

    test("the text() path handles NFD input (combining dot-below U+0323 emphatics)", () => {
        // Regression: the tokenizer must NFC-normalize, else combining dot-below shatters the word + drops emphatics.
        const nfd = "aḍaṛ".normalize("NFD");
        expect(createTashelhit().text(nfd).trim()).toBe("adˤarˤ"); // not "ad ar"
    });

    test("Tifinagh (ⵜⵉⴼⵉⵏⴰⵖ) front-end — script auto-detected, IDENTICAL IPA to the Latin path", () => {
        // Neo-Tifinagh (Morocco's official IRCAM script) is a phonemic alphabet → same phonology, same IPA.
        expect(phonemizeWord("ⵜⴰⵛⵍⵃⵉⵜ")).toBe("taʃlħit"); // = Taclḥit (the endonym)
        expect(phonemizeWord("ⴰⴹⴰⵕ")).toBe("adˤarˤ"); // = aḍaṛ (emphatics ⴹ→dˤ, ⵕ→rˤ)
        expect(phonemizeWord("ⴰⵎⴰⵣⵉⵖ")).toBe("amaziɣ"); // = amaziɣ
        expect(phonemizeWord("ⵜⴰⵛⵍⵃⵉⵜ")).toBe(phonemizeWord("Taclḥit")); // Tifinagh ≡ Latin
        expect(createTashelhit().text("ⵜⴰⵛⵍⵃⵉⵜ ⴷ ⴰⵡⴰⵍ").trim()).toBe("taʃlħit d awal"); // mixed clause
    });

    // ═══ CARDINAL NUMBERS — MOROCCAN ARABIC loans with NATIVE Berber kept for 1–3. Tashelhit does preserve a full
    // native decade 1–10 and a native vigesimal 11–99 (Kossmann 2013:307–308), but it is recessive and even it
    // borrows at 100/1000; the Peace Corps Tashlheet Textbook (2011:37) states the rule outright: "In TashlHeet we
    // usually use Arabic numbers except for the numbers: one, two and three." Sources in numbers.ts.
    test("cardinals: native Berber 1–3, Moroccan Arabic from 4 up", () => {
        const shi = getPhonemizer("shi");
        expect(shi.text("1").trim()).toBe("jan"); // yan — NATIVE Berber (never `waḥd` standalone)
        expect(shi.text("3").trim()).toBe("kradˤ"); // kraḍ — NATIVE; the cut-off
        expect(shi.text("4").trim()).toBe("rbʕa"); // rbɛa — Arabic from here up
        expect(shi.text("11").trim()).toBe("ħdaʃ"); // ḥdac
        expect(shi.text("20").trim()).toBe("ʕʃrin"); // ɛcrin — a loan with NO native competitor at all
        // Inside a tens compound the sources give Arabic waḥd/tnayn for 1/2; 3 keeps native kraḍ because no free
        // Arabic form for 3 is attested (only bound tlt-/tlatin/tltac) and we decline to synthesize `tlata`.
        expect(shi.text("21").trim()).toBe("waħd u ʕʃrin"); // waḥd u ɛcrin — UNITS-FIRST
        expect(shi.text("33").trim()).toBe("kradˤ u tlatin"); // kraḍ u tlatin — the documented hybrid seam
        expect(shi.text("45").trim()).toBe("χmsa u rbʕin"); // xmsa u rbɛin
    });

    test("cardinals: Arabic DUAL hundreds/thousands + the count-triggered plural", () => {
        const shi = getPhonemizer("shi");
        expect(shi.text("0").trim()).toBe("sˤifr"); // ṣifr (the IRCAM neologism `amya` is NOT generated)
        expect(shi.text("100").trim()).toBe("mja"); // mya
        expect(shi.text("200").trim()).toBe("mjatajn"); // myatayn — the DUAL
        expect(shi.text("345").trim()).toBe("tlt mja u χmsa u rbʕin"); // tlt mya u xmsa u rbɛin — SHORT stem
        expect(shi.text("1000").trim()).toBe("alf"); // alf
        expect(shi.text("2000").trim()).toBe("alfajn"); // alfayn — the DUAL
        expect(shi.text("3000").trim()).toBe("tlt alaf"); // tlt alaf — 3–10 takes the PLURAL alaf
        expect(shi.text("12345").trim()).toBe("tnaʃ alf u tlt mja u χmsa u rbʕin"); // 11+ → SINGULAR alf again
        expect(shi.text("1000000").trim()).toBe("mljun"); // mlyun
    });

    test("cardinals: a tokenizer with no digit group DROPS every number", () => {
        // Arabic-Indic digits ٠-٩ are accepted too, since Moroccan text mixes them with 0-9.
        expect(getPhonemizer("shi").text("٤٥").trim()).toBe("χmsa u rbʕin");
    });
});
