import { describe, expect, test } from "vitest";

import { createFaContextRestorer } from "../src/languages/persian/contextRestorer.ts";

// The Persian CONTEXT restorer (sentence-level seq2seq, int8 ONNX). Optional at runtime: if onnxruntime-node or the
// model is absent, createFaContextRestorer() is undefined and the suite skips. ⚠ CLASSICAL-scoped — excellent on
// Shahnameh-style verse (resolves ezafe/connectors from context), can hallucinate on modern text. See
// src/languages/persian/fa-context-restorer.PROVENANCE.md.
describe("Persian context restorer (sentence-level, ezafe/connector from context)", async () => {
    const restorer = await createFaContextRestorer();

    test.skipIf(!restorer)("resolves the ezafe chain + -o connector on the Shahnameh opening", async () => {
        // به نام خداوندِ جان و خرد — the ezafe -e (nɒme, χodɒwande) and the -o connector (d͡ʒɒno) come from CONTEXT,
        // which a word-level model cannot see. This is the +18.8pp context benefit made concrete.
        expect(await restorer!.restore("به نام خداوند جان و خرد")).toBe("bˈa nɒmˈe χodɒwandˈe d͡ʒɒnˈo χerˈad");
    });
});
