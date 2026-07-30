import { describe, expect, test } from "vitest";

import { phonemizeWord, createSerbian } from "../src/languages/serbian/serbian.ts";

// Canonical-IPA goldens for Serbian / српски (sr) — South Slavic, DUAL SCRIPT (Cyrillic + Gaj's Latin), fully
// phonemic. Both scripts map to the same IPA. Signature: ⟨в/v⟩→ʋ (labiodental approximant), ⟨ђ⟩→d͡ʑ / ⟨ћ⟩→t͡ɕ
// (alveolo-palatal affricates), ⟨џ/dž⟩→d͡ʒ, ⟨љ/lj⟩→ʎ / ⟨њ/nj⟩→ɲ, ⟨х/h⟩→x, syllabic ⟨r⟩; NO vowel reduction. The
// lexical pitch accent + length are unwritten → deferred (no accent mark). Validated at 98.4% vs wikipron hbs
// latin + 99.2% vs epitran. See docs/investigations/sr_native_bringup_investigation.md.
describe("Serbian canonical IPA", () => {
    test("Latin: v→ʋ, the alveolo-palatal + palatal series, syllabic r", () => {
        expect(phonemizeWord("voda")).toBe("ʋoda"); // v → ʋ
        expect(phonemizeWord("ljubav")).toBe("ʎubaʋ"); // lj → ʎ
        expect(phonemizeWord("čovek")).toBe("t͡ʃoʋek"); // č → t͡ʃ
        expect(phonemizeWord("đak")).toBe("d͡ʑak"); // đ → d͡ʑ
        expect(phonemizeWord("ćao")).toBe("t͡ɕao"); // ć → t͡ɕ
        expect(phonemizeWord("džep")).toBe("d͡ʒep"); // dž → d͡ʒ
        expect(phonemizeWord("srce")).toBe("srt͡se"); // syllabic r + c → t͡s
        expect(phonemizeWord("njega")).toBe("ɲeɡa"); // nj → ɲ
    });

    test("Cyrillic maps to the SAME IPA", () => {
        expect(phonemizeWord("вода")).toBe("ʋoda");
        expect(phonemizeWord("љубав")).toBe("ʎubaʋ");
        expect(phonemizeWord("ђак")).toBe("d͡ʑak"); // ђ → d͡ʑ
        expect(phonemizeWord("срце")).toBe("srt͡se");
        expect(phonemizeWord("хвала")).toBe("xʋala"); // х → x
    });

    test("numbers (Slavic count agreement on hiljada)", () => {
        const d = createSerbian();
        expect(d.text("21").trim()).toBe("dʋadeset jedan"); // dvadeset jedan
        expect(d.text("234").trim()).toBe("dʋesta trideset t͡ʃetiri"); // dvesta trideset četiri
        expect(d.text("1000").trim()).toBe("xiʎadu"); // hiljadu
        expect(d.text("5000").trim()).toBe("pet xiʎada"); // pet hiljada (5+ → many)
    });

    // GENDER on the magnitude noun: hiljada is FEMININE, so the multiplier is dve / jedna (Serbian is ekavian →
    // dve, not the ijekavian dvije). milion is masculine and keeps dva.
    test("numbers: gender agreement on the FEMININE hiljada", () => {
        const d = createSerbian();
        expect(d.text("1000").trim()).toBe("xiʎadu"); // hiljadu — the standalone form
        expect(d.text("2000").trim()).toBe("dʋe xiʎade"); // dve hiljade — FEM two (not *dva hiljade)
        expect(d.text("5000").trim()).toBe("pet xiʎada"); // pet hiljada — gen.pl
        expect(d.text("21000").trim()).toBe("dʋadeset jedna xiʎada"); // dvadeset jedna hiljada — …1 → fem sg
        expect(d.text("1000000").trim()).toBe("jedan milion"); // jedan milion — masculine
        expect(d.text("2000000").trim()).toBe("dʋa miliona"); // dva miliona — masculine keeps dva
    });
});

// #562 TEXT NORMALIZATION. Every case here is a form ATTESTED in the sr_rs FLEURS corpus (1,923 unique
// utterances) with the reading the corpus itself licenses; see src/languages/serbian/normalize.ts for the
// tabulation and the counts. Asserted through the engine's `text()`, not against the normalizer, so the
// wiring and the ordering are covered too.
describe("Serbian normalization (#562)", () => {
    const say = (s: string): string => createSerbian().text(s).trim();

    // The dominant defect (×211): Serbian writes an ordinal as numeral + PERIOD, and the engine read the
    // digits as a cardinal and the period as a sentence break.
    test("N. ordinals — the case is chosen by the licensing word", () => {
        expect(say("1624. године")).toBe("xiʎadu ʃeststo dʋadeset t͡ʃetʋrte ɡodine"); // f.gen
        expect(say("у 54. години")).toBe("u pedeset t͡ʃetʋrtoj ɡodini"); // f.dat/loc
        expect(say("за 2020. годину")).toBe("za dʋe xiʎade dʋadesetu ɡodinu"); // f.acc
        expect(say("16. века")).toBe("ʃesnaestoɡ ʋeka"); // m.gen — corpus: двадесетог века
        expect(say("у 20. веку")).toBe("u dʋadesetom ʋeku"); // m.loc — corpus: двадесетом веку
        expect(say("21. јула")).toBe("dʋadeset prʋoɡ jula"); // month genitive
        expect(say("3. августа")).toBe("tret͡ɕeɡ aʋɡusta"); // treći is the one SOFT stem: trećeg, not *trećog
        expect(say("400. године")).toBe("t͡ʃetiristote ɡodine"); // round hundred → the hundreds ordinal
    });

    // The guard that makes the rule safe. Nothing outside the licensor list is claimed, so every
    // sentence-final period survives — measured over the whole corpus as ZERO pauses lost.
    test("N. that is NOT an ordinal keeps its sentence pause", () => {
        expect(say("типа 1.")).toBe("tipa jedan ."); // a model number at a sentence end
        expect(say("1770. Некад")).toBe("xiʎadu sedamsto sedamdeset . nekad"); // capitalised ⇒ a new sentence
        expect(say("прича, итд.)")).toBe("prit͡ʃa , i tako daʎe ."); // `)` is not a pause, so the dot stays
    });

    // Serbian groups thousands with a PERIOD, which split the number AND inserted a phrase break.
    test("period-grouped thousands", () => {
        expect(say("1.400 људи")).toBe("xiʎadu t͡ʃetiristo ʎudi");
        expect(say("5.000.000")).toBe("pet miliona"); // adjacent groups share a digit ⇒ two passes
    });

    // Both count slots are corpus-attested: 2–4 takes the GENITIVE SINGULAR (83 метра, 24 сата, 32
    // процента), 5+ the genitive plural (48 сати, 50 километара) — Russian's selector, not Polish's.
    test("units and the three-way count agreement", () => {
        expect(say("70 km")).toBe("sedamdeset kilometara"); // gen.pl
        expect(say("83 km")).toBe("osamdeset tri kilometra"); // gen.sg — …3
        expect(say("24 mm")).toBe("dʋadeset t͡ʃetiri milimetra");
        expect(say("88%")).toBe("osamdeset osam posto"); // posto is INDECLINABLE (corpus ×57)
        expect(say("19.500 km²")).toBe("deʋetnaest xiʎada petsto kʋadratnix kilometara");
    });

    // The rate preposition is NOT one word: the corpus writes `240 километара НА сат` but `1,5
    // километара У СЕКУНДИ`, so `/h` goes through the shared `unitPer` and `/s` is composed locally.
    test("rates take two different prepositions", () => {
        expect(say("480 km/h")).toBe("t͡ʃetiristo osamdeset kilometara na sat");
        expect(say("133 m/s")).toBe("sto trideset tri metra u sekundi");
    });

    test("clock, decimals and signs", () => {
        expect(say("11:00")).toBe("jedanaest sati");
        expect(say("22:08")).toBe("dʋadeset dʋa sata i osam minuta");
        expect(say("5:3")).toBe("pet , tri"); // a SCORE — one-digit minutes are not a clock
        expect(say("1,5 сати")).toBe("jedan zarez pet sati"); // was a phrase break between the digits
        expect(say("4x4")).toBe("t͡ʃetiri puta t͡ʃetiri");
        // NO minus rule: the corpus has zero negative numbers and eleven punctuation dashes, one of them
        // before a numeral. Reading it as a sign was confidently wrong.
        expect(say("низак – 6000")).toBe("nizak ʃest xiʎada");
    });

    // The suffix is the last letters of the INFLECTED ordinal, so the rule generates the paradigm and
    // keeps the form that actually ends with them. Written in CYRILLIC on a LATIN-emitted ordinal, which
    // is why the captured suffix is transliterated first.
    test("numeral + hyphen + case suffix, across scripts", () => {
        expect(say("1970-их")).toBe("xiʎadu deʋetsto sedamdesetix");
        expect(say("15-ог века")).toBe("petnaestoɡ ʋeka");
        expect(say("11-ом веку")).toBe("jedanaestom ʋeku");
        expect(say("11-годишња")).toBe("jedanaest ɡodiʃɲa"); // a COMPOUND adjective — deliberately not claimed
    });

    // Serbian is DIGRAPHIC: a rule keyed on Latin spellings alone is a no-op on Cyrillic prose, which is
    // what sr_rs is written in. Both scripts must reach the same reading.
    test("digraphia — the same rule fires in either script", () => {
        expect(say("1624. godine")).toBe(say("1624. године"));
        expect(say("итд.")).toBe(say("itd."));
        expect(say("323. године п. н. е.")).toBe("trista dʋadeset tret͡ɕe ɡodine pre noʋe ere .");
        // The era marker's final dot is ALSO the sentence end when a capital follows — it must not be eaten.
        expect(say("Око 1000. п. н. е. Асирци")).toBe("oko xiʎadite pre noʋe ere . asirt͡si");
    });

    test("degrees consume the degree noun the text already wrote", () => {
        expect(say("32 °C степена")).toBe("trideset dʋa stepena t͡selzijusa");
        expect(say("90 °F")).toBe("deʋedeset stepeni farenxajta");
        expect(say("35°W")).toBe("trideset pet"); // a LONGITUDE — outside the rule on purpose
    });
});
