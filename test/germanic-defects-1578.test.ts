/**
 * #1578: the da/nb/af/bar defects the Rust port of the Germanic group found. Relational throughout, so no IPA is
 * typed: a number must read as its written-out word, a zero-padded ordinal as the unpadded one.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { askedWordsNeuralPrepass } from "../src/core/structuralTagger.ts";
import { createDanish } from "../src/languages/danish/danish.ts";
import { createNorwegian } from "../src/languages/norwegian/norwegian.ts";
import { createAfrikaans } from "../src/languages/afrikaans/afrikaans.ts";
import { phonemizeDaNeural } from "../src/languages/danish/danishNeural.ts";
import { phonemizeNbNeural } from "../src/languages/norwegian/norwegianNeural.ts";
import { phonemizeAfNeural } from "../src/languages/afrikaans/afrikaansNeural.ts";

const model = (dir: string, file: string): boolean =>
    existsSync(join(import.meta.dirname, "../data/languages", dir, file));

/** The words a pre-pass offers the tagger, with a tagger that records and declines. Needs no model. */
async function offered(text: string, render: (t: string, oov: (w: string) => string | undefined) => string): Promise<string[]> {
    const seen: string[] = [];
    await askedWordsNeuralPrepass(text, { tag: async (w) => (seen.push(w), ""), render });
    return seen;
}

describe("the tagger is offered the words the engine asks for (#1578)", () => {
    test("da: a number's words", async () => {
        const da = createDanish();
        expect(await offered("47", (t, o) => da.text(t, o))).toContain("syvogfyrre");
    });

    test("nb: the nativised whole token, and the number words", async () => {
        const nb = createNorwegian();
        const words = await offered("Dvořák og 200", (t, o) => nb.text(t, o));
        expect(words).toContain("Dvorak");
        expect(words).toContain("tohundre");
    });

    test("af: a word the normalizer creates, but never a letter name", async () => {
        const af = createAfrikaans();
        expect(await offered("Dit is 90°F.", (t, o) => af.text(t, o))).toContain("fahrenheit");
        expect(await offered("Die USSR het geval.", (t, o) => af.text(t, o))).not.toContain("er");
    });

    describe.skipIf(!model("danish", "da-g2p-tagger.int8.onnx"))("da, with the model", () => {
        test("a number reads as its written-out word on the best path", async () => {
            expect(await phonemizeDaNeural("47")).toBe(await phonemizeDaNeural("syvogfyrre"));
            expect(await phonemizeDaNeural("Den 21. maj.")).toBe(await phonemizeDaNeural("Den enogtyvende maj."));
        });
    });

    describe.skipIf(!model("norwegian", "nb-g2p-tagger.int8.onnx"))("nb, with the model", () => {
        test("a word the nativiser rewrites reads as its nativised spelling", async () => {
            expect(await phonemizeNbNeural("Han bor i Dvořák.")).toBe(await phonemizeNbNeural("Han bor i Dvorak."));
            expect(await phonemizeNbNeural("São")).toBe(await phonemizeNbNeural("Sao"));
        });

        test("a number reads as its written-out word on the best path", async () => {
            expect(await phonemizeNbNeural("200")).toBe(await phonemizeNbNeural("tohundre"));
        });
    });

    describe.skipIf(!model("afrikaans", "af-g2p-tagger.int8.onnx"))("af, with the model", () => {
        test("a unit the normalizer spells out reads as the written word", async () => {
            expect(await phonemizeAfNeural("Dit is 90°F.")).toBe(await phonemizeAfNeural("Dit is negentig grade Fahrenheit."));
        });

        test("an initialism's letter names stay on the rule path", async () => {
            expect(await phonemizeAfNeural("Die USSR het geval.")).toBe(phonemize("Die USSR het geval.", "af"));
        });
    });
});

describe("a zero-padded ordinal reads as the unpadded one (#1578)", () => {
    test.each([
        ["da", "Den 07. maj.", "Den 7. maj."],
        ["da", "Den 07. og 08. maj.", "Den 7. og 8. maj."],
        ["nb", "Den 07. mai.", "Den 7. mai."],
    ])("%s %s", (lang, padded, plain) => {
        expect(phonemize(padded, lang)).toBe(phonemize(plain, lang));
    });
});

describe("bar: a final ⟨a⟩ after a silent ⟨h⟩ is not reduced (#1578)", () => {
    test("the interjections keep their full final vowel; a consonant before still reduces", () => {
        for (const w of ["Aha", "Oha"]) expect(phonemize(w, "bar").trim(), w).not.toMatch(/ɐ$/u);
        expect(phonemize("Bana", "bar").trim()).toMatch(/ɐ$/u);
    });
});
