import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/sesotho/sesotho.ts";

// Canonical-IPA goldens for Sesotho / Southern Sotho (st) — Bantu (Sotho-Tswana), Latin. Authored beyond any usable
// machine referee (kaikki "Sotho" = 3 IPA entries; no wikipron/epitran) from standard Sesotho phonology (Doke &
// Mofokeng); 🔷 single-source. The consonant analysis is ANCHORED by the one clean kaikki attestation
// phuputso→pʰupʼut͡sʼɔ (an EXACT match): EJECTIVE plain stops ⟨p t k⟩→[pʼ tʼ kʼ], ⟨ts⟩→[t͡sʼ], ⟨hl⟩→[ɬ], ⟨h⟩→[ɦ].
// Vowel height is unwritten → mid defaults [ɛ ɔ] (the [ʊ]/[i] raisings are a residual). Tone deferred.
// See docs/investigations/st_native_bringup_investigation.md.
describe("Sesotho canonical IPA — Sotho-Tswana rule g2p", () => {
    test("the kaikki anchor: phuputso → pʰupʼut͡sʼɔ (EXACT) — ejective + aspirate + affricate", () => {
        expect(phonemizeWord("phuputso")).toBe("pʰupʼut͡sʼɔ"); // ph→pʰ, p→pʼ (ejective), ts→t͡sʼ (ejective)
    });
    test("signatures: ⟨hl⟩→ɬ, ⟨h⟩→ɦ, ⟨kg⟩→kχ, ejective ⟨t⟩→tʼ", () => {
        expect(phonemizeWord("lehlohonolo")).toBe("lɛɬɔɦɔnɔlɔ"); // hl→ɬ (voiceless lateral fricative), h→ɦ
        expect(phonemizeWord("kgotso")).toBe("kχɔt͡sʼɔ"); // kg→kχ
        expect(phonemizeWord("ntate")).toBe("ntʼɑtʼɛ"); // ⟨t⟩→tʼ (ejective), ⟨a⟩→ɑ
    });
});
