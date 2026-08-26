import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { createMaithili, phonemizeWord } from "../src/languages/maithili/maithili.ts";

// Canonical-IPA goldens for Maithili / मैथिली (mai) — Eastern Indo-Aryan (Bihari group), Devanagari. Reuses the
// Hindi engine with the Maithili divergences: SHORT e/o (incl. the dedicated short-e/short-o letters ऎ/ऒ), the
// diphthongs ऐ→[əɪ] / औ→[əʊ], inherent /ə/. Maithili's signature — a cluster schwa Hindi deletes → Maithili
// reduces to ULTRASHORT [ᵊ] — is a narrow detail (folded in the eval). single-source: only referee is
// wikipron mai_deva narrow (167, human).
describe("Maithili canonical IPA", () => {
    test("short e/o — incl. the dedicated ऎ (U+090E) / ऒ (U+0912) letters", () => {
        expect(phonemizeWord("एकरा")).toBe("ˈekɾaː"); // ए short e (Hindi would be eː)
        expect(phonemizeWord("ऎकरा")).toBe("ˈekɾaː"); // ऎ = the Maithili short-e letter (was dropped before the fix)
    });

    test("diphthongs ऐ→[əɪ], औ→[əʊ] (wikipron-confirmed)", () => {
        expect(phonemizeWord("बैसब")).toBe("bˈəɪsəb"); // ऐ → əɪ (exact match to wikipron)
        expect(phonemizeWord("दौड़ब")).toBe("d̪ˈəʊɽəb"); // औ → əʊ
    });

    // ⚠ THE AVAGRAHA ⟨ऽ⟩ RETAINS the final vowel here as in Bhojpuri (schwaDeletion.retainOnAvagraha).
    // Pinned because nothing else asserted it: the flag was set with two referee forms behind it, and a
    // later re-tune of this schwa block could switch it back with no test complaining.
    // ⚠ THE LENGTH IS A KNOWN DIVERGENCE: the referee has अऽ → əː (LONG), the engine emits short ⟨ə⟩.
    // These goldens pin what the engine does, not what the referee wants — see maithili.jsonc.
    test("a word-final avagraha ⟨ऽ⟩ retains the vowel (length still short — known divergence)", () => {
        expect(phonemizeWord("अऽ")).toBe("ˈə"); // referee əː — retained, but short
        expect(phonemizeWord("अहाँलऽ")).toBe("əɦˈaː̃lə"); // referee ə ɦ ãː l əː
    });

    // ⚠ ⟨॑⟩ U+0951 IS THIS CORPUS'S SECOND SPELLING OF THE AVAGRAHA — see the block comment in maithili.ts
    // for the paired counts (कऽ×65 / क॑×9, मऽ×1 / म॑×22, …). Nothing pinned the fold before this.
    test("⟨॑⟩ U+0951 folds onto the avagraha ⟨ऽ⟩", () => {
        // The whole of the reading change, and it is one word: the corpus's only U+0951 POLYsyllable.
        expect(phonemize("अब॑", "mai")).toBe("ˈəbə");
        expect(phonemize("अबऽ", "mai")).toBe("ˈəbə");
        expect(phonemize("अब", "mai")).toBe("ˈəb"); // the adversarial neighbour: no mark, no retention
        // On a MONOSYLLABLE `retainInMonosyllable` already keeps the vowel, so the two spellings agree
        // whether or not the fold runs — 44 of the artifact's 45 occurrences are this shape.
        for (const [udatta, avagraha] of [["क॑", "कऽ"], ["म॑", "मऽ"], ["स॑", "सऽ"], ["न॑", "नऽ"], ["ल॑", "लऽ"]]) {
            expect(phonemize(udatta, "mai")).toBe(phonemize(avagraha, "mai"));
        }
        // ⚠ AND THE EVAL PATH TOO. `word()` does not run the normalizer, so `phonemizeWord` needs its own
        // fold or the referee scores a different engine from the shipped one.
        expect(phonemizeWord("अब॑")).toBe("ˈəbə");
        expect(phonemizeWord("करल॑")).toBe(phonemizeWord("करलऽ"));
        // …and on the PUBLIC engine, not only on this module's convenience wrapper.
        const e = createMaithili() as unknown as { word(w: string): string; wordRules(w: string): string };
        expect(e.word("अब॑")).toBe("ˈəbə");
        expect(e.wordRules("अब॑")).toBe("ˈəbə");
    });

    // ⚠ Hindi does NOT fold U+0951 — the mark is Maithili data, and this pins that the sibling engine is
    // untouched by it. (It also pins that the shared word class SPANS U+0951: `म॑थिली` is ONE word.)
    test("the fold is Maithili's alone, and the mark is inside the shared Devanagari word class", () => {
        expect(phonemize("अब॑", "hi")).toBe("ˈəb");
        expect(phonemize("म॑थिली", "hi")).toBe(phonemize("मथिली", "hi"));
    });

    // ⚠ A DECLARED ENTRY THE ENGINE CANNOT REACH, pinned so it is not mistaken for a working reading.
    // ⟨ꣿ⟩ U+A8FF is in Devanagari Extended, outside the shared word class `ऀ-ॣॲ-ॿ`, so it ENDS the word.
    test("⟨ꣿ⟩ U+A8FF is declared in vowelSigns but unreachable — it splits the token instead", () => {
        expect(phonemize("कꣿ", "mai")).toBe("kˈə"); // the manifest's ⟨ɛ⟩ is never emitted
        expect(phonemize("मꣿथिली", "mai")).toBe("mˈə t̪ʰˈɪliː"); // TWO words, not one
    });

    // ⚠ ₹ IS NOT SILENT, whatever `stripSymbols` suggests: mai declares no `symbolTier`, so the SHARED
    // Hindi tier claims the sign first and appends रुपये. See the note in maithili.jsonc.
    test("₹ is read by the inherited Hindi symbol tier, not stripped", () => {
        expect(phonemize("₹500", "mai")).toBe("pˈaː̃t͡ʃ sˈəʊ ɾˈʊpje");
        expect(phonemize("50%", "mai")).toBe("pət͡ʃˈaːs pɾˈət̪ɪʃət̪"); // the unconfirmed inherited word
        // ⚠ …but `stripSymbols: "₹"` is NOT thereby dead. The tier claims the sign only beside an amount,
        // so a stranded ₹ still reaches the strip and comes out silent rather than as a stray रुपये.
        expect(phonemize("₹ अछि", "mai")).toBe("ˈət͡ʃʰɪ");
        expect(phonemize("₹", "mai")).toBe("");
    });

    test("shared Indo-Aryan core (Hindi-identical where Maithili does not diverge)", () => {
        expect(phonemizeWord("मीत")).toBe("mˈiːt̪"); // 'friend'
        expect(phonemizeWord("पुस्तक")).toBe("pˈʊst̪ək"); // 'book'
        expect(phonemizeWord("गाछ")).toBe("ɡˈaːt͡ʃʰ"); // 'tree' (a characteristic Eastern-IA word; च = t͡ʃ, referee t͡ɕ)
    });
});
