import { describe, expect, test } from "vitest";

import { createLatvian, phonemizeWord } from "../src/languages/latvian/latvian.ts";

// Latvian (lv, latviešu) — Baltic (~1.5M), sister of Lithuanian but a SEPARATE engine. Latvian WRITES what Lithuanian
// leaves implicit: palatalization (ģ ķ ļ ņ → ɟ c ʎ ɲ), vowel length (macrons ā ē ī ū → ː), and stress is FIXED on
// the first syllable (emitted). So the g2p is a mostly-direct grapheme→IPA scan + the native ⟨o⟩→[uɔ̯] diphthong +
// falling-diphthong offglides + regressive devoicing. The narrow referee (1,657 headwords) carries syllable tone +
// the lexical ⟨e⟩ quality (folded in the eval); these golds lock the segment skeleton.
// Referee: wikipron lav_latn_narrow.
describe("Latvian canonical IPA — Baltic rule g2p (written palatals/length + first-syllable stress)", () => {
    const lv = createLatvian();

    test("written palatals ⟨ģ ķ ļ ņ⟩ → ɟ c ʎ ɲ (direct, no contextual palatalization)", () => {
        expect(phonemizeWord("ģimene")).toBe("ɟˈimɛnɛ"); // ⟨ģ⟩ → ɟ
        expect(phonemizeWord("kaķis")).toBe("kˈacis"); // ⟨ķ⟩ → c
        expect(phonemizeWord("ļauns")).toBe("ʎˈauns"); // ⟨ļ⟩ → ʎ
        expect(phonemizeWord("ceļš")).toBe("t͡sˈɛʎʃ"); // ⟨c⟩→t͡s, ⟨ļ⟩→ʎ
    });

    test("native ⟨o⟩ → the falling diphthong [uɔ̯]; ⟨ie⟩ → [iɛ]; ⟨ai/au⟩ offglides; ⟨v⟩ vocalizes in the coda", () => {
        expect(phonemizeWord("loks")).toBe("lˈuɔ̯ks"); // native ⟨o⟩ = [uɔ̯]
        expect(phonemizeWord("roka")).toBe("rˈuɔ̯ka"); // "hand"
        expect(phonemizeWord("dievs")).toBe("dˈiɛws"); // ⟨ie⟩ diphthong (i nucleus) + coda ⟨v⟩→[w]
        expect(phonemizeWord("Valmiera")).toBe("vˈalmiɛra"); // onset ⟨v⟩ stays [v]
        expect(phonemizeWord("maize")).toBe("mˈaizɛ"); // ⟨ai⟩ offglide
        expect(phonemizeWord("neuzmanība")).toBe("nˈɛuzmaniːba"); // ⟨eu⟩ is HIATUS, not a diphthong (no offglide)
    });

    test("written length (macrons) + fixed first-syllable stress", () => {
        expect(phonemizeWord("Jūrmala")).toBe("jˈuːrmala"); // ⟨ū⟩ = [uː], stress on the first syllable
        expect(phonemizeWord("Latvija")).toBe("lˈatvija"); // first-syllable stress
        expect(phonemizeWord("akustiķe")).toBe("ˈakusticɛ"); // stress first even when the long/palatal is later
    });

    test("regressive DEVOICING before a voiceless obstruent (draugs→drauks); no reverse voicing", () => {
        expect(phonemizeWord("draugs")).toBe("drˈauks"); // ⟨g⟩ → k before the voiceless s
        expect(phonemizeWord("zvaigzne")).toBe("zvˈaiɡznɛ"); // ⟨g⟩ stays voiced before the voiced z
    });

    test("cardinal numbers: -padsmit teens, last-digit-1 singular agreement, hundreds-in-thousands", () => {
        expect(lv.text("15").trim()).toBe("pˈiɛt͡spatsmit"); // piecpadsmit (⟨c⟩→t͡s, ⟨d⟩→t before s)
        expect(lv.text("21").trim()).toBe("dˈiwdɛsmit vˈiɛns"); // divdesmit viens (coda ⟨v⟩→w in divdesmit)
        expect(lv.text("234").trim()).toBe("dˈivi sˈimti trˈiːsdɛsmit t͡ʃˈɛtri"); // divi simti trīsdesmit četri
        expect(lv.text("21000").trim()).toBe("dˈiwdɛsmit vˈiɛns tˈuːkstuɔ̯tis"); // ...viens → SINGULAR tūkstotis
        expect(lv.text("100000").trim()).toBe("sˈimts tˈuːkstuɔ̯ʃi"); // simts tūkstoši (hundreds-in-thousands, no "undefined")
        expect(lv.text("1000000").trim()).toBe("vˈiɛns mˈiljuɔ̯ns"); // viens miljons (keeps the numeral, unlike tūkstotis)
    });

    test("clause assembly", () => {
        expect(lv.text("Labdien, Latvija!").trim()).toBe("lˈabdiɛn , lˈatvija !");
    });

    /**
     * ⚠ THE ORDINAL PERIOD IS THE LANGUAGE'S LARGEST NORMALIZATION CLASS and the one that was doing real
     * damage: before `normalize.ts`, `1885. gada` read as a CARDINAL and the ordinal period was taken for a
     * full stop, so a sentence break landed inside the date. The case is not guessed — it is read off the
     * noun the writer already inflected, which is why the three assertions below differ only in the FOLLOWER.
     */
    test("the ordinal period takes its case from the following noun", () => {
        // gada = GENITIVE → -ā; and the year's thousand is `tūkstoš`, not the noun `tūkstotis`
        expect(lv.text("1885. gada").trim()).toBe("tˈuːkstuɔ̯ʃ ˈastuɔ̯ɲi sˈimti ˈastuɔ̯ɲdɛsmit pˈiɛktaː ɡˈada");
        // gadā = LOCATIVE → -ajā, on the same figure's compositor path
        expect(lv.text("2024. gadā").trim()).toBe("dˈivi tˈuːkstuɔ̯ʃi dˈiwdɛsmit t͡sˈɛturtajaː ɡˈadaː");
        // jūlijs = NOMINATIVE → -ais
        expect(lv.text("15. jūlijs").trim()).toBe("pˈiɛt͡spatsmitais jˈuːlijs");
        // a round TEN ordinalises on the tens word itself, in the locative PLURAL: 20. gados → divdesmitajos
        expect(lv.text("20. gados").trim()).toBe("dˈiwdɛsmitajuɔ̯s ɡˈaduɔ̯s");
    });

    /**
     * ⚠ THE HALF-MEASURE, PINNED DELIBERATELY. With no tabulated head noun the ordinal's case is underivable,
     * so the figure stays a CARDINAL — which is wrong — but the PERIOD IS STILL REMOVED, because a Latvian
     * sentence does not continue in lower case and a spurious clause boundary corrupts the prosody of
     * everything after it. This pins the trade, not a bug: if the ordinal ever becomes derivable here, this
     * assertion is the one that should change.
     */
    test("an untabulated follower loses the false sentence break but keeps the cardinal", () => {
        const out = lv.text("5. pakāpe").trim();
        expect(out).toBe("pˈiɛt͡si pˈakaːpɛ");
        expect(out.split(/\s+/u)).not.toContain("."); // the clause break is gone
    });

    /**
     * ⚠ A DEFECT THAT PRODUCES A READING, not garbage (playbook trap 56). `°C` dropped its sign and left ⟨C⟩
     * to the g2p, which read it as Latvian /t͡s/ — a plausible syllable that no leak class, no DROP and no
     * referee can see. The same shape Basque's `º` reached by a different route.
     */
    test("the degree sign and its scale name, and ⟨C⟩ is not read as /t͡s/", () => {
        expect(lv.text("12—18 °C").trim()).toBe("dˈiwpatsmit lˈiːd͡z ˈastuɔ̯ɲpatsmit t͡sˈɛlsija ɡrˈaːdi");
        expect(lv.text("56,4°").trim()).toBe("pˈiɛt͡sdɛsmit sˈɛʃi kˈuɔ̯mats t͡ʃˈɛtri ɡrˈaːdi");
        // a figure with a fraction takes the PLURAL whatever its integer part — 21,5 is not a count of one
        expect(lv.text("21,5 °C").trim()).toContain("ɡrˈaːdi");
        expect(lv.text("21 °C").trim()).toContain("ɡrˈaːts"); // ...but a bare 21 does take the singular
    });

    /**
     * ⚠ THE VALUE ITSELF WAS BEING DESTROYED. Latvian groups digits with a SPACE, so `29 660` was read as two
     * numbers — twenty-nine, then six hundred sixty — and `$230 000` came out as *divi simti trīsdesmit
     * nulle*. De-grouping runs first for that reason.
     */
    test("space-grouped figures keep their value", () => {
        expect(lv.text("29 660 km²").trim()).toBe("dˈiwdɛsmit dˈɛviɲi tˈuːkstuɔ̯ʃi sˈɛʃi sˈimti sˈɛʃdɛsmit kvˈadraːtkiluɔ̯mɛtri");
        expect(lv.text("$230 000").trim()).toBe("dˈivi sˈimti trˈiːsdɛsmit tˈuːkstuɔ̯ʃi dˈuɔ̯laːri");
    });

    /**
     * ⚠ EVERY LEADING ZERO IN A FRACTION IS SPOKEN. This is the defect Basque's review turned up — reading the
     * fraction as a NUMBER makes `5,09` and `5,9` byte-identical, because `Number("09")` is 9, so the quantity
     * is wrong by a factor of ten in perfectly well-formed text and no gate can see it.
     */
    test("the decimal comma, and a leading zero in the fraction is not swallowed", () => {
        expect(lv.text("5,09").trim()).not.toBe(lv.text("5,9").trim());
        expect(lv.text("5,09").trim()).toBe("pˈiɛt͡si kˈuɔ̯mats nˈullɛ dˈɛviɲi");
        expect(lv.text("5,9").trim()).toBe("pˈiɛt͡si kˈuɔ̯mats dˈɛviɲi");
    });

    test("units, rates and agreement (…1 but not …11 takes the singular)", () => {
        expect(lv.text("1 km").trim()).toBe("vˈiɛns kˈiluɔ̯mɛtrs"); // singular
        expect(lv.text("11 km").trim()).toBe("vˈiɛnpatsmit kˈiluɔ̯mɛtri"); // ...11 is NOT singular
        expect(lv.text("21 %").trim()).toBe("dˈiwdɛsmit vˈiɛns prˈuɔ̯t͡sɛnts");
        // the rate's denominator is a LOCATIVE, not a preposition — "kilometri stundā"
        expect(lv.text("120 km/h").trim()).toBe("sˈimts dˈiwdɛsmit kˈiluɔ̯mɛtri stˈundaː");
    });

    test("signs: the range word, and a sign bound to an amount", () => {
        expect(lv.text("54—57%").trim()).toBe("pˈiɛt͡sdɛsmit t͡ʃˈɛtri lˈiːd͡z pˈiɛt͡sdɛsmit sˈɛptiɲi prˈuɔ̯t͡sɛnti");
        expect(lv.text("+5").trim()).toBe("plˈus pˈiɛt͡si");
        expect(lv.text("-5").trim()).toBe("mˈiːnuss pˈiɛt͡si"); // the ASCII hyphen IS a minus before a figure
        // ...but a hyphen BETWEEN figures is a range, and a letter-attached one is neither
        expect(lv.text("1841-1846").trim()).toContain("lˈiːd͡z");
    });

    /**
     * ⚠ A CODE OPERATOR IS NOT AN EQUATION. The first cut replaced every `=` unconditionally and produced
     * `a==b` → *a vienāds  vienāds b* — the word twice AND a double space, which is the SLOT-GAP class the
     * fleet-wide audit exists to find. Caught in self-review, not by a gate, because both halves are readings.
     */
    test("=, < and > are read only when operand-flanked, never as part of a longer operator", () => {
        expect(lv.text("x = y").trim()).toContain("vˈiɛnaːts");
        expect(lv.text("a==b").trim()).not.toContain("vˈiɛnaːts");
        expect(lv.text("5 <= 6").trim()).not.toContain("mˈazaːks");
        expect(lv.text("5 < 6").trim()).toContain("mˈazaːks");
    });

    /**
     * ⚠ REGRESSION GUARDS FROM REVIEW OF #818. Each of these DELETED OR CORRUPTED a word, and none was visible
     * to a leak class, a DROP or the referee.
     */
    test("a last-two-digits value of exactly 10 keeps its numeral", () => {
        // `>= 11` sent 10 to the round-tens arm, which indexes TEN[1] — the empty string. The numeral vanished
        // and the ending was emitted alone: 10. → *ais*, 2010. → *divi tūkstoši ā*.
        // ⟨d⟩ → t before the voiceless s — the engine's own regressive devoicing, not a normalization effect
        expect(lv.text("10. gadsimtā").trim()).toBe("dˈɛsmitajaː ɡˈatsimtaː");
        expect(lv.text("2010. gada").trim()).toBe("dˈivi tˈuːkstuɔ̯ʃi dˈɛsmitaː ɡˈada");
    });

    test("the degree word does not fuse with, or bite into, the token after it", () => {
        // the whitespace after ° was consumed even when no scale letter was taken: *6 grādivirs nulles*
        expect(lv.text("6° virs nulles").trim()).toBe("sˈɛʃi ɡrˈaːdi vˈirs nˈullɛs");
        // no space to inherit at all — separate, so the unread ⟨K⟩ stays visible to the RAW-LATIN gate
        expect(lv.text("6500°K").trim().split(/\s+/u)).toContain("k");
        // the scale letter needs a letter boundary, or it eats the ⟨C⟩ of *Celsija* and leaves *elsija*
        expect(lv.text("20° Celsija skalā").trim()).toBe("dˈiwdɛsmit ɡrˈaːdi t͡sˈɛlsija skˈalaː");
    });

    test("a refused ordinal still loses its period", () => {
        // round hundreds/thousands are refused (divsimtais is 0 tokens on the wiki) — but the period is not a
        // full stop whether or not the ordinal could be composed, and returning it kept the break in the date
        expect(lv.text("1900. gadā").trim().split(/\s+/u)).not.toContain(".");
    });

    test("magnitudes are matched in their inflected forms, so no suffix is stranded", () => {
        // nominative-only left *miljardi dolāri EM* — the tier matches with no trailing boundary
        expect(lv.text("$17.37 miljardiem").trim().split(/\s+/u)).not.toContain("ˈɛm");
    });

    /**
     * ⚠ A DOTTED ABBREVIATION IS NOT A SENTENCE, AND `p.m.ē.` WAS FOUR OF THEM. The era marker — ×20 in the
     * retained text, 1,008 corpus-wide — read as *p . m . ēː .*: three letter-fragments and four clause
     * breaks inside one three-word phrase. Every fragment is a legal Latvian sound, so nothing could see it.
     */
    test("dotted abbreviations expand, and their periods stop being sentence ends", () => {
        expect(lv.text("500. gads p.m.ē.").trim()).toBe("pˈiɛt͡si sˈimti ɡˈats pˈirms mˈuːsu ˈɛːras");
        expect(lv.text("u.c.").trim()).toBe("ˈun t͡sˈiti");
        expect(lv.text("t.i., netiek").trim()).toBe("tˈas ˈir , nˈɛtiɛk");
        // a COUNTED abbreviation takes the agreement rule, and the corpus writes it with no trailing dot
        expect(lv.text("160 lpp").trim()).toBe("sˈimts sˈɛʃdɛsmit lˈappusɛs");
        expect(lv.text("nr. 859").trim()).toBe("nˈumurs ˈastuɔ̯ɲi sˈimti pˈiɛt͡sdɛsmit dˈɛviɲi");
    });

    /**
     * ⚠ BOTH FIGURES IN AN ORDINAL RANGE AGREE WITH THE ONE NOUN THAT FOLLOWS, and all 17 sites in the
     * retained text state that noun. Before this step only the SECOND was composed and the first kept its
     * period — *astoņpadsmit . divdesmitajā gadsimtā*, a false clause break inside the range.
     */
    test("an ordinal range takes both ordinals from the following noun", () => {
        expect(lv.text("18.—20. gadsimtā").trim()).toBe("ˈastuɔ̯ɲpatsmitajaː lˈiːd͡z dˈiwdɛsmitajaː ɡˈatsimtaː");
        expect(lv.text("60.—70. gados").trim()).toBe("sˈɛʃdɛsmitajuɔ̯s lˈiːd͡z sˈɛptiɲdɛsmitajuɔ̯s ɡˈaduɔ̯s");
    });

    /**
     * ⚠ A REFUSAL THE NEXT STEP CAN UNDO IS NOT A REFUSAL (trap 53). Returning the match untouched let the
     * single-ordinal step claim the SECOND figure by itself: `3100.–1550. gadam` → *3100.–tūkstoš pieci simti
     * piecdesmitajam gadam*, one half ordinalised and the other left with its period. The refusal now
     * consumes both periods and falls back to the file's standing half-measure.
     */
    test("a refused ordinal range refuses BOTH halves and still drops both periods", () => {
        // 3100 is a round hundred, which this file will not compose
        const roundHundred = lv.text("3100.–1550. gadam").trim();
        expect(roundHundred.split(/\s+/u)).not.toContain(".");
        expect(roundHundred).toContain("lˈiːd͡z");
        expect(roundHundred).not.toContain("pˈiɛt͡sdɛsmitajam"); // neither half ordinalised
        // `gs.` hides its noun's case and is deliberately NOT expanded, so this range is refused too — and
        // its own trailing period legitimately survives, because nothing in this layer claims it. What must
        // go are the two periods belonging to the RANGE: one `.` left, and it is the last token.
        const century = lv.text("10.—12. gs.").trim().split(/\s+/u);
        expect(century.filter((t) => t === ".")).toHaveLength(1);
        expect(century.at(-1)).toBe(".");
        expect(century).toContain("lˈiːd͡z");
    });
});
