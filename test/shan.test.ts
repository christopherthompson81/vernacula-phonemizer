import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/shan/shan.ts";

// Canonical-IPA goldens for Shan / Tai Long (shn) — လိၵ်ႈတႆး, Southwestern Tai (Tai-Kadai), the SHAN ABUGIDA (a
// Myanmar-script variant), TONAL, the fleet's first Shan. A per-syllable scan: onset → medials → rime (vowel signs ×
// coda) → EXPLICIT tone (unmarked→˨˦, ႇ→˩, ႈ→˧˧˨, visarga း→˥, ႉ→˦˨). Signatures: aspirated ⟨သ⟩→[sʰ], glottal-onset
// ⟨ဢ⟩→[ʔ]; ⟨ူ⟩→[o] closed / [uː] open; medial ⟨ွ⟩ ROUNDS the inherent rime to [ɔ]; ⟨ိူ⟩→[ɤ], ⟨ို⟩→[ɯ]; the ⟨ႂ⟩ coda
// →[ɰ]; palatalisation ⟨ၵျ⟩→[d͡ʑ]. Referee: wikipron shn_mymr_broad (2607 human).
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

// Cardinal numbers — Shan is Southwestern Tai, so the system is structurally Thai's: 20 is သၢဝ်း (replacing the
// whole "twenty"), a final 1 in a compound is ဢဵတ်း (not ၼိုင်ႈ), tens 30–90 are unit+သိပ်း, and 10⁴/10⁵ are their
// own words (မိုၼ်ႇ / သႅၼ်). Numerals from Wiktionary "Category:Shan numerals" + Omniglot "Numbers in Shan".
// NOTE 10⁶: neither source attests a word for a million, so it composes on သႅၼ် — သိပ်းသႅၼ် (see shan.ts).
describe("Shan (shn) cardinal numbers", () => {
    for (const [n, ipa] of [
        [0, "sʰun˨˦"], // သုၼ်
        [7, "t͡ɕet̚˥"], // ၸဵတ်း
        [11, "sʰip̚˥ ʔet̚˥"], // သိပ်းဢဵတ်း — final 1 is ဢဵတ်း
        [20, "sʰaːw˥"], // သၢဝ်း — the irregular twenty (no သိပ်း)
        [21, "sʰaːw˥ ʔet̚˥"], // သၢဝ်းဢဵတ်း
        [42, "sʰiː˩ sʰip̚˥ sʰɔŋ˨˦"], // သီႇသိပ်းသွင် — unit-first decade
        [100, "nɯŋ˧˧˨ paːk̚˩"], // ၼိုင်ႈပၢၵ်ႇ
        [1000, "nɯŋ˧˧˨ heŋ˨˦"], // ၼိုင်ႈႁဵင်
        [12345, "nɯŋ˧˧˨ mɯn˩ sʰɔŋ˨˦ heŋ˨˦ sʰaːm˨˦ paːk̚˩ sʰiː˩ sʰip̚˥ haː˧˧˨"], // မိုၼ်ႇ myriad magnitude
        [1000000, "sʰip̚˥ sʰɛn˨˦"], // သိပ်းသႅၼ် — 10 × 10⁵ (no attested 10⁶ word)
    ] as const) {
        test(`${n} → ${ipa}`, () => {
            expect(phonemize(String(n), "shn")).toBe(ipa);
        });
    }
});
