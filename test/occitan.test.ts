import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { normalizeOccitan } from "../src/languages/occitan/normalize.ts";

import { createOccitan, phonemizeWord } from "../src/languages/occitan/occitan.ts";
import { numberToWords } from "../src/languages/occitan/numbers.ts";

// Occitan (oc) — occitan / lenga d'òc, Occitano-Romance (Gallo-Romance) of southern France (~200k). The classical
// orthography is PAN-DIALECTAL (one spelling, dialect-specific readings), so this g2p targets LANGUEDOCIEN (the
// central reference standard + the most-likely FLEURS reader dialect). A greedy scan + code rules.
// ⚠ Referee: wikipron oci_latn_broad — 675 headwords, SMALL and DIALECT-MIXED, which is the ceiling on what it
// can say about a pan-dialectal orthography at all. Folds: dialect vowel/rhotic spread, spirantization,
// stress. Single-source. Dialect overrides
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

// ── TEXT NORMALIZATION (src/languages/occitan/normalize.ts) ─────────────────────────────────────────
//
// Evidence: `tools/corpus/mined/oc.jsonc` (oc.wikipedia dump, 393,961 paragraph segments). The argument
// for every case is in the normalizer's own header.
describe("Occitan text normalization", () => {
    const oc = { text: (s: string) => phonemize(s, "oc") };

    test("the separators — SPACE groups, BOTH marks decimate, and that is NOT Asturian's rule", () => {
        expect(normalizeOccitan("19 042 936")).toBe("19042936");
        expect(normalizeOccitan("1 275 207")).toBe("1275207");
        // ⚠ No dot in this corpus ever groups, so the three-digit test Asturian needs would be wrong here.
        expect(normalizeOccitan("1640.93")).toBe("1640,93");
        expect(oc.text("13,1°C")).toBe("tɾet͡se biɾɡylɔ y ɡɾaws selsiws");
    });

    test("the ERA — and ⚠ it was never a LEAK, which is why no gate saw it", () => {
        // Occitan's TOKEN treats a letter run as a word, so `abC` reached the g2p as the syllable [abk].
        expect(normalizeOccitan("3500 abC")).toBe("3500 abans Crist");
        expect(normalizeOccitan("484-425 avC")).toBe("484, 425 abans Crist"); // the Provençal spelling
        expect(oc.text("3500 abC")).toContain("abans");
    });

    test("⚠ ONE DEGREE SIGN IS A BOOK SIZE, and the lookbehind has to span the whole figure", () => {
        // `2 in-12°` is DUODECIMO. Written `(?<!in-)` the guard tests the three characters before the
        // LAST DIGIT — `n-1` — and passes, which is how the first version still read *dotze graus*.
        expect(normalizeOccitan("2 in-12°")).toBe("2 in-12°");
        expect(normalizeOccitan("100°C")).toBe("100 graus Celsius");
        expect(normalizeOccitan("250°")).toBe("250 graus "); // the dog's field of vision; the pad is collapsed downstream
    });

    test("the clock, the minus and the range's pause", () => {
        expect(normalizeOccitan("12:30 h")).toBe("12 30 h"); // the writer supplies the `h`
        expect(normalizeOccitan("-20,4°C")).toBe("mens 20,4 graus Celsius");
        expect(normalizeOccitan("1909-2006")).toBe("1909, 2006");
        // ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58).
        expect(normalizeOccitan("18-20).")).toBe("18, 20).");
    });

    test("⚠ WHAT IS REFUSED — `>` is a taxonomic rank chain, a FIFTH sense in this sweep", () => {
        expect(normalizeOccitan("Eucariòtas > Metazoaris")).toBe("Eucariòtas > Metazoaris");
    });

    test("the symbol tier — and ⚠ `gras` ×156 is the word for FAT, not for degree", () => {
        expect(oc.text("50 %")).toBe("sinkwantɔ pe sent");
        expect(oc.text("9 km")).toBe("nɔw kilumɛtɾes");
    });
});
