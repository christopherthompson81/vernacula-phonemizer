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
        const dict = loadTsvMap(import.meta.url, "../data/languages/zhuang/sawndip-readings.tsv");
        expect(dict.size).toBeGreaterThan(2000);
        for (const [glyph, reading] of dict) {
            expect([...glyph].length).toBe(1); // single codepoint per key
            expect(reading.length).toBeGreaterThan(0);
            expect(phonemizeWord(reading).length).toBeGreaterThan(0); // no broken reading
        }
    });

    // ⚠ WELL-FORMED IS NOT REACHABLE, AND THAT GAP HID 24 ROWS. The test above proves every reading is
    // phonemizable; nothing proved the GLYPH could ever be presented to the reader. `isIdeograph`'s upper
    // bounds were the ends of Ext F and Ext H, and the extract the dictionary is built from has since moved
    // into Ext I and Ext J — so 24 of 2,412 keys (1.0%) were dead rows: `isSawndip` said no, the TOKEN class
    // never claimed them, and `za.text(glyph)` returned the empty string. U+3007 〇 was outside every
    // ideograph block to begin with. See sawndip.ts.
    //
    // ⚠ AND THE PROBE ASSERTS A NON-EMPTY READING, not merely that the two paths agree: a glyph that both
    // the predicate and the engine silently drop is exactly what this is here to catch.
    test("⚠ EVERY dictionary key is REACHABLE from the shipped entry point", () => {
        const dict = loadTsvMap(import.meta.url, "../data/languages/zhuang/sawndip-readings.tsv");
        const unreachable = [...dict.keys()].filter((g) => !isSawndip(g) || za.text(g) === "");
        expect(unreachable).toEqual([]);
        // the four blocks the old bounds excluded, named so a regression says which one came back
        expect(za.text("〇")).toBe(phonemizeWord("lingz")); // U+3007, not an ideograph block at all
        expect(za.text("\u{2ECAD}")).toBe(phonemizeWord("congz")); // Ext I
        expect(za.text("\u{323B6}")).toBe(phonemizeWord("fuj")); // Ext J
        // …and an ideograph with no documented reading is still dropped, not invented
        expect(za.text("龘")).toBe("");
    });
});
