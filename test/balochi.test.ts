import { describe, expect, test } from "vitest";

import { phonemizeWord, phonemizeArabic, phonemizeRoman } from "../src/languages/balochi/balochi.ts";

// Canonical-IPA goldens for Balochi / بلوچی (bal) — Southern Balochi, CROSS-SCRIPT (Arabic + Roman). Authored from
// Jahani & Korn (2009) + Korn (2005a); the cross-script lexicon is corroborated by ASJP Southern-Balochi (an
// INDEPENDENT transcriber) at ~97% on the overlapping core vocabulary. The Balochi Arabic abjad under-encodes vowels
// (short /a i u/ unwritten + ⟨و⟩/⟨ی⟩ conflate uː/oː, iː/eː); the cross-script lexicon recovers the full vowels the
// abjad loses, and the Roman orthography is phonemic.
describe("Balochi (Southern) — cross-script canonical IPA", () => {
    test("cross-script LEXICON recovers the vowels the abjad loses (Arabic input → full IPA)", () => {
        expect(phonemizeWord("خاموش")).toBe("xaːmoːʃ"); // "quiet" — abjad skeleton was xaːmuːʃ (و→uː); lexicon restores oː
        expect(phonemizeWord("گریب")).toBe("ɡariːb"); // "poor" — skeleton ɡriːb; lexicon restores the short a
        expect(phonemizeWord("روچ")).toBe("roːt͡ʃ"); // "day" — skeleton ruːt͡ʃ; lexicon restores oː
        expect(phonemizeWord("ڈاکٹر")).toBe("ɖaːkʈar"); // "doctor" — retroflex ɖ ʈ; short a restored
    });

    test("Roman orthography is phonemic → full IPA directly (matres/macrons)", () => {
        expect(phonemizeWord("balōč")).toBe("baloːt͡ʃ"); // ō→oː, č→t͡ʃ (Korn)
        expect(phonemizeWord("gwāt")).toBe("ɡwaːt̪"); // "wind" — dental t̪
        expect(phonemizeWord("dast")).toBe("d̪ast̪"); // "hand" — dental d̪ t̪ (ASJP-corroborated)
        expect(phonemizeRoman("ḍākṭar")).toBe("ɖaːkʈar"); // retroflex ḍ→ɖ, ṭ→ʈ
    });

    test("the SIGNATURE retroflex ٹ→ʈ, ڈ→ɖ vs dental ت→t̪, د→d̪ (via the shared inventory)", () => {
        expect(phonemizeWord("چار")).toBe("t͡ʃaːr"); // "four" — چ→t͡ʃ (lexicon)
        expect(phonemizeRoman("čār")).toBe("t͡ʃaːr");
        expect(phonemizeArabic("کتاب")).toBe("kt̪aːb"); // the raw Arabic SKELETON (OOV path): dental t̪, short i unwritten
    });

    test("Arabic OOV falls back to the defective skeleton (honest ⛔ tail)", () => {
        expect(phonemizeArabic("بلوچستان")).toBe("bluːt͡ʃst̪aːn"); // not in lexicon → skeleton (short vowels gone)
    });
});
