import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/italian/italian.ts";
import { ROMAN_POLICY } from "../src/languages/italian/romanOrdinals.ts";

// Canonical-IPA goldens for Italian (it) — a shallow, near-phonemic Latin orthography, rule-based G2P. Hand-
// verified standard pronunciations, in OUR convention: close-mid default for stressed ⟨e⟩/⟨o⟩ (the /e/~/ɛ/,
// /o/~/ɔ/ openness is LEXICAL and folded in the eval), intervocalic ⟨s⟩→z default (casa/rosa lexical, folded),
// gemination as DOUBLED consonants (the referee's own convention). c/g soften to t͡ʃ/d͡ʒ before e/i (⟨ci⟩/⟨gi⟩+V
// drop a silent i), ⟨sc⟩→ʃ, ⟨gl⟩i→ʎ, ⟨gn⟩→ɲ, ⟨ch⟩/⟨gh⟩→k/ɡ, ⟨qu⟩→kw, i/u glides. Penultimate/accent stress
// (antepenult sdrucciole are unmarked in spelling → a documented lexical tail). See docs/investigations/it_native_bringup_investigation.md.
describe("italian canonical IPA", () => {
    test("c/g softening, digraphs (gl/gn/sc/ch/gh), qu, gemination", () => {
        const cases: [string, string][] = [
            ["casa", "kˈaza"], // intervocalic s→z (default; lexical, folded)
            ["cane", "kˈane"],
            ["gatto", "ɡˈatto"], // geminate tt (doubled)
            ["ciao", "t͡ʃˈao"], // ⟨ci⟩+V: silent i, c→t͡ʃ
            ["cielo", "t͡ʃˈelo"], // ⟨ci⟩+V silent i
            ["gioco", "d͡ʒˈoko"], // ⟨gi⟩+V silent i
            ["pesce", "pˈeʃʃe"], // ⟨sc⟩→ʃ, geminate intervocalic
            ["gnomo", "ɲˈomo"], // ⟨gn⟩→ɲ
            ["figlio", "fˈiʎʎo"], // ⟨gl⟩i→ʎ, geminate, silent i
            ["voglio", "vˈoʎʎo"],
            ["chiesa", "kjˈeza"], // ⟨ch⟩→k, i→j glide, s→z
            ["ghiaccio", "ɡjˈat͡ʃt͡ʃo"], // ⟨gh⟩→ɡ, geminate affricate
            ["acqua", "ˈakkwa"], // cq→kk, qu→kw
            ["quando", "kwˈando"], // qu→kw
            ["scuola", "skwˈola"], // ⟨sc⟩ before u → sk, u→w glide
            ["cinque", "t͡ʃˈinkwe"],
            ["gnocchi", "ɲˈokki"], // ⟨gn⟩→ɲ, cch→kk
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("glides, 7-vowel system, penultimate stress, written accent", () => {
        const cases: [string, string][] = [
            ["uomo", "wˈomo"], // u→w onglide
            ["piano", "pjˈano"], // i→j onglide
            ["buongiorno", "bwond͡ʒˈorno"],
            ["perché", "perkˈe"], // written accent → final stress
            ["città", "t͡ʃittˈa"], // accent → final stress
            ["bene", "bˈene"],
            ["amore", "amˈore"],
            ["grazie", "ɡrˈat͡sje"], // z→t͡s
            ["scherzo", "skˈert͡so"],
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("numbers (compositional, tens+unit fusion)", () => {
        expect(phonemize("1", "it")).toBe("ˈuno");
        expect(phonemize("8", "it")).toBe("ˈotto");
        expect(phonemize("21", "it")).toBe("ventˈuno"); // venti+uno fuse
        expect(phonemize("23", "it")).toBe("ventitrˈe"); // -tré accent
        expect(phonemize("28", "it")).toBe("ventˈotto"); // venti+otto fuse
        expect(phonemize("100", "it")).toBe("t͡ʃˈento");
        expect(phonemize("1000", "it")).toBe("mˈille");
        expect(phonemize("2000000", "it")).toBe("dwˈe miljˈoni");
    });

    test("running text: words + clause pause", () => {
        expect(phonemize("Il gatto mangia il pesce.", "it")).toContain(
            "ɡˈatto",
        );
        expect(phonemize("Il gatto mangia il pesce.", "it")).toContain("pˈeʃʃe");
    });
});

// ── Roman-numeral ORDINAL policy (src/languages/italian/romanOrdinals.ts) ─────────────────────────────────
// Italian reads a Roman numeral as an ORDINAL (Treccani, Enciclopedia dell'Italiano s.v. «numerali»): XIX
// secolo = diciannovesimo secolo, papa Giovanni XXIII = ventitreesimo — no switch to the cardinal above ten,
// unlike es/pt/ca. The reading is context-gated, so a BARE numeral must stay a cardinal.
describe("italian Roman-numeral ordinal policy", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal(n);

    test("century context fires the ordinal (XIX secolo → diciannovesimo secolo)", () => {
        expect(ROMAN_POLICY.ordinalAfter?.test("secolo")).toBe(true); // "XIX secolo" (dominant order)
        expect(ROMAN_POLICY.ordinalBefore?.test("secolo")).toBe(true); // "nel secolo XIX"
        expect(ord(19)).toBe("diciannovesimo");
        expect(ord(18)).toBe("diciottesimo");
        expect(phonemize("diciannovesimo secolo", "it")).toBe("dit͡ʃannovezˈimo sekˈolo");
    });

    test("regnal name before the numeral fires the ordinal (papa Giovanni XXIII)", () => {
        // The word immediately before the numeral is the NAME, not the title — so the names are the trigger.
        expect(ROMAN_POLICY.ordinalBefore?.test("giovanni")).toBe(true);
        expect(ROMAN_POLICY.ordinalBefore?.test("luigi")).toBe(true);
        expect(ord(23)).toBe("ventitreesimo"); // -tré keeps its vowel: ventitreesimo, not *ventitresimo
        expect(ord(14)).toBe("quattordicesimo");
        expect(phonemize("papa giovanni ventitreesimo", "it")).toBe("pˈapa d͡ʒovˈanni ventitreezˈimo");
    });

    test("ordinal is unbounded — XL / L / above L (anniversaries, congresses)", () => {
        expect(ord(40)).toBe("quarantesimo");
        expect(ord(50)).toBe("cinquantesimo");
        expect(ord(60)).toBe("sessantesimo");
        expect(ord(100)).toBe("centesimo");
        expect(ROMAN_POLICY.ordinalAfter?.test("anniversario")).toBe(true);
        expect(phonemize("cinquantesimo anniversario", "it")).toBe("t͡ʃinkwantezˈimo anniversˈarjo");
    });

    test("a bare numeral, with no ordinal context, stays a CARDINAL", () => {
        expect(ROMAN_POLICY.ordinalBefore?.test("il")).toBe(false);
        expect(ROMAN_POLICY.ordinalAfter?.test("anni")).toBe(false);
        expect(phonemize("xix", "it")).toBe("dit͡ʃannˈove"); // diciannove, not diciannovesimo
    });

    test("feminine heads are deliberately NOT triggered (the table is masculine)", () => {
        expect(ROMAN_POLICY.ordinalBefore?.test("elisabetta")).toBe(false); // would need *seconda*
        expect(ROMAN_POLICY.ordinalAfter?.test("guerra")).toBe(false); // would need *seconda guerra*
        expect(ROMAN_POLICY.ordinalAfter?.test("olimpiade")).toBe(false); // would need *venticinquesima*
    });
});
