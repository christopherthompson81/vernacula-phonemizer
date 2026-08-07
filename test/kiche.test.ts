import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/kiche/kiche.ts";
import { numberToWords } from "../src/languages/kiche/numbers.ts";

// Canonical-IPA goldens for K'iche' (quc) — Qatzijob'al, the largest MAYAN language (Guatemala), Latin (ALMG). The
// fleet's first Mayan family. The hallmark is the EJECTIVE/glottalized series ⟨b'⟩→[ɓ], ⟨k'⟩→[kʼ], ⟨q'⟩→[qʼ],
// ⟨ch'⟩→[t͡ʃʼ], ⟨tz'⟩→[t͡sʼ], ⟨t'⟩→[tʼ] — CONTRASTING with the aspirated plain stops ⟨k⟩→[kʰ], ⟨ch⟩→[t͡ʃʰ], ⟨q⟩→[qʰ],
// ⟨t⟩→[tʰ], ⟨tz⟩→[t͡sʰ]; ⟨x⟩→[ʃ], ⟨j⟩→[x], ⟨w⟩→[ʋ], ⟨r⟩→[ɻ], ⟨'⟩→[ʔ], ⟨ä⟩→[a]. Vowel length is UNWRITTEN (not emitted);
// final stress. Referee: English Wiktionary (127, single-source).
describe("K'iche' (Qatzijob'al) canonical IPA", () => {
    test("the EJECTIVE vs ASPIRATED contrast (the Mayan hallmark)", () => {
        expect(phonemizeWord("kʼicheʼ")).toBe("kʼiˈt͡ʃʰeʔ"); // the name — EJECTIVE ⟨k'⟩→[kʼ] vs aspirated ⟨ch⟩→[t͡ʃʰ], final ⟨'⟩→[ʔ]
        expect(phonemizeWord("chʼaqabaʼ")).toBe("t͡ʃʼaqʰaˈɓaʔ"); // EJECTIVE ⟨ch'⟩→[t͡ʃʼ], ⟨b⟩→[ɓ], ⟨q⟩→[qʰ]
        expect(phonemizeWord("kej")).toBe("ˈkʰex"); // 'deer' — plain ⟨k⟩→[kʰ] aspirated, ⟨j⟩→[x]
        expect(phonemizeWord("abaʼq")).toBe("aˈɓaʔqʰ"); // ⟨b⟩→[ɓ] implosive, ⟨'⟩→[ʔ], ⟨q⟩→[qʰ] uvular
    });

    test("⟨tz⟩, ⟨x⟩, ⟨j⟩, ⟨w⟩, ⟨ä ü⟩", () => {
        expect(phonemizeWord("utz")).toBe("ˈut͡sʰ"); // 'good' — ⟨tz⟩→[t͡sʰ]
        expect(phonemizeWord("achi")).toBe("aˈt͡ʃʰi"); // 'man' — ⟨ch⟩→[t͡ʃʰ]
        expect(phonemizeWord("ixim")).toBe("iˈʃim"); // 'maize' — ⟨x⟩→[ʃ]
        expect(phonemizeWord("wuqüb")).toBe("ʋuˈqʰuɓ"); // 'seven' — ⟨w⟩→[ʋ], ⟨ü⟩→[u], ⟨b⟩→[ɓ]
        expect(phonemizeWord("abäj")).toBe("aˈɓəx"); // 'stone' — the sixth vowel ⟨ä⟩→[ə] (vs plain ⟨a⟩→[a])
        expect(phonemizeWord("dios")).toBe("diˈos"); // Spanish loan — ⟨d⟩ kept (not silently dropped)
    });
});

// ---------------------------------------------------------------------------------------------------------
// Cardinal numbers. VIGESIMAL (base 20), with the score series split across THREE bases — ⟨winaq⟩ (20, 40),
// ⟨k'al⟩ (60, then 100–380), ⟨much'⟩ (80 = jumuch'; much' is 80, NOT 400) and ⟨q'o⟩ (400). Every form here is
// verbatim from ALMG, *Gramática Normativa del Idioma K'iche'* §1.7.4 "Números cardinales", pp. 42–44.
// Composition is ADDITIVE, per ALMG's explicit norm; Classical Mayan OVERCOUNTING (which applied from 41 up)
// is deliberately NOT generated. See numbers.ts for the sourcing and the disclosures.
describe("K'iche' numbers", () => {
    for (const [n, expected] of [
        [1, "jun"],
        [7, "wuqub'"],
        [10, "lajuj"],
        [15, "jolajuj"],                 // ALMG's form (Christenson has o'lajuj)
        [19, "b'elejlajuj"],
        [20, "juwinaq"],                 // ⟨winaq⟩ 'person' = 20
        [21, "juwinaq jun"],             // additive, attested verbatim
        [40, "kawinaq"],
        [42, "kawinaq keb'"],
        [60, "oxk'al"],                  // the base switches to ⟨k'al⟩
        [61, "oxk'al jun"],
        [80, "jumuch'"],                 // ⟨much'⟩ = 80
        [81, "jumuch' jun"],
        [99, "jumuch' b'elejlajuj"],
        [100, "jok'al"],                 // NATIVE 5×20, not a Spanish loan
        [101, "jok'al jun"],
        [200, "lajk'al"],
        [380, "b'elejlajk'al"],
        [399, "b'elejlajk'al b'elejlajuj"],
        [400, "juq'o"],                  // ⟨q'o⟩ = 400
        [401, "juq'o jun"],
        [800, "kaq'o'"],
        [1000, "kaq'o' lajk'al"],        // 800 + 200 — attested
        [3999, "b'elejq'o' b'elejlajk'al b'elejlajuj"], // top of the composed range (multiplier extrapolated)
    ] as const) {
        test(`${n} → ${expected}`, () => expect(numberToWords(n)).toBe(expected));
    }

    test("no gaps or sentinels across 0..3999", () => {
        for (let n = 0; n <= 3999; n++) expect(numberToWords(n), `n=${n}`).not.toMatch(/undefined|NaN|[0-9]/);
    });

    // ≥ 4000 has NO documented K'iche' numeral (⟨juchuy⟩ 8000 is Kaqchikel), so it reads digit-by-digit.
    // ⟨majb'al⟩ for zero is a popular neologism, not ALMG-normative — flagged in numbers.ts.
    test("above the attested range → digit-by-digit", () => {
        expect(numberToWords(0)).toBe("majb'al");
        expect(numberToWords(4000)).toBe("kajib' majb'al majb'al majb'al");
    });

    test("end-to-end: the numeral is phonemized, not passed through as digits", () => {
        expect(phonemize("21", "quc")).toBe("xuʋiˈnaqʰ ˈxun"); // juwinaq jun
        expect(phonemize("100", "quc")).toBe("xoˈkʼal"); // jok'al
    });
});
