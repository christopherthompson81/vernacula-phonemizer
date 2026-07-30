import { describe, expect, test } from "vitest";

import { createKabuverdianu, phonemizeWord } from "../src/languages/kabuverdianu/kabuverdianu.ts";
import { numberToWords } from "../src/languages/kabuverdianu/numbers.ts";

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

    // NUMBERS — Santiago/Badiu ALUPEC. Fully decimal; the tens JUXTAPOSE with their unit (the sources write the
    // link as a hyphen: vinti-un, sunkuénti-sax) so there is no ⟨i⟩ connector word; 16–19 are the analytic
    // Portuguese-style ⟨diza-⟩ series. Source: Wiktionary kea cardinals + omniglot (kabuverdianu.jsonc).
    test("numbers: units, the juxtaposed tens, hundreds, thousands, millions", () => {
        expect(numberToWords(7)).toBe("seti");
        expect(numberToWords(16)).toBe("dizasais"); // the ⟨diza-⟩ series (Pt dezasseis, not Es dieciséis)
        expect(numberToWords(21)).toBe("vinti un"); // juxtaposed — no connector
        expect(numberToWords(31)).toBe("trinta un");
        expect(numberToWords(100)).toBe("sen");
        expect(numberToWords(555)).toBe("kinhentus sinkuenta sinku");
        expect(numberToWords(12345)).toBe("duzi mil trezentus korenta sinku");
        expect(numberToWords(1000000)).toBe("un milion");
        expect(numberToWords(1000000000)).toBe("mil milion"); // Pt-style "mil milhões"
    });

    test("numbers read through the g2p (nasalization + accent-or-penult stress)", () => {
        expect(kea.text("21").trim()).toBe("vˈĩti ˈũ"); // coda ⟨n⟩ nasalizes and is absorbed
        expect(kea.text("100").trim()).toBe("sˈẽ"); // sen
        expect(kea.text("0").trim()).toBe("zˈɛɾu"); // zéru — the acute marks the OPEN ⟨é⟩ [ɛ] + stress
    });
});
