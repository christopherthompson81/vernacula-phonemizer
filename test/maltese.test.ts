import { describe, expect, test } from "vitest";

import { createMaltese, phonemizeWord } from "../src/languages/maltese/maltese.ts";
import { getPhonemizer } from "../src/registry.ts";

// Maltese (mt) — Malti, the ONLY Semitic language written in the Latin alphabet (a Siculo-Arabic core + Sicilian/
// Italian/English superstrate), Malta (~520k). Maltese orthography is fairly phonemic, so the engine is a greedy
// grapheme scan (the ⟨ie għ⟩ digraphs + the silent-letter rules) + final devoicing + regressive voicing assimilation
// + affricate gemination + n→m before a labial. Validated against the wikipron mlt_latn_broad referee (15,837 human
// headwords) — 91.9% FOLDED / 98.0% symbol, with vowel LENGTH (stress-conditioned, ~50% of lines) + għ
// pharyngealization folded. 🔷 single-source. See docs/investigations/mt_native_bringup_investigation.md.
describe("Maltese canonical IPA — grapheme g2p + silent-letter rules + devoicing", () => {
    const mt = createMaltese();

    test("the distinctive Maltese consonants: ċ→t͡ʃ, ġ→d͡ʒ, ħ→ħ, q→ʔ, x→ʃ, ż→z vs z→t͡s", () => {
        expect(phonemizeWord("ċar")).toBe("t͡ʃar"); // ⟨ċ⟩ → t͡ʃ ("clear")
        expect(phonemizeWord("ġar")).toBe("d͡ʒar"); // ⟨ġ⟩ → d͡ʒ ("neighbour")
        expect(phonemizeWord("ħażin")).toBe("ħazɪn"); // ⟨ħ⟩ → ħ, ⟨ż⟩ → z ("bad")
        expect(phonemizeWord("żmien")).toBe("zmɪn"); // ⟨ż⟩ → z, ⟨ie⟩ → ɪ ("time")
        expect(phonemizeWord("ċuċ")).toBe("t͡ʃut͡ʃ"); // ⟨ċ⟩ ("fool")
    });

    test("⟨q⟩ → ʔ (the glottal stop), the Maltese signature", () => {
        expect(phonemizeWord("qalb")).toBe("ʔalp"); // ⟨q⟩ → ʔ, final ⟨b⟩ devoices ("heart")
        expect(phonemizeWord("qattus")).toBe("ʔattus"); // MEDIAL geminate kept ("cat")
    });

    test("final devoicing + regressive assimilation over obstruent clusters", () => {
        expect(phonemizeWord("Attard")).toBe("attart"); // final ⟨d⟩ → t (a surname)
        expect(phonemizeWord("kiteb")).toBe("kɪtɛp"); // final ⟨b⟩ → p ("he wrote")
        expect(phonemizeWord("ħobż")).toBe("ħɔps"); // ⟨b⟩ devoices before the final ⟨ż⟩→s ("bread")
    });

    test("⟨n⟩ → m before a labial", () => {
        expect(phonemizeWord("ġenb")).toBe("d͡ʒɛmp"); // n→m before b, then final devoicing b→p ("side")
    });

    test("silent ⟨għ⟩: silent word-medially (colours/lengthens the vowel — folded), [ħ] word-final", () => {
        expect(phonemizeWord("għamel")).toBe("amɛl"); // word-initial ⟨għ⟩ silent ("he did")
        expect(phonemizeWord("xogħol")).toBe("ʃɔl"); // medial ⟨għ⟩ silent ("work")
        expect(phonemizeWord("biegħ")).toBe("bɪħ"); // WORD-FINAL ⟨għ⟩ → [ħ] ("he sold")
        expect(phonemizeWord("friegħ")).toBe("frɪħ"); // word-final ⟨għ⟩ → [ħ] ("branches")
    });

    test("silent ⟨h⟩: silent medially (adjacent vowels collapse), [ħ] word-final", () => {
        expect(phonemizeWord("deheb")).toBe("dɛp"); // medial ⟨h⟩ silent, the a-a collapse + final devoicing ("gold")
        expect(phonemizeWord("xahar")).toBe("ʃar"); // medial ⟨h⟩ silent ("month")
        expect(phonemizeWord("fih")).toBe("fɪħ"); // WORD-FINAL ⟨h⟩ → [ħ] ("in it")
    });

    test("⟨ie⟩ → the long [ɪ] (length folded)", () => {
        expect(phonemizeWord("tliet")).toBe("tlɪt"); // ⟨ie⟩ → ɪ ("three")
    });

    test("word-final geminate DEGEMINATION (medial geminate kept)", () => {
        expect(phonemizeWord("Ħadd")).toBe("ħat"); // final ⟨dd⟩ → single, then devoice → t ("Sunday / nobody")
        expect(phonemizeWord("qattus")).toBe("ʔattus"); // MEDIAL ⟨tt⟩ KEPT
    });

    test("affricate gemination: a doubled affricate = STOP + affricate (⟨ġġ⟩→[dd͡ʒ], not [d͡ʒd͡ʒ])", () => {
        expect(phonemizeWord("mweġġa")).toBe("mwɛdd͡ʒa"); // ⟨ġġ⟩ → d + d͡ʒ ("hurt")
    });

    test("grave-accented vowels (the productive ⟨-tà⟩ nominalizer): same quality, kept — not dropped", () => {
        expect(phonemizeWord("attività")).toBe("attɪvɪta"); // ⟨à⟩ → a ("activity")
        expect(phonemizeWord("università")).toBe("unɪvɛrsɪta"); // ("university")
        expect(phonemizeWord("Perù")).toBe("pɛru"); // ⟨ù⟩ → u ("Peru")
    });

    test("clause assembly (the article ⟨il-⟩ splits on the hyphen)", () => {
        expect(mt.text("Il-Malti ħelu.").trim()).toBe("ɪl maltɪ ħɛlu .");
    });

    // ═══ CARDINAL NUMBERS — the NATIVE Semitic series (Maltese has no rival borrowed one). Composition + sources
    // live in src/languages/maltese/numbers.ts (GF-RGL NumeralMlt.gf + Wiktionary). The judgment call: a bare
    // digit reads with the ABSOLUTE/COUNTING form (tnejn 2), not the pre-nominal attributive (żewġ).
    test("★ cardinals: the ABSOLUTE counting series + units-first ⟨u⟩ + the DUAL magnitudes", () => {
        const mt = getPhonemizer("mt");
        expect(mt.text("0").trim()).toBe("zɛrɔ"); // żero
        expect(mt.text("2").trim()).toBe("tnɛjn"); // tnejn — the COUNTING form, not attributive żewġ
        expect(mt.text("10").trim()).toBe("aʃra"); // għaxra (⟨għ⟩ silent → aʃra)
        expect(mt.text("21").trim()).toBe("wɪħɛt u ɔʃrɪn"); // wieħed u għoxrin — UNITS-FIRST, Semitic order
        expect(mt.text("45").trim()).toBe("ħamsa u ɛrbɪn"); // ħamsa u erbgħin
        expect(mt.text("100").trim()).toBe("mɪja"); // mija
        expect(mt.text("200").trim()).toBe("mɪtɛjn"); // mitejn — the DUAL, never *żewġ mija
        expect(mt.text("555").trim()).toBe("ħamɛs mɪja u ħamsa u ħamsɪn"); // ħames mija u ħamsa u ħamsin
        expect(mt.text("1000").trim()).toBe("ɛlf"); // elf — bare, no leading wieħed
        expect(mt.text("2000").trim()).toBe("ɛlfɛjn"); // elfejn — the DUAL again
        expect(mt.text("3000").trim()).toBe("tlɪt ɛlɛf"); // tlitt elef — the -t attributive + PLURAL elef
    });

    test("cardinals: the ⟨-il⟩ teen linker, group juxtaposition, and miljun's MISSING dual", () => {
        const mt = getPhonemizer("mt");
        // 12 345 = tnax-il elf tliet mija u ħamsa u erbgħin. `u` marks only the FINAL constituent; the ⟨-il⟩
        // hyphen is not a token boundary (the grapheme scan skips it: ħdaxil).
        expect(mt.text("12345").trim()).toBe("tnaʃɪl ɛlf tlɪt mɪja u ħamsa u ɛrbɪn");
        expect(mt.text("1000000").trim()).toBe("mɪljun"); // miljun
        // miljun is a Romance loan with NO dual, so 2× takes the ordinary attributive żewġ + PLURAL miljuni.
        expect(mt.text("2000000").trim()).toBe("zɛwt͡ʃ mɪljunɪ"); // żewġ miljuni, never *miljunejn
    });
});
