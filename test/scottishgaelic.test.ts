import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { numberToWords, phonemizeWord } from "../src/languages/scottishgaelic/scottishgaelic.ts";
import { normalizeScottishGaelic } from "../src/languages/scottishgaelic/normalize.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Scottish Gaelic / Gàidhlig (gd) — Goidelic Celtic (sibling of Irish). The core is the
// BROAD/SLENDER axis (velarized/dental next to a/o/u, palatalized next to e/i) + the Scottish hallmarks:
// PRE-ASPIRATION (medial ⟨p t c⟩→[hp ht̪ xk]) and lenis ⟨b d g⟩→[p t̪ k]. Referee: symbol vs the
// MULTI-DIALECT wikipron gla_latn_broad (human, 6000; the folded % is a multi-dialect artifact).
describe("Scottish Gaelic (Gàidhlig) canonical IPA", () => {
    test("PRE-ASPIRATION: medial/final ⟨p t c⟩ → [hp ht̪ xk]", () => {
        expect(phonemizeWord("mac")).toBe("mˈaxk"); // medial ⟨c⟩ pre-aspirates to [xk] (the SG signature)
        expect(phonemizeWord("cat")).toBe("kʰˈaht̪"); // initial ⟨c⟩→[kʰ] aspirated; final ⟨t⟩→[ht̪] pre-aspirated
        expect(phonemizeWord("cù")).toBe("kʰˈuː"); // initial fortis ⟨c⟩→[kʰ]; ù→[uː]
        expect(phonemizeWord("bochd")).toBe("pˈɔxk"); // ⟨chd⟩ → [xk] (the -achd class)
        expect(phonemizeWord("annta")).toBe("ˈan̪ˠt̪ə"); // NO pre-aspiration after a nasal (the fortis stays plain)
    });

    test("broad/slender axis + lenis ⟨b d g⟩→[p t̪ k] + lenition", () => {
        expect(phonemizeWord("geal")).toBe("kʲˈɛl̪ˠ"); // slender ⟨g⟩→[kʲ] (lenis); broad ⟨l⟩→[l̪ˠ]
        expect(phonemizeWord("balach")).toBe("pˈal̪ˠəx"); // lenis ⟨b⟩→[p]; ⟨ch⟩→[x]; unstressed a→[ə]
        expect(phonemizeWord("sgoil")).toBe("s̪kˈɔlʲ"); // broad ⟨s⟩→[s̪], ⟨g⟩→[k]; slender ⟨l⟩→[lʲ]
        expect(phonemizeWord("uisge")).toBe("ˈuʃkʲə"); // slender ⟨s⟩→[ʃ], ⟨g⟩→[kʲ]
    });

    test("vowels + lenition ⟨ch th⟩", () => {
        expect(phonemizeWord("mòr")).toBe("mˈɔːrˠ"); // ò→[ɔː]; broad ⟨r⟩→[rˠ]
        expect(phonemizeWord("each")).toBe("ˈɛx"); // ⟨ea⟩→[ɛ]; ⟨ch⟩→[x]
        expect(phonemizeWord("math")).toBe("mˈah"); // ⟨th⟩→[h]
    });

    test("registry wiring", () => {
        expect(getPhonemizer("gd").text("mac").trim()).toBe("mˈaxk");
    });
});

// CARDINAL NUMBERS (src/languages/scottishgaelic/numbers.ts). Source: Colin Mark, *The Gaelic-English
// Dictionary* (2003), the numeral headwords + the decimal-tens series. The Goidelic shape mirrors Irish (two
// numeral series, the ⟨a⟩ particle, h- before a vowel, ⟨deug⟩ lenited after dhà) but Gaelic mutation is
// LENITION ONLY — ⟨dà⟩ lenites the magnitude it counts (dà cheud) and 3–10 leave it BARE (naoi ceud), where
// Irish would eclipse (naoi gcéad). The MODERN DECIMAL tens are used, not the traditional vigesimal series.
describe("Scottish Gaelic numbers", () => {
    for (const [n, expected] of [
        [0, "neoni"],                            // bare zero takes no ⟨a⟩ particle
        [1, "a h-aon"],                          // h- before the vowel-initial counting form
        [2, "a dhà"],                            // the counting form is itself lenited (attributive: dà)
        [8, "a h-ochd"],
        [11, "a h-aon deug"],
        [12, "a dhà dheug"],                     // ⟨deug⟩ lenites after dhà ONLY
        [13, "a trì deug"],
        [20, "fichead"],
        [21, "fichead agus a h-aon"],            // the tens↔units connector (written ⟨'s⟩, emitted as ⟨agus⟩)
        [25, "fichead agus a còig"],
        [40, "ceathrad"],                        // DECIMAL 40, not the vigesimal ⟨dà fhichead⟩
        [42, "ceathrad agus a dhà"],
        [99, "naochad agus a naoi"],
        [100, "ceud"],                           // bare magnitude — no ⟨aon⟩
        [101, "ceud agus a h-aon"],
        [200, "dà cheud"],                       // ⟨dà⟩ LENITES: ceud → cheud
        [300, "trì ceud"],                       // 3–10 leave the magnitude BARE
        [900, "naoi ceud"],                      // NO ECLIPSIS (Irish: naoi gcéad) — the gd/ga divergence
        [1000, "mìle"],
        [2000, "dà mhìle"],                      // mìle → mhìle after dà
        [1009, "mìle agus a naoi"],              // connector before a bare counting remainder
        [1998, "mìle naoi ceud naochad agus a h-ochd"],
        [1000000, "muillean"],
        [1000000000, "billean"],
    ] as const) {
        test(`${n} → ${expected}`, () => expect(numberToWords(n)).toBe(expected));
    }

    test("no digit leak, sentinel or gap across 0..20000", () => {
        for (let n = 0; n <= 20000; n++) expect(numberToWords(n), `n=${n}`).not.toMatch(/undefined|NaN|[0-9]/u);
    });

    test("end-to-end: the numeral is phonemized, not spelled out digit-wise", () => {
        expect(phonemize("21", "gd")).toBe("fˈiçət̪ ˈakəs̪ ˈa hˈɯːn̪ˠ"); // fichead agus a h-aon
        expect(phonemize("40", "gd")).toBe("kʲʰˈɛhrˠət̪"); // ceathrad — the DECIMAL forty
        expect(phonemize("2000", "gd")).toBe("t̪ˈaː vˈiːlʲə"); // dà mhìle — the lenited magnitude
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// TEXT NORMALIZATION (src/languages/scottishgaelic/normalize.ts + the shared symbol tier).
// ⚠ THESE PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (playbook trap 13) — and for the ordinal the
// branch that matters is the CIRCUMFIX, which the corpus exercises with only four of its nine values.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe("scottish gaelic text normalization", () => {
    const gd = { text: (s: string) => phonemize(s, "gd") };

    test("the separator convention is the ENGLISH one — comma groups, dot decimates", () => {
        // ⚠ THIS INVERTS EVERY OTHER LAYER IN THE SWEEP. `6,000 duine` read as *a sia , neoni neoni neoni*
        // — a phrase break plus three zeros — and `12.5 km` read as two sentences.
        expect(normalizeScottishGaelic("6,000 duine")).toBe("6000 duine");
        expect(normalizeScottishGaelic("9,984,670 km²")).toBe("9984670 km²");
        expect(normalizeScottishGaelic("130,161")).toBe("130161");
        expect(normalizeScottishGaelic("12.5 km")).toBe("12 puing 5 km");
        expect(normalizeScottishGaelic("0.94%")).toBe("0 puing 9 4%");
        // …and the THREE-DIGIT test is applied to BOTH marks, because the corpus also writes `32.976.026`.
        expect(normalizeScottishGaelic("32.976.026")).toBe("32976026");
        expect(gd.text("6,000 duine").trim()).toBe("ʃˈiə mˈiːlʲə t̪ˈuɲə"); // sia mìle duine
    });

    test("the ordinal SPLITS AROUND ITS NOUN — the circumfix that defines this language", () => {
        // `19mh linn` is *an naoidheamh linn deug*, never *naoidheamh deug linn*. gd.wikipedia states the
        // shape: "'S e an t-Samhain an t-aona mìos deug den bhliadhna."
        expect(normalizeScottishGaelic("19mh linn")).toBe("naoidheamh linn deug");
        expect(normalizeScottishGaelic("an 18mh linn")).toBe("an ochdamh linn deug");
        expect(normalizeScottishGaelic("an 12na linn")).toBe("an dàrna linn deug");
        expect(normalizeScottishGaelic("an 11mh linn")).toBe("an aonamh linn deug");
        // Below 11 there is no circumfix at all…
        expect(normalizeScottishGaelic("6mh linn")).toBe("siathamh linn");
        expect(normalizeScottishGaelic("1d")).toBe("chiad");
        expect(normalizeScottishGaelic("2na")).toBe("dàrna");
        expect(normalizeScottishGaelic("3s")).toBe("treas");
        // …and with no noun to reach across, `deug` goes straight after the head.
        expect(normalizeScottishGaelic("an 19mh")).toBe("an naoidheamh deug");
        // ⚠ THE NOUN IS RE-EMITTED VERBATIM (trap 10): it carries lenition the writer already applied.
        expect(normalizeScottishGaelic("14mh cheann-suidhe")).toBe("ceathramh cheann-suidhe deug");
        // ⚠ THE SUFFIX MUST BE GLUED. Allowing a space made `3 s` — three seconds — read as *treas*,
        // because that ordinal does end in ⟨s⟩.
        expect(normalizeScottishGaelic("3 s")).toBe("3 s");
        expect(normalizeScottishGaelic("1990s")).toBe("1990"); // the decade, not an ordinal
    });

    test("NO range rule, and that is the finding — the prediction that picked this language failed", () => {
        // The playbook names Celtic as where trap 14's mutation hazard bites next (Welsh's range rule was
        // wrong on 12 of 18). gd has 3,521 ranges — and reading them shows ISO dates in BBC citations,
        // ISBNs and football scores. Not one is a measurement span, so a Welsh-shaped rule would have been
        // a pure misfire generator.
        expect(normalizeScottishGaelic("BBC Naidheachdan 2016-12-31")).toBe("BBC Naidheachdan 2016-12-31");
        expect(normalizeScottishGaelic("ISBN 3-89940-263-4")).toBe("ISBN 3-89940-263-4");
        expect(normalizeScottishGaelic("6-0")).toBe("6-0");
        // The minus IS claimed, but only after a non-digit — the maths prose writes real negatives with a
        // plain hyphen ("{ ..., -3, -2, -1, 0, ... }", "√(-1)") while a year span writes `1805 -1869`.
        expect(normalizeScottishGaelic("{ ..., -3, -2 }")).toBe("{ ..., minus 3, minus 2 }");
        expect(normalizeScottishGaelic("1805 -1869")).toBe("1805 -1869");
    });

    test("percent, currency, units and the exponent that follows its noun", () => {
        expect(gd.text("70 %").trim()).toBe("ʃˈɛxkət̪ s̪ˈa çˈiaːt̪"); // seachdad sa cheud
        expect(gd.text("£20").trim()).toBe("fˈiçət̪ n̪ˠˈɔht̪"); // fichead not — the £ article names the sign
        // ⚠ GAELIC HAS NO NUMBER AGREEMENT on a counted noun: it stays singular after any numeral.
        expect(gd.text("100 kg").trim()).toBe("kʲʰˈiaːt̪ kʲʰˈilʲəkrˠəm");
        expect(normalizeScottishGaelic("176km")).toBe("176km"); // glued; the tier claims it downstream
        // The measure adjective goes AFTER the noun — the corpus glosses its own abbreviation:
        // "an fharsaingeachd de 551,695 cilemeatair ceàrnagach (km²)".
        expect(gd.text("5 km²").trim()).toBe("ˈa kʰˈɔːəkʲ kʲʰˈilʲəməht̪əɾʲ kʲʰˈeaːrˠn̪ˠəkəx");
        // Both halves of the rate are sourced with the notation glossed beside them: "deich air fhichead
        // mile 'san uair", and "aonadan de meatairean anns an diog (m/s)".
        expect(gd.text("320 km/h").trim()).toContain("s̪ˈan̪ˠ ˈuəəɾʲ");
        expect(gd.text("10 m/s").trim()).toContain("s̪ˈan̪ˠ tʲˈik");
    });

    test("abbreviations, and the four classes refused on a measurement", () => {
        expect(normalizeScottishGaelic("srl.")).toBe("agus mar sin air adhart.");
        expect(normalizeScottishGaelic("no. 5")).toBe("àireamh 5");
        expect(gd.text("Ross & Hendry").trim()).toBe("rˠˈɔs̪ ˈakəs̪ hˈeɲt̪rˠy");
        // ⚠ DEGREES ARE UNREAD ON PURPOSE. `ceum` is the Gaelic word and all 43 of its attestations are
        // the ACADEMIC degree; `ceum Celsius` and `ìre Celsius` both score 0. The Fula `tere` shape.
        expect(normalizeScottishGaelic("20 °C")).toBe("20 °C");
        // ⚠ AND SO ARE `×` AND `=`: `uiread` is "quantity", never "times", and every `=` in this corpus is
        // a wiki heading marker (`== … ==`) or raw LaTeX.
        expect(normalizeScottishGaelic("7 × 14")).toBe("7 × 14");
        expect(normalizeScottishGaelic("== Hallstatt ==")).toBe("== Hallstatt ==");
    });
});
