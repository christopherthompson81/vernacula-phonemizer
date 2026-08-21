import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ABBREVIATION_DOT, INITIALISM_UPPERCASE } from "../tools/corpus/asr-align/initialism_casing.mts";

/**
 * ⚠ A DUPLICATE KEY IN AN OBJECT LITERAL SILENTLY WINS, and TypeScript does NOT flag it here: the type is
 * `Record<string, …>`, an index signature, so repeated literal keys are legal. Adding `dr` as a second
 * `cs_cz` entry would have dropped `tzv/atd/tzn/sv/cca` with no error, no type failure and no failing
 * test — the table would simply have been quietly smaller. The runtime object cannot show the collision,
 * so the SOURCE has to be parsed for it.
 */
const SRC = "tools/corpus/asr-align/initialism_casing.mts";

describe("asr-align abbreviation/initialism tables", () => {
    const src = readFileSync(SRC, "utf8");
    const body = /ABBREVIATION_DOT[^=]*=\s*\{([\s\S]*?)\n\};/u.exec(src)?.[1] ?? "";

    it("finds the table in the source", () => {
        expect(body).not.toBe("");
        expect(Object.keys(ABBREVIATION_DOT).length).toBeGreaterThan(5);
    });

    it("has no DUPLICATE language key — the failure tsc cannot see", () => {
        const keys = [...body.matchAll(/^\s{4}([a-z]{2,3}(?:_[a-z]{2,3})?):/gmu)].map((m) => m[1]!);
        // Every key the runtime object has must appear exactly once in the source.
        expect(keys.length).toBe(Object.keys(ABBREVIATION_DOT).length);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it("lists every abbreviation lowercase and dotless — the pattern is built from it verbatim", () => {
        for (const [lang, toks] of Object.entries(ABBREVIATION_DOT))
            for (const t of toks) expect(t, `${lang}: ${t}`).toMatch(/^[a-z]+$/u);
    });

    it("INITIALISM_UPPERCASE has no duplicates either", () => {
        expect(new Set(INITIALISM_UPPERCASE).size).toBe(INITIALISM_UPPERCASE.length);
    });
});
