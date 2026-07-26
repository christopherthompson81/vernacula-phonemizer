import { describe, expect, test } from "vitest";

import { createKabuverdianu, phonemizeWord } from "../src/languages/kabuverdianu/kabuverdianu.ts";

// Kabuverdianu / kriolu (kea) — Cape Verdean Creole (Portuguese-lexified, ~870k), the ALUPEC/AK phonemic orthography,
// Santiago variety. The FIRST creole with a bespoke engine in the fleet. No machine referee exists (wikipron has no
// kea; the kaikki dump carries IPA on only 7 words), so this is an AUTHORED bring-up (the Madurese/Luo pattern): a
// greedy ALUPEC scan (digraphs dj/tx/nh/lh/rr) + Portuguese-creole nasalization + accent/penult stress, ANCHORED on
// the 7 independent kaikki IPA words (this file is the falsifiable gold). Segments match all 7 (the kaikki's onset-ˈ
// notation and its loose ⟨r⟩~ɾ differ from our nucleus-ˈ + tap [ɾ] conventions). 🔷 thin single-source. See
// docs/investigations/kea_native_bringup_investigation.md.
describe("Kabuverdianu canonical IPA — ALUPEC g2p + nasalization (anchored on the 7 kaikki words)", () => {
    const kea = createKabuverdianu();

    test("the 7 kaikki IPA anchor words (segments verified; ˈ at the nucleus per fleet convention)", () => {
        expect(phonemizeWord("kobra")).toBe("kˈobɾɐ"); // kaikki [ˈko.brɐ] — ⟨o⟩ close [o], single ⟨r⟩=[ɾ]
        expect(phonemizeWord("kóbra")).toBe("kˈɔbɾɐ"); // kaikki [ˈkɔ.brɐ] — ⟨ó⟩ open [ɔ]
        expect(phonemizeWord("diskabresta")).toBe("diskɐbɾˈestɐ"); // kaikki /diskɐˈbɾestɐ/ — penult stress
        expect(phonemizeWord("barkinu")).toBe("bɐɾkˈinu"); // kaikki /bɐɾˈkinu/
        expect(phonemizeWord("tabanka")).toBe("tɐbˈãŋkɐ"); // kaikki [tɐˈbãŋkɐ] — an→ãŋ (nasal [ã] + velar ŋ)
        expect(phonemizeWord("talóti")).toBe("tɐlˈɔti"); // kaikki [tɐˈlɔti] — ⟨ó⟩ accent → stress
        expect(phonemizeWord("sénpri")).toBe("sˈɛ̃pɾi"); // kaikki [ˈsɛ̃pɾi] — én→ɛ̃ (nasal, n absorbed before p)
    });

    test("ALUPEC digraphs: ⟨dj⟩→d͡ʒ, ⟨tx⟩→t͡ʃ, ⟨nh⟩→ɲ, ⟨lh⟩→ʎ; ⟨x⟩→ʃ, ⟨j⟩→ʒ", () => {
        expect(phonemizeWord("fidju")).toBe("fˈid͡ʒu"); // ⟨dj⟩ → d͡ʒ ("son")
        expect(phonemizeWord("txeu")).toBe("t͡ʃˈeu"); // ⟨tx⟩ → t͡ʃ ("much")
        expect(phonemizeWord("nha")).toBe("ɲˈɐ"); // ⟨nh⟩ → ɲ ("my")
        expect(phonemizeWord("palha")).toBe("pˈɐʎɐ"); // ⟨lh⟩ → ʎ
        expect(phonemizeWord("xinti")).toBe("ʃˈĩti"); // ⟨x⟩ → ʃ, ⟨in⟩ → ĩ nasal
    });

    test("nasalization: a coda ⟨n/m⟩ nasalizes the vowel (bon→bõ, un→ũ) and is absorbed word-finally", () => {
        expect(phonemizeWord("bon")).toBe("bˈõ"); // "good" — ⟨on⟩ → õ (n absorbed)
        expect(phonemizeWord("un")).toBe("ˈũ"); // "one/a" — ⟨un⟩ → ũ
    });

    test("stress: OXYTONE when a word ends in a consonant (Ibero default); penult when it ends in a vowel/-s", () => {
        expect(phonemizeWord("mudjer")).toBe("mud͡ʒˈeɾ"); // "woman" — consonant-final → final stress
        expect(phonemizeWord("amor")).toBe("ɐmˈoɾ"); // "love" — oxytone
        expect(phonemizeWord("algen")).toBe("ɐlɡˈẽ"); // "someone" — final stress on the nasal ẽ
        expect(phonemizeWord("mininu")).toBe("minˈinu"); // vowel-final → penult
    });

    test("falling diphthongs (oi/ou…): the offglide is not a stress-bearing nucleus", () => {
        expect(phonemizeWord("oitu")).toBe("ˈoitu"); // "eight" — stress on o, ⟨i⟩ offglide (not oˈitu)
        expect(phonemizeWord("noiti")).toBe("nˈoiti"); // "night"
    });

    test("clause assembly", () => {
        expect(kea.text("Bon dia, Kabu Verdi!").trim()).toBe("bˈõ dˈiɐ , kˈɐbu vˈeɾdi !");
    });
});
