import { describe, expect, test } from "vitest";

import { accentLexiconHas, phonemizeWord, createSerbian } from "../src/languages/serbian/serbian.ts";

// Canonical-IPA goldens for Serbian / српски (sr) — South Slavic, DUAL SCRIPT (Cyrillic + Gaj's Latin), fully
// phonemic. Both scripts map to the same IPA. Signature: ⟨в/v⟩→ʋ (labiodental approximant), ⟨ђ⟩→d͡ʑ / ⟨ћ⟩→t͡ɕ
// (alveolo-palatal affricates), ⟨џ/dž⟩→d͡ʒ, ⟨љ/lj⟩→ʎ / ⟨њ/nj⟩→ɲ, ⟨х/h⟩→x, syllabic ⟨r⟩; NO vowel reduction. The
// lexical pitch accent + length are unwritten → deferred (no accent mark). Referees: wikipron hbs_latn +
// epitran.
describe("Serbian canonical IPA", () => {
    test("Latin: v→ʋ, the alveolo-palatal + palatal series, syllabic r", () => {
        expect(phonemizeWord("voda")).toBe("ʋˈoda"); // v → ʋ
        expect(phonemizeWord("ljubav")).toBe("ʎˈuː˩˥baʋ"); // lj → ʎ
        expect(phonemizeWord("čovek")).toBe("t͡ʃˈoʋek"); // č → t͡ʃ
        expect(phonemizeWord("đak")).toBe("d͡ʑaː˥˩k"); // đ → d͡ʑ
        expect(phonemizeWord("ćao")).toBe("t͡ɕˈaː˥˩o"); // ć → t͡ɕ
        expect(phonemizeWord("džep")).toBe("d͡ʒe˥˩p"); // dž → d͡ʒ
        expect(phonemizeWord("srce")).toBe("sˈr˥˩t͡se"); // syllabic r + c → t͡s
        expect(phonemizeWord("njega")).toBe("ɲˈe˥˩ɡa"); // nj → ɲ
    });

    test("Cyrillic maps to the SAME IPA", () => {
        expect(phonemizeWord("вода")).toBe("ʋˈoda");
        expect(phonemizeWord("љубав")).toBe("ʎˈuː˩˥baʋ");
        expect(phonemizeWord("ђак")).toBe("d͡ʑaː˥˩k"); // ђ → d͡ʑ
        expect(phonemizeWord("срце")).toBe("sˈr˥˩t͡se");
        expect(phonemizeWord("хвала")).toBe("xʋˈaː˩˥la"); // х → x
    });

    test("numbers (Slavic count agreement on hiljada)", () => {
        const d = createSerbian();
        expect(d.text("21").trim()).toBe("dʋˈaː˩˥deset jˈe˩˥dan"); // dvadeset jedan
        expect(d.text("234").trim()).toBe("dʋˈe˥˩sta trˈiː˩˥deset t͡ʃˈe˩˥tiri"); // dvesta trideset četiri
        expect(d.text("1000").trim()).toBe("xˈiʎadu"); // hiljadu
        expect(d.text("5000").trim()).toBe("peː˥˩t xˈiʎada"); // pet hiljada (5+ → many)
    });

    // GENDER on the magnitude noun: hiljada is FEMININE, so the multiplier is dve / jedna (Serbian is ekavian →
    // dve, not the ijekavian dvije). milion is masculine and keeps dva.
    test("numbers: gender agreement on the FEMININE hiljada", () => {
        const d = createSerbian();
        expect(d.text("1000").trim()).toBe("xˈiʎadu"); // hiljadu — the standalone form
        expect(d.text("2000").trim()).toBe("dʋeː˥˩ xˈiʎade"); // dve hiljade — FEM two (not *dva hiljade)
        expect(d.text("5000").trim()).toBe("peː˥˩t xˈiʎada"); // pet hiljada — gen.pl
        expect(d.text("21000").trim()).toBe("dʋˈaː˩˥deset jednˈa xˈiʎada"); // dvadeset jedna hiljada — …1 → fem sg
        expect(d.text("1000000").trim()).toBe("jˈe˩˥dan milˈi˩˥on"); // jedan milion — masculine
        expect(d.text("2000000").trim()).toBe("dʋaː˥˩ miliˈona"); // dva miliona — masculine keeps dva
    });
});

// TEXT NORMALIZATION. Every case here is a form ATTESTED in the sr_rs FLEURS corpus (1,923 unique
// utterances) with the reading the corpus itself licenses; see src/languages/serbian/normalize.ts for the
// tabulation and the counts. Asserted through the engine's `text()`, not against the normalizer, so the
// wiring and the ordering are covered too.
describe("Serbian normalization", () => {
    const say = (s: string): string => createSerbian().text(s).trim();

    // The dominant defect (×211): Serbian writes an ordinal as numeral + PERIOD, and the engine read the
    // digits as a cardinal and the period as a sentence break.
    test("N. ordinals — the case is chosen by the licensing word", () => {
        expect(say("1624. године")).toBe("xˈiʎadu ʃˈeː˥˩ststo dʋˈaː˩˥deset t͡ʃˈetʋrte ɡˈodine"); // f.gen
        expect(say("у 54. години")).toBe("u pedˈe˩˥set t͡ʃˈetʋrtoj ɡˈodini"); // f.dat/loc
        expect(say("за 2020. годину")).toBe("za dʋeː˥˩ xˈiʎade dʋˈaː˩˥desetu ɡˈodinu"); // f.acc
        expect(say("16. века")).toBe("ʃesnˈaestoɡ ʋˈeka"); // m.gen — corpus: двадесетог века
        expect(say("у 20. веку")).toBe("u dʋˈaː˩˥desetom ʋˈeku"); // m.loc — corpus: двадесетом веку
        expect(say("21. јула")).toBe("dʋˈaː˩˥deset pˈr˩˥ʋoɡ jˈula"); // month genitive
        expect(say("3. августа")).toBe("trˈet͡ɕeɡ aʋɡˈusta"); // treći is the one SOFT stem: trećeg, not *trećog
        expect(say("400. године")).toBe("t͡ʃetˈiristote ɡˈodine"); // round hundred → the hundreds ordinal
    });

    // The guard that makes the rule safe. Nothing outside the licensor list is claimed, so every
    // sentence-final period survives — measured over the whole corpus as ZERO pauses lost.
    test("N. that is NOT an ordinal keeps its sentence pause", () => {
        expect(say("типа 1.")).toBe("tˈipa jˈe˩˥dan ."); // a model number at a sentence end
        expect(say("1770. Некад")).toBe("xˈiʎadu sˈe˥˩damsto sedamdˈe˩˥set . nˈe˥˩kad"); // capitalised ⇒ a new sentence
        expect(say("прича, итд.)")).toBe("prˈiː˥˩t͡ʃa , i tˈa˩˥ko dˈa˥˩ʎe ."); // `)` is not a pause, so the dot stays
    });

    // Serbian groups thousands with a PERIOD, which split the number AND inserted a phrase break.
    test("period-grouped thousands", () => {
        expect(say("1.400 људи")).toBe("xˈiʎadu t͡ʃˈe˥˩tiristo ʎˈudi");
        expect(say("5.000.000")).toBe("peː˥˩t miliˈona"); // adjacent groups share a digit ⇒ two passes
    });

    // Both count slots are corpus-attested: 2–4 takes the GENITIVE SINGULAR (83 метра, 24 сата, 32
    // процента), 5+ the genitive plural (48 сати, 50 километара) — Russian's selector, not Polish's.
    test("units and the three-way count agreement", () => {
        expect(say("70 km")).toBe("sedamdˈe˩˥set kˈilometara"); // gen.pl
        expect(say("83 km")).toBe("osamdˈe˩˥set triː˥˩ kˈilometra"); // gen.sg — …3
        expect(say("24 mm")).toBe("dʋˈaː˩˥deset t͡ʃˈe˩˥tiri mˈilimetra");
        expect(say("88%")).toBe("osamdˈe˩˥set ˈo˥˩sam pˈo˥˩sto"); // posto is INDECLINABLE (corpus ×57)
        expect(say("19.500 km²")).toBe("deʋˈe˩˥tnaest xˈiʎada pˈeː˥˩tsto kʋˈa˩˥dratnix kˈilometara");
    });

    // The rate preposition is NOT one word: the corpus writes `240 километара НА сат` but `1,5
    // километара У СЕКУНДИ`, so `/h` goes through the shared `unitPer` and `/s` is composed locally.
    test("rates take two different prepositions", () => {
        expect(say("480 km/h")).toBe("t͡ʃˈe˥˩tiristo osamdˈe˩˥set kˈilometara na saː˥˩t");
        expect(say("133 m/s")).toBe("stoː˥˩ trˈiː˩˥deset triː˥˩ mˈetra u sekˈuː˩˥ndi");
    });

    test("clock, decimals and signs", () => {
        expect(say("11:00")).toBe("jedˈa˩˥naest sˈati");
        expect(say("22:08")).toBe("dʋˈaː˩˥deset dʋaː˥˩ sˈaː˥˩ta i ˈo˥˩sam minˈuː˩˥ta");
        expect(say("5:3")).toBe("peː˥˩t , triː˥˩"); // a SCORE — one-digit minutes are not a clock
        expect(say("1,5 сати")).toBe("jˈe˩˥dan zˈarez peː˥˩t sˈati"); // was a phrase break between the digits
        expect(say("4x4")).toBe("t͡ʃˈe˩˥tiri pˈuta t͡ʃˈe˩˥tiri");
        // NO minus rule: the corpus has zero negative numbers and eleven punctuation dashes, one of them
        // before a numeral. Reading it as a sign was confidently wrong.
        expect(say("низак – 6000")).toBe("nˈi˥˩zak ʃeː˥˩st xˈiʎada");
    });

    // The suffix is the last letters of the INFLECTED ordinal, so the rule generates the paradigm and
    // keeps the form that actually ends with them. Written in CYRILLIC on a LATIN-emitted ordinal, which
    // is why the captured suffix is transliterated first.
    test("numeral + hyphen + case suffix, across scripts", () => {
        expect(say("1970-их")).toBe("xˈiʎadu dˈe˥˩ʋetsto sedamdˈe˩˥setix");
        expect(say("15-ог века")).toBe("petnˈaestoɡ ʋˈeka");
        expect(say("11-ом веку")).toBe("jedanˈaestom ʋˈeku");
        expect(say("11-годишња")).toBe("jedˈa˩˥naest ɡˈodiʃɲa"); // a COMPOUND adjective — deliberately not claimed
    });

    // Serbian is DIGRAPHIC: a rule keyed on Latin spellings alone is a no-op on Cyrillic prose, which is
    // what sr_rs is written in. Both scripts must reach the same reading.
    test("digraphia — the same rule fires in either script", () => {
        expect(say("1624. godine")).toBe(say("1624. године"));
        expect(say("итд.")).toBe(say("itd."));
        expect(say("323. године п. н. е.")).toBe("trˈi˥˩sta dʋˈaː˩˥deset trˈet͡ɕe ɡˈodine pre˥˩ nˈoʋe ˈere .");
        // The era marker's final dot is ALSO the sentence end when a capital follows — it must not be eaten.
        expect(say("Око 1000. п. н. е. Асирци")).toBe("ˈo˥˩ko xˈiʎadite pre˥˩ nˈoʋe ˈere . asˈiː˩˥rt͡si");
    });

    test("degrees consume the degree noun the text already wrote", () => {
        expect(say("32 °C степена")).toBe("trˈiː˩˥deset dʋaː˥˩ stˈepena t͡sˈelzijusa");
        expect(say("90 °F")).toBe("deʋedˈe˩˥set stˈe˥˩peni fˈarenxajta");
        // ⚠ A BARE ° MUST STILL READ THE DEGREE NOUN, with numeral agreement and no scale word. Declining it
        // outright protects the scale word (Celsius/Fahrenheit, which the C/F arm supplies) but throws the
        // degree noun away with it — and a LONGITUDE then loses the word that makes it one.
        // ⚠ The compass `W` is still unread, and deliberately: `јужне` is ×0 in this corpus, so a four-way
        // table would have to invent its missing quarter. Only the recoverable half is fixed. The degree
        // rule CONSUMES the letter to enforce that, rather than leaving it for the g2p to drop.
        // ⚠ GOLDEN CHANGED, and the old one was pinning a defect. Leaving `W` in place produced
        // `35 stepeniW` with NO SPACE, so the stress lookup ran on the nonexistent word `stepeniw`, missed
        // stress.tsv and lost the pitch accent — `stˈepeni` where every other route to the same word gives
        // `stˈe˥˩peni`. A stray letter glued to a word silently changes which word is looked up.
        expect(say("35°W")).toBe("trˈiː˩˥deset peː˥˩t stˈe˥˩peni");
        expect(say("35°")).toBe(say("35 stepeni"));   // and all routes to the noun now agree
        // ⚠ THE GUARD SCOPES TO THE COMPASS LETTER, NEVER THE WHOLE MATCH. A trailing lookahead on the rule
        //   made a degree followed by any other letter fail outright and took the degree NOUN with it —
        //   `35°З` read as *trideset pet z*. That is the Cyrillic west-bearing, the form a Cyrillic corpus
        //   actually writes, so the class carries both scripts (С Ј И З, not only N S E W).
        expect(say("35°З")).toBe(say("35 stepeni"));
        expect(say("35°C")).toContain("t͡sˈelzijusa");   // the scale arm still claims its own letter
        // ⚠ INITIALISMS keep their doubled letters — see the hr degemination test.
        expect(say("СССР")).toBe("sssr");
        expect(say("SSSR")).toBe("sssr");   // both scripts, and the doubled letters survive
    });
    // PRIMARY STRESS — lexical, from stress.tsv (kaikki/Wiktionary), shared with the hr and bs engines because
    // they import this g2p. Validated against the COMMITTED wikipron referee, which has carried the pitch accent
    // (â ǎ ê ô) on its own vowels all along while referee-eval's backbone strips it: 99.3% agreement on the
    // 24254 lexicon-covered rows once the ⟨ije⟩ counting convention is separated out.
    // tools/serbian/eval_stress_placement.mts.
    test("lexical stress: from the lexicon, before the nucleus, in both scripts", () => {
        expect(phonemizeWord("jezik")).toBe("jˈe˩˥zik"); // jèzik — σ1
        expect(phonemizeWord("beograd")).toBe("beˈo˩˥ɡrad"); // Beògrad — σ2, not derivable from spelling
        expect(phonemizeWord("pedeset")).toBe("pedˈe˩˥set"); // pedèsēt — and 20/30 differ: dvádeset is σ1
        expect(phonemizeWord("dvadeset")).toBe("dʋˈaː˩˥deset");
        expect(phonemizeWord("Србијанка")).toBe("srbˈi˩˥janka"); // Cyrillic key; the ⟨р⟩ is nucleus 0
        // ⚠ SYLLABIC ⟨r⟩ IS A NUCLEUS and can carry the accent (sȑce, dr̀žava, kȓv).
        expect(phonemizeWord("srce")).toBe("sˈr˥˩t͡se");
        expect(phonemizeWord("država")).toBe("dˈr˩˥ʒaʋa");
        expect(phonemizeWord("trgovati")).toBe("trɡˈo˩˥ʋati"); // trgòvati — σ2, past the syllabic r
        // ⚠ THE IJEKAVIAN ⟨ije⟩. The lexicon is built from the accented SPELLING (rijéka), not the IPA
        // (/rjěːka/) whose ⟨i⟩ is the glide /j/ — this g2p emits /i/, so the ordinals must count spelling.
        expect(phonemizeWord("rijeka")).toBe("rijˈeː˩˥ka");
        expect(phonemizeWord("mlijeko")).toBe("mlijˈeː˩˥ko");
        // ⚠ NO MARK ON A MONOSYLLABLE (the Russian convention). It also declines to assert a stress the
        // proclitics do not have: je/se/li/ga/su are unstressed in running speech but dictionaried with one.
        expect(phonemizeWord("krv")).toBe("krː˥˩ʋ");
        expect(phonemizeWord("je")).toBe("je");
        // OOV → the first nucleus, and NO TONE. The tone has no fallback: on the first nucleus the lexicon
        // splits 19297 rising / 16882 falling, a coin flip. An absent tone letter means "not in the lexicon",
        // never "no accent" — accentLexiconHas() exists so an eval can tell those apart.
        // `godine` is the corpus's commonest OOV word.
        expect(phonemizeWord("godine")).toBe("ɡˈodine");
    });

    // THE FOUR-WAY PITCH ACCENT — short/long × rising/falling, emitted as a Chao tone letter immediately after
    // the nucleus, exactly where Vietnamese and Thai put theirs (kʰˈaː˥˩w, mˈaː˧˥). ⚠ NOT the caron/circumflex
    // the Serbo-Croatian sources use: every other tone language in this fleet writes Chao letters, and choosing
    // them adds ZERO new symbols to the inventory — ˩˥ is already emitted by Lingala/Zulu/Hausa/Xhosa and ˥˩ by
    // Thai/Burmese/Minnan/Punjabi. Validated against the referee's own caron/circumflex marks: contour 99.7%,
    // length 99.8% over 24407 words. tools/serbian/eval_stress_placement.mts.
    test("the four-way pitch accent: contour after the nucleus, length on it", () => {
        expect(phonemizeWord("jezik")).toBe("jˈe˩˥zik"); // jèzik — short rising
        expect(phonemizeWord("beograd")).toBe("beˈo˩˥ɡrad"); // Beògrad — short rising, σ2
        expect(phonemizeWord("rijeka")).toBe("rijˈeː˩˥ka"); // rijéka — LONG rising, so the ː comes too
        expect(phonemizeWord("srce")).toBe("sˈr˥˩t͡se"); // sȑce — short falling, on the syllabic r
        // ⚠ A MONOSYLLABLE TAKES NO ˈ BUT DOES TAKE ITS TONE. The falling contrast is phonemic here — grâd
        // "city" against grȁd "hail" — so dropping it would delete a minimal pair, and the reason ˈ is skipped
        // (it carries no information on one syllable) simply does not apply to the tone.
        expect(phonemizeWord("noć")).toBe("noː˥˩t͡ɕ"); // nȏć — long falling
        // ⚠ …AND WHEN THE SPELLING HAS TWO CONTOURS RECORDED, THE LEXICON ABSTAINS. `grad` is exactly the
        // grâd/grȁd pair: the position is known, the contour is not, so ˈ-and-no-tone rather than a coin flip.
        // 2486 keys are marked this way; withholding them moved measured contour accuracy 99.2% → 99.7%.
        expect(phonemizeWord("grad")).toBe("ɡrad");
        // Clitics carry no accent of their own in a phrase, whatever citation form the dictionary gives them.
        expect(phonemizeWord("je")).toBe("je");
        expect(phonemizeWord("od")).toBe("od");
        expect(accentLexiconHas("jezik")).toBe(true);
        expect(accentLexiconHas("godine")).toBe(false); // OOV: the missing tone is missing DATA
    });

    // THE OOV TIER — accent-transitions.tsv. The lexicon reaches ~43% of polysyllabic corpus tokens; the rest is
    // mostly INFLECTED FORMS of lemmas it already has, so the table transforms a KNOWN stem accent rather than
    // predicting one from nothing: key (ending, stem tone) → (nucleus shift, resulting tone).
    // Held-out 83.7% position against the 66.8% first-nucleus fallback it replaces.
    test("OOV: the accent transitions off a known stem, rather than defaulting", () => {
        // ⚠ THE CASE THAT MOTIVATES THE TIER. `sedamdeset` is in the lexicon on σ3 (sedamdèsēt); the genitive
        // plural is not, and the fallback put it on σ1 — a syllable the base never stresses.
        expect(phonemizeWord("sedamdeset")).toBe("sedamdˈe˩˥set");
        expect(accentLexiconHas("sedamdesetih")).toBe(false);
        expect(phonemizeWord("sedamdesetih")).toBe("sedamdˈe˩˥setix"); // stem's ordinal carried across
        // ⚠ THE TONE GATE IS TIGHTER THAN THE POSITION ONE, and asymmetrically so on purpose: position always
        // beats its alternative, tone has no such floor. `godina` is in the lexicon and keeps its contour;
        // `godine` is derived and the ending's context does not clear support≥5 ∧ agreement≥90, so the position
        // is emitted and the contour withheld. An absent tone letter never means "no accent".
        expect(phonemizeWord("godina")).toBe("ɡˈo˥˩dina");
        expect(phonemizeWord("godine")).toBe("ɡˈodine");
        // A derived contour that DOES clear the gate is emitted — measured at 98.3%, i.e. lexicon-grade.
        expect(phonemizeWord("stepeni")).toBe("stˈe˥˩peni"); // stȅpenī, from stepen
    });

});
