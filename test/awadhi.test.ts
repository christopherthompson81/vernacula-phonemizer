import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/awadhi/awadhi.ts";

// Hand-adjudicated canonical-IPA gold for Awadhi / अवधी (awa) — Eastern Hindi (Indo-Aryan), Devanagari.
// ⚠ SINGLE-SOURCE, AND NOT INDEPENDENT: the divergences this engine implements and the gold that grades it
// both come from Saksena. There is no second referee for Awadhi (no wikipron/kaikki/epitran), and a machine
// Hindi clone would be circular. Saksena is a real Awadhi grammar, so grading against it is not vacuous — but
// it cannot catch an error Saksena himself makes. Per Baburam Saksena,
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

    test("the flap's lookahead reaches a DIPHTHONG onset — the ʌ in the vowel class is load-bearing", () => {
        // ɖ before ऐ/औ is ɖ before [ʌi]/[ʌu], so the ʌ that only exists because of divergence (4) is what
        // lets divergence (2) fire here. Drop ʌ from the class and these two silently stop flapping.
        expect(phonemizeWord("कडैल")).toBe("kˈəɽʌil"); // Hindi: kəɖˈɛːl
        expect(phonemizeWord("पडौरा")).toBe("pˈəɽʌuɾaː"); // Hindi: pəɖˈɔːɾaː
    });

    test("the flap does NOT cross a word boundary, and a geminate ड्ड is not intervocalic", () => {
        // text() is post-processed whole, so the space between two words is the only thing stopping the
        // rule from reaching across it — a space is not in the vowel class.
        expect(phonemize("गोडा डाल", "awa")).toBe("ɡˈoːɽaː ɖˈaːl");
        expect(phonemizeWord("अड्डा")).toBe("ˈəɖɖaː");
    });

    test("word-final avagraha ⟨ऽ⟩ RETAINS the schwa (retainOnAvagraha) — Hindi deletes it", () => {
        expect(phonemizeWord("रामऽ")).toBe("ɾˈaːmə"); // Hindi: ɾˈaːm
        expect(phonemizeWord("राम")).toBe("ɾˈaːm");
        expect(phonemizeWord("करऽ")).toBe("kˈəɾə");
        expect(phonemizeWord("कर")).toBe("kˈəɾ");
    });

    test("⟨ज्ञ⟩ reads [d͡ʒɲ] — awadhi.jsonc carries no ज्ञ→ɡj post-rule, unlike hindi.jsonc", () => {
        // ⚠ PINNED, NOT ENDORSED: this is a divergence from Hindi that no Awadhi source licenses, shared
        // with mr/mai/hne/ne. See the FILED, NOT FIXED note in src/languages/awadhi/awadhi.ts.
        expect(phonemizeWord("ज्ञान")).toBe("d͡ʒɲˈaːn"); // Hindi: ɡjˈaːn
        expect(phonemizeWord("विज्ञान")).toBe("wɪd͡ʒɲˈaːn"); // Hindi: ʋɪɡjˈaːn
    });

    test("⚠ ₹ is NOT stripped — awa declares no symbolTier, so HINDI's claims the sign first", () => {
        // `stripSymbols: "₹"` in awadhi.jsonc never sees the character; the shared tier runs before it.
        expect(phonemize("₹500", "awa")).toBe("pˈaː̃t͡ʃ sˈʌu ɾˈʊpjeː");
        expect(phonemize("५०%", "awa")).toBe("pət͡ʃˈaːs pɾˈət̪ɪsət̪");
    });

    test("shared Indo-Aryan core (Hindi-identical where Awadhi does not diverge)", () => {
        expect(phonemizeWord("पानी")).toBe("pˈaːniː"); // 'water'
        expect(phonemizeWord("तीन")).toBe("t̪ˈiːn"); // 'three'
        expect(phonemizeWord("किताब")).toBe("kɪt̪ˈaːb"); // 'book'
    });
});
