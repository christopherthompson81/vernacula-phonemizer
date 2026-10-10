/**
 * THE FRENCH NEURAL PRE-PASS SCANS THE NORMALIZED TEXT (#1463, the shape English fixed in #1452).
 *
 * ⚠ IT SCANNED THE CALLER'S RAW INPUT, so a word the NORMALIZER creates (a unit word, a spelled-out letter,
 * a number word) was never offered to the tagger. On today's model and corpus that changes NO reading: every
 * normalizer-emitted word the tagger misreads is a supplement row, and it reads the rest as the rule g2p does.
 * So the scan is observed where it acts, at the TAGGER CALL, through a recording wrapper on the real tagger.
 * (Not `vi.mock`: the suite shares one module registry per worker, so a mocked factory may never be called.)
 *
 * ⚠ AND THE ORDER OF THE FIX MATTERED. The spelled-out letters `effe`, `emme`, `ji` and the unit word
 * `kilooctet` miss Lexique, and the tagger reads them ef, ɑ̃m, dʒi, kilɔktɛ where the g2p is right. Moving
 * the scan alone regressed 18 FLEURS texts. supplement.tsv carries them, and `frenchHasWord` keeps them
 * away from the tagger.
 */
import { describe, expect, it } from "vitest";

import { phonemize } from "../src/index.ts";
import { createFrench } from "../src/languages/french/french.ts";
import { frenchPrepassWith } from "../src/languages/french/frenchNeural.ts";
import { createFrenchTagger } from "../src/languages/french/frenchTagger.ts";
import { normalizeFrench } from "../src/languages/french/normalize.ts";

const run = async (text: string): Promise<{ asked: string[]; ipa: string }> => {
    const tagger = await createFrenchTagger();
    if (!tagger) throw new Error("fr tagger unavailable");
    const asked: string[] = [];
    const ipa = await frenchPrepassWith({ tag: (w) => { asked.push(w); return tagger.tag(w); } }, text);
    return { asked, ipa };
};

describe("the French neural pre-pass scans the normalized text (#1463)", () => {
    it("⚠ the tagger is PRESENT, or every assertion below is vacuous", async () => {
        expect(await createFrenchTagger()).toBeDefined();
    });

    it("a unit word the symbol tier creates is offered to the tagger", async () => {
        // ⚠ THE PREMISE FIRST: the raw text does not contain the word, the normalized text does.
        expect(createFrench().normalizedFor("un fichier de 5 Mo")).toContain("mégaoctets");
        expect((await run("un fichier de 5 Mo")).asked).toContain("mégaoctets");
    });

    it.each(["la FM", "le J. Martin", "la RTJ", "un fichier de 5 ko"])(
        "%s: a supplement word is NOT offered to the tagger, and reads as the sync path",
        async (t) => {
            expect(createFrench().normalizedFor(t)).toMatch(/\b(?:effe|emme|ji|kilooctets?)\b/u); // premise
            const { asked, ipa } = await run(t);
            for (const w of ["effe", "emme", "ji", "kilooctet", "kilooctets"]) expect(asked).not.toContain(w);
            // The sync path reads these with the g2p's own value: the reading the tagger would have replaced.
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
