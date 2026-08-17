import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/nahuatl/nahuatl.ts";
import { normalizeNahuatl } from "../src/languages/nahuatl/normalize.ts";
import { numberToWords } from "../src/languages/nahuatl/numbers.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Classical Nahuatl / nāhuatlahtōlli (nci) — Uto-Aztecan, the
// traditional Spanish-based orthography. AUTHORED from Andrews, *Introduction to Classical Nahuatl* (§2). Vowel
// length is unwritten in traditional texts → short vowels (the referee's ː is backbone-folded). Two corroborating
// human referees (wikipron 886 / kaikki 2329).
describe("Classical Nahuatl (nāhuatlahtōlli) canonical IPA", () => {
    test("the affricates + digraphs + saltillo", () => {
        expect(phonemizeWord("nahuatl")).toBe("nawat͡ɬ"); // ⟨hu⟩→[w], ⟨tl⟩→[t͡ɬ]
        expect(phonemizeWord("Ahuitzotl")).toBe("awit͡sot͡ɬ"); // ⟨tz⟩→[t͡s]
        expect(phonemizeWord("xochitl")).toBe("ʃot͡ʃit͡ɬ"); // 'flower' — ⟨x⟩→[ʃ], ⟨ch⟩→[t͡ʃ]
        expect(phonemizeWord("tlahtolli")).toBe("t͡ɬaʔtolli"); // 'word' — the SALTILLO ⟨h⟩→[ʔ] (after a vowel)
    });

    test("the c/qu/cu/uc context rules (§2.4)", () => {
        expect(phonemizeWord("cihuatl")).toBe("siwat͡ɬ"); // 'woman' — ⟨c⟩ before i → [s]; ⟨hu⟩→[w]
        expect(phonemizeWord("quimichin")).toBe("kimit͡ʃin"); // ⟨qu⟩ before i → [k]
        expect(phonemizeWord("cuauhtli")).toBe("kʷawt͡ɬi"); // 'eagle' — ⟨cu⟩+V→[kʷ], ⟨uh⟩ coda→[w]
        expect(phonemizeWord("teuctli")).toBe("tekʷt͡ɬi"); // 'lord' — ⟨uc⟩ coda → [kʷ]
    });

    test("the ⟨chu⟩ trap + word-initial ⟨h⟩ is not a saltillo", () => {
        expect(phonemizeWord("cachuah")).toBe("kakwaʔ"); // ⟨chu⟩ = [k]-coda + ⟨hu⟩[w] (=/kakwa/), NOT [t͡ʃ]
        expect(phonemizeWord("yehhuatl")).toBe("jeʔwat͡ɬ"); // ⟨h⟩→[ʔ] then ⟨hu⟩→[w]; ⟨y⟩→[j]
        expect(phonemizeWord("he")).toBe("e"); // word-initial ⟨h⟩ is silent (saltillo only occurs AFTER a vowel)
    });

    test("registry wiring", () => {
        expect(getPhonemizer("nci").text("nahuatl").trim()).toBe("nawat͡ɬ");
    });
});

// ---------------------------------------------------------------------------------------------------------
// Cardinal numbers. VIGESIMAL (base 20) and positional, with a magnitude noun per power of twenty:
// pōhualli 20 · tzontli 400 · xiquipilli 8000 · pōhualxiquipilli 160 000 · tzonxiquipilli 3 200 000 ·
// pōhualtzonxiquipilli 64 000 000. TWO joiners: the linker ⟨on-⟩ (⟨om-⟩ before a vowel or ⟨m⟩) inside the
// sub-400 part, and the relational ⟨īpan⟩ between groups from 400 up. Source: English Wiktionary's
// Module:number_list/data/nci (declared `base20`) + Appendix:Classical Nahuatl numerals; this compositor
// reproduces 212 of its 214 lemmatised cardinals exactly (the 2 divergences are errors in the source — see
// numbers.ts). Andrews §2, the g2p's source, does not tabulate numerals, hence the Wiktionary citation.
describe("Nahuatl numbers", () => {
    for (const [n, expected] of [
        [1, "cē"],
        [7, "chicōme"],
        [10, "mahtlāctli"],
        [11, "mahtlāctli oncē"],                       // no *11 word: 10 + 1 with the ⟨on-⟩ linker
        [12, "mahtlāctli omōme"],                      // ⟨on-⟩ → ⟨om-⟩ before a vowel
        [15, "caxtōlli"],
        [19, "caxtōlli onnāhui"],
        [20, "cempōhualli"],                           // 'one count'
        [21, "cempōhualli oncē"],
        [30, "cempōhualli ommahtlāctli"],              // ⟨om-⟩ before ⟨m⟩
        [35, "cempōhualli oncaxtōlli"],
        [42, "ōmpōhualli omōme"],
        [99, "nāppōhualli oncaxtōlli onnāhui"],        // 80 + 15 + 4
        [100, "mācuīlpōhualli"],                       // five counts
        [101, "mācuīlpōhualli oncē"],
        [200, "mahtlācpōhualli"],
        [220, "mahtlāctli oncempōhualli"],             // an 11 MULTIPLIER: 10 scores + 1 score
        [380, "caxtōlli onnāppōhualli"],               // a 19 multiplier: 15 + 4 scores
        [400, "centzontli"],
        [401, "centzontli īpan cē"],                   // ⟨īpan⟩ takes over from ⟨on-⟩ at 400
        [555, "centzontli īpan chicōmpōhualli oncaxtōlli"],
        [999, "ōntzontli īpan chiucnāppōhualli oncaxtōlli onnāhui"], // 800 + 180 + 15 + 4
        [1000, "ōntzontli īpan mahtlācpōhualli"],      // 800 + 200 — attested verbatim
        [8000, "cenxiquipilli"],
        [9000, "cenxiquipilli īpan ōntzontli īpan mahtlācpōhualli"], // attested verbatim
        [15000, "cenxiquipilli īpan caxtōlli omōntzontli īpan mahtlācpōhualli"], // attested verbatim
        [160000, "cempōhualxiquipilli"],
        [1000000, "chicuacempōhualxiquipilli īpan mācuīlxiquipilli"], // attested verbatim
        [3200000, "centzonxiquipilli"],
        [64000000, "cempōhualtzonxiquipilli"],
    ] as const) {
        test(`${n} → ${expected}`, () => expect(numberToWords(n)).toBe(expected));
    }

    test("159999, the densest attested composite, verbatim", () => {
        expect(numberToWords(159999)).toBe(
            "caxtōlli onnāuhxiquipilli īpan caxtōlli onnāuhtzontli īpan caxtōlli onnāppōhualli oncaxtōlli onnāhui",
        );
    });

    test("no gaps or sentinels across 0..20000", () => {
        for (let n = 0; n <= 20000; n++) expect(numberToWords(n), `n=${n}`).not.toMatch(/undefined|NaN|[0-9]/);
    });

    // 20⁷ = 1 280 000 000 has no further magnitude noun → digit-by-digit. Classical Nahuatl has no attested
    // numeral for zero; ⟨ahtle⟩ 'nothing' is a disclosed stopgap (see numbers.ts).
    test("above 20⁷ → digit-by-digit, and the zero stopgap", () => {
        expect(numberToWords(0)).toBe("ahtle");
        expect(numberToWords(20 ** 7)).toBe("cē ōme chicuēyi ahtle ahtle ahtle ahtle ahtle ahtle ahtle"); // 1 280 000 000
    });

    test("end-to-end: the numeral is phonemized, not passed through as digits", () => {
        expect(phonemize("21", "nci")).toBe("sempoːwalli onseː"); // cempōhualli oncē — ⟨ce⟩ = [se]
        expect(phonemize("400", "nci")).toBe("sent͡sont͡ɬi"); // centzontli
    });
});

// ---------------------------------------------------------------------------------------------------------
// TEXT NORMALIZATION. Every case below encodes a measurement over `tools/corpus/mined/nci.jsonc` (410 unique
// retained segments of a nah.wikipedia dump); the reason is in the comment. See
// docs/investigations/nci_normalization_investigation.md and src/languages/nahuatl/normalize.ts.
describe("Classical Nahuatl text normalization", () => {
    // THE SPACE IS A GROUPING MARK, and this is the highest-value rule in the layer: the paleoanthropology
    // articles write `1 000 000`, `720 000`, `480 000`, `128 000`, `149 600 000`, and un-grouped they read as
    // two numerals with the zero stopgap *ahtle* between them.
    test("the space-grouped figure is one number, by the three-digit test", () => {
        expect(normalizeNahuatl("(720 000) xihuitl")).toBe("(720000) xihuitl");
        expect(normalizeNahuatl("(1 000 000) xihuitl")).toBe("(1000000) xihuitl");
        expect(normalizeNahuatl("in ic 149 600 000 kilómetros cah")).toBe("in ic 149600000 kilómetros cah");
        // ⚠ ONE JOIN PER PASS WOULD LEAVE `1 000000` (trap 63) — the whole number is matched at once.
        expect(normalizeNahuatl("5 000 000 xihuitl")).toBe("5000000 xihuitl");
        // …and `H 2 O` is not a group: the run has to be exactly three digits per join.
        expect(normalizeNahuatl("H 2 O: gelo")).toBe("H 2 O: gelo");
    });

    // THE COMMA GROUPS IN NAHUATL PROSE — `384,400 km`, `21,860,000,000 km³`, `37,932,330 km²` — while a
    // chapter,verse citation has one or two digits after the comma and is declined by the same test.
    test("the comma groups, and a scripture citation is not a group", () => {
        expect(normalizeNahuatl("Mētztli īyōllo 384,400 km ca.")).toBe("Mētztli īyōllo 384400 kilómetros ca.");
        expect(normalizeNahuatl("(21,860,000,000 km³)")).toBe("(21860000000 km³)");
        expect(normalizeNahuatl("Mt 20,29-34; Mc 10,46-52")).toBe("Mt 20,29-34; Mc 10,46-52");
    });

    // THE DECIMAL DOT IS NEUTRALISED, not spoken — `punto` ×0 and `coma` ×0 on nah.wikipedia. The defect
    // being fixed is the false SENTENCE BREAK it produces mid-quantity: `45.9 km` read as "… . nine …".
    test("the decimal dot stops being a sentence break", () => {
        expect(normalizeNahuatl("ōctacāyōtl 8.2 Mw")).toBe("ōctacāyōtl 8 2 Mw");
        expect(phonemize("in cotoctic 0.04% momeliuhca", "nci")).not.toContain(" . ");
    });

    // ⚠ THE COLON IS A SCRIPTURE REFERENCE 14× AND A CLOCK 6×, AND ARITY SEPARATES THEM. The fleet-standard
    // hour-bounded `H:MM` rule would read a dozen Gospel citations as times of day (trap 56).
    test("the clock is claimed by arity or by `hrs`; the Gospel citations are not", () => {
        expect(normalizeNahuatl("īpan 12:02:50 nicān cāhuitl")).toBe("īpan 12 02 50 nicān cāhuitl");
        expect(normalizeNahuatl("īpan 12:14 hrs Tecolotlan")).toBe("īpan 12 14 horas Tecolotlan");
        // ⚠ THE TRAILING DOT IS NOT CONSUMED (trap 10) — `4:00 hrs.` ends its sentence.
        expect(normalizeNahuatl("Tlachicuēiti 21, 4:00 hrs.")).toBe("Tlachicuēiti 21, 4 00 horas.");
        expect(normalizeNahuatl("Mateo 1:16, Marcos 8:29, Lucas 9:20")).toBe("Mateo 1:16, Marcos 8:29, Lucas 9:20");
        expect(normalizeNahuatl("imAmox in Tlahtohqueh 18:41-45.")).toContain("18:41");
    });

    // ⚠ THE DEGREE CONFUSABLE IS A SPANISH ORDINAL HERE — `º` U+00BA in `2º Potencial de ionización` — which
    // is the opposite direction from Hawaiian, whose confusable WAS a degree. `grados` is the corpus's word
    // (×1 on nah.wikipedia, and its one example is a Richter magnitude); the scale letter is consumed unread
    // because `celsius`, `centígrados`, `fahrenheit` and `kelvin` are all ×0.
    test("the degree sign is read and the masculine ordinal indicator is not", () => {
        expect(normalizeNahuatl("itotonca cequi 17 °C.")).toBe("itotonca cequi 17 grados.");
        expect(normalizeNahuatl("moātili 0 °C īhuān")).toBe("moātili 0 grados īhuān");
        expect(normalizeNahuatl("2º Potencial de ionización")).toBe("2º Potencial de ionización");
        expect(normalizeNahuatl("3º potencial de ionización")).toBe("3º potencial de ionización");
    });

    // ⚠ THE UNIT RULES REQUIRE THE SPACE, which is why this layer declares no shared symbol tier: the tier's
    // `\s?` cannot decline `9.8m sales` (English "million" in a discography) or `180m Ta` (an isomer label),
    // and every genuine metre in the corpus has the space.
    test("a unit needs its space, and a glued `m` is not a metre", () => {
        expect(normalizeNahuatl("Momātia īxquichca 10 m īhuān")).toBe("Momātia īxquichca 10 metros īhuān");
        expect(normalizeNahuatl("Yucatán 35 km tlāpcopa")).toBe("Yucatán 35 kilómetros tlāpcopa");
        expect(normalizeNahuatl("(1995) 9.8m sales")).toBe("(1995) 9 8m sales");
        expect(normalizeNahuatl("180m Ta {Sin}")).toBe("180m Ta {Sin}");
        // ⚠ `km²` KEEPS ITS POWER VISIBLE — `cuadrado`/`cúbico` are ×0, so swallowing the unit would hide
        // the real gap rather than fill it.
        expect(normalizeNahuatl("(37,932,330 km²)")).toBe("(37932330 km²)");
        // …and a rate is declined: no `s` noun is attested, so reading the numerator yields *metros s*.
        expect(normalizeNahuatl("Velocidad del sonido 4970 m/s")).toBe("Velocidad del sonido 4970 m/s");
    });

    // THE `&nbsp;` ENTITY IS LITERAL IN THIS DUMP (×10) — it reaches the g2p as the word *nbsp* and hides
    // the unit behind it. ⚠ Replaced by a SPACE, not deleted, or the figure fuses to its unit (trap 10).
    test("the literal &nbsp; becomes the space it is, and unblocks the unit", () => {
        expect(normalizeNahuatl("huehcatlanyōtīca 45.9&nbsp;km.")).toBe("huehcatlanyōtīca 45 9 kilómetros.");
        expect(normalizeNahuatl("tlatēctli 133&nbsp;km in")).toBe("tlatēctli 133 kilómetros in");
        expect(phonemize("huehcatlanyōtīca 57&nbsp;km.", "nci")).not.toContain("nbsp");
    });

    // ⚠ THE PLUS IS A MORPHEME BOUNDARY IN 22 OF ITS 24 INSTANCES — nah.wikipedia's numeral stubs decompose
    // the vigesimal word and then state the digits. Reading it produces *cēm plus pōhual plus on plus ēyi*.
    test("the numeral stubs' + is left silent", () => {
        const glossed = "Cēmpōhualomēyi (cēm + pōhual + on + ēyi) ītōcā cē tlapōhualli";
        expect(normalizeNahuatl(glossed)).toBe(glossed);
        expect(phonemize(glossed, "nci")).not.toMatch(/plus|m[aá]s/u);
    });

    // ⚠ THE CURRENCY AND THE FRACTION ARE SELF-GLOSSED — the writer has already said `pesos`/`tomin` and
    // `īnnāhui cē`, so expanding either sign says the noun twice.
    test("the self-glossed $ and 1/4 are left alone", () => {
        expect(normalizeNahuatl("ipatiuh cetzin $40 pesos tlen tomin")).toBe("ipatiuh cetzin $40 pesos tlen tomin");
        expect(normalizeNahuatl("īnnāhui cē (1/4) ītechpa")).toBe("īnnāhui cē (1/4) ītechpa");
    });

    // RANGES. The life-and-reign spans are read; ⚠ the ISO date, the ISBN and the UTC offset are declined by
    // the fleet-standard chain and head guards, which is the whole reason they are written that way.
    test("a reign span is a range; an ISO date, an ISBN and a UTC offset are not", () => {
        expect(normalizeNahuatl("Itzcōātl (1427-1440).")).toBe("Itzcōātl (1427, 1440).");
        expect(normalizeNahuatl("(1934–1964); México")).toBe("(1934, 1964); México");
        expect(normalizeNahuatl("Love Me Do (1962-10-05)")).toBe("Love Me Do (1962-10-05)");
        expect(normalizeNahuatl("ISBN 970-07-6492-3")).toBe("ISBN 970-07-6492-3");
        expect(normalizeNahuatl("nicān cāhuitl (UTC-5)")).toBe("nicān cāhuitl (UTC-5)");
    });

    // U+200B, ×15, doubled after `uan ` throughout the machine-translated modern-Nahuatl articles. Invisible,
    // so it can only ever be noise. ⚠ ZWJ/ZWNJ are deliberately NOT touched.
    test("the zero-width space is stripped without fusing its neighbours", () => {
        expect(normalizeNahuatl("uan ​​eli nopa")).toBe("uan eli nopa");
        expect(normalizeNahuatl("Cicero;​ Arpino")).toBe("Cicero; Arpino");
    });

    // WHOLE-PIPELINE. The point of the layer is what the g2p finally says.
    test("end-to-end: the grouped figure, the unit and the clock reach the IPA as words", () => {
        // 720000 is a real base-20 composite, not seven-hundred-twenty followed by *ahtle*.
        expect(phonemize("(720 000) xihuitl", "nci")).not.toContain("aʔt͡ɬe");
        // `35 km` — the unit is a word, not a raw Latin token.
        expect(phonemize("Yucatán 35 km tlāpcopa", "nci")).toContain("kilometɾos");
        // `17 °C` used to end as a bare [k]; it now says the scale word.
        expect(phonemize("itotonca cequi 17 °C.", "nci")).toContain("ɡɾados");
        // …and a Gospel citation keeps its colon-pause rather than becoming a time of day.
        expect(phonemize("Marcos 8:29", "nci")).toContain(",");
    });
});
