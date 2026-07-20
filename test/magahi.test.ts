import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/magahi/magahi.ts";
import { phonemizeWord as bho } from "../src/languages/bhojpuri/bhojpuri.ts";

// Canonical-IPA goldens for Magahi / मगही (mag) — Indo-Aryan (Bihari, Magadhan), Devanagari. BESPOKE (was a
// mag→bho alias until a reference revealed a delta): the Bhojpuri engine + phonology, sharing the Bihari core
// (no vowel length, श/ष→s, ण/ञ→n), PLUS the documented Magahi GLIDE HARDENING (Vinod Kumar 2026, A Comparative
// Phonological Study of Bihari Languages, §6.2): word-initial व→[b] (वंश→bans), य→[d͡ʒ] (यन्त्र→jantar), where
// Bhojpuri preserves the glides. See docs/investigations/mag_native_bringup_investigation.md.
describe("Magahi canonical IPA — Bhojpuri base + glide hardening", () => {
    test("the Magahi DELTA from Bhojpuri: word-initial glide hardening व→b, य→d͡ʒ", () => {
        expect(phonemizeWord("वंश")).toBe("bˈə̃s"); // व → b (Magahi; Bhojpuri keeps w)
        expect(phonemizeWord("यंत्र")).toBe("d͡ʒˈə̃n̪t̪ɾ"); // य → d͡ʒ (Magahi; Bhojpuri keeps the glide j)
        expect(phonemizeWord("विशाल")).toBe("bˈisɑl"); // व → b, श → s
        // ...and these differ from Bhojpuri (which preserves the glides):
        expect(phonemizeWord("वंश")).not.toBe(bho("वंश"));
    });
    test("the shared Bihari core (== Bhojpuri): no length, श/ष→s, ण→n, ऐ→ɛ", () => {
        expect(phonemizeWord("देश")).toBe("d̪ˈes"); // श → s (== bho)
        expect(phonemizeWord("बैल")).toBe("bˈɛl"); // ऐ → ɛ monophthong (== bho)
        expect(phonemizeWord("गणेश")).toBe("ɡˈənes"); // ण → n (== bho)
        expect(phonemizeWord("देश")).toBe(bho("देश")); // shared features → identical to Bhojpuri here
    });
});
