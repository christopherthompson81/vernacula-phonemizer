import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { phonemize, phonemizeAsync } from "../src/index.ts";
import { phonemizeEnNeural } from "../src/languages/english/englishNeural.ts";
import { createEnglishTagger } from "../src/languages/english/englishTagger.ts";

// The neural OOV tagger is gated on the (optional) ONNX model + onnxruntime-node. When absent the path falls back to
// the sync CMUdict + n-gram engine, so the fallback contract is testable everywhere; the retagging assertions run only
// with the model present.
const haveModel = existsSync(join(import.meta.dirname, "../data/languages/english/en-g2p-tagger.int8.onnx"));

describe("english neural OOV tagger", () => {
    // Dict words, heteronyms, numbers, possessives, and punctuation are the SYNC engine's — the neural path only swaps
    // genuinely-OOV word readings, so on lexicon-covered text it is byte-identical to phonemize(text, "en").
    test("dict/common text: neural path is byte-identical to the sync path", async () => {
        for (const s of ["The cat sat on the mat.", "I have twenty-three apples.", "She reads books and closes it."]) {
            expect(await phonemizeEnNeural(s)).toBe(phonemize(s, "en"));
        }
    });

    describe.skipIf(!haveModel)("with the ONNX model present", () => {
        test("OOV word: the tagger fills the tail (differs from the n-gram reading)", async () => {
            // Croydon — the n-gram puts the stress on the wrong syllable and a full vowel in the last (*kɹɔᶦdˈɑːn*);
            // the BiLSTM reads it as a Londoner would (*kɹˈɔᶦd̬ən*). (Zelensky was the example until #1260's
            // retrained n-gram started reading it the same way the tagger does.)
            const s = "Croydon spoke.";
            expect(await phonemizeEnNeural(s)).not.toBe(phonemize(s, "en"));
        });

        // ⚠ The tagger emits ARPABET internally (K S for ⟨x⟩) and renders it to IPA. A raw uppercase ARPABET
        // token in the output (e.g. "…plɛKS") means a chunk-boundary bug: the output must be all-lowercase IPA.
        test("no raw ARPABET leaks into OOV output (all-lowercase IPA)", async () => {
            for (const w of ["Zorplex", "Xylophraxy", "Quixotical", "Blexworth"]) {
                const out = await phonemizeEnNeural(w);
                expect(/[A-Z]/u.test(out), `${w} → ${out}`).toBe(false);
            }
        });

        // ⚠ THE ACCENT VARIANTS GET THE SAME READER (#1260). en-GB composes on the sync `en` engine, and its async
        // path was the sync path: `Croydon` (OOV) reached the pruned n-gram, which read ⟨o⟩ AND ⟨oy⟩ — *kɹˈɑːɔᶦd̬ɑːn*
        // — and the RP delta faithfully turned that into *kɹˈɒɔᶦdɒn*. Same tagger reading, then the delta.
        test("en-GB / en-IN async: the tagger's OOV reading, then the accent delta", async () => {
            expect(await phonemizeAsync("Croydon", "en-GB")).toBe("kɹˈɔᶦdən");
            expect(await phonemizeAsync("Boydon", "en-GB")).toBe("bˈɔᶦdən");
            expect(await phonemizeAsync("Croydon", "en-IN")).toBe("kɾˈɔɪɖən");
            // …and a dictionary word is untouched: the sync path is authoritative for what it knows.
            expect(await phonemizeAsync("Roydon", "en-GB")).toBe(phonemize("Roydon", "en-GB"));
            // Everything that is not an OOV word is byte-identical to the sync variant.
            const s = "The cat sat on the mat in 1997.";
            expect(await phonemizeAsync(s, "en-GB")).toBe(phonemize(s, "en-GB"));
            expect(await phonemizeAsync(s, "en-IN")).toBe(phonemize(s, "en-IN"));
        });

        test("out-of-vocab letter: tagger.tag() declines (returns \"\")", async () => {
            const tagger = await createEnglishTagger();
            expect(tagger).toBeDefined();
            expect(await tagger!.tag("мир")).toBe(""); // Cyrillic — no letter in the a–z training vocab
        });
    });
});
