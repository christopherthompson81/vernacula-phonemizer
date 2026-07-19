import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/wolof/wolof.ts";

// Canonical-IPA goldens for Wolof / Wolof (wo) — Atlantic-Congo (Senegambian), Latin orthography, NON-tonal.
// Hand-adjudicated against kaikki Wolof (Wiktionary). The greedy g2p + gemination scores 97.1% folded vs the
// referee (tools/referee-eval, 69 words) — the folds strip stress, syllable dots, and the variable word-initial
// glottal onset. Signatures: ATR vowels (⟨e⟩=ɛ / ⟨é⟩=e, ⟨o⟩=ɔ / ⟨ó⟩=o, ⟨ë⟩=ə, ⟨à⟩=aː), DOUBLING = length /
// gemination, the palatal STOPS ⟨c⟩=c / ⟨j⟩=ɟ. Numbers and the Arabic (Wolofal) / Garay scripts are deferred.
// See docs/investigations/wo_native_bringup_investigation.md.
describe("Wolof canonical IPA — greedy g2p + gemination", () => {
    test("ATR vowels: ⟨e⟩=ɛ / ⟨é⟩=e, ⟨o⟩=ɔ / ⟨ó⟩=o, ⟨ë⟩=ə", () => {
        expect(phonemizeWord("cere")).toBe("cɛrɛ"); // "couscous" — ⟨e⟩ → ɛ
        expect(phonemizeWord("jigéen")).toBe("ɟiɡeːn"); // "woman" — ⟨é⟩ → e, ⟨ée⟩ → eː (long)
        expect(phonemizeWord("gox")).toBe("ɡɔx"); // "neighbourhood" — ⟨o⟩ → ɔ
        expect(phonemizeWord("góor")).toBe("ɡoːr"); // "man" — ⟨ó⟩ → o, ⟨óo⟩ → oː (long)
        expect(phonemizeWord("kër")).toBe("kər"); // "house" — ⟨ë⟩ → ə
    });

    test("palatal STOPS ⟨c⟩=c, ⟨j⟩=ɟ; dorsals ⟨x⟩=x; ⟨ñ⟩=ɲ", () => {
        expect(phonemizeWord("baaxoñ")).toBe("baːxɔɲ"); // ⟨aa⟩→aː (long), ⟨x⟩→x, ⟨ñ⟩→ɲ
        expect(phonemizeWord("ndox")).toBe("ndɔx"); // "water" — ⟨nd⟩ + ⟨x⟩
        expect(phonemizeWord("ñuul")).toBe("ɲuːl"); // "black" — ⟨ñ⟩→ɲ, ⟨uu⟩→uː
    });

    test("CONSONANT GEMINATION (doubled → Cː) and nasal assimilation (⟨n⟩→ŋ before g/k)", () => {
        expect(phonemizeWord("benn")).toBe("bɛnː"); // "one" — ⟨nn⟩ → nː
        expect(phonemizeWord("làkk")).toBe("laːkː"); // "language" — ⟨à⟩→aː + ⟨kk⟩→kː
        expect(phonemizeWord("dëjj")).toBe("dəɟː"); // ⟨jj⟩ → ɟː
        expect(phonemizeWord("Angale")).toBe("aŋɡalɛ"); // "English" — ⟨ng⟩ → ŋɡ (nasal assimilation)
    });

    test("long vowels + a common word", () => {
        expect(phonemizeWord("weex")).toBe("wɛːx"); // "white" — ⟨ee⟩ → ɛː
    });
});
