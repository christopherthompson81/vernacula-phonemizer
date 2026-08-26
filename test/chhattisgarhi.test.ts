import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/chhattisgarhi/chhattisgarhi.ts";

// Hand-adjudicated canonical-IPA gold for Chhattisgarhi / छत्तीसगढ़ी (hne) — Eastern Indo-Aryan (Eastern-Hindi),
// Devanagari. ⚠ CANNOT-VERIFY: NO independent phonetic referee exists (no wikipron/kaikki; epitran has NO hne
// mapping). CORROBORATED (not measured) against Hira Lal Kavyopadhyaya's 'A Grammar of the Chhattisgarhi Dialect
// of Eastern Hindi' (1921, rev. Grierson) — its phoneme inventory + the attested UDHR Article-1 sample. Two
// findings: श/ष→[s], since the inventory has NO /ʃ/, which is Chhattisgarhi's sole divergence in the GRAPHEME
// TABLES; and ⚠ ऐ/औ are MONOPHTHONGS [ɛː]/[ɔː] as in Hindi (गौरव→[ɡɔrəʋ] in the sample), NOT the Bhojpuri-style
// diphthongs — the neighbouring language is the wrong thing to copy here.
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

    // The SECOND divergence from Hindi, and the one the docstring used to omit: `finalRules` is EMPTY here
    // where hindi.jsonc has three. शहर above covers əɦə→ɛɦɛ; these are the other two arms.
    test("no finalRules — अय→ɛj and the ɪ-offglide go too, not only əɦə→ɛɦɛ", () => {
        expect(phonemizeWord("समय")).toBe("sˈəməj"); // 'time' (Hindi: səmɛj — अय→ɛj)
        expect(phonemizeWord("जहर")).toBe("d͡ʒˈəɦəɾ"); // 'poison' (Hindi: d͡ʒɛɦɛɾ)
    });

    // ⚠ FILED, NOT FIXED — pinned so the gap is visible rather than merely written down. hindi.jsonc carries a
    // corpus-measured ज्ञ→ɡj postRule (73/73 FLEURS hi_in rows) and DELIBERATELY scopes it to Hindi, naming
    // Awadhi/Bhojpuri/Magahi as siblings that "likely pattern with Hindi but have no corpus evidence here".
    // Chhattisgarhi belongs in that list and is not in it, and no hne corpus exists in this repo to settle it.
    test("ज्ञ reads as its literal parts, where Hindi reads ɡj", () => {
        expect(phonemizeWord("ज्ञान")).toBe("d͡ʒɲˈaːn"); // Hindi: ɡjˈaːn
        expect(phonemizeWord("विज्ञान")).toBe("ʋɪd͡ʒɲˈaːn"); // Hindi: ʋɪɡjˈaːn
    });

    // ⚠ NOT LINGUISTIC CLAIMS. These pin what chhattisgarhi.jsonc INHERITS from hindi.jsonc — it declares no
    // `symbolTier`, no `ordinalSuffixes` and no `irregularOrdinals`, so all three fall back to Hindi's. An edit
    // to the shared Devanagari data then surfaces here instead of silently changing what Chhattisgarhi says.
    test("the inherited Hindi tiers, pinned (no hne source exists for any of them)", () => {
        // ⚠ `stripSymbols: "₹"` does NOT silence the rupee: the inherited symbol tier speaks it FIRST, before
        // the strip can apply. The manifest comment used to claim ₹500 read as the bare number; it does not.
        expect(phonemize("₹500", "hne")).toBe("pˈaː̃t͡ʃ sˈɔː ɾˈʊpjeː");
        expect(phonemize("50%", "hne")).toBe("pət͡ʃˈaːs pɾˈət̪ɪsət̪"); // hne's own `symbols`, with श→s applied
        expect(phonemize("16वीं", "hne")).toBe(phonemize("16वीं", "hi")); // ordinals: Hindi's, entire
        expect(phonemize("11:20", "hne")).toBe(phonemize("11:20", "hi")); // clock: Hindi's बजकर/मिनट, unattested here
    });
});
