import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/chhattisgarhi/chhattisgarhi.ts";

// Hand-adjudicated canonical-IPA gold for Chhattisgarhi / छत्तीसगढ़ी (hne) — Eastern Indo-Aryan (Eastern-Hindi),
// Devanagari. ⚠ CANNOT-VERIFY: NO independent phonetic referee exists (no wikipron/kaikki; epitran has NO hne
// mapping). CORROBORATED (not measured) against Hira Lal Kavyopadhyaya's 'A Grammar of the Chhattisgarhi Dialect
// of Eastern Hindi' (1921, rev. Grierson) — its phoneme inventory + the attested UDHR Article-1 sample. Two
// findings: श/ष→[s], since the inventory has NO /ʃ/, which is Chhattisgarhi's SOLE confident segmental
// divergence from Hindi; and ⚠ ऐ/औ are MONOPHTHONGS [ɛː]/[ɔː] as in Hindi (गौरव→[ɡɔrəʋ] in the sample), NOT
// the Bhojpuri-style diphthongs — the neighbouring language is the wrong thing to copy here.
describe("chhattisgarhi canonical IPA (corroborated vs the 1921 grammar)", () => {
    test("श/ष → [s] — Chhattisgarhi has no /ʃ/ (grammar inventory)", () => {
        expect(phonemizeWord("शहर")).toBe("sˈəɦəɾ"); // 'city' — श→s AND no əɦə→ɛɦɛ lowering (Hindi: ʃɛɦɛɾ)
        expect(phonemizeWord("देश")).toBe("d̪ˈeːs"); // 'country' (Hindi: d̪eːʃ)
        expect(phonemizeWord("शेर")).toBe("sˈeːɾ"); // 'lion/tiger' (Hindi: ʃeːɾ)
    });

    test("ऐ → [ɛː], औ → [ɔː] — monophthongs, as Hindi (NOT the Bhojpuri diphthongs)", () => {
        expect(phonemizeWord("बैल")).toBe("bˈɛːl"); // 'ox' — ऐ → ɛː, not *bail
        expect(phonemizeWord("कौन")).toBe("kˈɔːn"); // 'who' — औ → ɔː, not *kaun
        expect(phonemizeWord("गौरव")).toBe("ɡˈɔːɾəʋ"); // 'dignity' — matches the attested sample's [ɡɔrəʋ] (औ→ɔ, व→ʋ)
    });

    test("shared Indo-Aryan core (Hindi-identical where Chhattisgarhi does not diverge)", () => {
        expect(phonemizeWord("पानी")).toBe("pˈaːniː"); // 'water'
        expect(phonemizeWord("तीन")).toBe("t̪ˈiːn"); // 'three'
        expect(phonemizeWord("गाय")).toBe("ɡˈaːj"); // 'cow'
    });
});
