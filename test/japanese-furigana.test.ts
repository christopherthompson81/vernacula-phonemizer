import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";

const ja = (s: string): string => phonemize(s, "ja");

// Furigana reaches a phonemizer as one of several FLATTENINGS of ruby markup, because true ruby positioning
// is not plain text. The two kinds get opposite treatment — see the header of japanese/normalize.ts.
describe("Japanese furigana", () => {
    // A parenthesised reading that says what the engine already says is redundant, and unclaimed it is
    // phonemized as ordinary text AFTER the kanji, so the reading comes out twice.
    it("reads a parenthesised reading once, not twice", () => {
        expect(ja("漢字（かんじ）")).toBe(ja("漢字"));
        expect(ja("漢字(かんじ)")).toBe(ja("漢字"));
        expect(ja("難読漢字（なんどくかんじ）")).toBe(ja("難読漢字"));
    });

    // The real test of the rewrite: an annotated sentence must be INDISTINGUISHABLE from the same sentence
    // written without the annotation — including at the token boundary the rewrite creates.
    it("is byte-identical to the un-annotated text in running prose", () => {
        expect(ja("東京（とうきょう）に行く")).toBe(ja("東京に行く"));
        expect(ja("漢字（かんじ）を読む")).toBe(ja("漢字を読む"));
        expect(ja("｜漢字《かんじ》を読む")).toBe(ja("漢字を読む"));
    });

    // ⚠ The guard for the parenthesised form is EQUALITY with the computed reading. These three are the
    // reason it cannot simply drop any parenthesised kana run.
    it("leaves a parenthetical that is NOT the reading alone", () => {
        // A gloss, not a reading of 日本.
        expect(ja("日本（にほんじん）")).toBe(`${ja("日本")} ${ja("にほんじん")}`);
        // An ALTERNATE reading, written precisely because it differs from the default — suppressing it
        // would delete the author's point.
        expect(ja("日本（にっぽん）")).toBe(`${ja("日本")} ${ja("にっぽん")}`);
        // A katakana gloss of a loanword.
        expect(ja("会議（ミーティング）")).toBe(`${ja("会議")} ${ja("ミーティング")}`);
    });

    // ⚠ A DECLARED annotation is authoritative: the author has stated the reading, so it overrides the
    // engine's default. This is the opposite of the parenthesised case.
    it("lets a declared ruby override the default reading", () => {
        expect(ja("｜日本《にっぽん》")).toBe(ja("にっぽん"));
        expect(ja("￹日本￺にっぽん￻")).toBe(ja("にっぽん"));
        // …and the default is genuinely different, or the assertion above would prove nothing.
        expect(ja("日本")).not.toBe(ja("にっぽん"));
    });
});
