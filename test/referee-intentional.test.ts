/**
 * DECLARED-INTENTIONAL DIVERGENCES — a class where the two readings differ, we have positive evidence
 * ours is the better one, and the row is therefore reported as accounted-for rather than as work left.
 *
 * ⚠ THE SEMANTICS ARE PINNED HERE BECAUSE GETTING THEM WRONG IS SILENT AND FLATTERING. A bidirectional
 * version of this mechanism would have credited 137 of our own errors on the en referee — the class
 * #1326 and #1330 exist to fix — and raised the reported number for doing it.
 * docs/investigations/referee/en_referee_audit_investigation.md Run 6.
 */
import { describe, expect, test } from "vitest";
import { CONFIG } from "../tools/referee-eval/config.ts";

describe("declared-intentional divergences", () => {
    const en = CONFIG["en"]!;

    test("en declares the weak vowel, in the referee→ours direction only", () => {
        expect(en.intentional).toHaveLength(1);
        const [from, to] = en.intentional![0]!;
        expect([from, to]).toEqual(["ə", "ɪ"]);
    });

    // ⚠ THE PAIR IS NOT SYMMETRIC AND MUST NEVER BE DECLARED BOTH WAYS. Where the referee writes `ə` and
    // we write `ɪ`, both referees back US (UK 82.3%, US 72.3%). Where the referee writes `ɪ` and we write
    // `ə`, both back THE REFEREE (87.0%, 82.4%) and we are wrong. On the en referee those are 70 rows and
    // 137 rows; declaring the reverse would mark the larger, real defect class as intentional.
    test("the reverse pairing is not declared", () => {
        expect(en.intentional!.some(([from, to]) => from === "ɪ" && to === "ə")).toBe(false);
    });

    // ⚠ `ɔ`/`ɑ` WAS TESTED FOR THIS AND REFUSED. The referee writes `ɔ` in 312 of its 4,558 rows, so it
    // records the cot–caught distinction and merely assigns ~38 words differently — a LEXICAL
    // disagreement where neither side has been shown right. Declaring it would mark our errors correct.
    test("the cot–caught pair is not declared", () => {
        for (const [from, to] of en.intentional!)
            expect([from, to].sort().join("")).not.toBe(["ɑ", "ɔ"].sort().join(""));
    });

    // ⚠ SINGLE CHARACTERS, VALIDATED AT LOAD. The comparison is positionwise, so a multi-character or
    // regex `refHas` cannot be honoured — and an entry that never fires is indistinguishable from a class
    // that turned out to be empty, which is the exact failure this mechanism exists to prevent.
    test("every declared entry is a single character on both sides", () => {
        for (const lang of Object.keys(CONFIG))
            for (const [from, to] of CONFIG[lang]!.intentional ?? []) {
                expect([...from]).toHaveLength(1);
                expect([...to]).toHaveLength(1);
            }
    });

    test("only en declares any — this is not a fleet-wide default", () => {
        const declaring = Object.keys(CONFIG).filter((l) => CONFIG[l]!.intentional?.length);
        expect(declaring).toEqual(["en"]);
    });
});
