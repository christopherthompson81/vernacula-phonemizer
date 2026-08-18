/**
 * A LOWERCASED SCALE LETTER IS STILL THE SCALE — fleet-wide, in CI.
 *
 * `30 °c` must read exactly as `30 °C`. Every language that had a `°C`/`°F` rule wrote it uppercase-only,
 * and lowercased running text is not an edge case — it is the MAJORITY form. Counted across all 102 FLEURS
 * `train.tsv` splits:
 *
 *     lowercase °c / °f   298        uppercase °C / °F   151
 *
 * so two occurrences in three missed the rule and fell through to the bare-degree arm, leaving a loose
 * scale letter for the g2p. In German that read *zweiunddreissig Grad k* (⟨c⟩ → /k/ context-free); the
 * defect surfaced from FLEURS audio, where two readers of the same utterance say "Grad Celsius" and
 * "Grad Fahrenheit". 127 rules across 79 files were affected; Mongolian was the only one already fixed,
 * and its own comment names this exact bug.
 *
 * ⚠ THE REGEX FLAG IS HALF THE FIX. Twelve of those rules CAPTURE the scale letter and branch on it
 * (`scale === "C" ? Celsius : Fahrenheit`, `SCALE[sc]`). Adding `i` without fixing the comparison is
 * strictly worse than the original miss: `°c` starts matching and then reads as FAHRENHEIT, or the table
 * lookup misses and emits a literal "undefined" into the IPA. Both arms are asserted below.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

const CATALOGUE = "tools/language-catalogue/catalogue.tsv";

/** Every language the catalogue records as having its own normalization layer. */
function treatedLanguages(): string[] {
    const lines = readFileSync(CATALOGUE, "utf8").split("\n").filter(Boolean);
    const header = lines[0]!.split("\t");
    const code = header.indexOf("code");
    const norm = header.indexOf("normalization");
    return lines.slice(1).map((l) => l.split("\t"))
        .filter((r) => (r[norm] ?? "") === "done").map((r) => r[code]!);
}

describe("a lowercased °c / °f reads as the scale, not as a loose letter", () => {
    const treated = treatedLanguages();

    test("the catalogue is readable and the fleet is the size we think", () => {
        expect(treated.length).toBeGreaterThan(100);
    });

    test("no language reads °c differently from °C", () => {
        const broken: string[] = [];
        for (const code of treated) {
            for (const [up, lo] of [["30 °C", "30 °c"], ["30 °F", "30 °f"]] as const) {
                let a: string, b: string;
                try { a = phonemize(up, code).trim(); } catch { continue; }
                try { b = phonemize(lo, code).trim(); } catch {
                    broken.push(`${code} ${lo} THREW`); continue;
                }
                if (a !== b) broken.push(`${code}: ${up} → ${a}   but   ${lo} → ${b}`);
            }
        }
        expect(broken, `a lowercased scale letter changed the reading:\n${broken.join("\n")}`).toEqual([]);
    });

    test("no language leaks a literal \"undefined\" from a scale lookup", () => {
        const broken: string[] = [];
        for (const code of treated) {
            for (const probe of ["30 °C", "30 °c", "30 °F", "30 °f"]) {
                let out: string;
                try { out = phonemize(probe, code); } catch { continue; }
                // ⚠ THE MATCH IS ON THE IPA, so a `SCALE[sc]` miss shows up as the WORD "undefined" run
                //   through the g2p — `undɪfinɪd` in Setswana — not as the ASCII string. Test the
                //   normalizer's own output shape by looking for either.
                if (/undefined|und[ɪiəe]f[ɪiaɪ]n/iu.test(out)) broken.push(`${code} ${probe} → ${out}`);
            }
        }
        expect(broken, `a scale lookup missed and its undefined reached the IPA:\n${broken.join("\n")}`)
            .toEqual([]);
    });

    /**
     * ⚠ THE ℃ / ℉ LIGATURES, asserted here because a sweep across this exact code BROKE them and CI did
     * not notice. Many languages fold the single-character forms with
     * `.replace(/℃/gu, "°C").replace(/℉/gu, "°F")` on ONE line, and a within-line regex sweep matched from
     * the first `/` across `℃/gu, "°C").replace(/` — a span that does contain a `°` and a `C` — and
     * inserted its flag in the middle, leaving `/i℉/gu`. Twelve languages silently stopped normalising ℉,
     * and every one of the 4,821 tests still passed. This is the assertion that would have caught it.
     */
    test("the ℃ and ℉ ligatures read exactly as °C and °F", () => {
        const broken: string[] = [];
        for (const code of treated) {
            for (const [lig, plain] of [["30 ℃", "30 °C"], ["30 ℉", "30 °F"]] as const) {
                let a: string, b: string;
                try { a = phonemize(lig, code); b = phonemize(plain, code); } catch { continue; }
                if (a !== b) broken.push(`${code}: ${lig} → ${a}   but   ${plain} → ${b}`);
            }
        }
        expect(broken, `a ligature no longer folds to its degree form:\n${broken.join("\n")}`).toEqual([]);
    });

    test("C and F stay distinct wherever the language distinguishes them at all", () => {
        const flipped: string[] = [];
        for (const code of treated) {
            let C: string, F: string, c: string, f: string;
            try {
                C = phonemize("30 °C", code); F = phonemize("30 °F", code);
                c = phonemize("30 °c", code); f = phonemize("30 °f", code);
            } catch { continue; }
            // A language with no separate Fahrenheit word reads both the same; that is a coverage gap,
            // not a flip, and it is out of scope here. Only assert the ones that DO distinguish.
            if (C === F) continue;
            if (c === F) flipped.push(`${code}: °c reads as Fahrenheit`);
            if (f === C) flipped.push(`${code}: °f reads as Celsius`);
        }
        expect(flipped, `the case-insensitive flag flipped a scale:\n${flipped.join("\n")}`).toEqual([]);
    });
});
