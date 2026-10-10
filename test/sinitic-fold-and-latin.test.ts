/**
 * THE SINITIC HOSTS ADOPT THE SHARED HAN FOLD (#1481), AND cdo STOPS READING FOREIGN LATIN AS BUC (#1478).
 *
 * Both were found by the Mandarin follow-up to the Rust port (#1463), which fixed them for cmn alone. The
 * measurement is in docs/investigations/sinitic/sinitic_fold_investigation.md.
 *
 *   · `foldHanCompatibility` — a Kangxi radical (⼈ U+2F08) or a CJK compatibility ideograph is the same
 *     character as its unified twin, and every dictionary here is keyed on the unified form. Unfolded, it
 *     read as NOTHING in every Sinitic host but cmn.
 *   · `repeatHanIterationMarks` — 々 / 〻 repeat the Han character before them. Only cmn and wuu knew it,
 *     and wuu only 々.
 *   · cdo is the one Sinitic host whose own script is Latin (Bàng-uâ-cê), so it claimed EVERY Latin run and
 *     read `IUPAC` as *iupac˥˥* — the letters leaked raw with a tone appended.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { foldHanCompatibility, foldHanCompatibilityKey, repeatHanIterationMarks } from "../src/core/unicode.ts";
import { latinParts } from "../src/languages/mindong/mindong.ts";

const SINITIC = ["cmn", "yue", "wuu", "gan", "hsn", "hak", "nan", "cjy", "cdo"] as const;

describe("every Sinitic host folds Han compatibility forms (#1481)", () => {
    // ⚠ cdo has no Han front-end — its Han goes to the router's Mandarin reader — but a Kangxi radical is a
    // SYMBOL (\p{So}), so the gap pass never offered it to the router at all. It is in this list on purpose.
    test.each(SINITIC)("%s reads a Kangxi radical as its unified ideograph", (lang) => {
        const unified = phonemize("人", lang);
        expect(unified).not.toBe("");
        expect(phonemize("⼈", lang)).toBe(unified); // U+2F08 KANGXI RADICAL MAN
        expect(phonemize("一⼈", lang)).toBe(phonemize("一人", lang));
    });

    test.each(SINITIC)("%s reads a CJK compatibility ideograph as its unified twin", (lang) => {
        // The first three U+F900-block ideographs whose unified twin this host reads — chosen from the data,
        // not typed: a compatibility ideograph is visually identical to its twin, so a typed one is unverifiable.
        let found = 0;
        for (let cp = 0xf900; cp <= 0xfaff && found < 3; cp++) {
            const c = String.fromCodePoint(cp);
            const u = c.normalize("NFKC");
            if (u === c || !/^\p{Script=Han}$/u.test(u)) continue;
            const reading = phonemize(u, lang);
            if (reading === "") continue;
            expect(phonemize(c, lang), `U+${cp.toString(16)}`).toBe(reading);
            found++;
        }
        expect(found).toBe(3);
    });
});

describe("every Sinitic host repeats the iteration marks (#1481)", () => {
    test.each(SINITIC)("%s: 々 and 〻 repeat the Han character before them", (lang) => {
        expect(phonemize("人々", lang)).toBe(phonemize("人人", lang));
        expect(phonemize("人〻", lang)).toBe(phonemize("人人", lang));
        // After the fold, so a folded radical is what gets repeated.
        expect(phonemize("⼈々", lang)).toBe(phonemize("人人", lang));
    });

    test("the core rewrite: one copy, both marks, nothing to repeat is left alone", () => {
        expect(repeatHanIterationMarks("佐々木 時〻")).toBe("佐佐木 時時");
        expect(repeatHanIterationMarks("々")).toBe("々");
        expect(repeatHanIterationMarks(foldHanCompatibility("⼈々"))).toBe("人人");
    });
});

/**
 * ⚠ THE FOLD MOVES THE INPUT, SO IT CAN ORPHAN A KEY. A dict key spelled with a compatibility ideograph can no
 * longer be matched once the input is folded — wuu's U+F995 (gni6) was one, and its unified form was not a key,
 * so the fold would have turned its reading into a silence. Every such key must still read.
 */
describe("no dict key is orphaned by the fold", () => {
    const TABLES: Record<string, string[]> = {
        cmn: ["mandarin/chars.tsv"], yue: ["cantonese/dict.tsv"], wuu: ["wu/dict.tsv"], gan: ["gan/dict.tsv"],
        hsn: ["xiang/dict.tsv"], hak: ["hakka/dict.tsv"], nan: ["minnan/dict.tsv", "minnan/dict-chars.tsv"],
        cjy: ["jin/dict.tsv"],
    };
    test("the untraced key fold is the same fold, code point for code point, and leaves unified Han alone", () => {
        for (let cp = 0x2e80; cp <= 0x2fa1f; cp++) {
            if (cp >= 0xd800 && cp <= 0xdfff) continue;
            const c = String.fromCodePoint(cp);
            expect(foldHanCompatibilityKey(c)).toBe(foldHanCompatibility(c));
        }
        expect(foldHanCompatibilityKey("一人")).toBe("一人");
    });

    test.each(Object.entries(TABLES))("%s", (lang, files) => {
        const orphanable: string[] = [];
        for (const f of files)
            for (const line of readFileSync(`data/languages/${f}`, "utf8").split("\n")) {
                if (!line || line.startsWith("#")) continue;
                const k = line.slice(0, line.indexOf("\t"));
                if ([...k].length === 1 && foldHanCompatibility(k) !== k) orphanable.push(k);
            }
        for (const k of orphanable) expect(phonemize(k, lang), `U+${k.codePointAt(0)!.toString(16)}`).not.toBe("");
    });
});

describe("cdo routes a non-BUC Latin run to the English reader (#1478)", () => {
    const en = (s: string): string => phonemize(s, "en");
    const cdo = (s: string): string => phonemize(s, "cdo");

    test("the issue's witness: an acronym in brackets", () => {
        expect(cdo("（IUPAC）")).toBe(en("IUPAC"));
        expect(cdo("（IUPAC）")).not.toMatch(/iupac/u);
    });

    test("English words and names", () => {
        expect(cdo("Harry Potter")).toBe(`${en("Harry")} ${en("Potter")}`);
        expect(cdo("County")).toBe(en("County"));
    });

    test("a BUC word stays on the converter — toned, or untoned but parsing", () => {
        expect(latinParts("Hók-ciŭ".normalize("NFD"))).toEqual([{ text: "Hók-ciŭ".normalize("NFD"), native: true }]);
        expect(latinParts("gah")).toEqual([{ text: "gah", native: true }]);
        // A toned syllable the rime table lacks is still BUC — it got the converter before, and keeps it.
        expect(latinParts("bĭh".normalize("NFD"))[0]!.native).toBe(true);
        expect(cdo("gì")).toMatch(/[˥˦˧˨˩]$/u);
    });

    test("a French accent is not a BUC tone mark: the alphabet tells them apart", () => {
        expect(latinParts("Québec".normalize("NFD"))[0]!.native).toBe(false);
        expect(cdo("Québec")).toBe(en("Québec"));
    });

    test("a mixed run keeps both halves: foreign stem, toned native morpheme", () => {
        expect(latinParts("Kazakh-cŭk".normalize("NFD")).map((p) => p.native)).toEqual([false, true]);
        expect(cdo("Kazakh-cŭk")).toBe(`${en("Kazakh-")} ${phonemize("cŭk", "cdo")}`.replace(/\s+/gu, " ").trim());
        // No toned part: an untoned syllable that merely parses is the foreign word's own (`sung`).
        expect(latinParts("Il-sung").map((p) => p.native)).toEqual([false]);
    });
});

describe("every other Sinitic host already routed Latin to English — pinned so it stays that way", () => {
    test.each(SINITIC.filter((l) => l !== "cdo"))("%s", (lang) => {
        expect(phonemize("Washington", lang)).toBe(phonemize("Washington", "en"));
    });
});
