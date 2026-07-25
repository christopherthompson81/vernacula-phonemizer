import { describe, expect, test } from "vitest";

import { phonemizeWord, createFinnish } from "../src/languages/finnish/finnish.ts";

// Finnish (fi) — Uralic (Finnic), Latin, one of the most PHONEMICALLY TRANSPARENT orthographies in the world. Greedy
// longest-match g2p over the grapheme table (8 vowels, ⟨a⟩=ɑ back; long-vowel + 18 diphthong digraphs) + three code
// rules: gemination (Cː), ⟨ng⟩→ŋː, ⟨nk⟩→ŋk. Scored 96.0% folded on the wikipron fin_latn_broad HUMAN referee
// (173449 words); the residual is loanwords/foreign names. See docs/investigations/fi_native_bringup_investigation.md.
describe("Finnish canonical IPA — greedy g2p (Standard Finnish)", () => {
    test("back ⟨a⟩=ɑ, vowel length, ⟨v⟩=ʋ", () => {
        expect(phonemizeWord("talo")).toBe("tɑlo"); // house — back a
        expect(phonemizeWord("maa")).toBe("mɑː"); // land — doubling = length
        expect(phonemizeWord("pää")).toBe("pæː"); // head — ää → æː
        expect(phonemizeWord("vesi")).toBe("ʋesi"); // water — v → ʋ (approximant)
    });

    test("consonant gemination → Cː", () => {
        expect(phonemizeWord("kukka")).toBe("kukːɑ"); // flower
        expect(phonemizeWord("tullut")).toBe("tulːut"); // come (past ptcp)
        expect(phonemizeWord("mummo")).toBe("mumːo"); // grandma
    });

    test("velar nasal: ⟨ng⟩→ŋː (long), ⟨nk⟩→ŋk", () => {
        expect(phonemizeWord("kengät")).toBe("keŋːæt"); // shoes — ng → ŋː
        expect(phonemizeWord("rengas")).toBe("reŋːɑs"); // ring/tyre
        expect(phonemizeWord("sänky")).toBe("sæŋky"); // bed — n → ŋ before k
        expect(phonemizeWord("kaupunki")).toBe("kɑu̯puŋki"); // town — diphthong + nk
    });

    test("diphthongs mark the 2nd vowel non-syllabic (V̯)", () => {
        expect(phonemizeWord("pöytä")).toBe("pøy̯tæ"); // table — öy
        expect(phonemizeWord("auto")).toBe("ɑu̯to"); // car — au
        expect(phonemizeWord("tie")).toBe("tie̯"); // road — opening diphthong ie
        expect(phonemizeWord("työ")).toBe("tyø̯"); // work — yö
        expect(phonemizeWord("vuosi")).toBe("ʋuo̯si"); // year — uo
        expect(phonemizeWord("Suomi")).toBe("suo̯mi"); // Finland
    });

    test("cardinal numbers (agglutinated below 1000; tuhat joined, miljoona separate)", () => {
        const fi = createFinnish();
        expect(fi.text("0").trim()).toBe("nolːɑ");
        expect(fi.text("7").trim()).toBe("sei̯tsemæn");
        expect(fi.text("11").trim()).toBe("yksitoi̯stɑ");
        expect(fi.text("234").trim()).toBe("kɑksisɑtɑːkolmekymːentæneljæ");
        expect(fi.text("1234").trim()).toBe("tuhɑt kɑksisɑtɑːkolmekymːentæneljæ");
        expect(fi.text("2000000").trim()).toBe("kɑksi miljoːnɑː");
    });

    test("text: words + clause punctuation", () => {
        expect(createFinnish().text("Talo on iso.")).toBe("tɑlo on iso  . ");
    });
});
