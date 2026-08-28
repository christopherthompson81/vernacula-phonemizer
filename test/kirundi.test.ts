import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord as rn } from "../src/languages/kirundi/kirundi.ts";
import { MANIFEST } from "../src/languages/kirundi/manifest.ts";
import { normalizeKirundi } from "../src/languages/kirundi/normalize.ts";
import { numberToWords as rnNum } from "../src/languages/kirundi/numbers.ts";
import { phonemizeWord as rw } from "../src/languages/kinyarwanda/kinyarwanda.ts";
import { numberToWords as rwNum } from "../src/languages/kinyarwanda/numbers.ts";

// Canonical-IPA goldens for Kirundi / Ikirundi (rn) — Bantu (JD62, Rwanda-Rundi), Latin orthography.
// Kirundi is a NEAR-CLONE of Kinyarwanda (rw): it reuses the rw greedy g2p + the Cox comparative-grammar palatal
// series, with ONE confident delta — ⟨j⟩→d͡ʒ (the Kirundi voiced palatal affricate, vs Kinyarwanda's fricative
// ⟨j⟩→ʒ). ⚠ Referee: epitran run-Latn — crude and partly circular, so it is NOT followed blindly: its
// unverified NC-spirantisation mp→mh/nt→nh/nk→ŋx is left as a residual rather than adopted. Tone (H/L,
// unwritten) deferred.
describe("Kirundi canonical IPA — near-clone of Kinyarwanda with ⟨j⟩→d͡ʒ", () => {
    test("the ⟨j⟩ delta: Kirundi affricate d͡ʒ (vs Kinyarwanda fricative ʒ)", () => {
        expect(rn("ijana")).toBe("id͡ʒana"); // "hundred" — ⟨j⟩ → d͡ʒ
        expect(rn("jenoside")).toBe("d͡ʒenoside"); // ⟨j⟩ → d͡ʒ
        expect(rw("ijana")).toBe("iʒana"); // proof the parent differs (Kinyarwanda ʒ)
    });

    test("everything else is identical to Kinyarwanda (near-clone)", () => {
        for (const w of ["umuntu", "icyenda", "ubwenge", "kirundi", "abantu", "umunani"]) {
            expect(rn(w)).toBe(rw(w));
        }
    });

    test("shared signatures: ⟨cy⟩→kʲ palatalisation, ⟨ng⟩→ŋ, double vowel → long", () => {
        expect(rn("icyenda")).toBe("ikʲenda"); // "nine" — ⟨cy⟩ → kʲ
        expect(rn("ubwenge")).toBe("ubweŋe"); // "intelligence" — ⟨ng⟩ → ŋ (velar nasal)
        expect(rn("gatatu")).toBe("ɡatatu"); // "three"
    });
});

// Kirundi cardinal numbers. The COMPOSITOR is shared with Kinyarwanda (kinyarwanda/numbers.ts exports
// `composeRwandaRundi`, which kirundi/numbers.ts calls with the Kirundi table) — the near-clone relationship holds
// for the numeral morphology too. Sources: Omniglot "Numbers in Kirundi" (omniglot.com/language/numbers/kirundi.htm)
// and languagesandnumbers.com/how-to-count-in-rundi (run). Kirundi deltas vs rw: 7 indwi, 9 icenda (no ⟨cy⟩),
// 20 the regular mirongo ibiri, plural of ijana = amajana, 10⁶ = umuriyoni.
describe("Kirundi numbers", () => {
    test("units — the Kirundi 7 / 9 deltas", () => {
        expect(rnNum(7)).toBe("indwi"); // not the Kinyarwanda karindwi
        expect(rnNum(8)).toBe("umunani"); // invariable, same as rw
        expect(rnNum(9)).toBe("icenda"); // Kirundi has no ⟨cy⟩
        expect(rwNum(9)).toBe("icyenda"); // proof the parent differs
        expect(phonemize("9", "rn")).toBe("it͡ʃenda");
    });

    test("tens — mirongo + the i- series; 20 is REGULAR (unlike rw makumyabiri)", () => {
        expect(rnNum(18)).toBe("icumi na umunani");
        expect(rnNum(20)).toBe("mirongo ibiri");
        expect(rwNum(20)).toBe("makumyabiri"); // the rw irregular, for contrast
        expect(rnNum(42)).toBe("mirongo ine na kabiri");
        expect(rnNum(80)).toBe("mirongo inani");
        expect(phonemize("20", "rn")).toBe("miɾoŋo ibiɾi");
    });

    test("hundreds — ijana / amajana + the class-6 a- series", () => {
        expect(rnNum(100)).toBe("ijana");
        expect(rnNum(200)).toBe("amajana abiri"); // rw has magana
        expect(rnNum(555)).toBe("amajana atanu na mirongo itanu na gatanu");
        expect(phonemize("200", "rn")).toBe("amad͡ʒana abiɾi"); // the ⟨j⟩→d͡ʒ delta again
    });

    test("thousands and millions", () => {
        expect(rnNum(1000)).toBe("igihumbi");
        expect(rnNum(2000)).toBe("ibihumbi bibiri");
        expect(rnNum(12345)).toBe("ibihumbi icumi na kabiri na amajana atatu na mirongo ine na gatanu");
        expect(rnNum(1000000)).toBe("umuriyoni"); // rw: miriyoni
        expect(phonemize("1000000", "rn")).toBe("umuɾijoni");
    });

    // ⚠ THE EIGHTH PLACE KIRUNDI IS NOT KINYARWANDA — and here the divergence is an ABSENCE. rw gained a 10⁹
    // word (`miriyari`, attested ×8 in rw.wikipedia); rn did NOT, and must not inherit it. rn.wikipedia has
    // zero hits for miliyari / miriyari / miliyaridi / miriyaridi / umuliyaridi / umuriyaridi / miliaridi
    // while writing the MILLION word freely (imiliyoni ×19, miliyoni ×7, umuliyoni ×3, umuriyoni ×1) — the
    // silence is about the magnitude, not the corpus. The one Kirundi attestation found anywhere is a news
    // article's PLURAL `imiliyaridi 4`; this slot needs a singular to match `umuriyoni`, and coining one from
    // a bare plural is the Fula `tere` failure. So rn's ceiling STAYS at 10⁹ — and 10⁹ is still spoken.
    test("⚠ 10⁹ is UNAUTHORED for Kirundi — it falls back to digits, and rw's word must not leak in", () => {
        const billion = rnNum(1000000000);
        expect(billion).toBe("rimwe zeru zeru zeru zeru zeru zeru zeru zeru zeru");
        expect(billion).not.toContain("miriyari"); // rw's word, which rn has no evidence for
        expect(rwNum(1000000000)).toBe("miriyari"); // proof the parent DOES compose it — the tables differ
        // The fallback is never empty and never raw ASCII (test/bignum-fallback.test.ts), and it reads the
        // digits rather than a placeholder.
        expect(billion).not.toMatch(/\d/u);
        expect(rnNum(1000000001)).not.toBe(billion);
        expect(phonemize("1000000000", "rn")).not.toMatch(/\d/u);
        // …and below the ceiling Kirundi still composes normally.
        expect(rnNum(999999999)).toContain("umuriyoni");
    });
});

// ── TEXT NORMALIZATION (src/languages/kirundi/normalize.ts) ────────────────────────────────────────────────
// Evidence: tools/corpus/mined/rn.jsonc (4,125 rn.wikipedia paragraph segments) + tools/corpus/attest/rn.jsonc.
// ⚠ These pin the rule's BRANCHES, not the corpus's instances (trap 13) — and in particular they pin the SEVEN
// places where Kirundi diverges from Kinyarwanda, because rw's layer is the template this one deliberately did
// not copy. A regression toward rw is the failure mode these tests exist to catch.
describe("Kirundi text normalization", () => {
    test("the squared word is kwadarato, NOT Kinyarwanda's kare (which means 'early' in Kirundi)", () => {
        // corpus 36:1, rn.wikipedia 29/20, slot probe `--after ibirometero,kirometero` → kwadarato ×3, no competitor
        expect(normalizeKirundi("606km²")).toBe("ibirometero kwadarato 606");
        expect(normalizeKirundi("km² 517")).toBe("ibirometero kwadarato 517"); // unit BEFORE the number
        expect(normalizeKirundi("3.287.263 km2")).toBe("ibirometero kwadarato 3287263"); // ASCII exponent
        // the DENOMINATOR takes the class-7 SINGULAR — `Abantu 542 ku kirometero kwadarato`
        expect(normalizeKirundi("(233/km²)")).toBe("(233 kuri kirometero kwadarato)");
        expect(normalizeKirundi("kilometero kare")).toContain("kare"); // never rewritten TO kare
    });

    // ⚠ A CUBE IS NOT A SQUARE, AND THE THREE PATHS NOW FAIL THE SAME WAY (#1135). No Kirundi cube word is
    // attested (`m³`/`km³` are ×0 — the header's trap 51 floor), so an undeclared power keeps the unit's
    // reading and HANDS THE EXPONENT BACK, which is the shared tier's own convention. Before this, the two
    // LOCAL arms gave the cube the SQUARE's word while the tier did not, so one construct read three ways
    // depending only on where the number sat. A wrong word is worse than a missing one.
    test("a cube keeps the unit and hands its exponent back — it is never given the square's word", () => {
        // step 4, the unit BEFORE its number — this is the arm that announced a square
        expect(normalizeKirundi("km³ 517")).toBe("ibirometero³ 517");
        // ⚠ THE ASCII SPELLING `km3 517` NEVER REACHES THIS ARM — step 3's space-grouping rule eats the `3`
        // first (`km3 517` → `km2517`-shaped), which is a separate, filed defect (#1136). Asserted there, not
        // here, so this test measures one rule.
        // ⚠ BUT STEP 8's ARM HAS NO SUCH BLOCKER, AND ITS ASCII FORM IS EXACTLY WHY THE CUBE IS HANDED BACK
        // AS A SUPERSCRIPT: a raw `3` is a DIGIT, so the tokenizer claims it and the number path SPEAKS it.
        // Re-emitting it read `(233/km3)` as *…kuri kirometero GATATU* — "per kilometre three", a quantity
        // invented inside a density figure, which is worse than either the missing word or the wrong one.
        expect(normalizeKirundi("(233/km3)")).toBe("(233 kuri kirometero³)");
        expect(normalizeKirundi("3372 hab/km3")).toBe("3372 hab kuri kirometero³");
        // ⚠ THE ASSERTION IS ON WHAT FOLLOWS THE UNIT, not on the whole string: 233 is *…na ɡatatu* itself,
        // so a bare "does not contain three" would pass for the wrong reason.
        expect(phonemize("(233/km3)", "rn").trim().endsWith("kiɾometeɾo")).toBe(true);
        // step 8, the bare denominator — the same arm, the same defect
        expect(normalizeKirundi("(233/km³)")).toBe("(233 kuri kirometero³)");
        // the shared tier, number-then-unit — unchanged, and it is what the other two now agree with
        expect(normalizeKirundi("517 km³")).toBe("ibirometero³ 517");
        // ⚠ THE SQUARE IS UNAFFECTED — it has a word, and all three paths still emit it
        expect(normalizeKirundi("km² 517")).toBe("ibirometero kwadarato 517");
        expect(normalizeKirundi("517 km²")).toBe("ibirometero kwadarato 517");
        expect(normalizeKirundi("(233/km²)")).toBe("(233 kuri kirometero kwadarato)");
        // and `kwadarato` is never spoken for a cube, on any path
        for (const s of ["km³ 517", "517 km³", "(233/km³)", "mm³ 1000"])
            expect(normalizeKirundi(s)).not.toContain("kwadarato");
    });

    // ⚠ #1136 — THE ORDER BETWEEN THE UNIT-BEFORE RULE AND DE-GROUPING. De-grouping's SPACE arm claims a
    // head digit preceded by a LETTER, so with it running first `km2 517` — the ASCII spelling of `km² 517`
    // — matched as `2 517`, glued the exponent onto the number (517 read as 2,517) and left `km` in the
    // phoneme stream RAW. The unit rule now runs first, so the unit is a WORD before de-grouping looks.
    test("a unit's ASCII exponent is not a thousands head — but a currency prefix's digit still is", () => {
        expect(normalizeKirundi("km2 517")).toBe("ibirometero kwadarato 517");
        expect(normalizeKirundi("mm2 500")).toBe("milimetero kwadarato 500");
        // ⚠ ALL FOUR SEPARATORS, because de-grouping's space arm takes all four: with this lookahead at
        // space+NBSP only, a NNBSP or thin space made THIS rule decline and de-grouping claimed the
        // exponent anyway — the same defect one axis over.
        // ⚠ ASSERTED ON THE READING, not the intermediate text: the separator itself survives normalization
        // (it is whitespace, and `tidy` only collapses RUNS), so what has to be equal is what is spoken.
        for (const sep of ["\u00a0", "\u202f", "\u2009"]) {
            expect(phonemize(`km2${sep}517`, "rn")).toBe(phonemize("km2 517", "rn"));
            expect(phonemize(`mm3${sep}517`, "rn")).toBe(phonemize("mm3 517", "rn"));
        }
        // ⚠ THE MULTI-GROUP CASE IS AMBIGUOUS AND THIS IS THE SIDE WE TAKE, not a case with one answer.
        // `km2 517 000` reads as km² + 517,000; the competing reading is `km` + a misplaced space in
        // 2,517,000. Glued `km2` is the ordinary ASCII spelling of `km²` while the alternative needs the
        // writer to have DROPPED the space after `km`, so the exponent reading is the likelier one — but it
        // does change the quantity, so it is recorded here rather than presented as unambiguous. ×0 in the
        // corpus, and the old behaviour (`km2517000`) was not better: it leaked `km` AND read 2,517,000.
        expect(normalizeKirundi("km2 517 000")).toBe("ibirometero kwadarato 517000");
        // and the cube reaches #1135's handling now that step 3 sees the token at all
        expect(normalizeKirundi("km3 517")).toBe("ibirometero³ 517");
        // ⚠ THE OBVIOUS GUARD WOULD HAVE BROKEN THIS: `R2 500` IS a grouped thousand with a currency
        // prefix, so "a head may not follow a letter" would split 2,500 into two numbers. The
        // discriminator is whether the letters are a UNIT KEY, not whether there are letters.
        expect(normalizeKirundi("R2 500")).toBe("R2500");
        // the spaced forms this rule was written for are untouched by the reorder
        expect(normalizeKirundi("km 1,965")).toBe("ibirometero 1965");
        expect(normalizeKirundi("km 1 965")).toBe("ibirometero 1965");
        expect(normalizeKirundi("mm 1.000")).toBe("milimetero 1000");
        expect(normalizeKirundi("km² 517")).toBe("ibirometero kwadarato 517");
    });

    test("three grouping conventions coexist — French dots, Anglo commas, and spaces", () => {
        expect(normalizeKirundi("12.100.000")).toBe("12100000");
        expect(normalizeKirundi("104 000 000 000")).toBe("104000000000");
        // ⚠ THE ANGLO FORM: comma grouping AND a dot decimal in ONE number, ×9 in the corpus. rw's trailing
        // guard `(?!\d|[.,]\d)` rejects this outright, which is why rn's comma arm uses `(?!\d|,\d)`.
        expect(normalizeKirundi("1,964.54")).toBe("1964 5 4");
        expect(normalizeKirundi("Ibirometero kwadarato 1,457.40.")).toBe("Ibirometero kwadarato 1457 4 0.");
    });

    test("a dotted d.m.yyyy date spends its dots — a cell rw's corpus does not contain", () => {
        expect(normalizeKirundi("26.08.1940")).toBe("26 08 1940");
        expect(normalizeKirundi("2.2.1946")).toBe("2 2 1946");
        // and the date span stays declined, because it now runs backwards
        expect(normalizeKirundi("24.11.1949 - 17.12.2020")).toBe("24 11 1949 - 17 12 2020");
    });

    test("the span joiner is chosen by what is spanned — years take the kuva frame, quantities do not", () => {
        // 14/14 of Kirundi's four-digit year spans carry `kuva`; zero stand bare
        expect(normalizeKirundi("(1981-1989)")).toBe("(kuva 1981 gushika 1989)");
        expect(normalizeKirundi("kuva 2008 - 2009")).toBe("kuva 2008 gushika 2009"); // an existing kuva is not doubled
        // a QUANTITY span takes the bare infix — `ibilometero 26 gushika kuri 28`
        expect(normalizeKirundi("metero 1.500 / 1.800")).toBe("metero 1500 gushika kuri 1800");
        expect(normalizeKirundi("2009-2005")).toBe("2009-2005"); // descending: declined
    });

    // ⚠ A SPAN THAT ENDS THE CLAUSE IS STILL A SPAN (playbook trap 58), and this was checked against rn's
    // own corpus rather than inherited from rw, which this layer diverges from deliberately (trap 55). The
    // right guard rejected a bare `.` or `,` — a sentence end far more often than a number's interior — so
    // all three of rn's clause-final year spans read as two juxtaposed cardinals with no `gushika`.
    // ⚠ AND THE SUPPRESSION LOOK-BACK IS PINNED WITH THEM: `kuva muri 2010 – 2012` must not double the
    // `kuva` the text already wrote, which the old look-back could not see across the intervening word.
    test("a clause-final span keeps its joiner, its pause, and does not double `kuva`", () => {
        expect(normalizeKirundi("Tübingen 1997–2005.")).toBe("Tübingen kuva 1997 gushika 2005.");
        expect(normalizeKirundi("kuva 2005 – 2007.")).toBe("kuva 2005 gushika 2007.");
        expect(normalizeKirundi("Mugihe co kuva muri 2010 – 2012.")).toBe("Mugihe co kuva muri 2010 gushika 2012.");
        expect(normalizeKirundi("Kuva muri 2007 – 2008 yariko")).toBe("Kuva muri 2007 gushika 2008 yariko");
        // a span with no `kuva` in front still gets the frame's own
        expect(normalizeKirundi("Ivyo 1996—2003)")).toBe("Ivyo kuva 1996 gushika 2003)");
        // and a designation that ends a sentence is still not a span
        expect(normalizeKirundi("COVID-19.")).toBe("COVID-19.");
    });

    test("a TEMPERATURE span takes `na`, not the gushika frame", () => {
        // `hagati ya 17°C na 29°C` (corpus) and `dogere selisiyusi 20 na 25` (wiki) — one noun, `na` between
        expect(normalizeKirundi("27/28 ° C")).toBe("dogere 27 na 28");
        expect(normalizeKirundi("dogere 22/25")).toBe("dogere 22 na 25"); // the noun is already there
    });

    test("degrees: the scale LETTER is claimed but NO scale name is emitted", () => {
        // rn reads a Celsius temperature as bare `dogere` in 6 of its 8 wiki instances; `selisiyusi` is ×0 in
        // the corpus and the Burundian press writes `degre Celsius`. The C must not reach the g2p as [t͡ʃ].
        expect(normalizeKirundi("30 ° C")).toBe("dogere 30");
        expect(normalizeKirundi("0,6 ° C")).toBe("dogere 0 6");
        expect(phonemize("20 °C", "rn")).toBe("doɡeɾe miɾoŋo ibiɾi");
        expect(normalizeKirundi("9°55'")).toBe("dogere 9 55'"); // a coordinate; rn spells its directions out
    });

    test("percent is kw'ijana, postposed, and said ONCE when the clause already spells it", () => {
        expect(normalizeKirundi("30%")).toBe("30 kw'ijana");
        // trap 12 — the corpus writes the word AND the parenthesised sign five times
        expect(normalizeKirundi("bane kw'ijana (4%)")).toBe("bane kw'ijana (4)");
        expect(normalizeKirundi("ibice mirongo icenda kw’ijana (90%)")).toBe("ibice mirongo icenda kw’ijana (90)");
    });

    test("the dollar is amadorari — the ⟨r⟩ spelling Kirundi's own orthography ruling prescribes", () => {
        // probing Kinyarwanda's `amadolari` returned 0/0 and nearly shipped a refusal (trap 40)
        expect(normalizeKirundi("27 664 $")).toBe("amadorari 27664");
        expect(normalizeKirundi("$ 4,000")).toBe("amadorari 4000");
    });

    test("the minus stays UNREAD, deliberately — no Kirundi word for the sign is attested", () => {
        // trap 24: a red gate that is correct beats a green gate that is wrong. rw's `munsi ya zeru` is a
        // KINYARWANDA citation and is not borrowed; the sign inverts, so the defect stays visible.
        expect(normalizeKirundi("-39°C")).toBe("dogere -39");
        expect(normalizeKirundi("+1 000 000")).toBe("+1000000");
    });

    test("no clock and no duration rule — rn's colons are Bible verses, not times", () => {
        // `saa`/`amasaha`/`iminota`/`amasegonda` are all ×0 in rn's corpus, and all 6 colon runs are references
        expect(normalizeKirundi("IVYAKOZW 11:22")).toBe("IVYAKOZW 11 22");
        expect(normalizeKirundi("Mariko 16:16")).toBe("Mariko 16 16");
        expect(normalizeKirundi("12:22/24")).toBe("12 22/24"); // the slash span guard declines a verse
    });

    test("dotted capital runs lose their interior sentence breaks, and a dot is only ever KEPT", () => {
        expect(normalizeKirundi("( E.P.E.L )")).toBe("( EPEL )"); // the dotless-final shape
        expect(normalizeKirundi("(B.E.R.)")).toBe("(BER)");
        expect(normalizeKirundi("L. L. Zamenhof")).toBe("LL Zamenhof");
    });

    test("the one-letter unit key `m` is NOT declared — Kirundi's locative elision needs it", () => {
        // rw declares `m`; rn writes `50 m’ubumwe`, where m' is the locative and not a metre
        expect(normalizeKirundi("zigira 49 na 50 m’ubumwe bwa Leta")).toBe("zigira 49 na 50 m’ubumwe bwa Leta");
        // and a genuine decimal glued to the two-letter key still reads, because NOT_VERSION needs one letter
        expect(normalizeKirundi("196.7km²")).toBe("ibirometero kwadarato 196 7");
    });

    test("the ampersand reads as the manifest's own conjunction", () => {
        expect(normalizeKirundi("R & D")).toBe(`R ${MANIFEST.numbers.and} D`);
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// #1075 — the bignum fallback used to re-read the float it exists to bypass.
//
// ⚠ FOUND IN rw AND REPORTED RATHER THAN COPIED (#1074): a sibling is a hypothesis, not a source. What made
// it rn's defect too is that the compositor is genuinely SHARED — `composeRwandaRundi` already took `raw`;
// only Kirundi's wrapper and its one call site dropped it. The reading was a confidently WRONG quantity,
// not a drop: the sentence still scans, which is why no leak gate and no referee named it, and rn's golden
// carries no digit run long enough to reach it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe("a numeral past 2^53 reads the digits the writer typed", () => {
    const words = (s: string): string[] => phonemize(s, "rn").trim().split(" ");

    test("the low digits are the token's, not the double's", () => {
        // 9007199254740993 is 2^53+1; as a double it IS 2^53, so re-stringifying reads …992.
        expect(words("9007199254740993").slice(-3).join(" ")).toBe("it͡ʃenda it͡ʃenda ɡatatu"); // …993, was …kabiɾi (…992)
        expect(words("9007199254740993")).toHaveLength(16);
    });

    test("and above 1e21, where String(n) is exponent form, every digit is still read", () => {
        // `String(1e21)` is "1e+21" — the `e` and `+` are table misses that join as empty strings.
        expect(words("1000000000000000000000")).toHaveLength(22);
        expect(words("12345678901234567890")).toHaveLength(20);
    });

    test("the composed path is untouched — this only changes the fallback", () => {
        expect(phonemize("42", "rn").trim()).toBe("miɾoŋo ine na kabiɾi");
        expect(phonemize("1000", "rn").trim()).toBe("iɡihumbi");
    });
});
