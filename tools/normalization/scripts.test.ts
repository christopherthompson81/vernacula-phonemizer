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
