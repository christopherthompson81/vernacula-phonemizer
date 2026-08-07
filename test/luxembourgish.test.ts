import { describe, expect, test } from "vitest";

import { getPhonemizer } from "../src/registry.ts";

import { createLuxembourgish, phonemizeWord } from "../src/languages/luxembourgish/luxembourgish.ts";
import { numberToWords } from "../src/languages/luxembourgish/numbers.ts";
import { normalizeLuxembourgish, ordinalStem } from "../src/languages/luxembourgish/normalize.ts";

// Luxembourgish (lb) — Lëtzebuergesch, West Germanic (Moselle Franconian), Latin script (~390k). A German-derived
// orthography (⟨w⟩→v, ⟨ch⟩→χ, initial st/sp→ʃt/ʃp) + a distinctive diphthong system + French loans. The engine is a
// greedy longest-match grapheme scan + German-style rules (stressed ⟨e⟩→æ, geminate collapse, devoicing). Validated
// against wikipron ltz_latn_broad (human), with vowel LENGTH folded. ⚠ Its two referees are the same
// Wiktionary tradition, so they are not independent of each other.
describe("Luxembourgish canonical IPA — grapheme g2p + the diphthong system + German-style rules", () => {
    const lb = createLuxembourgish();

    test("the diphthong system: ⟨ei/ai⟩→ai̯, ⟨au⟩→æu̯, ⟨ou⟩→əu̯, ⟨éi⟩→ei̯", () => {
        expect(phonemizeWord("Haus")).toBe("hæu̯s"); // ⟨au⟩ → æu̯ ("house")
        expect(phonemizeWord("Kou")).toBe("kəu̯"); // ⟨ou⟩ → əu̯ ("cow")
        expect(phonemizeWord("Dréi")).toBe("drei̯"); // ⟨éi⟩ → ei̯ ("turn")
        expect(phonemizeWord("Méi")).toBe("mei̯"); // ⟨éi⟩ → ei̯ ("more")
    });

    test("the German-style consonants: ⟨w⟩→v, ⟨ch⟩→χ, ⟨z⟩→t͡s, ⟨qu⟩→kv, ⟨é⟩ alone→eː", () => {
        expect(phonemizeWord("Waasser")).toBe("vaːsər"); // ⟨w⟩→v, ⟨aa⟩→aː ("water")
        expect(phonemizeWord("Buch")).toBe("buχ"); // ⟨ch⟩ → χ ("book")
        expect(phonemizeWord("zéng")).toBe("t͡seːŋ"); // ⟨z⟩→t͡s, ⟨é⟩ alone→eː, ⟨ng⟩→ŋ ("ten")
        expect(phonemizeWord("Quell")).toBe("kvæl"); // ⟨qu⟩→kv, ⟨e⟩→æ, ⟨ll⟩ collapse ("spring")
        expect(phonemizeWord("Been")).toBe("beːn"); // ⟨ee⟩ → eː ("leg")
    });

    test("initial ⟨st/sp⟩ → [ʃt ʃp] + single ⟨s⟩ → [z] as an onset (⟨ss⟩ stays [s])", () => {
        expect(phonemizeWord("Strooss")).toBe("ʃtroːs"); // initial st→ʃt, ⟨oo⟩→oː, ⟨ss⟩→s ("street")
        expect(phonemizeWord("Spill")).toBe("ʃpil"); // initial sp→ʃp ("game")
        expect(phonemizeWord("Sonn")).toBe("zon"); // onset ⟨s⟩→z, ⟨nn⟩ collapse ("sun")
        expect(phonemizeWord("Iesel")).toBe("iəzəl"); // ⟨ie⟩→iə, intervocalic ⟨s⟩→z ("donkey")
    });

    test("short stressed ⟨e⟩ → [æ], reduced ⟨e⟩ → [ə] (the ⟨-en⟩ ending + the ⟨ge-⟩ prefix)", () => {
        expect(phonemizeWord("Belsch")).toBe("bælʃ"); // monosyllable → stressed [æ] ("Belgium")
        expect(phonemizeWord("Decken")).toBe("dækən"); // stressed e→æ, ⟨-en⟩ ending→ə ("blankets")
        expect(phonemizeWord("Gemeng")).toBe("ɡəmæŋ"); // ⟨ge-⟩ prefix unstressed→ə, stressed e→æ ("municipality")
    });

    test("geminate collapse + devoicing (word-final, regressive, and ⟨g⟩→χ/k)", () => {
        expect(phonemizeWord("Flott")).toBe("flot"); // ⟨tt⟩ → single ("nice")
        expect(phonemizeWord("Hand")).toBe("hant"); // word-final ⟨d⟩ → t ("hand")
        expect(phonemizeWord("Abt")).toBe("apt"); // regressive: ⟨b⟩ → p before [t] ("abbot")
        expect(phonemizeWord("Dag")).toBe("daχ"); // final ⟨g⟩ → χ after a vowel ("day")
        expect(phonemizeWord("Alg")).toBe("alk"); // final ⟨g⟩ → k after a consonant ("alga")
    });

    test("⟨n⟩→[ŋ] before a velar + intervocalic g-spirantization ⟨g⟩→[ʁ]", () => {
        expect(phonemizeWord("Bankrott")).toBe("baŋkrot"); // n→ŋ before [k] ("bankruptcy")
        expect(phonemizeWord("Lager")).toBe("laʁər"); // intervocalic ⟨g⟩ → [ʁ] ("camp/store")
        expect(phonemizeWord("Dag")).toBe("daχ"); // word-final ⟨g⟩ still → [χ] (not spirantized)
    });

    test("clause assembly", () => {
        expect(lb.text("Ech schwätzen Lëtzebuergesch.").trim()).toBe("æχ ʃvæt͡sən lət͡səbuərɡəʃ .");
    });

    // CARDINAL NUMBERS — units-FIRST and fused like German, with the EIFELER REGEL on the connector: "an" survives
    // before ⟨n d t z h⟩ and vowels, but reduces to "a" before other consonants. Wikipedia's own numeral pair
    // fënnefandrësseg (35) / fënnefavéierzeg (45) is what pins the rule. See luxembourgish/numbers.ts.
    test("numbers: units-first compounds + the Eifeler Regel on the an/a connector", () => {
        expect(numberToWords(0)).toBe("null");
        expect(numberToWords(21)).toBe("eenanzwanzeg"); // before ⟨z⟩ → "an" kept
        expect(numberToWords(31)).toBe("eenandrësseg"); // before ⟨d⟩ → kept
        expect(numberToWords(35)).toBe("fënnefandrësseg"); // the Wikipedia example
        expect(numberToWords(45)).toBe("fënnefavéierzeg"); // before ⟨v⟩ → n DELETED
        expect(numberToWords(55)).toBe("fënnefafofzeg"); // before ⟨f⟩ → deleted
        expect(numberToWords(65)).toBe("fënnefasiechzeg"); // before ⟨s⟩ → deleted
        expect(numberToWords(85)).toBe("fënnefanachtzeg"); // before a VOWEL → kept
        expect(numberToWords(95)).toBe("fënnefannonzeg"); // before ⟨n⟩ → kept
    });

    test("numbers: closed German-style magnitudes", () => {
        expect(numberToWords(100)).toBe("honnert");
        expect(numberToWords(101)).toBe("honnerteent");
        expect(numberToWords(555)).toBe("fënnefhonnertfënnefafofzeg");
        expect(numberToWords(1000)).toBe("dausend");
        expect(numberToWords(12345)).toBe("zwielefdausend dräihonnertfënnefavéierzeg");
        expect(numberToWords(1000000)).toBe("eng Millioun");
        expect(numberToWords(1000000000)).toBe("eng Milliard");
    });

    test("numbers: wired into the phonemizer", () => {
        expect(lb.text("21").trim()).toBe("eːnant͡svant͡səχ"); // eenanzwanzeg
        expect(lb.text("45").trim()).toBe("fənəfafei̯ərt͡səχ"); // fënnefavéierzeg (n-deleted)
    });

});

// TEXT NORMALIZATION. Counts are FLEURS lb_lu, column 3, 1,896 utterances. The assertions are on the
// text→text layer (plus a couple through phonemize, to prove the words reach the g2p rather than a sink),
// and they pin the rule's BRANCHES rather than the corpus's instances.
describe("Luxembourgish normalization — the period's four jobs + the Eifeler Regel", () => {
    const lb = createLuxembourgish();
    const N = normalizeLuxembourgish;

    // The ordinal STEM has five branches and the corpus exercises only some of them: the suppletive table,
    // the `+t` path, the doubled-`t` collapse at 8, the `+st` path from 20, and the multi-word carrier
    // where the ending must land on the last word only. 8, 100 and 1922 are NOT in the corpus.
    test("ordinal stem: every branch, not just the attested values", () => {
        expect(ordinalStem(1)).toBe("éischt"); // suppletive
        expect(ordinalStem(3)).toBe("drëtt"); // suppletive
        expect(ordinalStem(7)).toBe("siwent"); // +t
        expect(ordinalStem(8)).toBe("aacht"); // the tt COLLAPSE — aacht + t, unattested in the corpus
        expect(ordinalStem(19)).toBe("nonzéngt"); // the last +t
        expect(ordinalStem(20)).toBe("zwanzegst"); // the first +st — the branch boundary
        expect(ordinalStem(24)).toBe("véieranzwanzegst"); // compound
        expect(ordinalStem(100)).toBe("honnertst");
        expect(ordinalStem(1922)).toBe("dausend nénghonnertzweeanzwanzegst"); // ending on the LAST word
    });

    // The ending is `-en` plus the language's own final-n deletion, read off the corpus's spelled-out
    // ordinals: *am drëtte Joerhonnert* / *vum éischten Dag* / *op der zéngter Plaz*.
    test("ordinal ending: the Eifeler Regel decides -en vs -e, and `der` takes -er", () => {
        expect(N("am 16. Joerhonnert")).toBe("am siechzéngte Joerhonnert"); // ⟨j⟩ → n DELETED
        expect(N("den 1. Dag vum Mount")).toBe("den éischten Dag vum Mount"); // ⟨d⟩ → n KEPT
        expect(N("den 3. August")).toBe("den drëtten August"); // a VOWEL → n kept
        expect(N("de 14. Mäerz")).toBe("de véierzéngte Mäerz"); // ⟨m⟩ → deleted
        expect(N("op der 3. Plaz")).toBe("op der drëtter Plaz"); // feminine dative → -er
    });

    test("ordinal licensing: article + noun, and coordinated lists", () => {
        expect(N("den 190. vun der Lëscht")).toBe("den honnertnonzegste vun der Lëscht"); // article + lowercase word
        expect(N("Säin 1 000. Timber")).toBe("Säin dausendsten Timber"); // needs the de-grouping first
        expect(N("am 11., 12. an 13. Joerhonnert"))
            .toBe("am eeleften, zwieleften an dräizéngte Joerhonnert"); // list; ⟨n⟩ kept before the pause
        expect(N("tëschent dem 10. bis 11. an dem 14. Joerhonnert"))
            .toBe("tëschent dem zéngte bis eeleften an dem véierzéngte Joerhonnert");
    });

    // The four sentence-final `N.` in the corpus, plus three constructed neighbours. None may be claimed:
    // an ordinal is licensed by what FOLLOWS, and a sentence period has nothing after it.
    test("a sentence-final numeral is NOT an ordinal", () => {
        expect(N("an Afghanistan 1979.")).toBe("an Afghanistan 1979.");
        expect(N("am Joer 2020.")).toBe("am Joer 2020."); // `Joer` is deliberately not a licenser
        expect(N("d'Wanterolympiad 2010.")).toBe("d'Wanterolympiad 2010.");
        expect(N("Kapitel 5. Dat ass gutt")).toBe("Kapitel 5. Dat ass gutt"); // content word before
        expect(lb.text("an Afghanistan 1979.").trim().endsWith(".")).toBe(true); // the PAUSE survives
    });

    // The crux: one character, four jobs, separated by fraction length and by what follows.
    test("the period — grouping vs clock vs ordinal vs version", () => {
        expect(N("vun 1.000 Dollar")).toBe("vun 1000 Dollar"); // THREE digits ⇒ grouping
        expect(N("um 7.19 Auer")).toBe("um 7 Auer 19"); // TWO digits + a licenser ⇒ clock
        expect(N("am 16. Joerhonnert")).toBe("am siechzéngte Joerhonnert"); // nothing after ⇒ ordinal
        expect(N("Den 802.11n-Standard")).toBe("Den 802.11n-Standard"); // a version dot: untouched
        expect(N("Ofbildung 1.1.")).toBe("Ofbildung 1.1."); // a figure number: untouched
        expect(N("4.41,30")).toBe("4 41 Komma 3 0"); // a sports time: NOT a clock, NOT a decimal point
    });

    // All six `\d+:\d+` in the corpus are scores or ratios, so there is no colon rule at all.
    test("the colon is a score in Luxembourgish, never a clock", () => {
        expect(N("7:2")).toBe("7:2");
        expect(N("D'Endresultat war 21:20")).toBe("D'Endresultat war 21:20");
        expect(N("mat 3:2 bezeechent")).toBe("mat 3:2 bezeechent");
    });

    test("clock: `Auer` is re-emitted, a zone label is put back, and hour 1 is feminine", () => {
        expect(N("um 20.30 Auer Lokalzäit (15.00 UTC)")).toBe("um 20 Auer 30 Lokalzäit (15 Auer UTC)");
        expect(N("Tëschent 22.00 an 23.00 Auer MDT")).toBe("Tëschent 22 Auer an 23 Auer MDT");
        expect(N("E Samschdeg um 1.15 Auer")).toBe("E Samschdeg um eng Auer 15"); // the numeral must AGREE, so it is words-ified here
        expect(N("tëschent 6.30 a 7.30 Auer")).toBe("tëschent 6 Auer 30 a 7 Auer 30"); // licensed both ways
        // An UNLICENSED period-pair is left alone: the decimal rule takes a one-digit fraction only,
        // because in this language a two-digit fraction after a dot is the clock shape.
        expect(N("De Programm ass 20.30 lassgaangen")).toBe("De Programm ass 20.30 lassgaangen");
        expect(N("12.5 Kilometer")).toBe("12 Komma 5 Kilometer"); // one digit ⇒ the decimal branch
    });

    test("thousands: both the period and the three space characters the corpus uses", () => {
        expect(N("130.000 Yen")).toBe("130000 Yen");
        expect(N("55 000 Barrellen")).toBe("55000 Barrellen"); // plain space
        expect(N("9 000 Leit")).toBe("9000 Leit"); // NBSP
        expect(N("4 830 Kilometer")).toBe("4830 Kilometer"); // NARROW NBSP
        expect(lb.text("9 000").trim()).toBe("neːŋdæu̯zənt"); // NBSP again, end-to-end; was *néng null*
    });

    test("decimals: the comma is the decimal point, the fraction is read digit by digit", () => {
        expect(N("1,5 Kilometer")).toBe("1 Komma 5 Kilometer");
        expect(N("7,74 Meter")).toBe("7 Komma 7 4 Meter");
        expect(N("Whistler (1.5 Fuerstonne)")).toBe("Whistler (1 Komma 5 Fuerstonne)"); // the dot form too
        expect(N("ofgeschloss, 12 Leit")).toBe("ofgeschloss, 12 Leit"); // a clause comma is untouched
    });

    // TRAP 14: `bis` starts with ⟨b⟩, so a left operand ending in unstressed ⟨-en⟩ loses it — the corpus
    // writes `siwe bis aacht`. Emitting `$1 bis $2` on digits could never do that.
    // ⚠ THE DASHES BELOW ARE NBSP-FLANKED (U+00A0), not plain spaces, because that is how the corpus
    //   writes them — indistinguishable on screen. The parenthetical-dash case is NBSP then a PLAIN space.
    test("ranges: the joiner is `bis`, and it triggers n-deletion on the left operand", () => {
        expect(N("(1894 – 1895)")).toBe("(1894 bis 1895)");
        expect(N("vun 2 – 3 km Äis")).toBe("vun 2 bis 3 km Äis"); // right operand stays DIGITS for the tier
        expect(N("7 – 8 Deeg")).toBe("siwe bis 8 Deeg"); // *siwen* → *siwe*
        expect(N("1000000 – 2000000")).toBe("1000000 bis 2000000"); // *eng Millioun*: stem ⟨n⟩, NOT deleted
        expect(N("ers 1995 – 1996, pan")).toBe("ers 1995 bis 1996, pan"); // the clause comma survives
        expect(N("gëtt – duerch")).toBe("gëtt – duerch"); // the PARENTHETICAL dash (×44) is untouched
    });

    // The fraction noun composes as ordinal stem + `el`.
    test("fractions: the table, the composition, and the numerator's own n-deletion", () => {
        expect(N("5 mm (1/5 Zoll)")).toBe("5 mm (ee Fënneftel Zoll)"); // the corpus's only fraction
        expect(N("1/3 vum Land")).toBe("een Drëttel vum Land"); // ⟨d⟩ keeps the n — the corpus's own spelling
        expect(N("1/4 Stonn")).toBe("ee Véierel Stonn"); // the IRREGULAR noun, unattested in the corpus
        expect(N("1/2 Zoll")).toBe("een hallef Zoll"); // 2 is an adjective, not a noun
        expect(N("3/4 vun der Zäit")).toBe("dräi Véierel vun der Zäit"); // numerator > 1
        expect(N("2/3 vun de Leit")).toBe("zwee Drëttel vun de Leit");
    });

    test("era, abbreviations and the ones deliberately left alone", () => {
        expect(N("am 10. Joerhonnert v. Chr. ass")).toBe("am zéngte Joerhonnert vir Christus ass"); // ⚠ NBSP inside `v. Chr.`
        expect(N("(1000 – 1300 n. Chr.)")).toBe("(1000 bis 1300 no Christus)");
        expect(N("z. B. de Pennsylvania Wilds")).toBe("zum Beispill de Pennsylvania Wilds"); // ⚠ NBSP inside `z. B.`
        expect(N("Kéis, Thon asw.")).toBe("Kéis, Thon an sou weider."); // the sentence break survives
        expect(N("Nëss, Iessen asw., déi")).toBe("Nëss, Iessen an sou weider, déi"); // no DOUBLED pause
        expect(N("den Dr. Damadian")).toBe("den Dokter Damadian");
        expect(N("Six Flags St. Louis")).toBe("Six Flags St. Louis"); // NOT expanded: *Sankt* is unsourced
    });

    test("degrees and signs — and the compound hyphens that must not become a minus", () => {
        expect(N("bei 32 °C Hëtzt")).toBe("bei 32 Grad Celsius Hëtzt"); // ⚠ NBSP before the degree sign
        expect(N("12 °F")).toBe("12 Grad Fahrenheit"); // zero corpus instances — absence is not evidence of correctness
        expect(N("iwwer +30 Grad Celsius")).toBe("iwwer plus 30 Grad Celsius");
        expect(N("(UTC+1)")).toBe("(UTC plus 1)");
        expect(N("Typ-1-Diabetes an COVID-19")).toBe("Typ-1-Diabetes an COVID-19"); // no minus
        expect(N("Standard-35-mm-Film")).toBe("Standard-35-mm-Film");
    });

    // Both of these were found by the CORPUS DIFF, not by a probe.
    test("`Meile` is the writer's own Eifeler form and must not be pluralised; only the RATE is claimed", () => {
        const lb2 = createLuxembourgish();
        expect(N("50 Kilometer (31 Meile) vu Buenos Aires")).toBe("50 Kilometer (31 Meile) vu Buenos Aires");
        expect(lb2.text("20 km (15 Meilen) nord").trim()).toBe(lb2.text("20 Kilometer (15 Meilen) nord").trim());
        expect(N("165 km/h (105 Meile/h)")).toBe("165 km/h (105 Meilen an der Stonn)"); // km/h → the tier
        expect(N("300 mph")).toBe("300 Meilen an der Stonn");
    });

    test("the squared/cubed unit fuses German-style, from the corpus's own compounds", () => {
        expect(lb.text("19 500 km²").trim()).toBe(lb.text("19500 Quadratkilometer").trim());
        expect(lb.text("5 m²").trim()).toBe(lb.text("5 Quadratmeter").trim());
        expect(lb.text("7 m³").trim()).toBe(lb.text("7 Kubikmeter").trim()); // cf. the corpus's Kubikmeter
    });

    // `&` has 2 corpus instances; the relational signs have zero and are read anyway (a dropped
    // sign is inaudible, which is the one outcome that cannot be right).
    test("no sign class is silently dropped", () => {
        expect(N("College of Arts & Sciences")).toBe("College of Arts an Sciences");
        expect(N("x = y")).toBe("x ass gläich y");
        expect(N("5 < 6")).toBe("5 méi kleng ewéi 6");
        expect(N("7 > 6")).toBe("7 méi grouss ewéi 6");
        expect(N("6 × 6 cm")).toBe("6 mol 6 cm");
        expect(N("12 ÷ 4")).toBe("12 dividéiert duerch 4"); // the corpus's own "dividéiert duerch zwielef"
        expect(N("4x4")).toBe("4x4"); // the ASCII x is a LETTER here and stays one
    });

    // The shared symbol tier, reached through the engine so the words are proved to pass the g2p (a word your layer emits must come from the…)).
    test("the symbol tier: percent, currency, units and the two rate idioms", () => {
        expect(lb.text("88 %").trim()).toBe(lb.text("88 Prozent").trim()); // ⚠ NARROW NBSP U+202F, not the U+00A0 used above
        expect(lb.text("30 $").trim()).toBe(lb.text("30 Dollar").trim()); // ⚠ NARROW NBSP U+202F
        expect(lb.text("165 km/h").trim()).toBe(lb.text("165 Kilometer an der Stonn").trim()); // corpus idiom
        expect(lb.text("133 m/s").trim()).toBe(lb.text("133 Meter pro Sekonn").trim()); // corpus idiom
        expect(lb.text("7 cm").trim()).toBe(lb.text("7 Zentimeter").trim()); // was *km*
        expect(lb.text("0 kg").trim()).toBe(lb.text("0 Kilogramm").trim()); // was *kk*
    });

    // ── REVIEW ADDITIONS ──────────────────────────────────────────────────────────────────────
    // The PARENTHETICAL EN DASH was dropped outright in 31 utterances, running two clauses together. It
    // reads as the short break `;` and `:` already map to. The corpus's 54 en dashes are 11 numeric ranges
    // (claimed as `bis` long before the tokenizer) and this.
    test("a parenthetical en dash is a pause, not silence", () => {
        const lb = getPhonemizer("lb");
        expect(lb.text("Kloteren a Sprangen – erfuerdert awer Training.").trim())
            .toBe("klotərən a ʃpraŋən , ərfuərdərt avər trai̯niŋ .");
        // A numeric range never reaches the tokenizer as a dash, so this must still be `bis`.
        expect(normalizeLuxembourgish("vun 2 – 3 km")).toContain("bis");
    });

    // THE EIFELER REGEL APPLIES ACROSS A NUMBER'S RIGHT EDGE. normalize.ts already applied it wherever IT
    // emitted a numeral word; the plain number path did not, so the sandhi was right in the rewritten
    // cases and wrong in the ordinary one. 9 corpus utterances, all on *siwen*.
    test("a cardinal's unstressed -en obeys the Eifeler Regel before the next word", () => {
        const lb = getPhonemizer("lb");
        expect(lb.text("Et sinn 7 Kilometer.").trim()).toBe("æt zin zivə kilomətər ."); // dropped before K
        expect(lb.text("Et sinn 7 Deeg.").trim()).toBe("æt zin zivən deːχ ."); // kept before d
        expect(lb.text("Et sinn 7 Auer.").trim()).toBe("æt zin zivən æu̯ər ."); // kept before a vowel
        // BEFORE A PAUSE THE ⟨n⟩ IS RETAINED. Trimming whitespace alone handed the rule a `.`, which is
        // outside the keeper set, so the sandhi fired across a sentence boundary and said *siwe*.
        expect(lb.text("Et sinn 7.").trim()).toBe("æt zin zivən .");
        // THE STEM OF *Millioun* IS NOT AN INFLECTIONAL ⟨-en⟩ — a bare final-n test read *eng Milliou*.
        expect(lb.text("Et sinn 1000000 Kilometer.").trim()).toBe("æt zin æŋ miliəu̯n kilomətər .");
    });

    // A MAGNITUDE BETWEEN THE NUMBER AND ITS UNIT left `km` entirely raw, because the shared tier needs the
    // number adjacent to the unit. Fixed in core/normalizeSymbols.ts, where currency had had the same hop
    // for far longer; six other languages were shipping the identical defect on this same sentence.
    test("a magnitude between the number and the unit", () => {
        const lb = getPhonemizer("lb");
        expect(lb.text("iwwer 2,2 Millioune km² vum Ozean").trim())
            .toBe("ivər t͡sveː koma t͡sveː miliəu̯nə kvadratkilomətər fum ot͡səan");
    });
});
