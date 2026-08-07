import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/awadhi/awadhi.ts";

// Hand-adjudicated canonical-IPA gold for Awadhi / अवधी (awa) — Eastern Hindi (Indo-Aryan), Devanagari.
// SINGLE-SOURCE: the divergences + this gold both come from ONE documented source (Saksena) — that is what 
// requires; there is no *independent* second referee (no wikipron/kaikki/epitran Awadhi), and a machine
// Hindi-clone would be circular, but Saksena is a real Awadhi grammar so grading against it is not vacuous. Per Baburam Saksena,
// Evolution of Awadhi (1937, Lakhimpuri dialect), quoting Bloch, the Eastern-Indo-Aryan phonologies are
// "perceptibly identical" and distinguished chiefly by GRAMMAR — so this gold targets the DOCUMENTED points of
// segmental divergence, the axis where a blind Hindi clone would be wrong: the SIBILANT MERGER श/ष→[s] (Saksena
// §87) and the INTERVOCALIC FLAP ड→[ɽ] except after a nasal.
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

    test("ऐ/औ → central-onset diphthongs [ʌi]/[ʌu] (Saksena §2395: Lakhimpuri, vs Eastern/Bhojpuri monophthong)", () => {
        // The Lakhimpuri basis keeps the diphthong where Bhojpuri (Eastern) monophthongises to ɛ/ɔ — a real
        // Awadhi/Bhojpuri split, so this must NOT be flattened to the Bhojpuri value. Central onset ʌ per §2395.
        expect(phonemizeWord("बैल")).toBe("bˈʌil"); // 'ox' (Bhojpuri: bɛl; Hindi: bɛːl)
        expect(phonemizeWord("कौन")).toBe("kˈʌun"); // 'who' (Bhojpuri: kɔn; Hindi: kɔːn)
    });

    test("व → [w] bilabial semivowel (Saksena §12: not Hindi's ʋ) — same eastern reflex as Bhojpuri", () => {
        expect(phonemizeWord("अवधी")).toBe("ˈəwd̪ʱiː"); // 'Awadhi' — व→w (Hindi: əʋd̪ʱiː)
        expect(phonemizeWord("विशाल")).toBe("wɪsˈaːl"); // 'huge' — व→w, श→s
    });

    test("shared Indo-Aryan core (Hindi-identical where Awadhi does not diverge)", () => {
        expect(phonemizeWord("पानी")).toBe("pˈaːniː"); // 'water'
        expect(phonemizeWord("तीन")).toBe("t̪ˈiːn"); // 'three'
        expect(phonemizeWord("किताब")).toBe("kɪt̪ˈaːb"); // 'book'
    });
});
