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
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

/** Engines that NATIVISE a foreign name — they read it with their own values, so the accented form must read
 *  exactly like its ASCII twin. The accent folds to its base; it must not be DROPPED, which is what an
 *  unwidened token plus a g2p with no rule for the letter produced (`Klöcker` → *klkkeɾ*). */
const NATIVISERS = ["cs", "it", "pl", "sk", "sl", "nb", "ro", "sw", "xh", "zu", "lv", "lt", "ak", "naq", "tl", "pcm"];

/** Engines that ROUTE a foreign name to an injected reader — the reading must match English exactly. */
const ROUTERS = ["id", "ms", "om", "hi", "mr", "ne", "gu", "pa", "or"];

/** A native accented word per language: it must survive untouched, which is what makes the fold CONDITIONAL. */
const NATIVE_ACCENTS: [string, string][] = [
    ["cs", "čas"], ["it", "perché"], ["pl", "łódź"], ["sk", "čas"], ["sl", "češnja"],
    ["nb", "blåbær"], ["ro", "țară"], ["lv", "čība"], ["lt", "ąžuolas"], ["ak", "ɛdwuma"],
    ["naq", "ǀgôa"], ["tl", "Doña"],
];

describe("accented Latin stays one word (#657)", () => {
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
            expect(out, `${lang} ${word}`).not.toMatch(/ˈɛ[nms] |ˈoᶷ |ˈaᶦ |jˈuː /u);   // no English letter names
            expect(out.trim().split(/\s+/u).length, `${lang} ${word} token count`).toBe(1);
        }
        // And the one case where the CONDITIONAL fold is directly observable: Tagalog reads `ñ` as /ɲ/, which an
        // unguarded fold would flatten to /n/.
        expect(phonemize("Doña", "tl")).toContain("ɲ");
        expect(phonemize("Doña", "tl")).not.toBe(phonemize("Dona", "tl"));
    });

    test("no engine emits a stray letter name for a diacritic", () => {
        // The signature of the defect: an English letter name in the middle of a foreign name.
        for (const lang of [...NATIVISERS, ...ROUTERS])
            expect(phonemize("Cañitas", lang), lang).not.toMatch(/ˈɛn /u);
    });
});
