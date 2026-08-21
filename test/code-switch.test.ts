import { describe, expect, it } from "vitest";
import { codeSwitchSegments, stripCodeSwitch } from "../tools/corpus/code_switch.mts";

/** The tags a test needs; the real caller passes the registry's resolver. */
const known = (c: string): boolean => ["en", "fr", "es", "sw"].includes(c);

describe("code-switch markup for read_text", () => {
    it("splits a span out and leaves the host text to the host", () => {
        const segs = codeSwitchSegments("miapil siya sa {en:nineteen forty five} ug nagpabilin", "ceb", known);
        expect(segs.map((s) => [s.text.trim(), s.lang ?? "(host)"])).toEqual([
            ["miapil siya sa", "(host)"],
            ["nineteen forty five", "en"],
            ["ug nagpabilin", "(host)"],
        ]);
    });

    it("carries TEXT and a language, never phones — every segment still reaches an engine", () => {
        // The whole point: no segment may be IPA, so no row can assert its own answer.
        for (const s of codeSwitchSegments("a {en:one two} b", "ceb", known)) {
            expect(s.text).not.toMatch(/[ˈˌː]/u);
        }
    });

    it("an unknown tag throws rather than reaching the host as literal braces", () => {
        expect(() => codeSwitchSegments("a {xx:one} b", "ceb", known))
            .toThrow(/unknown language tag/u);
    });

    it("text with no span is one host segment, unchanged", () => {
        expect(codeSwitchSegments("walay numero dinhi", "ceb", known))
            .toEqual([{ text: "walay numero dinhi" }]);
    });

    it("does NOT treat a bare brace or a non-tag as markup", () => {
        // Both must reach the host untouched rather than being parsed as a span.
        expect(codeSwitchSegments("a { b } c", "ceb", known)).toEqual([{ text: "a { b } c" }]);
        expect(codeSwitchSegments("a {EN:x} c", "ceb", known)).toEqual([{ text: "a {EN:x} c" }]);
    });

    it("is not confused by two spans or by a span at either edge", () => {
        const segs = codeSwitchSegments("{en:one} mid {fr:deux}", "ceb", known);
        expect(segs.map((s) => s.lang ?? "(host)")).toEqual(["en", "(host)", "fr"]);
    });

    it("is not stateful across calls (the global-regex trap)", () => {
        const t = "a {en:x} b";
        const runs = [0, 1, 2].map(() => codeSwitchSegments(t, "ceb", known).length);
        expect(runs).toEqual([runs[0], runs[0], runs[0]]);
        expect(runs[0]).toBe(3);
    });

    it("marks a span that abuts the previous segment as TIGHT — code-switching is not always at a word boundary", () => {
        // Shona takes English stems under its noun-class prefixes: `maneutron`, read *maɲuːtrɔn*. Joining
        // on a space would invent a word break the speaker did not make, and the distance metric strips
        // whitespace so it would never show up there.
        const tight = (t: string): string =>
            codeSwitchSegments(t, "sn", known).map((s) => (s.tight ? "+" : "·") + (s.lang ?? "host")).join(" ");
        expect(tight("ma{en:neutron} uye")).toBe("·host +en ·host");
        expect(tight("nezve{en:asset management}")).toBe("·host +en");
        expect(tight("sa {en:nineteen} ug")).toBe("·host ·en ·host");   // space in source → not tight
        expect(tight("{en:nucleus} inoumbwa")).toBe("·en ·host");       // first segment is never tight
        expect(tight("a {en:x}{en:y} b")).toBe("·host ·en +en ·host");  // span abutting a span
    });

    it("strips back to the plain reading", () => {
        expect(stripCodeSwitch("miapil sa {en:nineteen forty five} ug")).toBe("miapil sa nineteen forty five ug");
    });

    it("an empty span contributes nothing rather than an empty segment", () => {
        expect(codeSwitchSegments("a {en: } b", "ceb", known).every((s) => s.text.trim() !== "")).toBe(true);
    });
});
