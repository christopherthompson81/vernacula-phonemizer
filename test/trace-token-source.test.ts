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

import { phonemizeTrace, phonemizeTraceAsync } from "../src/index.ts";

const sources = (t: { tokens: { surface: string; source?: string }[] }): Record<string, string> =>
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
        const a = await phonemizeTraceAsync("the tau value", "en");
        const b = await phonemizeTraceAsync("the τ value", "en");
        expect(a.normalized).toBe(b.normalized);
        expect(a.ipa).not.toBe(b.ipa);
        expect(sources(a)["tau"]).toBe("tagger");
        expect(sources(b)["tau"]).toBe("g2p");
    });

    it("⚠ the SYNC trace cannot reach `tagger`, which is why the async entry exists", async () => {
        // `phonemizeTrace` calls `phonemize`, which never consults the OOV tagger — so `tagger` was a
        // declared value nothing could produce, and it is the value the field was added for.
        expect(sources(phonemizeTrace("the tau value", "en"))["tau"]).toBe("g2p");
        expect(sources(await phonemizeTraceAsync("the tau value", "en"))["tau"]).toBe("tagger");
    });

    it("⚠ a token whose readings come from different tiers reports NOTHING", () => {
        // One source token can yield many readings. Where they do not agree, the first would be a
        // confident wrong answer to a question with no single answer — so the field is absent instead.
        // `0.015″` becomes two words and both come from the lexicon, so it DOES report.
        const t = phonemizeTrace("0.015″ total", "en");
        for (const k of t.tokens) expect([k.surface, k.source]).toEqual([k.surface, "lexicon"]);
    });

    it("⚠ a trace cannot overlap another, and says so rather than clobbering", async () => {
        // The recorder is AMBIENT. Before this, a second `startTrace` overwrote the first and both calls
        // returned a trace stitched from the two — a corrupted result that looks valid.
        const running = phonemizeTraceAsync("the tau value", "en");
        expect(() => phonemizeTrace("hello", "en")).toThrow(/already in progress/u);
        await running;
        // …and the recorder is clean afterwards, so the next call works.
        expect(sources(phonemizeTrace("hello", "en"))["hello"]).toBe("lexicon");
    });
});
