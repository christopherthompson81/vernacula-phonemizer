import { describe, expect, test } from "vitest";

import { phonemizeWord, createLuo } from "../src/languages/luo/luo.ts";
import { numberToWords } from "../src/languages/luo/numbers.ts";

// Canonical-IPA goldens for Luo / Dholuo (luo) — Western Nilotic (Luo group), Latin orthography, spoken around Lake
// Victoria in Kenya + Tanzania (~4–5M). The FIRST Nilotic language in the repo. Hand-adjudicated against the 17-word
// en.wiktionary Luo IPA referee (the only source; single-source ) + Tucker (1994) 'A Grammar of Kenya Luo'. The
// greedy g2p scores 100% folded (17/17) vs the referee (tools/referee-eval) — the folds strip tone + ±ATR (both
// UNWRITTEN), the one-palatal notation, aspiration, and the tap/glide notation. Signatures: the DENTAL vs ALVEOLAR
// contrast (⟨th dh⟩=θ ð vs ⟨t d⟩=t d); PRENASALIZED voiced stops (⟨mb⟩=ᵐb, ⟨nd⟩=ⁿd, ⟨nj⟩=ⁿd͡ʒ, ⟨ng⟩=ᵑɡ); ⟨ng'⟩=ŋ,
// ⟨ny⟩=ɲ; the palatals ⟨ch⟩=t͡ʃ, ⟨j⟩=d͡ʒ; the high-vowel glide (⟨i u⟩+V → j/w). The 9-vowel ±ATR distinction and
// register TONE (H/L) are UNWRITTEN → emitted at a +ATR/toneless default.
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

    test("text: words + clause punctuation; numbers spoken", () => {
        expect(createLuo().text("Dhano gi rech.")).toBe("ðano ɡi ɾet͡ʃ .");
        expect(createLuo().text("Adek 3.")).toBe("adek adek ."); // the digit is now read as adek
    });

    // NUMBERS — DECIMAL. Bespoke for one reason the data schema cannot carry: the coordinator gi 'and' ELIDES
    // before a vowel-initial word and every Dholuo unit is vowel-initial, so gi is written SOLID with the unit
    // (apar + gi + achiel → apar gachiel) but stays free before the consonant-initial magnitude words
    // (mia ariyo gi piero adek). Not quinary in the living system — 6 auchiel is a frozen 5+1 beside achiel 1,
    // but 7–9 are opaque. 1000+ uses the everyday BORROWED elfu/milion/bilion rather than the older gana/tara.
    // Sources: Omniglot "Numbers in Dholuo", learndholuo.com. See src/languages/luo/numbers.ts.
    test("numbers: units, apar/piero tens, and the gi → g- elision", () => {
        expect(numberToWords(0)).toBe("nono");
        expect(numberToWords(7)).toBe("abiriyo");
        expect(numberToWords(10)).toBe("apar");
        expect(numberToWords(11)).toBe("apar gachiel"); // gi + achiel → gachiel (elided)
        expect(numberToWords(20)).toBe("piero ariyo"); // the multiplier FOLLOWS piero
        expect(numberToWords(21)).toBe("piero ariyo gachiel");
        expect(numberToWords(42)).toBe("piero ang'wen gariyo");
        expect(numberToWords(99)).toBe("piero ochiko gochiko");
    });

    test("numbers: mia hundreds, elfu thousands, milion/bilion (gi stays free before a consonant)", () => {
        expect(numberToWords(100)).toBe("mia achiel");
        expect(numberToWords(101)).toBe("mia achiel gachiel");
        expect(numberToWords(555)).toBe("mia abich gi piero abich gabich"); // gi + piero → free gi
        expect(numberToWords(1000)).toBe("elfu achiel");
        expect(numberToWords(12345)).toBe("elfu apar gariyo gi mia adek gi piero ang'wen gabich");
        expect(numberToWords(1_000_000)).toBe("milion achiel");
        expect(numberToWords(1_000_000_000)).toBe("bilion achiel");
    });

    test("numbers: end-to-end through the g2p (text path)", () => {
        expect(createLuo().text("20")).toBe("pjeɾo aɾijo"); // the ⟨i⟩+V glide applies inside the numerals too
        expect(createLuo().text("4")).toBe("aŋwen"); // ⟨ng'⟩ → ŋ
    });
});
