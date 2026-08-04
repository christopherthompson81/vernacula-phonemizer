/**
 * ACCENTED LATIN IS ONE WORD (#657) — the fleet-wide pin for the tokenizer widening.
 *
 * A word group narrower than Latin ends the token at an out-of-inventory diacritic. That letter becomes an
 * unclaimed gap read as an English LETTER NAME, and the rest of the word starts over — one word becomes three:
 *     id  Cañitas   → t͡ʃˈa ˈɛn ˈitas      hi  São Paulo → ˈɛs ˈə ˈoᶷ pʰˈɔːloᶷ
 *
 * ⚠ INVISIBLE TO EVERY GATE. No digit or raw mark survives and nothing VANISHES, so it is a WRONG-WORD defect
 * that neither the leak classes nor the differential DROP test can reach. Every instance was found by reading a
 * corpus diff. This file exists so the next one is caught by a test instead.
 *
 * ⚠ AND THE SWEEP IS THE SPECIFICATION. An earlier version of this file listed the languages it had fixed and
 * asserted the invariant for those. That is a test of the work done, not of the property wanted, and it passed
 * while 91 of 180 registered languages still fragmented — because the work list had been derived from
 * `grep '^const TOKEN'` rather than from the probe that measured the defect. The sweep below runs over every code
 * the registry serves; `REMAINING` names what is still broken, and the sweep also fails if a language in
 * `REMAINING` has quietly started passing, so the list cannot go stale in either direction.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { registeredCodes } from "../tools/registry-map.ts";

/** The signature of the defect: an English letter name where a foreign name's letter should be. */
const LETTER_NAME = /ˈɛ[nms] |ˈoᶷ |ˈaᶦ |jˈuː |ˈɛks /u;
/** Three names carrying a diacritic that most inventories lack, each a real corpus token. */
const PROBES = ["Cañitas", "São", "Klöcker"];

/** Does `lang` still cut one of the probe words into pieces? Returns the offending reading, or "". */
function fragments(lang: string): string {
    for (const w of PROBES) {
        let out: string;
        try {
            out = phonemize(w, lang);
        } catch {
            continue; // engine cannot take a bare Latin word at all; not this defect
        }
        if (LETTER_NAME.test(out) || out.trim().split(/\s+/u).length > 1) return `${w} → ${out}`;
    }
    return "";
}

/**
 * ⚠ STILL BROKEN — 74 engines that NATIVISE a foreign name and have no fold, so an out-of-inventory accent is
 * still cut out of the word. Each needs `makeNativiser` wiring plus a corpus diff read; they are being worked
 * through in batches. Shrink this list, never grow it.
 *
 * These are NOT a script-routing problem and the shared scanner does not reach them: a Portuguese name inside
 * Spanish text is Latin inside Latin, so the run correctly stays with the host and what is missing is the
 * inventory fold (see core/hostWord.ts).
 */
const REMAINING = new Set([
    // Multi-script word arms — the arm mixes Latin with a second script, so widening it blindly would let a
    // MIXED-script run become one token. Each needs its scripts named explicitly to `hostWordRun`.
    "bs", "sr",            // Cyrillic + Latin in one class
    "bm",                  // Latin + N'Ko          ff: Latin + Adlam
    "ff", "su", "za",      // Latin + Sundanese / Latin + Han
    "bal",                 // Perso-Arabic OR Latin as two alternatives inside one group
    // Tokenizers that are not a top-level `const TOKEN`, or whose word handler is not `if (m[1])`.
    "hmn", "nan", "shi", "jv",
]);

describe("accented Latin stays one word (#657)", () => {
    test("⚠ the fleet-wide sweep — every code the registry serves", () => {
        const broken: string[] = [];
        const fixed: string[] = [];
        for (const { code } of registeredCodes()) {
            const bad = fragments(code);
            if (bad !== "" && !REMAINING.has(code)) broken.push(`${code}: ${bad}`);
            if (bad === "" && REMAINING.has(code)) fixed.push(code);
        }
        expect(broken, "languages fragmenting an accented Latin word that are NOT in REMAINING").toEqual([]);
        // The other direction, so REMAINING cannot outlive the defect and silently understate the coverage.
        expect(fixed, "languages in REMAINING that now PASS — remove them from the list").toEqual([]);
    });
});

/** Engines that NATIVISE a foreign name — they read it with their own values, so the accented form must read
 *  exactly like its ASCII twin. The accent folds to its base; it must not be DROPPED, which is what an
 *  unwidened token plus a g2p with no rule for the letter produced (`Klöcker` → *klkkeɾ*). */
const NATIVISERS = ["cs", "it", "pl", "sk", "sl", "nb", "ro", "sw", "xh", "zu", "lv", "lt", "ak", "naq", "tl", "pcm"];

/** Engines that ROUTE a foreign name to an injected reader — the reading must match English exactly. */
const ROUTERS = ["id", "ms", "om", "hi", "mr", "ne", "gu", "pa", "or", "bn", "as", "bpy", "kn", "ml", "te",
    "fa", "sd", "ur", "ps", "gan", "hak", "cjy", "wuu", "hsn"];

/** A native accented word per language: it must survive untouched, which is what makes the fold CONDITIONAL. */
const NATIVE_ACCENTS: [string, string][] = [
    ["cs", "čas"], ["it", "perché"], ["pl", "łódź"], ["sk", "čas"], ["sl", "češnja"],
    ["nb", "blåbær"], ["ro", "țară"], ["lv", "čība"], ["lt", "ąžuolas"], ["ak", "ɛdwuma"],
    ["naq", "ǀgôa"], ["tl", "Doña"],
];

describe("the two shapes, asserted directly", () => {
    test("a NATIVISING engine reads the accented form exactly like its ASCII twin", () => {
        for (const lang of NATIVISERS) {
            expect(phonemize("São Paulo", lang), `${lang} São`).toBe(phonemize("Sao Paulo", lang));
            expect(phonemize("Klöcker", lang), `${lang} Klöcker`).toBe(phonemize("Klocker", lang));
        }
    });

    test("a ROUTING engine agrees with English on a foreign name", () => {
        for (const lang of ROUTERS)
            expect(phonemize("Cañitas", lang), lang).toBe(phonemize("Cañitas", "en"));
    });

    test("⚠ a NATIVE accent is not fragmented — the invariant, stated directly", () => {
        // ⚠ TWO EARLIER VERSIONS OF THIS TEST ASSERTED THE WRONG THING. Both compared the native word against its
        // de-accented form and demanded they differ, as a proxy for "the accent survived". That proxy is false in
        // two ways:
        //   · Akan's `ɛ` and Nama's clicks are DISTINCT LETTERS, not base-plus-diacritic — NFD cannot decompose
        //     them, so there is nothing for a fold to destroy and the comparison is vacuous.
        //   · Nama reads `ô` as /o/ in its OWN g2p, so `ǀgôa` and `ǀgoa` coincide legitimately — identical output
        //     is not evidence the accent was dropped.
        // The property that actually matters is that the word is not SHREDDED, so assert that instead of a proxy.
        for (const [lang, word] of NATIVE_ACCENTS) {
            const out = phonemize(word, lang);
            expect(out, `${lang} ${word}`).not.toMatch(LETTER_NAME);
            expect(out.trim().split(/\s+/u).length, `${lang} ${word} token count`).toBe(1);
        }
        // And the one case where the CONDITIONAL fold is directly observable: Tagalog reads `ñ` as /ɲ/, which an
        // unguarded fold would flatten to /n/.
        expect(phonemize("Doña", "tl")).toContain("ɲ");
        expect(phonemize("Doña", "tl")).not.toBe(phonemize("Dona", "tl"));
    });

    test("an ASCII-only lookaround does not decide where an initialism ends (ja/ko)", () => {
        // `(?<![A-Za-z])[A-Z](?![A-Za-z])` treated the `S` of `São` as an ISOLATED capital, because `ã` is not
        // in `[A-Za-z]` — so it was spelled as a letter name and the rest of the name left behind.
        for (const lang of ["ja", "ko"]) {
            expect(phonemize("São", lang).trim().split(/\s+/u).length, `${lang} São`).toBe(1);
            expect(phonemize("Sámi", lang), `${lang} Sámi`).not.toMatch(LETTER_NAME);
        }
        // …while a real initialism still spells out, which is what the ASCII-only MATCHED class is for.
        expect(phonemize("UNESCO", "ja")).not.toBe(phonemize("Unesco", "ja"));
    });
});
