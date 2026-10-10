/**
 * `"…".includes("")` IS TRUE, AND A WORD EDGE IS NOT A MEMBER OF ANY LETTER CLASS (#1476).
 *
 * `SET.includes(w[i + 1] ?? "")` answers YES at the end of the word, so end-of-word reads as a vowel (or a
 * front vowel, or a dental — whatever `SET` is). Italian shipped it first (`gas` read with a voiced [z]); the
 * fleet sweep in docs/investigations/includes-empty/includes_empty_investigation.md found it reached real
 * text in Dutch (word-final ⟨c⟩ read [s]: OPEC, Isaac, magnetic …), Swahili and Yoruba (a final ⟨w⟩ deleted
 * into labialization), and reachable from crafted words in German, Czech, Norwegian and Slovenian.
 *
 * Every expectation below is RELATIONAL — the edge word against a word the rule already reads right — so no
 * hand-typed IPA is pinned. Each one fails when its fix is reverted.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { phonemizeWord as cs } from "../src/languages/czech/czech.ts";
import { phonemizeWord as nl } from "../src/languages/dutch/dutch.ts";
import { phonemizeWord as de } from "../src/languages/german/german.ts";
import { toSegments as deSegments } from "../src/languages/german/g2p.ts";
import { phonemizeWordRules as no } from "../src/languages/norwegian/norwegian.ts";
import { phonemizeWord as sl } from "../src/languages/slovenian/slovenian.ts";
import { phonemizeWord as sw } from "../src/languages/swahili/swahili.ts";
import { glideOnset as wuGlide } from "../src/languages/wu/wu.ts";
import { phonemizeWord as yo } from "../src/languages/yoruba/yoruba.ts";

describe("a word edge is not a vowel (#1476)", () => {
    test("Dutch: a word-final ⟨c⟩ is [k], not the soft [s] it gets before e/i/y", () => {
        expect(nl("bloc")).toBe(nl("blok"));
        expect(nl("isaac")).toBe(nl("isaak"));
        expect(nl("cent").startsWith("s")).toBe(true); // control: the soft rule itself still fires
    });

    test("German: a word-final ⟨h⟩ after a prefix-shaped stem stays silent", () => {
        expect(de("geh")).not.toContain("h");
        expect(de("behalten")).toContain("h"); // control: the be·h prefix boundary still sounds it
    });

    test("German: a bare word-initial ⟨ch⟩ is [k], the before-a-non-front-vowel reading", () => {
        expect(deSegments("ch").map((s) => s.ph)).toEqual([deSegments("chlor")[0]!.ph]);
    });

    test("Czech: a word-initial ⟨ě⟩ takes no j-glide (there is no labial before it)", () => {
        expect(cs("ěd")).toBe(cs("ed"));
        expect(cs("věda")).toContain("vj"); // control: after a labial the glide is still there
    });

    test("Norwegian: a one-letter ⟨d⟩ is not the silent final d after l/n/r", () => {
        expect(no("d")).not.toBe("");
        expect(no("land").endsWith("d")).toBe(false); // control: land → lɑn still drops it
    });

    test("Swahili and Yoruba: a final ⟨w⟩ after a consonant is not folded into labialization", () => {
        for (const ipa of [sw("kabw"), yo("bw")]) {
            expect(ipa).not.toContain("ʷ");
            expect(ipa.endsWith("w")).toBe(true);
        }
        expect(sw("mwezi")).toContain("ʷ"); // controls: before a vowel it still labializes
        expect(yo("ẹgwa")).toContain("ʷ");
    });

    // ⚠ CRAFTED COMPOUNDS, NOT DICTIONARY WORDS. The stress-by-suffix rule counts the prefix's nuclei and adds
    // the suffix's lexicon stress; when the count is off by one the stress lands on the wrong syllable of the
    // suffix. A correct count puts it exactly where the suffix alone has it — hence `endsWith`.
    test("Slovenian: the stress-by-suffix counter sees a syllabic ⟨r⟩ at the word's left edge", () => {
        expect(sl("rdečabeceda").endsWith(sl("abeceda"))).toBe(true);
    });

    test("Slovenian: …and a prefix-final ⟨r⟩ reads its RIGHT neighbour from the word, not the slice edge", () => {
        // a suffix with INITIAL stress, so the penultimate fallback the old count fell through to cannot coincide
        expect(sl("vrbabicami").endsWith(sl("babicami"))).toBe(true);
    });

    // ⚠ INERT IN OUTPUT TODAY (no final keys `""`, and `y` is a whole-body final), so the predicate is what is
    // pinned: a one-letter body has no second letter, and `includes("")` must not stand in for a vowel.
    test("Wu: a one-letter body `y`/`w` is not a glide onset", () => {
        expect(wuGlide("w")).toBe(false);
        expect(wuGlide("y")).toBe(false);
        expect(wuGlide("wa")).toBe(true);
        expect(wuGlide("yi")).toBe(true);
        expect(wuGlide("wng")).toBe(false);
    });
});

/**
 * ⚠ THE STATIC HALF, AND ITS LIMIT. This catches only the INLINE shape `.includes(… ?? "")` /
 * `.indexOf(… ?? "")`. The same bug also hides behind a variable (`const nx = w[i + 1] ?? ""` …
 * `"eiy".includes(nx)`, which is how Dutch and German had it) and behind a predicate
 * (`isVowelLetter(s[i + 1] ?? "")`, Yoruba). Neither is greppable without types, so the sweep that found
 * them was a runtime probe — the investigation doc has it. The house idiom for a guarded class test is a
 * predicate that refuses the empty string: `const isV = (c: string) => c !== "" && VOWELS.includes(c)`.
 */
const ALLOWED: readonly { file: string; why: string }[] = [
    // Empty: wu was the last entry, closed in #1476's follow-up (wu.ts `glideOnset`).
];

function sources(dir: string, out: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) sources(p, out);
        else if (/\.(ts|mts)$/.test(e) && !/\.test\./.test(e)) out.push(p);
    }
    return out;
}

describe("no `.includes(x ?? \"\")` in src/ (#1476)", () => {
    test("every inline empty-default membership test is gone", () => {
        const files = sources("src");
        expect(files.length).toBeGreaterThan(300); // the walk found the tree
        const SHAPE = /\.(includes|indexOf)\([^()]*\?\?\s*(""|'')\s*\)/;
        const bad: string[] = [];
        for (const f of files) {
            const rel = f.replaceAll("\\", "/");
            if (ALLOWED.some((a) => a.file === rel)) continue;
            readFileSync(f, "utf8").split("\n").forEach((line, i) => {
                // A comment may QUOTE the shape (afrikaans.ts and slovenian.ts do, to say what was fixed).
                if (/^\s*(\*|\/\*)/.test(line)) return;
                const code = line.replace(/\/\/.*$/, "");
                if (SHAPE.test(code)) bad.push(`${rel}:${i + 1}: ${line.trim()}`);
            });
        }
        expect(bad).toEqual([]);
    });
});
