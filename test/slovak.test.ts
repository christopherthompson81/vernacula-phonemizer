import { describe, expect, test } from "vitest";

import { phonemizeWord, createSlovak } from "../src/languages/slovak/slovak.ts";
import { normalizeSlovak, ordinalWords } from "../src/languages/slovak/normalize.ts";

// Slovak (sk) — West Slavic, Latin, sibling of Czech. Rule g2p (g2p.ts): palatalisation d/t/n/l→ɟ/c/ɲ/ʎ before soft
// vowels i/í/e (y/ý are HARD), the rising diphthongs ⟨ia ie iu⟩→ɪ̯a/ɪ̯e/ɪ̯u and ⟨ô⟩→u̯ɔ, ⟨ä⟩→æ, syllabic l̩/r̩
// (long ĺ/ŕ), ⟨v⟩ (onset→f before voiceless, coda stays v), ⟨h⟩=ɦ, ⟨ch⟩=x, gemination, voicing + final devoicing.
// Scored 89.0% folded on wikipron slk_latn_broad (HUMAN, 15950). See docs/investigations/sk_native_bringup_investigation.md.
describe("Slovak canonical IPA — rule g2p (Standard Slovak)", () => {
    test("palatalisation d/t/n/l → ɟ/c/ɲ/ʎ before soft vowels; y/ý stay HARD", () => {
        expect(phonemizeWord("deň")).toBe("ɟˈeɲ"); // d→ɟ before e, ň→ɲ
        expect(phonemizeWord("deti")).toBe("ɟˈeci"); // d→ɟ, t→c (children)
        expect(phonemizeWord("list")).toBe("ʎˈist"); // l→ʎ before i
        expect(phonemizeWord("milý")).toBe("mˈiliː"); // ý is HARD → l stays plain l
        expect(phonemizeWord("ľúbiť")).toBe("ʎˈuːbic"); // ľ=ʎ, ú=uː, ť=c
    });

    test("diphthongs ⟨ia ie iu ô⟩ + ⟨ä⟩", () => {
        expect(phonemizeWord("chlieb")).toBe("xʎˈɪ̯ep"); // ch=x, l→ʎ, ie=ɪ̯e, final b→p (devoicing)
        expect(phonemizeWord("kôň")).toBe("kˈu̯ɔɲ"); // ô=u̯ɔ, ň=ɲ
        expect(phonemizeWord("mäso")).toBe("mˈæsɔ"); // ä=æ
        expect(phonemizeWord("dievča")).toBe("ɟˈɪ̯evt͡ʃa"); // d→ɟ, ie=ɪ̯e, v INERT before č
    });

    test("syllabic liquids (short l̩/r̩, long ĺ/ŕ)", () => {
        expect(phonemizeWord("vlk")).toBe("vˈl̩k"); // syllabic l̩
        expect(phonemizeWord("krv")).toBe("kˈr̩v"); // syllabic r̩, v inert
        expect(phonemizeWord("stĺp")).toBe("stˈl̩ːp"); // long syllabic ĺ → l̩ː
    });

    test("voicing: final devoicing + ⟨v⟩ (onset→f before voiceless, coda stays v)", () => {
        expect(phonemizeWord("vták")).toBe("ftˈaːk"); // ONSET v → f before voiceless t
        expect(phonemizeWord("včera")).toBe("ft͡ʃˈera"); // onset v → f before č
        expect(phonemizeWord("stav")).toBe("stˈav"); // final (coda) v stays v (NOT f)
        expect(phonemizeWord("pravda")).toBe("prˈavda"); // coda v before d stays v
        expect(phonemizeWord("ch")).toBe("x"); // ch digraph = x
    });

    // tisíc and milión are both MASCULINE INANIMATE, and the masculine-inanimate form of "two" is dva (dve is
    // feminine/neuter) — so the multiplier is dva tisíce / dva milióny, matching Czech's dva tisíce. The noun
    // takes the paucal after 2–4 (tisíce) and the genitive plural after 5+ (tisíc, miliónov).
    test("cardinal numbers (paucal agreement; MASCULINE dva before the magnitudes)", () => {
        const sk = createSlovak();
        expect(sk.text("0").trim()).toBe("nˈula");
        expect(sk.text("15").trim()).toBe("pˈætnaːsc"); // pätnásť
        expect(sk.text("21").trim()).toBe("dvˈatsacjˌeɟen"); // dvadsaťjeden
        expect(sk.text("1000").trim()).toBe("cˈisiːt͡s"); // tisíc (t→c before i)
        expect(sk.text("2000").trim()).toBe("dvˈa cˈisiːt͡se"); // dva tisíce — masc. inan. (not *dve tisíce)
        expect(sk.text("5000").trim()).toBe("pˈæc cˈisiːt͡s"); // päť tisíc — indeclined after 5+
        expect(sk.text("21000").trim()).toBe("dvˈatsacjˌeɟen cˈisiːt͡s"); // dvadsaťjeden tisíc
        expect(sk.text("1000000").trim()).toBe("mˈiʎiɔːn"); // milión — bare, no leading jeden
        expect(sk.text("2000000").trim()).toBe("dvˈa mˈiʎiˌɔːni"); // dva milióny — masc. inan. (not *dve milióny)
        // >9 digits: read digit-by-digit (no miliarda tier; no float precision loss)
        expect(sk.text("1000000000").trim()).toBe("jˈeɟen nˈula nˈula nˈula nˈula nˈula nˈula nˈula nˈula nˈula");
    });

    test("text: words + clause punctuation", () => {
        expect(createSlovak().text("Mesto je pekné.")).toBe("mˈestɔ jˈe pˈekneː .");
    });
});

// #562 TEXT NORMALIZATION — asserted on normalizeSlovak (text→text) so the pins read as Slovak rather than
// as IPA, plus phonemize() end-to-end where the point is that the pipeline speaks the result.
// Evidence and counts: docs/investigations/sk_normalization_investigation.md.
describe("Slovak text normalization (#562)", () => {
    // TRAP 13 — pin the rule's BRANCHES, not the corpus's instances. The ordinal has three: the 1–19
    // TABLE, the tens+units COMPOSITION, and the BOUNDARY between them (the hundreds/thousands prefix,
    // which stays cardinal while every ordinal element inflects). The corpus exercises only the first two.
    test("ordinal branches: table, composition, and the boundary", () => {
        // TABLE (1–19), with the two soft/short-ending irregulars the corpus does write
        expect(ordinalWords(16, "n.loc")).toBe("šestnástom"); // v 16. storočí
        expect(ordinalWords(3, "m.gen")).toBe("tretieho"); // the ONLY soft ordinal: tretí → tretieho
        expect(ordinalWords(3, "n.loc")).toBe("treťom"); // …and its palatalising locative
        expect(ordinalWords(8, "m.gen")).toBe("ôsmeho"); // rhythmic law: ôsmy → ôsmeho, never *ôsmého
        expect(ordinalWords(7, "m.instr")).toBe("siedmym"); // 7. najväčším → siedmym
        // COMPOSITION (tens + units) — BOTH elements inflect, which is the Slovak/Croatian divergence
        expect(ordinalWords(24, "m.gen")).toBe("dvadsiateho štvrtého"); // 24. augusta
        expect(ordinalWords(23, "m.gen")).toBe("dvadsiateho tretieho"); // the soft tail inside a compound
        expect(ordinalWords(37, "f.instr")).toBe("tridsiatou siedmou"); // 37. najväčšou krajinou
        // BOUNDARY — the hundreds/thousands prefix is a CARDINAL and does not inflect; the tail does
        expect(ordinalWords(190, "n.loc")).toBe("sto deväťdesiatom"); // na 190. mieste
        expect(ordinalWords(100, "m.gen")).toBe("stého"); // the exact-hundred branch (not in the corpus)
        expect(ordinalWords(1918, "m.gen")).toBe("tisíc deväťsto osemnásteho"); // four digits, not in the corpus
        expect(ordinalWords(1000, "m.nom")).toBeUndefined(); // an exact thousand needs *tisíci* — declined
    });

    test("licensed ordinals agree with the noun that follows", () => {
        expect(normalizeSlovak("V 16. storočí sa Paraguaj.")).toBe("V šestnástom storočí sa Paraguaj.");
        expect(normalizeSlovak("Do 17. septembra 1939")).toBe("Do sedemnásteho septembra 1939");
        expect(normalizeSlovak("V 60. rokoch 20. storočia."))
            .toBe("V šesťdesiatych rokoch dvadsiateho storočia."); // decade = locative PLURAL
        expect(normalizeSlovak("na 190. mieste")).toBe("na sto deväťdesiatom mieste");
        expect(normalizeSlovak("búrka 4. kategórie")).toBe("búrka štvrtej kategórie"); // feminine genitive
        expect(normalizeSlovak("jeho 60. gólom")).toBe("jeho šesťdesiatym gólom"); // instrumental
        // a LIST takes the head noun's case throughout, and keeps its own comma (the pause is real)
        expect(normalizeSlovak("v 11., 12. a 13. storočí"))
            .toBe("v jedenástom, dvanástom a trinástom storočí");
        expect(normalizeSlovak("z obdobia 19. a začiatku 20. storočia"))
            .toBe("z obdobia devätnásteho a začiatku dvadsiateho storočia"); // one interpolated head
        // outside the licensor list → the masculine nominative citation form (trap 8's generalization)
        expect(normalizeSlovak("5. ročník")).toBe("piaty ročník");
        // REGNAL: the shared roman pass has already made `Alžbeta II.` into `Alžbeta 2.`, and the
        // agreement comes from the NAME, not from the following word. Both corpus instances are a QUEEN.
        expect(normalizeSlovak("kráľovná Alžbeta 2. mala byť")).toBe("kráľovná Alžbeta druhá mala byť");
        expect(normalizeSlovak("kráľovnej Alžbety 2. mala")).toBe("kráľovnej Alžbety druhej mala");
        expect(normalizeSlovak("náčelníka Lealofiho 3. viedol")).toBe("náčelníka Lealofiho tretieho viedol");
        expect(normalizeSlovak("stanice Fort Greely 9.")).toBe("stanice Fort Greely 9."); // an utterance END
    });

    // The check that matters (playbook trap 4): a `N.` that is a SENTENCE END must not be claimed. Slovak
    // writes a year as a CARDINAL with no ordinal period, so all 31 utterance-final `N.` in the corpus are
    // sentence periods — the Croatian year-ordinal rule would have destroyed fourteen of them.
    test("a sentence-final period is NOT an ordinal", () => {
        expect(normalizeSlovak("Charles Darwin v roku 1835.")).toBe("Charles Darwin v roku 1835.");
        expect(normalizeSlovak("v roku 2020.")).toBe("v roku 2020.");
        expect(normalizeSlovak("s počtom bodov 2 243.")).toBe("s počtom bodov 2243."); // de-grouped, period kept
        expect(normalizeSlovak("t.j. 0 alebo 1. Tieto čísla")).toBe("to jest 0 alebo 1. Tieto čísla");
        expect(normalizeSlovak("hladinou v roku 2005.“")).toBe("hladinou v roku 2005.“");
        expect(createSlovak().text("v roku 1835.").trim().endsWith(".")).toBe(true); // the pause survives
    });

    // TRAP 14's sibling: the numeral must agree with its noun, and the noun is chosen by skCountForm —
    // exactly 2/3/4 take the nominative plural, every compound takes the genitive plural.
    test("three-way count agreement (1 / 2 / 5 + a compound)", () => {
        expect(normalizeSlovak("1 km a 2 km a 5 km a 22 km"))
            .toBe("1 kilometer a 2 kilometre a 5 kilometrov a 22 kilometrov");
        expect(normalizeSlovak("1 % a 3 % a 21 %")).toBe("1 percento a 3 percentá a 21 percent");
        // the clock's hour noun is FEMININE, so the numeral is too: jedna/dve, never jeden/dva
        expect(normalizeSlovak("1:15 ráno")).toBe("jedna hodina pätnásť minút ráno");
        expect(normalizeSlovak("(15:00 univerzálneho")).toBe("(pätnásť hodín univerzálneho");
    });

    // A GOVERNED clock is a feminine ordinal hour (14 of the corpus's 15 are governed); an ungoverned one
    // falls back to the neutral cardinal + counted noun above. `26:00` is a football score, not a clock.
    test("clock: the governing preposition picks the case", () => {
        expect(normalizeSlovak("Presne o 8:46 ráno")).toBe("Presne o ôsmej štyridsaťšesť ráno");
        expect(normalizeSlovak("Tesne po 11:00 demonštranti")).toBe("Tesne po jedenástej demonštranti");
        expect(normalizeSlovak("do 23:35 hod uhasili.")).toBe("do dvadsiatej tretej tridsaťpäť uhasili."); // `hod` consumed once
        expect(normalizeSlovak("o 12.00 GMT")).toBe("o dvanástej GMT"); // the PERIOD clock
        expect(normalizeSlovak("odchádza medzi 06:30 a 07:30."))
            .toBe("odchádza medzi šiestou tridsať a siedmou tridsať."); // medzi → instrumental, both halves
        expect(normalizeSlovak("oheň medzi 22:00 - 23:00 Horského"))
            .toBe("oheň medzi dvadsiatou druhou a dvadsiatou treťou Horského");
        expect(normalizeSlovak("zvíťazila 26:00 nad Zambiou")).toBe("zvíťazila 26:00 nad Zambiou"); // a SCORE
        expect(normalizeSlovak("je 7:2.")).toBe("je 7:2."); // …and so is this
    });

    // EVERY sign class: percent, currency, degree, plus, minus, times, ampersand, equals, less/greater,
    // divide. A dropped sign is inaudible, which is the one outcome that cannot be right (#584).
    test("every sign class is read", () => {
        expect(normalizeSlovak("získal 88 % čistých bodov")).toBe("získal 88 percent čistých bodov");
        expect(normalizeSlovak("od 11 000 $ do 22 500 $")).toBe("od 11000 dolárov do 22500 dolárov");
        expect(normalizeSlovak("teploty nad +30°C.")).toBe("teploty nad plus 30 stupňov Celzia.");
        expect(normalizeSlovak("-5 stupňov")).toBe("mínus 5 stupňov");
        expect(normalizeSlovak("negatív má 36x24 mm")).toBe("negatív má 36 krát 24 milimetrov");
        expect(normalizeSlovak("B&B súťažia")).toBe("B a B súťažia");
        expect(normalizeSlovak("5 < 6")).toBe("5 menší ako 6");
        expect(normalizeSlovak("7 > 3")).toBe("7 väčší ako 3");
        expect(normalizeSlovak("x = y")).toBe("x rovná sa y");
        expect(normalizeSlovak("8 ÷ 2")).toBe("8 delené 2");
        expect(normalizeSlovak("19 500 km²")).toBe("19500 štvorcových kilometrov");
        expect(normalizeSlovak("64 km/h")).toBe("64 kilometrov na hodinu");
        expect(normalizeSlovak("40 míľ/h")).toBe("40 míľ za hodinu");
    });

    test("thousands, decimals, ranges, version dots, era markers and abbreviations", () => {
        expect(normalizeSlovak("približne 4 800 km")).toBe("približne 4800 kilometrov"); // space-grouped
        expect(normalizeSlovak("2,4 GHz")).toBe("2 čiarka 4 gigahertzov"); // decimal comma, after the tier
        expect(normalizeSlovak("často 160 – 320 km/h")).toBe("často 160 do 320 kilometrov na hodinu");
        expect(normalizeSlovak("stavu 6-6 vyžiadalo")).toBe("stavu 6-6 vyžiadalo"); // equal endpoints ⇒ a SCORE
        expect(normalizeSlovak("typu Il-76.")).toBe("typu Il-76."); // a designation, not a range
        expect(normalizeSlovak("štandardu 802.11n")).toBe("štandardu 802 bodka 11n");
        expect(normalizeSlovak("356 pred n.l. Išlo o akt"))
            .toBe("356 pred naším letopočtom. Išlo o akt"); // the era dot was ALSO the sentence period
        expect(normalizeSlovak("okolo roku 400 n. l. a trvala")).toBe("okolo roku 400 nášho letopočtu a trvala");
        expect(normalizeSlovak("výšku 4892 m n. m.")).toBe("výšku 4892 metrov nad morom.");
        expect(normalizeSlovak("jedlá atď., obetovaných")).toBe("jedlá a tak ďalej, obetovaných"); // no doubled mark
        expect(normalizeSlovak("tuniak atď.")).toBe("tuniak a tak ďalej."); // …but the sentence period returns
        expect(normalizeSlovak("Dr. Ehud Ur")).toBe("doktor Ehud Ur");
        expect(normalizeSlovak("kozmonaut č. 11")).toBe("kozmonaut číslo 11");
    });

    // TRAP 8's constructive half: the fraction rule COMPOSES rather than tabulating the one numerator the
    // corpus writes — which is zero, since its only slash is the season 1995/96.
    test("fractions compose, and a season is not a fraction", () => {
        expect(normalizeSlovak("3/4")).toBe("tri štvrtiny");
        expect(normalizeSlovak("1/5")).toBe("jedna pätina");
        expect(normalizeSlovak("2/3")).toBe("dve tretiny"); // feminine dve, not dva
        expect(normalizeSlovak("od roku 1995/96, ktorý")).toBe("od roku 1995/96, ktorý");
    });

    test("end to end: the normalized text reaches the g2p as words", () => {
        const sk = createSlovak();
        expect(sk.text("V 16. storočí.").trim()).toBe("v ʃˈestnaːstɔm stˈɔrɔt͡ʃiː .");
        expect(sk.text("88 %").trim()).toBe("ˈɔsemɟˌesɪ̯atˌɔsem pˈert͡sent");
    });
});
