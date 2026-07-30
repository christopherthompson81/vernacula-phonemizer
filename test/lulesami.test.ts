import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/lulesami/lulesami.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Lule Sami / julevsámegiella (smj) — Uralic (Saami branch), the 1983 Latin
// orthography. AUTHORED from Ylikoski, "Lule Saami". A TRANSPARENT SEGMENTAL scan; the complex morphophonology
// (consonant gradation, epenthetic vowels, labial harmony, unwritten length) is the deferred residual. The
// hallmark is the North-Saami-style VOICELESS ⟨b d g⟩→[p t k] (aspiration-not-voicing), ASJP-confirmed.
// First-syllable stress. See docs/investigations/smj_native_bringup_investigation.md.
describe("Lule Sami (julevsámegiella) canonical IPA", () => {
    test("★ the voiceless ⟨b d g⟩ → [p t k] trap + medial ⟨p t k⟩ stay PLAIN", () => {
        expect(phonemizeWord("bena")).toBe("ˈpenɑ"); // 'dog' — ⟨b⟩→[p] (grammar /peːnə/), NOT [b]; ⟨a⟩→[ɑ]
        expect(phonemizeWord("giella")).toBe("ˈkielːɑ"); // 'language' — ⟨g⟩→[k], ⟨ie⟩ diphthong, ⟨ll⟩→geminate
        expect(phonemizeWord("guokta")).toBe("ˈkuoktɑ"); // 'two' — ⟨g⟩→[k]; medial ⟨k t⟩ are PLAIN (not [kʰ tʰ])
        expect(phonemizeWord("tállá")).toBe("ˈtʰɑːlːɑː"); // WORD-INITIAL ⟨t⟩ = the aspirated loan stop [tʰ]
    });

    test("digraphs + diphthongs + geminates", () => {
        expect(phonemizeWord("tjoarvve")).toBe("ˈt͡ʃoɑrvːe"); // 'horn' — ⟨tj⟩→[t͡ʃ], ⟨oa⟩→[oɑ], ⟨vv⟩→[vː]
        expect(phonemizeWord("njunnje")).toBe("ˈɲuɲːe"); // 'nose' — ⟨nj⟩→[ɲ], ⟨nnj⟩→[ɲː]
        expect(phonemizeWord("biellje")).toBe("ˈpieʎːe"); // 'ear' — ⟨b⟩→[p], ⟨ie⟩, ⟨llj⟩→[ʎː] (ASJP realization of /lj/)
    });

    test("the digraph inventory + the ⟨á⟩ length contrast", () => {
        expect(phonemizeWord("sj")).toBe("ˈʃ"); // ⟨sj⟩→[ʃ]
        expect(phonemizeWord("tj")).toBe("ˈt͡ʃ"); // ⟨tj⟩→[t͡ʃ]
        expect(phonemizeWord("dtj")).toBe("ˈd͡ʒ"); // ⟨dtj⟩→[d͡ʒ] (the voiced affricate)
        expect(phonemizeWord("ddj")).toBe("ˈɟː"); // ⟨ddj⟩→[ɟː] (the geminate-only palatal stop)
        expect(phonemizeWord("á")).toBe("ˈɑː"); // ⟨á⟩ = the one written vowel-length contrast /ɑː/
    });

    test("registry wiring", () => {
        expect(getPhonemizer("smj").text("bena").trim()).toBe("ˈpenɑ");
    });

    // ═══ CARDINAL NUMBERS — native Uralic decimal, written SOLID (Finnish-style) below a million. Authored from
    // the Divvun/Giellatekno digit→text transducer for smj, whose own comments mark the branch we follow as the
    // one "for tekst-til-tale" (for text-to-speech). Sources + stem alternations in numbers.ts.
    test("★ cardinals: the lågev / -låhke / -låk and lågenan- stem alternations", () => {
        const smj = getPhonemizer("smj");
        expect(smj.text("0").trim()).toBe("ˈnolːɑ"); // nålla
        expect(smj.text("7").trim()).toBe("ˈkiet͡ʃɑv"); // gietjav — ⟨g⟩→[k], the voiceless-⟨b d g⟩ trap
        expect(smj.text("15").trim()).toBe("ˈlokenɑnvihtːɑ"); // lågenanvihtta — ATTESTED (repo testdata)
        expect(smj.text("20").trim()).toBe("ˈkuoktɑlohke"); // guoktalåhke — ×10 with NO following unit
        expect(smj.text("21").trim()).toBe("ˈkuoktɑlokɑktɑ"); // guoktalåkakta — ×10 BEFORE a unit → -låk-
        expect(smj.text("45").trim()).toBe("ˈnieʎːɑlokvihtːɑ"); // nielljalåkvihtta — ATTESTED
    });

    test("cardinals: solid hundreds/thousands; only 10⁶/10⁹ are separate words", () => {
        const smj = getPhonemizer("smj");
        expect(smj.text("100").trim()).toBe("ˈt͡ʃuohte"); // tjuohte — bare, no leading akta
        expect(smj.text("164").trim()).toBe("ˈt͡ʃuohtekuhtːɑloknieʎːɑ"); // tjuohteguhttalåkniellja — ATTESTED
        expect(smj.text("333").trim()).toBe("ˈkolmːot͡ʃuohtekolmːolokkolmːo"); // gålmmåtjuohtegålmmålåkgålmmå — ATTESTED
        expect(smj.text("1000").trim()).toBe("ˈtʰuvsɑːn"); // tuvsán (initial ⟨t⟩ is the aspirated loan stop)
        expect(smj.text("2509").trim()).toBe("ˈkuoktɑtuvsɑːnvihtːɑt͡ʃuohteɑkt͡se"); // guoktatuvsán… — ATTESTED
        // One solid word all the way through the thousands — note the teen FLIPS to unit+lågenan as a multiplier.
        expect(smj.text("12345").trim()).toBe("ˈkuoktɑlokenɑntuvsɑːnkolmːot͡ʃuohtenieʎːɑlokvihtːɑ");
        expect(smj.text("1000000").trim()).toBe("ˈmilːijovnːo"); // millijåvnnå
        expect(smj.text("1000000000").trim()).toBe("ˈmilːijɑːrtːɑ"); // millijárdda (10⁹ = milliard)
    });
});
