/**
 * THE FRENCH NEURAL PRE-PASS SCANS THE NORMALIZED TEXT (#1463, the shape English fixed in #1452).
 *
 * ⚠ IT SCANNED THE CALLER'S RAW INPUT, so a word the NORMALIZER creates (a unit word, a spelled-out letter,
 * a number word) was never offered to the tagger. On today's model and corpus that changes NO reading: every
 * normalizer-emitted word the tagger misreads is a supplement row, and it reads the rest as the rule g2p does.
 * So the scan is observed where it acts, at the TAGGER CALL, through a recording wrapper on the real tagger.
 * (Not `vi.mock`: the suite shares one module registry per worker, so a mocked factory may never be called.)
 *
 * ⚠ AND THE ORDER OF THE FIX MATTERED. The spelled-out letters `effe`, `emme`, `ji` miss Lexique, and the
 * tagger reads them ef, ɑ̃m, dʒi. Moving the scan alone regressed 18 FLEURS texts. supplement.tsv carries
 * every letter name Lexique lacks, `frenchHasWord` keeps them away from the tagger, and the walk below keeps
 * the two in step.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { phonemize } from "../src/index.ts";
import { loadTsvMap } from "../src/core/loadTsv.ts";
import { createFrenchForPrepass, frenchHasWord, phonemizeWord } from "../src/languages/french/french.ts";
import { frenchPrepassWith } from "../src/languages/french/frenchNeural.ts";
import { createFrenchTagger } from "../src/languages/french/frenchTagger.ts";
import { MANIFEST } from "../src/languages/french/manifest.ts";
import { normalizeFrench } from "../src/languages/french/normalize.ts";

const haveModel = existsSync(join(import.meta.dirname, "../data/languages/french/fr-g2p-tagger.int8.onnx"));
const norm = (t: string): string => createFrenchForPrepass().normalizedFor(t);

const run = async (text: string): Promise<{ asked: string[]; ipa: string }> => {
    const tagger = await createFrenchTagger();
    if (!tagger) throw new Error("fr tagger unavailable");
    const asked: string[] = [];
    const ipa = await frenchPrepassWith({ tag: (w) => { asked.push(w); return tagger.tag(w); } }, text);
    return { asked, ipa };
};

describe("every letter name is answered by Lexique or the supplement (#1463)", () => {
    // ⚠ supplement.tsv's letter-name rows are a hand-kept copy of `letterNames`. Without a row, a letter
    // name Lexique lacks reaches the tagger, which misread three of them and regressed 18 FLEURS texts.
    // This walk fails on any letterNames edit that is not matched by a row.
    const words = [...new Set(Object.values(MANIFEST.letterNames).flatMap((n) => n.split(" ")))];
    it("the walk is not vacuous", () => expect(words.length).toBeGreaterThanOrEqual(26));
    it.each(words)("%s", (w) => expect(frenchHasWord(w.toLowerCase())).toBe(true));
});

describe("kilooctet is Lexique's kilo + octet (#1463)", () => {
    // Neither the tagger's kilɔktɛ (drops kilo's vowel) nor the g2p's kilɔɔktɛ (opens it). The expectation is
    // DERIVED from Lexique's own rows, so a re-import of Lexique moves it with them.
    const lex = loadTsvMap(new URL("../src/languages/french/french.ts", import.meta.url).href, "lexicon.tsv");
    it.each([["kilooctet", "octet"], ["kilooctets", "octets"]])("%s", (w, tail) => {
        expect(lex.has(w)).toBe(false); // premise: Lexique lacks it, so the supplement row is what answers
        expect(phonemizeWord(w)).toBe(lex.get("kilo")! + lex.get(tail)!);
    });
});

describe.skipIf(!haveModel)("the French neural pre-pass scans the normalized text (#1463)", () => {
    it("⚠ the tagger is PRESENT, or every assertion below is vacuous", async () => {
        expect(await createFrenchTagger()).toBeDefined();
    });

    it("a unit word the symbol tier creates is offered to the tagger", async () => {
        // ⚠ THE PREMISE FIRST: the raw text does not contain the word, the normalized text does.
        expect(norm("un fichier de 5 Mo")).toContain("mégaoctets");
        expect((await run("un fichier de 5 Mo")).asked).toContain("mégaoctets");
    });

    it.each(["la FM", "le J. Martin", "la RTJ", "un fichier de 5 ko"])(
        "%s: a supplement word is NOT offered to the tagger, and reads as the sync path",
        async (t) => {
            expect(norm(t)).toMatch(/\b(?:effe|emme|ji|kilooctets?)\b/u); // premise: the normalizer emits it
            const { asked, ipa } = await run(t);
            for (const w of ["effe", "emme", "ji", "kilooctet", "kilooctets"]) expect(asked).not.toContain(w);
            // The sync path reads these from the supplement: the reading the tagger would have replaced.
            expect(ipa).toBe(phonemize(t, "fr"));
        },
    );
});

describe("normalizeFrench takes no lexicon (#1463)", () => {
    it("has one parameter: the acronym decision is normalizeFrenchInitialisms's", () => {
        // It took an `isWord` it never read, documented as deciding acronym-vs-initialism.
        expect(normalizeFrench.length).toBe(1);
    });
});
