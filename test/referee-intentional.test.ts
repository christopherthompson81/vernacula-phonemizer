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

    test("en declares the weak vowel in both directions", () => {
        expect(en.intentional).toHaveLength(2);
        expect(en.intentional!.map(([f, t]) => `${f}${t}`).sort()).toEqual(["ɪə", "əɪ"].sort());
    });

    // ⚠ BOTH DIRECTIONS, AND THE SECOND ONE WAS REFUSED ONCE BEFORE IT WAS MEASURED. Declaring `ɪ`→`ə`
    // looked like marking a defect class correct, because for ONE environment it is: where the referee
    // writes `ɪ` at an unstressed AH0 and misaki's gold agrees, we are wrong. Those environments are
    // overridden IN THE ENGINE instead — `-ist`/`-is`/`-age` in rebaseSuffixIh, `-est`/`-ed`/`-es`/`-ity`/
    // `-ible` in isBarredI — so what remains here is the convention itself: at an unstressed AH0 spelled
    // ⟨i⟩ the referee writes `ɪ` 83% of the time and gold writes `ə` 88%, both internally consistent over
    // 2,059 slots. A notation choice, not an error, and we follow the one Kokoro was trained on.
    //
    // ⚠ IT OVER-CREDITS BY ABOUT FIVE ROWS and that is recorded rather than hidden: `Alice`, `creamily`,
    // `inevitable`, `instil`, `minim` — lexical exceptions with no environment to key on. If that set ever
    // grows an environment it becomes an engine rule and leaves this list.
    test("the two entries are the same pair, opposed — not two unrelated classes", () => {
        const pairs = en.intentional!.map(([f, t]) => [f, t].sort().join(""));
        expect(new Set(pairs).size).toBe(1);
        expect(pairs[0]).toBe(["ə", "ɪ"].sort().join(""));
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
