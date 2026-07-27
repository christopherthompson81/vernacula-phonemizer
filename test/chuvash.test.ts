import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/chuvash/chuvash.ts";

// Canonical-IPA goldens for Chuvash (chv) — Чӑвашла, the SOLE surviving Oghur (Bulgaric) Turkic language, CYRILLIC.
// Two signatures: (1) ALLOPHONIC VOICING — the voiceless letters ⟨п т к ч с ҫ ш х⟩ voice between vowels or after a
// nasal (Chuvash has no phonemic voicing contrast), and a GEMINATE blocks it → single long [Cː]; (2) REDUCED-VOWEL
// STRESS — the reduced vowels ⟨ӑ⟩→[ə], ⟨ӗ⟩→[ɘ] cannot bear stress; it falls on the last full vowel, else the first.
// Referee: English Wiktionary 'Chuvash terms with IPA pronunciation' (84 human pairs). See docs/investigations/chv_native_bringup_investigation.md.
describe("Chuvash (Чӑвашла) canonical IPA", () => {
    test("★ HALLMARK 1 — allophonic intervocalic / post-nasal VOICING", () => {
        expect(phonemizeWord("апат")).toBe("aˈbat"); // ⟨п⟩→[b] between vowels; final ⟨т⟩ stays [t]
        expect(phonemizeWord("ача")).toBe("aˈd͡ʑa"); // ⟨ч⟩→[d͡ʑ] intervocalic
        expect(phonemizeWord("вӑкӑр")).toBe("ˈʋəɡər"); // ⟨к⟩→[ɡ] intervocalic
        expect(phonemizeWord("эпир")).toBe("eˈbir"); // ⟨п⟩→[b]
        expect(phonemizeWord("манпа")).toBe("manˈba"); // ⟨п⟩→[b] AFTER A NASAL (not just intervocalic)
        expect(phonemizeWord("чухӑнлӑх")).toBe("ˈt͡ɕuɣənləχ"); // ⟨х⟩→[ɣ] intervocalic; final ⟨х⟩ stays [χ]
        expect(phonemizeWord("вӑлсем")).toBe("ʋəlˈzem"); // ⟨с⟩→[z] after a LIQUID before a FULL vowel
        expect(phonemizeWord("чӗрпӗк")).toBe("ˈt͡ɕɘrpɘk"); // ⟨п⟩ stays [p] after a liquid before a REDUCED vowel (no voicing)
    });

    test("★ gemination BLOCKS voicing → single long voiceless [Cː]", () => {
        expect(phonemizeWord("иккӗ")).toBe("ˈikːɘ"); // ⟨кк⟩→[kː] (NOT voiced [ɡ])
        expect(phonemizeWord("саккӑр")).toBe("ˈsakːər"); // ⟨кк⟩→[kː]
    });

    test("★ HALLMARK 2 — reduced ⟨ӑ⟩→ə, ⟨ӗ⟩→ɘ never bear stress", () => {
        expect(phonemizeWord("чӑваш")).toBe("t͡ɕəˈʋaʂ"); // 'Chuvash' — stress the FULL ⟨а⟩, not the reduced ⟨ӑ⟩
        expect(phonemizeWord("сӑмах")).toBe("səˈmaχ"); // stress the last full ⟨а⟩ (⟨ӑ⟩ reduced)
        expect(phonemizeWord("вӑтӑр")).toBe("ˈʋədər"); // 'thirty' — ALL vowels reduced → stress the FIRST
        expect(phonemizeWord("мӗн")).toBe("ˈmɘn"); // ⟨ӗ⟩→[ɘ]
        expect(phonemizeWord("кӗҫнерникун")).toBe("kɘɕnerniˈɡun"); // stress the last full vowel ⟨у⟩; ⟨ӗ⟩ reduced
    });

    test("onset consonants + vowels + iotation", () => {
        expect(phonemizeWord("чул")).toBe("ˈt͡ɕul"); // ⟨ч⟩→[t͡ɕ] initial (voiceless), ⟨у⟩→[u]
        expect(phonemizeWord("хула")).toBe("χuˈla"); // ⟨х⟩→[χ] onset, ⟨л⟩→[l]
        expect(phonemizeWord("шыв")).toBe("ˈʂɯʋ"); // ⟨ш⟩→[ʂ], ⟨ы⟩→[ɯ], ⟨в⟩→[ʋ]
        expect(phonemizeWord("ҫил")).toBe("ˈɕil"); // ⟨ҫ⟩→[ɕ]
    });
});
