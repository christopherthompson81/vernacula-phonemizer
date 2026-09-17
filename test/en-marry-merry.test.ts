/**
 * THE marry–merry MERGER: merged in the parent (GenAm/Canadian), UNDONE for RP.
 *
 * GenAm and Canadian English have marry = merry = Mary; SSBE keeps `marry` /ˈmæri/ apart from `merry`
 * /ˈmɛri/. The parent's dictionary was INCOHERENT about it rather than consistently either — 208 rows `æ`
 * and 147 `ɛ` in the same ⟨arr⟩+vowel environment, with the same stem going both ways:
 *
 *     arrogate  AE   but  arrogance / arrogant  EH
 *     arrow     AE   but  arrowroot             EH
 *     marry / merry / Mary already merged, while carry / barrel / baron were not
 *
 * ⚠ THIS IS THE SAME SHAPE AS LOT–THOUGHT (#1334) AND WAS SETTLED THE SAME WAY. Where a dictionary is
 * internally incoherent, any consistent choice is an improvement and the reference decides which: misaki
 * gold is merged in 66 of 66 covered words with NO counterexamples, and it is the lexicon the downstream
 * model was trained on.
 *
 * ⚠ NEITHER REFEREE CAN ARBITRATE THIS, which is why gold and coherence decide it. The US wikipron file is
 * itself split — 60 rows merged against 27 unmerged, `Garrett` beside `Barrett` — exactly as it writes
 * `dawn` as `dɑn` in the cot–caught case. Moby dissents (it distinguishes all three), but Moby is
 * demonstrably PRE-MERGER on every axis tested: it also keeps FORCE apart from NORTH and the conservative
 * yod in `seizure`.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phonemize } from "../src/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

describe("marry–merry", () => {
    test("the parent merges all three", () => {
        const m = phonemize("marry", "en");
        expect(m).toBe("mˈɛɹi");
        expect(phonemize("merry", "en")).toBe(m);
        expect(phonemize("Mary", "en")).toBe(m);
    });

    test("and the merger is applied consistently, not word by word", () => {
        expect(phonemize("carry", "en")).toBe("kʰˈɛɹi");
        expect(phonemize("arrow", "en")).toBe("ˈɛɹoᶷ");
        expect(phonemize("barrel", "en")).toBe("bˈɛɹəɫ");
        // ⚠ THE SAME-STEM PAIRS THAT PROVED THE DICTIONARY WAS INCOHERENT. Both halves must now agree.
        expect(phonemize("arrogate", "en").slice(0, 3)).toBe(phonemize("arrogant", "en").slice(0, 3));
        expect(phonemize("arrow", "en").slice(0, 3)).toBe(phonemize("arrowroot", "en").slice(0, 3));
    });

    // ⚠ RP DOES NOT HAVE THE MERGER, so the parent's change has to be mapped back or the accent regresses.
    // Measured at the time: without this set en-GB fell from 53 matching referee rows in the class to 3.
    test("en-GB undoes it, and keeps merry apart", () => {
        expect(phonemize("marry", "en-GB")).toBe("mˈæɹi");
        expect(phonemize("merry", "en-GB")).toBe("mˈɛɹi");
        expect(phonemize("carry", "en-GB")).toBe("kʰˈæɹi");
    });

    // ⚠ A WORD LIST, NOT A RULE, and this is the case that says so: a blanket ɛɹ→æɹ would wrongly convert
    // the words that are genuinely ɛ in BOTH varieties.
    test("words that are ɛ in both varieties are untouched", () => {
        for (const w of ["merry", "very", "ferry", "error", "America"])
            expect(`${w}: ${phonemize(w, "en-GB")}`).toBe(`${w}: ${phonemize(w, "en-GB").replace(/æɹ/u, "ɛɹ")}`);
        expect(phonemize("very", "en-GB")).toBe("vˈɛɹi");
        expect(phonemize("America", "en-GB")).toBe("əmˈɛɹəkə");
    });

    // ⚠ AND SQUARE IS A DIFFERENT SET. The lexical block runs BEFORE the SQUARE rule, so a marry word's
    // prevocalic ɛɹ is still spelled ɛɹ when this fires; a preconsonantal one belongs to SQUARE and must
    // keep its centring diphthong.
    test("SQUARE words keep ɛə", () => {
        expect(phonemize("care", "en-GB")).toBe("kʰˈɛə");
        expect(phonemize("caretaker", "en-GB")).toBe("kʰˈɛəteᶦkə");
    });

    test("the set carries every word the parent moved, and only prevocalic ones", () => {
        const set = readFileSync(join(HERE, "..", "data", "languages", "english-gb", "en-gb-marry.tsv"), "utf8")
            .split("\n").filter((l) => l.includes("\t")).map((l) => l.split("\t")[0]!);
        expect(set.length).toBeGreaterThan(400);
        expect(new Set(set).size).toBe(set.length); // no duplicates
        // ⚠ FIRST-OCCURRENCE ONLY. Audited: `lariviere` lˈɛɹɪviʲɛɹ is the single member with two ɛɹ, and its
        // FIRST is the marry one, so the rule picks correctly. A future member with the reverse shape would
        // need the guard, which is why this is pinned rather than assumed.
        expect(phonemize("lariviere", "en-GB").startsWith("lˈæɹ")).toBe(true);
    });
});
