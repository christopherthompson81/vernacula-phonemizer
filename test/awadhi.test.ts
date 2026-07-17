import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/awadhi/awadhi.ts";

// Hand-adjudicated canonical-IPA gold for Awadhi / अवधी (awa) — Eastern Hindi (Indo-Aryan), Devanagari.
// ⚠ CANNOT-VERIFY (⛔): no independent referee exists (no wikipron/kaikki/epitran Awadhi). Per Baburam Saksena,
// Evolution of Awadhi (1937, Lakhimpuri dialect), quoting Bloch, the Eastern-Indo-Aryan phonologies are
// "perceptibly identical" and distinguished chiefly by GRAMMAR — so this gold targets the DOCUMENTED points of
// segmental divergence, the axis where a blind Hindi clone would be wrong: the SIBILANT MERGER श/ष→[s] (Saksena
// §87) and the INTERVOCALIC FLAP ड→[ɽ] except after a nasal. See docs/investigations/awa_native_bringup_investigation.md.
describe("Awadhi canonical IPA (Saksena-documented divergences vs Hindi)", () => {
    test("sibilant merger श/ष → [s] (Saksena §87: no /ʃ/ in Awadhi)", () => {
        expect(phonemizeWord("शहर")).toBe("sˈəɦəɾ"); // 'city' — श→s (Hindi: ʃ)
        expect(phonemizeWord("शेर")).toBe("sˈeːɾ"); // 'lion' (Hindi: ʃeːɾ)
        expect(phonemizeWord("देश")).toBe("d̪ˈeːs"); // 'country' (Hindi: d̪eːʃ)
    });

    test("intervocalic ड/ढ → [ɽ]/[ɽʱ] flap, but nasal-context and word-initial stay [ɖ]", () => {
        expect(phonemizeWord("अडा")).toBe("ˈəɽaː"); // plain ड between vowels → ɽ (Hindi keeps ɖ)
        expect(phonemizeWord("सडक")).toBe("sˈəɽək"); // 'road' — intervocalic → ɽ
        expect(phonemizeWord("पडोसी")).toBe("pəɽˈoːsiː"); // 'neighbour' — flap survives the stress mark
        expect(phonemizeWord("गढा")).toBe("ɡˈəɽʱaː"); // ढ (ɖʱ) → ɽʱ intervocalically
        expect(phonemizeWord("अंडा")).toBe("ˈə̃ɳɖaː"); // 'egg' — after an anusvara nasal (ɳ) ड stays ɖ (Saksena)
        expect(phonemizeWord("अँडा")).toBe("ˈə̃ɖaː"); // after NASALISATION (chandrabindu) ड stays ɖ (Saksena's other exception)
        expect(phonemizeWord("डर")).toBe("ɖˈəɾ"); // 'fear' — WORD-INITIAL ड stays ɖ
    });

    test("ऐ/औ ship as the eastern diphthongs [ai]/[au] (provisional — see provenance)", () => {
        // NOT deferred-to-Hindi: awa ships the eastern diphthong, diverging from Hindi's monophthong ɛː/ɔː,
        // following Bhojpuri. The exact quality is unconfirmed in Saksena's OCR, hence "provisional", but the
        // shipped behaviour is asserted so a regression is caught.
        expect(phonemizeWord("बैल")).toBe("bˈail"); // 'ox' (Hindi monophthong: bɛːl)
        expect(phonemizeWord("कौन")).toBe("kˈaun"); // 'who' (Hindi: kɔːn)
    });

    test("shared Indo-Aryan core (Hindi-identical where Awadhi does not diverge)", () => {
        expect(phonemizeWord("पानी")).toBe("pˈaːniː"); // 'water'
        expect(phonemizeWord("तीन")).toBe("t̪ˈiːn"); // 'three'
        expect(phonemizeWord("किताब")).toBe("kɪt̪ˈaːb"); // 'book'
        expect(phonemizeWord("अवधी")).toBe("ˈəʋd̪ʱiː"); // 'Awadhi'
    });
});
