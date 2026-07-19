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
});
