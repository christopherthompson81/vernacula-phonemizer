import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { createGalician, phonemizeWord } from "../src/languages/galician/galician.ts";
import { galicianOrdinal, normalizeGalician } from "../src/languages/galician/normalize.ts";

// Galician (gl, galego) — Ibero-Romance (~2.4M), sister of Portuguese. A shallow near-phonemic orthography, so the
// engine reuses the Spanish shape (left-to-right scan + vowel-run glide classifier + spirantization + rule-based
// stress). The Galician-specific deltas — all derived empirically from the wikipron glg_latn_broad referee
// (human): ⟨x⟩/⟨j⟩→ʃ, ⟨g⟩→ɡ (no Castilian jota), ⟨nh⟩→ŋ, coda/pre-velar
// ⟨n⟩→ŋ, and the standard RAG distinción (⟨z⟩/⟨c+e,i⟩→θ). The 7-vowel open-mids ɛ/ɔ are lexical + unmarked in
// spelling → we emit close-mid e/o.
describe("Galician canonical IPA — Spanish-shaped Ibero-Romance engine + Galician deltas", () => {
    const gl = createGalician();

    test("⟨x⟩ = ʃ — THE Galician signature (Spanish's ks/jota is gone)", () => {
        expect(phonemizeWord("peixe")).toBe("pˈeᶦʃe"); // "fish" — x=ʃ, ei diphthong
        expect(phonemizeWord("xente")).toBe("ʃˈente"); // "people" — word-initial x=ʃ
        expect(phonemizeWord("caixa")).toBe("kˈaᶦʃa"); // "box"
        expect(phonemizeWord("baixo")).toBe("bˈaᶦʃo"); // "low/under"
    });

    test("⟨g⟩ is always the velar stop ɣ (no jota); intervocalic → spirant ɣ", () => {
        expect(phonemizeWord("galego")).toBe("ɡalˈeɣo"); // "Galician" — initial ɡ, intervocalic ɣ
        expect(phonemizeWord("xénero")).toBe("ʃˈeneɾo"); // ⟨g⟩-free but shows x=ʃ + é stress
    });

    test("⟨nh⟩ → ŋ and nasal velarization (coda / pre-velar ⟨n⟩ → ŋ)", () => {
        expect(phonemizeWord("unha")).toBe("ˈuŋa"); // ⟨nh⟩ = velar nasal
        expect(phonemizeWord("cinco")).toBe("θˈiŋko"); // ⟨n⟩ before velar → ŋ, ⟨c⟩ before i → θ
        expect(phonemizeWord("un")).toBe("ˈuŋ"); // word-final ⟨n⟩ → ŋ
    });

    test("the shared Ibero phonemes: ⟨ll⟩=ʎ, ⟨ñ⟩=ɲ, ⟨ch⟩=t͡ʃ, ⟨z/c⟩=θ, ⟨v⟩→b spirantized β", () => {
        expect(phonemizeWord("carballo")).toBe("kaɾβˈaʎo"); // ⟨ll⟩=ʎ (standard RAG), ⟨v⟩→β
        expect(phonemizeWord("ollo")).toBe("ˈoʎo"); // "eye"
        expect(phonemizeWord("mañá")).toBe("maɲˈa"); // ⟨ñ⟩=ɲ, á stress
        expect(phonemizeWord("chave")).toBe("t͡ʃˈaβe"); // ⟨ch⟩=t͡ʃ
    });

    test("⟨h⟩ silent, ⟨ou/au⟩ offglides; a falling-diphthong ending is oxytone", () => {
        expect(phonemizeWord("home")).toBe("ˈome"); // ⟨h⟩ silent
        expect(phonemizeWord("auga")).toBe("ˈaᶷɣa"); // ⟨au⟩ offglide, intervocalic ɣ
        expect(phonemizeWord("dous")).toBe("dˈoᶷs"); // ⟨ou⟩ offglide
        expect(phonemizeWord("cantou")).toBe("kantˈoᶷ"); // -ou preterite is OXYTONE (glide-final, not penult)
        expect(phonemizeWord("amei")).toBe("amˈeᶦ"); // -ei preterite oxytone
    });

    test("accented weak vowel breaks a diphthong into HIATUS (muíño→mu.í.ño), but a following weak stays offglide", () => {
        expect(phonemizeWord("muíño")).toBe("muˈiɲo"); // ⟨uí⟩ hiatus: u is its own nucleus (not the glide mwiɲo)
        expect(phonemizeWord("ruído")).toBe("ruˈiðo"); // ⟨uí⟩ hiatus
        expect(phonemizeWord("viúva")).toBe("biˈuβa"); // ⟨iú⟩ hiatus, ⟨v⟩→β
        expect(phonemizeWord("saíu")).toBe("saˈiᶷ"); // ⟨íu⟩ FOLLOWING weak stays a falling-diphthong offglide
    });

    test("the -ns plural cluster velarizes (cans→kaŋs); ⟨x⟩ before a consonant is [ks]", () => {
        expect(phonemizeWord("cans")).toBe("kˈaŋs"); // word-final -ns → ŋs
        expect(phonemizeWord("cancións")).toBe("kanθjˈoŋs"); // internal n stays, final -ns velarizes
        expect(phonemizeWord("texto")).toBe("tˈeksto"); // ⟨x⟩ before a consonant → [ks] (vs prevocalic ʃ)
    });

    test("cardinal numbers: ones 0..19 + tens with the connector 'e' (vinte e un)", () => {
        expect(gl.text("21").trim()).toBe("bˈinte e uŋ"); // vinte e un (⟨v⟩→b, final n→ŋ)
        expect(gl.text("35").trim()).toBe("tɾˈinta e θˈiŋko"); // trinta e cinco
        expect(gl.text("100").trim()).toBe("θˈeŋ"); // cen
        expect(gl.text("275").trim()).toBe("doᶷsθˈentos setˈenta e θˈiŋko"); // douscentos setenta e cinco
        expect(gl.text("1200").trim()).toBe("mˈil doᶷsθˈentos"); // mil douscentos
        expect(gl.text("3000000").trim()).toBe("tɾˈes miʎˈoŋs"); // tres millóns (-ns velarized)
        expect(gl.text("2000000000").trim()).toBe("dˈoᶷs mˈil miʎˈoŋs"); // 10⁹ = dous mil millóns (long scale)
    });

    test("clause assembly", () => {
        expect(gl.text("Bo día, Galicia!").trim()).toBe("bˈo ðˈia , ɡalˈiθja !");
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// TEXT NORMALIZATION (src/languages/galician/normalize.ts + the shared symbol tier).
//
// ⚠ THESE PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (playbook trap 13). The ordinal has a table
// branch (≤9), a composed branch (10-99), the exactly-100 branch and the out-of-range branch, and the
// corpus only ever writes the first two; the fraction has a noun branch (2, 3) and an ordinal branch (4+),
// and the corpus only writes 1/3, 2/3, 3/4, 8/9. One case from each is pinned below, several of them
// deliberately values this corpus does NOT contain.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe("galician text normalization", () => {
    const gl = createGalician();

    test("ordinal words: the irregular table, the composed tens, and the bound", () => {
        expect(galicianOrdinal(1)).toBe("primeiro");
        expect(galicianOrdinal(9)).toBe("noveno");
        expect(galicianOrdinal(10)).toBe("décimo"); // the tens table's own first entry
        expect(galicianOrdinal(28)).toBe("vixésimo oitavo"); // composed — the corpus's "o 28º do mundo"
        expect(galicianOrdinal(90)).toBe("nonaxésimo"); // the last attested tens word
        expect(galicianOrdinal(100)).toBe("centésimo");
        expect(galicianOrdinal(101)).toBeUndefined(); // the table stops where the attestation stops
        expect(galicianOrdinal(0)).toBeUndefined();
    });

    test("ordinal INDICATORS: º masculine, ª feminine, the dotted form, and the >100 strip", () => {
        expect(normalizeGalician("1º")).toBe("primeiro");
        expect(normalizeGalician("2ª")).toBe("segunda"); // feminine agreement, not a bare strip
        expect(normalizeGalician("21ª")).toBe("vixésima primeira"); // EVERY element agrees, not just the last
        expect(normalizeGalician("a 4.ª vez")).toBe("a cuarta vez"); // the DOTTED indicator the corpus writes
        expect(normalizeGalician("o 1.000º")).toBe("o 1.000"); // the digit run SPANS the grouping dot
        // ⚠ ABOVE 100 THE INDICATOR IS STRIPPED, NOT KEPT: this corpus's large `º` are kiln temperatures
        // ("entre 400º e 1300º"), so no ordinal is invented and no raw º reaches the phoneme string.
        expect(normalizeGalician("entre 400º e 1300º")).toBe("entre 400 e 1300");
        expect(gl.text("1º").trim()).toBe("pɾimˈeᶦɾo");
    });

    test("era markers, número, and the dotted abbreviation — the artifact glosses its own a.C.", () => {
        expect(normalizeGalician("1200 a. C.")).toBe("1200 antes de Cristo");
        expect(normalizeGalician("534 a.C. e")).toBe("534 antes de Cristo e");
        expect(normalizeGalician("2000 d.C.")).toBe("2000 despois de Cristo"); // despois, NOT the pt depois
        expect(normalizeGalician("a. e. c.")).toBe("antes da Era común");
        expect(normalizeGalician("n.º 5")).toBe("número 5");
        // ⚠ the bare `no` is Galician's en+o contraction and is deliberately NOT an alternative of the
        // número rule — pt's list has it, and here it would fire on every clause.
        expect(normalizeGalician("no 5 de maio")).toBe("no 5 de maio");
        expect(normalizeGalician("Dr. Silva")).toBe("doutor Silva");
        expect(normalizeGalician("etc.")).toBe("etcétera."); // clause-final: the dot IS the sentence end
    });

    test("percent, currency and the unit tier — each word attested on gl.wikipedia", () => {
        expect(gl.text("35 %").trim()).toBe("tɾˈinta e θˈiŋko poɾ θˈento");
        expect(gl.text("100 €").trim()).toBe("θˈeŋ ˈeᶷɾos");
        expect(gl.text("US$ 500").trim()).toBe("θiŋkoθˈentos ðˈolaɾes"); // the code folds to the sign
        expect(gl.text("R$ 30").trim()).toBe("tɾˈinta rˈeaᶦs");
        expect(gl.text("12,5 km").trim()).toBe("dˈoθe kˈoma θˈiŋko kilˈometɾos");
        expect(gl.text("120 km/h").trim()).toBe("θˈento βˈinte kilˈometɾos poɾ ˈoɾa");
        // ⚠ THE MAGNITUDE MUST END AT A WORD BOUNDARY. `millóns` = `millón` + `s`, and `s` is this
        // language's declared seconds unit, so the tier backtracked and read the plural marker as the
        // unit: *cinco millón SEGUNDOS de euros*. Fixed in core/normalizeSymbols.ts.
        expect(gl.text("5 millóns de euros").trim()).toBe("θˈiŋko miʎˈoŋs ðe ˈeᶷɾos");
        expect(gl.text("1 millón de km²").trim()).toBe("uŋ miʎˈoŋ de kilˈometɾos kaðɾˈaðos");
    });

    test("degrees, and the exponent that has a word against the two that do not", () => {
        expect(normalizeGalician("0 °C")).toBe("0 graos Celsius");
        expect(normalizeGalician("104,45°")).toBe("104,45 graos"); // the corpus spells this one out itself
        expect(normalizeGalician("-5°C a 600 atm")).toBe("menos 5 graos Celsius a 600 atm");
        expect(gl.text("10 km²").trim()).toBe("dˈeθ kilˈometɾos kaðɾˈaðos");
        expect(gl.text("5²").trim()).toBe("θˈiŋko ao kaðɾˈaðo"); // the BARE power, sourced ×13
        // `ao cubo` scores 0 and `elevado a` is a false attestation, so those powers stay UNREAD rather
        // than invented — the superscript survives where the RAWMARK gate can see it.
        expect(normalizeGalician("10⁻³")).toBe("10⁻³");
    });

    test("clock, and the three-field timestamp that is not one", () => {
        expect(normalizeGalician("ás 11:35")).toBe("ás once e trinta e cinco");
        expect(normalizeGalician("ás 06:00")).toBe("ás seis"); // a round hour reads no spurious "cero"
        // The launch timestamps that dominate this corpus. The colons are SPENT ON SPACES and nothing is
        // invented — but they must no longer become a clause pause inside the number.
        expect(normalizeGalician("ás 11:12:01 do martes")).toBe("ás 11 12 01 do martes");
        expect(normalizeGalician("(00:36:59)")).toBe("(00 36 59)");
    });

    test("signs — every reading named by a gl.wikipedia article, not carried over from Portuguese", () => {
        expect(normalizeGalician("3 > 0")).toBe("3 maior que 0");
        expect(normalizeGalician("2 < 5")).toBe("2 menor que 5");
        expect(normalizeGalician("a = b")).toBe("a igual a b");
        // ⚠ `dividido POR`, from "8593 dividido por 23 dá un cociente de 373" — NOT the ×19-hit
        // `dividido entre`, which is "divided between" in every one of its 19 articles.
        expect(normalizeGalician("8593 ÷ 23")).toBe("8593 dividido por 23");
        expect(normalizeGalician("±2").trim()).toBe("máis menos 2");
        expect(normalizeGalician("UTC +1")).toBe("u te ce máis 1"); // step 12 spells the initialism too
        expect(gl.text("5 × 3").trim()).toBe("θˈiŋko multiplikˈaðo poɾ tɾˈes"); // a product
        expect(gl.text("4x4").trim()).toBe("kˈatɾo poɾ kˈatɾo"); // the unspaced dimension idiom
        expect(gl.text("Thames & Hudson").trim()).toBe("tˈames e ˈuðsoŋ");
    });

    test("fractions: the noun branch, the ordinal branch, and the bound that is not a fraction", () => {
        expect(normalizeGalician("1/2")).toBe("medio"); // noun branch
        expect(normalizeGalician("1/3")).toBe("un terzo"); // the other noun — reading the ordinal gives *un terceiro*
        expect(normalizeGalician("2/3")).toBe("dous terzos");
        expect(normalizeGalician("3/4")).toBe("tres cuartos"); // ordinal branch, pluralised
        expect(normalizeGalician("8/9")).toBe("oito novenos");
        expect(normalizeGalician("1/12")).toBe("un décimo segundo"); // the composed ordinal, unattested here
        // ⚠ NOT FRACTIONS. Without the ≤12 denominator bound the treaty read *setenta e tres
        // septuaxésimo oitavos*, which is worse than the silent slash it replaced.
        expect(normalizeGalician("MARPOL 73/78")).toBe("MARPOL 73/78");
        expect(normalizeGalician("1994/1995")).toBe("1994/1995");
    });

    test("ranges read `a`, and the rule must survive a full stop (trap 58)", () => {
        expect(normalizeGalician("de 1996-1998")).toBe("de 1996 a 1998");
        expect(normalizeGalician("100–200 metros")).toBe("100 a 200 metros");
        // ⚠ CLAUSE-FINAL: a lookahead requiring a space or a word boundary after the second operand makes
        // the rule give up exactly where this corpus ends its sentences.
        expect(normalizeGalician("entre 1824–1843.")).toBe("entre 1824 a 1843.");
        expect(gl.text("de 1996-1998").trim()).toBe(
            "de mˈil noβeθˈentos noβˈenta e sˈeᶦs a mˈil noβeθˈentos noβˈenta e ˈoᶦto",
        );
    });

    test("the DOT-DECIMAL was not merely unread, it was read wrong — and grouping still is not", () => {
        // ⚠ THE ONE CLASS THIS LAYER HAD TO FIX RATHER THAN ADD. Galician groups with the dot, so an
        // English-influenced dot decimal came out MULTIPLIED: `48.26 km` was *catro mil oitocentos vinte
        // e seis quilómetros*, `(11.1%)` was *cento once por cento*.
        expect(normalizeGalician("48.26 km")).toBe("48 coma 26 km");
        expect(normalizeGalician("(11.1%)")).toBe("(11 coma 1%)");
        expect(normalizeGalician("4.2-3.9")).toBe("4 coma 2 a 3 coma 9"); // decimals BEFORE the range rule
        // …and exactly three fraction digits is still a thousands group, in every position.
        expect(normalizeGalician("460.000 km")).toBe("460.000 km");
        expect(normalizeGalician("106.460.000 km²")).toBe("106.460.000 km²");
        expect(gl.text("1.500 persoas").trim()).toBe("mˈil θiŋkoθˈentos peɾsˈoas"); // 3 digits = thousands
        expect(gl.text("299 792 458 m/s").trim()).toContain("mˈetɾos poɾ seɣˈundo"); // SI space de-grouped
    });

    test("initialisms are spelled, and a Roman century stays a CARDINAL", () => {
        expect(gl.text("EEUU").trim()).toBe("e e ˈu ˈu");
        expect(gl.text("ONU").trim()).toBe("ˈonu"); // read as a word, not spelled
        // ⚠ THROUGH `phonemize`, NOT THE RAW ENGINE, and that is the point (trap 16). The shared
        // core/roman.ts pass lives in registry.ts wrapping the engine, so a test on `createGalician()`
        // does not exercise it — this assertion FAILED that way while the real pipeline was correct.
        // `XV` is the operand rather than the corpus's `XIX` because it is vowel-less: if the initialism
        // pass in this file's step 12 ever saw it, it would spell it *xis uve*, which is exactly what the
        // raw engine does.
        expect(phonemize("século XV", "gl").trim()).toBe("sˈekulo kˈinθe");
        expect(phonemize("século XIX", "gl").trim()).toBe("sˈekulo ðeθanˈoβe"); // a century is a CARDINAL
    });
});
