import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

/**
 * ⚠ AN INTEGER ABOVE 2^53 WAS EITHER DELETED FROM THE READING OR LEAKED AS RAW ASCII DIGITS, in 55 engines.
 *
 * `Number.isSafeInteger` is used, correctly, to refuse to COMPOSE a numeral whose low digits the float has
 * already lost — `9007199254740993` arrives in JS as `…992`, so a composed reading would be confidently
 * WRONG about the quantity. The guard is right and stays. What was missing is the `else`:
 *
 *   - ELEVEN engines emitted NOTHING (ko ur id ms zsm ro tl sd jv mn my). This is the severe form: the
 *     sentence still scans without its numeral, so no corpus diff, referee or review checklist ever named
 *     it. A dropped digit is audible; a dropped NUMBER is not.
 *   - FORTY-FOUR emitted the raw digit string into the IPA, where no g2p in this fleet reads Latin digits.
 *
 * Commit 49f9a08 fixed the seven Sinitic engines and named the other 55 so they would not be rediscovered;
 * `docs/investigations/numbers/bignum_fallback_investigation.md` is the run log for this half. The fix everywhere is
 * digit-at-a-time out of the language's OWN number words — every one of these engines already reads a
 * decimal tail or a year that way — and never BigInt, which would need a magnitude register (trillion and
 * above) the dicts were never measured on and would trade a silent drop for a confidently-wrong numeral.
 *
 * ⚠ EVERY LANGUAGE HERE IS A REGRESSION FROM A REAL DEFECT, not a specification exercise.
 */

/** The 11 that DELETED the number outright, and the 44 that leaked its digits. Fixed together. */
const DROPPED = ["ko", "ur", "id", "ms", "zsm", "ro", "tl", "sd", "jv", "mn", "my"] as const;
const LEAKED = [
    "hi", "bn", "as", "bpy", "pa", "pnb", "skr", "mr", "te", "fa", "it", "pcm", "ak", "sw", "gu", "kn",
    "ml", "or", "uz", "bg", "tk", "tt", "nog", "ba", "kaa", "crh", "chv", "rkt", "ckb", "bal", "bho",
    "mag", "bgc", "hne", "awa", "mai", "uk", "be", "hy", "hyw", "ky", "nb", "su", "ne", "ug", "syl",
] as const;

const BIG = "9007199254740993"; // 2^53 + 1: the smallest integer the float cannot hold exactly
const BIG2 = "9007199254740994"; // …and its neighbour, differing in ONE digit
const SAFE = "9007199254740991"; // 2^53 - 1: the largest that still COMPOSES

describe("an integer above 2^53 degrades to digit-at-a-time — it is never dropped and never leaks", () => {
    /**
     * ⚠ THREE TRAPS, AND THE FIRST TWO ARE NOT ENOUGH ON THEIR OWN.
     *
     * An emptiness assertion alone passes on a fallback that emits a CONSTANT — which is exactly what the
     * pre-fix behaviour was ("" for every unsafe integer). So the test must show that two unsafe integers
     * differing in ONE digit read DIFFERENTLY: that is the only assertion that says the digits are actually
     * being read rather than a placeholder being substituted.
     *
     * And a no-raw-digits assertion is the second half of the same story: an engine can be "not empty" while
     * emitting `9007199254740993` verbatim into the IPA, which is what 44 of these did.
     */
    for (const lang of [...DROPPED, ...LEAKED]) {
        test(`${lang} — reads an unsafe integer, and reads its DIGITS`, () => {
            const read = phonemize(BIG, lang).trim();
            expect(read, `${lang}: the number vanished from the reading`).not.toBe("");
            expect(read, `${lang}: raw ASCII digits leaked into the IPA`).not.toMatch(/\d/u);
            expect(read, `${lang}: the fallback emits a constant, not the digits`).not.toBe(
                phonemize(BIG2, lang).trim(),
            );
        });
    }

    /**
     * …AND THE SAFE RANGE IS UNTOUCHED. `2^53 - 1` still COMPOSES (a real numeral with its magnitude words),
     * which is a different reading from its digit string — so the fallback cannot have quietly swallowed the
     * normal path, and the `isSafeInteger` guard is still doing the job it was added for.
     */
    for (const lang of [...DROPPED, ...LEAKED]) {
        test(`${lang} — the composed path still composes below the cap`, () => {
            const safe = phonemize(SAFE, lang).trim();
            expect(safe, `${lang}: the safe integer stopped reading`).not.toBe("");
            expect(safe, `${lang}: the safe integer now reads as its digit string`).not.toBe(
                phonemize(BIG, lang).trim(),
            );
            // A small number is composed, not spelled: 12 is not "one two" in any of these languages, and
            // it must not have picked up raw digits either.
            expect(phonemize("12", lang).trim(), lang).not.toMatch(/\d/u);
        });
    }

    /**
     * ⚠ A DIGIT RUN IS READ IN THE LANGUAGE, NOT SPELLED FROM A SHARED TABLE. Two related engines must not
     * come out byte-identical unless they genuinely share a phonology — the fallback reads through each
     * engine's own g2p, so a language whose digit words differ must differ here too. `ms`/`zsm` ARE expected
     * to match `id` (they wrap that engine by design, see the registry), which is why they are excluded.
     */
    test("⚠ the fallback goes through each engine's OWN words, not one shared spelling", () => {
        const readings = new Map<string, string[]>();
        for (const lang of [...DROPPED, ...LEAKED]) {
            if (lang === "ms" || lang === "zsm") continue; // aliases of `id` on purpose
            const r = phonemize(BIG, lang).trim();
            readings.set(r, [...(readings.get(r) ?? []), lang]);
        }
        // Collisions are allowed only between engines that share a number path AND a phonology by design.
        const SHARED: readonly string[][] = [
            ["hi", "bgc"], // bgc is built from makeNativeHindi with the Hindi manifest
            // ⚠ pa/pnb/skr COINCIDE HERE FOR A REAL REASON, checked rather than assumed. pa and pnb are the
            // same engine by registry design; skr is the NON-tonal Lahnda sibling and does read differently
            // (ਘਰ → pa *kˈə˨˩ɾ* vs skr *ɡʱˈəɾ*) — but none of the ten digit words carries a voiced aspirate,
            // so tonogenesis has nothing to fire on and the digit strings match. `1234` matches across all
            // three on the COMPOSED path too, so this is a property of the number data, not of the fallback.
            ["pa", "pnb", "skr"],
        ];
        for (const [, langs] of readings) {
            if (langs.length === 1) continue;
            expect(
                SHARED.some((g) => langs.every((l) => g.includes(l))),
                `these engines read an unsafe integer identically and are not declared aliases: ${langs.join(" ")}`,
            ).toBe(true);
        }
    });

    /**
     * ⚠ THE NUMBER SURVIVES INSIDE A SENTENCE, which is where the drop was invisible. A numeral flanked by
     * words used to leave the sentence scanning perfectly with the quantity simply gone — the reason no
     * corpus diff ever caught it. So assert the reading GREW, rather than that it is merely non-empty.
     */
    test("⚠ …and in running text, where a dropped number leaves a sentence that still scans", () => {
        const CARRIER: Partial<Record<string, [string, string]>> = {
            ko: ["그것은 ", " 이다"],
            ru: ["это ", " раз"], // a control: ru was never affected
            hi: ["यह ", " है"],
            it: ["sono ", " metri"],
            uk: ["це ", " метрів"],
        };
        for (const [lang, [pre, post]] of Object.entries(CARRIER) as [string, [string, string]][]) {
            const withNumber = phonemize(`${pre}${BIG}${post}`, lang).trim();
            const without = phonemize(`${pre}${post}`, lang).trim();
            expect(withNumber.length, `${lang}: the numeral contributed nothing to the sentence`)
                .toBeGreaterThan(without.length);
        }
    });
});

/**
 * ⚠ 2^53 IS NOT THE ONLY CLIFF, and finding that took a SECOND probe with a different question. The first
 * one asked "what breaks above the float's exact-integer limit?" and could not see these at all: it skipped
 * any engine whose safe integer did not read, and it only ever tried one magnitude. Seven engines cap their
 * authored magnitude words at 10¹² and fell off there instead — `ha` returning "" (the number deleted) and
 * `ps`/`pbt`/`am`/`ti`/`eu`/`ln` returning the raw digit string (ASCII inside the IPA).
 *
 * The distinction that matters: a missing magnitude word is a real limit and inventing one would be the
 * Fula `tere` failure. Refusing to COMPOSE is right. Refusing to SPEAK is not — the digits are still there
 * to be read one at a time, which is what every one of these now does.
 */
describe("the authored-range cap is a limit on composition, never a licence to go silent", () => {
    const CAPPED = ["ha", "ps", "pbt", "am", "ti", "eu", "ln"] as const;
    const OVER = "1234567890123"; // 13 digits — over the 10¹² cap, far under 2^53

    test("⚠ a numeral past the 10¹² cap is still spoken, and does not leak ASCII", () => {
        for (const lang of CAPPED) {
            const read = phonemize(OVER, lang).trim();
            expect(read, `${lang}: the numeral was dropped entirely`).not.toBe("");
            expect(read, `${lang}: raw digits leaked into the IPA`).not.toMatch(/\d/u);
            // …and the digits are READ, not replaced by one placeholder: change the last digit, change the
            // reading. Before the fix both sides were "" (ha) or the literal digits (the rest).
            expect(phonemize("1234567890124", lang).trim(), `${lang}: the fallback ignores the digits`)
                .not.toBe(read);
        }
    });

    test("…and the composed path BELOW the cap is untouched", () => {
        for (const lang of CAPPED) {
            // 12 digits still composes with the authored magnitude words, so it must NOT equal the reading
            // of its own digits one at a time — that equality would mean the fallback had swallowed the
            // normal path, which is the way this fix could silently do more harm than the defect.
            const composed = phonemize("123456789012", lang).trim();
            expect(composed, lang).not.toBe(phonemize([..."123456789012"].join(" "), lang).trim());
            expect(composed, lang).not.toMatch(/\d/u);
        }
    });
});
