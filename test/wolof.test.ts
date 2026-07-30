import { describe, expect, test } from "vitest";

import { createWolof, phonemizeWord } from "../src/languages/wolof/wolof.ts";
import { numberToWords } from "../src/languages/wolof/numbers.ts";

// Canonical-IPA goldens for Wolof / Wolof (wo) — Atlantic-Congo (Senegambian), Latin orthography, NON-tonal.
// Hand-adjudicated against kaikki Wolof (Wiktionary). The greedy g2p + gemination scores 97.1% folded vs the
// referee (tools/referee-eval, 69 words) — the folds strip stress, syllable dots, and the variable word-initial
// glottal onset. Signatures: ATR vowels (⟨e⟩=ɛ / ⟨é⟩=e, ⟨o⟩=ɔ / ⟨ó⟩=o, ⟨ë⟩=ə, ⟨à⟩=aː), DOUBLING = length /
// gemination, the palatal STOPS ⟨c⟩=c / ⟨j⟩=ɟ. Numbers are QUINARY (see below); the Arabic (Wolofal) /
// Garay scripts are deferred.
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

    // NUMBERS — the defining Wolof feature is the QUINARY (base-5) 6–9: they are 5+n compounds on juróom
    // 'five', with no monomorphemic word for six/seven/eight/nine at all. Above ten the system is decimal but
    // MULTIPLICATIVE with the multiplier FIRST (ñaar fukk = 2×10) and the multiplier may itself be quinary
    // (juróom ñeent fukk = (5+4)×10 = 90). Sources: Kosogorova 2023 (SALC 57) §4, Wiktionary Wolof cardinals,
    // Janga Wolof. See src/languages/wolof/numbers.ts.
    test("numbers: the QUINARY 6–9 (juróom + n)", () => {
        expect(numberToWords(5)).toBe("juróom");
        expect(numberToWords(6)).toBe("juróom benn"); // 5+1
        expect(numberToWords(7)).toBe("juróom ñaar"); // 5+2
        expect(numberToWords(8)).toBe("juróom ñett"); // 5+3
        expect(numberToWords(9)).toBe("juróom ñeent"); // 5+4
    });

    test("numbers: fukk tens (multiplier first, possibly quinary) + ak compounds", () => {
        expect(numberToWords(10)).toBe("fukk");
        expect(numberToWords(15)).toBe("fukk ak juróom"); // 10 + 5
        expect(numberToWords(20)).toBe("ñaar fukk"); // 2×10
        expect(numberToWords(21)).toBe("ñaar fukk ak benn");
        expect(numberToWords(47)).toBe("ñeent fukk ak juróom ñaar"); // 4×10 + (5+2)
        expect(numberToWords(90)).toBe("juróom ñeent fukk"); // (5+4)×10 — doubly quinary
        expect(numberToWords(99)).toBe("juróom ñeent fukk ak juróom ñeent");
    });

    test("numbers: téeméer hundreds, junni thousands, milyoŋ millions", () => {
        expect(numberToWords(100)).toBe("téeméer"); // bare, no multiplier
        expect(numberToWords(101)).toBe("téeméer ak benn");
        expect(numberToWords(555)).toBe("juróom téeméer ak juróom fukk ak juróom");
        expect(numberToWords(1000)).toBe("junni");
        expect(numberToWords(12345)).toBe("fukk ak ñaar junni ak ñett téeméer ak ñeent fukk ak juróom");
        expect(numberToWords(1_000_000)).toBe("milyoŋ");
        expect(numberToWords(2_000_000)).toBe("ñaar milyoŋ");
        expect(numberToWords(1_000_000_000)).toBe("milyaar");
    });

    test("numbers: end-to-end through the g2p (text path)", () => {
        expect(createWolof().text("6")).toBe("ɟuroːm bɛnː"); // ⟨óo⟩→oː, ⟨nn⟩→nː
        expect(createWolof().text("20")).toBe("ɲaːr fukː");
    });
});
