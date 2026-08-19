import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeHebrewNeural } from "../src/languages/hebrew/hebrewNeural.ts";

// The neural VOWEL RESTORER for UNVOCALIZED Hebrew is gated on the (optional) ONNX model + onnxruntime-node.
// When absent the path falls back to the sync rule engine (vocalized-only), so the fallback contract is testable
// everywhere; the restoration assertions run only with the model present. See he-tagger.PROVENANCE.md.
const haveModel = existsSync(join(import.meta.dirname, "../src/languages/hebrew/he-tagger.int8.onnx"));

describe("hebrew neural vowel restoration", () => {
    // A VOCALIZED word is always routed to the deterministic rule g2p (the tagger declines on niqqud chars), so
    // vocalized text is identical to the sync path whether or not the model is present.
    test("vocalized text: neural path equals the sync rule path", async () => {
        for (const s of ["שָׁלוֹם", "מָשִׁיחַ", "אֶבֶן"]) {
            expect(await phonemizeHebrewNeural(s)).toBe(phonemize(s, "he"));
        }
    });

    describe.skipIf(!haveModel)("with the ONNX model present", () => {
        // UNVOCALIZED text: the sync engine gives only a vowel-less consonant skeleton (ʃlvm ʔvlm); the tagger
        // restores the vowels to readable Modern Israeli IPA.
        test("unvocalized text: the tagger restores vowels the sync skeleton lacks", async () => {
            const neural = await phonemizeHebrewNeural("שלום עולם");
            expect(neural).not.toBe(phonemize("שלום עולם", "he"));
            expect(neural).toBe("ʃalom ʔolam");
        });

        test("a common unvocalized phrase restores correctly", async () => {
            expect(await phonemizeHebrewNeural("אני אוהב אותך")).toBe("ʔani ʔohev ʔotχa"); // sentence context → present-tense ohev; אותך masc. "you" = otχa
        });

        /**
         * ⚠ ONE UNREADABLE WORD MUST NOT COST THE SENTENCE ITS VOWELS. The tagger returns an EMPTY STRING
         * for any word carrying a geresh or gershayim — צ׳ ג׳ ז׳ ח׳, the marks Hebrew writes foreign
         * consonants with, and ד״ר for an abbreviation — because its charset has none of them. The
         * alignment guard used to send the WHOLE clause run to the rule engine on any mismatch, and on
         * unvocalized input that is a bare consonant skeleton, so a single transliterated name flattened
         * every vowel around it.
         *
         * Measured over the he_il corpus: 7.6% of clause runs tripped it, 216 of 3,242 rows (6.6%) came out
         * as skeletons, and their median distance against the recognized phones was 0.649 against 0.342 for
         * the vocalized rows. Retrying word by word takes the skeleton rows to ZERO — 330 rows closer to
         * what the reader said, 28 further, median 0.352 → 0.341.
         *
         * ⚠ NOT FIXABLE BY NORMALISING THE MARK: the model fails on the ASCII apostrophe and on U+05F3 /
         * U+05F4 alike, and reads the same word fine with the mark removed. Only the geresh WORD degrades
         * now, and it degrades to a consonantally-correct skeleton (צ׳ is still read /t͡ʃ/ by the rules).
         */
        test("a geresh word degrades alone, not the clause around it", async () => {
            const out = await phonemizeHebrewNeural("צ'מברס תבע את אלוהים");
            expect(out).toContain("t͡ʃmvʁs");        // the geresh word: no vowels, right consonants
            expect(out).toContain("tava ʔet ʔelohim"); // and everything else is fully restored
        });

        test("a mid-sentence geresh name leaves the rest vocalized", async () => {
            const out = await phonemizeHebrewNeural("אך ראש הממשלה ג'ון האוורד אמר");
            expect(out).toContain("ʔaχ ʁoʃ hamemʃala");
            expect(out).toContain("ʔamaʁ");
        });
    });
});
