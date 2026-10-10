/**
 * ⚠ A DICT KEY FOLD MUST NOT BE TRACED (#1481). Its own file ON PURPOSE: the wu dict loads lazily inside the
 * FIRST `text()` that needs it, so the defect only shows on a cold process — vitest isolates each file's
 * module graph, and nothing else here may touch wuu first.
 *
 * Found by `npm run check:trace-parity`: with wu's loader folding its keys through the TRACED
 * `foldHanCompatibility`, the first wuu row's trace recorded every key fold as a rewrite of the utterance and
 * lost all its input spans in TS, while C# kept them. The loader now uses `foldHanCompatibilityKey`.
 */
import { expect, test } from "vitest";

import { phonemizeTrace } from "../src/index.ts";

test("the first wuu trace in a cold process keeps its input spans", () => {
    const t = phonemizeTrace("上海人，讲上海闲话。", "wuu");
    expect(t.traced).toBe(true);
    const words = t.tokens.filter((k) => k.emitted.length > 0);
    expect(words.length).toBeGreaterThan(0);
    for (const k of words) expect(k.inputSpan, k.surface).toBeDefined();
});
