/**
 * The Dravidian manifests must declare only what the Dravidian composer reads.
 *
 * `dravidianNumberWords` reads units/teens/tens/compound/hundredForms/thousandForms/magnitudeForms. Both
 * kn and ml once extended `NumbersDef` as well, whose `magnitudes` is REQUIRED — so each manifest carried
 * a second, unread set of magnitude words beside the `magnitudeForms` actually consulted, plus the
 * `compoundOrder`/`bareMagnitude` that only `indicNumberWords` honours. Sabotaging all six moved 0 of
 * 2,440 readings. This pins the absence, because a type that requires a key is exactly what makes a dead
 * key look load-bearing.
 */
import { describe, expect, test } from "vitest";
import { MANIFEST as KANNADA } from "../src/languages/kannada/manifest.ts";
import { MANIFEST as MALAYALAM } from "../src/languages/malayalam/manifest.ts";

const READ_BY_THE_DRAVIDIAN_COMPOSER = new Set([
    "units", "teens", "tens", "compound", "hundredForms", "thousandForms", "magnitudeForms",
    "decimalWord", // read by each language's normalize.ts
]);

describe("Dravidian manifests declare no key the composer cannot read", () => {
    for (const [name, m] of [["kannada", KANNADA], ["malayalam", MALAYALAM]] as const) {
        test(name, () => {
            const unread = Object.keys(m.numbers).filter((k) => !READ_BY_THE_DRAVIDIAN_COMPOSER.has(k));
            expect(unread).toEqual([]);
        });
    }
});
