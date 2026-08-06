import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/papiamento/papiamento.ts";
import { numberToWords } from "../src/languages/papiamento/numbers.ts";

// Canonical-IPA goldens for Papiamentu (pap) — an Iberian-lexified creole of the ABC islands, the Curaçao phonemic
// orthography. Signatures: coda-⟨n⟩ RETENTION — word-final ⟨n⟩→[ŋ] (+ vowel nasalization: bon→[bõŋ]), medial ⟨n⟩ kept
// [n] (kontra→[kontɾa]); the digraphs ⟨ch sh dj zj⟩→[t͡ʃ ʃ d͡ʒ ʒ]; the open-vowel letters ⟨è ò ù⟩→[ɛ ɔ ø] + the ⟨ou⟩
// diphthong [ɔu]; degemination; acute/penult stress. Referee: kaikki + Wiktionary (thin, ~20).
describe("Papiamentu (Papiamento) canonical IPA", () => {
    test("★ coda-⟨n⟩ RETENTION — word-final [ŋ] (+ nasal vowel), medial [n]", () => {
        expect(phonemizeWord("bon")).toBe("ˈbõŋ"); // 'good' — word-final ⟨n⟩ → [ŋ], vowel nasalized
        expect(phonemizeWord("federashon")).toBe("fedeɾaˈʃõŋ"); // ⟨sh⟩→[ʃ]; final -on → [õŋ]; final stress
        expect(phonemizeWord("mashin")).toBe("maˈʃĩŋ"); // final ⟨n⟩ → [ŋ]
        expect(phonemizeWord("kontra")).toBe("ˈkontɾa"); // medial coda ⟨n⟩ is KEPT [n] (not dropped) — Papiamentu retains it
        expect(phonemizeWord("Papiamentu")).toBe("papiaˈmentu"); // the endonym — medial ⟨n⟩ kept
    });

    test("★ digraphs ⟨ch sh dj⟩ + open vowels ⟨ò⟩ + the ⟨ou⟩ diphthong + degemination", () => {
        expect(phonemizeWord("dushi")).toBe("ˈduʃi"); // 'sweet/nice' — ⟨sh⟩→[ʃ]
        expect(phonemizeWord("Kòrsou")).toBe("ˈkɔɾsɔu"); // 'Curaçao' — ⟨ò⟩→[ɔ]; ⟨ou⟩→[ɔu] diphthong (one nucleus, stress first)
        expect(phonemizeWord("futbòl")).toBe("futˈbɔl"); // ⟨ò⟩→[ɔ]; consonant-final → ultimate stress
        expect(phonemizeWord("amigu")).toBe("aˈmiɡu"); // intervocalic ⟨g⟩→[ɡ]; penult
    });

    test("stress: acute-marked overrides, else penult / final", () => {
        expect(phonemizeWord("abolí")).toBe("aboˈli"); // acute ⟨í⟩ → final stress
        expect(phonemizeWord("dia")).toBe("ˈdia"); // penult (hiatus, not a diphthong)
        expect(phonemizeWord("kas")).toBe("ˈkas"); // 'house' — consonant-final
        expect(phonemizeWord("hende")).toBe("ˈhende"); // 'person' — medial ⟨n⟩ kept [n]
    });

    // NUMBERS — everything below 1000 is ONE orthographic word: the tens change final ⟨-a⟩ → ⟨-i⟩ before a unit
    // (trinta → trintiun) and a hundred links to its remainder through the fused ⟨-ti-⟩ (shen → shentiun). The
    // -i- is the additive conjunction ⟨i⟩. Sources: Wiktionary pap numerals + palabricks (papiamento/numbers.ts).
    test("numbers: units, the ⟨-a⟩→⟨-i⟩ tens, the fused hundreds, thousands, millions", () => {
        expect(numberToWords(7)).toBe("shete");
        expect(numberToWords(16)).toBe("dieseis"); // haplology: one ⟨s⟩ (not *diesseis)
        expect(numberToWords(21)).toBe("bintiun"); // binti already ends in -i
        expect(numberToWords(31)).toBe("trintiun"); // ★ trinta → trinti + un, one word
        expect(numberToWords(42)).toBe("kuarentidos");
        expect(numberToWords(101)).toBe("shentiun"); // ★ the fused ⟨-ti-⟩ hundred link
        expect(numberToWords(555)).toBe("sinkushentisinkuentisinku");
        expect(numberToWords(12345)).toBe("diesdos mil i treshentikuarentisinku");
        expect(numberToWords(1000000)).toBe("un mion");
        expect(numberToWords(1000000000)).toBe("mil mion"); // a thousand million (no invented lexeme)
    });

    test("numbers read through the g2p (one word → ONE stress, and the coda-⟨n⟩ rule)", () => {
        expect(phonemizeWord(numberToWords(101))).toBe("ʃentiˈũŋ"); // final ⟨n⟩ → nasal vowel + [ŋ]
        expect(phonemizeWord(numberToWords(100))).toBe("ˈʃẽŋ"); // shen
        expect(phonemizeWord(numberToWords(42))).toBe("kuaɾentiˈdos"); // a single accent, not four
    });
});
