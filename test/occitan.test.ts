import { describe, expect, test } from "vitest";

import { createOccitan, phonemizeWord } from "../src/languages/occitan/occitan.ts";
import { numberToWords } from "../src/languages/occitan/numbers.ts";

// Occitan (oc) — occitan / lenga d'òc, Occitano-Romance (Gallo-Romance) of southern France (~200k). The classical
// orthography is PAN-DIALECTAL (one spelling, dialect-specific readings), so this g2p targets LANGUEDOCIEN (the
// central reference standard + the most-likely FLEURS reader dialect). A greedy scan + code rules, validated against
// wikipron oci_latn_broad (675 human headwords — SMALL + dialect-mixed) — 68.7% FOLDED / 93.0% symbol, with the
// dialect vowel/rhotic spread + spirantization + stress folded. 🔷 thin single source. Dialect overrides
// (Gascon/Provençal/Niçard) are DEFERRED (no clean per-dialect data).
describe("Occitan (Languedocien) canonical IPA — Gallo-Romance g2p", () => {
    const oc = createOccitan();

    test("the signature vowels: unstressed ⟨o⟩→[u], final ⟨a⟩→[ɔ], ⟨u⟩→[y], ⟨ò⟩→[ɔ], ⟨è⟩→[ɛ]", () => {
        expect(phonemizeWord("França")).toBe("fɾansɔ"); // final ⟨a⟩ → ɔ ("France")
        expect(phonemizeWord("Barcelona")).toBe("baɾselunɔ"); // ⟨o⟩ → u, final ⟨a⟩ → ɔ
        expect(phonemizeWord("Bordèu")).toBe("buɾdɛw"); // ⟨o⟩→u, ⟨è⟩→ɛ, ⟨u⟩ offglide → w
        expect(phonemizeWord("Nòrd")).toBe("nɔɾt"); // ⟨ò⟩→ɔ, final ⟨d⟩ devoices → t ("North")
    });

    test("the digraphs: ⟨lh⟩→ʎ, ⟨nh⟩→ɲ, ⟨ch⟩→t͡ʃ, ⟨j⟩→d͡ʒ, ⟨v⟩→b, ⟨c g⟩ softening", () => {
        expect(phonemizeWord("filha")).toBe("fiʎɔ"); // ⟨lh⟩ → ʎ ("daughter")
        expect(phonemizeWord("montanha")).toBe("muntaɲɔ"); // ⟨nh⟩ → ɲ, ⟨o⟩→u ("mountain")
        expect(phonemizeWord("Ardecha")).toBe("aɾdet͡ʃɔ"); // ⟨ch⟩ → t͡ʃ (a département)
        expect(phonemizeWord("Occitània")).toBe("uksitanjɔ"); // ⟨o⟩→u, ⟨c⟩ softening, ⟨i⟩→j glide
    });

    test("intervocalic ⟨s⟩→[z]; ⟨s⟩→[z] before a voiced consonant", () => {
        expect(phonemizeWord("Lisbona")).toBe("lizbunɔ"); // ⟨s⟩ → z before [b] ("Lisbon")
    });

    test("the Languedocien final-consonant deletion: word-final ⟨n r⟩ after a vowel drops", () => {
        expect(phonemizeWord("Japon")).toBe("d͡ʒapu"); // final ⟨n⟩ drops ("Japan")
        expect(phonemizeWord("cantar")).toBe("kanta"); // infinitive final ⟨r⟩ drops ("to sing")
        expect(phonemizeWord("abandonar")).toBe("abanduna"); // final ⟨r⟩ drops ("to abandon")
    });

    test("glides: ⟨u⟩→[w] only as a falling offglide, [y] in hiatus; ⟨iu⟩ is the falling diphthong [iw]", () => {
        expect(phonemizeWord("arriu")).toBe("ariw"); // ⟨iu⟩ → iw (⟨i⟩ is the nucleus, not a glide) ("river")
        expect(phonemizeWord("afluent")).toBe("aflyent"); // ⟨u⟩ in hiatus → [y], not [w] ("tributary")
        expect(phonemizeWord("aigua")).toBe("aiɡwɔ"); // ⟨gu⟩ before a back vowel → [ɡw] ("water")
    });

    test("clause assembly", () => {
        expect(oc.text("Parli occitan.").trim()).toBe("paɾli uksita .");
    });

    // NUMBERS — Languedocien decimal cardinals (setanta/ochanta/nonanta, no vigesimal ⟨quatre-vint⟩); the ⟨e⟩
    // connector joins the TWENTIES only, 30–90 juxtapose. Source: omniglot + languagesandnumbers (occitan.jsonc).
    test("numbers: units, the ⟨vint e …⟩ twenties, hundreds, thousands, millions", () => {
        expect(numberToWords(7)).toBe("sèt");
        expect(numberToWords(16)).toBe("setze"); // irregular 16 (not *dètz e sièis)
        expect(numberToWords(21)).toBe("vint e un"); // the ⟨e⟩ connector — twenties only
        expect(numberToWords(31)).toBe("trenta un"); // 30–90 juxtapose (cf. Catalan trenta-un)
        expect(numberToWords(90)).toBe("nonanta"); // DECIMAL 90, not *quatre-vint-dètz
        expect(numberToWords(555)).toBe("cinc cents cinquanta cinc");
        expect(numberToWords(12345)).toBe("dotze mila tres cents quaranta cinc");
        expect(numberToWords(1000000)).toBe("un milion");
        expect(numberToWords(1000000000)).toBe("un miliard");
    });

    test("numbers read through the g2p", () => {
        expect(oc.text("21").trim()).toBe("bint e y"); // ⟨v⟩→b (betacism), final ⟨n⟩ drops
        expect(oc.text("100").trim()).toBe("sent"); // cent
        expect(oc.text("1000").trim()).toBe("milɔ"); // mila — final ⟨a⟩ → ɔ
    });
});
