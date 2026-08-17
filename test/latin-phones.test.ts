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

/**
 * ⚠ SIX ENGINES NEVER REACHED THE FLOOR ABOVE. Their unknown-letter branch pushed the RAW
 * ORTHOGRAPHIC CHARACTER into the phone stream instead of calling latinPhone, so the letter did not
 * fall through to the floor -- it walked straight past it into the output. 46 engines import
 * latinPhone; welsh, irish, swedish, spanish, catalan and galician did not.
 *
 * The tell was a ⟨q⟩ standing in the IPA of five languages that have no /q/ (a uvular stop): cy ×38,
 * ga ×33, sv ×13, es ×9, ca ×5 in the FLEURS corpora, all of them Qing / Qatar / piquet /
 * Albuquerque / Joaquim / Kalaallit. It was found by scanning each language's IPA output for
 * characters that language's engine should not be able to emit -- the same defect shape as fula's
 * literal "sh", and equally invisible to any distance metric, because /q/ is a perfectly ordinary
 * phone and only WRONG FOR THIS LANGUAGE.
 *
 * ⚠ Swedish is why the class survived review: ⟨qu⟩ already had a rule, so `square` was correct and
 * only the BARE letter leaked.
 *
 * Irish leaked three, and ⟨y⟩ is the nastiest of them: it is a valid IPA symbol for a close front
 * ROUNDED VOWEL, so an orthographic y did not look wrong at all -- it silently became a vowel.
 */
describe("the six engines that bypassed the floor now reach it", () => {
    const LEAKY = ["cy", "ga", "sv", "es", "ca", "gl"] as const;

    test("no engine emits a raw ⟨q⟩ for the letter q", async () => {
        for (const lang of LEAKY) {
            const out = await phonemize("aqa", lang);
            expect(out, `${lang} still leaks a raw q`).not.toContain("q");
        }
    });

    test("the names that exposed it read with /k/", async () => {
        expect(await phonemize("Qing", "cy")).toBe("kˈiŋ");
        expect(await phonemize("Qing", "ca")).toBe("kˈiŋ");
        expect(await phonemize("Qatar", "sv")).toBe("katˈɑːr");
        expect(await phonemize("piquet", "cy")).toBe("pikˈɨɛt");
        expect(await phonemize("Albuquerque", "ga")).toBe("ˈal̪ˠbˠəkəəɾʲkəə");
    });

    test("Irish also leaked ⟨x⟩ and ⟨y⟩, and ⟨y⟩ is a REAL IPA vowel so it looked fine", async () => {
        expect(await phonemize("axa", "ga")).not.toContain("x");
        expect(await phonemize("aya", "ga")).not.toContain("y");
    });

    // ⚠ THE REGRESSION GUARD. Swedish ⟨qu⟩ had its own rule and was always correct; the fix must not
    // reach past the bare letter and disturb it.
    test("a digraph that already had a rule is untouched", async () => {
        expect(await phonemize("square", "sv")).toBe("skvˈɑ̀ːrɛ");
    });
});
