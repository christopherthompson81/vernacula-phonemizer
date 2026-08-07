import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { getPhonemizer } from "../src/registry.ts";
import { COUNTED, createSlovenian, phonemizeWord, slCountForm } from "../src/languages/slovenian/slovenian.ts";
import { MANIFEST } from "../src/languages/slovenian/manifest.ts";
import { inflect, normalizeSlovenian, ordinalBase, ordinalWords } from "../src/languages/slovenian/normalize.ts";

// Slovenian (sl, slovenščina) — South Slavic (~2.5M), its OWN engine (not the BCS shared g2p). Slovak-shaped scan →
// syllabic-liquid → voicing pipeline. Slovene orthography is shallow at the consonant level but UNDERSPECIFIES the
// vowels (quality/length/pitch/schwa are all unwritten) → the vowel axis is folded in the referee eval; these golds
// lock the CONSONANT skeleton + the Slovene rules: ⟨lj/nj⟩ coda-j-drop, syllabic-r→ər, voicing/devoicing, ⟨v⟩→ʋ. NO
// stress mark is emitted (Slovene stress is free/lexical + unwritten → deferred). 94.1% folded / 98.7% symbol accuracy
// vs wikipron slv_latn_broad (5,177 headwords).
describe("Slovenian canonical IPA — Slovak-shaped South Slavic engine + Slovene rules", () => {
    const sl = createSlovenian();

    test("⟨lj⟩/⟨nj⟩ → l+j / n+j before a vowel; the j DROPS in coda/final", () => {
        expect(phonemizeWord("polje")).toBe("pɔljɛ"); // "field" — prevocalic lj
        expect(phonemizeWord("banja")).toBe("banja"); // prevocalic nj
        expect(phonemizeWord("kralj")).toBe("kral"); // "king" — final lj → l (j drops)
        expect(phonemizeWord("konj")).toBe("kɔn"); // "horse" — final nj → n
        expect(phonemizeWord("Ljubljana")).toBe("ljubljana"); // both lj prevocalic (not syllabic)
    });

    test("syllabic ⟨r⟩ → ər (schwa before r)", () => {
        expect(phonemizeWord("prst")).toBe("pərst"); // "finger" — syllabic r
        expect(phonemizeWord("vrt")).toBe("ʋərt"); // "garden" — ⟨v⟩→ʋ + syllabic r
    });

    test("final devoicing + regressive voicing assimilation; ⟨h⟩=[x] is voicing-neutral", () => {
        expect(phonemizeWord("grad")).toBe("ɡrat"); // final d → t
        expect(phonemizeWord("glasba")).toBe("ɡlazba"); // s → z before b (regressive voicing)
        expect(phonemizeWord("Abhazija")).toBe("abxazija"); // b stays b before ⟨h⟩=[x] (x does not trigger)
    });

    test("consonants: ⟨č⟩=t͡ʃ, ⟨v⟩=ʋ, ⟨h⟩=x, ⟨o/e⟩ open-mid default", () => {
        expect(phonemizeWord("človek")).toBe("t͡ʃlɔʋɛk"); // "person"
        expect(phonemizeWord("voda")).toBe("ʋɔda"); // "water"
        expect(phonemizeWord("dober")).toBe("dɔbɛr"); // "good" — the -er schwa is emitted ɛ (folded)
    });

    test("⟨ć/đ⟩ Serbo-Croatian loans → t͡ʃ/d͡ʒ (not silently dropped); ⟨y⟩→i", () => {
        expect(phonemizeWord("Đorđe")).toBe("d͡ʒɔrd͡ʒɛ"); // đ → d͡ʒ
        expect(phonemizeWord("ćevapi")).toBe("t͡ʃɛʋapi"); // ć → t͡ʃ
    });

    test("cardinal numbers: unit-IN-ten inversion (21=enaindvajset) + GENDERED agreement (dva/trije milijoni, dve milijardi)", () => {
        expect(sl.text("21").trim()).toBe("ɛnaindʋajsɛt"); // ena + in + dvajset (one-and-twenty)
        expect(sl.text("35").trim()).toBe("pɛtintridɛsɛt"); // pet + in + trideset
        expect(sl.text("234").trim()).toBe("dʋɛstɔ ʃtiriintridɛsɛt"); // dvesto štiriintrideset
        expect(sl.text("2000000").trim()).toBe("dʋa milijɔna"); // masc dual: dva milijona
        expect(sl.text("3000000").trim()).toBe("trijɛ milijɔni"); // masc paucal numeral: trije (not tri)
        expect(sl.text("2000000000").trim()).toBe("dʋɛ milijardi"); // fem dual: DVE milijardi (milijarda is feminine)
    });

    test("clause assembly", () => {
        expect(sl.text("Dober dan, Slovenija!").trim()).toBe("dɔbɛr dan , slɔʋɛnija !");
    });
});

// TEXT NORMALIZATION. These pin the RULE'S BRANCHES, not the corpus's instances (trap 13 (pin the rule's BRANCHES)): the ordinal
// table, the tens+units composition and the boundary between them; both count-form paths; the licensor list
// AND the ending fallback; and the discriminator that decides an ordinal period from a sentence period.
// Corpus counts are in src/languages/slovenian/normalize.ts and.
describe("Slovenian — ordinals: the table, the composition, and the boundary between them", () => {
    test("the TABLE branch, 1–19, and its two irregular stems", () => {
        expect(ordinalBase(1)).toBe("prvi");
        expect(ordinalBase(3)).toBe("tretji"); // the only PALATAL stem in 1–999
        expect(ordinalBase(7)).toBe("sedmi"); // sedem → sedmi: the stem vowel syncopates
        expect(ordinalBase(8)).toBe("osmi"); // osem → osmi, likewise
        expect(ordinalBase(19)).toBe("devetnajsti");
    });

    test("the COMPOSITION branch — the corpus never writes most of these", () => {
        expect(ordinalBase(20)).toBe("dvajseti"); // round ten
        expect(ordinalBase(21)).toBe("enaindvajseti"); // unit-IN-ten, ONE word, suffix on the TEN
        expect(ordinalBase(47)).toBe("sedeminštirideseti");
        expect(ordinalBase(100)).toBe("stoti"); // suppletive, NOT *stoi
        expect(ordinalBase(190)).toBe("sto devetdeseti"); // hundreds prefix stays a plain cardinal
        expect(ordinalBase(247)).toBe("dvesto sedeminštirideseti");
        expect(ordinalBase(1000)).toBe("tisoči");
        expect(ordinalBase(1830)).toBe("tisoč osemsto trideseti");
        expect(ordinalBase(2000)).toBe("dva tisoči"); // the exact-thousand branch above 1000
        expect(ordinalBase(0)).toBeUndefined();
        expect(ordinalBase(1_000_000)).toBeUndefined();
    });

    test("INFLECTION: every slot the licensors need, on a hard stem and on the palatal one", () => {
        // hard stem (drugi) — the -o neuter nominative
        expect(inflect("drugi", "m.gen")).toBe("drugega");
        expect(inflect("drugi", "m.instr")).toBe("drugim");
        expect(inflect("drugi", "n.nom")).toBe("drugo");
        expect(inflect("drugi", "n.loc")).toBe("drugem");
        expect(inflect("drugi", "f.acc")).toBe("drugo");
        expect(inflect("drugi", "pl.gen")).toBe("drugih");
        // PALATAL stem (tretji, tisoči) — n.nom takes -e, but f.acc keeps -o
        expect(inflect("tretji", "n.nom")).toBe("tretje");
        expect(inflect("tretji", "f.acc")).toBe("tretjo");
        expect(inflect("tretji", "m.gen")).toBe("tretjega");
        expect(inflect("tisoči", "f.nom")).toBe("tisoča");
        // only the LAST word inflects in a multi-word composition
        expect(ordinalWords(190, "n.nom")).toBe("sto devetdeseto");
        expect(ordinalWords(1830, "pl.gen")).toBe("tisoč osemsto tridesetih");
    });
});

describe("Slovenian — the ordinal period vs the sentence period", () => {
    test("a LOWERCASE follower is an ordinal; the licensor gives the case", () => {
        expect(normalizeSlovenian("V 16. stoletju")).toBe("V šestnajstem stoletju");
        expect(normalizeSlovenian("19. stoletja")).toBe("devetnajstega stoletja");
        expect(normalizeSlovenian("17. stoletje, leta 1861")).toBe("sedemnajsto stoletje, leta 1861");
        expect(normalizeSlovenian("9. julija")).toBe("devetega julija");
        expect(normalizeSlovenian("V 80. letih 20. stoletja")).toBe("V osemdesetih letih dvajsetega stoletja");
        expect(normalizeSlovenian("na 190. mesto")).toBe("na sto devetdeseto mesto");
        expect(normalizeSlovenian("nevihte 4. kategorije")).toBe("nevihte četrte kategorije");
        expect(normalizeSlovenian("s 247. členom")).toBe("s dvesto sedeminštiridesetim členom");
        expect(normalizeSlovenian("Malo po 11. uri")).toBe("Malo po enajsti uri");
    });

    test("ZERO utterance-final sentence pauses are lost — the invariant, 26 corpus instances", () => {
        // an END-of-utterance period is a SENTENCE period, whatever the number is
        expect(normalizeSlovenian("veliko nagrado Madžarske leta 2009.")).toBe("veliko nagrado Madžarske leta 2009.");
        expect(normalizeSlovenian("prezasedenosti, 1300.")).toBe("prezasedenosti, 1300.");
        expect(normalizeSlovenian("leta 2020 aktivnih 16.")).toBe("leta 2020 aktivnih 16.");
        // …and so is one before a CAPITALISED word (1770 is the Queensland town, not an ordinal)
        expect(normalizeSlovenian("severno od 1770. Občasno jih je")).toBe("severno od 1770. Občasno jih je");
        expect(normalizeSlovenian("5. septembrom 2021. Nekaj prireditev"))
            .toBe("petim septembrom 2021. Nekaj prireditev");
        // the regnal rule's own dot is restored where it was the sentence end
        expect(normalizeSlovenian("poglavarja Tupue Tamaseseja Lealofija 3."))
            .toBe("poglavarja Tupue Tamaseseja Lealofija tretjega.");
    });

    test("the LIST prefix: every item takes the HEAD noun's case, and its comma survives", () => {
        expect(normalizeSlovenian("v 11., 12. in 13. stoletju"))
            .toBe("v enajstem, dvanajstem in trinajstem stoletju");
        expect(normalizeSlovenian("v 1. in 2. svetovni vojni.")).toBe("v prvi in drugi svetovni vojni.");
        expect(normalizeSlovenian("Med 22. in 23. uro")).toBe("Med dvaindvajseto in triindvajseto uro");
    });

    test("the ENDING fallback and the m.nom default — the branch the licensor list never reaches", () => {
        expect(normalizeSlovenian("njegov 60. v sezoni")).toBe("njegov šestdeseti v sezoni"); // default m.nom
        expect(normalizeSlovenian("10. italijanske vojske")).toBe("desete italijanske vojske"); // interpolated adj
        expect(normalizeSlovenian("s 5. največjega")).toBe("s petega največjega"); // -ega → m.gen
        expect(normalizeSlovenian("v 5. največjih")).toBe("v petih največjih"); // -ih → pl.gen
    });

    test("REGNAL: gender and case come from the TITLE, never from the name's ending", () => {
        // `II`/`III` are already digits here — core/roman.ts runs in registry.ts, before this engine
        expect(normalizeSlovenian("kraljica Elizabeta 2 zadnja")).toBe("kraljica Elizabeta druga zadnja");
        expect(normalizeSlovenian("kraljice Elizabete 2 postati")).toBe("kraljice Elizabete druge postati");
        expect(normalizeSlovenian("kralja Sejonga 4. je")).toBe("kralja Sejonga četrtega je");
        // no title ⇒ no claim: `Standard 802` and a page number must stay cardinals
        expect(normalizeSlovenian("Kar 20 odstotkov vode")).toBe("Kar 20 odstotkov vode");
    });
});

describe("Slovenian — the four-way DUAL count agreement", () => {
    test("the tier's literal arrays match COUNTED — the two copies must not drift", () => {
        // The tier declares its percent/currency words as LITERALS so review.ts's sourcing check can read
        // them; COUNTED is what the gender repair and the local degree rule read. Same words, or a bug.
        const src = readFileSync("src/languages/slovenian/slovenian.ts", "utf8");
        for (const key of ["pct", "usd", "eur", "gbp", "jpy"] as const)
            expect(src).toContain(COUNTED[key]!.forms.map((w) => `"${w}"`).join(", "));
        expect(MANIFEST.numbers.decimalWord).toBe("vejica");
    });

    test("slCountForm is four-way + a decimal slot, and is NOT the Slavic final-digit rule", () => {
        expect([1, 2, 3, 4, 5, 21, 22, 25, 12, 101].map(slCountForm)).toEqual([0, 1, 2, 2, 3, 3, 3, 3, 3, 3]);
        expect(slCountForm(2.5)).toBe(4); // a decimal governs the genitive SINGULAR
    });

    test("percent takes all four forms + the decimal one", () => {
        expect(normalizeSlovenian("1 %")).toBe("en odstotek"); // sg, and the numeral's gender repaired
        expect(normalizeSlovenian("2 %")).toBe("2 odstotka"); // DUAL — where slavicCountForm would say paucal
        expect(normalizeSlovenian("obsega 3 % države")).toBe("obsega trije odstotki države"); // paucal + trije
        expect(normalizeSlovenian("ima 93 % prebivalstva")).toBe("ima 93 odstotkov prebivalstva"); // gen.pl
        expect(normalizeSlovenian("22 %")).toBe("22 odstotkov"); // a compound: gen.pl, never the singular
        expect(normalizeSlovenian("2,5 %")).toBe("2 vejica 5 odstotka"); // gen.sg
    });

    test("the numeral's GENDER, which cannot be applied to digits by the tokenizer", () => {
        expect(normalizeSlovenian("1 km")).toBe("en kilometer"); // *ena kilometer is ungrammatical
        expect(normalizeSlovenian("4 km")).toBe("štirje kilometri"); // masculine paucal numeral
        expect(normalizeSlovenian("2 mph")).toBe("dve milji na uro"); // FEMININE dual: dve, not dva
        expect(normalizeSlovenian("3 mph")).toBe("3 milje na uro"); // feminine paucal is already `tri`
        // …but NOT the second operand of a range, where the phrase is headed by the range
        expect(normalizeSlovenian("prekriva 2–3 km ledu")).toBe("prekriva 2 do 3 kilometri ledu");
    });
});

describe("Slovenian — grouping, decimals, clocks, ranges, units", () => {
    test("PERIOD-grouped thousands are de-grouped FIRST; the COMMA decimal becomes a word", () => {
        expect(normalizeSlovenian("Park pokriva 19.500 km²")).toBe("Park pokriva 19500 kvadratnih kilometrov");
        expect(normalizeSlovenian("5.000.000 posameznikov")).toBe("5000000 posameznikov"); // two passes
        expect(normalizeSlovenian("magnitude 6,5.")).toBe("magnitude 6 vejica 5.");
        expect(normalizeSlovenian("2,4 GHz")).toBe("2 vejica 4 gigaherca"); // gen.sg after a decimal
    });

    test("the clock: an ORDINAL hour + *ura* in the case the PREPOSITION governs", () => {
        expect(normalizeSlovenian("so ob 23.35 naposled")).toBe("so ob triindvajseti uri petintrideset naposled");
        expect(normalizeSlovenian("začele ob 10.00 z")).toBe("začele ob deseti uri z"); // minute 00 elided
        expect(normalizeSlovenian("okoli 9.30 ure po")).toBe("okoli devete ure trideset po"); // *ure* consumed
        expect(normalizeSlovenian("pa od 6.30 do 7.30.")).toBe("pa od šeste ure trideset do sedme ure trideset.");
        expect(normalizeSlovenian("ob 07:19 po")).toBe("ob sedmi uri devetnajst po"); // the COLON form
        expect(normalizeSlovenian("(15.00 po UTC)")).toBe("(petnajsta ura po u te ce)"); // ungoverned ⇒ f.nom
        // NOT a clock: a score with hours > 23, and a ratio whose second field is one digit — both fall
        // through to the SCORE rule (step 5a) rather than being claimed as times
        expect(normalizeSlovenian("zmagala 26:00 proti")).toBe("zmagala 26 00 proti");
        expect(normalizeSlovenian("je torej 3:2 razmerje")).toBe("je torej 3 proti 2 razmerje");
    });

    test("ranges read *do*; EQUAL endpoints are a score, not a range", () => {
        expect(normalizeSlovenian("vojni (1894–1895) podpisala")).toBe("vojni (1894 do 1895) podpisala");
        expect(normalizeSlovenian("izpred 4,2–3,9 milijona")).toBe("izpred 4 vejica 2 do 3 vejica 9 milijona");
        expect(normalizeSlovenian("prekriva 2–3 km ledu")).toBe("prekriva 2 do 3 kilometri ledu");
        expect(normalizeSlovenian("COVID-19.")).toBe("COVID-19."); // digits on one side only
    });

    test("SCORES and RATIOS take *proti*, and are told from a range by DIRECTION", () => {
        // a pair that does not ASCEND is not a range; the corpus writes the joiner out as *proti* twice
        expect(normalizeSlovenian("po rezultatu 6-6 tudi")).toBe("po rezultatu 6 proti 6 tudi");
        expect(normalizeSlovenian("proti Kanadčanu je 7–2.")).toBe("proti Kanadčanu je 7 proti 2.");
        expect(normalizeSlovenian("je torej 3:2.")).toBe("je torej 3 proti 2."); // a colon is never a range
        // …but a DESCENDING pair with a decimal is a real range ("4.2 to 3.9 million years AGO")
        expect(normalizeSlovenian("izpred 4,2–3,9 milijona")).toBe("izpred 4 vejica 2 do 3 vejica 9 milijona");
        // and the joiner is dropped, not doubled, when the sentence already writes it (trap 12 (a REDUNDANT symbol is a permissible drop))
        expect(normalizeSlovenian("zmagala 26:00 proti peti")).toBe("zmagala 26 00 proti peti");
        // NOT a score: a spaced 3-digit field is a PAGE CITATION, and a 4+2-digit pair is a SEASON — both
        // misfired in the first version of this rule and were caught only by the corpus diff
        expect(normalizeSlovenian("(LaFasto, 1989: 109).")).toBe("(LaFasto, 1989: 109).");
        expect(normalizeSlovenian("od leta 1995–96, ko")).toBe("od leta 1995–96, ko");
    });

    test("units, rates and exponents, incl. the two the tier could not see", () => {
        expect(normalizeSlovenian("dosegal 70 km/h")).toBe("dosegal 70 kilometrov na uro");
        expect(normalizeSlovenian("(133 m/s; 300 mph)")).toBe("(133 metrov na sekundo; 300 milj na uro)");
        expect(normalizeSlovenian("600 Mbit/s.")).toBe("600 megabitov na sekundo.");
        expect(normalizeSlovenian("3136 mm2 proti")).toBe("3136 kvadratnih milimetrov proti");
        expect(normalizeSlovenian("2,2 milijona km2")).toBe("2 vejica 2 milijona kvadratnih kilometrov");
        expect(normalizeSlovenian("od 35-mm negativa")).toBe("od 35 milimetrov negativa"); // hyphen folded
        expect(normalizeSlovenian("pogosto 100–200 milj/uro")).toBe("pogosto 100 do 200 milj na uro");
        expect(normalizeSlovenian("120–160 kubičnih metrov")).toBe("120 do 160 kubičnih metrov");
    });
});

describe("Slovenian — abbreviations, signs, fractions, initialisms", () => {
    test("era markers, whose interior dots were three phrase breaks", () => {
        expect(normalizeSlovenian("leta 323 pr. n. š. obnovili.")).toBe("leta 323 pred našim štetjem obnovili.");
        expect(normalizeSlovenian("do 1100 n. š.")).toBe("do 1100 našega štetja."); // sentence period restored
        expect(normalizeSlovenian("leto 5000 pr. n. št.!")).toBe("leto 5000 pred našim štetjem!"); // no double mark
    });

    test("dotted abbreviations; `ga.` is expanded ONLY before a capital", () => {
        expect(normalizeSlovenian("restavracije itd.")).toBe("restavracije in tako dalje.");
        expect(normalizeSlovenian("jedi idr., ki se")).toBe("jedi in drugo, ki se"); // the comma keeps the pause
        expect(normalizeSlovenian("(npr. vizo)")).toBe("(na primer vizo)");
        expect(normalizeSlovenian("kozmonavt št. 11")).toBe("kozmonavt številka 11");
        expect(normalizeSlovenian("Ga. Kirchner je")).toBe("gospa Kirchner je");
        expect(normalizeSlovenian("meni dr. Moll, in")).toBe("meni doktor Moll, in");
        // …and NOT the pronoun *ga*, which ends 23 of the 24 corpus sentences containing that string
        expect(normalizeSlovenian("zato ga nisem zares poslušal ga.")).toBe("zato ga nisem zares poslušal ga.");
    });

    test("degrees, signs, the ampersand and the fractions", () => {
        expect(normalizeSlovenian("presežejo +30 °C.")).toBe("presežejo plus 30 stopinj Celzija.");
        expect(normalizeSlovenian("poldnevnika 35° zahodne")).toBe("poldnevnika 35 stopinj zahodne");
        expect(normalizeSlovenian("negativ 36 x 24 mm")).toBe("negativ 36 krat 24 milimetrov");
        expect(normalizeSlovenian("B&B-ji na")).toBe("be in be-ji na"); // lone capitals SPELLED, then joined
        expect(normalizeSlovenian("meri 29 3/4 palca")).toBe("meri 29 in tri četrtine palca"); // mixed number
        expect(normalizeSlovenian("krat 24 1/2 palca")).toBe("krat 24 in pol palca"); // a half is *pol*
        expect(normalizeSlovenian("(1/5 palca)")).toBe("(ena petina palca)"); // the bare-ratio branch
        expect(normalizeSlovenian("(2/3 palca)")).toBe("(dve tretjini palca)"); // composed, not tabulated
        expect(normalizeSlovenian("v 1830-ih.")).toBe("v tisoč osemsto tridesetih."); // decade suffix
        expect(normalizeSlovenian("ob 5-ih (ET)")).toBe("ob petih (e te)"); // the SAME suffix, a cardinal
    });

    test("initialisms via core/initialisms.ts: letters, listed exceptions, and words left alone", () => {
        // no vowel or an illegal cluster ⇒ spelled by the shared OOV test
        expect(normalizeSlovenian("BDP in DVD in GMT")).toBe("be de pe in de ve de in ge me te");
        expect(normalizeSlovenian("naprave DSLR so")).toBe("naprave de se le re so");
        // readable but conventionally spelled ⇒ the manifest's acronymLetters
        expect(normalizeSlovenian("Predsednik ZDA je")).toBe("Predsednik ze de a je");
        expect(normalizeSlovenian("področju MRI je")).toBe("področju me re i je");
        // readable AND read as a word ⇒ left to the g2p
        expect(normalizeSlovenian("virus COVID in UNESCO in OPEC so")).toBe("virus COVID in UNESCO in OPEC so");
        // the lone Slovene word `V` (in) is never a letter or a numeral
        expect(normalizeSlovenian("V renesansi so")).toBe("V renesansi so");
        // personal initials, from the same seam
        expect(normalizeSlovenian("George W. Bush je")).toBe("George dvojni ve Bush je");
        expect(normalizeSlovenian("inšpektorja D. K. Arya je")).toBe("inšpektorja de ke Arya je");
    });
});

describe("Slovenian — end-to-end through the real phonemizer", () => {
    const sl = getPhonemizer("sl")!;

    test("ROMAN numerals reach normalize.ts as DIGITS — the registry ordering, pinned on a vowel-less one", () => {
        // core/roman.ts runs in registry.ts wrapping engine.text(), so `XV` is already 15 by the time the
        // initialism pass could have spelled it EX-VE. Deliberately NOT the `II` the corpus happens to have.
        expect(sl.text("V XV. stoletju").trim()).toBe("ʋ pɛtnajstɛm stɔlɛtju");
        expect(sl.text("med II. svetovno vojno").trim()).toBe("mɛt druɡɔ sʋɛtɔʋnɔ ʋɔjnɔ");
    });

    test("the readings the layer exists to fix, as IPA", () => {
        expect(sl.text("Park pokriva 19.500 km².").trim())
            .toBe("park pɔkriʋa dɛʋɛtnajst tisɔt͡ʃ pɛtstɔ kʋadratnix kilɔmɛtrɔʋ .");
        expect(sl.text("ima 93 % prebivalstva").trim()).toBe("ima triindɛʋɛddɛsɛt ɔtstɔtkɔʋ prɛbiʋalstʋa");
        expect(sl.text("ob 23.35").trim()).toBe("ɔp triindʋajsɛti uri pɛtintridɛsɛt");
        // the sentence pause a year-ordinal rule would have destroyed, 26 times over
        expect(sl.text("do leta 1945.").trim()).toBe("dɔ lɛta tisɔt͡ʃ dɛʋɛtstɔ pɛtinʃtiridɛsɛt .");
    });

    // A FOUR-DIGIT MILITARY TIME licensed by a zone label. Deferred in the PR as a core seam, because the
    // tokenizer's `\d+` → `Number()` loses the leading zero (`Number("0230")` is 230, read *dvesto
    // trideset*). True of the tokenizer, and beside the point: the layer never has to let the digits reach
    // it. The ZONE LABEL is the whole licence — this corpus writes 116 four-digit YEARS.
    test("a 4-digit military time is a clock, and a year is not", () => {
        expect(normalizeSlovenian("(0230 UTC)")).toBe("(druga ura trideset u te ce)");
        expect(normalizeSlovenian("ob 0230 UTC v sredo")).toBe("ob drugi uri trideset u te ce v sredo");
        expect(normalizeSlovenian("(1500 po UTC)")).toBe("(petnajsta ura po u te ce)");
        // …and every neighbour that must NOT be claimed.
        expect(normalizeSlovenian("leta 1230 je bilo")).toBe("leta 1230 je bilo");
        expect(normalizeSlovenian("leta 2010 in 1995")).toBe("leta 2010 in 1995");
        expect(normalizeSlovenian("ob 0230 v sredo")).toBe("ob 0230 v sredo"); // no zone label
    });

    // The ×14 hyphen compounds (`21-letni`, `24-urne`, `100-metrska`, `8-krat`) are deferred on the claim
    // that this engine emits no stress, so splitting the compound is phonemically identical. VERIFIED here
    // rather than asserted, because if any word-boundary phonology existed the claim would be false.
    test("splitting a hyphen compound is phonemically identical (why ×14 is deferred)", () => {
        const same = (a: string, b: string): void => {
            const p = getPhonemizer("sl");
            expect(p.text(a).replace(/\s+/gu, "")).toBe(p.text(b).replace(/\s+/gu, ""));
        };
        same("21-letni", "enaindvajsetletni");
        same("24-urne", "štiriindvajseturne");
        same("100-metrska", "stometrska");
        same("8-krat", "osemkrat");
    });
});
