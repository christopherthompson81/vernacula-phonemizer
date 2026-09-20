/**
 * THE TWO #1382 DEFECTS, PINNED IN BOTH DIRECTIONS — a word spelled out as an initialism, and an
 * initialism read as a word. They share a subject and nothing else; the fixes are in different places
 * and each has an exclusion that was wrong the first time.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

describe("an initialism row is not a compound piece", () => {
    // ⚠ 210 dictionary rows are an initialism spelled out (`abs` = EY1 B IY1 EH1 S), 163 of them at or
    // above MINPART, and `compoundSplit` reached for them like any other row: `absent` came out
    // "A-B-S-ent". 287 dictionary words and 131 referee headwords decoded that way.
    test("a word built over one is read as a word", async () => {
        expect(await phonemize("treacher", "en")).not.toMatch(/eᶦt͡ʃ/u);        // was "tray-A-C-H-er"
        expect(await phonemize("flymph", "en")).toBe("flˈɪmf");                 // was "fly-EM-PEE-AITCH"
        expect(await phonemize("congregationalist", "en")).not.toMatch(/ˌeᶦtˌiːʲˌaᶦ/u);
    });

    // ⚠ THE ROW ITSELF IS STILL RIGHT. The predicate rejects a PIECE, never a word — a recorded word
    // does not take the OOV path at all, so `abc` and `mph` keep their letter readings.
    test("the initialism itself still reads as letters", async () => {
        expect(await phonemize("abc", "en")).toBe("ˈeᶦbiːsˌiː");
        expect(await phonemize("mph", "en")).toBe("ˌɛmpˌiːʲˈeᶦt͡ʃ");
    });
});

describe("a reading with no vowel nucleus is not a pronunciation", () => {
    const nucleus = /[aeiouæɑɒɔəɚɜɝɛɪʊʌᵻiu]/u;

    // ⚠ `core/initialisms.ts` reads these correctly but matches ALL-CAPS runs only, deliberately. This
    // is the net under that gate: it fires only when the result is unsayable.
    test("a lowercase initialism is spelled out rather than emitted as consonants", async () => {
        for (const w of ["blt", "frb", "gpt", "dwp", "bdsm", "hdd", "kph"]) {
            expect([w, nucleus.test(await phonemize(w, "en"))]).toEqual([w, true]);
        }
        // ⚠ THE TWO PATHS AGREE ON THE LETTERS AND NOT ON THE TOKENISATION, which is worth pinning
        // rather than smoothing over. The caps pass rewrites the TEXT, so `BLT` becomes three words with
        // three primaries (`bˈiː ˈɛɫ tʰˈiː`); the net works inside one word and yields one primary with
        // secondaries (`bˌiːʲˌɛɫtˈiː`). Both are sayable and say the same letters. Making them identical
        // would mean either the net emitting word breaks the tokeniser has already passed, or the caps
        // pass giving up its separate tokens — neither is obviously right, so the difference is stated.
        expect(await phonemize("BLT", "en")).toBe("bˈiː ˈɛɫ tʰˈiː");
        expect(await phonemize("blt", "en")).toBe("bˌiːʲˌɛɫtˈiː");
    });

    // ⚠ A DOUBLED FINAL LETTER IS ORDINARY ENGLISH AND A TRIPLED ONE IS ELONGATION. The first version
    // exempted "every letter after the first is the same", which exempts `hdd` and `cnn` — the very
    // initialisms the net exists to catch.
    test("an elongated interjection is left alone, a doubled-letter initialism is not", async () => {
        expect(nucleus.test(await phonemize("hmmmm", "en"))).toBe(false);   // exempt
        expect(nucleus.test(await phonemize("zzz", "en"))).toBe(false);     // exempt
        expect(nucleus.test(await phonemize("hdd", "en"))).toBe(true);      // NOT exempt
        expect(nucleus.test(await phonemize("cnn", "en"))).toBe(true);      // NOT exempt
    });

    // ⚠ TWO LETTERS IS DECLINED, and it costs 51 of the 186. At that length an English initialism is
    // indistinguishable from a romanisation digraph arriving through foreign-run delegation, and the
    // goldens carry the second kind. Pinned so the floor is not "tidied" away.
    test("a two-letter run is declined, because it may be a foreign digraph", async () => {
        expect(nucleus.test(await phonemize("sh", "en"))).toBe(false);
    });
});

// ⚠ `fyi` IS NEITHER CLASS. CMUdict glosses it as its expansion, so the engine said "for your
// information" where the referee has ɛfwaɪaɪ — the one word in #1382's sample that IS an initialism was
// the one getting the phrase. A dictionary row, not an engine defect.
test("an initialism glossed as its expansion reads as letters", async () => {
    expect(await phonemize("fyi", "en")).toBe("ˌɛfwˌaᶦˈaᶦ");
});
