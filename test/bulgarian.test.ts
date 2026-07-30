import { describe, expect, test } from "vitest";

import { phonemizeWord, createBulgarian } from "../src/languages/bulgarian/bulgarian.ts";

// Canonical-IPA goldens for Bulgarian / български (bg) — South Slavic, Cyrillic, "clean" (highly phonemic). A
// left-to-right g2p + phonotactic post-rules, validated against TWO independent human referees (wikipron
// bul_cyrl_narrow 99.6% + kaikki bg 99.5%). Stress is unwritten (lexical) and Bulgarian vowel reduction is
// stress-conditioned, so the full phonemic vowels are emitted (а→a, о→ɔ, у→u, ъ→ɤ) and reduction is folded in the
// eval. See docs/investigations/bg_native_bringup_investigation.md.
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
