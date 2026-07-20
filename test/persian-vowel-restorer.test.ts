import { describe, expect, test } from "vitest";

import { createFaVowelRestorer } from "../src/languages/persian/vowelRestorer.ts";

// The Persian OOV neural short-vowel restorer (seq2seq abjad→IPA, int8 ONNX). Optional at runtime: if
// onnxruntime-node or the model is absent, createFaVowelRestorer() is undefined and the suite skips (the sync
// lexicon+default path is unaffected). See src/languages/persian/fa-vowel-restorer.PROVENANCE.md.
describe("Persian OOV vowel restorer (seq2seq abjad→IPA)", async () => {
    const restorer = await createFaVowelRestorer();

    test.skipIf(!restorer)("restores Iranian short vowels on words (i→e, u→o, final ه→e)", async () => {
        const r = restorer!;
        // Iranian Persian targets — classical→Iranian normalization + Persian final stress, inside restore().
        expect(await r.restore("خانه")).toBe("xaːnˈe"); // xâne — final ه→e
        expect(await r.restore("گل")).toBe("ɡˈol"); // gol — short u→o
        expect(await r.restore("کتاب")).toBe("ketˈaːb"); // ketâb — short i→e
        expect(await r.restore("بلبل")).toBe("bolbˈol"); // bolbol
        expect(await r.restore("مرد")).toBe("mˈard"); // mard — unchanged
    });
});
