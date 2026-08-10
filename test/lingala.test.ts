import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/lingala/lingala.ts";
import { normalizeLingala } from "../src/languages/lingala/normalize.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Lingala / Lingála (ln) — Bantu (C30B), a major lingua franca of the Congo (~20M native
// + ~20-25M L2). Authored from Meeuwis (2020) "A Grammatical Overview of Lingála" (Revised & Extended Edition,
// describing the prestige Kinshasa variety). Signatures: PRENASALISED obstruents as single onset units
// (⟨mb nd ng nz⟩ → ᵐb ⁿd ᵑɡ ⁿz, homorganic), ⟨ny⟩ → ɲ, and — unusually for a Bantu orthography — TONE is
// WRITTEN (acute=H, háček=rising, circumflex=falling, unmarked=L) so it is rendered per nucleus (Chao letters).
// No diphthongs (vowel sequences are hiatus, each a tone-bearing nucleus). Anchored on kaikki Lingala — ⚠ with tone MEASURED,
// not folded, which is what makes the referee meaningful here at all.
describe("Lingala canonical IPA", () => {
    test("prenasalised obstruents as single onset units (homorganic)", () => {
        expect(phonemizeWord("mbɔ́tɛ")).toBe("ᵐbɔ˥tɛ˩"); // mb → ᵐb ("hello")
        expect(phonemizeWord("ndáko")).toBe("ⁿda˥ko˩"); // nd → ⁿd ("house")
        expect(phonemizeWord("nzóto")).toBe("ⁿzo˥to˩"); // nz → ⁿz ("body")
        expect(phonemizeWord("Lingála")).toBe("li˩ᵑɡa˥la˩"); // ng → ᵑɡ (the language's own name)
    });

    test("⟨ny⟩ → ɲ; 7-vowel graphemes rendered as written", () => {
        expect(phonemizeWord("nyama")).toBe("ɲa˩ma˩"); // ny → ɲ ("animal")
        expect(phonemizeWord("mabelé")).toBe("ma˩be˩le˥"); // L L H ("earth")
    });

    test("TONE is written and rendered per nucleus (H=˥, L=˩) — the tonal minimal pair", () => {
        expect(phonemizeWord("moto")).toBe("mo˩to˩"); // L L "person"
        expect(phonemizeWord("motó")).toBe("mo˩to˥"); // L H "head"
    });

    test("no diphthongs — final V+i is hiatus, each vowel its own tone-bearing nucleus", () => {
        expect(phonemizeWord("mái")).toBe("ma˥i˩"); // ma.i, not a diphthong ("water")
    });

    test("full text via the registry (numbers + tone + prenasalisation)", () => {
        const ln = getPhonemizer("ln");
        expect(ln.text("2").trim()).toBe("mi˥ba˩le˥"); // míbalé
        expect(ln.text("Mbɔ́tɛ!").trim()).toBe("ᵐbɔ˥tɛ˩ !");
    });

    // NUMBERS above kámá. Two defects: there was no ZERO word at all (0 leaked the digit), and everything ≥ 1 000
    // ran through `ordinals[Math.min(th, 10) - 1]`, clamping the thousand-multiplier at ten — so 100 000, 10⁶ and
    // 10⁹ all produced the identical "kóto zómi". Lingala's higher scales are native class-alternating nouns on a
    // myriad ladder (10⁴ mokoko/mikoko · 10⁵ elúndu/bilúndu · 10⁶ efúku/bifúku · 10⁹ epúná/bipúná), the singular
    // standing alone for a multiplier of one. Source: lingalavision.com "How to count in Lingala from 0 to
    // millions" + Omniglot "Numbers in Lingala" (libungutulu = 0). See lingala.jsonc.
    test("zero + the native scale ladder (10⁴ mokoko … 10⁹ epúná)", () => {
        const ln = getPhonemizer("ln");
        expect(ln.text("0").trim()).toBe("li˩bu˩ᵑɡu˩tu˥lu˩"); // libungutúlu — was a DIGIT-LEAK
        expect(ln.text("21").trim()).toBe("tu˥ku˥ mi˥ba˩le˥ na˩ mo˩˥ko˥"); // túkú míbalé na mǒkó
        expect(ln.text("101").trim()).toBe("ka˥ma˥ mo˩˥ko˥ na˩ mo˩˥ko˥"); // kámá mǒkó na mǒkó
        expect(ln.text("1000").trim()).toBe("ko˥to˩ mo˩˥ko˥"); // kóto is INVARIANT — always + multiplier
        expect(ln.text("10000").trim()).toBe("mo˩ko˩ko˩"); // mokoko (singular, multiplier 1)
        expect(ln.text("20000").trim()).toBe("mi˩ko˩ko˩ mi˥ba˩le˥"); // mikoko míbalé (plural + multiplier)
        expect(ln.text("100000").trim()).toBe("e˩lu˥ⁿdu˩"); // elúndu — was shared with 10⁶ and 10⁹
        expect(ln.text("1000000").trim()).toBe("e˩fu˥ku˩"); // efúku
        expect(ln.text("2000000").trim()).toBe("bi˩fu˥ku˩ mi˥ba˩le˥"); // bifúku míbalé
        expect(ln.text("1000000000").trim()).toBe("e˩pu˥na˥"); // epúná
    });
});

// TEXT NORMALIZATION (src/languages/lingala/normalize.ts). Asserted on the TEXT the layer produces rather than
// on IPA wherever the question is "which rule fired", because that is what the rules are about; a handful of
// end-to-end cases below check that what it emits really does reach the g2p.
//
// ⚠ THE CASES PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES. Lingala's corpus writes `1/3` and `2/3` and
// nothing else, so a test suite built from it would never reach the composition path or any of the guards that
// make these rules survivable — and the guards are where the risk is, since the same characters that write a
// fraction here also write legal-instrument numbers, chronology spans and dates.
describe("lingala text normalization", () => {
    test("percent, and the range that must be claimed before it", () => {
        // `likolo ya mokama` is the layer's thinnest sourcing (one constitutional sentence, both arms) — the
        // rule comment carries the citation. Postposed, as that sentence writes it.
        expect(normalizeLingala("79 % ya etando")).toBe("79 likolo ya mokama ya etando");
        expect(normalizeLingala("1,6%")).toBe("1 6 likolo ya mokama");
        // ⚠ THE ORDERING CASE: once percent has run there is no digit-pair left for the range to match, so a
        // range OF percents only works if RANGE goes first.
        expect(normalizeLingala("2-3% ya batu")).toBe("2 kino 3 likolo ya mokama ya batu");
    });

    test("de-grouping: all three separators, and the 3-digit discriminator that tells them from a decimal", () => {
        expect(normalizeLingala("5,500 bato")).toBe("5500 bato"); // was *mítáno , kámá mítáno*
        expect(normalizeLingala("1.180 km")).toBe("kilomɛtrɛ 1180"); // dot grouping → was a SENTENCE break
        expect(normalizeLingala("87 009 km2")).toBe("kilomɛtrɛ-kare 87009"); // the dominant native form
        expect(normalizeLingala("24.383.301")).toBe("24383301"); // chained
        // …and the same two marks on a 1–2 digit tail are DECIMALS, read digit by digit (no point word is
        // sourceable — see the header).
        expect(normalizeLingala("4,20")).toBe("4 2 0");
        expect(normalizeLingala("362.07")).toBe("362 0 7");
    });

    test("units are UNIT-FIRST and carry their own decimal tail", () => {
        expect(normalizeLingala("ntaka ya 120 km")).toBe("ntaka ya kilomɛtrɛ 120");
        expect(normalizeLingala("100 kg")).toBe("kilogálame 100");
        expect(normalizeLingala("35 cm")).toBe("sɛntimɛtɛlɛ 35"); // the metric-table branch, not the prose one
        expect(normalizeLingala("17 000 m²")).toBe("mɛtrɛ-kare 17000"); // `kare` is a SUFFIX on the noun
        // ⚠ REGRESSION GUARD: with a bare `\d+` operand this matched the FRACTIONAL part and emitted
        // `0,kilomɛtrɛ-kare 44` — the comma surviving as a clause pause and the quantity read as forty-four.
        expect(normalizeLingala("0,44 km²")).toBe("kilomɛtrɛ-kare 0 4 4");
        expect(normalizeLingala("-273,15 °C")).toBe("-Celsius 273 1 5");
        // A dotted designation is not a quantity (traps 28/46). Zero in this corpus; the guard is robustness.
        expect(normalizeLingala("802.11n")).toBe("802.11n");
    });

    test("a measured SPAN takes its unit once, in front", () => {
        // ⚠ REGRESSION GUARD: the single-operand arm's lookbehind excludes a letter, a digit and a dot but
        // NOT a dash, so it used to reach the span's second operand alone and emit `75 - sɛntimɛtɛlɛ 90` —
        // the unit stranded mid-span, the dash silent. ×8 in the corpus: the zoology infoboxes' length and
        // weight rows, plus a rainfall figure.
        expect(normalizeLingala("Molaí (molómi): 75 - 90 cm")).toBe("Molaí (molómi): sɛntimɛtɛlɛ 75 kino 90");
        expect(normalizeLingala("Bolaí ezalí 13-19 cm")).toBe("Bolaí ezalí sɛntimɛtɛlɛ 13 kino 19");
        expect(normalizeLingala("(1500-1800 mm)")).toBe("(milimɛtrɛ 1500 kino 1800)");
        expect(normalizeLingala("39 - 45 kg")).toBe("kilogálame 39 kino 45");
        // A span the arm DECLINES must reach the range rule whole, not with its tail already rewritten.
        expect(normalizeLingala("90-75 cm")).toBe("90-75 cm");
        // …and the narrow guard must not cost a genuine negative measurement its unit.
        expect(normalizeLingala("-5 km")).toBe("-kilomɛtrɛ 5");
    });

    test("ranges: ascending only, and the three shapes that must NOT be claimed", () => {
        expect(normalizeLingala("na mibu 1965-1975")).toBe("na mibu 1965 kino 1975");
        expect(normalizeLingala("1975-1965")).toBe("1975-1965"); // descending — a score or a season
        // the corpus's commonest hyphen shape, a birth–death pair: the regex sees `1475 - 18`, descending.
        expect(normalizeLingala("(6 mársi 1475 - 18 febwáli 1564)")).toBe("(6 mársi 1475 - 18 febwáli 1564)");
        expect(normalizeLingala("score ya 0 - 3")).toBe("score ya 0 - 3"); // ascending but SPACED single digits
        // An ISBN is a chain, not a pair — the range rule must not claim it. Step 3 gets there first and
        // spells it out digit by digit, which is the point: this is the shape that LEAKED raw digits.
        expect(normalizeLingala("ISBN 1-59427-034-1")).toBe("ISBN 1 5 9 4 2 7 0 3 4 1");
        // …and with the tag stripped, the same hyphen chain is still not a range.
        expect(normalizeLingala("1-59427-034-1")).toBe("1-59427-034-1");
        expect(normalizeLingala("Malako 16:15-18")).toBe("Malako 16:15-18"); // a scripture span
    });

    test("percent spans: the one dash the range rule may cross", () => {
        // ×2, one sentence. `%…-…%` cannot be arithmetic, and it costs no new word — `kino` either side.
        expect(normalizeLingala("pene na 20%-40% ya batu"))
            .toBe("pene na 20 likolo ya mokama kino 40 likolo ya mokama ya batu");
        expect(normalizeLingala("7.5%-10%")).toBe("7 5 likolo ya mokama kino 10 likolo ya mokama");
        // the bare-operand range in the SAME corpus sentence still goes through the ordinary arm
        expect(normalizeLingala("pene na 2-3% ya batu")).toBe("pene na 2 kino 3 likolo ya mokama ya batu");
        expect(normalizeLingala("40%-20%")).toBe("40 likolo ya mokama-20 likolo ya mokama"); // descending
    });

    test("fractions: the composed ordinal idiom, and the denominator cap that is the rule", () => {
        expect(normalizeLingala("2/3")).toBe("2 ya 3"); // attested ×4
        expect(normalizeLingala("3/4")).toBe("3 ya 4"); // the COMPOSITION — unattested in ASCII, still right
        expect(normalizeLingala("¼ ya batu").replace(/ +/gu, " ")).toBe(" mǒkó ya mínei ya batu");
        expect(normalizeLingala("Mobéko n°011/2002")).toBe("Mobéko n°011/2002"); // a legal instrument
        expect(normalizeLingala("50/51")).toBe("50/51"); // a chronology span
        expect(normalizeLingala("12/04/2014")).toBe("12/04/2014"); // a date — the third field rejects it
        expect(normalizeLingala("24/7")).toBe("24/7"); // descending
    });

    test("era markers and b.n.b., longest body first, sentence period preserved", () => {
        expect(normalizeLingala("Na mobu 586 L.T.B.,")).toBe("Na mobu 586 liboso ya tango na biso,");
        expect(normalizeLingala("ekeke ya 7 T.B.,")).toBe("ekeke ya 7 tango na biso,");
        expect(normalizeLingala("mobú ya 1979 n. Y.K.")).toBe("mobú ya 1979 nsima ya Yézu Klísto.");
        expect(normalizeLingala("útá 311 yambo Y.K.")).toBe("útá 311 yambo Yézu Klísto.");
        // ⚠ b.n.b. CLOSES A LIST, so it ends a sentence more often than not: the period is kept when what
        // follows is the end of the input or a capital, and consumed when the sentence visibly continues.
        expect(normalizeLingala("Bambata, b.n.b.")).toBe("Bambata, bôngó na bôngó.");
        expect(normalizeLingala("lokóla b.n.b. mpé")).toBe("lokóla bôngó na bôngó mpé");
    });

    test("ordinal suffixes and the ampersand", () => {
        expect(normalizeLingala("du 16ème siècle")).toBe("du ya 16 siècle"); // was raw [e˩me˩] in the IPA
        expect(normalizeLingala("le 1er janvier")).toBe("le ya libosó janvier"); // the SUPPLETIVE branch
        expect(normalizeLingala("2e éd.")).toBe("ya 2 éd.");
        // ⚠ REGRESSION GUARD: the bare `e` arm allowed an optional SPACE, and all three `\d+ e` instances in
        // the corpus are the Portuguese conjunction in quoted Portuguese text — so the rule was deleting an
        // "and" (`em ya 1533 com a invasão`). The multi-letter suffixes keep the optional gap; `e` does not.
        expect(normalizeLingala("Com a morte em 1.533 e com a invasão"))
            .toBe("Com a morte em 1533 e com a invasão");
        expect(normalizeLingala("2 ème")).toBe("ya 2"); // the gap IS tolerated where the suffix is unambiguous
        // ⚠ SPACED ON BOTH SIDES: `A&B` deletes to `AB`, one token where there were two (traps 18/26).
        expect(normalizeLingala("A&B")).toBe("A mpé B");
        expect(normalizeLingala("De Moor & JP Jacquemin")).toBe("De Moor mpé JP Jacquemin");
    });

    test("end to end — what the layer emits really is spoken by the g2p", () => {
        const ln = getPhonemizer("ln");
        expect(ln.text("79 %").trim()).toBe("tu˥ku˥ sa˩ᵐbo˩ na˩ li˩bwa˥ li˩ko˩lo˩ ja˩ mo˩ka˩ma˩");
        expect(ln.text("100 kg").trim()).toBe("ki˩lo˩ɡa˥la˩me˩ ka˥ma˥ mo˩˥ko˥");
        expect(ln.text("25 °C").trim()).toBe("ke˩lsi˩u˩s tu˥ku˥ mi˥ba˩le˥ na˩ mi˥ta˥no˩");
        expect(ln.text("2/3").trim()).toBe("mi˥ba˩le˥ ja˩ mi˥sa˥to˩");
        expect(ln.text("4,20").trim()).toBe("mi˥ne˩i˩ mi˥ba˩le˥ li˩bu˩ᵑɡu˩tu˥lu˩"); // 4 · 2 · 0
        expect(ln.text("b.n.b.").trim()).toBe("bo˥˩ᵑɡo˥ na˩ bo˥˩ᵑɡo˥ ."); // was `b . n . b .`
        expect(ln.text("A & B").trim()).toBe("a˩ ᵐpe˥ b");
    });
});
