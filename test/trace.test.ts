/**
 * `phonemizeTrace` — the additive trace of #1150 stage 1.
 *
 * ⚠ THE CONTRACT IS THAT IT IS A SECOND VIEW, NEVER A SECOND READING. `ipa` must be byte-identical to
 * `phonemize()`; the parity gate is 136 languages × 26,827 rows across two engines, and an output shape that
 * could drift from the first would be a fork wearing a feature's clothes. That is asserted here over the
 * golden corpus rather than over hand-picked strings.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { phonemize, phonemizeTrace } from "../src/index.ts";

/** A deterministic stride sample of each golden's input column. */
function sample(lang: string, n: number): string[] {
    const lines = readFileSync(`csharp/goldens/${lang}.tsv`, "utf8").split("\n").filter(Boolean);
    const stride = Math.max(1, Math.ceil(lines.length / n));
    const out: string[] = [];
    for (let i = 0; i < lines.length; i += stride) {
        const t = lines[i]!.split("\t")[0];
        if (t !== undefined && t !== "") out.push(t);
    }
    return out;
}
const GOLDEN_LANGS = readdirSync("csharp/goldens")
    .filter((x) => x.endsWith(".tsv"))
    .map((x) => x.replace(/\.tsv$/u, ""));

describe("phonemizeTrace — a second view, never a second reading", () => {
    test("ipa is byte-identical to phonemize() across the golden corpus", () => {
        const bad: string[] = [];
        for (const lang of GOLDEN_LANGS)
            for (const text of sample(lang, 12)) {
                let want: string;
                try {
                    want = phonemize(text, lang);
                } catch {
                    continue;
                }
                if (phonemizeTrace(text, lang).ipa !== want) bad.push(`${lang}: ${text.slice(0, 40)}`);
            }
        expect(bad, "the trace changed the reading — it must only observe it").toEqual([]);
    });

    /**
     * ⚠ AN UNTRACED ENGINE MUST NOT LOOK LIKE A CLEAN ONE — an empty token list is indistinguishable from a
     * correct trace, which is the very defect this API exists to expose (#1131, #1140). The trace is DERIVED
     * at `assembleClauses`, which four engines bypass with a hand-rolled loop (english's two-phase tagger,
     * french's liaison lookahead, mandarin's code-point scan, burmese's); those four now report to the trace
     * EXPLICITLY, through `enterEngine` + `noteToken`, so every language is covered.
     *
     * Pinned at zero rather than at a list: a new engine that neither routes through the seam nor reports
     * fails here instead of silently returning nothing.
     */
    test("every engine is traced — none silently returns an empty trace", () => {
        const untraced = GOLDEN_LANGS.filter((lang) => {
            for (const text of sample(lang, 4)) {
                try {
                    if (phonemizeTrace(text, lang).traced) return false;
                } catch {
                    continue;
                }
            }
            return true;
        });
        expect(untraced).toEqual([]);
    });

    test("spans are ordered, non-overlapping, and index the normalized text", () => {
        const bad: string[] = [];
        for (const lang of GOLDEN_LANGS)
            for (const text of sample(lang, 4)) {
                let t: ReturnType<typeof phonemizeTrace>;
                try {
                    t = phonemizeTrace(text, lang);
                } catch {
                    continue;
                }
                let prev = -1;
                for (const k of t.tokens) {
                    if (t.normalized.slice(k.span[0], k.span[1]) !== k.surface)
                        bad.push(`${lang}: span ${k.span} is not ${JSON.stringify(k.surface)}`);
                    if (k.span[0] < prev) bad.push(`${lang}: spans out of order at ${k.span}`);
                    prev = k.span[1];
                }
            }
        expect(bad.slice(0, 5)).toEqual([]);
    });
});

describe("phonemizeTrace — the step that was invisible", () => {
    test("`nativised` records the input-side rewrite that leaves no mark on the output", () => {
        // #1131/#1139/#1140 were all this: a rewrite before the g2p ran, with nothing downstream to show it.
        const lodz = phonemizeTrace("Łódź", "lg").tokens[0];
        expect(lodz?.nativised).toBe("Lodz");
        expect(lodz?.emitted).toEqual(["lodz"]);
        // …and #1132's U+0261, whose fold is now a row in UNDECOMPOSABLE
        const scriptG = phonemizeTrace("ɡato", "es").tokens[0];
        expect(scriptG?.nativised).toBe("gato");
        // a token the nativiser leaves alone carries no `nativised` at all — absence means "untouched"
        expect(phonemizeTrace("gato", "es").tokens[0]?.nativised).toBeUndefined();
    });

    test("one token can emit many readings — the number path", () => {
        const t = phonemizeTrace("1244", "lg");
        expect(t.tokens).toHaveLength(1);
        expect(t.tokens[0]?.emitted.length).toBeGreaterThan(3); // lukumi mu bikumi bibiri mu …
        expect(t.tokens[0]?.emitted.join(" ")).toBe(t.ipa);
    });

    test("the hand-rolled engines report explicitly — tokens, spans and all", () => {
        for (const [text, lang, want] of [
            ["the cat sat", "en", ["the", "cat", "sat"]],
            ["le chat noir", "fr", ["le", "chat", "noir"]],
            ["中国 hello 世界", "cmn", ["中国", "hello", "世界"]],
        ] as const) {
            const t = phonemizeTrace(text, lang);
            expect(t.traced, lang).toBe(true);
            expect(t.tokens.map((k) => k.surface), lang).toEqual(want);
            for (const k of t.tokens) expect(t.normalized.slice(k.span[0], k.span[1])).toBe(k.surface);
        }
        // english expands a numeral into many readings against ONE source span
        const n = phonemizeTrace("I have 1244 cats.", "en").tokens.find((k) => k.surface === "1244");
        expect(n?.emitted.length).toBeGreaterThan(3);
    });

    test("an embedded foreign run is a token, not an unattributed reading", () => {
        // `Windows` in Russian text is read by the ENGLISH engine through emitUnclaimed; leaving it out would
        // put real IPA in the output belonging to no token.
        const t = phonemizeTrace("Это Windows компьютер", "ru");
        const win = t.tokens.find((k) => k.surface === "Windows");
        expect(win).toBeDefined();
        expect(win?.emitted.join("")).not.toBe("");
    });

    test("spans index the NORMALIZED text, which normalization may have reordered", () => {
        // Luganda puts the measure noun before its number, so the unit's reading precedes the figure it
        // followed in the input. This is why stage 1 returns `normalized` instead of pretending to map back.
        const t = phonemizeTrace("Obugazi: 1 244.7 km²", "lg");
        expect(t.normalized).not.toBe("Obugazi: 1 244.7 km²");
        expect(t.normalized).toContain("kiromita");
        for (const k of t.tokens) expect(t.normalized.slice(k.span[0], k.span[1])).toBe(k.surface);
    });
});

describe("phonemizeTrace — the recorder is ambient, so prove it cannot leak", () => {
    test("a throwing call leaves no state for the next one", () => {
        expect(() => phonemizeTrace("x", "definitely-not-a-language")).toThrow();
        const t = phonemizeTrace("ŋŋamba", "lg");
        expect(t.tokens).toHaveLength(1);
        expect(t.ipa).toBe(phonemize("ŋŋamba", "lg"));
    });

    test("a nested engine does not steal the outer engine's tokens", () => {
        // ru hands `Windows` to English, which runs its own tokenizer loop inside this one.
        const t = phonemizeTrace("Это Windows компьютер", "ru");
        expect(t.tokens.map((k) => k.surface)).toEqual(["Это", "Windows", "компьютер"]);
        expect(t.normalized).toBe("Это Windows компьютер");
    });

    test("phonemize() itself is unaffected — no trace, no cost, same string", () => {
        const plain = phonemize("Obugazi: 1 244.7 km² ne ŋŋamba.", "lg");
        phonemizeTrace("Obugazi: 1 244.7 km² ne ŋŋamba.", "lg");
        expect(phonemize("Obugazi: 1 244.7 km² ne ŋŋamba.", "lg")).toBe(plain);
    });
});
