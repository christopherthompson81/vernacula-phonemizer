import { describe, expect, test } from "vitest";

import { createSlovenian, phonemizeWord } from "../src/languages/slovenian/slovenian.ts";

// Slovenian (sl, slovenščina) — South Slavic (~2.5M), its OWN engine (not the BCS shared g2p). Slovak-shaped scan →
// syllabic-liquid → voicing pipeline. Slovene orthography is shallow at the consonant level but UNDERSPECIFIES the
// vowels (quality/length/pitch/schwa are all unwritten) → the vowel axis is folded in the referee eval; these golds
// lock the CONSONANT skeleton + the Slovene rules: ⟨lj/nj⟩ coda-j-drop, syllabic-r→ər, voicing/devoicing, ⟨v⟩→ʋ. NO
// stress mark is emitted (Slovene stress is free/lexical + unwritten → deferred). 94.1% folded / 98.7% symbol accuracy
// vs wikipron slv_latn_broad (5,177 headwords). See docs/investigations/sl_native_bringup_investigation.md.
describe("Slovenian canonical IPA — Slovak-shaped South Slavic engine + Slovene rules", () => {
    const sl = createSlovenian();

    test("⟨lj⟩/⟨nj⟩ → l+j / n+j before a vowel; the j DROPS in coda/final", () => {
        expect(phonemizeWord("polje")).toBe("pɔljɛ"); // "field" — prevocalic lj
        expect(phonemizeWord("banja")).toBe("banja"); // prevocalic nj
        expect(phonemizeWord("kralj")).toBe("kral"); // "king" — final lj → l (j drops)
        expect(phonemizeWord("konj")).toBe("kɔn"); // "horse" — final nj → n
        expect(phonemizeWord("Ljubljana")).toBe("ljubljana"); // both lj prevocalic (not syllabic)
    });

    test("syllabic ⟨r⟩ → ər (schwa before r)", () => {
        expect(phonemizeWord("prst")).toBe("pərst"); // "finger" — syllabic r
        expect(phonemizeWord("vrt")).toBe("ʋərt"); // "garden" — ⟨v⟩→ʋ + syllabic r
    });

    test("final devoicing + regressive voicing assimilation; ⟨h⟩=[x] is voicing-neutral", () => {
        expect(phonemizeWord("grad")).toBe("ɡrat"); // final d → t
        expect(phonemizeWord("glasba")).toBe("ɡlazba"); // s → z before b (regressive voicing)
        expect(phonemizeWord("Abhazija")).toBe("abxazija"); // b stays b before ⟨h⟩=[x] (x does not trigger)
    });

    test("consonants: ⟨č⟩=t͡ʃ, ⟨v⟩=ʋ, ⟨h⟩=x, ⟨o/e⟩ open-mid default", () => {
        expect(phonemizeWord("človek")).toBe("t͡ʃlɔʋɛk"); // "person"
        expect(phonemizeWord("voda")).toBe("ʋɔda"); // "water"
        expect(phonemizeWord("dober")).toBe("dɔbɛr"); // "good" — the -er schwa is emitted ɛ (folded)
    });

    test("⟨ć/đ⟩ Serbo-Croatian loans → t͡ʃ/d͡ʒ (not silently dropped); ⟨y⟩→i", () => {
        expect(phonemizeWord("Đorđe")).toBe("d͡ʒɔrd͡ʒɛ"); // đ → d͡ʒ
        expect(phonemizeWord("ćevapi")).toBe("t͡ʃɛʋapi"); // ć → t͡ʃ
    });

    test("cardinal numbers: unit-IN-ten inversion (21=enaindvajset) + GENDERED agreement (dva/trije milijoni, dve milijardi)", () => {
        expect(sl.text("21").trim()).toBe("ɛnaindʋajsɛt"); // ena + in + dvajset (one-and-twenty)
        expect(sl.text("35").trim()).toBe("pɛtintridɛsɛt"); // pet + in + trideset
        expect(sl.text("234").trim()).toBe("dʋɛstɔ ʃtiriintridɛsɛt"); // dvesto štiriintrideset
        expect(sl.text("2000000").trim()).toBe("dʋa milijɔna"); // masc dual: dva milijona
        expect(sl.text("3000000").trim()).toBe("trijɛ milijɔni"); // masc paucal numeral: trije (not tri)
        expect(sl.text("2000000000").trim()).toBe("dʋɛ milijardi"); // fem dual: DVE milijardi (milijarda is feminine)
    });

    test("clause assembly", () => {
        expect(sl.text("Dober dan, Slovenija!").trim()).toBe("dɔbɛr dan , slɔʋɛnija !");
    });
});
