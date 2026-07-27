import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/shan/shan.ts";

// Canonical-IPA goldens for Shan / Tai Long (shn) — လိၵ်ႈတႆး, Southwestern Tai (Tai-Kadai), the SHAN ABUGIDA (a
// Myanmar-script variant), TONAL, the fleet's first Shan. A per-syllable scan: onset → medials → rime (vowel signs ×
// coda) → EXPLICIT tone (unmarked→˨˦, ႇ→˩, ႈ→˧˧˨, visarga း→˥, ႉ→˦˨). Signatures: aspirated ⟨သ⟩→[sʰ], glottal-onset
// ⟨ဢ⟩→[ʔ]; ⟨ူ⟩→[o] closed / [uː] open; medial ⟨ွ⟩ ROUNDS the inherent rime to [ɔ]; ⟨ိူ⟩→[ɤ], ⟨ို⟩→[ɯ]; the ⟨ႂ⟩ coda
// →[ɰ]; palatalisation ⟨ၵျ⟩→[d͡ʑ]. Referee: wikipron shn_mymr_broad (2607 human). See docs/investigations/shn_native_bringup_investigation.md.
describe("Shan (Tai Long) canonical IPA", () => {
    test("onsets, tones, and the endonym", () => {
        expect(phonemizeWord("တႆး")).toBe("taj˥"); // 'Tai/Shan' — ⟨ႆ⟩ final-y→[j], visarga း→˥ (high)
        expect(phonemizeWord("ၼမ်ႉ")).toBe("nam˦˨"); // 'water' — ⟨ၼ⟩→n, ⟨မ⟩ coda→m, ⟨ႉ⟩→˦˨ (tone 5)
        expect(phonemizeWord("ၵိၼ်")).toBe("kin˨˦"); // 'eat' — ⟨ၵ⟩→k, unmarked→˨˦ (rising)
        expect(phonemizeWord("ၽႃႇ")).toBe("pʰaː˩"); // ⟨ၽ⟩→pʰ, ⟨ႃ⟩→aː, ⟨ႇ⟩→˩ (low)
    });

    test("⟨ၢ⟩ and ⟨ႃ⟩ are BOTH long [aː]; short [a] is the inherent (sign-less) vowel", () => {
        expect(phonemizeWord("ၵၢၼ်")).toBe("kaːn˨˦"); // 'work' — closed-syllable ⟨ၢ⟩ → long [aː]
        expect(phonemizeWord("တၢင်း")).toBe("taːŋ˥"); // 'way' — ⟨ၢ⟩ → [aː]
        expect(phonemizeWord("တတ်း")).toBe("tat̚˥"); // inherent (no sign) → SHORT [a], checked coda ⟨တ⟩→[t̚]
    });

    test("the ⟨ူ⟩ o/uː split, medial-⟨ွ⟩ rounding, aspirated ⟨သ⟩", () => {
        expect(phonemizeWord("ၵူၼ်း")).toBe("kon˥"); // 'person' — ⟨ူ⟩ before a coda → [o]
        expect(phonemizeWord("ၵွင်")).toBe("kɔŋ˨˦"); // medial ⟨ွ⟩ + inherent → ROUNDED [ɔ] (no -w- glide)
        expect(phonemizeWord("သွင်")).toBe("sʰɔŋ˨˦"); // 'two' — aspirated ⟨သ⟩→[sʰ] + ⟨ွ⟩ rounding
    });

    test("diphthong rimes ⟨ိူ ို⟩, the ⟨ႂ⟩ coda, palatalisation, and ⟨ေႃ⟩", () => {
        expect(phonemizeWord("မိူင်း")).toBe("mɤŋ˥"); // 'country' (möng) — ⟨ိူ⟩→[ɤ] before a coda
        expect(phonemizeWord("ႁိူၼ်း")).toBe("hɤn˥"); // 'house' — ⟨ိူ⟩→[ɤ], ⟨ႁ⟩→h
        expect(phonemizeWord("ၶိုၵ်ႉ")).toBe("kʰɯk̚˦˨"); // ⟨ို⟩→[ɯ] short before a checked coda ⟨ၵ⟩→[k̚]
        expect(phonemizeWord("ၸႂ်")).toBe("t͡ɕaɰ˨˦"); // 'heart/mind' — ⟨ႂ⟩ coda → [ɰ] offglide
        expect(phonemizeWord("ၵျေႃး")).toBe("d͡ʑɔː˥"); // palatalised ⟨ၵျ⟩→[d͡ʑ] + ⟨ေႃ⟩→[ɔː]
    });
});
