/**
 * NO COMPOSITOR MAY SPEAK THE WORD "undefined" — fleet-wide, in CI.
 *
 * ⚠ THE FAILURE IS SILENT AND IT IS AUDIBLE. A numeral compositor indexes a magnitude or multiplier table
 * with a count derived from the input. Above its largest DECLARED magnitude that count runs past the end of
 * the table, JavaScript yields `undefined`, and a template literal stringifies it straight into the text the
 * g2p then reads aloud:
 *
 *     cs  `1000000000`     →  *ˈundɛfˌɪnɛt mˈɪlɪjˌonuː*      (`sub1000` is defined to 999; 10⁹ needs 1000)
 *     jv  `1000000000000`  →  *ʊnd̪əfˈinəd̪ ˈat̪ʊs mˈɪljar*   (`NUM.mult` indexed at 10)
 *
 * Nothing throws. No leak gate fires — "undefined" is a well-formed Latin word and the reading is
 * well-formed IPA. It surfaced only because fixing the thousands de-grouping made 10⁹ reachable from
 * grouped input, and then only because the sweep asked the right question.
 *
 * ⚠ THE ORACLE IS WHAT MAKES THIS CHECKABLE IN 188 LANGUAGES: ask each language how IT would pronounce the
 * word "undefined", then assert that no number contains that reading. No per-language expectation needed.
 *
 * THE FIX has two halves and both are required. Declare the missing magnitude where the language has a real,
 * sourceable word for it — cs miliarda/miliardy/miliard (corpus ×17 and ×4), jv triliun (corpus ×4, and the
 * corpus spells `36.900.000.000.000` out in full as "Telung puluh enem triliun sangang atus milyar"). Then
 * put a CEILING above the top declared magnitude that falls back to digit-at-a-time, which is the fleet's
 * existing convention for out-of-range and what fi and fr already do at this size. Without the ceiling the
 * same defect just moves up three orders of magnitude.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

const CODES = [...new Set(
    (readFileSync("src/registry.ts", "utf8").match(/^\s+case "[a-z-]+":/gmu) ?? [])
        .map((l) => l.replace(/[^a-z-]/gu, "")),
)].filter(Boolean);

/** Every order of magnitude a compositor plausibly runs out at, plus the shapes that carry a remainder. */
const NUMS = [
    "1000000000", "1234567890", "9999999999", "100000000000",
    "1000000000000", "999999999999", "1234567890123", "12345678901234567",
];

describe("a numeral compositor never speaks its own undefined", () => {
    test("no language reads the string \"undefined\" out of a large number", () => {
        const guilty: string[] = [];
        for (const c of CODES) {
            let marker: string;
            try { marker = phonemize("undefined", c).trim(); } catch { continue; }
            if (!marker) continue;
            for (const n of NUMS) {
                let o: string; try { o = phonemize(n, c); } catch { continue; }
                if (o.includes(marker)) { guilty.push(`${c} @ ${n}`); break; }
            }
        }
        expect(guilty).toEqual([]);
    });

    test("cs: the billion, with its agreement", () => {
        // 1 → sg, 2-4 → paucal, 5+ → genitive plural, the same paradigm as tisíc and milion.
        expect(phonemize("1000000000", "cs")).toBe(phonemize("miliarda", "cs"));
        expect(phonemize("2000000000", "cs")).toBe(phonemize("dva miliardy", "cs"));
        expect(phonemize("5000000000", "cs")).toBe(phonemize("pět miliard", "cs"));
        // …and the remainder still composes below it
        expect(phonemize("1234567890", "cs")).toBe(phonemize("1 234 567 890", "cs"));
    });

    test("jv: the trillion, and the corpus's own spelled-out citation", () => {
        // ⚠ THE CORPUS WRITES BOTH SIDES OF THIS. `36.900.000.000.000` appears there spelled out as
        // "Telung puluh enem triliun sangang atus milyar rupiah" — the count, the trillion word, then the
        // billions. The compositor must produce exactly that, which is an independent check on the table.
        // ⚠ PINNED AS A LITERAL, and the two reasons it cannot be written as a text comparison are both
        // real and both documented in the engine:
        //   · `nem` not `enem` — the manifest declares the unit as `nem`, the corpus line writes `enem`,
        //     and the corpus has both (`enem` ×26, `nem` ×15). Changing `units[6]` would move rows across
        //     every numeral in the language; that is a measurement of its own, not a rider on this fix.
        //   · `nˈəm` not `nˈem` — numeral words DELIBERATELY bypass the content lexicon (`emitNumber`),
        //     because the ngoko spellings collide with taling homographs (the number seket [səkət̪] vs a
        //     taling seket [sekət̪]). The same string therefore reads differently as a numeral and as text.
        // Everything the citation actually attests — the count, the trillion word, the billions after it,
        // in that order — is what this asserts.
        expect(phonemize("36900000000000", "jv"))
            .toBe("t̪ˈəlʊŋ pˈulʊh nˈəm t̪rilˈiʊn sˈaŋaŋ ˈat̪ʊs mˈɪljar");
        expect(phonemize("1000000000", "jv")).toBe(phonemize("semilyar", "jv"));
    });

    // ⚠ A SECOND ORACLE, because the first one has a blind spot the first one cannot see. `Array.join`
    // renders `undefined` as the EMPTY STRING, so a compositor that drops its count instead of naming it
    // reads clean to the "undefined" probe. Tamil did exactly that: 10¹⁰, 10¹¹ and 10¹² all read as the bare
    // word *கோடி* — three quantities, one reading, no marker, no error. The C# threw
    // `IndexOutOfRangeException` on the same input, which is the same bug landing differently in the two
    // engines and is the worse half: the goldens cover no number that large, so nothing saw either.
    test("distinct numbers read distinctly", () => {
        const NUMS = ["10000000000", "100000000000", "1000000000000", "10000000000000",
                      "1000000000", "123456789012", "999999999999"];
        const collisions: string[] = [];
        for (const c of CODES) {
            const seen = new Map<string, string>();
            for (const n of NUMS) {
                let o: string; try { o = phonemize(n, c); } catch { continue; }
                if (!o) { collisions.push(`${c} reads ${n} as NOTHING`); continue; }
                const hit = seen.get(o);
                if (hit) { collisions.push(`${c} reads ${hit} and ${n} identically`); break; }
                seen.set(o, n);
            }
        }
        expect(collisions).toEqual([]);
    });

    test("ta: the crore count is capped at 999, so 10¹⁰ is the ceiling", () => {
        expect(phonemize("10000000000", "ta")).not.toBe(phonemize("100000000000", "ta"));
        expect(phonemize("9990000000", "ta")).toContain(phonemize("கோடி", "ta"));  // still composes below it
    });

    test("above the top declared magnitude, the fallback is digits — not a wrong word", () => {
        // ⚠ THE CEILING IS THE OTHER HALF OF THE FIX. Reading 10¹⁵ digit-at-a-time is honest; inventing a
        // magnitude word for it would not be, and emitting `undefined` was neither.
        expect(phonemize("1000000000000000", "cs")).toBe(phonemize("1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0", "cs").replaceAll(",", ""));
        expect(phonemize("1000000000000000", "jv")).toBe(phonemize("siji nol nol nol nol nol nol nol nol nol nol nol nol nol nol nol", "jv"));
    });
});
