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
 * ⚠ STILL LOSSY, LISTED BY CODE SO THE LIST CAN ONLY SHRINK. They are NOT reachable from their own
 * corpora — the sweep that produced this file measured every mined corpus and golden and found exactly
 * one language with a >2^53 digit run of its own (ht, since fixed, plus tn) — so this is a latent wrong
 * reading, not a live one.
 *
 * ⚠ THIS NOTE USED TO SAY "each of these reads the run but loses its tail", AND THAT WAS FALSE FOR ALL
 * 31 (#1095). Measured on `phonemize(A, code)` rather than reasoned about: not one of them lost only a
 * tail. Every single one read the THREE CHARACTERS of `1e+21` — `waːħid iθnaːn waːħid`, "one two one" —
 * because `String(1e21)` is exponent form and the filter kept its `1`, `2`, `1`. Five of them (pt,
 * pt-BR, ki, kam, af) even voiced the `e`, which is the Chichewa witness this file's own header opens
 * with, still live years later. The softer sentence is what let 31 entries look benign.
 *
 * ⚠ AND "only the first is mechanical" WAS ALSO WRONG. 21 of the 31 were, and are now fixed:
 *   · **THE PARAMETER EXISTED AND THE CALL SITE DROPPED IT** — the hr/bs shape this file already
 *     records as its hardest lesson, and it was sitting in four more modules: `arabic` (ar and its nine
 *     dialects), `portuguese` (pt, pt-BR), `welsh`, `fula`. Fourteen codes, no new vocabulary, one
 *     argument each.
 *   · **NO PARAMETER, BUT A COMPLETE DIGIT TABLE** — `scottishgaelic`, `irish`, `macedonian`,
 *     `albanian`, `latin`, `ancientgreek`, `afrikaans`, `tamil`. Seven more codes; adding `raw?: string`
 *     and threading the token is the whole change.
 *   · **AND THE WRAPPER SHAPE, ONE DELEGATION FURTHER DOWN** — `ki` and `kam` share
 *     `kikuyu/e5xNumbers.ts`, which has taken `raw` all along; both wrappers dropped it and both call
 *     sites never passed one. Two more codes, and the same lesson as hr/bs a second time: a grep of the
 *     language's own `numbers.ts` for `String(n)` finds nothing, because the stringification is in the
 *     shared file.
 * What remains below is the one class that genuinely needs evidence rather than a rewrite:
 *   · ⚠ A FIX DOES NOT PROPAGATE ALONG A SHARED CORE. `hr` and `bs` compose through the SAME
 *     `serbian/numbers.ts` that took the #1059 threading with `sr`, and both stayed broken for a year of
 *     nothing: the parameter was threaded, their own `numberToWords` wrappers dropped it, and their call
 *     sites never passed a token string. Both read `1000000000000000000000` as *jedan e dva jedan*. Fixed
 *     while porting hr — ⚠ hr's caller must pass the SEPARATOR-STRIPPED string, not the match, because
 *     Croatian's number token carries the thousands periods and the decimal comma. The same rule applied
 *     to the #1095 batch: ar, pt, cy, ff, ga, mk and af all strip a separator before parsing, and the
 *     STRIPPED string is what the fallback must be handed.
 *   · NO FALLBACK AT ALL — tr returns "" above its range and zu composes right past it. Giving these a
 *     digit-at-a-time arm is a per-language behaviour ADDITION, not a mechanical repair, and wants the
 *     language's own evidence. ⚠ `xh` CAME OFF THE LIST ON EXACTLY THAT EVIDENCE, and it was in its own
 *     file: `xhosa/normalize.ts`'s `spell()` already reads a decimal's fractional part digit-at-a-time in
 *     the standalone ku- stems, for the reason its docstring gives ("`34` read as a number is a different
 *     quantity"). The fallback emits the string that path already emits, so nothing was invented. Its
 *     sibling `zu` has no such precedent in its own file and stays listed.
 * ⚠ A NEW LANGUAGE MUST NOT JOIN THIS LIST. It exists to be emptied.
 */
const ACCEPTED_LOSSY = new Set("tr az vi si kk tg zu".split(" "));

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

    // ⚠ THIS RAN OVER FIVE HAND-PICKED CODES AND NOW RUNS OVER EVERY ENGINE (#1095). Exemption from the
    // TAIL test above is not exemption from this one: a listed code may lose its last digit, but reading a
    // 22-digit run as the three characters of `1e+21` is a different and much larger failure, and keeping
    // the two apart is what stopped `ACCEPTED_LOSSY` from hiding it for as long as it did.
    test("the reading is DIGITS, not silence and not exponent notation", () => {
        // Chichewa was the witness: `1e+21` read as *one e two one*, the `e` voiced as a vowel.
        // ⚠ MEASURED IN CHARACTERS, NOT TOKENS: Japanese joins morae with no separator, so a correct
        // 22-digit reading is ONE token. Token-counting would fail a language for its orthography.
        // ⚠ AND THE LENGTH THRESHOLD IS NOT THE WHOLE TEST, because a COMPOSITIONAL reading is legitimately
        // short: English says *one sextillion one* — 30 characters, entirely correct, and it distinguishes
        // A from B. So a short reading only fails when it ALSO cannot tell the two probes apart, which is
        // the exponent shape exactly: `1e+21` has no last digit to differ in.
        const short: string[] = [];
        for (const code of CODES) {
            if (ACCEPTED_LOSSY.has(code)) continue;
            let out: string, other: string;
            try {
                out = phonemize(A, code).trim();
                other = phonemize(B, code).trim();
            } catch {
                continue; // an unported/throwing engine is a different test's business
            }
            // "1 e 2 1" is four digits' worth of phonemes; twenty-two digits is far longer in every engine.
            if (out === "" || (out.length <= 30 && out === other)) short.push(`${code} → ${JSON.stringify(out)}`);
        }
        expect(short).toEqual([]);
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
