import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { numberToWords, withClass6Concord } from "../src/languages/shona/numbers.ts";
import { normalizeShonaPre, normalizeShonaPost } from "../src/languages/shona/normalize.ts";

// Shona / chiShona (sn) — Bantu (S10, Zezuru-based Standard Shona), Latin orthography. Numbers are composed
// as TEXT and then run through the greedy g2p, so the expected IPA carries the language's signatures:
// implosive ⟨b d⟩ → ɓ ɗ, whistled ⟨sv zv⟩ → ȿ ɀ, prenasalized ⟨mb nd ng nz⟩ → ᵐb ⁿd ᵑɡ ⁿz, breathy ⟨dh⟩ → d̤.
//
// ⚠ THIS LANGUAGE HAS NO REFEREE FOR ANY OF IT. No FLEURS corpus, no wikipron, and a kaikki extract under 25
// entries; `referee-eval.ts sn` runs `epitran sna-Latn`, which is programmatic and WORD-ONLY — its 443-word
// list contains no digit and no symbol. So this file is not a convenience: it is the only gate that pins a
// reading. Every expectation below is sourced in `src/languages/shona/normalize.ts`,
// `src/languages/shona/shona.ts` or `shona.jsonc`, and the evidence is written out in
// `docs/investigations/sn/sn_normalization_investigation.md`.
//
// ⚠ PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (playbook trap 13). The number composer has a table
// branch (1–10), a magnitude-concord branch (makumi/mazana/zviuru + a class prefix) and a boundary between
// them; several cases below are deliberately values the corpus does NOT contain.
describe("Shona numbers", () => {
    test("units and the teens use the bare RECITATION series", () => {
        // sn.wikipedia states this series explicitly — "Aya mazwi anoshandiswa pakurava sokuti: poshi, piri;
        // tatu; ina; shanu; zvichingodaro" — and says of the same words that they are NOT what quantifies a
        // noun. That is why `withClass6Concord` exists and why it is applied only beside a measure noun.
        expect(numberToWords(1)).toBe("motsi");
        expect(numberToWords(9)).toBe("pfumbamwe");
        expect(numberToWords(10)).toBe("gumi");
        expect(numberToWords(12)).toBe("gumi ne piri");
        expect(phonemize("9", "sn")).toBe("p͡fuᵐbamwe");
    });

    test("the tens and hundreds take the class-6 concord INSIDE the numeral", () => {
        // 20/20 corpus instances after makumi/mazana are the ma- form and none is the bare stem. This is the
        // defect the layer had: `makumi piri` for 20, `zana piri` for 200.
        expect(numberToWords(20)).toBe("makumi maviri");
        expect(numberToWords(98)).toBe("makumi mapfumbamwe ne sere");
        expect(numberToWords(100)).toBe("zana");
        expect(numberToWords(200)).toBe("mazana maviri");
        // 305 is the corpus's own `makilomita 305`, and 431 the head of its worked 431,257,698 reading.
        expect(numberToWords(305)).toBe("mazana matatu ne shanu");
        expect(numberToWords(431)).toBe("mazana mana ne makumi matatu ne motsi");
    });

    test("thousands take the class-8 concord, and the magnitude LEADS its count", () => {
        // `chiuru` (cl.7) / `zviuru` (cl.8). ⚠ `churu` — the word this manifest used to ship — is the ANTHILL
        // in 33 of 33 sn.wikipedia tokens.
        expect(numberToWords(1000)).toBe("chiuru");
        // Each of these is glossed against its digits on sn.wikipedia or in the corpus:
        //   8000    "makiromita ezvuruzvisere (8000km)"
        //   3540    "makiromita ezvuruzvitatu mazanamashanu-nemakumimana (3,540km)"
        //   10000   "10,000 = Zviuru gumi"        100000  "100,000 = zviuru zana"
        expect(numberToWords(2000)).toBe("zviuru zviviri");
        expect(numberToWords(8000)).toBe("zviuru zvisere");
        expect(numberToWords(3540)).toBe("zviuru zvitatu ne mazana mashanu ne makumi mana");
        expect(numberToWords(10000)).toBe("zviuru gumi");
        expect(numberToWords(100000)).toBe("zviuru zana");
    });

    test("millions and billions — the arm the de-grouping rule exposed", () => {
        // Before de-grouping existed, no grouped figure ever reached the composer intact, so ≥10⁶ fell to the
        // digit-by-digit fallback unnoticed. The corpus's own reading of 431,257,698 is reproduced here
        // structurally word for word (it writes the concorded `ane`/`neimwe` where this composes `ne`/`ne motsi`).
        expect(numberToWords(1000000)).toBe("miriyoni");
        expect(numberToWords(1606000)).toBe("miriyoni ne zviuru mazana matanhatu ne tanhatu");
        expect(numberToWords(431257698)).toBe(
            "mamiriyoni mazana mana ne makumi matatu ne motsi ne zviuru mazana maviri ne makumi mashanu ne nomwe"
                + " ne mazana matanhatu ne makumi mapfumbamwe ne sere",
        );
        expect(numberToWords(2e9)).toBe("mabhiriyoni maviri");
        // Beyond the composer's range, digit-by-digit — the branch nothing else exercises.
        expect(numberToWords(1e12)).toBe("motsi zero zero zero zero zero zero zero zero zero zero zero zero");
    });

    test("withClass6Concord moves ONLY the final stem, and leaves 'one' alone", () => {
        expect(withClass6Concord("piri")).toBe("maviri");
        expect(withClass6Concord("makumi maviri ne piri")).toBe("makumi maviri ne maviri");
        expect(withClass6Concord("zana ne shanu")).toBe("zana ne mashanu");
        // Class 6 is a plural, so "one" beside it is a class mismatch Shona solves by changing the NOUN
        // (`dhora rimwe`) — not something this layer can do, so the stem is left rather than half-agreed.
        expect(withClass6Concord("motsi")).toBe("motsi");
        // A numeral ending in a magnitude word already carries its concord and must not be touched.
        expect(withClass6Concord("makumi matatu")).toBe("makumi matatu");
    });
});

describe("Shona normalization — the symbol tier", () => {
    test("percent is POSTPOSED and the word is pazana, not the higher-count muzana", () => {
        // "chikamu che 71 pazana (71%)" — the corpus glosses the sign against the word in one sentence.
        expect(phonemize("85%", "sn")).toBe("makumi masere ne ʃanu pazana");
    });

    test("currency: madhora, PREFIXED, and US$ needs its own key", () => {
        expect(phonemize("$60", "sn")).toBe("mad̤ora makumi matan̤atu");
        // ⚠ The divergence from Chichewa: this corpus GLUES the ISO code, and the tier's `$` key is
        // letter-bounded on the left so a bare `$` cannot reach inside `US$`.
        expect(phonemize("US$28,000", "sn")).toBe("mad̤ora ɀiuru makumi maʋiri ne masere");
        // ⚠ The Shona proclitic produces the same shape from the other side — normalize.ts step 2.
        expect(phonemize("ye$150", "sn")).toBe("je mad̤ora zana ne makumi maʃanu");
        // The class-6 concord on the counted numeral (trap 14): madhora MAVIRI, never *madhora piri*.
        expect(phonemize("$2", "sn")).toBe("mad̤ora maʋiri");
    });

    test("units are PREFIXED, and the rate connective is pa", () => {
        expect(phonemize("3m", "sn")).toBe("mamita matatu");
        expect(phonemize("105 kg", "sn")).toBe("makiroɡiramu zana ne maʃanu");
        expect(phonemize("120 km/hr", "sn")).toBe("makiromita zana ne makumi maʋiri pa awa");
        expect(phonemize("2 km", "sn")).toBe("makiromita maʋiri");
    });

    test("the squared word is maskweya, BEFORE the unit noun", () => {
        expect(phonemize("1m²", "sn")).toBe("maskweja mamita mot͡si");
        // ⚠ The one shape the tier structurally cannot reach — `NOT_VERSION` rejects a dotted-or-comma'd
        // number glued to a ONE-letter key, and Shona's corpus has no dotted version designation at all.
        // Claimed by normalize.ts step 7, which is also what recovers the exponent here.
        expect(phonemize("0,5m²", "sn")).toBe("maskweja mamita zero koma ʃanu");
        expect(phonemize("1.5m", "sn")).toBe("mamita mot͡si pojiⁿdi ʃanu");
    });

    test("the multiplication sign reads kuwanzana ne", () => {
        expect(phonemize("60 x 6", "sn")).toBe("makumi matan̤atu kuwaⁿzana ne tan̤atu");
    });
});

describe("Shona normalization — the local rules", () => {
    test("thousands de-grouping, before the comma can become a clause pause", () => {
        // Was: *mot͡si , zana tan̤atu ne tan̤atu , zero* — three numbers and two pauses for one number.
        expect(phonemize("1,606,000", "sn")).toBe("mirijoni ne ɀiuru mazana matan̤atu ne tan̤atu");
        expect(normalizeShonaPre("US$7 000")).toBe("US$7000");
    });

    test("a comma-separated LIST of numbers is not a run of decimals", () => {
        // The corpus's worked example on the statistical mode. Both lookarounds are needed; each element is
        // preceded or followed by a comma. 0 of 11 claimed.
        expect(normalizeShonaPost("3,4,6,7,8,9,10,4,11,2,1,4")).toBe("3,4,6,7,8,9,10,4,11,2,1,4");
        // …while the genuine comma-decimal, which is always glued to a unit, IS claimed.
        expect(normalizeShonaPost("273,15K")).toBe("273 koma 1 5K");
    });

    test("ranges join with kusvika, ASCENDING ONLY, and run BEFORE the tier", () => {
        expect(phonemize("makore 25-30", "sn")).toBe("makore makumi maʋiri ne ʃanu kuȿika makumi matatu");
        // ⚠ The ordering that forces this layer's two-pass shape: the unit follows the SECOND operand, and
        // once the tier has moved it in front of that operand no range rule can pair the two.
        expect(phonemize("0-100 km/hr", "sn")).toBe("zero kuȿika makiromita zana pa awa");
        // Descending pairs are declined — a subtraction, a football score, a birth-death pair, a volume-year.
        expect(normalizeShonaPre("59 - 32 = 27")).toBe("59 - 32 = 27");
        expect(normalizeShonaPre("Brazilians 3-0 mu Stade")).toBe("Brazilians 3-0 mu Stade");
        // A trailing letter is declined too: an English magnitude glued to the operand.
        expect(normalizeShonaPre("imbwa 13-16million")).toBe("imbwa 13-16million");
    });

    test("degrees: the noun is madhigiriyi, the scale letter is read, and the proclitic survives", () => {
        expect(phonemize("32 ° C", "sn")).toBe("mad̤iɡiriji makumi matatu ne maʋiri kelsius");
        // ⚠ THE LEFT GUARD IS `(?<![\d.,])`, not the siblings' letter-excluding one: Shona binds a particle
        // to the front of the digit run, and `ne180 °` is the corpus's own instance. The particle ends up
        // proclitic on the noun instead — `nemadhigiriyi`, which is how Shona writes it anyway.
        expect(phonemize("ne180 °", "sn")).toBe("nemad̤iɡiriji zana ne makumi masere");
        // This wiki writes a bare `o` for the sign in a dozen places; that arm demands a preceding space so
        // it cannot bite into a word.
        expect(phonemize("0 o C", "sn")).toBe("mad̤iɡiriji zero kelsius");
    });

    test("the concord pass declines a decimal operand, on BOTH digit lengths", () => {
        // ⚠ THE TWO-DIGIT CASE IS THE ONE A ONE-DIGIT FIXTURE HIDES. The guard is `(?![.,]?\\d)`; drop the
        // `?` and `\\d+` backtracks one digit short, so `madhora 25.5` claims a truncated `2` and reads a
        // different quantity with the tail left as loose digits. `masendimita 5.5` cannot backtrack and so
        // passes either way — which is why it alone was not enough.
        expect(normalizeShonaPost("masendimita 5.5")).toBe("masendimita 5 poyindi 5");
        expect(normalizeShonaPost("madhora 25.5")).toBe("madhora 25 poyindi 5");
        expect(normalizeShonaPost("makiromita 12,5")).toBe("makiromita 12 koma 5");
        // …while the integer beside the same noun IS concorded.
        expect(normalizeShonaPost("madhora 25")).toBe("madhora makumi maviri ne mashanu");
    });

    test("decimals: one word per mark, and the fractional digits are read one at a time", () => {
        // sn.wikipedia's own worked reading does exactly this — 0,286 → "koma mbiri nomwe nhanhatu".
        // Reading `25` in `1.25` as a NUMBER would say *makumi maviri ne shanu*, a different quantity.
        expect(phonemize("12.9cm", "sn")).toBe("maseⁿdimita ɡumi ne piri pojiⁿdi p͡fuᵐbamwe");
        expect(normalizeShonaPost("1.25")).toBe("1 poyindi 2 5");
    });

    test("HTML entities are folded, and no conjunction is spent on the ampersand", () => {
        // `&nbsp;` sits exactly in the gap the tier's number–unit adjacency needs.
        expect(phonemize("46–76&nbsp;kg", "sn")).toBe(
            "makumi mana ne tan̤atu kuȿika makiroɡiramu makumi manomwe ne matan̤atu",
        );
    });

    test("dotted capital runs lose their interior dots but keep a sentence end", () => {
        // Both of the corpus's two runs, and neither is preceded by a proclitic:
        expect(normalizeShonaPre("muna 3000 B.C. ne kutengeza")).toBe("muna 3000 BC ne kutengeza");
        expect(normalizeShonaPre("Zimbabwe state (1000 C.E. - 1830)")).toBe("Zimbabwe state (1000 CE - 1830)");
        // ⚠ AND THE LIMIT, PINNED RATHER THAN FIXED. This rule keeps the siblings' letter-excluding left
        // guard, so a run with a Shona proclitic glued to it — `kuU.S.` — is declined. Every other rule in
        // this layer had that guard widened for exactly this reason; here it is NOT, because the shape has
        // ZERO instances in the corpus and widening a guard for a shape nobody has counted is trap 9. The
        // assertion records the state so the decision is re-checkable rather than invisible.
        expect(normalizeShonaPre("yakabva kuU.S.")).toBe("yakabva kuU.S.");
    });

    test("the English ordinal suffix is stripped; Shona writes its own ordinals as words", () => {
        expect(normalizeShonaPre("mwaka wechizana 19 - (19th Century)")).toBe("mwaka wechizana 19 - (19 Century)");
    });

    test("TRAP 14/15: a proclitic glued to a digit run needs no rule, and reads the same either way", () => {
        // A Shona associative concord agrees with the HEAD NOUN, not with the numeral, so unlike Welsh's
        // mutating `i` or Azerbaijani's case suffix there is nothing to compute — and the glued and spaced
        // spellings of the same particle give the same reading.
        expect(phonemize("gore ra1923", "sn")).toBe(phonemize("gore ra 1923", "sn"));
        expect(phonemize("gore ra1923", "sn")).toBe("ɡore ra t͡ʃiuru ne mazana map͡fuᵐbamwe ne makumi maʋiri ne tatu");
    });

    test("neither pass leaves a doubled or edge space (the SLOT-GAP class)", () => {
        expect(normalizeShonaPre(" makore 25-30 ")).toBe("makore 25 kusvika 30");
        expect(normalizeShonaPost(" 12.9 ")).toBe("12 poyindi 9");
    });
});

describe("Shona — what is deliberately NOT read, pinned so a change is visible", () => {
    // Each of these is a SOURCED REFUSAL argued in normalize.ts's header and in tools/normalization/defects.ts.
    // They are pinned as tests because a refusal that nothing asserts is indistinguishable from an oversight.
    test("no clock — 2 of the corpus's 23 colon shapes are times, and Shona has no attested clock idiom", () => {
        expect(normalizeShonaPost("iri pa 06:00hrs")).toBe("iri pa 06:00hrs");
        // A Bible chapter:verse and a football score must not be claimed either.
        expect(normalizeShonaPre("Genesis 30:13")).toBe("Genesis 30:13");
        expect(normalizeShonaPre("zvibodzwa 3:2")).toBe("zvibodzwa 3:2");
    });

    test("no equals, minus or plus word — every candidate carries a concord this layer cannot compute", () => {
        expect(normalizeShonaPost("Basa = Fosi")).toBe("Basa = Fosi");
        // ⚠ Omitting a minus INVERTS, unlike a plus. This refusal is the one to revisit first.
        expect(normalizeShonaPost("chikwereti -$100")).toBe("chikwereti -$100");
        expect(normalizeShonaPost("longitude +30 o E")).toContain("+");
    });

    test("no fraction rule, which also keeps the corpus's slashed DATES intact", () => {
        expect(normalizeShonaPre("Ndabaningi Sithole (31/07/1920")).toBe("Ndabaningi Sithole (31/07/1920");
        expect(normalizeShonaPost("kuyenzana na (22/7)")).toBe("kuyenzana na (22/7)");
    });

    test("a decimal range is declined — the guard that excludes a dot on either operand", () => {
        expect(normalizeShonaPre("Dzinoreba 2.1-3.4m")).toBe("Dzinoreba 2.1-3.4m");
    });

    // ⚠ THE CLAUSE-FINAL BRANCH, PINNED SEPARATELY (trap 13), and the pair above is the reason it needs its
    // own test: the decimal refusal lives in the LEADING guard, so the trailing one can stop rejecting `.`
    // and `,` without admitting a decimal. A sentence period is not part of a number, and while the trailing
    // guard rejected one, every range that ENDED A CLAUSE fell back to two juxtaposed cardinals. The comma
    // goes with it because Shona writes the decimal POINT — and the ascending-only test, not the comma, is
    // what declines a truncated endpoint here.
    test("a range that ENDS A CLAUSE, or precedes a comma, is still a range", () => {
        expect(normalizeShonaPre("makore 25-30.")).toBe("makore 25 kusvika 30.");
        expect(normalizeShonaPre("March 20-21, 2019")).toBe("March 20 kusvika 21, 2019");
        expect(normalizeShonaPre("50-70.")).toBe("50 kusvika 70.");
        expect(normalizeShonaPre("Vhoriyamu 1984-5.")).toBe("Vhoriyamu 1984-5."); // still non-ascending
    });

    test("units — ⟨mm⟩ ⟨ha⟩ ⟨l⟩, the three that leaked raw ASCII, each sourced on sn.wikipedia", () => {
        // mamirimita: "4 kusvika 64 mamirimita" (sediment grades) + the SI-prefix article's "ne milimita".
        expect(phonemize("10 mm", "sn")).toBe("mamirimita ɡumi");
        // hekita: glossed against the sign in its own clause — "hekita anodarika 44 (44.4 ha)".
        expect(phonemize("10 ha", "sn")).toBe("hekita ɡumi");
        // rita: "tarakita yangu inofamba 10km pa Rita repeturu". ⚠ `marita` is Malta and `lita` is Swedish.
        expect(phonemize("10 l", "sn")).toBe("rita ɡumi");
        expect(phonemize("10 L", "sn")).toBe("rita ɡumi");
        // ⚠ PREPOSED, like every other Shona measure noun, and the class-6 concord still applies to the
        // numeral — `mamirimita maviri`, not the recitation stem `piri`.
        expect(phonemize("2 mm", "sn")).toBe("mamirimita maʋiri");
        // The one attested Shona litre sits in the rate denominator slot, and now composes there exactly.
        expect(phonemize("10 km/l", "sn")).toBe("makiromita ɡumi pa rita");
    });

    test("the HOUR — a bare count reads, the rate is untouched, and the clock is still refused", () => {
        // `hr`/`hrs` were declared only as rate DENOMINATORS, so a bare count of hours had no reading and
        // `(8hr)` reached the IPA as *sere hr*. The artifact glosses the abbreviation against the word in
        // the next clause: "panobhadhara $60 pazuva (8hr). Kana akashanda 6 AWA anenge…".
        expect(phonemize("8hr", "sn")).toBe("maawa masere");
        expect(phonemize("8hrs", "sn")).toBe("maawa masere");
        expect(phonemize("2 hrs", "sn")).toBe("maawa maʋiri");
        // ⚠ THE `ma-` PLURAL IS THE HEAD FORM AND THE BARE `awa` THE DENOMINATOR FORM, which is the split
        // the corpus writes — and declaring `hr` in `units` broke exactly this line, because a units key is
        // matchable as a denominator too. That is why the head reading is claimed locally instead.
        expect(phonemize("120 km/hr", "sn")).toBe("makiromita zana ne makumi maʋiri pa awa");
        // ⚠ AND A 24-HOUR CLOCK IS DELIBERATELY STILL RAW. `06:00hrs` is two numerals and the unit belongs
        // to neither half; through a units key it read "six, HOURS ZERO". Shona has no attested clock
        // reading here (normalize.ts's NO CLOCK finding), so the colon is in the lookbehind and this stays
        // a visible `RAW-LATIN` hit rather than a confidently wrong quantity.
        expect(phonemize("06:00hrs", "sn")).toContain("hrs");
    });
});
