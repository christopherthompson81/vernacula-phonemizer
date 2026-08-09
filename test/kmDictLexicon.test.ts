/**
 * The second-tier Khmer lexicon — the invariants that keep it from doing harm.
 *
 * `km-lexicon-dict.tsv` is 56,356 entries from google/language-resources (CC BY 4.0) for words no human
 * transcription covers. Two properties make it safe, and neither is enforced by the type system:
 *
 *   1. it is consulted AFTER the wikipron-verified exceptions lexicon, which wins every conflict;
 *   2. it contains NO word the referee covers — because `km-lexicon.tsv` is an EXCEPTIONS lexicon, so for any
 *      referee word absent from it the RULES already match wikipron by construction, and this dictionary agrees
 *      with wikipron only 88.1% of the time on those. Including them would be a measured 12pp regression on
 *      exactly the words that can be checked.
 *
 * Both are asserted mechanically, because a regeneration that forgot the exclusion would look fine.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { phonemizeWord, phonemizeWordRules } from "../src/languages/khmer/khmer.ts";

const KM = join(import.meta.dirname, "../src/languages/khmer");
const read = (f: string): Map<string, string> => {
    const m = new Map<string, string>();
    for (const line of readFileSync(join(KM, f), "utf8").split("\n")) {
        if (line.startsWith("#") || !line.includes("\t")) continue;
        const [k, v] = line.split("\t");
        if (k && v) m.set(k, v);
    }
    return m;
};
const lex = read("km-lexicon.tsv");
const dict = read("km-lexicon-dict.tsv");
const referee = new Set<string>();
for (const line of readFileSync(join(import.meta.dirname, "../tools/referee-eval/referees/km.wikipron-khm-broad.tsv"), "utf8").split("\n"))
    if (!line.startsWith("#") && line.includes("\t")) referee.add(line.split("\t")[0]!);

describe("khmer second-tier dictionary lexicon", () => {
    test("it is substantial and its licence is recorded", () => {
        expect(dict.size).toBeGreaterThan(50_000);
        const header = readFileSync(join(KM, "km-lexicon-dict.tsv"), "utf8").slice(0, 1200);
        expect(header).toContain("CC BY 4.0");
        expect(header).toContain("Google Inc.");
    });

    test("⚠ it never shadows a wikipron-verified entry", () => {
        const clash = [...dict.keys()].filter((w) => lex.has(w));
        expect(clash, `these are in both files; the exceptions lexicon must be the only source for them: ${clash.slice(0, 5).join(", ")}`).toEqual([]);
    });

    test("⚠ it contains NO word the referee covers — the exclusion that avoids a 12pp regression", () => {
        // For a referee word absent from the exceptions lexicon, the rules already match wikipron BY CONSTRUCTION
        // (the lexicon holds precisely the rule failures). The dictionary agrees with wikipron only 88.1% of the
        // time on those, so shipping them would make the engine worse on the words we can measure.
        const leaked = [...dict.keys()].filter((w) => referee.has(w));
        expect(leaked.length, `referee words leaked into the dictionary tier: ${leaked.slice(0, 5).join(", ")}`).toBe(0);
    });

    test("precedence is lexicon → dictionary → rules", () => {
        const [w, ipa] = [...lex][0]!;
        expect(phonemizeWord(w)).toBe(ipa);                       // tier 1 wins
        const [dw, dipa] = [...dict][0]!;
        expect(phonemizeWord(dw)).toBe(dipa);                     // tier 2 serves what tier 1 lacks
        expect(phonemizeWordRules(dw)).not.toBe(undefined);       // and the rule path still answers independently
    });

    test("⚠ the rule path reads NEITHER file, keeping the referee eval non-circular", () => {
        // If phonemizeWordRules ever consulted a lexicon, the referee number would measure the lexicon against its
        // own source. km's referee eval depends on this.
        const differing = [...dict].filter(([w, ipa]) => phonemizeWordRules(w) !== ipa);
        expect(differing.length, "the rule path appears to be reading the dictionary").toBeGreaterThan(1000);
    });

    test("a concrete instance: អាមេរិក reads -rik, which the rules get wrong", () => {
        // "America" is a-me-rik. The rules give ʔaːmeːrək with a schwa; neither wikipron nor the exceptions lexicon
        // covers the word, so it is exactly the population this file exists for.
        expect(phonemizeWordRules("អាមេរិក")).toBe("ʔaːmeːrək");
        expect(phonemizeWord("អាមេរិក")).toBe("ʔaːmeːrik");
    });
});

/**
 * The THIRD tier (kaikki) — same invariants, plus the precedence seam it introduces.
 *
 * `km-lexicon-kaikki.tsv` is en.wiktionary readings via kaikki — the SAME lineage as the wikipron referee,
 * which is why it can be a lexicon and can never be a referee. It sits BETWEEN the exceptions lexicon and the
 * Google dictionary: wikipron-VERIFIED beats a same-tradition reading, which beats the converted dictionary
 * (kaikki's conversion validates 97.7% against wikipron on 6,564 shared words; the dictionary's 78.3%).
 */
const kaikki = read("km-lexicon-kaikki.tsv");

describe("khmer third-tier kaikki lexicon", () => {
    test("it is real and its licence is recorded", () => {
        expect(kaikki.size).toBeGreaterThan(400);
        const header = readFileSync(join(KM, "km-lexicon-kaikki.tsv"), "utf8").slice(0, 1200);
        expect(header).toContain("CC BY-SA 4.0");
        expect(header).toContain("kaikki.org");
    });

    test("⚠ it contains NO word the referee covers — same-lineage leakage would be circular twice over", () => {
        const leaked = [...kaikki.keys()].filter((w) => referee.has(w));
        expect(leaked.length, `referee words leaked into the kaikki tier: ${leaked.slice(0, 5).join(", ")}`).toBe(0);
    });

    test("⚠ it never shadows a wikipron-verified entry", () => {
        const clash = [...kaikki.keys()].filter((w) => lex.has(w));
        expect(clash, `in both files; the exceptions lexicon must win: ${clash.slice(0, 5).join(", ")}`).toEqual([]);
    });

    test("it OVERRIDES the Google dictionary where both cover a word — the evidence ranking", () => {
        const shared = [...kaikki.keys()].filter((w) => dict.has(w) && kaikki.get(w) !== dict.get(w));
        expect(shared.length).toBeGreaterThan(50); // the seam is real, not vacuous
        for (const w of shared.slice(0, 3)) expect(phonemizeWord(w)).toBe(kaikki.get(w));
    });

    test("a concrete instance: កណ្តាល — the ⟨ត⟩-spelling of \"central\" — reads ɗ, not t", () => {
        // The common spelling កណ្ដាល (⟨ដ⟩) is a wikipron word; this ⟨ត⟩ variant (479× in the frequency table)
        // is not, and the rules read the letter written: kɑntaːl. kaikki carries the lexical reading.
        expect(phonemizeWordRules("កណ្តាល")).toBe("kɑntaːl");
        expect(phonemizeWord("កណ្តាល")).toBe("kɑnɗaːl");
    });
});
