import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/italian/italian.ts";
import { ROMAN_POLICY } from "../src/languages/italian/romanOrdinals.ts";

// Canonical-IPA goldens for Italian (it) — a shallow, near-phonemic Latin orthography, rule-based G2P. Hand-
// verified standard pronunciations, in OUR convention: close-mid default for stressed ⟨e⟩/⟨o⟩ (the /e/~/ɛ/,
// /o/~/ɔ/ openness is LEXICAL and folded in the eval), intervocalic ⟨s⟩→z default (casa/rosa lexical, folded),
// gemination as DOUBLED consonants (the referee's own convention). c/g soften to t͡ʃ/d͡ʒ before e/i (⟨ci⟩/⟨gi⟩+V
// drop a silent i), ⟨sc⟩→ʃ, ⟨gl⟩i→ʎ, ⟨gn⟩→ɲ, ⟨ch⟩/⟨gh⟩→k/ɡ, ⟨qu⟩→kw, i/u glides. Penultimate/accent stress
// (antepenult sdrucciole are unmarked in spelling → a documented lexical tail).
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

// ── TEXT NORMALIZATION (#562, src/languages/italian/normalize.ts) ─────────────────────────────────────────
// Every case below is a surface form ATTESTED in the it_it FLEURS corpus (1,978 unique cased utterances),
// with the count and the pre-change output recorded in normalize.ts's header. Assertions are on substrings
// of the phonemized output, because what these rules fix is a wrong or missing WORD, not a whole utterance.
describe("italian text normalization", () => {
    test("dot-grouped thousands are one number, not a sentence break (×52 — the largest defect)", () => {
        // Before: "19.500" → [dit͡ʃannˈove . t͡ʃinkwet͡ʃˈento] — a full clause pause inside one number.
        expect(phonemize("una superficie di 19.500 km²", "it")).toContain("dit͡ʃannovemilat͡ʃinkwet͡ʃˈento");
        expect(phonemize("una superficie di 19.500 km²", "it")).not.toContain(" . ");
        expect(phonemize("più di 5.000 lingue", "it")).toContain("t͡ʃinkwemˈila");
        expect(phonemize("attirare 5.000.000 di visitatori", "it")).toContain("t͡ʃˈinkwe miljˈoni"); // two separators
    });

    test("decimal comma is *virgola*, not a pause (×16)", () => {
        // Before: "14,7" → [kwattordˈit͡ʃi , sˈette].
        expect(phonemize("14,7 miliardi di dollari", "it")).toContain("kwattordˈit͡ʃi virɡˈola sˈette");
        // The enumeration comma, which always carries a space, must stay a pause.
        expect(phonemize("nel 1990, 1995 e 2001", "it")).toContain(" , ");
    });

    test("the decimal rewrite runs AFTER the unit tier, so number-unit adjacency survives", () => {
        // The ordering coupling the playbook names: rewriting "1,5 km/s" first would leave the symbol tier
        // looking at "5 km/s", with no number attached to the unit at all.
        expect(phonemize("una velocità di 1,5 km/s", "it"))
            .toContain("virɡˈola t͡ʃˈinkwe kilomˈetri ˈal sekˈondo");
    });

    test("clock: the colon was a pause and :00 added a spurious zero (×19)", () => {
        // Before: "11:20" → [undˈit͡ʃi , vˈenti]; "11:00" → [undˈit͡ʃi , t͡sˈero].
        expect(phonemize("Alle 11:20 la polizia", "it")).toContain("undˈit͡ʃi ˈe vˈenti");
        expect(phonemize("intorno alle 11:00 ora locale", "it")).toContain("undˈit͡ʃi ˈora");
        expect(phonemize("alle 12.00 GMT", "it")).toContain("dodˈit͡ʃi"); // the period form, cue-gated
        expect(phonemize("alle 12.00 GMT", "it")).not.toContain("t͡sˈero");
        // NOT a clock: the grade "2:2" has a one-digit minute, and 802.11a has a digit before the hour.
        expect(phonemize("classe di voto 2:2", "it")).toContain("dwˈe , dwˈe");
        expect(phonemize("retrocompatibile con 802.11a", "it")).toContain("undˈit͡ʃi");
    });

    test("percent sign was silently dropped (×18)", () => {
        expect(phonemize("il 29% degli intervistati", "it")).toContain("ventinˈove pˈer t͡ʃˈento");
    });

    test("units were read as raw letter clusters (km → [km], kg → [kɡ])", () => {
        expect(phonemize("a 120 km a nord", "it")).toContain("kilomˈetri");
        expect(phonemize("i venti a 83 km/h", "it")).toContain("kilomˈetri orˈari");
        expect(phonemize("una superficie di 3.850 km²", "it")).toContain("kilomˈetri kwadrˈati");
        expect(phonemize("un peso di 90 kg", "it")).toContain("kiloɡrˈammi");
        expect(phonemize("profonda 5 mm", "it")).toContain("millimˈetri");
        // Count agreement comes from the shared tier: 1 takes the singular.
        expect(phonemize("appena 1 km", "it")).toContain("kilomˈetro");
    });

    test("`ha` is the VERB after a number, never the hectare — all 4 corpus occurrences", () => {
        expect(phonemize("Chandrayaan-1 ha sganciato la sonda", "it")).not.toContain("ettˈar");
    });

    test("ordinal indicators: ° is the Italian masculine ordinal, º/ª leaked RAW (×8 / ×2)", () => {
        // Before: "1° gennaio" → [ˈuno d͡ʒennˈajo]; "dell'11º" → [undˈit͡ʃi º], a non-IPA character in the
        // phoneme string (U+00BA is Script=Latin, so core/clauses.ts's foreign fallback emitted it verbatim).
        expect(phonemize("a partire dal 1° gennaio", "it")).toContain("prˈimo");
        expect(phonemize("il suo 60° gol", "it")).toContain("sessantezˈimo");
        expect(phonemize("al 190° posto", "it")).toContain("t͡ʃentonovantezˈimo");
        expect(phonemize("dell'11º Reggimento", "it")).toContain("undit͡ʃezˈimo");
        expect(phonemize("dell'11º Reggimento", "it")).not.toContain("º");
        expect(phonemize("della 10ª Armata", "it")).toContain("det͡ʃˈima"); // feminine
    });

    test("the other two senses of ° are claimed first: temperature and coordinate", () => {
        expect(phonemize("oltre i 30°C", "it")).toContain("ɡrˈadi t͡ʃˈelsjuz");
        expect(phonemize("temperature pari a 90 °F", "it")).toContain("ɡrˈadi");
        expect(phonemize("a est del 35°W", "it")).toContain("ɡrˈadi ˈovest");
        expect(phonemize("a est del 35°W", "it")).not.toContain("trentat͡ʃinkwezˈimo");
    });

    test("era markers (×10) left two pauses and a letter-spelled Cristo", () => {
        // Before: "356 a.C." → [tret͡ʃentot͡ʃinkwantˈazej ˈa . k .].
        expect(phonemize("nel terzo secolo a.C., la Grande Piramide", "it")).toContain("avˈanti krˈisto");
        expect(phonemize("nel 100 d.C. circa", "it")).toContain("dˈopo krˈisto");
    });

    test("dotted abbreviations, boundary-checked against the false positives", () => {
        expect(phonemize("il dott. Damadian", "it")).toContain("dˈottor");
        expect(phonemize("noci, pietanze, ecc. offerti", "it")).toContain("et͡ʃt͡ʃetˈera");
        expect(phonemize("ad es. nei Paesi Bassi", "it")).toContain("ezˈempjo");
        expect(phonemize("cosmonauta n. 11", "it")).toContain("numˈero"); // only before a digit
        expect(phonemize("pag. 12 dell'art. 5", "it")).toContain("pad͡ʒˈina"); // a DIGIT may follow, not just a letter
        // `ca.` ×47 and `n.` ×26 in a naive count are word-final letters before a sentence period. They must
        // survive as the sentence end they are.
        expect(phonemize("una scoperta storica.", "it")).toContain("storˈika");
        expect(phonemize("una scoperta storica.", "it")).not.toContain("t͡ʃˈirka");
    });

    test("initialisms: no layer existed, so unpronounceable runs reached the g2p raw (×127)", () => {
        // Before: FBI → [fbˈi], DNA → [dnˈa], USB → [ˈuzb], NHK → [nk] with the H silently DROPPED.
        expect(phonemize("dell'FBI", "it")).toContain("ˈeffe bˈi ˈi");
        expect(phonemize("il DNA del batteriofago", "it")).toContain("dˈi ˈenne ˈa");
        expect(phonemize("il telecomando della TV", "it")).toContain("tˈi vˈu"); // tivù
        expect(phonemize("NHK ha riferito", "it")).toContain("ˈenne ˈakka kˈappa");
        // Attached to digits — no word boundary for the letters, so they came out as a cluster.
        expect(phonemize("il fucile M16", "it")).toContain("ˈemme sedˈit͡ʃi");
        expect(phonemize("il ceppo H5N1", "it")).toContain("ˈakka t͡ʃˈinkwe ˈenne ˈuno");
        // Pronounceable acronyms are left to the OOV g2p, which already reads them as Italian words.
        expect(phonemize("la NASA e l'OPEC", "it")).toContain("nˈaza");
        expect(phonemize("la NASA e l'OPEC", "it")).toContain("ˈopek");
        // A Roman numeral the shared pass declined must not become letters.
        expect(phonemize("nel XI secolo", "it")).not.toContain("ˈiks");
    });

    test("currency signs were dropped (×5, all POSTPOSED in the corpus)", () => {
        expect(phonemize("banconote da 5 $", "it")).toContain("dollˈari");
        expect(phonemize("tra 2.500 ¥ e 130.000 ¥", "it")).toContain("jˈen");
        // The preposed form needs the partitive *di* the shared magnitude hop cannot insert.
        expect(phonemize("$5 milioni", "it")).toContain("miljˈoni dˈi dollˈari");
        expect(phonemize("$5 milioni di dollari", "it")).toBe(phonemize("5 milioni di dollari", "it"));
    });

    test("fractions and signs", () => {
        expect(phonemize("5 mm (1/5 di pollice)", "it")).toContain("ˈun kwˈinto");
        expect(phonemize("ora locale (UTC+1)", "it")).toContain("pjˈu ˈuno");
        expect(phonemize("-15 gradi", "it")).toContain("mˈeno");
        // Ranges keep the bare juxtaposition; the minus rule must not claim them.
        expect(phonemize("tra il 1894-1895", "it")).not.toContain("mˈeno");
        expect(phonemize("vittoria contro lo Zambia (26 - 00)", "it")).not.toContain("mˈeno");
    });

    test("#586 the plus as a WORD-JOINER, and the exponent across a magnitude", () => {
        // `volo+hotel` is the only `+` in the corpus and it is not arithmetic — no digit on either side, so
        // every digit-keyed rule from the signed-number sweep was blind to it. MMS-1b-all (`ita`) on the
        // it_it speaker: "pacchetti combinati vol o piu hotel".
        expect(phonemize("pacchetti combinati volo+hotel", "it")).toContain("vˈolo pjˈu ˈotel");
        // The numeric pluses must be untouched by that rule — it is letter-keyed on BOTH sides.
        expect(phonemize("ora locale (UTC+1)", "it")).toContain("pjˈu ˈuno");
        expect(phonemize("una temperatura di +30 °C", "it")).toContain("pjˈu trˈenta");
        // `magnitudes` was withheld to protect the CURRENCY path and thereby broke the UNIT path: the tier
        // could not cross `milioni di` to reach the unit, so the exponent dropped AND `km` leaked raw.
        expect(phonemize("una superficie di 2,2 milioni di km²", "it")).toContain("miljˈoni dˈi kilomˈetri kwadrˈati");
        expect(phonemize("una superficie di 2,2 milioni di km²", "it")).not.toMatch(/km/u);
        // The adjacent shape must not regress.
        expect(phonemize("19.500 km²", "it")).toContain("kilomˈetri kwadrˈati");
    });
});
