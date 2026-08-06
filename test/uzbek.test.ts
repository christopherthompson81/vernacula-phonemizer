import { describe, expect, test } from "vitest";

import { normalizeUzbek } from "../src/languages/uzbek/normalize.ts";
import { ROMAN_POLICY } from "../src/languages/uzbek/romanOrdinals.ts";
import { phonemizeWord } from "../src/languages/uzbek/uzbek.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Uzbek / oʻzbekcha (uz) — Turkic, modern LATIN orthography. Uzbek is the Turkic
// outlier that LOST vowel harmony (Persian/Tajik contact), so the g2p is a flat scan with fixed letter values.
// Signature: the vowel split ⟨o⟩→[ɒ] vs ⟨oʻ⟩→[o]; digraphs sh/ch/ng + the comma-letters oʻ/gʻ; the separate
// tutuq belgisi (ʼ) → glottal [ʔ]. Validated at 91.3% vs wikipron uzb_latn + 87.1% vs kaikki (folded).
describe("Uzbek canonical IPA", () => {
    test("the vowel split ⟨o⟩→[ɒ] vs ⟨oʻ⟩→[o] (the signature)", () => {
        expect(phonemizeWord("Oʻzbekiston")).toBe("ozbekistˈɒn"); // oʻ→o, o→ɒ in one word
        expect(phonemizeWord("Toshkent")).toBe("tɒʃkˈent"); // o→ɒ, sh→ʃ
    });

    test("the comma-letters gʻ→ʁ, oʻ→o and the digraphs sh/ch/ng", () => {
        expect(phonemizeWord("gʻalaba")).toBe("ʁalabˈa"); // gʻ → ʁ (voiced uvular)
        expect(phonemizeWord("qishloq")).toBe("qiʃlˈɒq"); // sh→ʃ, q, o→ɒ
        expect(phonemizeWord("rang")).toBe("rˈaŋ"); // ng → ŋ
        expect(phonemizeWord("toʻngʻiz")).toBe("tonʁˈiz"); // n+gʻ must NOT be parsed as ng+ʻ (→ ton-ʁ, not toŋ-ʔ)
        expect(phonemizeWord("chiroyli")).toBe("t͡ʃirɒjlˈi"); // ch→t͡ʃ, y→j, o→ɒ
    });

    test("tutuq belgisi (ʼ) → glottal [ʔ], distinct from the comma-letters", () => {
        expect(phonemizeWord("sanʼat")).toBe("sanʔˈat"); // 'art' — apostrophe not after o/g → glottal
    });

    test("numbers compose (Turkic decimal — no fusion)", () => {
        expect(getPhonemizer("uz").text("11").trim()).toBe("ˈon bˈir"); // oʻn bir
        expect(getPhonemizer("uz").text("25").trim()).toBe("jiɡirmˈa bˈeʃ"); // yigirma besh
        expect(getPhonemizer("uz").text("1984").trim()).toBe("mˈiŋ toqqˈiz jˈuz saksˈɒn tˈort"); // ming toʻqqiz yuz sakson toʻrt
    });
});

// Roman-numeral ORDINAL policy (src/languages/uzbek/romanOrdinals.ts). The orthography's ordinal rule —
// cardinal + -nchi / -inchi, hyphenated after an Arabic numeral but "Rim raqamlaridan keyin chiziqcha
// yozilmaydi" — makes a Roman numeral the ordinal writing, so XIX asr is *oʻn toʻqqizinchi asr*; the spelled
// century is attested for the round value ("Yigirmanchi asr"). Uzbek lost vowel harmony, so ONE suffix shape.
describe("Uzbek roman-numeral ordinals", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal?.(n);

    test("one suffix shape: -nchi after a vowel, -inchi after a consonant", () => {
        expect(ord(1)).toBe("birinchi");
        expect(ord(4)).toBe("toʻrtinchi"); // ʻ (U+02BB) is not a vowel → consonant-final
        expect(ord(6)).toBe("oltinchi"); // vowel-final → -nchi
        expect(ord(19)).toBe("oʻn toʻqqizinchi");
        expect(ord(20)).toBe("yigirmanchi"); // the attested spelled century
        expect(ord(40)).toBe("qirqinchi");
        expect(ord(50)).toBe("ellikinchi");
        expect(ord(63)).toBe("oltmish uchinchi"); // past 50 — anniversary / congress range
        expect(ord(100)).toBe("yuzinchi");
        expect(ord(101)).toBeUndefined(); // out of range → the caller falls back to the cardinal
    });

    test("context matches the agglutinated century forms (unanchored)", () => {
        for (const w of ["asr", "asrda", "asrning", "asrlar", "asrga", "yuzyillik", "mingyillik", "sinf"])
            expect(ROMAN_POLICY.ordinalAfter?.test(w)).toBe(true);
        expect(ROMAN_POLICY.ordinalAfter?.test("aslida")).toBe(false);
    });

    test("the ordinal reading phonemizes in context", () => {
        expect(getPhonemizer("uz").text("oʻn toʻqqizinchi asr").trim()).toBe("ˈon toqqizint͡ʃˈi ˈasr");
        expect(getPhonemizer("uz").text("ellikinchi yubiley").trim()).toBe("ellikint͡ʃˈi jubilˈej");
    });

    test("a bare roman numeral still reads as a CARDINAL", () => {
        expect(getPhonemizer("uz").text("xix").trim()).toBe("ˈon toqqˈiz"); // oʻn toʻqqiz, not …toʻqqizinchi
    });
});

// TEXT NORMALIZATION (src/languages/uzbek/normalize.ts) — the pre-tokenizer pass behind #562. The defining
// rule is the corpus-verified ORDINAL: an Arabic numeral + hyphen + word IS the ordinal writing (the
// orthographic rule sourced in romanOrdinals.ts: "1991-yilning 1-sentabri"). So years, centuries, dates and
// ranks all read ordinal. Also space-grouped thousands, comma decimals, clocks, era markers, rates, units,
// percent, currency, signs and initialisms. Assertions are FULL-PIPELINE (phonemize) unless the rule is
// text→text only.
describe("Uzbek text normalization", () => {
    const ph = (s: string): string => getPhonemizer("uz").text(s).trim();

    test("text→text: the `N-word` hyphen becomes the ordinal words", () => {
        expect(normalizeUzbek("1978-yildagi")).toBe("ming toʻqqiz yuz yetmish sakkizinchi yildagi");
        expect(normalizeUzbek("190-oʻrinni")).toBe("yuz toʻqsoninchi oʻrinni"); // bare yuz, no "bir"
        expect(normalizeUzbek("16-noyabr")).toBe("oʻn oltinchi noyabr");
        expect(normalizeUzbek("7-regbi")).toBe("yetti regbi"); // rugby sevens — a sport, not an ordinal
    });

    test("text→text: space-grouped thousands de-group; era markers and abbreviations expand", () => {
        expect(normalizeUzbek("800 000 dan")).toBe("800000 dan");
        expect(normalizeUzbek("19 500 km²")).toBe("19500 km²");
        expect(normalizeUzbek("m.a. 356-yil")).toBe("miloddan avval uch yuz ellik oltinchi yil"); // the year reads ordinal too
        expect(normalizeUzbek("2 mln. yildan")).toBe("2 million yildan");
        expect(normalizeUzbek("va h.k.)")).toBe("va hokazo.)");
    });

    test("the `N-word` hyphen is the ORDINAL writing (years, centuries, dates, ranks)", () => {
        expect(ph("1978-yildagi")).toBe("mˈiŋ toqqˈiz jˈuz jetmˈiʃ sakkizint͡ʃˈi jildaɡˈi"); // …yetmish sakkizinchi
        expect(ph("15-asrda")).toBe("ˈon beʃint͡ʃˈi asrdˈa"); // oʻn beshinchi asrda
        expect(ph("16-noyabr")).toBe("ˈon ɒltint͡ʃˈi nɒjˈabr"); // oʻn oltinchi noyabr
        expect(ph("190-oʻrinni")).toBe("jˈuz toqsɒnint͡ʃˈi orinnˈi"); // bir yuz toʻqsoninchi oʻrinni
        expect(ph("7-eng yirik")).toBe("jettint͡ʃˈi ˈeŋ jirˈik"); // yettinchi eng yirik
    });

    test("the hyphen-ordinal suffix is -nchi / -inchi on the LAST word only", () => {
        expect(ph("1970-yillarning")).toBe("mˈiŋ toqqˈiz jˈuz jetmiʃint͡ʃˈi jillarnˈiŋ"); // …yetmishinchi yillar
        expect(ph("2010-yilgi")).toBe("ikkˈi mˈiŋ onint͡ʃˈi jilɡˈi"); // ikki ming oʻninchi yilgi
        expect(ph("1000-markasi")).toBe("miŋint͡ʃˈi markasˈi"); // minginchi markasi
    });

    test("space-grouped thousands de-group; the comma is a DECIMAL (vergul)", () => {
        expect(ph("400 000 ta")).toBe("tˈort jˈuz mˈiŋ tˈa"); // 400 000 → toʻrt yuz ming
        expect(ph("800 000 dan")).toBe("sakkˈiz jˈuz mˈiŋ dˈan");
        expect(ph("6,5 ballik")).toBe("ɒltˈi ʋerɡˈul bˈeʃ ballˈik"); // olti vergul besh — the word goes through the g2p
        expect(ph("1,5 million")).toBe("bˈir ʋerɡˈul bˈeʃ milliˈɒn");
        expect(ph("6,34 duymga")).toBe("ɒltˈi ʋerɡˈul ˈut͡ʃ tˈort dujmɡˈa"); // digit-by-digit after vergul
    });

    test("clocks read hour space minute, dropping :00; GMT/UTC spell out", () => {
        expect(ph("soat 11:35 da")).toBe("sɒˈat ˈon bˈir ottˈiz bˈeʃ dˈa");
        expect(ph("soat 12:00 GMT da")).toBe("sɒˈat ˈon ikkˈi ɡˈe ˈem tˈe dˈa");
        expect(ph("soat 06:30 da")).toBe("sɒˈat ɒltˈi ottˈiz dˈa");
    });

    test("era markers m.a. / m. expand; dotted abbreviations read in full", () => {
        expect(ph("m.a. 356-yil 21-iyulda")).toBe("milɒddˈan aʋʋˈal ˈut͡ʃ jˈuz ellˈik ɒltint͡ʃˈi jˈil jiɡirmˈa birint͡ʃˈi ijuldˈa");
        expect(ph("m. 1000-yillar")).toBe("milɒdˈij miŋint͡ʃˈi jillˈar"); // milodiy
        expect(ph("2 mln. yildan")).toBe("ikkˈi milliˈɒn jildˈan");
        expect(ph("va h.k.")).toBe("ʋˈa hɒkazˈɒ .");
    });

    test("percent, currency, units and rates use the corpus's own words", () => {
        expect(ph("88%")).toBe("saksˈɒn sakkˈiz fɒˈiz"); // foiz
        expect(ph("93%i ulangan")).toBe("toqsˈɒn ˈut͡ʃ fɒizˈi ulaŋˈan"); // foizi (possessive)
        expect(ph("5$ va 100$")).toBe("bˈeʃ dɒllˈar ʋˈa jˈuz dɒllˈar");
        expect(ph("7000 ¥")).toBe("jettˈi mˈiŋ ijenˈa"); // iyena
        expect(ph("70 km")).toBe("jetmˈiʃ kilɒmˈetr");
        expect(ph("35 mm")).toBe("ottˈiz bˈeʃ millimˈetr");
        expect(ph("19 500 km²")).toBe("ˈon toqqˈiz mˈiŋ bˈeʃ jˈuz kʋadrˈat kilɒmˈetr"); // kvadrat kilometr
        expect(ph("40 mil/soat")).toBe("sɒatiɡˈa qˈirq mˈil"); // soatiga … mil
        expect(ph("11 km/soat")).toBe("sɒatiɡˈa ˈon bˈir kilɒmˈetr");
    });

    test("signs read out; & joins letter names (B&B → be va be)", () => {
        expect(ph("+30°C")).toBe("pljˈus ottˈiz darad͡ʒˈa");
        expect(ph("UTC+1")).toBe("ˈu tˈe sˈe pljˈus bˈir");
        expect(ph("B&B lar")).toBe("bˈe ʋˈa bˈe lˈar");
        expect(ph("x = y")).toBe("χ tˈeŋ j");
        expect(ph("5 < 6")).toBe("bˈeʃ kit͡ʃˈik ɒltˈi");
        expect(ph("6 × 6")).toBe("ɒltˈi karrˈa ɒltˈi");
    });

    test("initialisms spell out by Uzbek letter name; AQSH stays the word [aqʃ]", () => {
        expect(ph("BMT global isish")).toBe("bˈe ˈem tˈe ɡlɒbˈal isˈiʃ"); // be em te
        expect(ph("GPS xaritasi")).toBe("ɡˈe pˈe ˈes χaritasˈi"); // ge pe es
        expect(ph("AQSH Prezidenti")).toBe("ˈaqʃ prezidentˈi"); // aqsh, one syllable
        expect(ph("T. rex")).toBe("tˈe rˈeχ"); // te rex
        expect(ph("M16 avtomatida")).toBe("ˈem ˈon ɒltˈi aʋtɒmatidˈa"); // em-sixteen
    });

    test("regnal ordinals after a proper name (Yelizaveta II → ikkinchi)", () => {
        expect(ph("Yelizaveta II hukmronligidan")).toBe("jelizaʋetˈa ikkint͡ʃˈi hukmrɒnliɡidˈan");
        expect(ph("Lealofi III ning")).toBe("lealɒfˈi ut͡ʃint͡ʃˈi nˈiŋ");
        // the comma-guard: a digit before a decimal comma stays cardinal
        expect(ph("Izmir 3,7 million")).toBe("izmˈir ˈut͡ʃ ʋerɡˈul jettˈi milliˈɒn");
        // and the guard is the genitive ONLY — a capitalized word before a clause-final number is not regnal
        expect(normalizeUzbek("Sahifa 12.")).toBe("Sahifa 12.");
    });

    test("the hyphen-ordinal is orthographic, not case-bound (16-Noyabr, 1-Mart)", () => {
        expect(normalizeUzbek("16-Noyabr")).toBe("oʻn oltinchi Noyabr");
        expect(normalizeUzbek("1-Mart")).toBe("birinchi Mart");
        expect(normalizeUzbek("1.1-Rasmga")).toBe("1 nuqta 1 Rasmga"); // the version dot still wins
    });

    test("a slashed fraction is denominator-ablative + numerator for ANY numerator", () => {
        expect(normalizeUzbek("1/5")).toBe("beshdan bir");
        expect(normalizeUzbek("3/4 qismi")).toBe("toʻrtdan uch qismi"); // not the bare cardinals *uch toʻrt*
        expect(normalizeUzbek("2/3")).toBe("uchdan ikki");
        expect(normalizeUzbek("1/2")).toBe("yarim"); // the idiom wins
        expect(normalizeUzbek("16/11/1978")).toBe("16/11/1978"); // a date is not a fraction
    });

    test("degrees name Fahrenheit; an infix + keeps its separator", () => {
        expect(ph("30°F")).toBe("ottˈiz darad͡ʒˈa fareŋˈejt");
        expect(ph("2+2")).toBe("ikkˈi pljˈus ikkˈi");
    });

    // `bortida 120–160 kubometr yonilg'i`, FUSED — and fused the other way round from `kvadrat`,
    // which the same corpus writes spaced (`783 562 kvadrat kilometerni`). Hence the per-power position
    // record: one value could not spell both. `kub`/`kubik` are ×0 here.
    test("cubed is fused where squared is spaced", () => {
        expect(getPhonemizer("uz").text("120 m³").trim()).toContain("kubɒmˈetr");
        expect(getPhonemizer("uz").text("783 562 km²").trim()).toContain("kʋadrˈat kilɒmˈetr");
    });
});
