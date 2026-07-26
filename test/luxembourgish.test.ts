import { describe, expect, test } from "vitest";

import { createLuxembourgish, phonemizeWord } from "../src/languages/luxembourgish/luxembourgish.ts";

// Luxembourgish (lb) — Lëtzebuergesch, West Germanic (Moselle Franconian), Latin script (~390k). A German-derived
// orthography (⟨w⟩→v, ⟨ch⟩→χ, initial st/sp→ʃt/ʃp) + a distinctive diphthong system + French loans. The engine is a
// greedy longest-match grapheme scan + German-style rules (stressed ⟨e⟩→æ, geminate collapse, devoicing). Validated
// against wikipron ltz_latn_broad (3893 human headwords) — 69.3% FOLDED / 92.2% symbol, with vowel LENGTH folded.
// 🔷 single-source-family. See docs/investigations/lb_native_bringup_investigation.md.
describe("Luxembourgish canonical IPA — grapheme g2p + the diphthong system + German-style rules", () => {
    const lb = createLuxembourgish();

    test("the diphthong system: ⟨ei/ai⟩→ai̯, ⟨au⟩→æu̯, ⟨ou⟩→əu̯, ⟨éi⟩→ei̯", () => {
        expect(phonemizeWord("Haus")).toBe("hæu̯s"); // ⟨au⟩ → æu̯ ("house")
        expect(phonemizeWord("Kou")).toBe("kəu̯"); // ⟨ou⟩ → əu̯ ("cow")
        expect(phonemizeWord("Dréi")).toBe("drei̯"); // ⟨éi⟩ → ei̯ ("turn")
        expect(phonemizeWord("Méi")).toBe("mei̯"); // ⟨éi⟩ → ei̯ ("more")
    });

    test("the German-style consonants: ⟨w⟩→v, ⟨ch⟩→χ, ⟨z⟩→t͡s, ⟨qu⟩→kv, ⟨é⟩ alone→eː", () => {
        expect(phonemizeWord("Waasser")).toBe("vaːsər"); // ⟨w⟩→v, ⟨aa⟩→aː ("water")
        expect(phonemizeWord("Buch")).toBe("buχ"); // ⟨ch⟩ → χ ("book")
        expect(phonemizeWord("zéng")).toBe("t͡seːŋ"); // ⟨z⟩→t͡s, ⟨é⟩ alone→eː, ⟨ng⟩→ŋ ("ten")
        expect(phonemizeWord("Quell")).toBe("kvæl"); // ⟨qu⟩→kv, ⟨e⟩→æ, ⟨ll⟩ collapse ("spring")
        expect(phonemizeWord("Been")).toBe("beːn"); // ⟨ee⟩ → eː ("leg")
    });

    test("initial ⟨st/sp⟩ → [ʃt ʃp] + single ⟨s⟩ → [z] as an onset (⟨ss⟩ stays [s])", () => {
        expect(phonemizeWord("Strooss")).toBe("ʃtroːs"); // initial st→ʃt, ⟨oo⟩→oː, ⟨ss⟩→s ("street")
        expect(phonemizeWord("Spill")).toBe("ʃpil"); // initial sp→ʃp ("game")
        expect(phonemizeWord("Sonn")).toBe("zon"); // onset ⟨s⟩→z, ⟨nn⟩ collapse ("sun")
        expect(phonemizeWord("Iesel")).toBe("iəzəl"); // ⟨ie⟩→iə, intervocalic ⟨s⟩→z ("donkey")
    });

    test("short stressed ⟨e⟩ → [æ], reduced ⟨e⟩ → [ə] (the ⟨-en⟩ ending + the ⟨ge-⟩ prefix)", () => {
        expect(phonemizeWord("Belsch")).toBe("bælʃ"); // monosyllable → stressed [æ] ("Belgium")
        expect(phonemizeWord("Decken")).toBe("dækən"); // stressed e→æ, ⟨-en⟩ ending→ə ("blankets")
        expect(phonemizeWord("Gemeng")).toBe("ɡəmæŋ"); // ⟨ge-⟩ prefix unstressed→ə, stressed e→æ ("municipality")
    });

    test("geminate collapse + devoicing (word-final, regressive, and ⟨g⟩→χ/k)", () => {
        expect(phonemizeWord("Flott")).toBe("flot"); // ⟨tt⟩ → single ("nice")
        expect(phonemizeWord("Hand")).toBe("hant"); // word-final ⟨d⟩ → t ("hand")
        expect(phonemizeWord("Abt")).toBe("apt"); // regressive: ⟨b⟩ → p before [t] ("abbot")
        expect(phonemizeWord("Dag")).toBe("daχ"); // final ⟨g⟩ → χ after a vowel ("day")
        expect(phonemizeWord("Alg")).toBe("alk"); // final ⟨g⟩ → k after a consonant ("alga")
    });

    test("⟨n⟩→[ŋ] before a velar + intervocalic g-spirantization ⟨g⟩→[ʁ]", () => {
        expect(phonemizeWord("Bankrott")).toBe("baŋkrot"); // n→ŋ before [k] ("bankruptcy")
        expect(phonemizeWord("Lager")).toBe("laʁər"); // intervocalic ⟨g⟩ → [ʁ] ("camp/store")
        expect(phonemizeWord("Dag")).toBe("daχ"); // word-final ⟨g⟩ still → [χ] (not spirantized)
    });

    test("clause assembly", () => {
        expect(lb.text("Ech schwätzen Lëtzebuergesch.").trim()).toBe("æχ ʃvæt͡sən lət͡səbuərɡəʃ .");
    });
});
