/**
 * The pre-flight source report must know about every class the gates will fail a layer on.
 *
 * ⚠ WHY THIS TEST EXISTS. `sources.ts` is the check that must run BEFORE writing a normalization layer,
 * and its own header explains the stake: "the cost of doing it by hand is not the time, it is that it was got
 * wrong". But its class list was hand-written and had fallen behind twice over.
 *
 * ⚠ THE SIGN CLASSES LIVE IN `defects.ts`, `review.ts` AND `coverage.ts` — not here. `sources.ts` carried its
 * own hand-written copy, which drifted; `ampersand` and `iteration` were never represented at all. So an author
 * running the mandated check was told, BY SILENCE, that eight classes did not apply. Writing the Khmer layer,
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
import { SOURCES_EXEMPT, context, scaleNames, type Ctx } from "../tools/normalization/sources.ts";
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

/**
 * THE SCALE-NAMES CHECK, PINNED IN BOTH DIRECTIONS — which is how its two defects were found, and why one
 * test class would not have been enough.
 *
 * ⚠ A FALSE `ok` IS THE FAILURE THIS INSTRUMENT EXISTS TO PREVENT. `sources.ts` caught a Lao layer that had
 * INVENTED a currency word by reporting it "in NO source"; an `ok` assembled out of the layer's own
 * identifiers would have waved that through, because a layer's source text always agrees with itself. So the
 * `ok` cases below are asserted on their EVIDENCE, not merely on the verdict — an `ok` whose detail is the
 * English word "Celsius" for a language that emits 攝氏 is still wrong even though the verdict reads right.
 *
 * ⚠ AND A FALSE `NONE` COSTS THE CATCH. It teaches whoever reads the report next that the line carries no
 * information, which is the same outcome as not printing it. So the `[??]` cases are pinned too: the point of
 * that verdict is that it is NOT `none`, and a later "simplification" that collapses it back into `none` to
 * make the matrix tidier must fail here.
 */
const CTX = (over: Partial<Ctx>): Ctx =>
    ({ code: "xx", dir: "xx", espeak: "", referee: "", langSrc: "", corpus: "20 °C", ...over });

describe("scale-names tells a declared word from an option key", () => {
    test("FALSE GREEN: a helper's option keys are not the language's vocabulary", () => {
        // The cdo shape, exactly: three arms, all emitting the bare degree word, under keys named for the two
        // scales. The words `celsius` and `fahrenheit` are present in the source and mean nothing.
        const r = scaleNames(CTX({
            langSrc: "s = readDegrees(s, { celsius: (n) => `${n} dô`, fahrenheit: (n) => `${n} dô`, bare: (n) => `${n} dô` });",
        }));
        expect(r.verdict, `option keys were read as scale words: ${r.detail}`).toBe("none");
        expect(r.detail).toContain("dropped");
    });

    test("FALSE GREEN: a quoted object KEY names the slot, not the word", () => {
        // The ab shape. `"celsius"` is a manifest field name; the Abkhaz word is the VALUE beside it.
        const r = scaleNames(CTX({ langSrc: '{ "celsius": "Цельси иградус" }', corpus: "20 °C" }));
        expect(["have", "partial"]).not.toContain(r.verdict);
    });

    test("FALSE GREEN: an arm that differs from the OTHER scale arm still declares nothing", () => {
        // The uz shape, which the first version of this fix got wrong: `°C` reads as the bare degree word and
        // only `°F` adds a scale name. A "the two arms differ" test invents a Celsius word out of that.
        const r = scaleNames(CTX({
            langSrc: 's.replace(/(\\d)\\s?°\\s?C(?![\\p{L}])/gu, "$1 daraja")'
                + '.replace(/(\\d)\\s?°\\s?F(?![\\p{L}])/gu, "$1 daraja farengeyt")'
                + '.replace(/(\\d)\\s?°/gu, "$1 daraja")',
        }));
        expect(r.verdict).toBe("partial");
        expect(r.detail).toContain("Fahrenheit");
        expect(r.detail).not.toContain("Celsius");
    });

    test("a `N°` numero rule is not a degree arm", () => {
        const r = scaleNames(CTX({ langSrc: 's.replace(/(?<![\\p{L}])[Nn]\\s?°\\s?(?=\\d)/gu, "nimewo ")' }));
        expect(["have", "partial"]).not.toContain(r.verdict);
    });

    test("distinct arms declare a scale name, and the EMITTED text is what gets reported", () => {
        const r = scaleNames(CTX({
            corpus: "13.3 °C", langSrc: "readDegrees(s, { celsius: (n) => `攝氏${n}度`, fahrenheit: (n) => `華氏${n}度`, bare: (n) => `${n}度` })",
        }));
        expect(r.verdict).toBe("have");
        expect(r.detail, "an ok must cite the language's own word, not the English name").toContain("攝氏");
        expect(r.detail).toContain("華氏");
    });

    test("a scale word inside a ternary hole counts (the sr/hr shape)", () => {
        const r = scaleNames(CTX({
            langSrc: 's.replace(/(\\d+)\\s?°\\s?([CFСcf])(?![\\p{L}])/gu, (_m, n, u) => `${n} ${/[Ff]/u.test(u) ? "Farenhajta" : "Celzijusa"}`)',
        }));
        expect(r.verdict).toBe("have");
    });
});

describe("scale-names refuses to answer rather than inventing an absence", () => {
    test("FALSE NEGATIVE: a non-Latin corpus is an unread haystack, not an absence", () => {
        // The transliteration probe is a list of Latin spellings. Reporting `none` over a corpus it cannot
        // read is an assertion about evidence nobody looked at.
        const r = scaleNames(CTX({ corpus: "১৮°ꠍꠦ. ০°–১০০° ꠍꠦꠟꠍꠤꠀꠍ ꠔꠣꠚꠝꠣꠔ꠆ꠞꠣ" }));
        expect(r.verdict).toBe("unknown");
        expect(r.detail, "the reader must be handed the candidate, not just a shrug").toContain("ꠍꠦꠟꠍꠤꠀꠍ");
    });

    test("FALSE NEGATIVE: an arm whose output is computed is unknown, never none", () => {
        const r = scaleNames(CTX({
            langSrc: 's.replace(new RegExp(`(\\\\p{Nd})\\\\s*°\\\\s*(ꠍꠦ|ꠚꠣ)`, "gu"), (_m, d, k) => `${d} ${SCALE[k]}`)',
        }));
        expect(r.verdict).toBe("unknown");
    });

    test("`none` is still reachable where the probe COULD have read the corpus", () => {
        // Not every negative is wrong, and softening all of them would cost the class its meaning.
        const r = scaleNames(CTX({ corpus: "the temperature reached 20 ° yesterday", langSrc: "" }));
        expect(r.verdict).toBe("none");
    });

    test("no ° in the corpus is not a judgement about the vocabulary", () => {
        expect(scaleNames(CTX({ corpus: "no sign here" })).verdict).toBe("n/a");
    });
});

describe("scale-names on the real fleet", () => {
    // ⚠ REAL LAYERS, not fixtures, because both defects were invisible until the check met an actual layer:
    // the false green needed cdo's helper call and the false negative needed a Syloti Nagri corpus.
    test("cdo: no scale name, and the layer says so itself", () => {
        const r = scaleNames(context("cdo"));
        expect(r.verdict, `cdo emits the bare dô on all three arms: ${r.detail}`).toBe("none");
    });

    test("syl: both names are in the corpus, so `none` is not an answer", () => {
        const r = scaleNames(context("syl"));
        expect(r.verdict).not.toBe("none");
    });

    test("languages that were already right stay right", () => {
        for (const code of ["en", "sv", "sr", "hak"])
            expect(scaleNames(context(code)).verdict, `${code} regressed`).toBe("have");
        // om and mg are SETTLED REFUSALS this file's own header cites — they must not become noise.
        for (const code of ["om", "mg"])
            expect(scaleNames(context(code)).verdict, `${code} lost a settled refusal`).toBe("none");
    });
});
