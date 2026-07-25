import { describe, expect, test } from "vitest";

import { phonemizeWord, createLuo } from "../src/languages/luo/luo.ts";

// Canonical-IPA goldens for Luo / Dholuo (luo) — Western Nilotic (Luo group), Latin orthography, spoken around Lake
// Victoria in Kenya + Tanzania (~4–5M). The FIRST Nilotic language in the repo. Hand-adjudicated against the 17-word
// en.wiktionary Luo IPA referee (the only source; single-source 🔷) + Tucker (1994) 'A Grammar of Kenya Luo'. The
// greedy g2p scores 100% folded (17/17) vs the referee (tools/referee-eval) — the folds strip tone + ±ATR (both
// UNWRITTEN), the one-palatal notation, aspiration, and the tap/glide notation. Signatures: the DENTAL vs ALVEOLAR
// contrast (⟨th dh⟩=θ ð vs ⟨t d⟩=t d); PRENASALIZED voiced stops (⟨mb⟩=ᵐb, ⟨nd⟩=ⁿd, ⟨nj⟩=ⁿd͡ʒ, ⟨ng⟩=ᵑɡ); ⟨ng'⟩=ŋ,
// ⟨ny⟩=ɲ; the palatals ⟨ch⟩=t͡ʃ, ⟨j⟩=d͡ʒ; the high-vowel glide (⟨i u⟩+V → j/w). The 9-vowel ±ATR distinction and
// register TONE (H/L) are UNWRITTEN → emitted at a +ATR/toneless default. See
// docs/investigations/luo_native_bringup_investigation.md.
describe("Luo (Dholuo) canonical IPA — greedy g2p (Nilotic: dental contrast + prenasalization)", () => {
    test("DENTAL vs ALVEOLAR: ⟨th dh⟩=θ ð (dental) vs ⟨t d⟩=t d (alveolar)", () => {
        expect(phonemizeWord("dhano")).toBe("ðano"); // "person" — ⟨dh⟩→ð (dental fricative)
        expect(phonemizeWord("thum")).toBe("θum"); // "music/instrument" — ⟨th⟩→θ (dental fricative)
        expect(phonemizeWord("adek")).toBe("adek"); // "three" — ⟨d⟩→d, ⟨k⟩→k (plain alveolar/velar)
        expect(phonemizeWord("kidi")).toBe("kidi"); // "stone" — ⟨d⟩→d alveolar (not dental)
    });

    test("PALATALS + velar nasal: ⟨ch⟩=t͡ʃ, ⟨ny⟩=ɲ, ⟨ng'⟩=ŋ, ⟨y⟩=j", () => {
        expect(phonemizeWord("rech")).toBe("ɾet͡ʃ"); // "fish" — ⟨ch⟩→t͡ʃ, ⟨r⟩→ɾ
        expect(phonemizeWord("wich")).toBe("wit͡ʃ"); // "head"
        expect(phonemizeWord("nyang'")).toBe("ɲaŋ"); // "crocodile" — ⟨ny⟩→ɲ, ⟨ng'⟩→ŋ
        expect(phonemizeWord("ng'ato")).toBe("ŋato"); // "someone" — word-initial ⟨ng'⟩→ŋ
        expect(phonemizeWord("nyaroya")).toBe("ɲaɾoja"); // ⟨y⟩→j
    });

    test("PRENASALIZED voiced stops as single units: ⟨mb nd nj ng⟩", () => {
        expect(phonemizeWord("ndalo")).toBe("ⁿdalo"); // "time/days" — ⟨nd⟩→ⁿd
        expect(phonemizeWord("mbaka")).toBe("ᵐbaka"); // ⟨mb⟩→ᵐb
        expect(phonemizeWord("ngano")).toBe("ᵑɡano"); // "story" — ⟨ng⟩→ᵑɡ (prenasalized, vs ⟨ng'⟩→ŋ)
    });

    test("⟨i⟩+{a,e} GLIDE only (conservative — ⟨u⟩+V + ⟨i⟩+high left as hiatus)", () => {
        expect(phonemizeWord("dhiang'")).toBe("ðjaŋ"); // "cow" — ⟨i⟩+a → j glide, after dental ð
        expect(phonemizeWord("chíeng'")).toBe("t͡ʃjeŋ"); // "sun/day" — ⟨i⟩+e → j (tone-marked citation → base)
        expect(phonemizeWord("dholuo")).toBe("ðoluo"); // the endonym — ⟨u⟩+o is HIATUS (/ðoluo/), NOT glided to ðolwo
        expect(phonemizeWord("guok")).toBe("ɡuok"); // "dog" — ⟨u⟩+o kept as a vowel sequence (no ⟨u⟩→w glide)
    });

    test("+ATR/toneless default (ATR + tone unwritten); ⟨ng'⟩ apostrophe robust to ' / ’ / ʼ", () => {
        expect(phonemizeWord("kelo")).toBe("kelo"); // ⟨e⟩,⟨o⟩ emitted +ATR by default (referee kɛlɔ, folded)
        expect(phonemizeWord("kuno")).toBe("kuno"); // ⟨u⟩,⟨o⟩ +ATR default (referee kʊnɔ, folded)
        // ang'o "what" — the ⟨ng'⟩ digraph resolves to ŋ for ASCII ', ’ (U+2019), and ʼ (U+02BC, the letter apostrophe)
        expect(phonemizeWord("ang'o")).toBe("aŋo");
        expect(phonemizeWord("ang’o")).toBe("aŋo");
        expect(phonemizeWord("angʼo")).toBe("aŋo");
    });

    test("text: words + clause punctuation; numbers deferred", () => {
        expect(createLuo().text("Dhano gi rech.")).toBe("ðano ɡi ɾet͡ʃ  . ");
        expect(createLuo().text("Adek 3.")).toBe("adek 3  . "); // numbers deferred (digits pass through)
    });
});
