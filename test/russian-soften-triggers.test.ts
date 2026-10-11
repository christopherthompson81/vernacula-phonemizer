/**
 * The g2p reads its regressive-softening triggers from the manifest (#1513 item 8). It used to hard-code
 * `"тд"` beside a `softenTriggers` field it never read, so editing the jsonc changed nothing. An assertion on
 * the real data cannot tell the two apart (the literal equals the data), so the manifest is replaced here
 * with one whose triggers are EMPTY: a g2p that reads them must stop softening; a hard-coded one would not.
 *
 * ⚠ NOT A HOISTED `vi.mock`: the suite shares one module registry per worker (`isolate: false`), so a g2p
 * another file already imported would be handed back and the factory never called. The registry is reset
 * BEFORE the import, so this file gets a fresh g2p over the mock, and reset again after, so no later file in
 * the worker inherits the mocked manifest.
 */
import { afterAll, describe, expect, test, vi } from "vitest";

const MANIFEST_PATH = "../src/languages/russian/manifest.ts";

afterAll(() => {
    vi.doUnmock(MANIFEST_PATH);
    vi.resetModules();
});

describe("ru: softenTriggers and softenTriggersTdn are live data", () => {
    test("with no triggers, the dental before a soft dental stays hard", async () => {
        vi.resetModules();
        vi.doMock(MANIFEST_PATH, async (importOriginal) => {
            const real = await importOriginal<typeof import("../src/languages/russian/manifest.ts")>();
            return { ...real, MANIFEST: { ...real.MANIFEST, softenTriggers: "", softenTriggersTdn: "" } };
        });
        const { MANIFEST } = await import("../src/languages/russian/manifest.ts");
        const { toIpa } = await import("../src/languages/russian/g2p.ts");
        expect(MANIFEST.softenTriggers).toBe(""); // the mock is in force for this import
        const [zHard, zSoft] = MANIFEST.consonants["з"]!;
        const [nHard, nSoft] = MANIFEST.consonants["н"]!;
        // ездил: з before soft д (the с/з tier); стаканчик: н before ч (the т/д/н tier).
        expect(toIpa("ездил", 0)).toContain(zHard);
        expect(toIpa("ездил", 0)).not.toContain(zSoft);
        expect(toIpa("стаканчик", 1)).toContain(nHard);
        expect(toIpa("стаканчик", 1)).not.toContain(nSoft);
    });
});
