import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/bhojpuri/bhojpuri.ts";

// Hand-adjudicated canonical-IPA gold for Bhojpuri / भोजपुरी (bho) — Indo-Aryan, Devanagari. ⚠ CANNOT-VERIFY:
// no independent referee exists (no wikipron/kaikki; epitran bho-Deva is a CIRCULAR Hindi clone). Bhojpuri is
// segmentally ~Hindi, so this gold deliberately targets the DISTINCTIVE features — the axis where Bhojpuri ≠ Hindi
// and a Hindi clone is demonstrably wrong: श/ष→[s] (NO /ʃ/), ऐ/औ kept as the diphthongs [ai]/[au] (Hindi
// monophthongised to ɛː/ɔː), and no Hindi əɦə-lowering. Adjudicated from Shukla (1981) + Grierson LSI VI.
// See docs/investigations/bho_native_bringup_investigation.md.
describe("bhojpuri canonical IPA (distinctive features vs Hindi)", () => {
    test("श/ष → [s] — Bhojpuri has no /ʃ/", () => {
        expect(phonemizeWord("शहर")).toBe("sˈəɦəɾ"); // 'city' — श→s AND no əɦə→ɛɦɛ lowering (Hindi: ʃɛɦɛɾ)
        expect(phonemizeWord("शेर")).toBe("sˈeːɾ"); // 'lion/tiger' (Hindi: ʃeːɾ)
        expect(phonemizeWord("देश")).toBe("d̪ˈeːs"); // 'country' (Hindi: d̪eːʃ)
    });

    test("ऐ → [ai], औ → [au] — Bhojpuri keeps the diphthongs", () => {
        expect(phonemizeWord("बैल")).toBe("bˈail"); // 'ox' (Hindi monophthong: bɛːl)
        expect(phonemizeWord("कौन")).toBe("kˈaun"); // 'who' (Hindi: kɔːn)
    });

    test("shared Indo-Aryan core (Hindi-identical where Bhojpuri does not diverge)", () => {
        expect(phonemizeWord("पानी")).toBe("pˈaːniː"); // 'water'
        expect(phonemizeWord("किताब")).toBe("kɪt̪ˈaːb"); // 'book'
        expect(phonemizeWord("तीन")).toBe("t̪ˈiːn"); // 'three'
        expect(phonemizeWord("लइका")).toBe("lˈəɪkaː"); // 'boy' (a characteristic Bhojpuri word)
        expect(phonemizeWord("भोजपुरी")).toBe("bʱˈoːd͡ʒpʊɾiː"); // 'Bhojpuri'
    });
});
