import { describe, expect, test } from "vitest";

import { phonemizeWord, createSerbian } from "../src/languages/serbian/serbian.ts";

// Canonical-IPA goldens for Serbian / српски (sr) — South Slavic, DUAL SCRIPT (Cyrillic + Gaj's Latin), fully
// phonemic. Both scripts map to the same IPA. Signature: ⟨в/v⟩→ʋ (labiodental approximant), ⟨ђ⟩→d͡ʑ / ⟨ћ⟩→t͡ɕ
// (alveolo-palatal affricates), ⟨џ/dž⟩→d͡ʒ, ⟨љ/lj⟩→ʎ / ⟨њ/nj⟩→ɲ, ⟨х/h⟩→x, syllabic ⟨r⟩; NO vowel reduction. The
// lexical pitch accent + length are unwritten → deferred (no accent mark). Referees: wikipron hbs_latn +
// epitran.
describe("Serbian canonical IPA", () => {
    test("Latin: v→ʋ, the alveolo-palatal + palatal series, syllabic r", () => {
        expect(phonemizeWord("voda")).toBe("ʋˈoda"); // v → ʋ
        expect(phonemizeWord("ljubav")).toBe("ʎˈubaʋ"); // lj → ʎ
        expect(phonemizeWord("čovek")).toBe("t͡ʃˈoʋek"); // č → t͡ʃ
        expect(phonemizeWord("đak")).toBe("d͡ʑak"); // đ → d͡ʑ
        expect(phonemizeWord("ćao")).toBe("t͡ɕˈao"); // ć → t͡ɕ
        expect(phonemizeWord("džep")).toBe("d͡ʒep"); // dž → d͡ʒ
        expect(phonemizeWord("srce")).toBe("sˈrt͡se"); // syllabic r + c → t͡s
        expect(phonemizeWord("njega")).toBe("ɲˈeɡa"); // nj → ɲ
    });

    test("Cyrillic maps to the SAME IPA", () => {
        expect(phonemizeWord("вода")).toBe("ʋˈoda");
        expect(phonemizeWord("љубав")).toBe("ʎˈubaʋ");
        expect(phonemizeWord("ђак")).toBe("d͡ʑak"); // ђ → d͡ʑ
        expect(phonemizeWord("срце")).toBe("sˈrt͡se");
        expect(phonemizeWord("хвала")).toBe("xʋˈala"); // х → x
    });

    test("numbers (Slavic count agreement on hiljada)", () => {
        const d = createSerbian();
        expect(d.text("21").trim()).toBe("dʋˈadeset jˈedan"); // dvadeset jedan
        expect(d.text("234").trim()).toBe("dʋˈesta trˈideset t͡ʃˈetiri"); // dvesta trideset četiri
        expect(d.text("1000").trim()).toBe("xˈiʎadu"); // hiljadu
        expect(d.text("5000").trim()).toBe("pet xˈiʎada"); // pet hiljada (5+ → many)
    });

    // GENDER on the magnitude noun: hiljada is FEMININE, so the multiplier is dve / jedna (Serbian is ekavian →
    // dve, not the ijekavian dvije). milion is masculine and keeps dva.
    test("numbers: gender agreement on the FEMININE hiljada", () => {
        const d = createSerbian();
        expect(d.text("1000").trim()).toBe("xˈiʎadu"); // hiljadu — the standalone form
        expect(d.text("2000").trim()).toBe("dʋe xˈiʎade"); // dve hiljade — FEM two (not *dva hiljade)
        expect(d.text("5000").trim()).toBe("pet xˈiʎada"); // pet hiljada — gen.pl
        expect(d.text("21000").trim()).toBe("dʋˈadeset jˈedna xˈiʎada"); // dvadeset jedna hiljada — …1 → fem sg
        expect(d.text("1000000").trim()).toBe("jˈedan milˈion"); // jedan milion — masculine
        expect(d.text("2000000").trim()).toBe("dʋa mˈiliona"); // dva miliona — masculine keeps dva
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
        expect(say("1624. године")).toBe("xˈiʎadu ʃˈeststo dʋˈadeset t͡ʃˈetʋrte ɡˈodine"); // f.gen
        expect(say("у 54. години")).toBe("u pedˈeset t͡ʃˈetʋrtoj ɡˈodini"); // f.dat/loc
        expect(say("за 2020. годину")).toBe("za dʋe xˈiʎade dʋˈadesetu ɡˈodinu"); // f.acc
        expect(say("16. века")).toBe("ʃˈesnaestoɡ ʋˈeka"); // m.gen — corpus: двадесетог века
        expect(say("у 20. веку")).toBe("u dʋˈadesetom ʋˈeku"); // m.loc — corpus: двадесетом веку
        expect(say("21. јула")).toBe("dʋˈadeset pˈrʋoɡ jˈula"); // month genitive
        expect(say("3. августа")).toBe("trˈet͡ɕeɡ ˈaʋɡusta"); // treći is the one SOFT stem: trećeg, not *trećog
        expect(say("400. године")).toBe("t͡ʃˈetiristote ɡˈodine"); // round hundred → the hundreds ordinal
    });

    // The guard that makes the rule safe. Nothing outside the licensor list is claimed, so every
    // sentence-final period survives — measured over the whole corpus as ZERO pauses lost.
    test("N. that is NOT an ordinal keeps its sentence pause", () => {
        expect(say("типа 1.")).toBe("tˈipa jˈedan ."); // a model number at a sentence end
        expect(say("1770. Некад")).toBe("xˈiʎadu sˈedamsto sedamdˈeset . nˈekad"); // capitalised ⇒ a new sentence
        expect(say("прича, итд.)")).toBe("prˈit͡ʃa , i tˈako dˈaʎe ."); // `)` is not a pause, so the dot stays
    });

    // Serbian groups thousands with a PERIOD, which split the number AND inserted a phrase break.
    test("period-grouped thousands", () => {
        expect(say("1.400 људи")).toBe("xˈiʎadu t͡ʃˈetiristo ʎˈudi");
        expect(say("5.000.000")).toBe("pet mˈiliona"); // adjacent groups share a digit ⇒ two passes
    });

    // Both count slots are corpus-attested: 2–4 takes the GENITIVE SINGULAR (83 метра, 24 сата, 32
    // процента), 5+ the genitive plural (48 сати, 50 километара) — Russian's selector, not Polish's.
    test("units and the three-way count agreement", () => {
        expect(say("70 km")).toBe("sedamdˈeset kˈilometara"); // gen.pl
        expect(say("83 km")).toBe("osamdˈeset tri kˈilometra"); // gen.sg — …3
        expect(say("24 mm")).toBe("dʋˈadeset t͡ʃˈetiri mˈilimetra");
        expect(say("88%")).toBe("osamdˈeset ˈosam pˈosto"); // posto is INDECLINABLE (corpus ×57)
        expect(say("19.500 km²")).toBe("deʋˈetnaest xˈiʎada pˈetsto kʋˈadratnix kˈilometara");
    });

    // The rate preposition is NOT one word: the corpus writes `240 километара НА сат` but `1,5
    // километара У СЕКУНДИ`, so `/h` goes through the shared `unitPer` and `/s` is composed locally.
    test("rates take two different prepositions", () => {
        expect(say("480 km/h")).toBe("t͡ʃˈetiristo osamdˈeset kˈilometara na sat");
        expect(say("133 m/s")).toBe("sto trˈideset tri mˈetra u sekˈundi");
    });

    test("clock, decimals and signs", () => {
        expect(say("11:00")).toBe("jedˈanaest sˈati");
        expect(say("22:08")).toBe("dʋˈadeset dʋa sˈata i ˈosam minˈuta");
        expect(say("5:3")).toBe("pet , tri"); // a SCORE — one-digit minutes are not a clock
        expect(say("1,5 сати")).toBe("jˈedan zˈarez pet sˈati"); // was a phrase break between the digits
        expect(say("4x4")).toBe("t͡ʃˈetiri pˈuta t͡ʃˈetiri");
        // NO minus rule: the corpus has zero negative numbers and eleven punctuation dashes, one of them
        // before a numeral. Reading it as a sign was confidently wrong.
        expect(say("низак – 6000")).toBe("nˈizak ʃest xˈiʎada");
    });

    // The suffix is the last letters of the INFLECTED ordinal, so the rule generates the paradigm and
    // keeps the form that actually ends with them. Written in CYRILLIC on a LATIN-emitted ordinal, which
    // is why the captured suffix is transliterated first.
    test("numeral + hyphen + case suffix, across scripts", () => {
        expect(say("1970-их")).toBe("xˈiʎadu dˈeʋetsto sˈedamdesetix");
        expect(say("15-ог века")).toBe("pˈetnaestoɡ ʋˈeka");
        expect(say("11-ом веку")).toBe("jˈedanaestom ʋˈeku");
        expect(say("11-годишња")).toBe("jedˈanaest ɡˈodiʃɲa"); // a COMPOUND adjective — deliberately not claimed
    });

    // Serbian is DIGRAPHIC: a rule keyed on Latin spellings alone is a no-op on Cyrillic prose, which is
    // what sr_rs is written in. Both scripts must reach the same reading.
    test("digraphia — the same rule fires in either script", () => {
        expect(say("1624. godine")).toBe(say("1624. године"));
        expect(say("итд.")).toBe(say("itd."));
        expect(say("323. године п. н. е.")).toBe("trˈista dʋˈadeset trˈet͡ɕe ɡˈodine pre nˈoʋe ˈere .");
        // The era marker's final dot is ALSO the sentence end when a capital follows — it must not be eaten.
        expect(say("Око 1000. п. н. е. Асирци")).toBe("ˈoko xˈiʎadite pre nˈoʋe ˈere . asˈirt͡si");
    });

    test("degrees consume the degree noun the text already wrote", () => {
        expect(say("32 °C степена")).toBe("trˈideset dʋa stˈepena t͡sˈelzijusa");
        expect(say("90 °F")).toBe("deʋedˈeset stˈepeni fˈarenxajta");
        // ⚠ A BARE ° MUST STILL READ THE DEGREE NOUN, with numeral agreement and no scale word. Declining it
        // outright protects the scale word (Celsius/Fahrenheit, which the C/F arm supplies) but throws the
        // degree noun away with it — and a LONGITUDE then loses the word that makes it one.
        // ⚠ The compass `W` is still unread, and deliberately: `јужне` is ×0 in this corpus, so a four-way
        // table would have to invent its missing quarter. Only the recoverable half is fixed.
        expect(say("35°W")).toBe("trˈideset pet stˈepeni");
    });
    // PRIMARY STRESS — lexical, from stress.tsv (kaikki/Wiktionary), shared with the hr and bs engines because
    // they import this g2p. Validated against the COMMITTED wikipron referee, which has carried the pitch accent
    // (â ǎ ê ô) on its own vowels all along while referee-eval's backbone strips it: 99.3% agreement on the
    // 24254 lexicon-covered rows once the ⟨ije⟩ counting convention is separated out.
    // tools/serbian/eval_stress_placement.mts.
    test("lexical stress: from the lexicon, before the nucleus, in both scripts", () => {
        expect(phonemizeWord("jezik")).toBe("jˈezik"); // jèzik — σ1
        expect(phonemizeWord("beograd")).toBe("beˈoɡrad"); // Beògrad — σ2, not derivable from spelling
        expect(phonemizeWord("pedeset")).toBe("pedˈeset"); // pedèsēt — and 20/30 differ: dvádeset is σ1
        expect(phonemizeWord("dvadeset")).toBe("dʋˈadeset");
        expect(phonemizeWord("Србијанка")).toBe("srbˈijanka"); // Cyrillic key; the ⟨р⟩ is nucleus 0
        // ⚠ SYLLABIC ⟨r⟩ IS A NUCLEUS and can carry the accent (sȑce, dr̀žava, kȓv).
        expect(phonemizeWord("srce")).toBe("sˈrt͡se");
        expect(phonemizeWord("država")).toBe("dˈrʒaʋa");
        expect(phonemizeWord("trgovati")).toBe("trɡˈoʋati"); // trgòvati — σ2, past the syllabic r
        // ⚠ THE IJEKAVIAN ⟨ije⟩. The lexicon is built from the accented SPELLING (rijéka), not the IPA
        // (/rjěːka/) whose ⟨i⟩ is the glide /j/ — this g2p emits /i/, so the ordinals must count spelling.
        expect(phonemizeWord("rijeka")).toBe("rijˈeka");
        expect(phonemizeWord("mlijeko")).toBe("mlijˈeko");
        // ⚠ NO MARK ON A MONOSYLLABLE (the Russian convention). It also declines to assert a stress the
        // proclitics do not have: je/se/li/ga/su are unstressed in running speech but dictionaried with one.
        expect(phonemizeWord("krv")).toBe("krʋ");
        expect(phonemizeWord("je")).toBe("je");
        // OOV → the first nucleus. For a DISYLLABLE that is a rule, not a guess: the standard language does not
        // accent the final syllable of a polysyllable. `godine` is the corpus's commonest OOV word.
        expect(phonemizeWord("godine")).toBe("ɡˈodine");
    });

});
