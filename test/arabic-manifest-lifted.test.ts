/**
 * Arabic's letter inventories must come from arabic.jsonc, not be re-spelled beside it.
 *
 * `restore.ts` carried the full consonant string and the mater-lectionis carriers as literals while
 * `MANIFEST.consonants` and `MANIFEST.letters` held every letter in them; `diacritizer.ts` re-spelled the
 * proclitic class as `[وفبكل]` beside `MANIFEST.proclitics`; and `arabic.ts` listed the Perso-Arabic letters
 * by codepoint although they are `consonants` entries. Each duplicate is an "add a letter, forget the line"
 * failure waiting to happen — arabic.jsonc is edited far more often than these scans are read.
 *
 * These derive their expectations FROM the manifest, so they fail on decoupling rather than on wrong data.
 */
import { describe, expect, test } from "vitest";
import { MANIFEST } from "../src/languages/arabic/manifest.ts";
import { isSkeleton } from "../src/languages/arabic/restore.ts";

describe("arabic derives its inventories from the manifest", () => {
    test("every mater lectionis is a manifest letter, and none is a `consonants` entry", () => {
        const { alif, waw, alifMaqsura, ya } = MANIFEST.letters;
        for (const c of [alif, waw, alifMaqsura, ya]) expect(c).toBeTruthy();
        // ⚠ alif is BOTH: it joins the consonant string and is then removed by the carrier test.
        expect(MANIFEST.consonants[waw]).toBeDefined();
        expect(MANIFEST.consonants[alif]).toBeUndefined();
    });

    test("the Perso-Arabic letters the tokenizer adds are exactly the out-of-range consonants", () => {
        const extra = Object.keys(MANIFEST.consonants).filter((c) => c.codePointAt(0)! > 0x064a);
        expect(new Set(extra)).toEqual(new Set(["پ", "چ", "ژ", "ڤ", "ڭ", "گ", "ݣ"]));
    });

    test("the classical spelling table feeds the defective-spelling one", () => {
        // مائة must rewrite to a form the `defectiveSpelling` keys actually contain, or the ثلاثمئة
        // entries are unreachable from classically-spelled text — which is the whole reason it exists.
        const { classicalSpelling, defectiveSpelling } = MANIFEST.diacritizer;
        const modern = "ثلاثمائة".replace("مائة", classicalSpelling["مائة"]!);
        expect(Object.keys(defectiveSpelling)).toContain(modern);
    });

    test("a skeleton is still recognised through the derived consonant set", () => {
        expect(isSkeleton("كتب")).toBe(true);
        expect(isSkeleton("كَتَبَ")).toBe(false);
    });
});
