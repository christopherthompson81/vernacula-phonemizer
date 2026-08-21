import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { codeSwitchSegments } from "../tools/corpus/code_switch.mts";

/**
 * The review ledger is the ONLY copy of the human verdicts outside `align.sqlite`, and
 * `asr_align_corpus.py` re-ingests with `INSERT OR REPLACE`, which erases the row. So the file has to stay
 * loadable by `review_ledger.py --import` without anyone re-reading 138 rows to find out.
 *
 * ⚠ THE SPAN CHECK IS THE POINT. A malformed `{code:…}` does not fail here — it fails later, at
 * re-derivation, on a machine where somebody is restoring a database and has no reason to suspect the
 * ledger. Parsing every span with the real parser catches it at commit time instead.
 */
const PATH = "tools/corpus/asr-align/review/hand_review.tsv";
const BY_HAND = new Set(["defect", "reader_divergence", "convention", "artefact", "examined_clean"]);
const COLS = ["lang", "wav", "sentence_id", "status", "comment", "read_text", "read_text_src", "text"];

describe("asr-align review ledger", () => {
    const lines = readFileSync(PATH, "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#"));
    const header = lines[0]!.split("\t");
    const rows = lines.slice(1).map((l) => Object.fromEntries(l.split("\t").map((v, i) => [COLS[i]!, v ?? ""])));

    it("has the columns review_ledger.py writes", () => {
        expect(header).toEqual(COLS);
        expect(rows.length).toBeGreaterThan(100);
    });

    it("carries only HAND statuses — a bulk pass recomputes the rest", () => {
        for (const r of rows) if (r.status) expect(BY_HAND.has(r.status), `${r.wav}: ${r.status}`).toBe(true);
    });

    it("is keyed uniquely by (lang, wav)", () => {
        const keys = rows.map((r) => `${r.lang}\t${r.wav}`);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it("marks every stored reading as hand, and stores a reading for every hand mark", () => {
        for (const r of rows) expect(Boolean(r.read_text), r.wav).toBe(r.read_text_src === "hand");
    });

    it("every row does something — a verdict, a reading, or both", () => {
        for (const r of rows) expect(Boolean(r.status || r.read_text), `${r.wav} carries neither`).toBe(true);
    });

    it("EVERY code-switch span parses with a known tag", () => {
        const known = (c: string): boolean => ["en", "es", "fr"].includes(c);
        let spans = 0;
        for (const r of rows) {
            if (!r.read_text?.includes("{")) continue;
            expect(() => {
                for (const s of codeSwitchSegments(r.read_text!, r.lang!.split("_")[0]!, known)) spans += s.lang ? 1 : 0;
            }, `${r.lang} ${r.wav}: ${r.read_text}`).not.toThrow();
        }
        expect(spans).toBeGreaterThan(30);
    });

    it("no reading contains IPA — read_text is TEXT and the host re-reads it", () => {
        for (const r of rows) if (r.read_text) expect(r.read_text, r.wav).not.toMatch(/[ˈˌːˑ˥˦˧˨˩]/u);
    });

    it("the ledger file is present where review_ledger.py defaults to", () => {
        expect(existsSync(PATH)).toBe(true);
    });
});
