/**
 * es-419 (Latin-American / "neutral" Spanish) accent DIAGNOSTIC GOLD — the quality anchor. es-419 = the
 * Castilian `es` engine + two categorical, pan-American mergers (seseo θ→s, yeísmo ʎ→ʝ). The referee number
 * (92.6% vs wikipron spa_latn_la, matching the es parent's 92.5%) is NOT the story — the residual is entirely
 * inherited coda-obstruent-voicing allophony (shared with es). This gold verifies the two mergers are exact on
 * the vocabulary that distinguishes Latin-American from Castilian.
 *
 * NOT included (shared-es lexical exception): ⟨x⟩=[x] in Nahuatl-origin names (México→[ˈmexiko]) — the es engine
 * gives [ks] in both dialects, a shared gap, not es-419-specific.
 */
import { describe, expect, it, test } from "vitest";
import { phonemizeWord } from "../src/languages/spanish-419/spanish-419.ts";
import { phonemize } from "../src/index.ts";
import { ROMAN_POLICY as ES_POLICY } from "../src/languages/spanish/romanOrdinals.ts";
import { ROMAN_POLICY } from "../src/languages/spanish-419/romanOrdinals.ts";

const GOLD: [string, string][] = [
    // SESEO — ⟨c⟩ before e/i and ⟨z⟩ → [s] (Castilian [θ])
    ["cielo", "sjˈelo"], ["cena", "sˈena"], ["cinco", "sˈinko"], ["zapato", "sapˈato"], ["zorro", "sˈoro"],
    ["azúcar", "asˈukaɾ"], ["cabeza", "kaβˈesa"], ["cerveza", "seɾβˈesa"], ["corazón", "koɾasˈon"],
    ["gracias", "ɡɾˈasjas"], ["ciudad", "sjuðˈað"], ["plaza", "plˈasa"], ["luz", "lˈus"],
    // YEÍSMO — ⟨ll⟩ → [ʝ], merging with ⟨y⟩ (Castilian [ʎ])
    ["calle", "kˈaʝe"], ["llave", "ʝˈaβe"], ["llamar", "ʝamˈaɾ"], ["pollo", "pˈoʝo"], ["caballo", "kaβˈaʝo"],
    ["ella", "ˈeʝa"], ["yo", "ʝˈo"], ["yema", "ʝˈema"], ["mayo", "mˈaʝo"], ["ayer", "aʝˈeɾ"], ["playa", "plˈaʝa"],
    // unchanged from Castilian (no θ/ʎ) — sanity that the rest of the engine is intact
    ["casa", "kˈasa"], ["perro", "pˈero"], ["gato", "ɡˈato"], ["agua", "ˈaɣwa"], ["españa", "espˈaɲa"],
    ["niño", "nˈiɲo"], ["español", "espaɲˈol"], ["mujer", "muxˈeɾ"], ["gente", "xˈente"], ["jamón", "xamˈon"],
];

describe("es-419 (Latin-American) seseo + yeísmo", () => {
    for (const [word, ipa] of GOLD) {
        it(`${word} → ${ipa}`, () => {
            expect(phonemizeWord(word)).toBe(ipa);
        });
    }
});

// ── Roman-numeral policy (src/languages/spanish-419/romanOrdinals.ts) ──
// A CENTURY IS A CARDINAL in es-419 (the RAE Ortografía is co-published with ASALE, so the pan-Hispanic reading applies) — the shared Roman→digits pass is already right and the policy
// must not change that. What the policy adds is the PRENOMINAL ordinal of event names, which is ordinal at ANY
// value (XL/L aniversari·o → the -ésimo / -è series), where the cardinal would be the wrong register.
describe("es-419 Roman-numeral policy — centuries cardinal, prenominal events ordinal", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal(n);

    test("a century stays a CARDINAL (the century noun is not a trigger)", () => {
        expect(ROMAN_POLICY.ordinalBefore).toBeUndefined();
        expect(ROMAN_POLICY.ordinalAfter?.test("siglo")).toBe(false);
        expect(phonemize("siglo xix", "es-419")).toBe('sˈiɣlo djesinwˈeβe');
    });

    test("a bare numeral, with no ordinal context, stays a CARDINAL", () => {
        expect(phonemize("xix", "es-419")).toBe('djesinwˈeβe');
    });

    test("prenominal event context is ordinal, and unbounded — XL / L / above L", () => {
        expect(ROMAN_POLICY.ordinalAfter?.test("aniversario")).toBe(true);
        expect(ord(40)).toBe('cuadragésimo');
        expect(ord(50)).toBe('quincuagésimo');
        expect(ord(60)).toBe('sexagésimo');
        expect(phonemize('quincuagésimo aniversario', "es-419")).toBe('kinkwaxˈesimo aniβeɾsˈaɾjo');
    });

    test("feminine heads are deliberately NOT triggered (the series is masculine)", () => {
        expect(ROMAN_POLICY.ordinalAfter?.test("edición")).toBe(false);
    });

    test("es-419 re-exports the es policy verbatim (no drift)", () => {
        expect(ROMAN_POLICY).toBe(ES_POLICY);
    });
});

// text normalization (spanish/normalize.ts) — the third language to get the treatment, after English
// and French. Asserted on es-419 because that is the locale of the FLEURS audio these were measured
// against; the layer itself is shared with Castilian `es` apart from the date rule below.
describe("spanish normalization", () => {
    test("abbreviations, with EE.UU. claimed first", () => {
        // EE.UU. is the most frequent abbreviation in the corpus (×31) and expands to WORDS. Claimed before
        // the generic dotted rule, which saw two abbreviations and left "ee . uu ." with two pauses.
        expect(phonemize("EE.UU.", "es-419")).toBe("estˈaðos unˈiðos");
        expect(phonemize("los EE. UU.", "es-419")).toBe("los estˈaðos unˈiðos"); // the spaced form, as written
        expect(phonemize("el Dr. García", "es-419")).toBe("el doktˈoɾ ɡaɾsˈia"); // was the cluster [dɾ] + a pause
        expect(phonemize("etc.", "es-419")).toBe("etsˈeteɾa ."); // sentence-final dot kept
        // Era markers run before the generic rule, or the bare "a." is claimed first. Usually spaced.
        expect(phonemize("356 a. C.", "es-419")).toBe("tɾessjˈentos sinkwˈenta i sˈeᶦs ˈantes de kɾˈisto");
        expect(phonemize("el año 33 d.C.", "es-419")).toBe("el ˈaɲo tɾˈeᶦnta i tɾˈes despwˈes de kɾˈisto");
        // Read as letter names in Spanish, and the interior dots were two more phrase breaks.
        expect(phonemize("a las 10:08 p. m.", "es-419")).toBe("a las djˈes ˈot͡ʃo pˈe ˈeme");
        // n.º — n + period + the ORDINAL INDICATOR — is the form that occurs, and it left a bare º.
        expect(phonemize("el cosmonauta n.º 11", "es-419")).toBe("el kosmonˈaᶷta nˈumeɾo ˈonse");
    });

    test("times: the colon was a phrase break, and hora is feminine", () => {
        expect(phonemize("a las 11:00", "es-419")).toBe("a las ˈonse"); // was "once , cero" — pause + cero
        expect(phonemize("a la 1:15", "es-419")).toBe("a la ˈuna kˈinse"); // UNA, not uno
    });

    test("ordinal indicators no longer leak, and ° is not one of them", () => {
        // º/ª were reaching the phoneme string RAW — a non-IPA character in the output.
        expect(phonemize("el 1º de mayo", "es-419")).toBe("el pɾimˈeɾo de mˈaʝo");
        expect(phonemize("la 1ª vez", "es-419")).toBe("la pɾimˈeɾa bˈes"); // feminine
        expect(phonemize("el 3er piso", "es-419")).toBe("el teɾsˈeɾ pˈiso"); // apocopated before the noun
        // ° (U+00B0) is DEGREES, not an ordinal indicator; treating it as one read these as ordinals.
        expect(phonemize("20 °C", "es-419")).toBe("bˈeᶦnte ɡɾˈaðos sˈelsjus");
        expect(phonemize("35°", "es-419")).toBe("tɾˈeᶦnta i sˈinko ɡɾˈaðos");
    });

    test("initialisms: unpronounceable letter strings are spelled out", () => {
        expect(phonemize("un CD", "es-419")).toBe("un sˈe de"); // was [kð]
        expect(phonemize("el ADN", "es-419")).toBe("el a de ˈene"); // was [aðn]
        expect(phonemize("la AOL", "es-419")).toBe("la a o ˈele"); // lexically listed: pronounceable but spelled
        // ...while a lexicalized acronym stays a word, and a Roman numeral is claimed upstream.
        expect(phonemize("la ONU", "es-419")).toBe("la ˈonu");
        expect(phonemize("la UNESCO", "es-419")).toBe("la unˈesko");
        expect(phonemize("el siglo XV", "es-419")).toBe("el sˈiɣlo kˈinse"); // cardinal, per RAE
    });

    test("grouping, units, fractions and signs", () => {
        expect(phonemize("5 000 años", "es-419")).toBe("sˈinko mˈil ˈaɲos"); // was "cinco cero años"
        expect(phonemize("120 km/h", "es-419")).toBe("sjˈento bˈeᶦnte kilˈometɾos poɾ ˈoɾa"); // /h was dropped
        expect(phonemize("83 m", "es-419")).toBe("ot͡ʃˈenta i tɾˈes mˈetɾos"); // was the letter name
        expect(phonemize("90 °F", "es-419")).toBe("noβˈenta ɡɾˈaðos faɾenˈeᶦt");
        expect(phonemize("1/5", "es-419")).toBe("un kˈinto"); // apocopated numerator
        expect(phonemize("2/5", "es-419")).toBe("dˈos kˈintos");
        // A dropped sign is silent content loss, and on a temperature it inverts the meaning.
        expect(phonemize("+3 grados", "es-419")).toBe("mˈas tɾˈes ɡɾˈaðos");
        expect(phonemize("-5 grados", "es-419")).toBe("mˈenos sˈinko ɡɾˈaðos");
    });

    test("the first of the month is the one variety-specific rule", () => {
        // RAE, Diccionario panhispánico de dudas s.v. «fecha»: the ordinal *primero* in America, the
        // cardinal *uno* in Spain. Every other day is a cardinal in both.
        expect(phonemize("el 1 de enero", "es-419")).toBe("el pɾimˈeɾo de enˈeɾo");
        expect(phonemize("el 1 de enero", "es")).toBe("el ˈuno de enˈeɾo");
        expect(phonemize("el 17 de septiembre", "es-419")).toBe("el djesisjˈete de septjˈembɾe");
    });
});
