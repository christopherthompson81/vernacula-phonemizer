/**
 * A REWRITE WHOSE REPLACEMENT EQUALS THE MATCH MUST NOT COLLAPSE THE MAPPING UNDER IT.
 *
 * ⚠ `normalizeRomans` RUNS OVER EVERY LANGUAGE AND RETURNS MOST TOKENS UNCHANGED. It rewrites with
 * `\p{L}+` and its evaluator hands the token straight back whenever it is not a Roman numeral — which
 * in a NON-SPACING SCRIPT is the whole clause, because there are no word breaks for `\p{L}+` to stop
 * at. Stamping the match's span across the replacement then mapped every character of
 * `PDFファイルを開いてください` to [0,15), so all three tokens reported the WHOLE INPUT as their
 * `inputSpan`.
 *
 * ⚠ AND A WHOLE-INPUT SPAN IS WORSE THAN A NULL, WHICH IS WHY IT SURVIVED. `inputSpan`'s contract is
 * "absent means NOT KNOWN, never identical" and a consumer degrades correctly on absent — this is a
 * known-LOOKING answer to an unknown question, and it passes every count and tiling check a consumer
 * can apply. Reported by a downstream consumer measuring highlight granularity; 14 of 123 ja golden
 * rows carried it, every one of them mixed-script, because a Latin letter is what defeats
 * `normalizeRomans`'s no-Roman-letters fast path.
 *
 * ⚠ AND THE FAST PATH IS WHY PURE-KANA ROWS LOOKED FINE. `if (!/[ivxlcdmIVXLCDM]/u.test(text)) return`
 * — a sentence with no Latin never reaches the rewrite at all, so the defect was invisible in exactly
 * the rows anyone would reach for first when testing Japanese.
 */
import { describe, expect, it } from "vitest";
import { phonemizeTrace } from "../src/index.ts";

describe("provenance through an unchanged match", () => {
    it("maps an expanded Latin run to the Latin run, not to the whole clause", () => {
        const s = "PDFファイルを開いてください。";
        const t = phonemizeTrace(s, "ja");
        const at = (i: number): string => {
            const sp = t.tokens[i]!.inputSpan;
            return sp === undefined ? "null" : s.slice(sp[0], sp[1]);
        };
        expect(t.tokens.map((_, i) => at(i))).toEqual(["PDF", "ファイルを", "開いてください", "。"]);
    });

    it("gives no token the WHOLE INPUT, which is the property actually at stake", () => {
        // ⚠ THIS USED TO ASSERT THAT EVERY SPAN IS DISTINCT, WHICH IS NOT TRUE IN GENERAL AND THIS FILE
        // SAYS SO TWO PARAGRAPHS UP: a numeral expansion legitimately produces several tokens from ONE
        // source span, and 4,262 golden rows share a span correctly. The assertion happened to hold for
        // this string and would have mis-fired as a "regression" the moment it gained a number.
        // ⚠ THE CONSUMER'S OWN GATE COULD NOT SEE THE DEFECT EITHER. It declines its measured tier when
        // the group count and the map count disagree — and here they AGREED, every entry pointing at the
        // same span. Being degenerate is invisible to a count check in the same way being one-out is,
        // which is why the gate has to be on the thing that would differ.
        const s = "PDF\u30d5\u30a1\u30a4\u30eb\u3092\u958b\u3044\u3066\u304f\u3060\u3055\u3044\u3002";
        const t = phonemizeTrace(s, "ja");
        for (const k of t.tokens) {
            const sp = k.inputSpan;
            expect([k.surface, sp !== undefined]).toEqual([k.surface, true]);
            expect([k.surface, sp![1] - sp![0] < s.length]).toEqual([k.surface, true]);
        }
    });

    it("leaves a pure-kana sentence alone, which is where the fast path already worked", () => {
        const s = "彼女は新しい本を読んでいます。";
        const t = phonemizeTrace(s, "ja");
        expect(t.tokens.map((k) => (k.inputSpan ? s.slice(k.inputSpan[0], k.inputSpan[1]) : "null")))
            .toEqual(["彼女は", "新しい", "本を", "読んで", "います", "。"]);
    });
});
