/**
 * ⚠ A LEXICON'S FOLD ALIAS PASS MUST NOT BE TRACED (#1577). Its own file ON PURPOSE: each lexicon loads lazily
 * inside the FIRST `text()` that needs it, so the defect only shows on a cold process. Vitest isolates each
 * file's module graph, and each language below loads only its own lexicon, so every test here is that
 * language's first call.
 *
 * Swept by `csharp/tools/trace-cold` (cold nativised = warm): da, nb, sv and sl were the four affected.
 *
 * Found by the Rust port's `phonemize-trace` replay: the alias pass ran the engine's nativiser over every key
 * while the first token was open, and the last key it rewrote landed on that token as `nativised`.
 */
import { expect, test } from "vitest";

import { phonemizeTrace } from "../src/index.ts";

// Synthetic, native-spelled words: nothing in them is a letter the nativiser rewrites.
for (const [lang, text] of [
    ["da", "Mandag kommer vi hjem."],
    ["nb", "Mandag kommer vi hjem."],
    ["sv", "Måndag kommer vi hem."],
    ["sl", "V ponedeljek pridemo domov."],
] as const) {
    test(`the first ${lang} trace in a cold process records no nativised spelling on a native word`, () => {
        const t = phonemizeTrace(text, lang);
        expect(t.traced).toBe(true);
        expect(t.tokens.length).toBeGreaterThan(0);
        for (const k of t.tokens) expect(k.nativised, k.surface).toBeUndefined();
    });
}
