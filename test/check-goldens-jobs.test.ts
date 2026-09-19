/**
 * `--jobs N` MUST NOT CHANGE THE ANSWER, AND THE THREAD CAP MUST ACTUALLY REACH THE SESSION.
 *
 * ⚠ THE GATE'S WHOLE VALUE IS THAT IT IS TRUSTED, so a mode that makes it twice as fast has to be pinned,
 * not just measured once in a pull request. The sibling `--jobs` in `tools/referee-eval/eval.ts` shipped
 * two bugs that were invisible in its headline numbers (see test/referee-eval-shard.test.ts); the headline
 * number here — "189 languages, 36,495 rows, 0 stale" — is even easier to match while verifying less,
 * because a language that never came back subtracts from a row count nobody reads.
 *
 * ⚠ THE EQUIVALENCE IS CHECKED ON A RUN THAT PRODUCES DETAIL, not on a clean one. Two clean runs agree by
 * saying nothing; `--no-ort --show 200` makes the engine disagree with the goldens on purpose and prints
 * every mismatching row, so the comparison covers the per-row text, the per-language ordering, and the
 * order of the languages themselves — 643 lines rather than one.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test, vi } from "vitest";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const TSX = join(ROOT, "node_modules", ".bin", "tsx");
const TOOL = join(ROOT, "tools", "check-goldens.mts");

/** The tool's stdout, or — for the refusals, which exit 2 — its stderr. */
function run(args: string[]): { out: string; status: number } {
    try {
        return { out: execFileSync(TSX, [TOOL, ...args], { encoding: "utf8", cwd: ROOT }), status: 0 };
    } catch (e) {
        // ⚠ THE SIGNAL MUST SURVIVE, because without it a child KILLED mid-stream is indistinguishable
        // from one that ran to completion and disagreed: both arrive as partial stdout with no error
        // line, and the byte comparison below then reports "the pooled report differs" for what is
        // actually a dead process. This test has failed that way intermittently and the capture threw
        // the evidence away — `status` was coerced to -1 and `signal` dropped on the floor.
        const err = e as { status?: number; signal?: string; stdout?: string; stderr?: string };
        const died = err.signal ? ` [killed by ${err.signal}]` : "";
        return { out: `${err.stdout ?? ""}${err.stderr ?? ""}${died}`, status: err.status ?? -1 };
    }
}

describe("check-goldens --jobs", () => {
    // Four languages spanning the three ONNX routes the tool documents: a language that owns a model
    // (en, km), and two that reach one only by delegating an embedded Latin run (ja, ru).
    const LANGS = ["en", "ja", "ru", "km"];

    test("a pooled run is byte-identical to the serial one, rows and all", () => {
        const serial = run(["--no-ort", "--show", "200", ...LANGS]);
        const pooled = run(["--jobs", "3", "--no-ort", "--show", "200", ...LANGS]);
        expect(serial.status).toBe(0);
        // ⚠ AND THE POOLED ONE TOO, asserted BEFORE the byte comparison so a non-zero exit is reported
        // as itself rather than as a content difference. The omission is why an intermittent failure
        // here read as "the pool disagrees" for three separate diagnoses, none of them right.
        expect(pooled.status).toBe(0);
        expect(pooled.out).toBe(serial.out);
        // ⚠ AND IT IS NOT AGREEING BY BEING EMPTY. If `--no-ort` ever stopped producing mismatches this
        // test would pass while comparing two one-line reports, so the detail itself is asserted.
        expect(serial.out.split("\n").length).toBeGreaterThan(100);
    }, 120_000);

    test("the clean verdict survives the pool too", () => {
        expect(run(["--jobs", "3", "hmn", "mi"]).out).toBe(run(["hmn", "mi"]).out);
    }, 120_000);

    // ⚠ EACH OF THESE IS A WAY TO GET A WRONG ANSWER QUIETLY, which is why they are refusals and not notes
    // in the header. `--write` from a capped or pooled engine re-records the goldens from something that is
    // not the engine (#1283 at fleet scale); `--no-clear` asks what each language inherits from the one
    // before it, and a pool gives each worker a different "one before it", so the pooled answer is "the
    // memo clear is not load-bearing" — false, and the strongest possible wrong answer to that question.
    test.each([
        [["--jobs", "2", "--write"], /--write cannot be combined/u],
        [["--cap-ort", "--write", "af"], /--write cannot be combined/u],
        [["--jobs", "2", "--isolate"], /opposite answers/u],
        [["--jobs", "2", "--no-clear"], /cannot be combined with --no-clear/u],
        [["--jobs", "zz"], /--jobs needs an integer/u],
        [["--jobs", "0"], /--jobs needs an integer/u],
    ])("refuses %j", (args, message) => {
        const { out, status } = run(args);
        expect(status).toBe(2);
        expect(out).toMatch(message);
    }, 60_000);
});

describe("setOrtSessionDefaults", () => {
    test("⚠ it reaches sessions even when something already called loadOrt()", async () => {
        vi.resetModules();
        const onnx = await import("../src/core/onnx.ts");
        const seen: unknown[] = [];
        const fake = {
            InferenceSession: {
                create: (_model: unknown, options?: unknown) => {
                    seen.push(options);
                    return Promise.resolve({ run: () => Promise.resolve({}) });
                },
            },
        };
        onnx.setOrtLoader(() => Promise.resolve(fake));

        // ⚠ THE POISONING CALL. Whether the runtime gets wrapped is decided once, when `loadOrt` resolves,
        // so a bare availability probe that creates NO session is enough to fix the unwrapped runtime in
        // place. Without the memo clear in `setOrtSessionDefaults` the cap below is dropped silently, and
        // every `--jobs` worker goes back to a thread per core — the measured dead end, behind a green
        // verdict.
        await onnx.loadOrt("a probe that creates nothing");

        onnx.setOrtSessionDefaults({ intraOpNumThreads: 1, interOpNumThreads: 1, executionMode: "sequential" });
        const capped = await onnx.loadOrt("after the cap");
        await capped.InferenceSession.create(new Uint8Array(), { executionProviders: ["cpu"] });
        expect(seen).toEqual([{
            executionProviders: ["cpu"],
            intraOpNumThreads: 1,
            interOpNumThreads: 1,
            executionMode: "sequential",
        }]);

        // ⚠ AND WITH NOTHING TO MERGE IT IS THE RUNTIME ITSELF. test/browser-seams.test.ts pins that
        // `loadOrt()` resolves to the very object `setOrtLoader` installed; wrapping unconditionally would
        // break that identity for every caller to serve a mode almost nobody turns on.
        onnx.setOrtSessionDefaults(undefined);
        await expect(onnx.loadOrt("uncapped")).resolves.toBe(fake);
        onnx.setOrtLoader(undefined);
    });
});
