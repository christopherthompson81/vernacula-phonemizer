/**
 * EVERY MANIFEST THAT DECLARES `signWords` MUST DECLARE THE WHOLE SHAPE.
 *
 * ⚠ THE TYPE CANNOT DO THIS, which is the point of the test. `SignWords` in core/normalizeSymbols.ts is an
 * exact interface, but `loadManifest<T>` parses JSON and CASTS — so a .jsonc missing a key type-checks
 * cleanly, and the language's normalize.ts then interpolates `undefined` into its output as the literal
 * six-letter word. The phoneme sink cannot tell that from a real word, so it leaks silently.
 *
 * ⚠ IT ALSO SCANS RATHER THAN LISTING. Afrikaans is the first engine to declare these (#765) and the rest
 * are expected to follow; a hard-coded list would pass while a newly migrated language went unchecked.
 */
import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { parseJsonc } from "../src/core/jsonc.ts";

const REQUIRED = [
    "plusMinus", "plus", "minus", "ampersand",
    "equals", "lessThan", "greaterThan", "times", "dividedBy",
] as const;

describe("manifest signWords", () => {
    const dir = new URL("../src/languages/", import.meta.url);
    const declaring: [string, Record<string, unknown>][] = [];
    for (const d of readdirSync(dir))
        for (const f of readdirSync(new URL(`${d}/`, dir)).filter((n) => n.endsWith(".jsonc"))) {
            const m = parseJsonc<{ signWords?: Record<string, unknown> }>(
                readFileSync(new URL(`${d}/${f}`, dir), "utf8"),
            );
            if (m.signWords !== undefined) declaring.push([`${d}/${f}`, m.signWords]);
        }

    test("the scan finds the engines that have migrated", () => {
        // Fails loudly if the scan itself breaks, rather than passing over zero manifests.
        expect(declaring.length).toBeGreaterThan(0);
    });

    test("each one declares every sign, with a non-empty word", () => {
        for (const [file, signs] of declaring) {
            const missing = REQUIRED.filter((k) => typeof signs[k] !== "string" || signs[k] === "");
            expect(`${file}: ${missing.join(",") || "complete"}`).toBe(`${file}: complete`);
        }
    });
});
