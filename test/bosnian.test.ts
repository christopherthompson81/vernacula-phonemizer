import { describe, expect, test } from "vitest";

import { createBosnian } from "../src/languages/bosnian/bosnian.ts";
import { phonemizeWord } from "../src/languages/serbian/serbian.ts";

// Bosnian (bs, bosanski) — South Slavic, the third Serbo-Croatian standard (~2.5M). Bosnian, Croatian and Serbian are
// pluricentric standards of ONE phonological system: the SEGMENTAL grapheme→IPA is IDENTICAL (same 30-phoneme
// inventory + fully-phonemic orthography), so bosnian.ts reuses the Serbian engine's phonemizeWord verbatim (word
// output byte-identical to Serbian/Croatian). Bosnian is written in BOTH Gaj's Latin (predominant) and Cyrillic. The
// Bosnian-specific deltas: the retained ⟨h⟩ (lahko/kahva, where Serbian/Croatian drop it), the ijekavian reflex, and
// the number words (Serbian hiljada/milion + ijekavian dvjesta). The shared g2p is refereed by wikipron
// hbs_latn, the Serbo-Croatian MACROLANGUAGE list, which contains Bosnian words but is not Bosnian-specific;
// these adjudicated golds are what lock the Bosnian surface. Pitch accent is unwritten → deferred.
describe("Bosnian canonical IPA — shared Serbo-Croatian g2p + Bosnian deltas", () => {
    const bs = createBosnian();

    test("the retained ⟨h⟩ (=x) — Bosnian's signature, where Serbian/Croatian drop it (lako/meko)", () => {
        expect(phonemizeWord("lahko")).toBe("laxko"); // "easily" — Bosnian ⟨h⟩ retained (S/C: lako)
        expect(phonemizeWord("mehko")).toBe("mexko"); // "softly" (S/C: meko)
        expect(phonemizeWord("kahva")).toBe("kaxʋa"); // "coffee" (Turkism; S/C kafa/kava)
        expect(phonemizeWord("sahat")).toBe("saxat"); // "hour/clock" (Turkism)
    });

    test("the shared Serbo-Croatian phonemes: č=t͡ʃ, ć=t͡ɕ, đ=d͡ʑ, dž=d͡ʒ, lj=ʎ, nj=ɲ, v=ʋ", () => {
        expect(phonemizeWord("čovjek")).toBe("t͡ʃoʋjek"); // "man" — ⟨č⟩=t͡ʃ, ⟨v⟩=ʋ, ijekavian ⟨je⟩
        expect(phonemizeWord("kuća")).toBe("kut͡ɕa"); // "house" — ⟨ć⟩=t͡ɕ (alveolo-palatal)
        expect(phonemizeWord("đak")).toBe("d͡ʑak"); // "pupil" — ⟨đ⟩=d͡ʑ
        expect(phonemizeWord("džamija")).toBe("d͡ʒamija"); // "mosque" — ⟨dž⟩=d͡ʒ digraph
        expect(phonemizeWord("ljeto")).toBe("ʎeto"); // "summer" — ⟨lj⟩=ʎ, ijekavian
        expect(phonemizeWord("njiva")).toBe("ɲiʋa"); // "field" — ⟨nj⟩=ɲ
        expect(phonemizeWord("mlijeko")).toBe("mlijeko"); // "milk" — ijekavian ⟨ije⟩ (S ekavian: mleko)
    });

    test("dual script: Bosnian Cyrillic reads through the same shared engine", () => {
        expect(phonemizeWord("Босна")).toBe("bosna"); // Cyrillic "Bosnia"
        expect(phonemizeWord("Bosna")).toBe("bosna"); // Latin — byte-identical
        expect(phonemizeWord("здраво")).toBe("zdraʋo"); // Cyrillic "hello"
    });

    test("cardinal numbers: Serbian hiljada/milion lexemes + the ijekavian dvjesta", () => {
        expect(bs.text("275").trim()).toBe("dʋjesta sedamdeset pet"); // dvjesta (ijekavian, not ekavian dvesta)
        expect(bs.text("1200").trim()).toBe("xiʎadu dʋjesta"); // hiljadu (Serbian lexeme, not Croatian tisuću)
        expect(bs.text("3000000").trim()).toBe("tri miliona"); // milion (Serbian, not Croatian milijun)
    });

    // GENDER on the magnitude noun: hiljada is FEMININE, so the multiplier agrees — and Bosnian is IJEKAVIAN,
    // so the feminine of dva is dvije (as in Croatian), not the Serbian ekavian dve. milion is masculine.
    test("numbers: gender agreement on the FEMININE hiljada (ijekavian dvije)", () => {
        expect(bs.text("1000").trim()).toBe("xiʎadu"); // hiljadu — the standalone form
        expect(bs.text("2000").trim()).toBe("dʋije xiʎade"); // dvije hiljade (not *dva hiljade / *dve hiljade)
        expect(bs.text("5000").trim()).toBe("pet xiʎada"); // pet hiljada — gen.pl
        expect(bs.text("21000").trim()).toBe("dʋadeset jedna xiʎada"); // dvadeset jedna hiljada — …1 → fem sg
        expect(bs.text("1000000").trim()).toBe("jedan milion"); // masculine
        expect(bs.text("2000000").trim()).toBe("dʋa miliona"); // dva miliona — masculine keeps dva
    });

    test("clause assembly", () => {
        expect(bs.text("Dobar dan, Sarajevo!").trim()).toBe("dobar dan , sarajeʋo !");
    });
});

// Bosnian TEXT NORMALIZATION. Every test below encodes a finding measured over the 1,976 deduplicated
// utterances of FLEURS bs_ba; the count that decided each one is in the comment, and the full re-measurement
// table is in docs/investigations/bs_normalization_investigation.md.
//
// ⚠ THIS LAYER IS THE FLEET'S TRAP-55 CASE. Bosnian has TWO already-treated siblings (serbian/normalize.ts,
// croatian/normalize.ts) and 18 of their 38 arms held against Bosnian's own corpus. The tests marked
// DIVERGENCE below are the ones where copying a sibling would have shipped a confidently wrong reading.
describe("Bosnian text normalization", () => {
    const bs = createBosnian();
    const say = (s: string): string => bs.text(s).trim();

    // ── the ordinal period vs the sentence break ─────────────────────────────────────────────────────
    // `N.` is ×222, larger than every symbol class put together, and read naively it is a CARDINAL plus a
    // spurious clause boundary. The licensor list claims 197 of them; the elided-year rule claims 13.
    test("the `N.` ordinal reads as an ordinal, not a cardinal plus a phrase break", () => {
        // `u januaru 2017. godine iz brazilskog kluba` — godine ×125, the commonest licensor by far.
        expect(say("2017. godine")).toBe("dʋije xiʎade sedamnaeste ɡodine");
        // `srušen 21. jula 356. godine p.n.e.` — a day number before a month GENITIVE.
        expect(say("21. jula")).toBe("dʋadeset prʋoɡ jula");
        // `oluja 4. kategorije po Saffir-Simpsonovoj skali` — f.gen, and a follower neither sibling's
        // ORIGINAL list had; Croatian added it from its own tabulation and it recurs verbatim here.
        expect(say("oluja 4. kategorije")).toBe("oluja t͡ʃetʋrte kateɡorije");
        // `Batten je svrstan na 190. mjesto` — n.nom, so the ending is -o, not -i.
        expect(say("190. mjesto")).toBe("sto deʋedeseto mjesto");
    });

    // ⚠ DIVERGENCE — SERBIAN'S LICENSOR LIST LICENSES ZERO OF THE 14 `stoljeć-` INSTANCES, and Croatian's
    // licenses ZERO of the 39 month instances. Bosnian uses BOTH century words (stoljeće ×14 / vijek ×10)
    // and the INTERNATIONAL month set; not one Croatian month name (srpnja/rujna/kolovoza/listopada)
    // occurs anywhere in the corpus. The list that ships is neither sibling's.
    test("DIVERGENCE: both century words and the international months, which neither sibling covers", () => {
        // `dostigao je vrhunac između 10. i 11. stoljeća` — Serbian has no stoljeć- entry at all.
        expect(say("11. stoljeća")).toBe("jedanaestoɡ stoʎet͡ɕa");
        expect(say("15. stoljeću")).toBe("petnaestom stoʎet͡ɕu");
        // `skijanje datira najmanje iz 17. vijeka` — the other century word, in the same corpus.
        expect(say("17. vijeka")).toBe("sedamnaestoɡ ʋijeka");
        // `Arthur Guinness je 24. septembra 1759. godine potpisao zakup` — septembra ×7, jula ×7,
        // avgusta ×6. Croatian would license none of these.
        expect(say("24. septembra")).toBe("dʋadeset t͡ʃetʋrtoɡ septembra");
        expect(say("10. avgusta")).toBe("desetoɡ aʋɡusta"); // `Kopija je stigla u London 10. avgusta.`
    });

    // ⚠ DIVERGENCE — the ORDINAL TABLE ITSELF is one cell from each sibling. Serbian's hundreds are
    // ekavian (dvestoti) and Croatian's thousand is the wrong lexeme (tisućiti); Bosnian needs Croatian's
    // dvjestoti with Serbian's hiljaditi, which is a combination that exists in neither file.
    test("DIVERGENCE: the ordinal table is ijekavian hundreds + the hiljada lexeme", () => {
        expect(say("200. godine")).toBe("dʋjestote ɡodine"); // NOT Serbian's *dvestote
        expect(say("1000. godine")).toBe("xiʎadite ɡodine"); // NOT Croatian's *tisućite
    });

    // Croatian's step 7b, and the most valuable import of the round: 13 of the 222 `N.` instances have the
    // licensing *godine* ELIDED, so the closed list cannot see them. A year is an ordinal in the feminine
    // genitive agreeing with the unwritten noun. The period survives only where it is ALSO a sentence end.
    test("a YEAR with `godine` elided is still an ordinal — and the period's two jobs stay apart", () => {
        expect(say("Godine 1990. dodan je na spisak")).toBe("ɡodine xiʎadu deʋetsto deʋedesete dodan je na spisak");
        // `sjeverno od grada 1770. S vremena na vrijeme…` — the ONE capital follower: ordinal AND sentence end.
        expect(say("od grada 1770. S vremena")).toBe("od ɡrada xiʎadu sedamsto sedamdesete . s ʋremena");
        // `zvaničnu prijestolnicu Samoe od 1959.` — utterance-final: the pause must survive.
        expect(say("Samoe od 1959.")).toBe("samoe od xiʎadu deʋetsto pedeset deʋete .");
    });

    // The exclusions earn themselves in this corpus: of the 12 utterance-final `N.`, only ONE is a year.
    test("the year rule declines every designation and score the corpus actually ends a sentence with", () => {
        expect(say("vezane za COVID-19.")).toBe("ʋezane za t͡soʋid deʋetnaest ."); // hyphen lookbehind
        expect(say("prizemljila Il-76.")).toBe("prizemʎila il sedamdeset ʃest ."); // out of the year range
        expect(say("rezultat bio 6:6.")).toBe("rezultat bio ʃest , ʃest ."); // a SCORE, not a clock
        expect(say("dijabetesa tipa 1.")).toBe("dijabetesa tipa jedan .");
    });

    // ── the clock ────────────────────────────────────────────────────────────────────────────────────
    // ⚠ DIVERGENCE, TWICE OVER. (1) The Bosnian clock is COLON-form ×19 against DOT-form ×1, so Croatian's
    // shape ports and Serbian's does not — and Serbian's rule GATES on a written `sati|časova`, while the
    // single dot-written clock here is `izvještaj u 12.00 GMT`, so Serbian's rule would fire ZERO times.
    // (2) 10 of the 19 clocks are FOLLOWED by a written `sati`/`časova`, which NEITHER sibling consumes —
    // Croatian consumes an optional `h`, which is ×0 in Bosnian.
    test("DIVERGENCE: the colon clock, and the written hour noun is consumed so it is not said twice", () => {
        // `Umjereni zemljotres potresao je zapadnu Montanu u ponedjeljak u 22:08 sati.`
        expect(say("u 22:08 sati.")).toBe("u dʋadeset dʋa sata i osam minuta .");
        // `Demonstranti su odmah posle 11:00 časova blokirali saobraćaj` — the other hour noun, ×1.
        expect(say("posle 11:00 časova blokirali")).toBe("posle jedanaest sati blokirali");
        // `Program je počeo u 20:30 sati po lokalnom vremenu (15:00 UTC).` — one clock with the noun and
        // one without, in the same sentence.
        expect(say("u 20:30 sati po lokalnom vremenu (15:00 UTC)"))
            .toBe("u dʋadeset sati i trideset minuta po lokalnom ʋremenu petnaest sati utt͡s");
    });

    test("the hour guard keeps the corpus's football score out of the clock rule", () => {
        // `ostvarila ugodnu pobjedu od 26:00 protiv petoplasirane Zambije` — the ilo trap in miniature:
        // 26 is not an hour, so this must NOT read as a time.
        expect(say("pobjedu od 26:00 protiv")).toBe("pobjedu od dʋadeset ʃest , nula protiʋ");
    });

    // ── separators and spans ─────────────────────────────────────────────────────────────────────────
    test("the grouping period is removed before it can become a clause break", () => {
        // `Glavna rijeka Amazon je dugačka 6.387 km (3.980 milja).` — ×47, and the largest silent defect
        // in the language: DROP never sees it, because nothing is dropped — the number is TORN IN HALF.
        expect(say("dugačka 6.387 km")).toBe("duɡat͡ʃka ʃest xiʎada trista osamdeset sedam kilometara");
        // `Standardni 802.11n radi i na frekvenciji od 2,4 GHz` — the exactly-three-digit guard is what
        // keeps the Wi-Fi standard whole, and it is in this corpus.
        expect(say("Standardni 802.11n")).toContain("osamsto dʋa");
    });

    test("a numeric span reads with `do` instead of fusing its endpoints", () => {
        // `Unutrašnjost Antarktika je … ledom dubokim 2-3 km.`
        expect(say("dubokim 2-3 km")).toBe("dubokim dʋa do tri kilometra");
        // `Između 10:00 - 11:00 sati uveče` — ORDERING: the clock rule must run BEFORE the range rule, or
        // the range eats the clock's own digits.
        expect(say("Između 10:00 - 11:00 sati uveče"))
            .toBe("izmed͡ʑu deset sati do jedanaest sati uʋet͡ʃe");
    });

    test("the hyphen + case suffix resolves through the ordinal paradigm, not by concatenation", () => {
        // `normalizacija odnosa između SAD-a i Kine krajem 1970-ih` — ×13, all decades.
        expect(say("krajem 1970-ih")).toBe("krajem xiʎadu deʋetsto sedamdesetix");
        // ⚠ Serbian's trailing guard, not Croatian's: Croatian declines when ANY character follows, and
        // the corpus writes `krajem 1970-ih;` and `1850-ih i predstavlja`.
        expect(say("krajem 1970-ih; iranska")).toBe("krajem xiʎadu deʋetsto sedamdesetix , iranska");
    });

    // ── signs and units ──────────────────────────────────────────────────────────────────────────────
    test("units are read as words rather than leaking or being read as Bosnian words", () => {
        expect(say("3,50 m")).toBe("tri zarez pedeset metra"); // decimal comma ×16, and `m` was raw
        // ⚠ `cm` was read as a WORD by the g2p (c→/t͡s/), which is trap 56: no counter sees it.
        expect(say("6x6 cm")).toBe("ʃest sa ʃest t͡sentimetara");
        // ⚠ and `kg` likewise — `(90kg)` read as *kɡ*, not leaked.
        expect(say("teži 200 funti (90kg)")).toBe("teʒi dʋjesta funti deʋedeset kiloɡrama");
        // `Park se prostire na 19.500 km²` — grouping dot AND the exponent, in one figure.
        expect(say("na 19.500 km²")).toBe("na deʋetnaest xiʎada petsto kʋadratnix kilometara");
    });

    // ⚠ DIVERGENCE — `by` is `sa`, which neither sibling declares. Both declare only `times` (*puta*) and
    // let `by` default to it; the Bosnian corpus writes the dimension out longhand in the SAME sentences
    // that write it with an `x` — `36 mm širine SA 24 mm visine`, `(29¾ inča SA 24½ inča)`.
    test("DIVERGENCE: a dimension is `sa`, a product is `puta`", () => {
        expect(say("negativ od 56x56 mm")).toBe("neɡatiʋ od pedeset ʃest sa pedeset ʃest milimetara");
        expect(say("6 × 6")).toBe("ʃest puta ʃest");
    });

    test("the rate prepositions are two different words, and the corpus says both of them", () => {
        // `vjetrovi brzine do 480 km/h` — "na sat", attested as `(3000 milja na sat)`.
        expect(say("do 480 km/h")).toBe("do t͡ʃetiristo osamdeset kilometara na sat");
        // `600Mbit/s` — "u sekundi", attested as `brzinom od 1,5 kilometara u sekundi`. One `unitPer`
        // cannot carry both, which is why `/s` is composed locally.
        expect(say("od 600Mbit/s")).toBe("od ʃeststo meɡabita u sekundi");
    });

    // ⚠ DIVERGENCE — BOSNIAN WEST IS `Z` (zapad). Croatian's degree rule allow-lists `[NSEWnsew]`, which
    // matches NOTHING here: the corpus's one bare degree is `uragan zabilježen istočno od 35°Z`. This is
    // the an→ast `°U` finding one language over — a ported letter that the language does not use.
    test("DIVERGENCE: the compass letter after a degree sign is Z, not W", () => {
        expect(say("istočno od 35°Z")).toBe("istot͡ʃno od trideset pet stepeni zapadno");
        // `temperature iznad + 30 °C su uobičajene` — the C/F arm, and the spaced positive `+`.
        expect(say("iznad + 30 °C su")).toBe("iznad plus trideset stepeni t͡selzijusa su");
    });

    test("the signs the corpus actually has are read; the five it has none of are refused", () => {
        // `iranska ekonomija ostvaruje 80% svojih deviznih prihoda` — ×4, and `posto` is the corpus's own
        // word for the sign (`29 posto anketiranih`, `46 posto glasova`).
        expect(say("ostvaruje 80% svojih")).toBe("ostʋaruje osamdeset posto sʋojix");
        expect(say("naknadu od 30 $")).toBe("naknadu od trideset dolara"); // POSTPOSED, ×3
        // `Uopšteno, B&amp;B se očigledno takmiči` — the corpus's one ampersand is the HTML ENTITY.
        expect(say("Uopšteno, B&amp;B se")).toBe("uopʃteno , b i b se");
        // `(29¾ inča sa 24½ inča)` — both vulgar fractions were dropped, so the parchment measured a
        // whole number of inches. ⚠ `i po`, not Croatian's `i pol`.
        expect(say("29¾ inča sa 24½ inča")).toBe("dʋadeset deʋet i tri t͡ʃetʋrtine int͡ʃa sa dʋadeset t͡ʃetiri i po int͡ʃa");
    });

    // ── abbreviations, initials and one acronym ──────────────────────────────────────────────────────
    // ⚠ DIVERGENCE — CROATIAN'S `Dr.` RULE IS CASE-INSENSITIVE (`giu`), and Bosnian's corpus has
    // `(James i dr. 1995)`, the academic *et al.* A ported rule reads that as *doktor hiljadu devetsto
    // devedeset pet*. One flag is the whole fix.
    test("DIVERGENCE: `Dr.` is a doctor and lowercase `dr.` is `et al.`", () => {
        expect(say("Dr. Moll misli")).toBe("doktor moll misli");
        expect(say("James i dr. 1995")).toBe("james i dr . xiʎadu deʋetsto deʋedeset pet");
    });

    test("dotted abbreviations lose the dot mid-sentence and KEEP it at a sentence end", () => {
        expect(say("npr. u Nizozemskoj")).toBe("naprimjer u nizozemskoj"); // naprimjer ×8 in the corpus
        expect(say("tj. 0 ili 1")).toBe("to jest nula ili jedan");
        expect(say("1989. godine, str. 109")).toBe("xiʎadu deʋetsto osamdeset deʋete ɡodine , strana sto deʋet");
        // ⚠ THE CASE TEST MUST RUN IN THE CALLBACK: `\p{Ll}` under an `i` flag matches uppercase too, and
        // the corpus has `…, itd. Za sva mjesta izvan Afrike.` — Serbian's arm loses that boundary.
        expect(say("kopnom, itd. Za sva mjesta")).toBe("kopnom , i tako daʎe . za sʋa mjesta");
        // `…pripovijedanje priča itd.)` — a closing bracket is NOT a pause, so the dot must be kept.
        expect(say("priča itd.)")).toBe("prit͡ʃa i tako daʎe .");
    });

    test("the era marker, whose expansion this corpus spells out in other utterances", () => {
        // `Hram Artemide u Efezu je srušen 21. jula 356. godine p.n.e. u požaru` — and elsewhere the same
        // corpus writes `izgrađen 323. godine prije nove ere`, which is the sourcing.
        expect(say("356. godine p.n.e. u požaru")).toBe("trista pedeset ʃeste ɡodine prije noʋe ere u poʒaru");
    });

    // ⚠ trap 56, and the reason it is claimed at all: `SAD-a` split on the hyphen and the g2p read `SAD`
    // as the ordinary Bosnian ADVERB *sad* ("now"). `trupe SAD-a napustiti Siriju` came out as a plausible
    // sentence with the wrong word in it, and no counter sees that. ×10, all genitive.
    test("`SAD-a` is the USA in the genitive, not the adverb `sad`", () => {
        expect(say("trupe SAD-a napustiti")).toBe("trupe sjediɲenix amerit͡ʃkix drʒaʋa napustiti");
        // Bare `SAD` is REFUSED — its instances are locative, accusative and a bare apposition, and one
        // expansion cannot serve three cases (Serbian's `Св.` refusal). It must stay untouched.
        expect(say("u SAD živi")).toBe("u sad ʒiʋi");
    });

    test("ordinary prose is untouched", () => {
        expect(say("Dobar dan, Sarajevo!")).toBe("dobar dan , sarajeʋo !");
    });
});
