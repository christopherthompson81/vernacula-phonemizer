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
import { beginProvenance, endProvenance, rewrite } from "../src/core/provenance.ts";

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

describe("phonemizeTrace — rewrites, the transformations no token can own", () => {
    test("a post-assembly pass is an event, so `emitted` and `ipa` can differ with a stated cause", () => {
        // Spanish spirantizes ACROSS word boundaries, after the clause string is assembled.
        const t = phonemizeTrace("el gato negro", "es");
        expect(t.tokens.find((k) => k.surface === "gato")?.emitted).toEqual(["ɡˈato"]);
        expect(t.ipa).toContain("ɣˈato"); // …and the sentence says something else
        const r = t.rewrites.find((x) => x.stage === "spirantize-across-words");
        expect(r, "the discrepancy must carry its cause").toBeDefined();
        expect(r?.before).toContain("ɡˈato");
        expect(r?.after).toContain("ɣˈato");
    });

    test("normalization is reported for every engine, including when it REORDERS", () => {
        const t = phonemizeTrace("Obugazi: 1 244.7 km²", "lg");
        const n = t.rewrites.find((x) => x.stage === "normalize");
        expect(n?.before).toBe("Obugazi: 1 244.7 km²");
        expect(n?.after).toBe(t.normalized);
        // the unit's reading precedes the figure it followed — why a span cannot be mapped back (stage 2)
        expect(n?.after.indexOf("kiromita")).toBeLessThan(n!.after.indexOf("1244"));
    });

    /**
     * ⚠ THE ACCOUNTING INVARIANT, and the reason the rewrite list has to be complete rather than illustrative.
     *
     * Every reading in the output must be attributable: either a token emitted it, or a DECLARED rewrite
     * changed it. Measured across the golden corpus this started at 180 unaccounted rows in 7 languages —
     * spirantization in `ca`/`gl`, geminate collapse in `as`, the Awadhi flap, Nepali's inherent vowel, and
     * the two ACCENT VARIANTS (`fr-CA`, `es-419`), which are whole-string deltas over the base engine's
     * output so a token records the Castilian reading while the utterance ships the American one.
     *
     * Pinning it at zero is what stops the next post-assembly pass from being added invisibly — which is the
     * same defect class as #1131, one layer along: a transformation with no mark on the record.
     */
    test("tokens + declared rewrites ACCOUNT for the output, with nothing left over", () => {
        const dropPauses = (x: string): string =>
            x.split(" ").filter((w) => w !== "" && !/^[.,!?;:…]+$/u.test(w)).join(" ");
        const bad: string[] = [];
        for (const lang of GOLDEN_LANGS)
            for (const text of sample(lang, 6)) {
                let t: ReturnType<typeof phonemizeTrace>;
                try {
                    t = phonemizeTrace(text, lang);
                } catch {
                    continue;
                }
                // ⚠ JOINED, not compared word-by-word: one `emitted` entry can itself be multi-word (a
                // numeral expansion emitted as a single string). Comparing per word reported 16% of rows as
                // unaccounted and every one of them was this measurement bug.
                const fromTokens = dropPauses(t.tokens.flatMap((k) => k.emitted).join(" "));
                const output = t.rewrites.filter((r) => r.stage !== "normalize");
                const target = dropPauses(output.length > 0 ? output[0]!.before : t.ipa);
                if (fromTokens !== target) bad.push(`${lang}: ${text.slice(0, 30)}`);
            }
        expect(bad.slice(0, 6), "a reading reached the output that no token or rewrite accounts for").toEqual([]);
    });

    test("a stage that changed nothing emits no event — the list is what MOVED", () => {
        expect(phonemizeTrace("the cat", "en").rewrites).toEqual([]);
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

describe("phonemizeTrace — normalizer provenance (#1150 stage 2)", () => {
    test("a token maps back to the input characters that produced it", () => {
        // ⚠ THE WHOLE POINT: normalization rewrote the text, and the token still names its source.
        const t = phonemizeTrace("Obugazi: 1 244.7 km² ne 15%.", "lg");
        const src = (surface: string): string | undefined => {
            const k = t.tokens.find((x) => x.surface === surface);
            return k?.inputSpan === undefined ? undefined : "Obugazi: 1 244.7 km² ne 15%.".slice(...k.inputSpan);
        };
        // the unit's THREE reading-words and the figure all trace to the one source span they came from
        expect(src("kiromita")).toBe("1 244.7 km²");
        expect(src("kyebiriga")).toBe("1 244.7 km²");
        expect(src("1244")).toBe("1 244.7 km²");
        expect(src("kikumi")).toBe("15%"); // the percent reading
        expect(src("Obugazi")).toBe("Obugazi"); // untouched text maps to itself
    });

    test("English too — a dotted abbreviation and a currency amount", () => {
        const text = "Dr. Smith paid $1,250.";
        const t = phonemizeTrace(text, "en");
        const src = (surface: string): string | undefined => {
            const k = t.tokens.find((x) => x.surface === surface);
            return k?.inputSpan === undefined ? undefined : text.slice(...k.inputSpan);
        };
        expect(src("doctor")).toBe("Dr. Smith");
        expect(src("dollars")).toBe("$1,250"); // the `$` moves to the end and the span still holds
        expect(src("1,250")).toBe("$1,250");
    });

    /**
     * ⚠ ABSENCE MUST MEAN "NOT KNOWN", NEVER "IDENTICAL". A normalizer step that does not route through
     * `provenance.tr` still changes the string, so the mapping desyncs — it is withheld rather than reported
     * wrong. That is the difference between an unknown and a confident wrong offset, and it is the same
     * discipline `traced: false` uses for an engine that reports no tokens at all.
     */
    /**
     * ⚠ THIS TEST USED TO CHECK ONLY BOUNDS, AND SO COULD NOT FAIL. Review found 1,478 tokens across 74
     * languages naming input characters that did not contain their own surface (`paid` → `" Smi"`), and every
     * one satisfied `0 <= start <= end <= length`.
     *
     * ⚠ AND THE OBVIOUS REPLACEMENT IS UNSOUND. "the surface must occur inside the mapped span" produces
     * FALSE failures, because normalization GENERATES tokens: `an`'s `habitants` maps to `210,59 hab/km²`
     * and `hil`'s `sang` to `sg`, both correct. A generated token can also coincide with text elsewhere in
     * the input, so surface matching cannot distinguish a good mapping from a drifted one.
     *
     * What IS sound: where normalization changed nothing, the mapping must be the identity. That is the case
     * offset drift breaks first — the failure above was drift by the length of some untracked edit — and it
     * covers most of the corpus, since most rows normalize to themselves. The rewriting cases are carried by
     * the two explicit tests above, which name their expected source text outright.
     */
    test("where normalization changed nothing, a token's source CONTAINS it", () => {
        const bad: string[] = [];
        let checked = 0;
        for (const lang of GOLDEN_LANGS)
            for (const text of sample(lang, 4)) {
                let t: ReturnType<typeof phonemizeTrace>;
                try {
                    t = phonemizeTrace(text, lang);
                } catch {
                    continue;
                }
                if (t.normalized !== text) continue; // normalization moved things: not this test's case
                for (const k of t.tokens) {
                    if (k.inputSpan === undefined) continue;
                    checked++;
                    // ⚠ CONTAINMENT, NOT EQUALITY. A rule may match a wider region and re-emit it unchanged —
                    // `bar` matches `4.` and writes `4.` back — so both characters legitimately derive from
                    // the whole match and the span is WIDER than the token. What drift breaks is containment.
                    if (k.inputSpan[0] > k.span[0] || k.inputSpan[1] < k.span[1])
                        bad.push(`${lang}: ${JSON.stringify(k.surface)} span ${k.span} but inputSpan ${k.inputSpan}`);
                }
            }
        expect(bad.slice(0, 8), "the input was unchanged, so a token's source must contain it").toEqual([]);
        expect(checked, "no identity rows were reached — the probe measured nothing").toBeGreaterThan(500);
    });

    test("an input span always lies inside the caller's own string", () => {
        for (const lang of GOLDEN_LANGS)
            for (const text of sample(lang, 2)) {
                let t: ReturnType<typeof phonemizeTrace>;
                try {
                    t = phonemizeTrace(text, lang);
                } catch {
                    continue;
                }
                for (const k of t.tokens) {
                    if (k.inputSpan === undefined) continue;
                    expect(k.inputSpan[0]).toBeGreaterThanOrEqual(0);
                    expect(k.inputSpan[1]).toBeLessThanOrEqual(text.length);
                    expect(k.inputSpan[0]).toBeLessThanOrEqual(k.inputSpan[1]);
                }
            }
    });
});

describe("phonemizeTrace — length is not identity (#1150 stage 2)", () => {
    /**
     * ⚠ FOUND IN THE C# PORT AND PRESENT HERE TOO. A step outside the seam that is NET length-preserving
     * passes a length check while having shifted every interior offset — `Mandarin.SubstituteNumbers`
     * rewrites a code-point list outside it, and `115`→`一百一十五` (+2) with each `10`→`十` (−1) cancels out.
     * A stale identity mapping then reported a token as coming from a SPACE, in range and so invisible to a
     * bounds assertion. The mapping now tracks the STRING, not its length.
     */
    test("a net length-preserving step outside the seam yields absence, not a wrong span", () => {
        const text = "115 10 10 中国";
        const t = phonemizeTrace(text, "cmn");
        expect(t.ipa).toBe(phonemize(text, "cmn"));
        for (const k of t.tokens) expect(k.inputSpan, `${k.surface} must not be guessed`).toBeUndefined();
    });

    test("…and where the seam does see everything, the span is exact", () => {
        const text = "Obugazi: 1 244.7 km²";
        const t = phonemizeTrace(text, "lg");
        const k = t.tokens.find((x) => x.surface === "kiromita");
        expect(k?.inputSpan).toBeDefined();
        expect(text.slice(...k!.inputSpan!)).toBe("1 244.7 km²");
    });
});

describe("the seam is a drop-in for `replace`, not a near-miss (#1150)", () => {
    /**
     * ⚠ A STRING PATTERN REPLACES THE FIRST MATCH ONLY, and getting that wrong is not a subtle failure.
     * Converting `.replaceAll(".", "")` onto the seam de-grouped `1.234.567` into `1234.567` and broke 13
     * tests across 8 languages, because `replaceAll` and `replace` differ in exactly this way. `.replaceAll`
     * is therefore off the seam entirely; this pins the half that is on it.
     */
    test("a string pattern behaves as String.replace does, over randomised input", () => {
        const ALPHA = [..."ab.$&*+?^(){}[]|\\/ 🙂é", "aa", "$1", "$&", "$`", "$'"];
        let seed = 20260828;
        const rnd = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
        const pick = (n: number): string => Array.from({ length: n }, () => ALPHA[Math.floor(rnd() * ALPHA.length)]!).join("");
        // ⚠ IT MUST RUN UNDER A LIVE TRACE. Untraced, `rewrite` hands the pattern straight to `String.replace`
        // and the overload under test is never reached — the first version of this test passed happily with
        // the seam deliberately sabotaged to a GLOBAL regex, because it only ever exercised the native call.
        const bad: string[] = [];
        try {
            for (let i = 0; i < 4000; i++) {
                const s = pick(1 + Math.floor(rnd() * 8));
                const pat = pick(1 + Math.floor(rnd() * 3));
                const rep = rnd() < 0.5 ? pick(1 + Math.floor(rnd() * 3)) : (m: string): string => `<${m}>`;
                const want = s.replace(pat, rep as string);
                beginProvenance(s);
                const got = rewrite(s, pat, rep);
                if (want !== got) bad.push(`${JSON.stringify(s)} / ${JSON.stringify(pat)}: want ${JSON.stringify(want)} got ${JSON.stringify(got)}`);
            }
        } finally {
            endProvenance();
        }
        expect(bad.slice(0, 4)).toEqual([]);
    });

    /**
     * ⚠ ABSENT MUST STAY THE ONLY OTHER ANSWER. A floor, not a target: it exists so a future change that
     * quietly takes sites off the seam — or puts a SUBSTRING on it, which destroys a whole utterance's
     * mapping — shows up as a test rather than as a number nobody re-measured. Measured 94.7% when written.
     */
    test("provenance coverage does not silently regress", () => {
        let tok = 0;
        let mapped = 0;
        for (const lang of GOLDEN_LANGS)
            for (const text of sample(lang, 6)) {
                let t;
                try {
                    t = phonemizeTrace(text, lang);
                } catch {
                    continue;
                }
                tok += t.tokens.length;
                mapped += t.tokens.filter((k) => k.inputSpan !== undefined).length;
            }
        expect(mapped / tok).toBeGreaterThan(0.9);
    });
});
