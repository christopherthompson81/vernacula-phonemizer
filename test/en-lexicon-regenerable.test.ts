/**
 * ⚠ THE FLAT LEXICON MUST STAY REPRODUCIBLE FROM ITS ARPABET SOURCE, because the two paths that answer for
 * a word are different code: `accent-lexicon.tsv` serves recorded words and `makeArpabetToIpa` serves OOV
 * ones. A change to the converter (or to `isBarredI` inside it) that is not propagated into the lexicon
 * leaves them disagreeing about the SAME environment — a recorded plural spelled one way and an unrecorded
 * one another — and nothing in the suite notices.
 *
 * That is not hypothetical: it is exactly what #1275 had to repair, and the repair is only durable if the
 * invariant is a gate. Rebuild with `npx tsx tools/english/en_rebuild_lexicon.mts --write`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { makeArpabetToIpa } from "../src/languages/english/englishArpabet.ts";
import { MANIFEST } from "../src/languages/english/manifest.ts";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "languages", "english");

describe("the English lexicon regenerates from its ARPABET source", () => {
    test("every sourced row reproduces byte-identically", () => {
        const toIpa = makeArpabetToIpa(MANIFEST.arpabet);
        const arpabet = new Map<string, string[]>();
        for (const line of readFileSync(join(DATA, "g2p-dict.tsv"), "utf8").split("\n")) {
            if (!line || line.startsWith("#")) continue;
            const [word, phones] = line.split("\t");
            if (word && phones) arpabet.set(word, phones.trim().split(" "));
        }
        let sourced = 0;
        const drift: string[] = [];
        for (const line of readFileSync(join(DATA, "accent-lexicon.tsv"), "utf8").split("\n")) {
            if (!line || line.startsWith("#")) continue;
            const fields = line.split("\t");
            const word = fields[0], ipa = fields[2]?.trim();
            if (fields.length !== 3 || !word || !ipa) continue;
            const phones = arpabet.get(word);
            if (!phones) continue; // no source to regenerate from — passed through by the rebuilder too
            sourced++;
            const rebuilt = toIpa(phones, word);
            if (rebuilt !== ipa && drift.length < 8) drift.push(`${word}: lexicon=${ipa} rebuilt=${rebuilt}`);
        }
        expect(sourced).toBeGreaterThan(100_000); // the source is present, not silently empty
        expect(drift).toEqual([]);
    });
});
