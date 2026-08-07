/**
 * THE FLOOR UNDER A LETTER NO G2P CAN READ, and the input repairs that get a letter as far as the g2p.
 *
 * Three separate mechanisms, pinned together because they are easy to confuse and they run in this order:
 *   1. input repair (registry) — mojibake, homoglyphs, fullwidth forms: make the character the one that was meant
 *   2. the fold (makeNativiser) — an out-of-inventory ACCENT to a base the g2p has a rule for
 *   3. this floor (latinPhone) — a letter the g2p still cannot read, at the g2p's own fall-through
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { latinPhone } from "../src/core/latinPhones.ts";

describe("a letter the g2p cannot read still gets a sound", () => {
    test("⟨x⟩ is /ks/ medially and /z/ word-initially", () => {
        expect(latinPhone("x")).toBe("ks");
        expect(latinPhone("x", { initial: true })).toBe("z");
        // …and the initial allophone reaches the output, in a language with no ⟨x⟩ rule of its own.
        expect(phonemize("Xerox", "ak")).toBe("zeroks");
    });

    test("⟨h⟩ is opt-in, because silence on it is CORRECT in several orthographies", () => {
        expect(latinPhone("h")).toBeUndefined();
        expect(latinPhone("h", { includeH: true })).toBe("h");
        // Italian writes ⟨h⟩ and reads nothing; the floor must not break that.
        expect(phonemize("hanno", "it")).toBe(phonemize("anno", "it"));
    });

    test("a combining mark never gets a phone — a mark is not a segment", () => {
        expect(latinPhone("́")).toBeUndefined();
        expect(latinPhone("̍")).toBeUndefined();
    });

    test("a language's OWN rule always wins — the fall-through is never reached", () => {
        // /q/ and /x/ are Crimean Tatar, Azerbaijani and Karakalpak phonemes; the floor must not preempt them.
        expect(phonemize("Quixote", "crh")).toContain("q");
        expect(phonemize("Xerox", "az")).toContain("x");
    });

    test("Māori ROUTES a word it cannot spell, and keeps one it can", () => {
        // The floor cannot repair phonotactics — Māori is strictly (C)V — so an unspellable word goes to English.
        expect(phonemize("Safari", "mi")).toBe(phonemize("Safari", "en"));
        // …per WORD: Māori can spell Katrina, so it stays Māori even beside a routed one.
        expect(phonemize("Katrina", "mi")).toBe("katɾina");
        expect(phonemize("ngā", "mi")).toBe("ŋaː");
    });
});

describe("input repairs deliver the character that was meant", () => {
    test("⚠ Greek β where German ß was meant — including WORD-FINAL, where ß mostly lives", () => {
        for (const [beta, esszett] of [["Straβe", "Straße"], ["Weiβ", "Weiß"], ["Gauβ", "Gauß"]] as const)
            for (const lang of ["de", "en"])
                expect(phonemize(beta, lang), `${lang} ${beta}`).toBe(phonemize(esszett, lang));
    });

    test("…and genuine Greek and Cyrillic are untouched", () => {
        expect(phonemize("βιβλίο", "el")).toBe("vivlio");
        expect(phonemize("Το βιβλίο", "el")).toBe("to vivlio");
        expect(phonemize("Москва", "ru")).toBe("mɐskvˈa");
    });

    test("fullwidth Latin letters and digits fold to their ASCII twins", () => {
        expect(phonemize("Ｇ７の会議", "ja")).toBe(phonemize("G7の会議", "ja"));
        expect(phonemize("ƒoto", "ha")).toBe(phonemize("foto", "ha"));
    });
});
