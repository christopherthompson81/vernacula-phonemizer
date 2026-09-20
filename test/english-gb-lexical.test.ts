/**
 * The en-GB LEXICAL-VARIANT table — the layer that exists because the other five are accent deltas and
 * some British/American differences are not accent at all.
 *
 * ⚠ THE INVARIANT THAT MATTERS IS THE ONE-WAY-NESS. This table may change what en-GB says and must never
 * change what `en` says: CMUdict's `aluminium AH0 L UW1 M IH0 N AH0 M` is a GenAm reference deliberately
 * reading the British SPELLING as the American WORD, which is correct for `en` and is what `en` ships. The
 * defect was that en-GB inherited it with nowhere to say otherwise.
 */
import { describe, expect, it } from "vitest";

import { phonemize } from "../src/index.ts";
import { lexicalVariants, phonemizeWord, phonemizeWordRules } from "../src/languages/english-gb/english-gb.ts";

describe("en-GB lexical variants", () => {
    it("reads aluminium as the British word, not the American one", () => {
        // Five syllables, stress on MIN. The GenAm reading is four with the stress on LU, and no accent
        // rule can travel between them — which is the whole reason this table exists.
        expect(phonemizeWord("aluminium")).toBe("ˌæljʊmˈɪniəm");
    });

    it("leaves the GenAm reading of the same spelling alone", () => {
        // The one-way-ness. `en` keeps CMUdict's row; only the accent variant overrides it.
        expect(phonemize("aluminium", "en")).toBe(phonemize("aluminium", "en"));
        expect(phonemize("aluminium", "en")).not.toBe(phonemizeWord("aluminium"));
        expect(phonemize("aluminium", "en")).not.toContain("æljʊ");
    });

    it("is off on the rule-only path, so the referee eval stays non-circular", () => {
        // Same contract the five lexical sets have: phonemizeWordRules is the honest signal, and a table
        // mined from the referee must not be able to flatter a score measured against it.
        expect(phonemizeWordRules("aluminium")).not.toBe(phonemizeWord("aluminium"));
    });

    it("still runs the full accent delta over the substituted citation", () => {
        // clerk is stored `klˈɑːɹk` in the PARENT's alphabet; START + non-rhoticity produce the British
        // form. If the table were storing finished SSBE the rule would be bypassed and this would drift
        // the first time any rhotic rule changed.
        expect(phonemizeWord("clerk")).toBe("klˈɑːk");
        expect(phonemizeWord("herb")).toBe("hˈɜːb");     // NURSE ɝ → ɜː, and Britain keeps the /h/
        expect(phonemizeWord("lever")).toBe("lˈiːvə");   // lettER ɚ → ə
    });

    it("lets a variant take a lexical-set membership like any other word", () => {
        // tomato's British vowel is PALM, so it is in en-gb-palm.tsv; without that row the LOT rule
        // would turn the ɑː this table supplies straight into ɒ.
        expect(phonemizeWord("tomato")).toBe("təmˈɑːtəᶷ");
    });

    it("owns every word it lists, so the set builder cannot claim one into an accent set", () => {
        // aluminium was in en-gb-yod.tsv: the builder's coronal-yod probe saw `luː` with no yod where the
        // referee attests one and filed it under yod-retention. An accent set claiming a lexical variant
        // is worse than not covering it, because the membership reads as though it had been handled.
        const owned = lexicalVariants();
        expect(owned.has("aluminium")).toBe(true);
        expect(owned.size).toBeGreaterThan(0);
    });

    it("produces a reading for every row it lists", () => {
        // A row whose key never matches — a stray capital, a trailing space — is silently inert, which is
        // exactly the failure this table is meant to fix.
        for (const word of lexicalVariants()) {
            expect(word, `"${word}" is not a bare lowercase headword`).toMatch(/^[a-z]+$/u);
            expect(phonemizeWord(word)).not.toBe(phonemizeWordRules(word));
        }
    });
});
