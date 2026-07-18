import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/chhattisgarhi/chhattisgarhi.ts";

// Hand-adjudicated canonical-IPA gold for Chhattisgarhi / छत्तीसगढ़ी (hne) — Eastern Indo-Aryan (Eastern-Hindi),
// Devanagari. ⚠ CANNOT-VERIFY: NO independent referee exists (no wikipron/kaikki; epitran has NO hne mapping at
// all). Chhattisgarhi is segmentally ~Hindi (distinguished mostly GRAMMATICALLY), so this gold deliberately
// targets the DISTINCTIVE features — the shared Eastern-Hindi axis where Chhattisgarhi ≠ Hindi and a Hindi clone
// is demonstrably wrong: श/ष→[s] (no /ʃ/), ऐ/औ kept as the diphthongs [ai]/[au] (Hindi monophthongised to ɛː/ɔː),
// no Hindi əɦə-lowering. Adjudicated from Grierson LSI VI-ii (Chhattisgarhi ≈ Awadhi/Bhojpuri, Eastern Hindi).
// See docs/investigations/hne_native_bringup_investigation.md.
describe("chhattisgarhi canonical IPA (distinctive features vs Hindi)", () => {
    test("श/ष → [s] — Chhattisgarhi has no /ʃ/", () => {
        expect(phonemizeWord("शहर")).toBe("sˈəɦəɾ"); // 'city' — श→s AND no əɦə→ɛɦɛ lowering (Hindi: ʃɛɦɛɾ)
        expect(phonemizeWord("देश")).toBe("d̪ˈeːs"); // 'country' (Hindi: d̪eːʃ)
        expect(phonemizeWord("शेर")).toBe("sˈeːɾ"); // 'lion/tiger' (Hindi: ʃeːɾ)
    });

    test("ऐ → [ai], औ → [au] — Chhattisgarhi keeps the diphthongs", () => {
        expect(phonemizeWord("बैल")).toBe("bˈail"); // 'ox' (Hindi monophthong: bɛːl)
        expect(phonemizeWord("कौन")).toBe("kˈaun"); // 'who' (Hindi: kɔːn)
    });

    test("shared Indo-Aryan core (Hindi-identical where Chhattisgarhi does not diverge)", () => {
        expect(phonemizeWord("पानी")).toBe("pˈaːniː"); // 'water'
        expect(phonemizeWord("तीन")).toBe("t̪ˈiːn"); // 'three'
        expect(phonemizeWord("गाय")).toBe("ɡˈaːj"); // 'cow'
    });
});
