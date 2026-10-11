import { describe, expect, test } from "vitest";
import { phonemizeWord } from "../src/languages/french-ca/french-ca.ts";
import { phonemize } from "../src/index.ts";

// Hand-adjudicated DIAGNOSTIC GOLD for Québécois French (fr-CA), from the documented phonology (Walker 1984, *The
// Pronunciation of Canadian French*; Côté 2012). No fr-CA pronunciation corpus exists (wikipron/kaikki French is
// France French), so this feature-by-feature gold — not a mined referee — is the quality anchor, as for en-GB/en-IN.
// The delta is a context-free post-process on the France-French `fr` output, so phonemizeWord == phonemizeWordRules.
describe("Québécois French (fr-CA) — diagnostic gold", () => {
    test("AFFRICATION /t d/ → [t͡s d͡z] before high front /i y/ and glides /j ɥ/ (the signature)", () => {
        expect(phonemizeWord("tu")).toBe("t͡sˈy");
        expect(phonemizeWord("dire")).toBe("d͡zˈiʁ");
        expect(phonemizeWord("tuile")).toBe("t͡sɥˈɪl"); // before the glide /ɥ/
        expect(phonemizeWord("dimanche")).toBe("d͡zimˈɑ̃ʃ");
    });

    test("NO affrication before back /u/ or non-high vowels", () => {
        expect(phonemizeWord("tout")).toBe("tˈu"); // /t/ before /u/ stays [t]
        expect(phonemizeWord("table")).toBe("tˈabl"); // before /a/
        expect(phonemizeWord("dos")).toBe("dˈo"); // before /o/
    });

    test("HIGH-VOWEL LAXING /i y u/ → [ɪ ʏ ʊ] in a CLOSED syllable", () => {
        expect(phonemizeWord("petite")).toBe("pət͡sˈɪt"); // affricate + lax
        expect(phonemizeWord("six")).toBe("sˈɪs");
        expect(phonemizeWord("jupe")).toBe("ʒˈʏp");
        expect(phonemizeWord("route")).toBe("ʁˈʊt");
    });

    test("NO laxing in OPEN syllables, or before a LENGTHENING coda /ʁ v z ʒ/", () => {
        expect(phonemizeWord("petit")).toBe("pət͡sˈi"); // open final syllable → tense [i]
        expect(phonemizeWord("dire")).toBe("d͡zˈiʁ"); // /ʁ/ lengthens → tense [i]
        expect(phonemizeWord("musique")).toBe("myzˈɪk"); // my.zik: open [y] (z-onset), final [ɪ] laxes
        expect(phonemizeWord("difficile")).toBe("d͡zifisˈɪl"); // only the final closed ⟨il⟩ laxes
    });

    test("WORD-FINAL /a/ → posterior [ɑ]", () => {
        expect(phonemizeWord("Canada")).toBe("kanadˈɑ");
    });

    test("multi-feature words", () => {
        expect(phonemizeWord("habitude")).toBe("abit͡sˈʏd"); // affricate t→t͡s before y, lax y→ʏ
        expect(phonemizeWord("stupide")).toBe("st͡sypˈɪd");
        expect(phonemizeWord("politique")).toBe("pɔlit͡sˈɪk"); // first ⟨i⟩ open (no lax), affricate, final ⟨ik⟩ laxes
    });

    // #1533: the lookahead tested only the ONE symbol after the consonant, so an obstruent + liquid onset
    // (pu.blique, cy.clone, ci.tron) read as closing the syllable and the open-syllable vowel laxed.
    test("an obstruent + liquid ONSET leaves the syllable before it open (no laxing)", () => {
        expect(phonemizeWord("publique")).toBe("pyblˈɪk");
        expect(phonemizeWord("cyclone")).toBe("siklˈɔn");
        expect(phonemizeWord("citron")).toBe("sitʁˈɔ̃");
        expect(phonemizeWord("supplier")).toBe("syplijˈe");
        expect(phonemizeWord("microscope")).toBe("mikʁɔskˈɔp");
        // …but a word-final cluster, with no vowel after it, still closes the syllable.
        expect(phonemizeWord("chiffre")).toBe("ʃˈɪfʁ");
        expect(phonemizeWord("équilibre")).toBe("ekilˈɪbʁ");
    });
});

// #1533: the delta ran on the ASSEMBLED string, so it also affricated a run in another script that another
// engine had read (Greek τι → t͡si). It is applied per French word now.
describe("fr-CA: the accent delta spares an embedded foreign run", () => {
    test("the Greek run reads as the fr host reads it; the French words around it still shift", () => {
        expect(phonemize("Il a dit τι.", "fr-CA")).toBe("ɪl ɑ d͡zi tˈi .");
        expect(phonemize("Il a dit τι.", "fr")).toBe("il a di tˈi .");
    });
});
