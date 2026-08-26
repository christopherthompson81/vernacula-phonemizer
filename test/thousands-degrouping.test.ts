/**
 * A GROUPED NUMBER READS LIKE ITS UNGROUPED SELF — fleet-wide, in CI, at ANY group count.
 *
 * ⚠ WHY THIS EXISTS RATHER THAN AS A PER-LANGUAGE TEST. Fifty language/separator pairs carried the same
 * broken idiom, and "the same regex was wrong in forty-five files" is the argument for pinning the CLASS.
 *
 * THE DEFECT. The de-grouping rule was written to CONSUME the trailing group:
 *
 *     /(\d)SEP(\d{3})(?!\d)/gu → "$1$2"
 *
 * On `1 234 567 890` the first match eats `1 234`, the scan resumes INSIDE the remainder and anchors on the
 * LAST digit of the next group, and the result is `1234 567890` — a six-digit block the three-digit rule can
 * never claim again. Repeating the pass cannot recover it, which is why the `for (i < 2)` loops, the
 * `do…while (changed)` loops and igbo's `while (RE.test(s))` all failed identically. What survives is a
 * SEPARATOR sitting inside a number, which the tokenizer then reads as clause punctuation or as a decimal:
 *
 *     ig  `12,345,678,901`      →  *puku iɾi na abʊɔ … ise **,** puku naɾɪ isii …*   one number, two, with a pause
 *     uz  `1 000 000 000 soʻm`  →  *mˈiŋ nˈɒl sˈom*                                  a confidently wrong quantity
 *     sv  `1,234,567,890`       →  the stranded comma becomes a DECIMAL point
 *
 * ⚠ THIS WAS KNOWN AND FIXED IN ONE LANGUAGE ONLY. `latin/normalize.ts` carries the whole analysis, including
 * the exact `1320 000000` trace, and closes it: "four-or-more-group numbers occur twice here and once in ba,
 * and nowhere else — which is why the idiom held everywhere it was used before now." That measurement was
 * about the CORPORA, and it is why nothing else was touched. Three independent C# ports (ig, uz, su) then
 * rediscovered it from probes, which is the answer to the measurement: user text is not the corpus.
 *
 * THE FIX is the same shape everywhere and is worth stating once: match the separator ZERO-WIDTH —
 *
 *     /(?<=\d)SEP(?=\d{3}(?!\d))/gu → ""
 *
 * — consuming nothing, so every separator in the run is claimed in a single pass and the repeat loops become
 * unnecessary. Same separator class, same guard, same looseness; the only thing that changes is what the
 * match consumes. Seven languages (om, am, kn, ml, mn, ka, lv) already used the zero-width form and NONE of
 * them was ever affected — the fix is the fleet's own other half.
 *
 * ⚠ THE ORACLE IS THE POINT, AND IT NEEDS NO PER-LANGUAGE EXPECTATION: if de-grouping works, a grouped
 * number must phonemize EXACTLY like the same digits ungrouped. That is checkable in 188 languages without
 * knowing a word of any of them, and it is what turned "three ports found a bug" into "fifty pairs are
 * broken". Requiring TWO and THREE groups to agree FIRST is what keeps a comma-DECIMAL language out: for a
 * language where `783,562` is 783.562, the separator is not one it de-groups and the probe is meaningless.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

const CODES = [...new Set(
    (readFileSync("src/registry.ts", "utf8").match(/^\s+case "[a-z-]+":/gmu) ?? [])
        .map((l) => l.replace(/[^a-z-]/gu, "")),
)].filter(Boolean);

// ⚠ THE ARABIC COMMA IS IN HERE for a reason: fa and ur convert `،` to `,` with the same consuming
// idiom, and they failed at THREE groups rather than four. A sweep over the ASCII separators alone
// reported both of them clean.
const SEPS: Record<string, string> = { comma: ",", dot: ".", space: " ", arabicComma: "\u060c" };
/** Group counts to probe. 2 and 3 ESTABLISH that the language de-groups this separator at all. */
const CASES = [
    { n: 2, bare: "783562", grouped: (s: string) => `783${s}562` },
    { n: 3, bare: "783562948", grouped: (s: string) => `783${s}562${s}948` },
    { n: 4, bare: "1234567890", grouped: (s: string) => `1${s}234${s}567${s}890` },
    { n: 5, bare: "123456789012", grouped: (s: string) => `123${s}456${s}789${s}012` },
];

/**
 * A THOUSANDS GROUP'S HEAD IS NEVER A BARE `0` — fleet-wide, in CI.
 *
 * ⚠ A SEPARATE CLASS FROM THE ONE ABOVE, found by the same sweep. No convention on earth writes a grouped
 * number whose leading group is `0`, so `0,001` is not 1 — but the de-grouping rules accepted any 1-3 digit
 * head and joined it anyway, a 1000× error:
 *
 *     su  `0,001 gram`  →  *hˈid͡ʒi ɡram*   ("one gram" for one milligram)
 *
 * ⚠ AND THE CITATION IS THE FILE'S OWN. `sundanese/normalize.ts` quotes *"1 MILIGRAM (MG) = 0,001 gram"* as
 * the evidence for its `mg` unit; the line it argues from is the line it misreads.
 *
 * `separatorHygiene.ts` already states the principle this rests on — a single grouped-looking run is left
 * alone because "three digits after the mark means grouping in a grouping convention and a three-place
 * decimal in a decimating one, and nothing here can tell which. Joining it would be a guess with a 1000×
 * error attached." A ZERO HEAD is the one case where there is nothing to tell apart: no convention groups
 * from `0`, so joining it is exactly the guess that file refuses to make.
 *
 * ⚠ AND ONE LANGUAGE ALREADY KNEW. `madurese/normalize.ts` carried `(?!0,)` on its comma arm and nowhere
 * else — the same "fixed in one place, never propagated" shape as the de-grouping bug above.
 *
 * ⚠ THE BACKLOG IS EMPTY AND THE ALLOWLIST IS GONE. It briefly held 55 language/separator pairs — every
 * language that joined the run in its TOKENIZER rather than in a grouping rule. Those turned out to be SIX
 * distinct mechanisms, not one, which is why they could not come out with the grouping rules:
 *   · a token whose number alternative spans any separator run (en `\d[\d,]*`, ar, ur, hi/bn +17 families);
 *   · a token that spans DOT groups (ca/es/gl/pt/tr/az);
 *   · a `frac.length === 3` test in the ENGINE's number branch (cs, mk) — `Number("0"+"001")`;
 *   · an anchored `{1,3}` head in a normalize rule (he, si, mg, bar, pbt/ps, bal, ug, kmr, lo);
 *   · a zero-width separator rule the earlier sweep's `{3}` filter missed (ta `{2,3}`, sat, ka);
 *   · a one-digit-consuming form (`(\d),(?=\d{3})` → `"$1"`) in am and ti.
 * Each needed its own edit; the GUARD is the same everywhere — a lone `0` head takes no group.
 */
describe("a thousands group never has a zero head", () => {
    const SEPS: Record<string, string> = { comma: ",", dot: ".", space: " " };


    test("`0,001` is never joined into `1`", () => {
        const joined: string[] = [];
        for (const c of CODES) {
            for (const [name, sep] of Object.entries(SEPS)) {
                let a: string, b: string;
                try { a = phonemize(`0${sep}001`, c); b = phonemize("1", c); } catch { continue; }
                if (a === b) joined.push(`${c}/${name}`);
            }
        }
        expect(joined).toEqual([]);
    });

    test("su reads its own citation", () => {
        // ⚠ NOT `toContain`: the defect was a MISSING word, and a substring assertion on "gram" passes with
        // the quantity wrong.
        expect(phonemize("0,001 gram", "su")).not.toBe(phonemize("1 gram", "su"));
        // …and a legitimate group is still joined
        expect(phonemize("3,000", "su")).toBe(phonemize("3000", "su"));
        expect(phonemize("10,001", "su")).toBe(phonemize("10001", "su"));
    });
});

describe("thousands de-grouping survives past three groups", () => {
    test("every language that de-groups a separator does so at four and five groups too", () => {
        const broken: string[] = [];
        for (const c of CODES) {
            for (const [name, sep] of Object.entries(SEPS)) {
                const ok: Record<number, boolean> = {};
                let usable = true;
                for (const k of CASES) {
                    try { ok[k.n] = phonemize(k.grouped(sep), c) === phonemize(k.bare, c); }
                    catch { usable = false; break; }
                }
                // The language does not de-group this separator (or cannot be built) — not this test's business.
                if (!usable || !ok[2] || !ok[3]) continue;
                if (!ok[4] || !ok[5]) broken.push(`${c}/${name}`);
            }
        }
        expect(broken).toEqual([]);
    });

    // The three readings the C# ports actually reported, pinned as themselves so a regression names the
    // language rather than only the class.
    test("the three instances that surfaced this", () => {
        // ⚠ WHOLE-STRING, not `toContain`: the defect was a SURVIVING separator, and a substring assertion
        // on the words would pass with the comma still sitting between them.
        expect(phonemize("12,345,678,901", "ig")).toBe(phonemize("12345678901", "ig"));
        expect(phonemize("12,345,678,901", "ig")).not.toMatch(/[,.]/u);
        expect(phonemize("1 000 000 000", "uz")).toBe(phonemize("1000000000", "uz"));
        expect(phonemize("1,234,567,890", "sv")).toBe(phonemize("1234567890", "sv"));
    });

    // ⚠ WHAT THE FIX COULD HAVE BROKEN. A separator that is NOT grouping must still be left alone; the
    // zero-width form keeps each language's own guard, so a decimal and a non-group-sized block survive.
    test("a two-digit block is still not a thousands group", () => {
        // Exactly three digits is what separates a group from a decimal, and the zero-width form keeps that
        // guard verbatim. Both of these refuse, as they did before.
        expect(phonemize("1.23", "it")).not.toBe(phonemize("123", "it"));
        expect(phonemize("1,23", "ig")).not.toBe(phonemize("123", "ig"));
    });

    test("a grouped number keeps its decimal tail", () => {
        // The run ends BEFORE the decimal mark, so the tail is untouched — the case that would have broken
        // had the trailing guard been widened to `(?![.,]\d)` while converting.
        expect(phonemize("1 234.5", "uz")).toBe(phonemize("1234.5", "uz"));
        expect(phonemize("1.234,5", "it")).toBe(phonemize("1234,5", "it"));
    });

    test("the LOOSENESS is unchanged — a five-digit head still merges, as it always did", () => {
        // ⚠ RECORDED, NOT ENDORSED. `12345 678` is two numbers, and a head-anchored rule (`(?<!\d)\d{1,3}`,
        // which bar's space arm and latin both use) would decline it. The zero-width conversion deliberately
        // does NOT tighten this: the fix is for the stranded-separator defect, and tightening here would move
        // goldens for an unrelated reason. Pinned so a later decision to tighten is a deliberate one.
        expect(phonemize("12345 678", "uz")).toBe(phonemize("12345678", "uz"));
    });
});
