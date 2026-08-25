/**
 * ORDINAL TABLES IN THE UNPORTED LANGUAGES — lifted ahead of the port rather than after it.
 *
 * ⚠ THESE HAVE NO C# SIDE YET, so there is no drift to prevent TODAY. They are lifted anyway because the
 * port is coming: doing it now means the port reads a manifest from the first commit instead of copying a
 * literal and acquiring a second home for the same data, which is the exact shape every earlier batch in
 * this programme had to undo.
 *
 * The line is the same one throughout: the WORDS are data, the composition is not.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { MANIFEST as HY } from "../src/languages/armenian/manifest.ts";
import { MANIFEST as HYW } from "../src/languages/westarmenian/manifest.ts";
import { MANIFEST as BAR } from "../src/languages/bavarian/manifest.ts";
import { MANIFEST as DA } from "../src/languages/danish/manifest.ts";
import { MANIFEST as HT } from "../src/languages/haitian/manifest.ts";
import { MANIFEST as IS } from "../src/languages/icelandic/manifest.ts";
import { MANIFEST as KEA } from "../src/languages/kabuverdianu/manifest.ts";
import { MANIFEST as NB } from "../src/languages/norwegian/manifest.ts";
import { MANIFEST as TL } from "../src/languages/tagalog/manifest.ts";
import { MANIFEST as TI } from "../src/languages/tigrinya/manifest.ts";
import { MANIFEST as ZU } from "../src/languages/zulu/manifest.ts";
import { MANIFEST as GN } from "../src/languages/guarani/manifest.ts";

const say = (s: string, code: string): string => phonemize(s, code).replace(/[ˈˌ]/gu, "");

/** [code, a sentence, the manifest word it must read]. */
const CASES: [string, string, string][] = [
    // ⚠ `3-րդ`, NOT `1-ին`. Armenian's ordinal marker is `-րդ`; `1-ին` is ALSO the dative of the cardinal
    // ("to one") and reads as *մեկին*, so it never reaches this table. My first version of this test used
    // it and failed on correct data — the sentence has to use the shape the rule claims.
    ["hy",  "3-րդ անգամ",         (HY as unknown as { irregularOrdinals: Record<string,string> }).irregularOrdinals["3"]!],
    ["hyw", "3-րդ անգամ",         (HYW as unknown as { irregularOrdinals: Record<string,string> }).irregularOrdinals["3"]!],
    ["bar", "da 1. Mai",          (BAR as unknown as { ordinalStems: Record<string,string> }).ordinalStems["1"]!],
    ["da",  "den 1. maj",         (DA as unknown as { ordinals: Record<string,string> }).ordinals["1"]!],
    ["is",  "1. maí",             (IS as unknown as { ordinals: Record<string,{masc:string}> }).ordinals["1"]!.masc],
    ["kea", "na 1º dia",          (KEA as unknown as { ordinals: string[] }).ordinals[1]!],
    ["nb",  "den 1. mai",         (NB as unknown as { ordinals: Record<string,string> }).ordinals["1"]!],
    ["tl",  "ika-2 na araw",      (TL as unknown as { contractedOrdinals: Record<string,string> }).contractedOrdinals["2"]!],
    ["ti",  "1ይ ቦታ",              (TI as unknown as { ordinals: Record<string,string> }).ordinals["1"]!],
    ["zu",  "1/2 yamanzi",        (ZU as unknown as { ordinalYe: Record<string,string> }).ordinalYe["2"]!],
    // ⚠ `50yèm` — a DIGIT ordinal, which is the only shape that reaches the tail table. The earlier version
    // of this suite tested Haitian's tails on their SHAPE alone and passed with the table unwired.
    ["ht",  "50yèm",               (HT as unknown as { ordinalTails: [string,string][] })
                                     .ordinalTails.find(([w]) => w === "senkant")![1]],
];

describe.each(CASES)("%s reads its ordinal from the manifest", (code, sentence, word) => {
    test("the declared word is what the reading emits", () => {
        expect(word.length, `${code}: the manifest entry is empty`).toBeGreaterThan(0);
        expect(say(sentence, code)).toContain(say(word, code));
    });
});

describe("the tables whose shape is the point", () => {
    test("bar's stem table is SPARSE on purpose — only where sourced", () => {
        const stems = (BAR as unknown as { ordinalStems: Record<string, string> }).ordinalStems;
        // 1, 2, 3, 10, 20 and nothing else: an unsourced index falls back to the cardinal rather than
        // being invented, which is why `19.` reads as the cardinal today.
        expect(Object.keys(stems).sort((a, b) => Number(a) - Number(b))).toEqual(["1", "2", "3", "10", "20"]);
    });

    test("is keeps THREE agreement forms per ordinal, named not positional", () => {
        const ord = (IS as unknown as { ordinals: Record<string, Record<string, string>> }).ordinals;
        for (const forms of Object.values(ord)) expect(Object.keys(forms).sort()).toEqual(["common", "femOblique", "masc"]);
    });

    test("ht's tails are [writtenEnding, spokenTail] PAIRS, longest-match at the call site", () => {
        const tails = (HT as unknown as { ordinalTails: [string, string][] }).ordinalTails;
        for (const pair of tails) expect(pair).toHaveLength(2);
        // ⚠ THE TAIL REPLACES THE ENDING, IT DOES NOT EXTEND IT — `nèf` → `nevyèm`, `sis` → `sizyèm`,
        // `uit` → `wityèm`, with the stem consonant changing. An earlier version of this test asserted
        // `spoken.startsWith(written)` and failed on four correct pairs. What IS invariant is the suffix.
        for (const [, spoken] of tails) expect(spoken.endsWith("yèm")).toBe(true);
    });

    test("zu's `ye-` series feeds the FRACTION rule, not an ordinal one", () => {
        const ye = (ZU as unknown as { ordinalYe: Record<string, string> }).ordinalYe;
        expect(Object.keys(ye)).not.toContain("1");   // numerator 1 only; there is no "first" denominator
        for (const w of Object.values(ye)) expect(w.startsWith("ye")).toBe(true);
    });

    test("gn's ordinal suffix is GLUED, and the hectare reading is not claimed", () => {
        const suf = (GN as unknown as { ordinalSuffix: string }).ordinalSuffix;
        expect(suf).toBe("ha");
        // ⚠ A READING, NOT JUST THE SHAPE — the token-count assertion alone passed with the key unwired.
        // `12ha` is *twelfth*: the suffix FUSES onto the numeral (pakõi + ha), one token, and the reading
        // is strictly longer than the bare cardinal's.
        expect(say("12ha", "gn").split(" ")).toHaveLength(1);
        expect(say("12ha", "gn")).toBe(say("12", "gn") + say(suf, "gn"));
    });
});
