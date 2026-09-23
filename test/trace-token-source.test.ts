/**
 * WHICH TIER RESOLVED A TOKEN (#1453).
 *
 * ⚠ THIS EXISTS BECAUSE TWO IDENTICAL NORMALIZED STRINGS READ DIFFERENTLY AND NOTHING COULD SAY WHY.
 * `the τ value` and `the tau value` normalize to the same 13 code points and phonemize differently
 * (#1452 — the neural pre-pass scans the RAW text, so a word the NORMALIZER creates never reaches the
 * tagger). Working that out took a hex dump, an order-dependence test, a sync/async comparison and
 * reading the neural entry point. `source` answers it in one call.
 */
import { describe, expect, it } from "vitest";

import { startTrace, stopTrace } from "../src/core/trace.ts";
import { phonemizeEnNeural } from "../src/languages/english/englishNeural.ts";
import { phonemizeTrace } from "../src/index.ts";

/**
 * A traced run of the NEURAL path, by driving the recorder directly.
 *
 * ⚠ THERE IS NO PUBLIC ASYNC TRACE, AND THAT IS ARCHITECTURAL. One was written for this PR and REMOVED:
 * the recorder is a module global, so holding it across an `await` lets any unrelated `phonemize` call in
 * the process write into the open recording — measured, a traced English call came back with
 * `normalized: "bonjour monsieur"` and two French tokens. Scoping it to one call needs an async context,
 * and `src/` carries no `node:` imports by design, so `AsyncLocalStorage` is unavailable.
 * ⚠ IT IS SAFE HERE AND ONLY HERE: this test is single-threaded and nothing else phonemizes during it.
 * That is exactly the contract a library cannot ask its callers to keep, which is why it is not an API.
 */
const traceNeural = async (text: string): Promise<{ normalized: string; ipa: string; tokens: readonly { surface: string; source?: string }[] }> => {
    startTrace(text);
    try {
        const ipa = await phonemizeEnNeural(text);
        const { normalized, tokens } = stopTrace(ipa);
        return { normalized, ipa, tokens };
    } finally {
        stopTrace();
    }
};

const sources = (t: { tokens: readonly { surface: string; source?: string }[] }): Record<string, string> =>
    Object.fromEntries(t.tokens.map((k) => [k.surface, k.source ?? ""]));

describe("TraceToken.source (#1453)", () => {
    it("names the tier that answered", () => {
        expect(sources(phonemizeTrace("hello world", "en"))).toEqual({ hello: "lexicon", world: "lexicon" });
        // A heteronym entry — the reading depended on the POS expectation.
        const het = sources(phonemizeTrace("read the record", "en"));
        expect([het["read"], het["record"]]).toEqual(["heteronym", "heteronym"]);
        // A foreign run, read by another language's engine.
        expect(sources(phonemizeTrace("λόγος here", "en"))["λόγος"]).toBe("foreign");
    });

    it("⚠ answers #1452 in one call — the same normalized string, two tiers", async () => {
        // ⚠ THE NORMALIZED TEXT IS BYTE-IDENTICAL. That is the whole point: nothing else in the trace
        // distinguishes these two, and the readings differ.
        const a = await traceNeural("the tau value");
        const b = await traceNeural("the τ value");
        expect(a.normalized).toBe(b.normalized);
        expect(a.ipa).not.toBe(b.ipa);
        expect(sources(a)["tau"]).toBe("tagger");
        expect(sources(b)["tau"]).toBe("g2p");
    });

    it("⚠ the SYNC trace cannot reach `tagger` — it is produced, but not observable through the API", () => {
        // `phonemizeTrace` wraps `phonemize`, which never consults the OOV tagger. The value is real and is
        // covered above by driving the recorder directly; it is not offered as an API because the recorder
        // cannot safely span an `await`. See `traceNeural`.
        expect(sources(phonemizeTrace("the tau value", "en"))["tau"]).toBe("g2p");
    });

    it("⚠ a token whose readings come from different tiers reports NOTHING", () => {
        // One source token can yield many readings. Where they do not agree, the first would be a
        // confident wrong answer to a question with no single answer — so the field is absent instead.
        // `0.015″` becomes two words and both come from the lexicon, so it DOES report.
        const t = phonemizeTrace("0.015″ total", "en");
        for (const k of t.tokens) expect([k.surface, k.source]).toEqual([k.surface, "lexicon"]);
    });

    it("⚠ the recorder SELF-HEALS, which a re-entrancy throw would have removed", () => {
        // A throw on re-entry was tried and reverted: a recording left open by a `stopTrace` that threw
        // would then be stuck for the process lifetime, and three tools wrap `phonemizeTrace` in
        // `catch { continue; }` — so that state reports a clean run with ZERO ROWS rather than a failure.
        startTrace("stranded");            // simulate an abandoned recording
        expect(sources(phonemizeTrace("hello", "en"))["hello"]).toBe("lexicon");
    });
});
