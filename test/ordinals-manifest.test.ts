/**
 * ORDINAL TABLES, read from the manifests instead of a literal in each engine file.
 *
 * ⚠ THE TABLE IS DATA AND THE FORMATION RULE IS NOT, which is the line every one of these lifts draws.
 * What moved is the vocabulary — which suffixes exist, which cardinals are suppletive, which morph maps to
 * which ordinal. What stayed is the algorithm: which word of a composed numeral gets inflected, how a teen
 * composes, when the standalone suppletive wins over the combining form.
 *
 * ⚠ ORDER IS LOAD-BEARING IN EVERY SUFFIX LIST — LONGEST FIRST. The suffixes are matched by alternation
 * against the text after a numeral, so a shorter one listed first shadows a longer one that contains it
 * (Bengali ম would eat তম; Odia ମ would eat ତମ; Tamil ம் would eat ஆம்). A JSON array preserves order;
 * an object or a set would not, which is why these stay lists and why this test checks the ordering.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { MANIFEST as HU } from "../src/languages/hungarian/manifest.ts";
import { MANIFEST as ML } from "../src/languages/malayalam/manifest.ts";
import { MANIFEST as OR } from "../src/languages/odia/manifest.ts";
import { MANIFEST as TA } from "../src/languages/tamil/manifest.ts";
import { MANIFEST as BN } from "../src/languages/bengali/manifest.ts";
import { MANIFEST as PA } from "../src/languages/punjabi/manifest.ts";

const say = (s: string, code: string): string => phonemize(s, code).replace(/[ˈˌ]/gu, "");

/** [code, the suffix list, an ordinal sentence, the SAME sentence with the suffix removed]. */
const SUFFIX_LISTS: [string, string[], string, string][] = [
    ["ml", ML.ordinalEndings, "20ാമത്തെ വാർഷികം", "20 വാർഷികം"],
    ["or", (OR as unknown as { ordinalSuffixes: string[] }).ordinalSuffixes, "1000ତମ ଦିନ", "1000 ଦିନ"],
    ["pa", (PA as unknown as { ordinalSuffixes: string[] }).ordinalSuffixes, "19ਵੀਂ ਸਦੀ", "19 ਸਦੀ"],
    ["ta", (TA as unknown as { ordinalSuffixes: string[] }).ordinalSuffixes, "5ஆவது இடம்", "5 இடம்"],
    ["bn", (BN as unknown as { ordinals: { suffixes: string[] } }).ordinals.suffixes, "১৭তম শতাব্দী", "১৭ শতাব্দী"],
];

describe.each(SUFFIX_LISTS)("%s reads its ordinal suffixes from the manifest", (code, list, sentence, bare) => {
    test("the list is non-empty and its longest entry is not shadowed", () => {
        expect(list.length).toBeGreaterThan(0);
        // ⚠ NOT "sorted by length" — the lists are hand-ordered and only need each entry to precede any
        // SHORTER entry that is a suffix of it. That is the property the alternation actually depends on.
        for (let i = 0; i < list.length; i++)
            for (let j = i + 1; j < list.length; j++)
                expect(list[i]!.endsWith(list[j]!) && list[i]!.length > list[j]!.length
                    || !list[j]!.endsWith(list[i]!),
                    `${code}: ${list[j]} precedes nothing but shadows ${list[i]}`).toBe(true);
    });

    test("the suffix FUSES onto the numeral instead of becoming its own token", () => {
        // ⚠ TOKEN COUNT AGAINST THE BARE NUMERAL, and the weaker version of this test passed with the list
        // EMPTIED. Comparing against the sentence with non-digits stripped differs no matter what, because
        // stripping removes the following noun too — a difference that proves nothing. What the list
        // actually buys is that the suffix is CONSUMED: with it gone the suffix reaches the g2p as its own
        // token and the count goes up, which is the only observable this data controls.
        const said = say(sentence, code);
        expect(said.length).toBeGreaterThan(0);
        expect(said.split(" ")).toHaveLength(say(bare, code).split(" ").length);
    });
});

describe("bn's 1–10 series is SUPPLETIVE, which is why it is a table and not a rule", () => {
    test("৮ম is অষ্টম, not the cardinal plus a suffix", () => {
        const sup = (BN as unknown as { ordinals: { suppletive: Record<string, string> } }).ordinals.suppletive;
        expect(sup["8"]).toBe("অষ্টম");
        expect(say("৮ম শ্রেণী", "bn")).toBe(say("অষ্টম শ্রেণী", "bn"));
        // ⚠ AND NOT *আটম — the regular formation on the cardinal আট, which is what an emptied table gives.
        expect(say("৮ম শ্রেণী", "bn")).not.toBe(say("আটম শ্রেণী", "bn"));
    });

    test("from 11 up the REGULAR তম form takes over, so the table stops at ten", () => {
        const sup = (BN as unknown as { ordinals: { suppletive: Record<string, string> } }).ordinals.suppletive;
        expect(Object.keys(sup)).toHaveLength(10);
        expect(say("১৭তম শতাব্দী", "bn")).toContain(say("তম", "bn").slice(0, 2));
    });
});

describe("hu inflects the LAST morph of a compound, from the manifest's morph table", () => {
    test("the declared morph is what the reading emits", () => {
        // ⚠ NOT THE COMPOUND `1848.` — I tried that first and it fails on correct data: `negyven` +
        // `nyolcadik` assimilates across the morph boundary to a GEMINATE (…nɛɟvɛ**ɲː**olt͡sɒdik), so the
        // bare `ɲolt͡sɒdik` is not a substring of it. The table's claim is about the morph, so test the morph.
        expect(HU.ordinalMorphs["nyolc"]).toBe("nyolcadik");
        expect(say("a 8. helyen", "hu")).toContain(say("nyolcadik", "hu"));
        expect(say("a 20. napon", "hu")).toContain(say(HU.ordinalMorphs["húsz"]!, "hu"));
    });

    test("the stem changes are real, which is why this is a table of MORPHS", () => {
        // húsz → husza-, ezer → ezre-, millió → milliomo-: not a suffix rule.
        expect(HU.ordinalMorphs["húsz"]).toBe("huszadik");
        expect(HU.ordinalMorphs["ezer"]).toBe("ezredik");
        expect(HU.ordinalMorphs["millió"]).toBe("milliomodik");
    });
});

/**
 * THE WORD CONSTANTS — the last of this sweep, and a different shape from the ordinal tables: not a table
 * at all, just a word the engine said that nothing outside the engine could see.
 *
 * ⚠ KALAALLISUT IS TWO LANGUAGES IN ONE NUMERAL SYSTEM, and that is a necessity rather than an engine
 * shortcut. The native series is a BODY-PART TALLY — `arfinillit` (6) is "other hand"+1, `aqqanillit` (11)
 * is "going down" to the feet +1 — and a system anchored to twenty fingers and toes has nowhere to put a
 * thousand. So 0–12 are native and 13 up are Danish, which is how speakers actually count, and index 0 is
 * already a Danish loan (`nul`) because no native zero exists.
 */
import { MANIFEST as KL } from "../src/languages/kalaallisut/manifest.ts";
import { MANIFEST as SW } from "../src/languages/swahili/manifest.ts";
import { MANIFEST as YO } from "../src/languages/yoruba/manifest.ts";

describe("kl counts native to 12 and Danish above it, both from the manifest", () => {
    const kl = (s: string): string => say(s, "kl");

    test("the boundary is at 12: native below, Danish from 13", () => {
        expect(KL.numbers.native).toHaveLength(13);
        expect(kl("12 nunaqarfiit")).toContain(kl(KL.numbers.native[12]!));
        // 13 is Danish `tretten`, which is NOT in the native list at all.
        expect(KL.numbers.native).not.toContain(KL.numbers.danish.teens[3]);
        expect(kl("13 inuit")).toContain(kl(KL.numbers.danish.teens[3]!));
    });

    test("Danish compounds are SOLID, joined by the declared `og`", () => {
        // 25 = fem + og + tyve, one word.
        expect(KL.numbers.danish.and).toBe("og");
        const solid = KL.numbers.danish.units[5]! + KL.numbers.danish.and + KL.numbers.danish.tens["20"]!;
        expect(kl("25 ukiut")).toContain(kl(solid));
        expect(kl("25 ukiut").split(" ")).toHaveLength(2);
    });

    test("the scale words were bare literals and are now declared", () => {
        // ⚠ `en million` / `millioner` were typed into template strings, so a grep for the scale words
        // found the tables and missed these two — the same shape as Amharic's `ከ`.
        expect(KL.numbers.danish.million.singular).toBe("en million");
        expect(kl("1000000 kroner")).toContain(kl(KL.numbers.danish.million.singular));
        expect(kl("2000000 kroner")).toContain(kl(KL.numbers.danish.million.plural));
    });
});

describe("sw and yo read their remaining word constants from the manifest", () => {
    test("sw's era words — and emptying them emits the literal word `undefined`", () => {
        const era = (SW as unknown as { eraWords: { bce: string; ad: string } }).eraWords;
        expect(say("Takribani 1000 BC", "sw")).toContain(say(era.bce, "sw"));
        expect(say("mwaka 300 A.D.", "sw")).toContain(say(era.ad, "sw"));
    });

    test("yo's bare metre, which is read locally rather than through the unit tier", () => {
        const metre = (YO.symbols as unknown as { metre: string }).metre;
        expect(say("ilé gíga 150 m", "yo")).toContain(say(metre, "yo"));
        // ⚠ AND THE COUNTER-EXAMPLE STILL DECLINES: `9h 50m` is duration notation, not a measurement.
        expect(say("9h 50m ni", "yo")).not.toContain(say(metre, "yo"));
    });
});
