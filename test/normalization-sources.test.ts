/**
 * The pre-flight source report must know about every class the gates will fail a layer on.
 *
 * ⚠ WHY THIS TEST EXISTS. `sources.ts` is the check that must run BEFORE writing a normalization layer,
 * and its own header explains the stake: "the cost of doing it by hand is not the time, it is that it was got
 * wrong". But its class list was hand-written and had fallen behind twice over.
 *
 * established the sign vocabulary for the fleet and taught `defects.ts`, `review.ts` and `coverage.ts`
 * about it — not this file. And `ampersand` and `iteration` had never been represented at all. So an author
 * running the mandated check was told, by silence, that eight classes did not apply. Writing the Khmer layer
 * that is exactly what happened: the report listed percent, currency, degrees, decimal and fractions, said
 * nothing about signs, and the author asserted "× ÷ and = have no corpus-attested Khmer reading" into a code
 * comment without checking. Every one was attested — ដក ×3,808, គុណ ×3,338, ចែក ×3,285, ស្មើ ×2,077 — with
 * `៣គុណ៥` and `២៨ ដក៥` written out in arithmetic position.
 *
 * A silent class is how folklore replaces a lookup. This test makes the two lists reconcile mechanically, so the
 * next class added to `DROPPABLE` cannot arrive without either a row or a stated reason for having none.
 */
import { describe, expect, test } from "vitest";
import { DROPPABLE } from "../tools/normalization/defects.ts";
import { SOURCES_EXEMPT } from "../tools/normalization/sources.ts";
import { readFileSync } from "node:fs";

/** The class names `sources.ts` actually reports on, read from its own source rather than re-declared here. */
const reported = new Set(
    [...readFileSync("tools/normalization/sources.ts", "utf8").matchAll(/klass: "([a-z-]+)"/gu)].map((m) => m[1]!),
);

/** `degree` is reported under the name `scale-names`, which is the scale word rather than the sign. */
const ALIAS: Readonly<Record<string, string>> = { degree: "scale-names" };

describe("sources.ts covers what the gates check", () => {
    test("every DROPPABLE class has a source row or a declared exemption", () => {
        const missing: string[] = [];
        for (const [klass] of DROPPABLE) {
            if (klass in SOURCES_EXEMPT) continue;
            const names = [klass, `${klass}-word`, ALIAS[klass] ?? ""].filter(Boolean);
            if (!names.some((n) => reported.has(n))) missing.push(klass);
        }
        expect(missing, `no pre-flight row for: ${missing.join(", ")} — add one to sources.ts, or an entry to `
            + `SOURCES_EXEMPT saying why the class needs no vocabulary`).toEqual([]);
    });

    test("every exemption names a real class, and gives a reason", () => {
        // An exemption for a class that no longer exists is dead weight that makes the reconciliation lie.
        const classes = new Set([...DROPPABLE].map(([k]) => k));
        for (const [klass, why] of Object.entries(SOURCES_EXEMPT)) {
            expect(classes.has(klass), `${klass} is exempt but is not a DROPPABLE class`).toBe(true);
            expect(why.length, `${klass}'s exemption needs a reason, not a placeholder`).toBeGreaterThan(20);
        }
    });

    test("the sign classes are all represented", () => {
        // Named explicitly rather than derived, because these are the ones that went missing for a whole issue's
        // worth of work and the failure was invisible — the report simply did not mention them.
        for (const sign of ["minus", "plus", "plus-minus", "equals", "less-than", "greater-than", "times", "divide"])
            expect(reported.has(`${sign}-word`), `${sign} has no pre-flight row`).toBe(true);
    });
});
