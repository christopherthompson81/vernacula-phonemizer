import { describe, expect, test } from "vitest";

import { createEstonian, phonemizeWord } from "../src/languages/estonian/estonian.ts";
import {
    NOMINATIVE,
    isUnreadableEstonian,
    normalizeEstonian,
    normalizeEstonianInitialisms,
    ordinal,
} from "../src/languages/estonian/normalize.ts";
import { getPhonemizer, prePass } from "../src/registry.ts";

// Estonian (et, eesti keel) — Uralic (Finnic, ~1.1M), sibling of Finnish. A greedy phonemic grapheme scan +
// gemination (double letter → [Cː]/[Vː]) + FIXED first-syllable stress. Estonian specifics: ⟨b d g⟩ are the
// voiceless-lenis stops → plain b/d/ɡ, the 9 vowels incl. ⟨õ⟩→ɤ ⟨ä ö ü⟩→æ ø y, NO n→ŋ. Palatalization + the
// three-way QUANTITY (half-long) are only partially orthographic → folded in the referee eval.
// Referee: wikipron est_latn_broad.
describe("Estonian canonical IPA — Finnic greedy g2p + gemination + first-syllable stress", () => {
    const et = createEstonian();

    test("the 9 vowels (õ→ɤ, ä→æ, ö→ø, ü→y, a→ɑ) + diphthongs", () => {
        expect(phonemizeWord("õun")).toBe("ˈɤun"); // ⟨õ⟩ → ɤ, ⟨õu⟩ diphthong
        expect(phonemizeWord("külm")).toBe("kˈylm"); // ⟨ü⟩ → y
        expect(phonemizeWord("töö")).toBe("tˈøː"); // ⟨ö⟩ → ø, doubled → long
        expect(phonemizeWord("kõik")).toBe("kˈɤik"); // ⟨õ⟩ + ⟨õi⟩ diphthong
        expect(phonemizeWord("pea")).toBe("pˈeɑ"); // ⟨ea⟩ two vowels, stress on the first
    });

    test("gemination (double letter → long) — but a double consonant after a consonant is a CLUSTER (compound)", () => {
        expect(phonemizeWord("kass")).toBe("kˈɑsː"); // ⟨ss⟩ after a vowel → geminate [sː]
        expect(phonemizeWord("tikk")).toBe("tˈikː"); // ⟨kk⟩ → [kː]
        expect(phonemizeWord("raamat")).toBe("rˈɑːmɑt"); // ⟨aa⟩ → long [ɑː]
        expect(phonemizeWord("keskkool")).toBe("kˈeskkoːl"); // kesk+kool: the ⟨kk⟩ after ⟨s⟩ stays a CLUSTER, not [kː]
    });

    test("⟨b d g⟩ voiceless-lenis → b/d/ɡ; NO n→ŋ; fixed first-syllable stress", () => {
        expect(phonemizeWord("Eesti")).toBe("ˈeːsti"); // first-syllable stress, ee→long
        expect(phonemizeWord("linn")).toBe("lˈinː"); // ⟨n⟩ stays n (no velarization)
        expect(phonemizeWord("õpetaja")).toBe("ˈɤpetɑjɑ"); // stress on the first syllable even when it's a bare vowel
    });

    test("cardinal numbers: tens (kakskümmend), hundreds (kakssada), teens (üksteist)", () => {
        expect(et.text("11").trim()).toBe("ˈyksteist"); // üksteist
        expect(et.text("21").trim()).toBe("kˈɑkskymːend ˈyks"); // kakskümmend üks
        expect(et.text("234").trim()).toBe("kˈɑkssɑdɑ kˈolmkymːend nˈeli"); // kakssada kolmkümmend neli
        expect(et.text("2000").trim()).toBe("kˈɑks tˈuhɑt"); // kaks tuhat
        expect(et.text("1000000").trim()).toBe("ˈyks mˈiljon"); // üks miljon (keeps the numeral, unlike tuhat)
    });

    test("loan letters nativized (c→k, x→ks, w→v, y→i) + accented vowels via text()", () => {
        expect(phonemizeWord("taxi")).toBe("tˈɑksi"); // ⟨x⟩ → ks
        expect(et.text("Aragón").trim()).toBe("ˈɑrɑɡon"); // ⟨ó⟩ read (not split/dropped) via text()
    });

    test("clause assembly", () => {
        expect(et.text("Tere, Eesti!").trim()).toBe("tˈere , ˈeːsti !");
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// TEXT NORMALIZATION — src/languages/estonian/normalize.ts
//
// ⚠ THESE PIN THE RULES' BRANCHES, NOT THE CORPUS'S INSTANCES (trap 13). The Estonian ordinal is a
// table-plus-composition rule with five branches (units, teens, tens, hundreds, thousands) crossed with a
// case ending, and the corpus exercises years and centuries heavily while never writing a bare hundreds
// ordinal — so the branch the corpus does NOT reach is pinned on a value the corpus does not contain.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe("Estonian normalization — the ordinal, its cases, and the branch boundaries", () => {
    // ⚠ THE LADDER, pinned at every branch boundary, because trap 56's worst instance was a silent 10×
    // error whose every emitted word was well-formed. Three forms per value: genitive, adessive, nominative.
    test("the ordinal ladder — units / teens / tens / tens+unit / hundreds / thousands", () => {
        expect(ordinal(1, NOMINATIVE)).toBe("esimene"); // suppletive, and a referee lemma
        expect(ordinal(2, NOMINATIVE)).toBe("teine"); // suppletive, and a referee lemma
        expect(ordinal(3, NOMINATIVE)).toBe("kolmas"); // the regular -s series begins, referee lemma
        expect(ordinal(9, NOMINATIVE)).toBe("üheksas");
        expect(ordinal(10, NOMINATIVE)).toBe("kümnes"); // the tens formant, standing alone
        expect(ordinal(11, NOMINATIVE)).toBe("üheteistkümnes"); // TEENS: genitive unit + teistkümnes
        expect(ordinal(19, NOMINATIVE)).toBe("üheksateistkümnes");
        expect(ordinal(20, NOMINATIVE)).toBe("kahekümnes"); // TENS: genitive unit + kümnes
        // TENS+UNIT: only the UNIT inflects — *kahekümne teine*, never *kahekümnendas teine*. Attested on
        // et.wikipedia ×3/3 in the adessive (`tee kahekümne teisel kilomeetril`).
        expect(ordinal(22, NOMINATIVE)).toBe("kahekümne teine");
        expect(ordinal(22, "l")).toBe("kahekümne teisel");
        // HUNDREDS — the branch the corpus never reaches, so it is pinned on values it does not contain.
        expect(ordinal(100, NOMINATIVE)).toBe("sajas");
        expect(ordinal(100, "l")).toBe("sajandal"); // attested ×6/6 (`sajandal sünniaastapäeval`)
        expect(ordinal(126, NOMINATIVE)).toBe("saja kahekümne kuues");
        expect(ordinal(900, NOMINATIVE)).toBe("üheksasajas");
        // THOUSANDS, and the year composition the wiki states definitionally.
        expect(ordinal(1000, NOMINATIVE)).toBe("tuhandes");
        expect(ordinal(2000, NOMINATIVE)).toBe("kahe tuhandes");
        expect(ordinal(2011, "l")).toBe("kahe tuhande üheteistkümnendal");
        expect(ordinal(9999, "")).toBe("üheksa tuhande üheksasaja üheksakümne üheksanda");
    });

    // The et.wikipedia numeral article states this reading verbatim, contrasting it with `aastal 1924`:
    // "See juhtus tuhande üheksasaja kahekümne neljandal aastal. '1924. aastal'". Round-tripping the
    // citation is the strongest single check this layer has.
    test("the definitional wiki citation round-trips exactly", () => {
        expect(ordinal(1924, "l")).toBe("tuhande üheksasaja kahekümne neljandal");
        expect(normalizeEstonian("1924. aastal")).toBe("tuhande üheksasaja kahekümne neljandal aastal");
    });

    // The ordinal AGREES IN CASE with its head noun, which is why the rule reads the noun's identity and
    // not merely its lowercase-ness (trap 14: the agreement is applied to WORDS, inside the rule).
    test("the ordinal takes the head noun's case", () => {
        expect(normalizeEstonian("19. sajandil")).toBe("üheksateistkümnendal sajandil"); // adessive
        expect(normalizeEstonian("1913. aasta")).toBe("tuhande üheksasaja kolmeteistkümnenda aasta"); // genitive
        expect(normalizeEstonian("2005. aastast")).toBe("kahe tuhande viiendast aastast"); // elative
        expect(normalizeEstonian("2012. aastaks")).toBe("kahe tuhande kaheteistkümnendaks aastaks"); // translative
        expect(normalizeEstonian("1766. aastat")).toBe("tuhande seitsmesaja kuuekümne kuuendat aastat"); // partitive
        // ⚠ THE TERMINATIVE IS THE ONE CASE WITHOUT AGREEMENT — see the next test.
        expect(normalizeEstonian("19. sajandini")).toBe("üheksateistkümnenda sajandini");
        expect(normalizeEstonian("1920. aastatel")).toBe("tuhande üheksasaja kahekümnendatel aastatel"); // plural
        expect(normalizeEstonian("1980. aastail")).toBe("tuhande üheksasaja kaheksakümnendail aastail"); // short plural
        expect(normalizeEstonian("9. augustil")).toBe("üheksandal augustil"); // a month, adessive
        expect(normalizeEstonian("24. oktoober")).toBe("kahekümne neljas oktoober"); // a month, NOMINATIVE
    });

    // ⚠ THE CONCORD EXCEPTION, PINNED AS A BRANCH RATHER THAN AS ITS INSTANCES (trap 13). An Estonian
    // attribute agrees with its head in every case EXCEPT the terminative `-ni`, the essive `-na`, the
    // abessive `-ta` and the comitative `-ga`, where it stands in the GENITIVE — the ending is on the HEAD
    // only, exactly once. `ni` is the one of the four this corpus writes (7 contexts, 9 ordinals).
    //
    // ⚠ AND THE TOKEN COUNTS ALONE WOULD HAVE CONFIRMED THE BUG: `kolmandani` is attested ×2/2,
    // `neljandani` ×1/1, `kaheksandani` ×3/3 — but every example is a HEADLESS substantivised ordinal
    // (*"esimesest kolmandani"*), never an attribute. What separates the readings is the FRAME:
    // `kolmanda sajandini` ×1/1 attested in exactly this shape (*"…alates teisest sajandist eKr kuni
    // KOLMANDA SAJANDINI pKr."*) against `kolmandani sajandini` 0/0, absent.
    test("the terminative takes a GENITIVE attribute, not an agreeing one", () => {
        expect(normalizeEstonian("19. sajandini")).toBe("üheksateistkümnenda sajandini");
        expect(normalizeEstonian("1868. aastani")).toBe("tuhande kaheksasaja kuuekümne kaheksanda aastani");
        // The corpus's own spelled-out span, whose right operand is the terminative frame the probe attests.
        expect(normalizeEstonian("kuni 9. oktoobrini 1933")).toBe("kuni üheksanda oktoobrini 1933");
        expect(normalizeEstonian("3.–8. sajandini")).toBe("kolmanda kaheksanda sajandini");
        expect(normalizeEstonian("15.–16. eluaastani")).toBe("viieteistkümnenda kuueteistkümnenda eluaastani");
        // …and the OTHER nine endings still AGREE, so the exception is one ending and not a rewrite.
        expect(normalizeEstonian("19. sajandil")).toBe("üheksateistkümnendal sajandil");
        expect(normalizeEstonian("2005. aastast")).toBe("kahe tuhande viiendast aastast");
    });

    // ⚠ THE PLURAL REFUSAL AND ITS PROPAGATION. *teine* has no composable plural stem (*teiste*, not
    // *teise+te*), so a plural ending on a numeral ending in 1 or 2 is declined — and the refusal has to
    // travel back up the recursion instead of interpolating. A non-null assertion here once produced
    // *tuhande üheksasaja kahekümne UNDEFINED*: every other word well-formed Estonian, invisible to every
    // leak class, DROP probe and referee. Trap 56.
    test("a plural ending on a 1- or 2-final numeral is refused, and the refusal propagates", () => {
        expect(ordinal(1920, "tel")).toBe("tuhande üheksasaja kahekümnendatel");
        expect(ordinal(1921, "tel")).toBeUndefined();
        expect(ordinal(1922, "tel")).toBeUndefined();
        expect(ordinal(2, "tel")).toBeUndefined();
        expect(normalizeEstonian("1921. aastatel")).toBe("1921. aastatel"); // untouched, digits and period kept
    });

    // ⚠ THE MEASURED INVARIANT: zero sentence-final pauses are lost. The lookahead is a whitelisted
    // lowercase head noun, so a period before a capital, before a digit, or at the end of a segment is
    // outside every pattern in the file by construction.
    test("a sentence period is never claimed as an ordinal dot", () => {
        expect(normalizeEstonian("aastal 1964. See nägi ette")).toBe("aastal 1964. See nägi ette");
        expect(normalizeEstonian("Historical Method. New York 1946.")).toBe("Historical Method. New York 1946.");
        expect(normalizeEstonian("9. augustil 1985. 12. detsembril 1985"))
            .toBe("üheksandal augustil 1985. kaheteistkümnendal detsembril 1985");
        expect(normalizeEstonian("1. ametlik")).toBe("esimene ametlik"); // a counted nominative head
        expect(normalizeEstonian("1. tundmatu")).toBe("1. tundmatu"); // an UNLISTED head noun: untouched
    });

    // Both operands are read; only the connective is refused, because the corpus's own spelled-out ordinal
    // span puts DIFFERENT cases on the two operands (`18. augustist kuni 9. oktoobrini`) and this rule has
    // one head noun to read a case from.
    test("the ordinal coordination and the ordinal range", () => {
        expect(normalizeEstonian("7. ja 6. sajandil")).toBe("seitsmendal ja kuuendal sajandil");
        expect(normalizeEstonian("1920.–1940. aastatel"))
            .toBe("tuhande üheksasaja kahekümnendatel tuhande üheksasaja neljakümnendatel aastatel");
    });
});

describe("Estonian normalization — the numeric and symbol rules", () => {
    test("space-grouped thousands de-group before anything reads the digits", () => {
        expect(normalizeEstonian("84 000 km²")).toBe("84000 km²");
        expect(normalizeEstonian("2 831 741 elanikku")).toBe("2831741 elanikku"); // two joints, one match
        expect(normalizeEstonian("28 150 000 eurot")).toBe("28150000 eurot");
        expect(normalizeEstonian("30 9")).toBe("30 9"); // not three digits: never fused
        // ⚠ THE HEAD IS 1–3 DIGITS WITH A NON-ZERO LEAD, which the comment always claimed and the regex did
        // not: `(\d)[ ](\d{3})` fused ANY digit run against a following triple, so a year and a count became
        // one seven-digit number. Latent in this corpus (all 48 matches are genuine groupings) and pinned as
        // the branch, not as an instance.
        expect(normalizeEstonian("aastal 1985 200 inimest")).toBe("aastal 1985 200 inimest");
    });

    // ⚠ NO COMMA-GROUPING ARM and NO DOT-DECIMAL ARM — both measured on et's own corpus, in opposite
    // directions from the fi sibling's answers.
    test("the decimal is the COMMA; the dot is a citation and the comma is never a grouping", () => {
        expect(normalizeEstonian("74,2%")).toBe("74 koma 2%");
        expect(normalizeEstonian("120,758 miljardit")).toBe("120 koma 7 5 8 miljardit"); // a real 3-place decimal
        expect(normalizeEstonian("Diogenes Laertios 5.14")).toBe("Diogenes Laertios 5.14"); // a citation, untouched
        expect(normalizeEstonian("1,6 cm")).toBe("1 koma 6 cm"); // the unit adjacency SURVIVES for the tier
    });

    // `kuni` is an INFIX in this corpus between two bare nominatives (`kestab tavaliselt kaks kuni neli
    // nädalat`), which is what breaks Finnish's refusal for this language (trap 55).
    test("ranges take `kuni`, ascending only, and a decimal operand is declined", () => {
        expect(normalizeEstonian("1912–1913")).toBe("1912 kuni 1913");
        expect(normalizeEstonian("70–110 cm")).toBe("70 kuni 110 cm");
        expect(normalizeEstonian("3000...4000 m")).toBe("3000 kuni 4000 m"); // the ellipsis span
        expect(normalizeEstonian("3000–2000 eKr")).toBe("3000–2000 enne Kristust"); // descending: declined
        expect(normalizeEstonian("14,5-30 atm")).toBe("14 koma 5-30 atm"); // decimal operand: declined
        expect(normalizeEstonian("1750/1500–500")).toBe("1750/1500–500"); // the `/` guard
        // ⚠ A SENTENCE PERIOD AFTER THE RIGHT OPERAND IS NOT A DOTTED NUMBER. The right guard used to carry
        // `.` and declined 9 correct spans for it; the LEFT guard is what rejects a dotted number, and it
        // still does — measured differentially at 9 segments changed, 9 correct `kuni` gained, 0 regressed.
        expect(normalizeEstonian("lk 137–151.")).toBe("lk 137 kuni 151.");
        expect(normalizeEstonian("1944–1980.")).toBe("1944 kuni 1980.");
        expect(normalizeEstonian("50 000 – 100 000.")).toBe("50000 kuni 100000.");
        expect(normalizeEstonian("II.16-17.98b32–34")).toBe("II.16-17.98b32–34"); // the LEFT guard, untouched
        expect(normalizeEstonian("5–13,7 °C")).toBe("5–13 koma 7 kraadi"); // the `,` STAYS: a decimal operand
    });

    test("degrees — one word for both scales and both senses, and the coordinate is refused WHOLE", () => {
        expect(normalizeEstonian("25 °C")).toBe("25 kraadi");
        expect(normalizeEstonian("46° ja 49° põhjalaiuse")).toBe("46 kraadi ja 49 kraadi põhjalaiuse");
        expect(normalizeEstonian("ligikaudu 109°.")).toBe("ligikaudu 109 kraadi."); // an angle, same word
        expect(normalizeEstonian("38°51' ja 41°16'")).toBe("38°51' ja 41°16'"); // arc-minutes: untouched
        // ⚠ THE TRAP-12 GUARD, on the corpus's own sentence — the sign AND the word in one clause.
        expect(normalizeEstonian("ulatub temperatuur +26 °C kraadini"))
            .toBe("ulatub temperatuur pluss 26 kraadini");
        // …and it is CASE-INSENSITIVE and WORD-BOUNDED, which is where the equivalent lg guard was wrong
        // twice: a sentence-initial capital must still suppress, and a COMPOUND must not.
        expect(normalizeEstonian("Kraadini ulatub 26 °C")).toBe("Kraadini ulatub 26");
        expect(normalizeEstonian("asub kaheksandal põhjalaiuskraadil, 26 °C")).toContain("26 kraadi");
        // ⚠ …AND IT IS CLAUSE-BOUNDED. The window is ±45 characters TRUNCATED AT `[.!?…]`: a needle in the
        // NEXT sentence used to suppress the unit in THIS one, and the failure mode is a silent DELETION —
        // well-formed Estonian with one noun missing, which no leak class, DROP probe or referee can see.
        expect(normalizeEstonian("Temperatuur oli 30 °C. Sellest sai kraadi mõõdetud."))
            .toBe("Temperatuur oli 30 kraadi. Sellest sai kraadi mõõdetud.");
    });

    // ⚠ AN ABBREVIATION-FINAL PERIOD IS ALSO THE SENTENCE PERIOD IN ESTONIAN, written once. The optional
    // `\.?` used to eat it, and the clause boundary went with it — against this layer's own headline
    // invariant, "zero sentence-final pauses are lost". So the dot is consumed only when it is NOT followed
    // by whitespace + a capital and NOT at the end of the input.
    test("an abbreviation never eats a sentence-final period", () => {
        expect(normalizeEstonian("Kasutati püsse jms. Teise maailmasõja ajal oli teisiti."))
            .toBe("Kasutati püsse ja muu selline. Teise maailmasõja ajal oli teisiti.");
        expect(normalizeEstonian("vaata ka jt.")).toBe("vaata ka ja teised."); // segment-final: kept
        expect(normalizeEstonian("nt. kass")).toBe("näiteks kass"); // mid-sentence: the dot IS the abbrev's
    });

    test("the minus is read and the plus is argued separately", () => {
        expect(normalizeEstonian("alla −15 °C")).toBe("alla miinus 15 kraadi");
        expect(normalizeEstonian("(-35$ aastas)")).toBe("(miinus 35$ aastas)");
        expect(normalizeEstonian("maakood on +376")).toBe("maakood on pluss 376");
        expect(normalizeEstonian("(315+35)")).toBe("(315 pluss 35)");
        // A dash left behind by a DECLINED range must not be re-read as a negative.
        expect(normalizeEstonian("18–13,7 °C")).toBe("18–13 koma 7 kraadi");
    });

    test("era markers and dotless abbreviations", () => {
        expect(normalizeEstonian("322 eKr")).toBe("322 enne Kristust");
        expect(normalizeEstonian("3.–4. sajandil pKr")).toBe("kolmandal neljandal sajandil pärast Kristust");
        // ⚠ `m.a.j.` is consumed HERE so the shared tier's one-letter `m` key cannot read it as metres.
        expect(normalizeEstonian("632 m.a.j.")).toBe("632 meie aja arvamise järgi");
        expect(normalizeEstonian("nr 665")).toBe("number 665");
        expect(normalizeEstonian("sh hazara keel")).toBe("sealhulgas hazara keel");
        // ⚠ `u` NEEDS ITS DIGIT LOOKAHEAD: the fourth free-standing `u` in this corpus is the LETTER, in an
        // alphabet listing. Trap 2, with the discriminator measured rather than assumed.
        expect(normalizeEstonian("u 1230 Werna")).toBe("umbes 1230 Werna");
        expect(normalizeEstonian("n o r t u ũ w y")).toBe("n o r t u ũ w y");
        // ⚠ `st` IS NOT AN ABBREVIATION HERE — both corpus instances are the elative CASE SUFFIX.
        expect(normalizeEstonian("1,5% SKP-st")).toBe("1 koma 5% SKP-st");
    });

    test("the hyphen case suffix on digits inflects the CARDINAL's genitive stem", () => {
        expect(normalizeEstonian("5000–6000-ni")).toBe("5000–kuue tuhandeni");
        expect(normalizeEstonian("tõsta 4-le")).toBe("tõsta neljale");
        // ⚠ A CURRENCY SIGN IN THE LEFT GUARD. Without it `$2-le` becomes `$kahele`, a word glued to the
        // sign, and the shared tier can no longer match — so the `$` would vanish entirely (trap 53).
        expect(normalizeEstonian("tõste on $2-le")).toBe("tõste on $2-le");
        // COMPOUNDS are not case suffixes and must survive as two words.
        expect(normalizeEstonian("63-aastaselt")).toBe("63-aastaselt");
        expect(normalizeEstonian("2,6-trimetüül")).toBe("2 koma 6-trimetüül");
    });
});

describe("Estonian initialisms — the espeak letter table on the shared seam", () => {
    test("the phonotactic split: vowel-less runs are spelled, readable ones stay words", () => {
        expect(isUnreadableEstonian("skp")).toBe(true); // no vowel
        expect(isUnreadableEstonian("tgv")).toBe(true);
        expect(isUnreadableEstonian("wc")).toBe(true);
        expect(isUnreadableEstonian("nato")).toBe(false); // Estonian reads it as a word, and so does the corpus
        expect(isUnreadableEstonian("unesco")).toBe(false);
        expect(isUnreadableEstonian("icann")).toBe(false); // the `nn` coda is Estonian's own (linn)
        expect(isUnreadableEstonian("üro")).toBe(false);
    });

    test("letter runs and the personal-initial arm", () => {
        expect(normalizeEstonianInitialisms("SKP kasvas")).toBe("ess kaa pee kasvas");
        expect(normalizeEstonianInitialisms("NATO ja UNESCO")).toBe("NATO ja UNESCO");
        // `USA` is READABLE and is still spelled out — a lexical fact no phonotactic test can derive, and
        // espeak's `USA $abbrev $allcaps` is the source for it.
        expect(normalizeEstonianInitialisms("Šveitsi ja USA turg")).toBe("Šveitsi ja uu ess aa turg");
    });

    test("the hyphen joint on an initialism glues to the LAST letter name; a compound does not", () => {
        expect(normalizeEstonianInitialisms("1,5% SKP-st")).toBe("1,5% ess kaa peest");
        expect(normalizeEstonianInitialisms("ja USA-sse")).toBe("ja uu ess aasse");
        expect(normalizeEstonianInitialisms("SNCF-i liin")).toBe("ess enn tsee effi liin");
        // A COMPOUND second element is a full word, not a case ending — the ≤3-letter cap is what splits
        // them, measured at 4 suffixes / 4 compounds and 0 either way round on the retained text.
        expect(normalizeEstonianInitialisms("TGV-rongile")).toBe("tee gee vee-rongile");
        expect(normalizeEstonianInitialisms("SI-süsteemis")).toBe("SI-süsteemis"); // readable head: untouched
    });
});

describe("Estonian — the end-to-end orderings that only the real phonemizer can pin", () => {
    const say = (s: string): string => getPhonemizer("et").text(prePass("et", s));

    // ⚠ ROMAN NUMERALS ARE RESOLVED AT THE REGISTRY SEAM, above this engine, because Estonian is not in
    // `ROMAN_NATIVE`. The operand is `XV` rather than the `II` the corpus happens to contain: `XV` has no
    // vowel, so the initialism pass would SPELL it if the order were wrong (trap 16).
    test("romans are digits before the initialism pass sees them", () => {
        expect(say("XV sajand").trim()).toBe("vˈiːsteist sˈɑjɑnd");
    });

    // `&nbsp;` sits between a grouped thousand and its unit ×74 in this corpus. `core/markup.ts` decodes it
    // to an ASCII space above this layer, which is why normalize.ts carries no entity step.
    test("the entity between a grouped thousand and its unit is decoded upstream", () => {
        expect(say("29 743&nbsp;km²").trim()).toBe("kˈɑkskymːend ˈyheksɑ tˈuhɑt sˈeitsesɑdɑ nˈelikymːend kˈolm rˈuːtkilomeːtrit");
    });

    test("the symbol tier reads the postposed quantity nouns", () => {
        expect(say("70%").trim()).toBe("sˈeitsekymːend prˈotsenti");
        expect(say("1 km").trim()).toBe("ˈyks kˈilomeːter"); // n===1 → nominative
        expect(say("5 km").trim()).toBe("vˈiːs kˈilomeːtrit"); // otherwise partitive
        expect(say("200 kuupmeetrit").trim()).toBe("kˈɑkssɑdɑ kˈuːpmeːtrit"); // the corpus's own spelling
        expect(say("13 m³").trim()).toBe("kˈolmteist kˈuːpmeːtrit"); // …and the symbol reaches it
        expect(say("Smith & Wesson").trim()).toBe("smˈith jˈɑ vˈesːon");
    });

    // ⚠ THE ONE REFEREE TOKEN THIS LAYER TOUCHES, pinned so the claim "the referee did not move" stays
    // checkable. `WC` is the referee's only multi-letter capital entry; it is now SPELLED rather than read
    // as the word ⟨wc⟩, and it remains a referee miss because ⟨w⟩ has two Estonian names and the referee
    // uses both — `kaksisvee` for the letter standing alone, `vee` inside `WC`. Score unchanged either way.
    test("WC is spelled out rather than read as a word", () => {
        expect(say("WC").trim()).toBe("kˈɑksisveː tsˈeː");
    });
});
