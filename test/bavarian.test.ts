import { describe, expect, test } from "vitest";

import { createBavarian, phonemizeWord } from "../src/languages/bavarian/bavarian.ts";
import { numberToWords } from "../src/languages/bavarian/numbers.ts";
import { normalizeBavarian } from "../src/languages/bavarian/normalize.ts";

// Bavarian (bar) — Boarisch, Upper German (Austro-Bavarian, ~14M), Latin script over the de-facto Bavarian-Wikipedia
// orthography (⟨å⟩ for the dark [ɔ], ⟨ä ö ü⟩, ⟨ß⟩). A greedy scan + the falling diphthongs + German-style rules.
// Referee: wikipron bar_latn_broad (human, variants merged). ⚠ It is a NARROW transcription of a dialect
// CONTINUUM (~1.29 variants/headword), so its folded score is dragged down by inherent dialect vowel-quality
// variation rather than by the engine — symbol accuracy is the meaningful reading here. It is also the ONLY
// referee for bar, so there is no independent second opinion.
describe("Bavarian canonical IPA — greedy g2p + falling diphthongs + fortis/lenis neutralization", () => {
    const bar = createBavarian();

    test("the FALLING diphthongs ⟨ia ua oa⟩→[iɐ̯ uɐ̯ oɐ̯] + closing ⟨au⟩→[ɑɔ̯], ⟨oi⟩→[oe]", () => {
        expect(phonemizeWord("Boarisch")).toBe("b̥oɐ̯riʃ"); // ⟨oa⟩→oɐ̯, ⟨sch⟩→ʃ ("Bavarian")
        expect(phonemizeWord("Biaschtl")).toBe("b̥iɐ̯ʃd̥l"); // ⟨ia⟩→iɐ̯, lenis ⟨t⟩→d̥
        expect(phonemizeWord("Aug")).toBe("ɑɔ̯ɡ̥"); // ⟨au⟩→ɑɔ̯, lenis ⟨g⟩→ɡ̥ ("eye")
        expect(phonemizeWord("Foi")).toBe("foe"); // ⟨oi⟩→oe (l-vocalization, "fall/case")
    });

    test("fortis/lenis neutralization: ⟨t p⟩→[d̥ b̥] unconditionally, ⟨k⟩→[ɡ̥] non-initially", () => {
        expect(phonemizeWord("Taag")).toBe("d̥aːɡ̥"); // ⟨t⟩→d̥ word-initial, ⟨aa⟩→aː ("day")
        expect(phonemizeWord("Klass")).toBe("ɡ̥lɑs"); // initial ⟨k⟩ before a liquid lenites → ɡ̥, ⟨ss⟩→s
        expect(phonemizeWord("Bånk")).toBe("b̥ɔŋɡ̥"); // ⟨å⟩→ɔ, coda ⟨k⟩→ɡ̥, ⟨n⟩→ŋ before the velar ("bench/bank")
    });

    test("r-vocalization + final-⟨a⟩ reduction + the ⟨gn⟩ coda coalescence", () => {
        expect(phonemizeWord("Bana")).toBe("b̥ɑnɐ"); // final unstressed ⟨-a⟩→ɐ ("banana"-type)
        expect(phonemizeWord("Wåssa")).toBe("ʋɔsɐ"); // ⟨w⟩→ʋ, ⟨å⟩→ɔ, ⟨ss⟩→s, final ⟨a⟩→ɐ ("water")
        expect(phonemizeWord("Regn")).toBe("reŋ"); // word-final ⟨gn⟩ → ŋ ("rain")
    });

    test("post-vocalic ⟨h⟩ is silent (a length marker); ⟨ch⟩ front/back split", () => {
        expect(phonemizeWord("Fruah")).toBe("fruɐ̯"); // ⟨ua⟩→uɐ̯, post-vocalic ⟨h⟩ silent ("early")
        expect(phonemizeWord("Fühn")).toBe("fyn"); // ⟨ü⟩→y, medial post-vocalic ⟨h⟩ silent
        expect(phonemizeWord("Dånkschee")).toBe("d̥ɔŋɡ̥ʃeː"); // ⟨å⟩→ɔ, ⟨nk⟩→ŋɡ̥, ⟨sch⟩→ʃ, ⟨ee⟩→eː ("thank you")
    });

    test("clause assembly", () => {
        expect(bar.text("I bin a Boar.").trim()).toBe("i b̥in ɑ b̥oɐ̯ɐ̯ .");
    });

    // CARDINAL NUMBERS — units-FIRST like German but with the connector reduced from ⟨und⟩ to a bare linking ⟨-a-⟩
    // (oanazwånzg = 21, zwoarazwånzg = 22 with the hiatus-breaking ⟨r⟩). Source: omniglot Bairisch cardinals; since
    // Bavarian has no codified orthography, the ⟨å⟩ Bavarian-Wikipedia variants and the ⟨-e⟩-less stems were chosen,
    // and magnitudes are written OPEN (a closed *dreihundad would lose its ⟨h⟩ to the silent post-vocalic-h rule).
    // See src/languages/bavarian/numbers.ts.
    test("numbers: units-first with the reduced ⟨-a-⟩ linker", () => {
        expect(numberToWords(0)).toBe("null");
        expect(numberToWords(21)).toBe("oanazwånzg"); // compound stem oan- (not oans-)
        expect(numberToWords(22)).toBe("zwoarazwånzg"); // compound stem zwoar- (hiatus ⟨r⟩)
        expect(numberToWords(45)).toBe("fimfafiazg");
        expect(numberToWords(99)).toBe("neinaneinzg");
        expect(numberToWords(100)).toBe("hundad");
        expect(numberToWords(555)).toBe("fimf hundad fimfafuchzg");
        expect(numberToWords(1000)).toBe("dausnd");
        expect(numberToWords(12345)).toBe("zwöif dausnd drei hundad fimfafiazg");
        expect(numberToWords(1000000)).toBe("oa Million");
        expect(numberToWords(1000000000)).toBe("oa Milliarde");
    });

    test("numbers: wired into the phonemizer", () => {
        expect(bar.text("21").trim()).toBe("oɐ̯nɑt͡sʋɔnt͡sɡ̥"); // oanazwånzg
        expect(bar.text("555").trim()).toBe("fimf hund̥ɑd̥ fimfɑfuxt͡sɡ̥");
    });

});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// TEXT NORMALIZATION (src/languages/bavarian/normalize.ts)
//
// ⚠ Asserted on `normalizeBavarian` — TEXT, not IPA — wherever the point is which WORDS the layer chooses,
// because that is the decision under test and an IPA assertion buries it under the g2p. The wiring, the
// tokenizer interactions and the "declined" cases go through `bar.text()`, since those are only visible in
// the phoneme stream.
//
// ⚠ AND THE BRANCHES ARE PINNED, NOT THE CORPUS'S INSTANCES (playbook trap 13): each rule below is exercised
// on a case it CLAIMS and on its nearest adversarial neighbour that it must DECLINE — the sentence-final `N.`
// beside the ordinal, the side-ratio beside the clock, the year-range beside the fraction, the ISBN beside
// the signed temperature.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe("Bavarian text normalization", () => {
    const bar = createBavarian();

    // The single largest defect in the language: 83 of the 246 Bavarian segments carry `&nbsp;`, and the
    // engine's TOKEN was phonemizing `nbsp` as a WORD plus a comma pause from the `;`.
    test("⚠ `&nbsp;` is folded to a SPACE, and it must be a space and not a deletion", () => {
        expect(normalizeBavarian("67&nbsp;km")).toBe("67 Kilometa");
        // Substituted, never deleted (trap 26): the number and its unit stay two tokens.
        expect(bar.text("67&nbsp;km").trim()).toBe("simɑseçt͡sɡ̥ kilomed̥ɐ");
        // ⚠ It must run FIRST, or every guard behind it is blind: this °C is invisible to a rule expecting a
        // space, which is why the first `°C` count over the Bavarian subset came out as 0 instead of 11.
        expect(normalizeBavarian("-13&nbsp;°C")).toBe("minus 13 Grad Celsius");
    });

    test("period-grouped thousands lose the dot before it can become a phrase break", () => {
        // ⚠ THE INTERNAL CAPITAL IS REAL AND IS NOT A DEFECT: `position: "compound"` concatenates the measure
        // word onto a unit noun that Bavarian, like German, CAPITALISES, so the text carries `QuadratKilometa`.
        // The g2p lowercases before scanning, so the IPA is byte-identical to the tidy spelling — asserted on
        // the next line so the claim is checked and not just stated. Swedish has the same `compound` shape and
        // never showed this, because its unit nouns are lowercase.
        expect(normalizeBavarian("30.528 km²")).toBe("30528 QuadratKilometa");
        expect(bar.text("30.528 km²").trim()).toBe("d̥rɑɛ̯sɡ̥ d̥ɑɔ̯snd̥ fimf hund̥ɑd̥ ɔxd̥ɑt͡sʋɔnt͡sɡ̥ kvɑd̥rɑd̥ɡ̥ilomed̥ɐ");
        expect(normalizeBavarian("4.324.782 km²")).toBe("4324782 QuadratKilometa"); // multi-group
        // ⚠ THE VERSION DOT SURVIVES, which is what keeps the one-letter `m` unit key safe (traps 39/46):
        // the group must be exactly three digits, and this corpus's own dotted designation has two.
        expect(normalizeBavarian("8140.43P")).toContain("8140.43P");
        // The SPACE-grouped form too (2 instances, one municipality's finance paragraph) — the group was
        // reading as a separate numeral, `549 000` → *fimfhundadneinafiazg nul*.
        expect(normalizeBavarian("549 000 €")).toBe("549000 Eiro");
    });

    test("ranges: a range ASCENDS, which is what separates it from a part number and an ISBN", () => {
        expect(normalizeBavarian("Beziak 5 - 8")).toBe("Beziak 5 bis 8");
        expect(normalizeBavarian("vo 1961 -1990")).toBe("vo 1961 bis 1990");
        expect(normalizeBavarian("1863–1952")).toBe("1863 bis 1952"); // en dash
        // ⚠ THE ONE COUNTER-EXAMPLE IN THE BAVARIAN SUBSET, and the reason for the ordering test: an Austrian
        // standard's part number descends (`2 < 8115`), so it is not a range.
        expect(normalizeBavarian("ÖNORM B 8115-2")).toBe("ÖNORM B 8115-2");
        // ⚠ AND THE CHAIN GUARDS ARE WHAT KEEP ISBNs OUT, which the ordering test alone would not — `3-86520`
        // ascends. A dash on either side disqualifies the pair, so every link of a chain is rejected. This
        // matters more here than elsewhere: the artifact's largest hyphen population is German-language ISBNs.
        expect(normalizeBavarian("ISBN 3-86520-078-8")).toBe("ISBN 3-86520-078-8");
        expect(normalizeBavarian("ISBN 978-3-484-23134-4")).toBe("ISBN 978-3-484-23134-4");
        // An ORDINAL range keeps its dots and is declined by both rules.
        expect(normalizeBavarian("(10.–23.) is aa")).toBe("(10.–23.) is aa");
    });

    test("ordinals: the licensing noun, the licensing article, and the sentence end that is NOT one", () => {
        // Licensed by the FOLLOWING word — a Bavarian month name or an ordinal noun.
        expect(normalizeBavarian("am 10. Novemba 1989")).toBe("am zehntn Novemba 1989");
        expect(normalizeBavarian("im 20. Joahundat")).toBe("im zwanzigstn Joahundat");
        // Licensed by the PRECEDING article plus a capitalised noun.
        expect(normalizeBavarian("da 2. Buachstob")).toBe("da zwoate Buachstob");
        // ⚠ THE SENTENCE-FINAL PERIODS, which must NOT be claimed — the check that matters here.
        // ⚠ The ISBN is written out IN FULL rather than truncated: a two-link `3-8` is an ascending pair with
        // no chain around it, so the range rule reads it as "3 bis 8" — correctly, since nothing marks it as
        // an identifier. Shortening a fixture can change which rule owns it.
        expect(normalizeBavarian("Minga, 2005. ISBN 3-86520-078-8")).toBe("Minga, 2005. ISBN 3-86520-078-8");
        expect(normalizeBavarian("im Joar 1904. Und daun")).toBe("im Joar 1904. Und daun");
        expect(bar.text("im Joar 1904. Und daun").trim()).toContain(" . "); // the pause survives
    });

    test("⚠ ordinals DECLINE where the word is unsourced, rather than composing a wrong one", () => {
        // `ORDINAL` holds only the five values read in bar.wikipedia prose. 4 is not one of them, and the
        // compositional route is refuted by this language's own cardinals (`zeah` would give *zeaht, but the
        // wiki writes `zehnte`), so an unsourced value is left exactly as it read before.
        expect(normalizeBavarian("De 4. Auflage")).toBe("De 4. Auflage");
        expect(normalizeBavarian("da 7. Beziak")).toBe("da 7. Beziak");
    });

    test("⚠ the ordinal ending follows the PREPOSITION in front of the article, not just the article", () => {
        // `da` is both the masculine nominative article and the feminine dative one; five of the eleven
        // article-licensed instances in the Bavarian subset take a governing preposition.
        expect(normalizeBavarian("vo da 1. Person")).toBe("vo da easchtn Person");
        expect(normalizeBavarian("in da 2. Person")).toBe("in da zwoatn Person");
        // `um` governs the accusative and both of its corpus instances take -e, so it is NOT in the set.
        expect(normalizeBavarian("um de 3. Person")).toBe("um de dritte Person");
        expect(normalizeBavarian("aa de 2. Person")).toBe("aa de zwoate Person");
    });

    test("abbreviations expand into words the corpus itself spells out", () => {
        expect(normalizeBavarian("z. B. in da Regionalliga")).toBe("zum Beispui in da Regionalliga");
        expect(normalizeBavarian("bzw. bairisch")).toBe("beziehungsweise bairisch");
        expect(normalizeBavarian("za. 208.000 Eihw.")).toBe("zirka 208000 Eihwohna.");
        // ⚠ The continuation lookahead admits a CURRENCY SIGN: without it `Mrd.` fell through unexpanded and
        // took the `€` with it, because the tier needs `Milliardn` as a magnitude to hop.
        expect(normalizeBavarian("21,905 Mrd. €")).toBe("21,905 Milliardn Eiro");
    });

    test("clock: the one real clock, the range, and the two side-ratios it must decline", () => {
        expect(normalizeBavarian("12:15")).toBe("zwöif Uhr fuchzea");
        // ⚠ THE RANGE IS CLAIMED FIRST, or the hyphen fuses the two rewritten clocks into ONE token —
        // `hostWordRun(["Latin"], "'-")` admits `-` inside a word run, so `fimf Uhr-nein Uhr` read *uɐ̯nɑɛ̯n*.
        expect(normalizeBavarian("5:00-9:00 Uhr")).toBe("fimf bis nein Uhr");
        expect(bar.text("5:00-9:00 Uhr").trim()).toBe("fimf b̥is nɑɛ̯n uɐ̯");
        // ⚠ A THIRD FIELD IS NOT A CLOCK — these are triangle side-ratios, and the lookbehind has to exclude
        // a COLON and not only a digit, or the rule restarts in the middle of the run and claims `15:36`.
        expect(normalizeBavarian("Seitnvoöitnis 39:15:36")).toBe("Seitnvoöitnis 39:15:36");
        expect(normalizeBavarian("gkiazt: 13:5:12")).toBe("gkiazt: 13:5:12");
    });

    test("degrees: the temperature, the coordinate, and the compound hyphen", () => {
        expect(normalizeBavarian("8,2 °C")).toBe("8,2 Grad Celsius");
        expect(normalizeBavarian("℃ folds")).toBe("°C folds"); // one code point meaning what °C means
        expect(normalizeBavarian("360°")).toBe("360 Grad");
        // ⚠ THE COMPOUND HYPHEN IS CONSUMED, for the clock range's reason: `90 Grad-Winkl` fused into one
        // token and read *ɡ̥rɑd̥ʋiŋɡ̥l*, where before this rule existed they were two clean words.
        expect(bar.text("90°-Winkl").trim()).toBe("nɑɛ̯nt͡sɡ̥ ɡ̥rɑd̥ ʋiŋɡ̥l");
    });

    test("⚠ the sign is read ONLY in the degree slot — the narrow arm, and what it must not claim", () => {
        // Every real sign in the Bavarian subset is followed by a degree word; no counter-example is.
        expect(normalizeBavarian("bei -13 °C und +15 °C")).toBe("bei minus 13 Grad Celsius und plus 15 Grad Celsius");
        expect(normalizeBavarian("woa −45,9 Grad Celsius")).toBe("woa minus 45,9 Grad Celsius");
        // ⚠ BOTH ENDS OF A SIGNED RANGE, and this is the one that must not half-fire: only the second number
        // has a degree word directly after it, so a lookahead that cannot reach across the joiner reads
        // "−1 bis MINUS zwoa" — a span from POSITIVE one to minus two. Omitting a plus is lossless; omitting
        // a minus INVERTS. Both joiners are the corpus's own.
        expect(normalizeBavarian("−1 bis −2 °C")).toBe("minus 1 bis minus 2 Grad Celsius");
        expect(normalizeBavarian("mit -0,5 beziehungsweise -1,4 °C"))
            .toBe("mit minus 0,5 beziehungsweise minus 1,4 Grad Celsius");
        // …and an UNSIGNED range across the same joiner is untouched.
        expect(normalizeBavarian("mit 18 beziahungsweis 17 °C")).toBe("mit 18 beziahungsweis 17 Grad Celsius");
        // A general `(^|\s)[-−–](\d)` rule would have read these two as *minus 1990* and *minus 8*. The sign
        // rule declines both because no degree word follows; the RANGE rule then claims them, which is the
        // reading they should have — so the pair of rules disagreeing correctly is the thing under test here.
        expect(normalizeBavarian("de Joar vo 1961 -1990")).toBe("de Joar vo 1961 bis 1990");
        expect(normalizeBavarian("bisherign Beziak 5 - 8")).toBe("bisherign Beziak 5 bis 8");
        // The ISBN is claimed by neither.
        expect(normalizeBavarian("ISBN 3-86520-078-8")).toBe("ISBN 3-86520-078-8");
    });

    test("fractions: the one attested denominator series, and the two shapes it must reject", () => {
        expect(normalizeBavarian("håt 2/3 vo da Produktion")).toBe("håt zwoa Driddl vo da Produktion");
        // ⚠ A NUMERATOR OF 1 TAKES THE ARTICLE, not the counting form — the corpus diff surfaced *oans
        // Driddl*, where the language writes `a` ("a hoiwe Milliardn", "A Quadratkilometa is a million moi").
        expect(normalizeBavarian("håt 1/3")).toBe("håt a Driddl");
        expect(normalizeBavarian("1/2 und 1/4")).toBe("a hoib und a Viadl");
        // A German-style `\d{1,3}/\d{1,3}` rule would claim both of these: one is a winter, one is a car.
        expect(normalizeBavarian("im Winta 469/470")).toBe("im Winta 469/470");
        expect(normalizeBavarian("Santana 300/350")).toBe("Santana 300/350");
        // …and an unsourced denominator is left alone rather than composed.
        expect(normalizeBavarian("3/7 vo da Fläch")).toBe("3/7 vo da Fläch");
    });

    test("the symbol tier: percent, currency in both positions, units and the exponent", () => {
        expect(normalizeBavarian("59% vo da Beväikarung")).toBe("59 Prozent vo da Beväikarung");
        expect(normalizeBavarian("2,1 % im Sektor")).toBe("2,1 Prozent im Sektor");
        // ⚠ `Eiro`, NOT `Euro` — bar.wikipedia's own article reads "Da Eiro (amtli: Euro, Symboi: €)", so
        // `Euro` is the German/official form and would be a Standard German word in a Bavarian mouth.
        expect(normalizeBavarian("11.709 €")).toBe("11709 Eiro");         // postposed, the European order
        expect(normalizeBavarian("$ 45.000")).toBe("45000 Dollar");        // preposed
        expect(normalizeBavarian("£ 795")).toBe("795 Pfund");
        // A COMPOUND KEY, because the tier is letter-bounded on the left so a bare `$` cannot match here.
        expect(normalizeBavarian("US$105&nbsp;Milliona")).toBe("105 Milliona Dollar");
        expect(normalizeBavarian("3757 km")).toBe("3757 Kilometa");        // `km` had read as the cluster [km]
        expect(normalizeBavarian("374 m")).toBe("374 Meta");
        // The measure word FUSES onto the front (`position: "compound"`) — bar.wikipedia has a dedicated
        // article: "A Quadratkilometa is a million moi so grouß wia a Quadratmeta."
        expect(normalizeBavarian("40.000 m³")).toBe("40000 KubikMeta"); // see the capital note above
        expect(bar.text("40.000 m³").trim()).toBe("fiɐ̯t͡sɡ̥ d̥ɑɔ̯snd̥ kub̥iɡ̥med̥ɐ");
        expect(normalizeBavarian("2.800 cm³")).toBe("2800 KubikZantimeta");
    });

    test("⚠ SOURCED REFUSALS — these must keep reading as they do, and the reasons are in normalize.ts", () => {
        // THE DECIMAL COMMA. `Komma` scores 24 token hits on bar.wikipedia and every one is the VERB ("do
        // komma genau segn"); `insource:/[0-9] Komma [0-9]/` returns zero; bar.wiktionary has no entry. The
        // comma stays a pause rather than becoming a confidently wrong word in the highest-traffic slot.
        expect(normalizeBavarian("10,5 Millionan")).toBe("10,5 Millionan");
        // `=` `<` `>` — 22 instances in the artifact and not one is arithmetic. They are the dialect wiki's
        // own morphology: a derivation arrow, a sound-change arrow, a glossing equals.
        expect(normalizeBavarian("da- (< der-)")).toBe("da- (< der-)");
        expect(normalizeBavarian("Lautwandlregl ei > oa")).toBe("Lautwandlregl ei > oa");
        expect(normalizeBavarian("bei dem = beim")).toBe("bei dem = beim");
        // The ampersand: 83 of 83 in the Bavarian subset are `&nbsp;`, and the only real ones are German
        // publisher names. Folding the entity must not leave the bare sign readable as a word.
        expect(normalizeBavarian("Königshausen & Neumann")).toBe("Königshausen & Neumann");
    });
});
