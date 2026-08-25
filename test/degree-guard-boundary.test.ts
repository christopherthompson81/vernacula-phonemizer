/**
 * The °C/°F guard must be `(?![\p{L}\p{M}])`, never `\b`.
 *
 * JS defines `\b` on ASCII `\w`, so after the ⟨C⟩ a following NON-ASCII letter counts as a word boundary and
 * the rule fires when it must not: German `25°Cölner` read as "Grad Celsius" + "ölner", the ⟨C⟩ eaten out of
 * the following word. Five engines guarded it that way (de, id, pt, so, su) while 71 used the lookahead —
 * and the five are precisely the languages whose own orthography supplies the accented letter.
 *
 * ⚠ Invisible to any ASCII fixture: `25°Ca` behaves identically under both guards, because `a` is `\w`.
 * That is why it survived.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

const FIXED = ["de", "id", "pt", "so", "su"] as const;
const ALREADY_RIGHT = ["mr", "nl", "ms"] as const;

describe("a non-ASCII letter after °C is not a word boundary", () => {
    for (const lang of [...FIXED, ...ALREADY_RIGHT]) {
        test(`${lang} leaves 25°Cölner alone`, () => {
            // ⚠ COMPARED AGAINST A CONTROL LETTER, and the two weaker assertions are worth recording. Asking
            // that the scale word be ABSENT passes while the bug is present, because the engine reads
            // "Celsius"+"ölner" as one glued token whose IPA is neither word. Asking that `Cölner`'s standalone
            // reading be present fails even when correct, because the word loses its own primary stress once
            // it glues to the preceding "Grad". What IS stable is the TOKEN COUNT: ⟨D⟩ can never trigger a
            // scale rule, so if ⟨C⟩ behaves like ⟨D⟩ then no scale word was inserted.
            const tokens = (s: string) => phonemize(s, lang).split(" ").length;
            expect(tokens("25°Cölner")).toBe(tokens("25°Dölner"));
        });
        test(`${lang} still reads a bare 25°C`, () => {
            expect(phonemize("25°C", lang).split(" ").length).toBeGreaterThan(1);
        });
    }

    test("no engine guards a degree rule with \\b", async () => {
        const { readdirSync, readFileSync } = await import("node:fs");
        const offenders: string[] = [];
        for (const d of readdirSync("src/languages")) {
            let src: string;
            try { src = readFileSync(`src/languages/${d}/normalize.ts`, "utf8"); } catch { continue; }
            const code = src.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");
            if (/\/\(\\d\)\\s\?°[^/]*?\\b\//u.test(code)) offenders.push(d);
        }
        expect(offenders).toEqual([]);
    });
});
