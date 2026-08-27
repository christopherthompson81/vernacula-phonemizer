/**
 * A DIGIT RUN TOO LONG FOR A DOUBLE MUST STILL READ ITS OWN DIGITS.
 *
 * ⚠ THE DEFECT WAS USING A FLOAT AS A CARRIER OF DIGITS. Every engine's overflow fallback is meant to read
 * an out-of-range numeral digit-at-a-time, and ~77 of them derived those digits with
 * `String(Math.abs(n))` / `String(n)` — on a value the caller had already produced with `Number(token)`. By
 * the time the fallback ran the digits were gone: above 2^53 the double has rounded, and above 1e21 JS
 * renders it in EXPONENT FORM, so `1000000000000000000000` read as *"one e two one"* in Chichewa with the
 * `e` reaching the phoneme stream as a vowel (#1059). The token string was in scope at every call site.
 *
 * ⚠ NOT A CASE FOR BigInt, AND `core/numbers.ts` ALREADY ARGUES WHY: nothing here does arithmetic. The
 * number is only ever a carrier on the way to speech, and the one numeric question — "is this inside the
 * range I have WORDS for" — is answerable from the string's length. BigInt would buy the ability to COMPOSE
 * above 2^53, which is blocked on data, not on maths: the magnitude words above 10¹² were never sourced for
 * most of these languages. Digit-at-a-time is also the CORRECT reading for what actually occurs — all 38
 * ≥13-digit runs in the goldens are ISBNs, DOIs and registry codes, which a speaker reads digit by digit.
 *
 * THE INSTRUMENT IS LANGUAGE-AGNOSTIC: two 22-digit runs differing only in the last digit must not read
 * identically. It needs no IPA knowledge and cannot be satisfied by silence — a language that drops the
 * numeral entirely fails too.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

const A = "1000000000000000000001";
const B = "1000000000000000000009";

/**
 * ⚠ STILL LOSSY, LISTED BY CODE SO THE LIST CAN ONLY SHRINK. Each of these reads the run but loses its
 * tail. They are NOT reachable from their own corpora — the sweep that produced this file measured every
 * mined corpus and golden and found exactly one language with a >2^53 digit run of its own (ht, since
 * fixed, plus tn) — so this is a latent wrong reading, not a live one.
 *
 * They divide into two classes and only the first is mechanical:
 *   · ⚠ THE "ANOTHER STRINGIFICATION SHAPE" CLASS IS NOW EMPTY. `cs` and `he` were the two — both inlined
 *     `[...String(n)]` at the fallback rather than calling a helper, which is why the sweep's pattern
 *     missed them — and both took the same threading fix while being ported to C#. Neither was merely a
 *     rounded tail: `String(1e21)` is `"1e+21"`, so `e` and `+` became `undefined` table lookups joined as
 *     empty strings, and Czech read BOTH probes as *jˈɛdɛn dvˈa jˈɛdɛn*. What remains below is one class
 *     only, and it is the one that needs evidence rather than a rewrite.
 *   · NO FALLBACK AT ALL — tr returns "" above its range and zu composes right past it. Giving these a
 *     digit-at-a-time arm is a per-language behaviour ADDITION, not a mechanical repair, and wants the
 *     language's own evidence.
 * ⚠ A NEW LANGUAGE MUST NOT JOIN THIS LIST. It exists to be emptied.
 */
const ACCEPTED_LOSSY = new Set(
    ("ar arz apc apd acm afb ary ayl ajp acw pt pt-BR tr az vi ta gd ga cy ff si kk tg zu xh hr bs da " +
        "mk lb fo sq la bar rw ki kam af rn grc").split(" "),
);

const CODES = [
    ...new Set([...readFileSync("src/registry.ts", "utf8").matchAll(/^\s*case "([^"]+)":/gmu)].map((m) => m[1]!)),
];

describe("a 22-digit run keeps its last digit (#1059)", () => {
    test("every engine not on the accepted-lossy list reads the tail", () => {
        const lost: string[] = [];
        for (const code of CODES) {
            if (ACCEPTED_LOSSY.has(code)) continue;
            let a: string, b: string;
            try {
                a = phonemize(A, code).trim();
                b = phonemize(B, code).trim();
            } catch {
                continue; // an unported/throwing engine is a different test's business
            }
            if (a === b) lost.push(code);
        }
        expect(lost).toEqual([]);
    });

    test("⚠ THE ACCEPTED LIST MAY ONLY SHRINK — an entry that now reads must be removed", () => {
        const fixed: string[] = [];
        for (const code of ACCEPTED_LOSSY) {
            try {
                if (phonemize(A, code).trim() !== phonemize(B, code).trim()) fixed.push(code);
            } catch { /* unported: leave it listed */ }
        }
        expect(fixed).toEqual([]);
    });

    test("the reading is DIGITS, not silence and not exponent notation", () => {
        // Chichewa was the witness: `1e+21` read as *one e two one*, the `e` voiced as a vowel.
        // ⚠ MEASURED IN CHARACTERS, NOT TOKENS: Japanese joins morae with no separator, so a correct
        // 22-digit reading is ONE token. Token-counting would fail a language for its orthography.
        for (const code of ["nya", "es", "ru", "ja", "km"]) {
            const out = phonemize(A, code).trim();
            expect(out, code).not.toBe("");
            // "1 e 2 1" is four digits' worth of phonemes; twenty-two digits is far longer in every engine.
            expect(out.length, code).toBeGreaterThan(30);
        }
    });
});

describe("an undeclared power respects unitPrefix (#1060)", () => {
    // Chichewa declares `squared` and not `cubed` (⟨cubed⟩ is genuinely unattested for it). The undeclared
    // branch returned number-first unconditionally, so one rule produced two word orders — and the cube was
    // dropped as well, so only half the failure was visible.
    test("the unit leads in a unitPrefix language whether or not the power has a word", () => {
        const km = phonemize("5 km", "nya").trim();
        expect(phonemize("5 km³", "nya").trim()).toBe(km); // unit-first, power unsaid — the data gap, stated
        expect(phonemize("5 km²", "nya").trim()).toContain("sikweja"); // …and the declared power still reads
        expect(phonemize("5 km²", "nya").trim().startsWith("sikweja")).toBe(true);
    });
});
