import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/zulu/zulu.ts";
import { normalizeZulu } from "../src/languages/zulu/normalize.ts";

describe("Zulu (isiZulu) g2p — authored", () => {
    it("clicks (census ǀ ǃ ǁ), aspirated and nasal variants", () => {
        expect(phonemizeWord("cela")).toBe("kǀˈɛːla"); // c → dental click kǀ
        expect(phonemizeWord("qala")).toBe("kǃˈaːla"); // q → alveolar click kǃ
        expect(phonemizeWord("xola")).toBe("kǁˈɔːla"); // x → lateral click kǁ
        expect(phonemizeWord("chaza")).toBe("kǀʰˈaːz̤a"); // ch → aspirated click
        expect(phonemizeWord("gcina")).toBe("ɡ̤ǀˈiːna"); // gc → voiced-depressor click
    });

    it("implosive, ejective stops, aspirates, depressor breathy voice", () => {
        expect(phonemizeWord("banga")).toBe("ɓˈaːŋɡ̤a"); // b → implosive ɓ; ng → ŋɡ̤ (depressor)
        expect(phonemizeWord("phuma")).toBe("pʰˈuːma"); // ph → aspirated pʰ (plain p is ejective pʼ)
        expect(phonemizeWord("thanda")).toBe("tʰˈaːnd̤a"); // th → tʰ; d → depressor d̤
        expect(phonemizeWord("zonke")).toBe("z̤ˈɔːŋkʼɛ"); // z → depressor z̤; nk → ŋkʼ
    });

    it("lateral fricatives, velar-lateral affricate, palatalization", () => {
        expect(phonemizeWord("hlala")).toBe("ɬˈaːla"); // hl → voiceless lateral fricative ɬ
        expect(phonemizeWord("dlala")).toBe("ɮ̤ˈaː˥˩la˩"); // dl → voiced lateral fricative ɮ̤ (+ lexical tone)
        expect(phonemizeWord("klabe")).toBe("k͡xʼˈaːɓɛ"); // kl → velar-lateral affricate k͡xʼ
        expect(phonemizeWord("njani")).toBe("ɲd͡ʒ̤ˈaːni"); // nj → homorganic ɲd͡ʒ̤
    });

    it("penultimate stress + length and lexical tone overlay", () => {
        expect(phonemizeWord("abantu")).toBe("a˩ɓˈaː˥ntʼu˩"); // penult aː + tone L-H-L
        expect(phonemizeWord("umuntu")).toBe("u˩mˈuː˥ntʼu˩");
        expect(phonemizeWord("labantu")).toBe("laɓˈaːntʼu"); // out-of-lexicon → untoned, penult stress/length only
    });

    it("cardinal numbers (agglutinative; toned like any word where the lexicon has data)", () => {
        expect(phonemize("1", "zu")).toBe("kʼˈuːɲɛ"); // ku- form not in lexicon → untoned
        expect(phonemize("10", "zu")).toBe("i˥˩ʃˈuː˥˩mi˩"); // ishumi is a toned noun (kaikki: FFL)
        expect(phonemize("100", "zu")).toBe("i˥˩kʰˈuː˥˩lu˩"); // ikhulu (kaikki: FFL)
        expect(phonemize("21", "zu")).toBe("amaʃˈuːmi amaɓˈiːli nˈaːɲɛ"); // combining forms have no tone data
    });

    // The three unit series are distinct and must NOT be conflated: standalone ku- (kuthathu), connective na-
    // (nantathu), multiplier ama- (amathathu). Source: zulu.jsonc "numbers" (authored table).
    // Regression note: 13/15/23/25/… were once reported as failures by a number-audit probe whose sentinel regex
    // was case-insensitive and so matched the legitimate na- forms "NANtathu"/"NANhlanu" as "NaN". The output was
    // correct all along; these goldens pin it.
    it("cardinal numbers — the na- connective series (units 3 and 5) is intact", () => {
        expect(phonemize("3", "zu")).toBe("kʼutʰˈaːtʰu"); // kuthathu — standalone ku-
        expect(phonemize("5", "zu")).toBe("kʼuɬˈaːnu"); // kuhlanu
        expect(phonemize("13", "zu")).toBe("i˥˩ʃˈuː˥˩mi˩ nantʼˈaːtʰu"); // ishumi nantathu — connective na-
        expect(phonemize("15", "zu")).toBe("i˥˩ʃˈuː˥˩mi˩ nanɬˈaːnu"); // ishumi nanhlanu
        expect(phonemize("555", "zu")).toBe("amakʰˈuːlu amaɬˈaːnu amaʃˈuːmi amaɬˈaːnu nanɬˈaːnu"); // ama- multipliers
        expect(phonemize("2000", "zu")).toBe("iz̤iŋkʼuluŋɡ̤wˈaːnɛ amaɓˈiːli"); // izinkulungwane amabili
        expect(phonemize("1000000", "zu")).toBe("i˩si˥ɡ̤ˈiː˩d̤i˩"); // isigidi
    });

    it("compound splits on internal capitals; tone threads across if the full word is listed", () => {
        expect(phonemize("isiNgisi", "zu")).toBe("ˈiː˥si˩ ŋɡ̤ˈiː˥si˩"); // full word toned → threaded
        expect(phonemize("isiTsonga", "zu")).toBe("ˈiːsi t͡sʼˈɔːŋɡ̤a"); // full word not listed → untoned
    });
});

/**
 * TEXT NORMALIZATION. These pin the RULE'S BRANCHES, not the corpus's instances : every
 * table gets both a case the corpus contains and a case it does not, and every guard gets the neighbour it
 * is supposed to refuse. `normalizeZulu` is asserted as text→text because that is what the layer is; the
 * `phonemize` cases at the end pin the ORDERING against the shared symbol tier, which normalize.ts runs
 * before and which the text assertions cannot see.
 */
describe("Zulu text normalization", () => {
    it("thousands de-grouping — including the position the first version got wrong", () => {
        expect(normalizeZulu("angu-1,000")).toBe("angu-1000");
        expect(normalizeZulu("u-755,688")).toBe("u-755688");
        expect(normalizeZulu("ezi-5,000,000")).toBe("ezi-5000000"); // multi-group
        // The clause-boundary positions: an earlier trailing guard of `(?![\d.,])` refused these outright,
        // so 6 of the corpus's 34 grouped numbers stayed broken while the rest were fixed.
        expect(normalizeZulu("angu-1,000, futhi")).toBe("angu-1000, futhi");
        expect(normalizeZulu("nangu-2,207.")).toBe("nangu-2207.");
        // NOT a grouping comma: a 1–2 digit tail is Zulu's other decimal separator.
        expect(normalizeZulu("ezingu-1,5 ziyahamba")).toBe("ezingu-1 5 ziyahamba");
        expect(normalizeZulu("ngo-12,00 GMT")).toBe("ngo-12 ji emu thi"); // the comma clock, not thousands
        // SPACE grouping (×1) — the halves were read as two numbers, *ikhulu iqanda* ("a hundred, zero").
        expect(normalizeZulu("ku- 100 000 abantu")).toBe("ku- 100000 abantu");
        expect(normalizeZulu("ye-6 ngo-6")).toBe("ye-6 ngo-6"); // a 1-digit block is not grouping
    });

    it("math signs — every one was dropped, and every reading is composed from corpus words", () => {
        expect(normalizeZulu("6 \u00d7 6")).toBe("6 kuphindwe ngo-6"); // the corpus's own multiplication idiom
        expect(normalizeZulu("x = y")).toBe("x kulingana no-y");
        expect(normalizeZulu("5 < 6")).toBe("5 ngaphansi kuka-6");
        expect(normalizeZulu("6 > 5")).toBe("6 ngaphezu kuka-5"); // the adversarial neighbour — 0 instances
        // `plas`, not ` no-`. ` no-` was inferred from the SENSE of `(UTC+1)` while the rule's own
        // comment said a bare positive sign was left under-specified rather than guessing a borrowing — but the
        // borrowing is audible: a PHONEME recognizer (no `+`, no digits in its vocabulary) gives
        // `j u t i s i p l a s w a n`. One speaker of three; the other two skip the parenthetical entirely, so
        // it is 1 of 1 among those who read the offset — thinner than xh's 3 of 3, and recorded as such.
        expect(normalizeZulu("(UTC+1)")).toBe("(yu thi si plas 1)");
        expect(normalizeZulu("-5")).toBe("ukukhipha 5"); // a PREFIX; Zulu subtraction takes an object
        // The guard that makes the minus rule safe: a rugby score must NOT read *ukukhipha iqanda*.
        expect(normalizeZulu("ngo-26 -00 kalula")).toBe("ngo-26 -00 kalula");
        expect(normalizeZulu("wama-10 -11")).toBe("wama-10 kuya ku-11"); // claimed as a span at step 10
    });

    it("decimals — the point is unnamed, trailing zeros go, interior zeros stay", () => {
        expect(normalizeZulu("angu-1.5")).toBe("angu-1 5");
        expect(normalizeZulu("angu-6.34")).toBe("angu-6 3 4"); // was read as the number "thirty-four"
        expect(normalizeZulu("engu-3.50 m")).toBe("engu-3 5 amamitha"); // trailing zero stripped
        expect(normalizeZulu("u-1.05")).toBe("u-1 0 5"); // interior zero KEPT (not in the corpus)
        expect(normalizeZulu("Umfanekiso 1.1.")).toBe("Umfanekiso 1 1."); // sentence period survives
        expect(normalizeZulu("lika-802.11n")).toBe("lika-802 1 1n"); // the Wi-Fi standard, digit by digit
        expect(normalizeZulu("1.1.1")).toBe("1.1.1"); // three fields is not a decimal — left alone
    });

    it("decimals claim their own neighbour, because words-ifying breaks the tier's adjacency", () => {
        expect(normalizeZulu("ku-$2.3 bhiliyoni")).toBe("ku-2 3 amadola bhiliyoni");
        expect(normalizeZulu("u-$14.7 wamabhiliyoni")).toBe("u-14 7 amadola wamabhiliyoni");
        expect(normalizeZulu("ngo-12.8 km")).toBe("ngo-12 8 amakhilomitha");
        expect(normalizeZulu("ezingu-2.2 km2")).toBe("ezingu-2 2 amakhilomitha skwele");
        expect(normalizeZulu("engu-2.2 km²")).toBe("engu-2 2 amakhilomitha skwele"); // the other exponent glyph
    });

    it("clock — both minute branches, both spellings of the separator, and the sports-time refusal", () => {
        expect(normalizeZulu("Ngo-11:20")).toBe("Ngo-11 nemizuzu engu-20");
        expect(normalizeZulu("ngo-10:00 ekuseni")).toBe("ngo-10 ekuseni"); // :00 is the bare hour, never *iqanda*
        expect(normalizeZulu("ngo-07:19")).toBe("ngo-7 nemizuzu engu-19"); // the leading zero goes
        expect(normalizeZulu("ngawo- 9: 30")).toBe("ngawo- 9 nemizuzu engu-30"); // the corpus's spaced colon
        expect(normalizeZulu("ngo-1:15 a.m.")).toBe("ngo-1 nemizuzu engu-15 ekuseni");
        expect(normalizeZulu("ngo-8:30 p.m.")).toBe("ngo-8 nemizuzu engu-30 ntambama");
        expect(normalizeZulu("ngo-23:59")).toBe("ngo-23 nemizuzu engu-59"); // the 24h ceiling (not in the corpus)
        expect(normalizeZulu("ngo-25:00")).toBe("ngo-25:00"); // out of range → refused
        // A THIRD field is a racing pace, not a time: no clock, no pause, no decimal split.
        expect(normalizeZulu("esingu-4:41.30,")).toBe("esingu-4 41 30,");
        expect(normalizeZulu("ngo-1:09.02")).toBe("ngo-1 09 02");
    });

    it("clock before a timezone — the dot, comma and bare-four-digit spellings", () => {
        expect(normalizeZulu("(15.00 UTC)")).toBe("(15 UTC)");
        expect(normalizeZulu("ngo-12,00 GMT")).toBe("ngo-12 ji emu thi");
        expect(normalizeZulu("(0230 UTC)")).toBe("(2 nemizuzu engu-30 yu thi si)"); // was read as the number 230
        expect(normalizeZulu("(UTC+1)")).toBe("(yu thi si plas 1)"); // an offset, not a time — the + reads at step 14b
    });

    it("ranges — ascending spans join with `kuya ku-`, scores and seasons do not", () => {
        expect(normalizeZulu("angu-3-5")).toBe("angu-3 kuya ku-5");
        expect(normalizeZulu("wama-10 -11")).toBe("wama-10 kuya ku-11"); // the corpus's spaced hyphen
        expect(normalizeZulu("(1418 – 1450)")).toBe("(1418 kuya ku-1450)"); // en dash + spaces
        expect(normalizeZulu("ngo-26 -00")).toBe("ngo-26 -00"); // a rugby score — juxtaposition, not a span
        expect(normalizeZulu("ngo-1995-96")).toBe("ngo-1995-96"); // a season
        expect(normalizeZulu("5-3")).toBe("5-3"); // an ice-hockey score
        // A DECIMAL range joins in either direction: no score or season is ever written with a point.
        expect(normalizeZulu("ezingu-4.2-3.9")).toBe("ezingu-4 2 kuya ku-3 9");
        expect(normalizeZulu("ku-1,000-1,300")).toBe("ku-1000 kuya ku-1300"); // grouped operands
    });

    it("rate — one agglutinated word, which is why it is not the shared tier's", () => {
        expect(normalizeZulu("u-165 km/h")).toBe("u-165 amakhilomitha ngehora");
        expect(normalizeZulu("133 m/s")).toBe("133 amamitha ngomzuzwana");
        expect(normalizeZulu("kuka-160km/h")).toBe("kuka-160 amakhilomitha ngehora"); // glued
        expect(normalizeZulu("480 km / h")).toBe("480 amakhilomitha ngehora"); // spaced slash
        expect(normalizeZulu("300 mph")).toBe("300 amamayela ngehora");
        expect(normalizeZulu("64 kph")).toBe("64 amakhilomitha ngehora");
        // The corpus writes the count AFTER the unit once, so mph/kph are claimed with no number at all.
        expect(normalizeZulu("sama-kph ayishumi nanye")).toBe("sama-amakhilomitha ngehora ayishumi nanye");
        expect(normalizeZulu("angu-5 cm/s")).toBe("angu-5 amasentimitha ngomzuzwana"); // unattested branch
    });

    it("square miles, degrees, and the compass — the click letters the ° left behind", () => {
        expect(normalizeZulu("(300,948 sq mi)")).toBe("(300948 amamayela skwele)"); // `sq` read as [skǃ]
        // The corpus's own misspelling of km. The UNIT_WORD entry for it shipped with NO rule that reached
        // it, so `kma` read as the word [kʼmˈaː]; `km` beside it is the shared tier's and already worked.
        expect(normalizeZulu("ongama-1600 kma kusuka")).toBe("ongama-1600 amakhilomitha kusuka");
        expect(normalizeZulu("engu-2.5 kma")).toBe("engu-2 5 amakhilomitha"); // the decimal still splits
        expect(normalizeZulu("ikma yakhe")).toBe("ikma yakhe"); // no number → declined, it may be a word
        // ⚠ A DEGREE PATTERN THAT OPENS WITH `[+]?` MATCHES THE SIGN AND NEVER RE-EMITS IT, so `+30°C` loses
        // it silently — the same shape sw's `([+-]?)` had. `plas` is sourced (step 14b) and the sign is
        // claimed at step 8c, BEFORE degrees — after the degree rewrite the text reads `+amazinga…` and the
        // sign step needs a digit after the sign, so ordering is what makes it reachable.
        expect(normalizeZulu("kuka-+30°C")).toBe("kuka- plas amazinga angu-30"); // C alone read as the click [kǀ]
        expect(normalizeZulu("angu-35°F")).toBe("angu-amazinga angu-35 Fahrenheit"); // NOT in the corpus
        expect(normalizeZulu("kwe-35°W")).toBe("kwe-amazinga angu-35 entshonalanga");
        expect(normalizeZulu("40°N")).toBe("amazinga angu-40 enyakatho");
        expect(normalizeZulu("40°S")).toBe("amazinga angu-40 eningizimu");
        expect(normalizeZulu("40°E")).toBe("amazinga angu-40 empumalanga");
        expect(normalizeZulu("u-90°")).toBe("u-amazinga angu-90"); // bare degree
    });

    it("era markers, dotted runs and the ampersand", () => {
        expect(normalizeZulu("ngawo-10,000 BCE.")).toBe("ngawo-10000 ngaphambi kukaKristu.");
        expect(normalizeZulu("ngo-1000 B.C., abase-Asiriya")).toBe("ngo-1000 ngaphambi kukaKristu, abase-Asiriya");
        expect(normalizeZulu("ku-5000 BC!")).toBe("ku-5000 ngaphambi kukaKristu!");
        // Two bare capitals are otherwise an ordinary initialism, so `BC` needs a number in front of it.
        expect(normalizeZulu("i-bhi si yaseCanada")).toBe("i-bhi si yaseCanada");
        // A sentence-final marker keeps its period — the pause must not be swallowed.
        expect(normalizeZulu("kusukela ngo-1000 B.C. Abase-Asiriya")).toBe(
            "kusukela ngo-1000 ngaphambi kukaKristu. Abase-Asiriya");
        expect(normalizeZulu("e-U.S. ube ngowesibili")).toBe("e-yu esi ube ngowesibili"); // was [ˈuː . s .]
        expect(normalizeZulu("uJoji W. Hlathi")).toBe("uJoji W Hlathi"); // the lone initial's dot
        expect(normalizeZulu("Arts & Sciences")).toBe("Arts kanye ne-Sciences");
        expect(normalizeZulu("amaB&amp;B")).toBe("amaB kanye ne-B"); // the corpus's HTML entity
    });

    it("fractions — numerator 1 only, table branch and the refusals", () => {
        expect(normalizeZulu("(1/5 yintshi)")).toBe("(ingxenye yesihlanu yintshi)"); // the corpus's one instance
        expect(normalizeZulu("1/4")).toBe("ingxenye yesine"); // the corpus's own fraction word, attested
        expect(normalizeZulu("1/10")).toBe("ingxenye yeshumi"); // class 5, NOT *yesishumi — unattested branch
        expect(normalizeZulu("3/5")).toBe("3/5"); // needs a class-8 concord on the numerator — refused
        expect(normalizeZulu("1/11")).toBe("1/11"); // outside the table — refused rather than guessed
    });

    it("a spaced dash is a parenthetical pause; a dash between numbers is not", () => {
        expect(normalizeZulu("ilunga - bona")).toBe("ilunga, bona");
        expect(normalizeZulu("oyedwa – ubuJuda")).toBe("oyedwa, ubuJuda");
        expect(normalizeZulu("ezilandelayo — ngokuvamile")).toBe("ezilandelayo, ngokuvamile");
        expect(normalizeZulu("ngo-26 -00 kalula")).toBe("ngo-26 -00 kalula"); // the score keeps its shape
    });

    // END-TO-END, which is the only place the ORDER of normalize.ts against the shared symbol tier shows up:
    // normalize runs first and leaves digits as digits, so the tier still sees `36mm`, `$45` and `88%`.
    it("through the phonemizer: the tier still sees what normalize left it", () => {
        expect(phonemize("ingu-36mm", "zu")).toBe(
            "ˈiːŋɡ̤u amaʃˈuːmi amatʰˈaːtʰu nɛsitʰˈuːpʰa amamilimˈiːtʰa");
        expect(phonemize("angu-90kg", "zu")).toBe(
            "ˈaːŋɡ̤u amaʃˈuːmi ajisiʃijaɡ̤alɔlˈuːɲɛ amakʰilɔɣ̤ˈɛːmu");
        expect(phonemize("angu-3,850 km²", "zu")).toBe(
            "ˈaːŋɡ̤u iz̤iŋkʼuluŋɡ̤wˈaːnɛ amatʰˈaːtʰu amakʰˈuːlu ajisiʃijaɡ̤alɔmbˈiːli amaʃˈuːmi amaɬˈaːnu"
            + " amakʰilɔmˈiːtʰa skʼwˈɛːlɛ");
        // The multi-character currency keys: without them the tier's `$` is letter-bounded on the left, the
        // sign was DROPPED, and `US`/`AUD` reached the g2p as a cluster.
        expect(phonemize("ku-US$30", "zu")).toBe("kʼˈuː amaʃˈuːmi amatʰˈaːtʰu amad̤ˈɔːla");
        expect(phonemize("engu-AUD$45", "zu")).toBe(
            "ˈɛːŋɡ̤u amaʃˈuːmi amˈaːnɛ nanɬˈaːnu amad̤ˈɔːla");
        expect(phonemize("ezingu-£27", "zu")).toBe(
            "ɛz̤ˈiːŋɡ̤u amaʃˈuːmi amaɓˈiːli nɛsikʰɔmbˈiːsa amapʰawˈuːnd̤i");
        expect(phonemize("abangu-93%", "zu")).toBe(
            "aɓˈaːŋɡ̤u amaʃˈuːmi ajisiʃijaɡ̤alɔlˈuːɲɛ nantʼˈaːtʰu amapʰɛsˈɛːntʼi");
    });

    // TRAP 12 — the corpus's ONLY °C sentence already says *amazinga*, and the rule was adding its own:
    // `amazinga okushisa angaphezu kuka-+30°C` read *amazinga okushisa angaphezu kuka- AMAZINGA ANGU- …*,
    // the degree word twice and two bound concords in a row (`kuka-` already governs the number).
    it("does not say the degree word twice", () => {
        expect(normalizeZulu("amazinga okushisa angaphezu kuka-+30°C avamile"))
            .toBe("amazinga okushisa angaphezu kuka- plas 30 avamile");
        // …and where the clause does NOT carry it, the rule must still emit it.
        expect(normalizeZulu("kufinyelela ku-30°C namuhla")).toBe("kufinyelela ku-amazinga angu-30 namuhla");
        // A clause boundary ends the suppression window — a previous sentence does not license the drop.
        expect(normalizeZulu("amazinga. Kufinyelela ku-30°C")).toBe("amazinga. Kufinyelela ku-amazinga angu-30");
        // The corpus's second instance is a LONGITUDE with no degree word of its own: still emitted.
        expect(normalizeZulu("empumalanga kwe-35°W.")).toBe("empumalanga kwe-amazinga angu-35 entshonalanga.");
        // Fahrenheit survives the suppression path (0 corpus instances, pinned per absence is not evidence of correctness
        expect(normalizeZulu("izinga elingu-35°F")).toBe("izinga elingu-amazinga angu-35 Fahrenheit");
    });
});

// Abbreviations found by the corpus QC pass; FLEURS strips the dot, so both spellings must work.
describe("njll. and udkt. — corpus abbreviations", () => {
    it("njll. is njalonjalo (et cetera)", () => {
        expect(phonemize("zokuthutha njll kuzo", "zu")).toContain("ɲd\u0361\u0292\u0324alɔɲd\u0361\u0292\u0324ˈaːlɔ");
    });
    it("udkt. is udokotela", () => {
        expect(phonemize("kwazulu natal udkt toni", "zu")).toContain("d\u0324ɔ");
    });
});

/**
 * ⚠ THE NGUNI LOANWORD LEXICON. `isForeignNguniWord` decides click-vs-foreign from three signals, and
 * its own note records the cost: a vowel-final CV English name is shaped exactly like a Nguni word, so
 * `canada` and `cabanga` cannot be told apart orthographically. Those words are LEXICALISED instead —
 * which is what English does with its own loans, and what these are.
 *
 * ⚠ THE READINGS SPLIT TWO WAYS, measured against the FLEURS audio, which is why no single rule could
 * have worked. Long-established borrowings are NATIVISED and newer names keep English phonology:
 *
 *   canada  ASR `b a s e k a n a d`   -> /kanada/     mexico ASR `m e ð u k s i k o` -> /meksiko/
 *   congo   ASR `k o ŋ ɡ`             -> /kongo/      china  ASR `tʃ h aɪ n n a`     -> English
 *
 * See src/languages/zulu/nguniLoans.ts for each entry's evidence.
 */
describe("the Nguni loan lexicon", () => {
    const CLICK = /[ǀǁǃǂ]/u;

    it("nativised loans read with a plain stop, not a click", async () => {
        expect(await phonemize("canada", "zu")).toBe("kʼanˈaːd̤a");
        expect(await phonemize("congo", "zu")).toBe("kʼˈɔːŋɡ̤ɔ");
        // ⟨x⟩ takes its Latin /ks/, which is what the recognizer heard: meksiko
        expect(await phonemize("mexico", "zu")).toBe("mɛkʼsˈiːkʼɔ");
    });

    it("English-read loans go to the foreign reader", async () => {
        // the ⟨aɪ⟩ diphthong is the tell — Nguni does not have it
        expect(await phonemize("china", "zu")).toContain("aᶦ");
        expect(await phonemize("carolina", "zu")).toContain("aᶦ");
        for (const w of ["china", "chile", "carolina"])
            expect(await phonemize(w, "zu"), w).not.toMatch(CLICK);
    });

    it("foreign surnames, which fail ONLY the dictionary signal", async () => {
        for (const w of ["cuerden", "cadwalder", "corniglia", "choudhary", "capuzzo", "chhatrapati"])
            expect(await phonemize(w, "zu"), w).not.toMatch(CLICK);
    });

    /**
     * ⚠ THE GUARD THAT MATTERS MOST. Relaxing signal 2 instead of adding a lexicon was measured and it
     * routes REAL Nguni words to English — including `compyutha`, the nativised borrowing of
     * "computer", and `xhosa` itself. A lexicon adds words one at a time; loosening a signal removes a
     * guard from all of them at once.
     */
    it("native words keep their clicks", async () => {
        for (const w of ["cha", "cela", "caba", "cima", "coca", "xhosa", "cishe", "xesha",
                         "qiniseka", "cwaka", "ukucela", "compyutha", "qho"])
            expect(await phonemize(w, "zu"), w).toMatch(CLICK);
    });
});
