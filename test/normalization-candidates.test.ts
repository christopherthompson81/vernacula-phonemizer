/**
 * The minable-wiki triage (#585) — that a failed request can never masquerade as a fact about a wiki.
 *
 * WHY THIS EXISTS. `classify` decides, from one HTTP response, whether a language has a wiki worth mining. An
 * earlier version folded every failure into a single `undefined` and read that as "this project never
 * launched", so a second run of the tool in quick succession reported two dozen live wikis — one of them with
 * 269 million words of article text — as never having existed. Concurrency had dropped the connections, and a
 * dropped connection was being laundered into a verdict about a language.
 *
 * The distinction the tests below hold is the whole point: a body that will not parse is a fact about the WIKI,
 * decided on content and unreachable by any transport failure; everything else that fails is a fact about the
 * RUN, and must be reported as such rather than counted.
 */
import { describe, expect, test } from "vitest";
import { classify, type Volume } from "../tools/normalization/candidates.ts";
import { SISTER_STANDARDS, sistersOf } from "../tools/normalization/defects.ts";

const stats = (articles: number, words?: number): string =>
    JSON.stringify({ batchcomplete: "", query: { statistics: { articles, ...(words === undefined ? {} : { "cirrussearch-article-words": words }) } } });

describe("wiki probe classification", () => {
    test("statistics JSON yields the volume, and words are what matter", () => {
        const v = classify(true, stats(1034, 40574)) as Volume;
        expect(v.articles).toBe(1034);
        expect(v.words).toBe(40574);
    });

    test("a body that will not parse is INCUBATOR — a fact about the wiki", () => {
        // The real shape: a listed language whose domain serves an HTML redirect to Wikimedia Incubator.
        expect(classify(true, "<html>\n<body><a href=\"https://incubator.wikimedia.org/\">moved</a></body>\n</html>")).toBe("incubator");
        // JSON that simply has no statistics is the same outcome, decided the same way.
        expect(classify(true, JSON.stringify({ error: { code: "unknown_action" } }))).toBe("incubator");
    });

    test("⚠ a transport failure is UNKNOWN, never incubator — the bug this file exists for", () => {
        expect(classify(false, undefined)).toBe("unknown");
        expect(classify(false, "")).toBe("unknown");
        // A non-OK response WITH a body is still about the run, not the wiki: a 429 or a 503 often carries one.
        expect(classify(false, stats(3141079, 1752720498))).toBe("unknown");
    });

    test("a closed-but-empty wiki reports honestly rather than being mistaken for absent", () => {
        // Measured on two closed wikis: pages exist, articles are zero, indexed article words are ~18.
        const v = classify(true, stats(0, 18)) as Volume;
        expect(v.articles).toBe(0);
        expect(v.words).toBe(18);
        // It is a volume, NOT an "incubator" verdict — the wiki answered, it is simply empty.
        expect(typeof v).toBe("object");
    });

    test("missing cirrussearch-article-words degrades to 0 rather than NaN", () => {
        // NaN is the dangerous value here: it compares false against every threshold, so a wiki with an
        // unreported word count would silently pass or fail depending on which way the comparison ran.
        const v = classify(true, stats(500)) as Volume;
        expect(v.words).toBe(0);
        expect(Number.isNaN(v.words)).toBe(false);
    });
});

describe("sister standards are defined once", () => {
    /**
     * ⚠ THIS TABLE LIVED IN TWO FILES AND HAD ALREADY DIVERGED — `review.ts` held three sets and
     * `candidates.ts` four, the extra being the Latin American Spanish pair. So one tool reported that code as
     * artifact-covered while the other, asked the same question, would look for a file that does not exist.
     * The same drift this repo's `defects.ts` was created to end, reproduced by the change that added the copy.
     */
    test("every set is symmetric — membership does not depend on which code you ask about", () => {
        for (const set of SISTER_STANDARDS)
            for (const code of set)
                for (const other of set)
                    if (code !== other)
                        expect(sistersOf(code), `${code} should list ${other}`).toContain(other);
    });

    test("a code never lists itself, and an unknown code has no sisters", () => {
        for (const set of SISTER_STANDARDS)
            for (const code of set) expect(sistersOf(code)).not.toContain(code);
        expect(sistersOf("zz-nonexistent")).toEqual([]);
    });

    test("no code appears in two different sister sets", () => {
        // Two sets sharing a code would make `sistersOf` return one arbitrarily, so the answer would depend on
        // table order rather than on the language.
        const seen = new Set<string>();
        for (const set of SISTER_STANDARDS)
            for (const code of set) {
                expect(seen.has(code), `${code} is in more than one sister set`).toBe(false);
                seen.add(code);
            }
    });
});
