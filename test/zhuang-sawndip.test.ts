import { describe, expect, test } from "vitest";

import { getPhonemizer } from "../src/registry.ts";
import { phonemizeWord } from "../src/languages/zhuang/zhuang.ts";
import { isSawndip, sawndipToReadings } from "../src/languages/zhuang/sawndip.ts";
import { loadTsvMap } from "../src/core/loadTsv.ts";

// Sawndip (古壮字) — the Han-derived LOGOGRAPHIC second script for Zhuang (za), read via a glyph→Standard-Zhuang-reading
// dictionary routed through the za Latin g2p (the Adlam/Tifinagh second-script pattern). reference-parity,
// covered-subset, default-reading (polyphonic glyphs → most-common).
describe("Zhuang Sawndip (second-script front-end)", () => {
    const za = getPhonemizer("za");

    test("Sawndip glyphs phonemize via their Standard-Zhuang reading", () => {
        expect(za.text("佲")).toBe("mɯŋ˨˦"); // mwngz 'you'
        expect(za.text("爹")).toBe("teː˨˦"); // de
        expect(za.text("馬")).toBe("maː˦˨"); // max (horse-derived)
        expect(za.text("甫")).toBe("poːuː˦˨"); // boux (person/classifier)
        expect(za.text("乜")).toBe("mat˥"); // maet
    });

    test("one glyph = one syllable; mixed Latin + Sawndip in one input", () => {
        expect(za.text("gou 佲")).toBe("koːuː˨˦ mɯŋ˨˦"); // 'I you' — Latin word + Sawndip glyph
        expect(za.text("佲甫")).toBe("mɯŋ˨˦ poːuː˦˨"); // two glyphs → two syllables
    });

    test("script detection + OOV (undocumented/unencoded glyph) is dropped, not crashed", () => {
        expect(isSawndip("佲")).toBe(true);
        expect(isSawndip("gou")).toBe(false); // Latin
        expect(sawndipToReadings("龘")).toEqual([]); // an ideograph with no documented Zhuang reading → dropped
        expect(za.text("龘")).toBe(""); // gracefully empty
    });

    test("the shipped dictionary is well-formed and every reading is phonemizable", () => {
        const dict = loadTsvMap(import.meta.url, "../src/languages/zhuang/sawndip-readings.tsv");
        expect(dict.size).toBeGreaterThan(2000);
        for (const [glyph, reading] of dict) {
            expect([...glyph].length).toBe(1); // single codepoint per key
            expect(reading.length).toBeGreaterThan(0);
            expect(phonemizeWord(reading).length).toBeGreaterThan(0); // no broken reading
        }
    });
});
