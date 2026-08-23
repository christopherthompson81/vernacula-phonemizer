/**
 * THE `script` FIELD IS A CLOSED VOCABULARY, ORDERED BY PRIMACY.
 *
 * ⚠ IT WAS FREE-FORM PROSE, and that made it useless for anything but reading: 38 distinct values over 136
 * files, including `Latin (RPA)`, `Latin (with diacritics)` and `Latin (Berber Latin alphabet)` — which say
 * nothing, since EVERY Latin-script language has its own alphabet and its own diacritics. Two named the wrong
 * level of the hierarchy outright: `Sorani` is an orthography of Arabic, and `Mkhedruli` a style of Georgian.
 * Eleven manifests declared nothing at all.
 *
 * The orthography name (ALUPEC, Hawar, Qubee, Boko, RPA, Shahmukhi, Nastaʿlīq, Bàng-uâ-cê) belongs in the
 * prose header beside the rules it explains, not in a field whose job is to name the script.
 *
 * ⚠ AN ARRAY, NOT A PRIMARY, because several engines genuinely read more than one script and one of them has
 * no primary at all — Japanese is Han and kana together, with neither subordinate. The order is by primacy
 * where that is meaningful (kana first for `ja`, since it is the closest thing to one), and it is what
 * `CYRILLIC_HOSTS` keys on: `sr` leads with Cyrillic, `bs` with Latin.
 */
import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { MANIFESTLESS_SCRIPTS } from "../src/core/scripts.ts";
import { stripJsonc } from "../src/core/jsonc.ts";

/** Unicode script names. A value outside this set is a typo or a new script that needs a deliberate entry. */
const SCRIPTS = new Set([
    "Adlam", "Arabic", "Armenian", "Bengali-Assamese", "Cherokee", "Cyrillic", "Devanagari", "Ethiopic",
    "Georgian", "Greek", "Gujarati", "Gurmukhi", "Han", "Hangul", "Hebrew", "Javanese", "Kana", "Kannada",
    "Khmer", "Lao", "Latin", "Malayalam", "Myanmar", "Nko", "Odia", "Ol Chiki", "Sinhala", "Sundanese",
    "Syloti Nagri", "Tamil", "Telugu", "Thai", "Tibetan",
]);

const DIR = new URL("../data/languages/", import.meta.url);
const manifests: Array<[string, string]> = [];
for (const d of readdirSync(DIR)) {
    // Comments are stripped BEFORE any regex sees the source, so a comment inside a matched span can
    // never make a manifest silently drop out of a scan.
    for (const f of readdirSync(new URL(`${d}/`, DIR)).filter((n) => n.endsWith(".jsonc")))
        manifests.push([`${d}/${f}`, stripJsonc(readFileSync(new URL(`${d}/${f}`, DIR), "utf8"))]);
}
/** A LANGUAGE manifest declares `language`. A variety delta (`variety`) or a data file does not, and is out of scope. */
const langManifests = manifests.filter(([, src]) => /"language"\s*:/u.test(src));

describe("manifest `script` field", () => {
    test("the scan found the manifests", () => {
        expect(manifests.length).toBeGreaterThan(140);
        expect(langManifests.length).toBeGreaterThan(140);
    });

    test("⚠ every LANGUAGE manifest declares one — eleven silently did not", () => {
        const missing = langManifests.filter(([, src]) => !/"script"\s*:/u.test(src)).map(([n]) => n);
        expect(missing, `no "script": ${missing.join(", ")}`).toEqual([]);
    });

    test("the value is a non-empty ARRAY drawn from the closed vocabulary", () => {
        const bad: string[] = [];
        for (const [name, src] of langManifests) {
            const m = /"script"\s*:\s*(\[[^\]]*\])/u.exec(src);
            if (!m) { bad.push(`${name}: not an array`); continue; }
            const scripts = JSON.parse(m[1]!) as string[];
            if (scripts.length === 0) bad.push(`${name}: empty`);
            for (const s of scripts) if (!SCRIPTS.has(s)) bad.push(`${name}: unknown script ${s}`);
            if (new Set(scripts).size !== scripts.length) bad.push(`${name}: duplicate entry`);
        }
        expect(bad).toEqual([]);
    });

    test("⚠ no orthography qualifier — every Latin language has its own alphabet, so saying so says nothing", () => {
        const qualified = langManifests
            .filter(([, src]) => /"script"\s*:\s*\[[^\]]*[(/+][^\]]*\]/u.test(src))
            .map(([n]) => n);
        expect(qualified, `qualifier inside script: ${qualified.join(", ")}`).toEqual([]);
    });

    test("the manifest-less table draws from the same vocabulary", () => {
        const bad: string[] = [];
        for (const [lang, scripts] of Object.entries(MANIFESTLESS_SCRIPTS)) {
            if (scripts.length === 0) bad.push(`${lang}: empty`);
            for (const s of scripts) if (!SCRIPTS.has(s)) bad.push(`${lang}: unknown script ${s}`);
        }
        expect(bad).toEqual([]);
    });

    // ⚠ THE UNION MUST BE EXACT IN BOTH DIRECTIONS. A gap means a registered language silently declares no
    // script; an orphan means a row outlived the engine it described. Neither is visible without this check —
    // the field has no runtime consumer that would fail on a missing entry.
    test("⚠ every registered code is covered exactly once, with no orphan rows", () => {
        const registry = readFileSync(new URL("../src/registry.ts", import.meta.url), "utf8");
        const codes = new Set([...registry.matchAll(/^\s+case "([A-Za-z0-9-]+)":/gmu)].map((m) => m[1]!));
        expect(codes.size).toBeGreaterThan(180);

        const fromManifest = new Set<string>();
        for (const [, src] of langManifests) {
            const m = /"language"\s*:\s*"([^"]+)"/u.exec(src);
            if (m) fromManifest.add(m[1]!);
        }
        const fromTable = new Set(Object.keys(MANIFESTLESS_SCRIPTS));

        const uncovered = [...codes].filter((c) => !fromManifest.has(c) && !fromTable.has(c)).sort();
        expect(uncovered, `no script declaration: ${uncovered.join(", ")}`).toEqual([]);

        const orphans = [...fromTable].filter((c) => !codes.has(c)).sort();
        expect(orphans, `table row for an unregistered code: ${orphans.join(", ")}`).toEqual([]);

        const both = [...fromTable].filter((c) => fromManifest.has(c)).sort();
        expect(both, `declared twice — drop the table row: ${both.join(", ")}`).toEqual([]);
    });
});
