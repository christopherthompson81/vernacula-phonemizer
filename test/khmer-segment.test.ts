/**
 * Khmer word segmentation — the properties the iteration mark ៗ depends on.
 *
 * The vocabulary is harvested from writer-typed U+200B boundaries in a wiki dump, so these fixtures are
 * real Khmer words with real corpus frequencies behind them, and the counts quoted in comments are from that
 * corpus. What is asserted is deliberately narrow: this module is ~55% accurate on the last boundary against
 * inconsistent human gold, so pinning individual interior splits would pin noise. The tests hold the STRUCTURAL
 * guarantees instead — the ones a caller can rely on and a refactor could break silently.
 */
import { describe, expect, test } from "vitest";
import { segmentKhmer, lastKhmerWord } from "../src/languages/khmer/segment.ts";

describe("Khmer segmentation", () => {
    test("a single high-frequency word is never split", () => {
        // These are the four commonest ៗ antecedents in the corpus: ផ្សេង ×840, ធំ ×214, ថ្មី ×193, តូច ×130.
        // Splitting any of them would make the reduplication rule repeat a fragment instead of a word.
        for (const w of ["ផ្សេង", "ធំ", "ថ្មី", "តូច", "នីមួយ"])
            expect(segmentKhmer(w), w).toEqual([w]);
    });

    test("a two-word compound is split, and the LAST word is what the ៗ rule takes", () => {
        // `អារម្មណ៍នោះ` = "that feeling"; ៗ after it reduplicates នោះ, not the whole phrase. This is the case the
        // shipped pronunciation lexicon could not do — of the top-40 antecedents only 12% are lexicon entries,
        // and ZERO have a lexicon word as a proper suffix, which is why frequency data was needed instead.
        expect(segmentKhmer("អារម្មណ៍នោះ")).toEqual(["អារម្មណ៍", "នោះ"]);
        expect(lastKhmerWord("អារម្មណ៍នោះ")).toBe("នោះ");
        expect(lastKhmerWord("ពាក្យថ្មី")).toBe("ថ្មី");
    });

    test("segmentation is a partition — nothing is lost, duplicated or reordered", () => {
        // The invariant that matters most: whatever the boundaries, joining them must reproduce the input.
        // A Viterbi backtrace off by one would corrupt text while still looking plausible in a spot check.
        for (const s of ["អារម្មណ៍នោះ", "សិក្សាផ្នែកផ្សេង", "ជារឿយ", "ព្រះរាជាណាចក្រកម្ពុជា", "ធំ"])
            expect(segmentKhmer(s).join(""), s).toBe(s);
    });

    test("an unknown run is returned whole rather than shredded into characters", () => {
        // Out-of-vocabulary spans are charged PER CHARACTER precisely so this holds: without that, Viterbi
        // splits an unknown run into single letters, which would make the ៗ rule repeat one consonant.
        const nonsense = "ឡបខឆឈឌឍឋ";
        const parts = segmentKhmer(nonsense);
        expect(parts.join("")).toBe(nonsense);
        expect(parts.length).toBeLessThan(nonsense.length);
    });

    test("degenerate inputs are safe", () => {
        expect(segmentKhmer("")).toEqual([""]);
        expect(segmentKhmer("ក")).toEqual(["ក"]);
        expect(lastKhmerWord("")).toBe("");
    });

    test("repeated calls are stable, and the memo cannot change an answer", () => {
        // The module memoises because Viterbi is its hot path; a memo keyed or invalidated wrongly would make
        // output depend on call order, which for a committed artifact pipeline is a silent diff generator.
        const a = segmentKhmer("សិក្សាផ្នែកផ្សេង");
        const b = segmentKhmer("សិក្សាផ្នែកផ្សេង");
        expect(b).toEqual(a);
        expect(lastKhmerWord("សិក្សាផ្នែកផ្សេង")).toBe(a[a.length - 1]);
    });
});
