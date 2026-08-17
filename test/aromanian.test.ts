import { describe, expect, test } from "vitest";

import { createAromanian, phonemizeWord } from "../src/languages/aromanian/aromanian.ts";
import { numberToWords } from "../src/languages/aromanian/numbers.ts";
import { normalizeAromanian } from "../src/languages/aromanian/normalize.ts";
import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Aromanian (rup) — armãneashti, an Eastern (Balkan) Romance sibling of Romanian, the Cunia
// Latin orthography. Signatures: the Aromanian DIGRAPHS ⟨ts⟩→[t͡s], ⟨dz⟩→[d͡z], ⟨sh⟩→[ʃ], ⟨nj⟩→[ɲ], ⟨lj⟩→[ʎ],
// ⟨dh⟩→[ð], ⟨th⟩→[θ]; ⟨ã⟩→[ə]; the shared Romance c/g softening + rising diphthongs ⟨ea⟩→[e̯a], ⟨oa⟩→[o̯a] + the
// word-final ⟨-u⟩ desyllabification. Referee: wikipron rup narrow + kaikki.
describe("Aromanian (armãneashti) canonical IPA", () => {
    const rup = createAromanian();

    test("the Aromanian digraphs ⟨ts dz sh nj lj dh th⟩", () => {
        expect(phonemizeWord("tsintsi")).toBe("t͡sint͡si"); // 'five' — ⟨ts⟩→[t͡s]
        expect(phonemizeWord("dzatsi")).toBe("d͡zat͡si"); // 'ten' — ⟨dz⟩→[d͡z]
        expect(phonemizeWord("njic")).toBe("ɲik"); // 'small' — ⟨nj⟩→[ɲ]
        expect(phonemizeWord("oclju")).toBe("okʎu"); // 'eye' — ⟨lj⟩→[ʎ]
        expect(phonemizeWord("cathi")).toBe("kaθi"); // 'each' — ⟨th⟩→[θ]
        expect(phonemizeWord("dhoarã")).toBe("ðo̯arə"); // ⟨dh⟩→[ð]; ⟨oa⟩→[o̯a]; ⟨ã⟩→[ə]
    });

    test("⟨ã⟩→[ə], the rising diphthongs ⟨ea oa⟩, and the endonym", () => {
        expect(phonemizeWord("armãneashti")).toBe("arməne̯aʃti"); // 'Aromanian' — ⟨ã⟩→[ə], ⟨ea⟩→[e̯a], ⟨sh⟩→[ʃ]
        expect(phonemizeWord("noaptea")).toBe("no̯apte̯a"); // 'the night' — ⟨oa⟩→[o̯a], ⟨ea⟩→[e̯a]
        expect(phonemizeWord("limba")).toBe("limba"); // 'the tongue/language'
    });

    test("Romance c/g softening + the word-final ⟨-u⟩ desyllabification", () => {
        expect(phonemizeWord("Crãciun")).toBe("krət͡ʃun"); // 'Christmas' — ⟨ci⟩→[t͡ʃ] (silent softener i)
        expect(phonemizeWord("ghine")).toBe("ɡine"); // 'well' — ⟨gh⟩→[ɡ] (matches 2/3 of the referee; the ɣ~ɡ fold covers the rest)
        expect(phonemizeWord("cãntãtor")).toBe("kəntətor"); // 'singer' — ⟨ã⟩→[ə]
        expect(phonemizeWord("acatsu")).toBe("akat͡s"); // final ⟨-u⟩ after a single consonant → desyllabified (dropped)
        expect(phonemizeWord("amintu")).toBe("amintu"); // final ⟨-u⟩ after a CLUSTER (nt) stays syllabic [u]
    });

    test("⟨y⟩→[ɣ] (Greek gamma), and ⟨ndz⟩→[ndʒ] (the soft-g reflex)", () => {
        expect(phonemizeWord("anyedz")).toBe("anɣed͡z"); // ⟨y⟩ → [ɣ] (the Greek-gamma letter, NOT the glide [j])
        expect(phonemizeWord("sãndze")).toBe("sənd͡ʒe"); // ⟨ndz⟩ before a front vowel → [ndʒ] (Latin *sanguine*)
        expect(phonemizeWord("dzinire")).toBe("d͡zinire"); // plain ⟨dz⟩ (no preceding n) stays [d͡z]
    });

    // NUMBERS — Balkan Romance with its CONTACT vocabulary: 20 ⟨yinghits⟩ (opaque, where Romanian rebuilt
    // douăzeci), 100 ⟨sutã⟩ (the Slavic loan, not a *centum* reflex), 1000 ⟨njilji⟩. 21–29 fuse the ⟨-sprã-⟩
    // "over" infix over ⟨yinghits⟩; 31–99 take the ⟨shi⟩ connector. Sources cited in aromanian/numbers.ts.
    test("numbers: units, the fused twenties, the ⟨shi⟩ connector, hundreds, thousands, millions", () => {
        expect(numberToWords(7)).toBe("shapti");
        expect(numberToWords(16)).toBe("shasprãdzatsi"); // the ⟨-sprã-dzatsi⟩ over-ten series
        expect(numberToWords(20)).toBe("yinghits"); // the opaque Latin *vīgintī* reflex
        expect(numberToWords(21)).toBe("unsprãyinghits"); // one-over-TWENTY, fused (no connector)
        expect(numberToWords(31)).toBe("treidzãts shi unu"); // 30+ take ⟨shi⟩
        expect(numberToWords(100)).toBe("unã sutã"); // the Slavic ⟨sutã⟩
        expect(numberToWords(555)).toBe("tsintsi suti tsindzãts shi tsintsi");
        expect(numberToWords(12345)).toBe("dosprãdzatsi njilj trei suti patrudzãts shi tsintsi");
        expect(numberToWords(1000000)).toBe("unã miliunã");
        expect(numberToWords(1000000000)).toBe("unã njilji miliunj"); // Cunia's own gloss: a thousand millions
    });

    test("numbers: the magnitude nouns are FEMININE, so 2 agrees as ⟨dau⟩", () => {
        expect(numberToWords(2)).toBe("doi"); // bare 2 — masculine
        expect(numberToWords(200)).toBe("dau suti"); // feminine before sutã
        expect(numberToWords(2000)).toBe("dau njilj"); // feminine before njilji
        expect(numberToWords(2000000)).toBe("dau miliunj"); // feminine before miliunã
    });

    test("numbers read through the g2p", () => {
        expect(rup.text("21").trim()).toBe("unsprəɣinɡit͡s"); // ⟨ã⟩→ə, ⟨y⟩→ɣ (Greek gamma), ⟨ts⟩→t͡s
        expect(rup.text("100").trim()).toBe("unə sutə");
    });
});

// ── TEXT NORMALIZATION (src/languages/aromanian/normalize.ts) ───────────────────────────────────────
// The argument for every case is in the normalizer's own header. This layer replaced the corpus-independent
// `separatorHygiene` pass once roa-rup.wikipedia was mined — rup is the one residual language that had a
// usable wiki, and the mining is what let the ambiguous single group finally be decided.
describe("Aromanian text normalization", () => {
    test("\u26a0 ALL FOUR CONVENTIONS — the same mark groups AND decimates, one clause apart", () => {
        // "Ari unã populatsie di 206,235 (2004) shi unã suprafatsã di 111,2 km2"
        expect(normalizeAromanian("206,235")).toBe("206235");
        expect(normalizeAromanian("111,2")).toBe("111 2");
        // "numirlu a populatsiiljei eara 22.834 (77%) Machidonj, 5.798 (19,5%) Turtsã"
        expect(normalizeAromanian("22.834")).toBe("22834");
        expect(normalizeAromanian("0.48")).toBe("0 48");
        expect(normalizeAromanian("10,600,000")).toBe("10600000");
        expect(normalizeAromanian("216 061")).toBe("216061"); // the space groups too
        // \u26a0 trap 58 — a clause mark after the figure keeps both the number and the pause
        expect(normalizeAromanian("52.360 b\u00e3n\u00e3tori.")).toBe("52360 b\u00e3n\u00e3tori.");
    });

    test("\u26a0 the dotted DATE is taken before the decimal arm would claim it", () => {
        expect(normalizeAromanian("23.12.1951")).toBe("23 12 1951");
        expect(normalizeAromanian("16.04.1959")).toBe("16 04 1959");
    });

    test("the era, in both spacings, with the forms the wiki actually writes", () => {
        // `ninti` not `nãinti` (×34 vs ×12); `dupu` not `dupã` (×56 vs ×22) — both quoted, not constructed
        expect(normalizeAromanian("287 n.Hr.")).toBe("287 ninti di Hristo.");
        expect(normalizeAromanian("356 n. Hr. \u2013 323 d.Hr.")).toBe("356 ninti di Hristo, 323 dupu Hristo.");
    });

    test("\u26a0 the en-dash span is claimed BEFORE the era step, while the dot is still on its left", () => {
        expect(normalizeAromanian("287 n.Hr. \u2013212 d.Hr.")).toBe("287 ninti di Hristo, 212 dupu Hristo.");
        expect(normalizeAromanian("1904 \u2014 1905")).toBe("1904, 1905");
    });

    test("the dotted abbreviations, and \u26a0 the guard that is a sentence end and not a following word", () => {
        // the corpus's commonest instance has a BRACKET after the dot: "216 061 bãn. (2002)"
        expect(normalizeAromanian("216 061 b\u00e3n. (2002)")).toBe("216061 b\u00e3n\u00e3tori (2002)");
        expect(normalizeAromanian("Ledzea nr. 53")).toBe("Ledzea numir 53");
        expect(normalizeAromanian("(gr. \u03b3\u03bb\u03c9\u03c3\u03c3\u03bf\u03bb\u03bf\u03b3\u03af\u03b1)")).toBe("(gr\u00e3tseasc\u00e3 \u03b3\u03bb\u03c9\u03c3\u03c3\u03bf\u03bb\u03bf\u03b3\u03af\u03b1)");
    });

    test("\u26a0 the colon is NEVER a clock here — 28 instances, all the population template", () => {
        expect(normalizeAromanian("sh-tu 2001: 52.116")).toBe("sh-tu 2001: 52116");
    });

    test("the whole pipeline: the percent phrase the corpus glosses, and the `di` particle", () => {
        expect(phonemize("0.48%", "rup").trim()).toContain("la sut\u0259");
        expect(phonemize("19,1 la sut\u00e3", "rup").trim()).toContain("la sut\u0259");
        // \u26a0 `18 di km` — the particle sits between the figure and the unit, so the tier cannot bridge it
        expect(phonemize("18 di km", "rup").trim()).toContain("kilometru");
        expect(phonemize("6650 km", "rup").trim()).toContain("kilometru");
    });
});
