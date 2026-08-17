import { describe, expect, test } from "vitest";

import { phonemizeWord, createKamba } from "../src/languages/kamba/kamba.ts";
import { phonemize } from "../src/index.ts";
import { numberToWords } from "../src/languages/kamba/numbers.ts";
import { normalizeKamba } from "../src/languages/kamba/normalize.ts";

// Canonical-IPA goldens for Kamba / Kikamba (kam) — Niger-Congo BANTU (E55), Latin orthography, Kenya (~4M). A pure
// greedy g2p (kamba.ts). The referee is THIN (en.wiktionary Kamba, HUMAN, only 5 words), so these golds are
// hand-adjudicated against the phonology (Omniglot Kikamba chart + Wikipedia / Roberts-Kohno 2000) — the 5
// independently-verified anchors are called out. Kamba shares Kikuyu's 7-vowel ATR where the TILDE is vowel QUALITY
// (⟨ĩ⟩=e, ⟨ũ⟩=o), but the consonants DIFFER: ⟨v⟩=β (Kamba spells [β] as ⟨v⟩), ⟨sy⟩=ʃ / ⟨ky⟩=tʃ (a palatal series
// Kikuyu lacks), NO ⟨c⟩/⟨g⟩=ɣ, ⟨nth⟩=ⁿð. TONE (H/L) is not written → not emitted.
describe("Kamba canonical IPA — greedy g2p (Bantu, Kikamba orthography)", () => {
    test("the 5 en.wiktionary anchors (HUMAN IPA, tone + prenasal-notation folded)", () => {
        expect(phonemizeWord("mbiti")).toBe("ᵐbiti"); // hyena — ref mbítí
        expect(phonemizeWord("mũkonyo")).toBe("mokɔɲɔ"); // ref mòkɔ́ɲɔ̀ — ⟨ũ⟩=o, ⟨ny⟩=ɲ, ⟨o⟩=ɔ
        expect(phonemizeWord("mũtĩ")).toBe("mote"); // tree — ref mòté — ⟨ũ⟩=o, ⟨ĩ⟩=e
        expect(phonemizeWord("ngingo")).toBe("ᵑɡiᵑɡɔ"); // neck — ref ŋɡíŋɡɔ́ — ⟨ng⟩=ᵑɡ
        expect(phonemizeWord("ũtukũ")).toBe("otuko"); // night — ref òtúkò
    });

    test("7-vowel ATR: the TILDE is vowel QUALITY not nasal — ⟨ĩ⟩=e, ⟨ũ⟩=o; ⟨e⟩=ɛ, ⟨o⟩=ɔ; doubling = length", () => {
        expect(phonemizeWord("mũndũ")).toBe("moⁿdo"); // "person" — ⟨ũ⟩→o, ⟨nd⟩→ⁿd
        expect(phonemizeWord("kĩlũngũ")).toBe("keloᵑɡo"); // ⟨ĩ⟩→e, ⟨ũ⟩→o, ⟨ng⟩→ᵑɡ
        expect(phonemizeWord("kaa")).toBe("kaː"); // ⟨aa⟩→aː (length by doubling)
        expect(phonemizeWord("muundu")).toBe("muːⁿdu"); // ⟨uu⟩→uː
    });

    test("KAMBA-SPECIFIC consonants: ⟨v⟩=β, ⟨sy⟩=ʃ, ⟨ky⟩=tʃ, ⟨th⟩=ð, ⟨nth⟩=ⁿð (differ from Kikuyu)", () => {
        expect(phonemizeWord("ngavu")).toBe("ᵑɡaβu"); // ⟨v⟩→β (Kamba's [β]); ⟨ng⟩→ᵑɡ
        expect(phonemizeWord("mavindu")).toBe("maβiⁿdu"); // ⟨v⟩→β intervocalic
        expect(phonemizeWord("syana")).toBe("ʃana"); // "children" — ⟨sy⟩→ʃ (Kikuyu has no ⟨sy⟩)
        expect(phonemizeWord("kyama")).toBe("tʃama"); // ⟨ky⟩→tʃ affricate
        expect(phonemizeWord("thandatu")).toBe("ðaⁿdatu"); // "six" — ⟨th⟩→ð, ⟨nd⟩→ⁿd
        expect(phonemizeWord("nthakame")).toBe("ⁿðakamɛ"); // "blood" — ⟨nth⟩→ⁿð (prenasal dental)
    });

    test("prenasalized units + velar nasal: ⟨mb⟩=ᵐb, ⟨nz⟩=ⁿz, ⟨ny⟩=ɲ, ⟨ng'⟩=ŋ (distinct from ⟨ng⟩)", () => {
        expect(phonemizeWord("ng'ombe")).toBe("ŋɔᵐbɛ"); // "cow" — ⟨ng'⟩→ŋ, ⟨mb⟩→ᵐb
        expect(phonemizeWord("nyama")).toBe("ɲama"); // "meat" — ⟨ny⟩→ɲ
        expect(phonemizeWord("nzoka")).toBe("ⁿzɔka"); // ⟨nz⟩→ⁿz (post-nasal voicing of s)
        expect(phonemizeWord("itong'o")).toBe("itɔŋɔ"); // ⟨ng'⟩→ŋ (distinct from ⟨ng⟩→ᵑɡ)
        expect(phonemizeWord("king'abwe")).toBe("kiŋaβwɛ"); // ⟨ng'⟩→ŋ, standalone ⟨b⟩→β (mission spelling)
    });

    test("clause assembly: words + punctuation", () => {
        expect(createKamba().text("Mũndũ nĩ mũseo.").trim()).toBe("moⁿdo ne mosɛɔ ."); // "a person is good"
    });

    test("loan/name consonants are kept, not silently dropped (⟨d⟩=d, ⟨c⟩=tʃ)", () => {
        expect(phonemizeWord("Daudi")).toBe("daudi"); // "David" — a common Kenyan name; ⟨d⟩ must not vanish
        expect(phonemizeWord("daktari")).toBe("daktaɾi"); // "doctor" (loan) — onset ⟨d⟩ kept
    });

    test("the ⟨ng'⟩ apostrophe: all three variants normalise; a bare quote injects no glottal", () => {
        // straight ', curly ’ (U+2019), and modifier-letter ʼ (U+02BC) all spell the velar nasal in the wild
        for (const w of ["ng'ombe","ng’ombe","ngʼombe"]) expect(createKamba().text(w).trim()).toBe("ŋɔᵐbɛ");
        expect(createKamba().text("'mũtĩ'").trim()).toBe("mote"); // a quoted word → no phantom ʔ (Kamba has no glottal)
    });
});

// CARDINAL NUMBERS (kam). The compositor emits the CITATION / COUNTING series — literally the Peace Corps Kikamba
// Self-Instruction Manual's kũtala ("to count") list (ĩmwe, ĩlĩ, itatũ …) — because the manual states 1–5 take the
// prefix agreeing with the noun modified, and a bare integer has no such noun. The ALGORITHM is shared with
// Kikuyu (../kikuyu/e5xNumbers.ts); the words + citations are in kamba.jsonc "numbers".
describe("Kamba cardinal numbers — the manual's counting series", () => {
    test("units + the additive teens", () => {
        expect(numberToWords(0)).toBe("noti");
        expect(numberToWords(7)).toBe("mũonza");
        expect(numberToWords(11)).toBe("ĩkũmi na ĩmwe");
    });
    test("tens are miongo + their own multiplier series", () => {
        expect(numberToWords(20)).toBe("miongo ĩlĩ");
        expect(numberToWords(40)).toBe("miongo ina"); // ina here, but inya as the bare numeral 4
        expect(numberToWords(4)).toBe("inya");
        expect(numberToWords(90)).toBe("miongo keenda");
    });
    // These four strings are quoted VERBATIM from the manual's running text — they pin both the hundreds concord
    // series (maana + cl.6 a-) and the composition rule ("na" before the LAST component only).
    test("attested compounds reproduce the manual exactly", () => {
        expect(numberToWords(100)).toBe("ĩana yĩmwe");
        expect(numberToWords(150)).toBe("ĩana na miongo ĩtano"); // bare Ĩana before a remainder
        expect(numberToWords(250)).toBe("maana elĩ na miongo ĩtano");
        expect(numberToWords(1957)).toBe("ngili ĩmwe maana keenda miongo ĩtano na mũonza");
    });
    test("thousands + millions; 10⁹ is a THOUSAND MILLION (extends the manual's ngili ĩkũmi = 10 000)", () => {
        expect(numberToWords(1000)).toBe("ngili ĩmwe");
        expect(numberToWords(10000)).toBe("ngili ĩkũmi");
        expect(numberToWords(1000000)).toBe("milioni ĩmwe");
        expect(numberToWords(1000000000)).toBe("milioni ngili ĩmwe");
    });
    test("end-to-end through the g2p", () => {
        expect(phonemize("20","kam").trim()).toBe("miɔᵑɡɔ ele");
        expect(phonemize("250","kam").trim()).toBe("maːna ɛle na miɔᵑɡɔ etanɔ"); // ⟨aa⟩→aː
    });
});

// Kamba TEXT NORMALIZATION (src/languages/kamba/normalize.ts). Every test below encodes a MEASUREMENT over
// FLEURS kam_ke — 4,505 rows deduped to 1,992 unique cased utterances (column 3) — and the comment names it.
// There is no mined artifact and no kam.wikipedia (`attest.ts --lang kam` reports the host does not respond as
// a wiki) and espeak ships no Kamba, so every word emitted is a token of that corpus. Corpus diff over the
// 1,992: 190 utterances changed, DROP 11 → 4, every other leak class 0 on both sides.
describe("Kamba text normalization", () => {
    test("⟨î û í ú ì⟩ ARE ⟨ĩ ũ⟩ AND THE TILDE IS VOWEL QUALITY — the round's largest defect, invisible to every gate", () => {
        // î ×237 · û ×151 · í ×35 · ú ×31 · ì ×2 against ĩ ×5,126 / ũ ×3,883 — 312 word tokens over 263
        // distinct words in 91 of 1,992 utterances, and every one of the 263 is an ordinary Kamba word.
        // ⟨ĩ⟩ is /e/ and ⟨ũ⟩ is /o/, so the substitution silently swaps the ATR vowel (trap 61, Turkmen half:
        // both letters are Latin, nothing splits, and no leak class can see it).
        expect(normalizeKamba("nthî îla kîla nûndû maúú")).toBe("nthĩ ĩla kĩla nũndũ maũũ");
        expect(phonemize("nthî", "kam").trim()).toBe("ⁿðe"); // was ⁿði — the wrong vowel, a well-formed word
        expect(phonemize("andû", "kam").trim()).toBe("aⁿdo"); // was aⁿdu
        expect(phonemize("íúlú", "kam").trim()).toBe("eolo"); // was iulu
        expect(phonemize("maúú", "kam").trim()).toBe("maoː"); // was mauu — vowel AND length both lost
    });

    test("the fold's guard is the ALPHABET — this corpus's six foreign-diacritic words are untouched", () => {
        // Gürses, Müslüm, São, Asámi, Erdoğan, Erkoḉ. None carries a confusable, and each carries a letter
        // Kamba does not write, so a folded form would fail KAMBA_WORD even if it did.
        for (const w of ["Gürses", "Müslüm", "São", "Asámi", "Erdoğan", "Erkoḉ"])
            expect(normalizeKamba(w)).toBe(w);
    });

    test("THE PERCENT WORD IS THE ENGLISH BORROWING AND IT IS POSTPOSED — not Swahili's asilimia (trap 55)", () => {
        // `asilimia` (sw's word, PREFIXED there) is ×0 in kam_ke, as is `pasenti`. The corpus's own word is
        // `percenti`, once, in exactly this slot: "mbee wa 46 percenti ya kula". `%` ×3.
        expect(normalizeKamba("18% ya andu")).toBe("18 percenti ya andu");
        expect(normalizeKamba("Nadal akwatie poindi 88% syusie")).toBe("Nadal akwatie poindi 88 percenti syusie");
        // …and the tier's suppression keeps it from doubling where the writer already wrote it.
        expect(normalizeKamba("mbee wa 46 percenti ya kula")).toBe("mbee wa 46 percenti ya kula");
    });

    test("SWAHILI HAS NO UNIT SYMBOL IN ITS CORPUS AND KAMBA HAS FORTY — the tier is declared, with the noun FIRST", () => {
        // swahili.ts declines `units` outright ("not one abbreviated unit symbol in 1,938 utterances"). kam_ke
        // writes km/h ×4, km2 ×2, mm ×4, mi ×3, m ×2, sq mi ×3, cm ×1, mph ×1, m/s ×1. What DOES carry from
        // the sibling is the ORDER: the measure noun heads its phrase (`kilomita 1,600`, `mita 250`).
        expect(normalizeKamba("5mm (1/5 inzi)")).toBe("milimita 5 (1/5 inzi)");
        expect(normalizeKamba("kĩthĩmo kya 69cm")).toBe("kĩthĩmo kya sendimita 69");
        expect(normalizeKamba("ilomita 1,600 (1,000 mi)")).toBe("ilomita 1600 (maili 1000)");
        // the rate connective is the corpus's own: "maili 105 kwa isaa", "kilomita 1.5 kwa sekondi"
        expect(normalizeKamba("nginya 480 km/h (133 m/s; 300 mph)"))
            .toBe("nginya kilomita 480 kwa isaa (mita 133 kwa sekondi; maili 300 kwa isaa)");
        // ⚠ CLAUSE-FINAL (trap 58): the corpus's only bare `m` sits at a full stop.
        expect(normalizeKamba("kĩla kĩna ũasa wa 4892m.")).toBe("kĩla kĩna ũasa wa mita 4892.");
    });

    test("the square measure word PRECEDES its unit, and `sq mi` is emitted as WORDS, never as an invented ²", () => {
        // `sikwea` ×4, always before: "sikwea sya kilomita 755,688". `kubik` ×1: "120-160 kubik mita".
        // ⚠ Rewriting `sq mi` → `mi²` is trap 54's single forbidden move: an invented superscript reaches the
        // phoneme sink as a RAWMARK wherever the tier's digit-adjacency then declines.
        expect(normalizeKamba("kikavite 19,500 km2 na")).toBe("kikavite sikwea kilomita 19500 na");
        expect(normalizeKamba("kilomita 783,562 (300,948 sq mi)"))
            .toBe("kilomita 783562 (sikwea sya maili 300948)");
    });

    test("THE CURRENCY NOUN IS CONSUMED AND PUT BACK — the tier has no `already said it` test for currency", () => {
        // "mathangu ma mbesa meu ma Canada ma ndola $5 na ndola $100" — the writer wrote the noun (trap 12);
        // left alone the tier's `currencyPrefix` says it twice. `ndola` ×8, "mbesa sya Amelika ndola 30".
        expect(normalizeKamba("ma ndola $5 na ndola $100")).toBe("ma ndola 5 na ndola 100");
        // ⚠ US$ AND AUD$ ARE THEIR OWN KEYS (trap 64) — a letter runs into the mark and the bare key cannot match.
        expect(normalizeKamba("kuma US$11,000 nginya US$22,500")).toBe("kuma ndola 11000 nginya ndola 22500");
        // …and the sign before a MAGNITUDE, which the tier's number-adjacency cannot reach on its own.
        expect(normalizeKamba("kũnengane AUD$ milioni 45 sya")).toBe("kũnengane ndola milioni 45 sya");
        // ⚠ REFUSED: the £ (×1). The only pound candidate in the corpus is `paondĩ` ×1 and it is the WEIGHT —
        // "syaĩna ũĩto wa paondĩ 1,000" — which is Malay's `paun` and Ilocano's `libra` a third time.
        expect(normalizeKamba("kwa ndĩvi ya milioni £27")).toBe("kwa ndĩvi ya milioni £27");
    });

    test("THE COMMA ONLY GROUPS, THE DOT MOSTLY DECIMATES — and the dot GROUPS once, so both take the three-digit test", () => {
        // 47 `d,ddd` runs, all thousands; the comma never decimates here. The dot decimates 26 times and
        // groups exactly once: "Nguthu ila nene ya vinya wa aũme 2.400" — Washington's 2,400 men.
        expect(normalizeKamba("vinya wa aũme 2.400 yakĩlaa")).toBe("vinya wa aũme 2400 yakĩlaa");
        expect(normalizeKamba("inzi 6.34 kithimini")).toBe("inzi 6 34 kithimini");
        // ⚠ THE WHOLE NUMBER AT ONCE (trap 63) — three groups, which a per-pass join reads as two numbers.
        expect(normalizeKamba("kawaita 5,000,000 twi")).toBe("kawaita 5000000 twi");
        // ⚠ AND A CLAUSE-FINAL FIGURE MUST STILL DE-GROUP AND STILL SPLIT (trap 58). Four clause-final
        // decimals occur: 1.1. · 2.3. · 3.50. · 6.5.
        expect(normalizeKamba("kwa myaka 9,000.")).toBe("kwa myaka 9000.");
        expect(normalizeKamba("sĩsya ĩvĩsa ya 1.1.")).toBe("sĩsya ĩvĩsa ya 1 1.");
    });

    test("a dotted DESIGNATION and an IP-shaped run are not decimals", () => {
        // 802.11a/b/g/n ×4 in the corpus. ⚠ The tier runs BEFORE the decimal step precisely so `NOT_VERSION`
        // still has its dot to see (traps 39/46) — that ordering is what makes the one-letter `m` key safe.
        expect(normalizeKamba("vamwe na 802.11a, 802.11b na 802.11g")).toBe("vamwe na 802 11a, 802 11b na 802 11g");
        expect(normalizeKamba("18.55.6.215")).toBe("18.55.6.215"); // three dots ⇒ never a decimal
    });

    test("THE COLON IS A CLOCK ONLY 8 TIMES IN 14, and the two-digit minute bound declines the other six", () => {
        // clocks: saa 11:00 · Saa 1:15 · Saa 8:46 · saa 10:08 · saa 11:35 · Twi 11:20 · 09:19 p.m. · 10:00-…
        expect(normalizeKamba("Saa 1:15 sya kioko")).toBe("Saa 1 15 sya kioko");
        expect(normalizeKamba("masaa ma nthĩ ĩsu (09:19 p.m. GMT)")).toBe("masaa ma nthĩ ĩsu (09 19 p.m. GMT)");
        // ⚠ NOT the RATIO, self-glossed in its own sentence ("namba ikwatene ya ratio) ila yailwe ithwa yi 3:2"),
        //   NOT the UK degree class ("akwete 2:2 (ndikilii ya kilasi kya keli)"),
        //   NOT the three downhill-ski SPORTS TIMES, whose third field the right-hand guard rejects.
        expect(normalizeKamba("yailwe ithwa yi 3:2.")).toBe("yailwe ithwa yi 3:2.");
        expect(normalizeKamba("akwete 2:2 (ndikilii)")).toBe("akwete 2:2 (ndikilii)");
        expect(normalizeKamba("ya ndatika 4:41.30, ndatika 2:41.60")).toBe("ya ndatika 4 41 30, ndatika 2 41 60");
        // ⚠ AND THE DOT IS ALSO A CLOCK SEPARATOR ×4 — one rule, two notations, identical output.
        expect(normalizeKamba("mawonanyo moo saa 12.00 GMT")).toBe("mawonanyo moo saa 12 00 GMT");
    });

    test("THE RANGE JOINER IS THE CORPUS'S OWN RENDERING OF A DASH — `kũthi`, not `nginya` (trap 45 + the Fula lesson)", () => {
        // The universal FLEURS sentence: English "35-40 mph (56-64 km/h)" comes out here as
        // "kĩlomita 35 kũthi 40 kĩla ĩsaa (kĩlomita 56 kũthi 64 kĩla ĩsaa)" — a bare infix between two bare
        // numerals, twice. ⚠ `nginya` (×55) is the wrong PART OF SPEECH for the slot: both of its numeric
        // instances are governed by a preceding preposition ("kuma US$11,000 nginya US$22,500", "kati wa fiti
        // 328 nginya fiti 820") and after a digit it means "up to" ("kiseve kya nginya 480 km/h").
        expect(normalizeKamba("ĩa ya kilomita 2-3.")).toBe("ĩa ya kilomita 2 kũthi 3.");
        expect(normalizeKamba("kati wa 120-160 kubik mita")).toBe("kati wa 120 kũthi 160 kubik mita");
        expect(normalizeKamba("Sejong (1418-1450).")).toBe("Sejong (1418 kũthi 1450).");
        // ⚠ ASCENDING ONLY: the five non-ascending pairs are hockey/tennis SCORES and a truncated season,
        // which read as a juxtaposition and not a span.
        expect(normalizeKamba("itina wa uvika 6-6.")).toBe("itina wa uvika 6-6.");
        expect(normalizeKamba("Nadal na Muukananda usu ni 7-2.")).toBe("Nadal na Muukananda usu ni 7-2.");
        expect(normalizeKamba("kuma 1955-96, ila")).toBe("kuma 1955-96, ila");
    });

    test("TWO GUARDS EXIST FOR ONE AIRCRAFT, and both stop a reading this rule would have INTRODUCED (trap 56)", () => {
        // The corpus writes the Ilyushin twice with ROMAN `II`, and core/roman.ts runs in registry.ts WRAPPING
        // text(), so this layer sees `2-76s` and `2 -76` — ascending digit–hyphen–digit in both cases.
        expect(normalizeKamba("2-76s itina")).toBe("2-76s itina"); // a LETTER after the second operand
        expect(normalizeKamba("2 -76 yithiitwe")).toBe("2 -76 yithiitwe"); // spacing is not symmetric
        expect(phonemize("II-76s", "kam").trim()).toBe("ele miɔᵑɡɔ moɔⁿza na ðaⁿðato s");
        // ⚠ AND `:` IS IN BOTH RANGE GUARDS, or `saa 10:00-11:000` matches at `00-11` and the clock is destroyed.
        expect(normalizeKamba("wa saa 10:00-11:000 wîyoo")).toBe("wa saa 10 00-11:000 wĩyoo");
        // ⚠ AND RANGES RUN ABOVE THE DECIMAL STEP: `miaka 4.2- 3.9` is a DESCENDING span of millions of years,
        // and spending its dots first would leave an ascending `2- 3` for the rule to claim.
        expect(normalizeKamba("kuma miaka 4.2- 3.9 tene muno")).toBe("kuma miaka 4 2- 3 9 tene muno");
    });

    test("the degree word is `ndikilii` and the writer has ALREADY SAID IT — the scale letter is a stated loss", () => {
        // `°` ×1 in the whole corpus: "uvyuvu wa ndikilii +30°C". `ndikilii` ×7, and it is the corpus's word
        // for a temperature degree, a longitude degree and a geometric one ("ndikilii mĩongo kenda").
        // ⚠ No Celsius or Fahrenheit name exists in any source for Kamba (`selsiasi` ×0, no espeak, no wiki),
        // so the letter is consumed rather than read — left alone it is a bare affricate, *…tʃ*.
        expect(normalizeKamba("uvyuvu wa ndikilii +30°C na")).toBe("uvyuvu wa ndikilii +30 na");
        expect(normalizeKamba("20°C")).toBe("ndikilii 20");
    });

    test("A SPACED DASH IS A PAUSE — 20 clause boundaries carried none at all", () => {
        expect(normalizeKamba("Kukuia angi - Ndukaatate")).toBe("Kukuia angi, Ndukaatate");
        expect(normalizeKamba("kulisa iima na kutulila -- indi")).toBe("kulisa iima na kutulila, indi"); // ×1 doubled
        // LAST, so the range step has already claimed every dash between two numbers: the score keeps its
        // bare juxtaposition rather than gaining a spurious pause.
        expect(normalizeKamba("usindi museo wa 26 - 00 meisindana")).toBe("usindi museo wa 26 - 00 meisindana");
    });

    test("`&` and `x` — the two signs whose refusal would have been silent, and one is already a wrong reading", () => {
        // `&` ×1, `B&Bs`, and the conjunction `na` is everywhere in the language.
        expect(normalizeKamba("Mwiso muthyani, B&Bs isindanaa")).toBe("Mwiso muthyani, B na Bs isindanaa");
        // `×` is ×0 and ASCII `x` between digits is ×2, both the vehicle `4x4`. `kwa` is the corpus's own
        // dimension word ("sendimita 6 kwa 6", "milimita 56 kwa 56"); untouched, the ⟨x⟩ reads as *z*.
        expect(normalizeKamba("ateo 4x4 vendaa")).toBe("ateo 4 kwa 4 vendaa");
    });

    test("REFUSALS: the minus, the plus, and every sign this corpus does not contain", () => {
        // ⚠ THE MINUS IS REFUSED WHERE SWAHILI CLAIMS IT, and the difference is one measured instance. sw's
        // own test is "does the corpus contain word · space · hyphen · digit, the shape no guard can reject?"
        // — sw has none and kam has one, the Ilyushin. Zero true negatives in 1,992 utterances either way.
        expect(normalizeKamba("Russia kwa ivinda ikuvi niyaungamisye II -76 itina")).toContain("II -76");
        // ⚠ THE PLUS: ×2, and neither is arithmetic. `+30°C` writes the degree word immediately before the
        // sign and a plus does not invert its operand; `(UTC+1)` is contentful and no plus word is
        // sourceable — the corpus never spells a sign out, espeak ships no Kamba, and there is no wiki.
        expect(normalizeKamba("kindu saa 11:00 (UTC+1) Whitehall")).toBe("kindu saa 11 00 (UTC+1) Whitehall");
        // = < > × ÷ ± are all ×0 in the corpus; registered in ACCEPTED_SIGN_SILENCE with that measurement.
        for (const sign of ["=", "<", ">", "±", "÷"]) expect(normalizeKamba(`5 ${sign} 6`)).toBe(`5 ${sign} 6`);
        // ⚠ AND NO FRACTION RULE: `sources.ts` reports `fraction-series [NONE]`, and the corpus's one
        // candidate denominator (`nusu` ×10, "half") never stands beside a numerator.
        expect(normalizeKamba("5mm (1/5 inzi)")).toContain("1/5 inzi");
    });
});
