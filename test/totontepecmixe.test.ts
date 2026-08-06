import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/totontepecmixe/totontepecmixe.ts";
import { numberToWords } from "../src/languages/totontepecmixe/numbers.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Totontepec Mixe / ayöök (mto) — Mixe-Zoquean (the fleet's FIRST), the modern SIL
// orthography. AUTHORED from Crawford, *Totontepec Mixe Phonotagmemics* (SIL 1963). The consonants + allophony are
// Crawford-grounded (the allophony goldens below reproduce his exact transcriptions, e.g. mpahk→[mbahk],
// cingavus→[tsingavus]); the vowel-orthography mapping is reconstructed from his example words.
describe("Totontepec Mixe (ayöök) canonical IPA", () => {
    test("the vowel anchors (Crawford example words)", () => {
        expect(phonemizeWord("kääm")).toBe("kæːm"); // 'pig' — ⟨ä⟩=/æ/ (Crawford /kæːm/); doubled = length
        expect(phonemizeWord("këp")).toBe("kɨp"); // 'tree' — ⟨ë⟩=/ɨ/ (Crawford /kɨp/)
        expect(phonemizeWord("üts")).toBe("ʌt͡s"); // 'I' — ⟨ü⟩=/ʌ/; ⟨ts⟩=[t͡s]
        expect(phonemizeWord("ök")).toBe("ʊk"); // 'dog' — ⟨ö⟩=/ʊ/
    });

    test("consonants: ⟨ts⟩/⟨cy⟩/⟨x⟩/⟨j⟩/⟨c⟩/glottal", () => {
        expect(phonemizeWord("tsaa")).toBe("t͡saː"); // 'stone' — ⟨ts⟩=[t͡s]
        expect(phonemizeWord("caacy")).toBe("kaːt͡ʃ"); // 'tortilla' — ⟨c⟩=[k], ⟨cy⟩=[t͡ʃ] (palatalized)
        expect(phonemizeWord("tsojx")).toBe("t͡sohʃ"); // 'knife' — ⟨j⟩=[h], ⟨x⟩=[ʃ]
        expect(phonemizeWord("joꞌc")).toBe("hoʔk"); // 'owl' — ⟨j⟩=[h], saltillo ⟨ꞌ⟩=[ʔ], ⟨c⟩=[k]
    });

    test("★ the Crawford ALLOPHONY: post-nasal voicing + intervocalic ⟨d g⟩→[ð ɣ] + ⟨ny⟩→[ɲ]", () => {
        expect(phonemizeWord("cumantoc")).toBe("kumandok"); // 'nahualism' — POST-NASAL: ⟨nt⟩→[nd]
        expect(phonemizeWord("tocu̱nágu̱c")).toBe("tokunaɣuk"); // 'toad' — intervocalic ⟨g⟩→[ɣ]; the UNDERLINE + the ACUTE stress-mark are stripped (not emitted), so the vowel is read not dropped
        expect(phonemizeWord("mpahk")).toBe("mbahk"); // Crawford's own example: ⟨mp⟩→[mb] ('your bone')
        expect(phonemizeWord("nyuhm")).toBe("ɲum̥"); // ⟨ny⟩→[ɲ]; ⟨hm⟩ → the VOICELESS nasal [m̥] (Crawford §1.121)
    });

    test("registry wiring", () => {
        expect(getPhonemizer("mto").text("kääm").trim()).toBe("kæːm");
    });
});

// ---------------------------------------------------------------------------------------------------------
// Cardinal numbers. VIGESIMAL (base 20): the real bases are the four TWENTIES (ii'px 20, vu̱jxtcupx 40,
// toogupx 60, majctupx 80) and 30/50/70/90 are those plus the ten-word; everything below 100 is written
// SOLID. Crawford 1963 — this engine's g2p source — is a PHONOLOGY and has no numerals, so the numeral data
// is cited to "Of Languages and Numbers", Totontepec Mixe (variety-specific to mto), whose bibliography is
// Schoenhals & Schoenhals, *Vocabulario Mixe de Totontepec* (ILV, 1965). Attested range 1–999; see
// numbers.ts for the three disclosed gaps (the reconstructed ⟨8⟩, the hundred→remainder join, and zero).
describe("Totontepec Mixe numbers", () => {
    for (const [n, expected] of [
        [1, "to'c"],
        [7, "vuxtojtu̱c"],
        [10, "majc"],
        [11, "macto'c"],
        [15, "macmó̱cx"],
        [19, "mactaxtojt"],
        [20, "ii'px"],
        [21, "ii'pxto'c"],                       // attested: score + unit, written solid, no linker
        [30, "ii'pxmajc"],                       // 20 + 10 — no ⟨u̱c⟩ after ii'px
        [35, "ii'pxmacmó̱cx"],                    // attested
        [40, "vu̱jxtcupx"],
        [50, "vu̱jxtcupxu̱cmajc"],                  // the ⟨u̱c⟩ linker appears from 40 up
        [60, "toogupx"],
        [62, "toogupxme̱jtsc"],                   // attested: no linker before a bare unit
        [80, "majctupx"],
        [90, "majctupxu̱cmajc"],
        [96, "majctupxu̱cmactojt"],                // attested
        [99, "majctupxu̱cmactaxtojt"],
        [100, "mó̱cupx"],                         // bare — no multiplier
        [101, "mó̱cupx to'c"],
        [200, "me̱jtsc mó̱cupx"],
        [555, "mugo̱o̱xc mó̱cupx vu̱jxtcupxu̱cmacmó̱cx"],
        [999, "taxtojtu̱c mó̱cupx majctupxu̱cmactaxtojt"], // top of the attested range
    ] as const) {
        test(`${n} → ${expected}`, () => expect(numberToWords(n)).toBe(expected));
    }

    test("no gaps or sentinels across 0..999", () => {
        for (let n = 0; n <= 999; n++) expect(numberToWords(n), `n=${n}`).not.toMatch(/undefined|NaN|[0-9]/);
    });

    // The source states outright that only 1–999 can be counted accurately; there is NO attested thousand,
    // so ≥ 1000 reads digit-by-digit. ⟨sero⟩ (Spanish *cero*) is a disclosed loan stopgap — Totontepec Mixe
    // has no attested numeral for zero.
    test("above the attested range → digit-by-digit, and the zero stopgap", () => {
        expect(numberToWords(0)).toBe("sero");
        expect(numberToWords(1000)).toBe("to'c sero sero sero");
    });

    test("end-to-end: the numeral is phonemized, not passed through as digits", () => {
        expect(phonemize("21", "mto")).toBe("iːʔpʃtoʔk"); // ii'pxto'c
        expect(phonemize("100", "mto")).toBe("mokupʃ"); // mó̱cupx — the underline/acute are stripped by the g2p
    });
});
