/**
 * The native-script filter — the properties that keep it from discarding real evidence.
 *
 * ⚠ WHY THIS EXISTS. `selectCells` is adversarial: it prefers symbol-dense segments, and foreign-language prose
 * in a non-Latin wiki is symbol-dense (prices, box-office figures, markup). So English articles quoted inside a
 * Khmer wiki were over-represented in the very tier `review.ts` gates on — 47 of km's 253 cells — and their
 * `US$` drops were reported as Khmer reading gaps. The filter's job is to remove those WITHOUT removing Khmer
 * sentences that merely quote a foreign name, which is the failure mode that would silently shrink the corpus.
 */
import { describe, expect, test } from "vitest";
import { dominantScript, isNativeSegment, scriptCounts } from "./scripts.ts";
import { scriptProbe } from "./mine.ts";

const KM = "អក្សរខ្មែរ".repeat(40);      // enough Khmer to clear the evidence floor
const EN = "the quick brown fox ".repeat(40);

describe("dominantScript", () => {
    test("infers the corpus script instead of trusting a language code", () => {
        expect(dominantScript(KM)).toBe("Khmer");
        expect(dominantScript(EN)).toBe("Latin");
    });

    test("returns undefined on thin evidence, so callers fail OPEN", () => {
        // Filtering a corpus on a guess would discard real text. Below the floor, nothing is filtered at all.
        expect(dominantScript("អក្សរ")).toBeUndefined();
        expect(dominantScript("")).toBeUndefined();
    });

    test("returns undefined for a genuine two-script mix rather than picking a side", () => {
        // A corpus that is half Latin has no single native script; filtering against either half loses evidence.
        expect(dominantScript(KM + EN)).toBeUndefined();
    });
});

describe("isNativeSegment", () => {
    test("a Khmer sentence quoting a foreign name SURVIVES", () => {
        // The conservative half of the test: the presence of Latin is not evidence of foreignness.
        expect(isNativeSegment("សួនទឹក Garden City Water Park ដែលជាសួនទឹក", "Khmer")).toBe(true);
    });

    test("wholly foreign prose is discarded", () => {
        expect(isNativeSegment("Willie Chan had become Jackie's personal manager", "Khmer")).toBe(false);
    });

    test("⚠ a NATIVE-DIGIT year does not make English prose native", () => {
        // The digits ០-៩ are script=Khmer, so testing the script alone let this exact shape through — wiki
        // timeline entries — and 17 of km's cells were still foreign after the first version of the filter.
        expect(isNativeSegment("២០០៥ - Influenced by Live 8, the G8 leaders pledged", "Khmer")).toBe(false);
        expect(isNativeSegment("១៨៦៣ - United States begins first military draft", "Khmer")).toBe(false);
    });

    test("a Latin-script corpus is never filtered", () => {
        // Latinized orthographies are legitimate: for these languages a Latin-only segment is the normal case.
        expect(isNativeSegment("anything at all", "Latin")).toBe(true);
        expect(isNativeSegment("anything at all", undefined)).toBe(true);
    });

    test("an unlisted script fails open rather than discarding the whole corpus", () => {
        expect(isNativeSegment("whatever", "Nonesuch_Script")).toBe(true);
    });
});

describe("scriptCounts", () => {
    test("counts each script once per character, and ignores punctuation and digits it cannot name", () => {
        const c = scriptCounts("abcអក្សរ");
        expect(c.get("Latin")).toBe(3);
        expect(c.get("Khmer")).toBeGreaterThan(0);
    });
});

describe("scriptProbe — the bound must be structural, not applied afterwards", () => {
    test("⚠ a corpus far larger than the budget does not build one giant string", () => {
        // `segments.join("\n").slice(0, 400_000)` threw `RangeError: Invalid string length` on hy's 1.4 GB dump:
        // the join materialises everything before the slice can narrow it. This is the same Node string ceiling
        // that once made tt, arz, ka and eu unminable, so the bound belongs INSIDE the probe.
        const many = Array.from({ length: 200_000 }, (_, i) => `segment number ${i} with some filler text`);
        const probe = scriptProbe(many);
        expect(probe.length).toBeLessThanOrEqual(400_000);
        expect(probe.length).toBeGreaterThan(0);
    });

    test("it strides rather than truncating the head", () => {
        // The first 400 KB of a dump is whatever the alphabet put first; a corpus whose opening articles are
        // foreign would otherwise have its script inferred from them.
        const segs = [...Array.from({ length: 5_000 }, () => "aaaa"), ...Array.from({ length: 5_000 }, () => "zzzz")];
        expect(scriptProbe(segs)).toContain("zzzz");
    });

    test("and it is deterministic, because the artifact it feeds is committed", () => {
        const segs = Array.from({ length: 3_000 }, (_, i) => `s${i}`);
        expect(scriptProbe(segs)).toBe(scriptProbe(segs));
    });
});
