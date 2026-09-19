/**
 * THE COMPOUND SEAM BLOCKS VELAR ASSIMILATION, and the table that says where is data rather than a rule.
 *
 * ⚠ THE RULE IT GUARDS IS RIGHT LESS OFTEN THAN THE DICTIONARY IT OVERRIDES — 298 against 33 over
 * 1,130 referee-labelled sites — but it is not removable, because the 33 are real CMUdict slips that
 * ship wrong without it. These tests pin BOTH sides of that, so neither can be "simplified" away.
 * See data/languages/english/en-nasal-seam.PROVENANCE.md and Run 27 of the English audit.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createEnglish } from "../src/languages/english/english.ts";

const EN = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "languages", "english");
const en = createEnglish();
const say = (w: string) => en.text(w).normalize("NFD").replace(/[̀-ͯʰ-˿ːˈˌ]/gu, "");

describe("velar assimilation across a compound seam", () => {
    test("a listed seam keeps its [n]", () => {
        for (const w of ["pancake", "raincoat", "mankind", "turnkey", "vanguard", "leningrad", "ongoing"])
            expect(`${w}: ${say(w)}`).toBe(`${w}: ${say(w).replace(/ŋ(?=[kɡ])/u, "n")}`);
        expect(say("pancake")).toContain("nk");
        expect(say("sunglasses")).toContain("nɡ");
    });

    // ⚠ THE NEGATIVE IS THE LOAD-BEARING HALF. These are the CMUdict slips the rule exists to repair —
    // the dictionary writes `N` and every source says [ŋ] — so a table that grew to cover them, or a
    // "simplification" that deleted the rule, would ship them wrong and this is what would catch it.
    test("a tautomorphemic N+velar still assimilates", () => {
        for (const w of ["anglophile", "ankh", "gangrene", "drinkable", "lancaster", "idiosyncrasy"])
            expect(`${w}: ${say(w)}`).toContain("ŋ");
    });

    // ⚠ AND THE PREFIX GUARD IS UNTOUCHED — it predates this table and covers 590 words on its own.
    test("a transparent prefix still blocks assimilation without a row", () => {
        expect(say("unclean")).toContain("nk");
        expect(say("income")).toContain("nk");
        expect(seam.has("unclean")).toBe(false);
    });

    const seam = new Map<string, number[]>();
    for (const l of readFileSync(join(EN, "en-nasal-seam.tsv"), "utf8").split("\n")) {
        if (!l || l.startsWith("#")) continue;
        const t = l.indexOf("\t");
        if (t > 0) seam.set(l.slice(0, t), l.slice(t + 1).split(",").map(Number));
    }

    // ⚠ AN INDEX THAT IS NOT AN `N` IS A SILENT NO-OP, which is how this table would rot after an
    // `--emit` regenerates g2p-dict.tsv and shifts a row's phones.
    test("every listed index really is an N before a K or G in the shipped dict", () => {
        const dict = new Map<string, string[]>();
        for (const l of readFileSync(join(EN, "g2p-dict.tsv"), "utf8").split("\n")) {
            const [w, ph] = l.split("\t");
            if (w && ph) dict.set(w, ph.split(" "));
        }
        const bad: string[] = [];
        for (const [w, idx] of seam) {
            const p = dict.get(w);
            if (!p) { bad.push(`${w}: not in the dict`); continue; }
            for (const i of idx) {
                const a = p[i]?.replace(/[0-2]$/u, ""), b = p[i + 1]?.replace(/[0-2]$/u, "");
                if (a !== "N" || (b !== "K" && b !== "G")) bad.push(`${w}[${i}]: ${a} ${b}`);
            }
        }
        expect(bad).toEqual([]);
    });
});
