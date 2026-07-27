import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/kiche/kiche.ts";

// Canonical-IPA goldens for K'iche' (quc) — Qatzijob'al, the largest MAYAN language (Guatemala), Latin (ALMG). The
// fleet's first Mayan family. The hallmark is the EJECTIVE/glottalized series ⟨b'⟩→[ɓ], ⟨k'⟩→[kʼ], ⟨q'⟩→[qʼ],
// ⟨ch'⟩→[t͡ʃʼ], ⟨tz'⟩→[t͡sʼ], ⟨t'⟩→[tʼ] — CONTRASTING with the aspirated plain stops ⟨k⟩→[kʰ], ⟨ch⟩→[t͡ʃʰ], ⟨q⟩→[qʰ],
// ⟨t⟩→[tʰ], ⟨tz⟩→[t͡sʰ]; ⟨x⟩→[ʃ], ⟨j⟩→[x], ⟨w⟩→[ʋ], ⟨r⟩→[ɻ], ⟨'⟩→[ʔ], ⟨ä⟩→[a]. Vowel length is UNWRITTEN (not emitted);
// final stress. Referee: English Wiktionary (127, 🔷 single-source). See docs/investigations/quc_native_bringup_investigation.md.
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
