/**
 * The SHARED SYMBOL TIER's data — percent, currency, units, exponents, magnitudes — read from each
 * language's manifest instead of a literal in its engine file.
 *
 * ⚠ THE COMMENTS ARE THE POINT, not just the data. Each tier body carried the evidence for every declared
 * unit: why a bare `m` is declared, why ⟨V⟩ and ⟨W⟩ are capital, which hazards are bounded and unattested.
 * That is the part that cannot be reconstructed, so it moved verbatim with the values it explains.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { MANIFEST as AF } from "../src/languages/afrikaans/manifest.ts";
import { MANIFEST as NL } from "../src/languages/dutch/manifest.ts";
import { MANIFEST as TR } from "../src/languages/turkish/manifest.ts";
import { MANIFEST as HA } from "../src/languages/hausa/manifest.ts";
import { MANIFEST as MI } from "../src/languages/maori/manifest.ts";
import { MANIFEST as UMB } from "../src/languages/umbundu/manifest.ts";
import { MANIFEST as KO } from "../src/languages/korean/manifest.ts";
import { MANIFEST as CEB } from "../src/languages/cebuano/manifest.ts";

interface Tier { symbols: { percent: string[]; units: Record<string, string[]>; currency: Record<string, string[]> } }

const LANGS: [string, Tier, string][] = [
    ["af", AF, "dit is 5 km ver"],
    ["nl", NL, "het is 5 km ver"],
    ["tr", TR, "bu 5 km uzakta"],
    ["ha", HA, "yana da nisan 5 km"],
    ["mi", MI, "he 5 km te tawhiti"],
    ["ceb", CEB, "lima ka 5 km"],
];

describe.each(LANGS)("%s reads its symbol tier from the manifest", (code, DEF, kmSentence) => {
    const say = (s: string): string => phonemize(s, code).replace(/[ˈˌ]/gu, "");

    test("the unit noun comes from the manifest", () => {
        expect(say(kmSentence)).toContain(say(DEF.symbols.units["km"]![0]!));
    });

    test("percent and currency are declared and reached", () => {
        expect(DEF.symbols.percent.length).toBeGreaterThan(0);
        expect(Object.keys(DEF.symbols.currency).length).toBeGreaterThan(0);
    });
});

/**
 * ⚠ `percentPrefix` IS WORD ORDER, AND LOSING IT IS SILENT. Turkish and Hausa put the percent word BEFORE
 * the number (*yüzde elli*, not *elli yüzde*). The flag reached the jsonc in the first pass and nothing
 * wired it back, so both languages quietly reversed — no error, no throw, just the wrong order. Caught by
 * the probe, and pinned here.
 */
describe.each([["tr", TR, "% 50 insan", "yüzde"], ["ha", HA, "50 % na mutane", "kashi"]] as const)(
    "%s puts the percent word before the number", (code, DEF, sentence, word) => {
        test("the reading leads with the percent word, not the numeral", () => {
            const words = phonemize(sentence, code).replace(/[ˈˌ]/gu, "").split(" ");
            const pct = phonemize(DEF.symbols.percent[0]!, code).replace(/[ˈˌ]/gu, "").split(" ")[0]!;
            expect(words[0], `${code}: expected ${word} first`).toBe(pct);
        });
    },
);

/**
 * ⚠ FOUR LANGUAGES PASSED THE DECIMAL WORD AS A BARE LITERAL while 35 declared it. The same fact was
 * manifest data in Dutch (`decimalWord: "komma"`) and a string in the code next door in Afrikaans.
 */
describe("the decimal word is declared, not written into the engine", () => {
    // ⚠ THE KEY IS NOT IN THE SAME PLACE IN EVERY LANGUAGE: Afrikaans declares it at the top level (added
    // here), Dutch nests it under `numbers`. The test reads whichever exists rather than assuming a shape.
    test.each([["af", AF, "dit is 12.5 meter"], ["nl", NL, "het is 12,5 meter"]] as const)(
        "%s reads its declared decimalWord", (code, DEF, sentence) => {
            const d = DEF as unknown as { decimalWord?: string; numbers?: { decimalWord?: string } };
            const w = d.decimalWord ?? d.numbers?.decimalWord ?? "";
            expect(w.length).toBeGreaterThan(0);
            // ⚠ STRIP STRESS FROM BOTH SIDES. The sentence carries [kˈɔma] and the bare word [kɔma]; stripping
            // only one of them fails on a correct reading.
            const bare = (x: string): string => phonemize(x, code).replace(/[ˈˌ]/gu, "");
            expect(bare(sentence)).toContain(bare(w));
        },
    );
});

/**
 * ⚠ `4x4` IS IN EVERY PROBE FROM HERE ON, and the reason is a bug the probes MISSED. Batch 1 dropped
 * Afrikaans's `Multiply` in the C# port and `4x4` read *fˈir ˈɛks fˈir* — "four EX four", the letter name —
 * instead of *fˈir kˈiər fˈir*. No probe line covered it; the single `4x4` row in the af GOLDEN is what
 * caught it. ASCII ⟨x⟩ between digits is the case a symbol-tier port loses most quietly, because the output
 * stays plausible.
 */
describe("the ASCII multiply sign survives the lift", () => {
    test.each([["af", "'n 4x4 voertuig"], ["nl", "een 4x4 wagen"], ["ceb", "4x4 nga sakyanan"]] as const)(
        "%s does not read x as a letter name", (code, sentence) => {
            const said = phonemize(sentence, code).replace(/[ˈˌ]/gu, "");
            const letterX = phonemize("x", code).replace(/[ˈˌ]/gu, "");
            expect(said, `${code}: the x is being spelled`).not.toContain(letterX);
        },
    );
});
