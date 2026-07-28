import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/kalaallisut/kalaallisut.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Kalaallisut / West Greenlandic (kl) — Eskimo-Aleut (Inuit), the fleet's FIRST
// Eskimo-Aleut language. The 1973 orthography is highly phonemic → a near-1:1 scan: the THREE-vowel system
// /a i u/ (⟨e o⟩ = the uvular-lowered allophones → [i]/[u]), the uvular ⟨q⟩→[q]/⟨r⟩→[ʁ], ⟨ng⟩→[ŋ]/⟨nng⟩→[ŋː],
// doubled letter → length, loan ⟨b d⟩→[p t]. Validated 94.8% folded / 98.5% symbol vs wikipron kal_latn_broad
// (human, 1581). See docs/investigations/kl_native_bringup_investigation.md.
describe("Kalaallisut (Greenlandic) canonical IPA", () => {
    test("three-vowel /a i u/ + ⟨e o⟩ → [i u] (uvular-lowered allophones)", () => {
        expect(phonemizeWord("nanoq")).toBe("nanuq"); // ⟨o⟩ before ⟨q⟩ → [u] (the phonemic level); ⟨q⟩→[q]
        expect(phonemizeWord("qajaq")).toBe("qajaq"); // uvular ⟨q⟩→[q]; ⟨j⟩→[j]
        expect(phonemizeWord("inuk")).toBe("inuk"); // /a i u/ direct (person/human)
        expect(phonemizeWord("aanaa")).toBe("aːnaː"); // doubled vowel → length [aː]
    });

    test("uvular ⟨r⟩→[ʁ], ⟨ng⟩/⟨nng⟩, gemination, loan ⟨b d⟩→[p t]", () => {
        expect(phonemizeWord("illu")).toBe("ilːu"); // ⟨ll⟩ → long [lː] (house)
        expect(phonemizeWord("angakkoq")).toBe("aŋakːuq"); // ⟨ng⟩→[ŋ]; ⟨kk⟩→[kː]; ⟨o⟩→[u]
        expect(phonemizeWord("Kalaallisut")).toBe("kalaːlːisut"); // the endonym: ⟨aa⟩→[aː], ⟨ll⟩→[lː]
        expect(phonemizeWord("Bolatta")).toBe("pulatːa"); // loan ⟨b⟩→[p], ⟨o⟩→[u], ⟨tt⟩→[tː]
        expect(phonemizeWord("isigak")).toBe("isiɣak"); // ⟨g⟩ → the voiced velar FRICATIVE [ɣ] (parallel to r→ʁ)
    });

    test("registry wiring", () => {
        expect(getPhonemizer("kl").text("nuna").trim()).toBe("nuna");
    });
});
