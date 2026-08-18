import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { ROMAN_POLICY } from "../src/languages/spanish/romanOrdinals.ts";

// Canonical-IPA goldens for Spanish (es) — broad Castilian, rule-based (no lexicon). Convention: distinción
// (θ), lleísmo (ʎ / ʝ), spirantization (β ð ɣ), rr/r trill/tap, j/ge/gi → x, glides j/w (onset) & ᶦ/ᶷ
// (offglide). Referee: epitran spa-Latn (dialect-folded);
// vowel laxing (e→ɛ), nasal place assimilation, and secondary stress are folded to broad, matching referees.
describe("spanish canonical IPA", () => {
    test("core g2p: distinción, lleísmo, j→x, spirantization", () => {
        expect(phonemize("llave", "es")).toBe("ʎˈaβe"); // ll → ʎ, intervocalic b → β
        expect(phonemize("cielo", "es")).toBe("θjˈelo"); // c before e → θ, onglide j
        expect(phonemize("zapato", "es")).toBe("θapˈato"); // z → θ
        expect(phonemize("gente", "es")).toBe("xˈente"); // g before e → x
        expect(phonemize("agua", "es")).toBe("ˈaɣwa"); // intervocalic g → ɣ, onglide w
        expect(phonemize("verbo", "es")).toBe("bˈeɾβo"); // word-initial b stop, intervocalic b → β
    });

    test("trill vs tap, digraphs, glides", () => {
        expect(phonemize("perro", "es")).toBe("pˈero"); // rr → r (trill)
        expect(phonemize("pero", "es")).toBe("pˈeɾo"); // intervocalic r → ɾ (tap)
        expect(phonemize("rojo", "es")).toBe("rˈoxo"); // word-initial r → trill, j → x
        expect(phonemize("chico", "es")).toBe("t͡ʃˈiko"); // ch → t͡ʃ
        expect(phonemize("muy", "es")).toBe("mˈuᶦ"); // final y → offglide ᶦ
        expect(phonemize("año", "es")).toBe("ˈaɲo"); // ñ → ɲ
    });

    test("stress: written accent, penult/final rule", () => {
        expect(phonemize("España", "es")).toBe("espˈaɲa"); // ends in vowel → penult
        expect(phonemize("español", "es")).toBe("espaɲˈol"); // ends in consonant → final
        expect(phonemize("estás", "es")).toBe("estˈas"); // written accent overrides
        expect(phonemize("hola", "es")).toBe("ˈola"); // h silent
    });

    test("numbers → words → g2p", () => {
        expect(phonemize("100", "es")).toBe("θjˈen"); // cien
        expect(phonemize("101", "es")).toBe("θjˈento ˈuno"); // ciento uno
        expect(phonemize("1500", "es")).toBe("mˈil kinjˈentos"); // mil quinientos
        expect(phonemize("2000000", "es")).toBe("dˈos miʎˈones"); // dos millones
        expect(phonemize("31", "es")).toBe("tɾˈeᶦnta i ˈuno"); // treinta y uno
    });

    test("text: punctuation → pause, ¿¡ silent, function words de-accented", () => {
        expect(phonemize("Hola, ¿cómo estás?", "es")).toBe(
            "ˈola , kˈomo estˈas ?",
        );
        expect(phonemize("Me llamo Juan.", "es")).toBe("me ʎˈamo xwˈan ."); // 'me' clitic de-accented
        expect(phonemize("el gato", "es")).toBe("el ɣˈato"); // 'el' article de-accented
    });

    // Regression tests for review-caught defects.
    test("uppercase words ending in n/s stress the penult (case-insensitive rule)", () => {
        expect(phonemize("EXAMEN", "es")).toBe("eksˈamen");
        expect(phonemize("CRISIS", "es")).toBe("kɾˈisis");
    });

    test("a clause-final period/comma glued to a number stays a pause", () => {
        expect(phonemize("Son 100.", "es")).toBe("sˈon θjˈen .");
    });

    test("Spanish decimal comma reads 'coma'; oversized numbers never empty", () => {
        expect(phonemize("3,14", "es")).toBe("tɾˈes kˈoma ˈuno kwˈatɾo"); // comma = decimal
        expect(phonemize("1.500", "es")).toBe("mˈil kinjˈentos"); // dot = thousands
        expect(phonemize("1000000000000", "es")).toBe("un biʎˈon"); // 10¹² → un billón (was empty)
    });

    test("qu before a/o keeps /w/; word-initial x is /s/", () => {
        expect(phonemize("quark", "es")).toBe("kwˈaɾk"); // qua → kw (not que/qui, which silence u)
        expect(phonemize("queso", "es")).toBe("kˈeso"); // que → k (u silent)
        expect(phonemize("xenón", "es")).toBe("senˈon"); // word-initial x → s
        expect(phonemize("examen", "es")).toBe("eksˈamen"); // non-initial x → ks
    });
});

// ── Roman-numeral policy (src/languages/spanish/romanOrdinals.ts) ──
// A CENTURY IS A CARDINAL in Spanish (RAE, Ortografía, «Lectura de los números romanos»: siglo XVIII = siglo dieciocho) — the shared Roman→digits pass is already right and the policy
// must not change that. What the policy adds is the PRENOMINAL ordinal of event names, which is ordinal at ANY
// value (XL/L aniversari·o → the -ésimo / -è series), where the cardinal would be the wrong register.
describe("Spanish Roman-numeral policy — centuries cardinal, prenominal events ordinal", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal(n);

    test("a century stays a CARDINAL (the century noun is not a trigger)", () => {
        expect(ROMAN_POLICY.ordinalBefore).toBeUndefined();
        expect(ROMAN_POLICY.ordinalAfter?.test("siglo")).toBe(false);
        expect(phonemize("siglo xix", "es")).toBe('sˈiɣlo ðjeθinwˈeβe');
    });

    test("a bare numeral, with no ordinal context, stays a CARDINAL", () => {
        expect(phonemize("xix", "es")).toBe('djeθinwˈeβe');
    });

    test("prenominal event context is ordinal, and unbounded — XL / L / above L", () => {
        expect(ROMAN_POLICY.ordinalAfter?.test("aniversario")).toBe(true);
        expect(ord(40)).toBe('cuadragésimo');
        expect(ord(50)).toBe('quincuagésimo');
        expect(ord(60)).toBe('sexagésimo');
        expect(phonemize('quincuagésimo aniversario', "es")).toBe('kinkwaxˈesimo aniβeɾsˈaɾjo');
    });

    test("feminine heads are deliberately NOT triggered (the series is masculine)", () => {
        expect(ROMAN_POLICY.ordinalAfter?.test("edición")).toBe(false);
    });

    test("composed values and the year boundary", () => {
        expect(ord(25)).toBe("vigésimo quinto");
        expect(ord(100)).toBe("centésimo");
        expect(ord(1914)).toBeUndefined(); // a Roman-numeral YEAR keeps the cardinal reading
        expect(phonemize("vigésimo quinto festival", "es")).toBe("bixˈesimo kˈinto festiβˈal");
    });
});

// ── THE DOT DECIMATES TOO (src/languages/spanish/normalize.ts step 0b) ──────────────────────────────
// Spanish groups thousands with a period, and the number token reads that — but both corpora also write
// dot-DECIMALS, and the token was spanning them as groups. `2.3 millones` read as *veintitrés millones*:
// twenty-three million for two point three, silently, in a sentence that sits in the `es` mined artifact
// and the `es_419` FLEURS split alike. The three-digit test tells them apart; the comma is left alone.
describe("Spanish: the dot groups AND decimates", () => {
    test("one or two digits after the dot is a DECIMAL", () => {
        expect(phonemize("2.3 millones", "es").trim()).toContain("d\u02c8os k\u02c8oma t\u027e\u02c8es");
        expect(phonemize("6.34 pulgadas", "es").trim()).toContain("k\u02c8oma");
    });
    test("exactly three digits after the dot is still GROUPING", () => {
        expect(phonemize("17.000 islas", "es").trim()).toContain("m\u02c8il");
        expect(phonemize("1.234.567", "es").trim()).toContain("mi\u028e\u02c8on");
    });
    test("\u26a0 the COMMA is untouched — a three-place decimal must not become an integer", () => {
        expect(phonemize("3,141", "es").trim()).toContain("k\u02c8oma");
    });
    test("\u26a0 a following letter or a preceding colon blocks it", () => {
        // `802.11n` is a standard number, `2.4Ghz` a clock speed, `4:41.30` a sports time
        expect(phonemize("802.11n", "es").trim()).not.toContain("k\u02c8oma");
        expect(phonemize("2.4Ghz", "es").trim()).not.toContain("k\u02c8oma");
        expect(phonemize("4:41.30", "es").trim()).not.toContain("k\u02c8oma");
    });
    test("es-419 gets the same treatment — CLDR formats it US-style, the corpus writes both", () => {
        expect(phonemize("2.3 millones", "es-419").trim()).toContain("d\u02c8os k\u02c8oma t\u027e\u02c8es");
        expect(phonemize("17.000 islas", "es-419").trim()).toContain("m\u02c8il");
    });
});

/**
 * ⚠ SPIRANTIZATION IS POST-LEXICAL — it does not stop at the word edge.
 *
 * `spirantize()` guards on `i === 0`, which is WORD-initial, because a per-word function has no other
 * context. Its own comment says "except utterance-initial". So the identical environment was read two
 * ways depending on which side of a space it fell: `nada` → nˈaða but `la duda` → la dˈuða.
 *
 * That INTERNAL INCONSISTENCY is the defect — the engine has already committed to marking allophony.
 *
 * ⚠ VALIDATED AGAINST THE AUDIO, not just against theory. Re-scoring 1,500 FLEURS es_419 rows against
 * the wav2vec2 phones: 1,292 moved CLOSER, 36 further — 35.9 : 1, median skeleton distance
 * 0.146 → 0.103. Our `d` was being heard as [ð] in 2,278 aligned positions, 60% after a vowel.
 */
describe("spirantization crosses the word boundary", () => {
    test("after a vowel or a continuant, across a space", async () => {
        expect(await phonemize("la duda", "es-419")).toBe("la ðˈuða");
        expect(await phonemize("los datos", "es-419")).toBe("los ðˈatos");
        expect(await phonemize("la boca", "es-419")).toBe("la βˈoka");
        expect(await phonemize("la gata", "es-419")).toBe("la ɣˈata");
    });

    // the guards `spirantize()` already states, now applied across the boundary too
    test("a nasal, and /d/ after /l/, keep the STOP", async () => {
        expect(await phonemize("un dato", "es-419")).toBe("un dˈato");
        expect(await phonemize("el dato", "es-419")).toBe("el dˈato");
    });

    // ⚠ utterance-initial is still a stop — this is the case a naive rewrite gets wrong
    test("utterance-initial stays a stop", async () => {
        expect(await phonemize("datos", "es-419")).toBe("dˈatos");
        expect(await phonemize("boca", "es-419")).toBe("bˈoka");
    });

    // ⚠ CHAINING. Non-overlapping replacement must not consume the character the NEXT word needs as
    // its own left context — the Catalan version did, and `segons de vídeo` silently missed its /b/.
    test("consecutive stops all spirantize", async () => {
        expect(await phonemize("los datos de barcelona", "es-419")).toBe("los ðˈatos ðe βaɾselˈona");
    });
});
