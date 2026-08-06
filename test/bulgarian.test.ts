import { describe, expect, test } from "vitest";

import { phonemizeWord, createBulgarian } from "../src/languages/bulgarian/bulgarian.ts";
import { normalizeBulgarian } from "../src/languages/bulgarian/normalize.ts";

// Canonical-IPA goldens for Bulgarian / български (bg) — South Slavic, Cyrillic, "clean" (highly phonemic). A
// left-to-right g2p + phonotactic post-rules, validated against TWO independent human referees (wikipron
// bul_cyrl_narrow 99.6% + kaikki bg 99.5%). Stress is unwritten (lexical) and Bulgarian vowel reduction is
// stress-conditioned, so the full phonemic vowels are emitted (а→a, о→ɔ, у→u, ъ→ɤ) and reduction is folded in the
// eval.
describe("Bulgarian canonical IPA — phonemic g2p + phonotactics", () => {
    test("final devoicing + regressive voicing assimilation", () => {
        expect(phonemizeWord("град")).toBe("ɡrat"); // final д → t
        expect(phonemizeWord("хляб")).toBe("xlʲap"); // палатализация л→lʲ before я; final б → p
        expect(phonemizeWord("сграда")).toBe("zɡrada"); // с → z before voiced г (regressive voicing)
    });

    test("palatalisation (only before ь/я/ю) + dark-l", () => {
        expect(phonemizeWord("мляко")).toBe("mlʲakɔ"); // л → lʲ before я
        expect(phonemizeWord("бял")).toBe("bʲaɫ"); // б → bʲ before я; final л → ɫ (dark)
        expect(phonemizeWord("език")).toBe("ɛzik"); // е → ɛ (no palatalisation before е), и → i
    });

    test("ъ→ɤ, щ→ʃt, cluster phonotactics", () => {
        expect(phonemizeWord("България")).toBe("bɤɫɡarija"); // ъ → ɤ; л → ɫ before ɡ
        expect(phonemizeWord("съществителен")).toBe("sɤʃtɛstvitɛlɛn"); // щ → ʃt
    });

    test("numbers compose with the и connector", () => {
        const p = createBulgarian();
        expect(p.text("21")).toBe("dvajsɛt i ɛdnɔ");
        expect(p.text("123")).toBe("stɔ dvajsɛt i tri");
        expect(p.text("2025")).toBe("dvɛ xilʲadi i dvajsɛt i pɛt");
    });

    // милион / милиард (10⁶ / 10⁹) were missing entirely — nothing above 999 999 was composed, so the digit string
    // fell through to the Cyrillic g2p and came out EMPTY. Both are MASCULINE nouns, so they need the masculine
    // multiplier (един/два, not едно/две) and the Bulgarian COUNT plural -а above one. Source: Wiktionary
    // "милион" (Bulgarian) declension — count form милиона beside the ordinary plural милиони. See bulgarian.jsonc.
    test("милион / милиард take masculine 1-2 and the count plural -а", () => {
        const p = createBulgarian();
        expect(p.text("7")).toBe("sɛdɛm"); // седем — units
        expect(p.text("42")).toBe("t͡ʃɛtirijsɛt i dvɛ"); // четирийсет и две — compound 21-99
        expect(p.text("555")).toBe("pɛtstɔtin pɛdɛsɛt i pɛt"); // петстотин петдесет и пет — hundreds
        expect(p.text("12345")).toBe("dvanajsɛt xilʲadi trista t͡ʃɛtirijsɛt i pɛt"); // thousands
        expect(p.text("1000000")).toBe("ɛdin miliɔn"); // един милион — masculine "one", singular noun
        expect(p.text("2000000")).toBe("dva miliɔna"); // два милиона — masculine "two" + count plural
        expect(p.text("5000000")).toBe("pɛt miliɔna"); // пет милиона
        expect(p.text("21000000")).toBe("dvajsɛt i ɛdin miliɔn"); // двайсет и един милион — …1 keeps the singular
        expect(p.text("1000000000")).toBe("ɛdin miliart"); // един милиард — final ⟨д⟩ devoices to [t]
        expect(p.text("2000000000")).toBe("dva miliarda"); // два милиарда
    });
});


// #562 — the normalization layer. Every count is measured over the FLEURS bg_bg corpus (column 3); the
// engine is rule-based, so every emitted word was probed through the g2p rather than looked up.
describe("bulgarian normalization", () => {
    // ★ The largest defect in the language, and nothing like it in the four previous ones: `1767 г.` is
    // how Bulgarian writes a year. It read as the numeral, then the LETTER г as [k], then a SENTENCE
    // BREAK from the abbreviation dot. 265 instances.
    test("the year abbreviation N г.", () => {
        expect(normalizeBulgarian("1767 г.")).toBe("1767 година");
    });

    // Three abbreviation dots, each becoming a clause break: `323 г. пр.н.е.` fragmented into four.
    test("the era marker пр.н.е.", () => {
        expect(normalizeBulgarian("323 г. пр.н.е.")).toBe("323 година преди новата ера");
    });

    test("space-grouped thousands, decimal comma, clock", () => {
        expect(normalizeBulgarian("5 000")).toBe("5000"); // read as "пет нула"
        expect(normalizeBulgarian("12,5")).toBe("12 цяло и 5"); // Bulgarian reads "whole and"
        expect(normalizeBulgarian("22:00")).toBe("22 00");
    });

    // The counting plural, not the citation singular: 18 процента, not 18 процент.
    test("percent takes the counting form", () => {
        expect(normalizeBulgarian("25 %")).toBe("25 процента");
    });

    // ⚠ Units are written in CYRILLIC here (км 50), not the Latin km of nb/da/ro — a Latin table matches
    // nothing. And both boundaries must be \p{L} lookarounds: \b is ASCII-defined and finds no boundary
    // next to а Cyrillic letter, so `км2` silently stayed `км2`.
    test("Cyrillic units and squared units", () => {
        expect(normalizeBulgarian("50 км")).toBe("50 километра");
        expect(normalizeBulgarian("км2")).toBe("квадратни километра");
        expect(normalizeBulgarian("км²")).toBe("квадратни километра");
        expect(normalizeBulgarian("50 км/ч")).toBe("50 километра в час");
    });

    // ★ Bulgarian has NO ordinal dot — 0 of 54 `N.` shapes are followed by a lowercase word. The rule
    // that is largest in Norwegian (134) and Danish (112) must not exist here, as in Romanian.
    test("a dotted number is NOT an ordinal — sentence ends survive", () => {
        expect(normalizeBulgarian("Това е 1990. Той дойде")).toBe("Това е 1990. Той дойде");
    });

    test("degrees, ranges, currency and signs", () => {
        expect(normalizeBulgarian("20 °C")).toBe("20 градуса по Целзий");
        expect(normalizeBulgarian("1990-1995")).toBe("1990 до 1995");
        expect(normalizeBulgarian("$2500")).toBe("2500 долара");
        expect(normalizeBulgarian("EX = изчезнал")).toBe("EX равно на изчезнал");
    });

    test("ordinary Bulgarian text is untouched", () => {
        expect(normalizeBulgarian("Българският е език.")).toBe("Българският е език.");
    });

    // #586 — this layer already read `км/ч` as `в час`; two shapes it did not cover.
    // ⚠ THE AUDIT THAT FOUND THESE FIRST OVER-REPORTED THEM, by probing with LATIN abbreviations against a
    // Cyrillic-writing language. Bulgarian's own forms were already right — `5 км`, `5 м`, `5 км2`, `5 м3`,
    // `120 км/ч` all read correctly before this — so what follows is narrow on purpose.
    test("the rate denominators this layer had missed (#586)", () => {
        // The corpus's own `133 м/сек` read the denominator as the bare syllable [sɛk]. `в секунда` ×2.
        expect(createBulgarian().text("133 м/сек").trim()).toContain("mɛtra f sɛkunda");
        expect(createBulgarian().text("133 м/с").trim()).toContain("mɛtra f sɛkunda");
        // Latin aliases for the RATE only — the plain Latin `km` already read correctly, but `120 km/h` gave
        // the denominator as the ENGLISH letter name. Same reason ru/uk/kk declare Latin keys.
        expect(createBulgarian().text("120 km/h").trim()).toContain("kiɫɔmɛtra f t͡ʃas");
        expect(createBulgarian().text("120 км/ч").trim()).toContain("kiɫɔmɛtra f t͡ʃas"); // unchanged
    });

    // #586 — THE NUMERO SIGN was dropped outright: "космонавт № 11" read as *космонавт единадесет*, the sign
    // silently gone. `номер` ×5 in this corpus, and ru/uk already read it this way, preposed.
    // ⚠ This is the character DELIBERATELY EXCLUDED from the ℃ fold (trap 36 (a compatibility character is a fold)): NFKC maps № to the Latin "No",
    // which a Bulgarian g2p reads as an English word. A compatibility character can need a WORD, not a fold.
    test("the numero sign reads номер (#586)", () => {
        expect(createBulgarian().text("космонавт № 11").trim()).toContain("nɔmɛr ɛdinajsɛt");
        expect(createBulgarian().text("реактори № 1").trim()).toContain("nɔmɛr");
    });
});
