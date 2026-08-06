import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The shared char→chunk BiLSTM training code (tools/bilstm_training/) that the nb/en/da/fr g2p trainers sit on.
// Those are OFFLINE tools — they produce the committed *-g2p-tagger.onnx artifacts and are never imported by the
// runtime — so nothing else in this suite touches them. That gap is why a reordered import in fr_g2p_bilstm.py
// (`sys.path.insert` landing AFTER the import that needed it) sat in a committed file that could never run.
//
// Delegates to tools/bilstm_training/smoke_test.py, which does the real work on CPU in seconds. Skipped when the
// project venv is absent (a fresh clone, or CI without torch) — the same shape as the optional-ONNX-model tests.
const ROOT = join(import.meta.dirname, "..");
const PY = join(ROOT, ".venv", "bin", "python");
const SMOKE = join(ROOT, "tools", "bilstm_training", "smoke_test.py");

const haveVenv = existsSync(PY) && existsSync(SMOKE);
const haveTorch =
    haveVenv &&
    (() => {
        try {
            execFileSync(PY, ["-c", "import torch"], { stdio: "ignore" });
            return true;
        } catch {
            return false;
        }
    })();

describe("bilstm_training — shared g2p tagger core", () => {
    it("the smoke script and the four trainers that use it are present", () => {
        expect(existsSync(SMOKE)).toBe(true);
        for (const rel of [
            "tools/bilstm_training/align.py",
            "tools/bilstm_training/tagger.py",
            "tools/norwegian/train_nb_bilstm.py",
            "tools/english/en_g2p_bilstm.py",
            "tools/danish/da_bilstm.py",
            "tools/french/fr_g2p_bilstm.py",
        ])
            expect(existsSync(join(ROOT, rel)), rel).toBe(true);
    });

    describe.skipIf(!haveTorch)("with the project venv present", () => {
        it("aligner, tagger, masked decode, and the per-language hyperparameters all hold", () => {
            const out = execFileSync(PY, [SMOKE], { cwd: ROOT, encoding: "utf8", timeout: 300_000 });
            expect(out, out).toContain("all bilstm_training smoke checks passed");
            expect(out, out).not.toContain("FAIL");
        }, 300_000);

        // The bug class this file exists for: an import that only resolves under a particular cwd/PYTHONPATH.
        it.each([
            ["norwegian", "train_nb_bilstm"],
            ["english", "en_g2p_bilstm"],
            ["danish", "da_bilstm"],
            ["french", "fr_g2p_bilstm"],
        ])("tools/%s/%s.py imports cleanly from the repo root", (dir, mod) => {
            const code = `import sys; sys.path.insert(0, ${JSON.stringify(join("tools", dir))}); import ${mod}`;
            expect(() => execFileSync(PY, ["-c", code], { cwd: ROOT, stdio: "pipe" })).not.toThrow();
        }, 120_000);
    });
});
