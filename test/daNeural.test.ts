import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeDaNeural } from "../src/languages/danish/danishNeural.ts";
import { createDanishTagger } from "../src/languages/danish/danishTagger.ts";

// The neural OOV tagger is gated on the (optional) ONNX model + onnxruntime-node. When absent the path falls back to
// the sync NST-lexicon + rule-g2p engine, so the fallback contract is testable everywhere; the retagging assertions run
// only with the model present.
const haveModel = existsSync(join(import.meta.dirname, "../data/languages/danish/da-g2p-tagger.int8.onnx"));

describe("danish neural OOV tagger", () => {
    // Lexicon words and punctuation are the SYNC engine's — the neural path only swaps genuinely-OOV word readings, so
    // on lexicon-covered text it is byte-identical to phonemize(text, "da").
    test("lexicon/common text: neural path is byte-identical to the sync path", async () => {
        for (const s of ["Jeg bor i en gade i København.", "Han har mad og øl."]) {
            expect(await phonemizeDaNeural(s)).toBe(phonemize(s, "da"));
        }
    });

    describe.skipIf(!haveModel)("with the ONNX model present", () => {
        // A genuinely-OOV word (not in the NST lexicon): the tagger reads it from spelling in the NST NARROW convention.
        // The rule g2p emits neither r-vocalisation nor stop-lenition; the BiLSTM learns both — so the neural reading
        // differs from the rule reading and carries the narrow ⟨-top⟩ → [tɐb] (r-vocalised, lenited) signature.
        test("OOV word: neural reading is NST-narrow and differs from the rule", async () => {
            const neural = (await phonemizeDaNeural("gribletop")).trim();
            expect(neural).not.toBe(phonemize("gribletop", "da").trim()); // rule = ɡʁˈibletop (no r-voc, no lenition)
            expect(neural).toMatch(/tɐb$/u); // ⟨-top⟩ → r-vocalised + lenited [tɐb]
        });

        // ⚠ THE PRE-PASS MUST TOKENIZE AND KEY AS THE SYNC ENGINE DOES. It used a hand-listed letter class
        // keyed by the RAW match, while danish.ts hands `oovOverride` the NATIVISED spelling of a LATIN_RUN
        // match — so every word the nativiser rewrites was tagged under a key the engine never asks for and
        // silently fell through to the RULE tier. 21 distinct types over FLEURS da_dk, 1 golden row.
        test("a word the nativiser rewrites still reaches the tagger (the key must be nat())", async () => {
            for (const w of ["Galápagosøer", "taínoer", "Guaraníerne", "Haldarsvík", "Cañitas"]) {
                const neural = (await phonemizeDaNeural(w)).trim();
                expect(neural, w).not.toBe(phonemize(w, "da").trim());
            }
            expect((await phonemizeDaNeural("Galápagosøer")).trim()).toBe("ɡaˈlaːˀpaˌɡɐsˌøːˀɐ");
            // …and the fold is what makes it readable: the accented spelling and the folded one agree.
            expect(await phonemizeDaNeural("Galápagosøer")).toBe(await phonemizeDaNeural("Galapagosøer"));
        });

        test("out-of-vocab letter: tagger.tag() declines (returns \"\")", async () => {
            const tagger = await createDanishTagger();
            expect(tagger).toBeDefined();
            expect(await tagger!.tag("мир")).toBe(""); // Cyrillic — no letter in the training vocab
        });
    });
});
