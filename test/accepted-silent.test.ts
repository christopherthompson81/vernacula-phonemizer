/**
 * THE ACCEPTED-SILENT BASELINE — proof that it is a baseline and not a quiet gate.
 *
 * `defects.ts` records the judgement that a spaced designation cannot be told from a real negative by pattern
 * (`चंद्रयान -1` and `-5 stupňů` are the same shape) and that "a quiet gate would be worse". So the sweep's
 * permanent residual is accepted BY IDENTITY — the literal designation strings — and these tests pin the two
 * properties that make that safe. If either fails, the audit has started hiding real defects.
 */
import { describe, expect, test } from "vitest";
import { ACCEPTED_SILENT, DROPPABLE, isAcceptedSilent } from "../tools/normalization/defects.ts";

const MINUS = DROPPABLE.find(([n]) => n === "minus")![1];
const MATH = DROPPABLE.find(([n]) => n === "math-sign")![1];

describe("ACCEPTED_SILENT is a baseline, not a suppression", () => {
    test("the five named designations are accepted", () => {
        expect(isAcceptedSilent("hi", "minus", "लूनर ऑर्बिट चंद्रयान -1 ने अपने मून", MINUS)).toBe(true);
        expect(isAcceptedSilent("mr", "minus", "चंद्र कक्षा चंद्रयान -1 ने त्याचा", MINUS)).toBe(true);
        expect(isAcceptedSilent("ta", "minus", "சுற்றுப்பாதை சந்திரயான் -1 செயற்கைக்கோள்", MINUS)).toBe(true);
        expect(isAcceptedSilent("gu", "minus", "રહેવા માટે એચજેઆર -3 ની આગામી", MINUS)).toBe(true);
        expect(isAcceptedSilent("kn", "minus", "ಮತ್ತೆ ಎಚ್‌ಜೆಆರ್ -3 ಅನ್ನು ಪರಿಶೀಲಿಸುತ್ತದೆ", MINUS)).toBe(true); // ⚠ ZWNJ U+200C inside ಎಚ್‌ಜೆಆರ್
    });

    test("⚠ A REAL NEGATIVE IN THE SAME SENTENCE STILL REPORTS", () => {
        // The accept is per-OCCURRENCE: every match must fall inside a named span, so a designation cannot
        // launder a genuine minus that happens to share its sentence. hi's one true negative in the whole
        // fleet is exactly this shape, which is what makes the property load-bearing rather than theoretical.
        expect(isAcceptedSilent("hi", "minus", "चंद्रयान -1 ने और -२.८८ परिमाण", MINUS)).toBe(false);
        expect(isAcceptedSilent("hi", "minus", "तापमान -5 डिग्री", MINUS)).toBe(false);
    });

    test("⚠ AN UNLISTED DESIGNATION STILL REPORTS — nothing is suppressed by SHAPE", () => {
        // Same shape as the accepted ones (word, space, dash, digit) and deliberately not accepted: a sixth
        // designation, or one of these in a new language, must surface for a human judgement.
        expect(isAcceptedSilent("hi", "minus", "मिशन मंगलयान -2 ने", MINUS)).toBe(false);
        expect(isAcceptedSilent("te", "minus", "చంద్రయాన్ -1 ఉపగ్రహం", MINUS)).toBe(false);
        expect(isAcceptedSilent("bn", "minus", "চন্দ্রযান -1 এর", MINUS)).toBe(false);
    });

    test("a language that names nothing accepts nothing, and only `minus` is in scope", () => {
        expect(isAcceptedSilent("de", "minus", "Temperatur -5 Grad", MINUS)).toBe(false);
        // The table is keyed to the minus class only; no other class may borrow it.
        expect(isAcceptedSilent("hi", "currency", "चंद्रयान -1 ने", MINUS)).toBe(false);
    });

    test("a sentence with no match at all is not vacuously accepted", () => {
        // `sawOne` guards this: an empty match set must not count as "every match is fine".
        expect(isAcceptedSilent("hi", "minus", "कोई संख्या नहीं", MINUS)).toBe(false);
    });

    test("the table covers the sweep's whole residual, per class", () => {
        // ⚠ AN ENTRY THAT CAN NO LONGER FIRE MUST BE DELETED, not left as harmless ballast: it would mask
        // exactly the regression this table exists to make visible. `mi` used to sit here, accepting
        // `+30 tākiri` as correctly silent because Māori's inventory could not say the attested English loan.
        // Once that engine gained an English READER for words it cannot spell, the plus read [plˈʌs], the drop
        // stopped happening, and the accept covered nothing. Deleted from both lists together.
        // ⚠ `km` is the one entry here that is NOT a designation.
        // The km wiki carries a programming tutorial whose code reaches the corpus, and the percent cell selects
        // it because `%` beside letters is exactly what that cell looks for. The `%` in `scanf("%lf %lf", …)` is
        // a C conversion flag, so silence is the CORRECT reading and a rule that voiced it would be the defect.
        // The line is legitimately in the corpus — its trailing comment really is Khmer — so it survives the
        // native-script filter and has to be accepted by identity instead.
        // tl's entries are two shapes: prehistoric-year notation ("taong -73 000" — BCE years, not arithmetic;
        // the CLASS refusal with its measurement is in ACCEPTED_SIGN_SILENCE, and the instance spans exist
        // because the class-acceptance test cannot match a contextual sign regex against single characters),
        // and Japanese iteration marks QUOTED as signs in an article about kana orthography.
        // wuu's entries are the third non-designation shape, and the exponent one is a hazard specific to
        // the Sinitic dirs: A SUPERSCRIPT IN A WU ARTICLE IS OFTEN A CHAO TONE NUMBER, NOT A POWER
        // (`khan³⁵-ban⁵⁵-kae³¹`, `[ʑin²²ø⁵⁵tɕʰy²¹]`, `di⁶ jieu⁶`) — the language writes its own phonology
        // that way, so voicing them would read a pronunciation gloss as arithmetic. Listed by instance,
        // never by class, so a `km²` regression stays visible. Its minus spans are NEGATIVE EXPONENTS in SI
        // units written with a spaced ASCII minus (`kg·m·s −2`, `g·mol −1`, `g·cm −3`) — the same
        // contextual-regex limitation tl records, one class further on.
        // jv's four entries are all "this is not the sign you think it is": SCIENTIFIC NOTATION
        // (`108,2 × 10⁶ km`, planetary orbital radii), BOTANICAL PARENTHETICAL EXTREMES (`10-15(-17) cm`,
        // the flora convention for "usually 10–15, rarely to 17"), a MIXED FRACTION before a degree sign
        // (`23 1/2°LU`, the tropics), and template debris (`--- jiwa/km²`). Its one true negative is
        // `at –45 °C` inside an ENGLISH citation title, listed for the same reason.
        // nan's entries are dominated by ONE ORTHOGRAPHIC FACT: POJ joins syllables with a HYPHEN, so its
        // minus class is word-internal punctuation (`ko͘-1-ê`, `--1-piàn`) alongside the `ISO 8859-N` block,
        // an ISBN and two genuine negatives no Min Nan word can read. Its exponent entry records the same
        // hazard Wu's does from a different source — a superscript in a nan article is often a ROMANIZATION
        // TONE NUMBER (jyutping `hoeng¹ gong² dak⁶`), not a power.
        // ⚠ cjy's single entry is the THIRD SINITIC CORPUS to produce the same hazard from a different
        // source: a superscript is a ROMANIZATION TONE NUMBER, not a power. wuu got it from Chao tone
        // letters in its own phonology sections, nan from jyutping quoted in a Hong Kong article, and cjy
        // from its own romanization (`Hai²-di²-lau¹ si³ Zung¹-gueh⁴`). Expect it in gan/hak/hsn too.
        // ⚠ AND THAT PREDICTION CAME TRUE ON THE NEXT LANGUAGE: hak is the FOURTH, from a fourth source —
        // hak.wikipedia glosses OTHER varieties' phonology inline (`Si-chhôn-fa piang-yîm: Xu⁴nin²`,
        // `No²san¹`, `ȵi²bin¹`). Four Sinitic corpora, four different routes to the same false positive,
        // which is what makes it a property of the writing culture rather than of any one wiki. hak's minus
        // entry records something else: the 3-DIGIT year ranges its layer deliberately declines
        // (`303-ngièn -349-ngièn`), where the 4-digit ones ARE read — a boundary, listed so it stays one.
        // ln is the first entry whose largest class is `degree`, and it is there because ONE CHARACTER DOES
        // THREE JOBS on a French-influenced wiki: the temperature degree (which IS read — `°C` → the scale
        // name), the coordinate/angle degree, and the FRENCH NUMERO SIGN (`Mobéko n°011/2002`, `n° 68-70`).
        // Only the first has a Lingala word behind it, so the other two are listed rather than guessed at.
        // ⚠ AND ITS ABSENT KEY IS THE POINT OF THE ENTRY: ln has SIX unlisted `minus` drops, all genuine
        // negatives (two latitudes, the electron charge, absolute zero, two BCE years). Omitting a minus
        // INVERTS the value, no Lingala word for it is attested, and a known-wrong reading does not get to
        // be a green gate — so `ln.minus` deliberately does not exist and `review.ts --lang ln` stays red.
        // ⚠ AND hsn CLOSES THE PREDICTION THIS FILE MADE. The cjy note below says "Expect it in gan/hak/hsn
        // too" of the romanization-tone-number hazard; hak was the fourth and Xiang is now the FIFTH, from a
        // fifth source — the 湘語羅馬字 tables its incubator carries (/ʃɘ̃⁴⁵/, /mɔ⁴²/). 23 of its 24
        // superscripts are tone numbers and exactly one is an exponent. Its `degree` entry is unrelated and
        // small: one sentence's coordinate bounding box.
        // ps is the FIFTH corpus to produce the scientific-notation false positive (after wuu, nan, cjy and
        // hak produced the romanization-tone-number one from four different sources) — `4.1×10¹⁰ m³`,
        // `2×10³⁰`, `7.2 x 10¹³ jouls/kg`. Its `exponent` entry also records two things worth keeping
        // separate from that: a unit with NO NUMERAL in front of it (`هر km²`, "per every km²"), which is a
        // tier limitation rather than missing data, and a FOOTNOTE MARKER (`يادېږي²`) that is not a power at
        // all. Its `minus` entry is a single EN DASH inside a scientific-notation range (`10¹¹–10¹²`) whose
        // operands end in superscripts, so the range rule cannot reach it — a span, not a negative, and
        // Pashto's true negatives ARE read (`منفي`, sourced ×52 digit-adjacent).
        // ceb has ONE, and it is the only currency in its corpus without a Cebuano name: the yen. Its dollar,
        // euro and pound are all declared and read (`pound` ×3 in `Falkland pound (FKP)`; note `libra` ×5 is
        // the unit of WEIGHT, not the money). `yen` scores ZERO, and ceb cannot fall back to a bigger haystack
        // the way other languages do — ceb.wikipedia is ~99% Lsjbot boilerplate, so an attestation there would
        // be a fact about a template rather than about Cebuano. Listed by instance, never by class.
        // so has two, both "there is no number here for the symbol to attach to": a `+` joining two Greek
        // etymology glosses inside the article on the name Αἰθιοπία, and two superscripts whose base is a word
        // or a variable — `cubo cm³` (where the article writes the Somali reading BESIDE the abbreviation, so
        // the cube is already spoken) and `E = mc²` (whose `=` IS read). ⚠ `bareExponent` is deliberately not
        // declared for so: its superscripts are overwhelmingly units (km² ×93, m³ ×37), which the unit path
        // already handles, and declaring it would buy 26 digit-base powers at the cost of every isotope and
        // designation in the corpus.
        // su's four classes are all "this is not the sign you think it is", and two of them are shapes no
        // other language in this table carries. Its CURRENCY entries are LaTeX MATH DELIMITERS — su.wikipedia
        // quotes `($10^{13}$–$10^{14}$ taun)` from an English physics article, and su/normalize.ts strips the
        // pair so the exponent can be read, after which the scan sees a `$` whose removal changes nothing.
        // Its MATH-SIGN entries are algebra over VARIABLES (`aX + b ~ N(aμ + b, (aσ)²)`, `X+b`, a baseball
        // regression formula) plus an ION CHARGE `(H^+)` and an optical-isomer label `L(+)-asam`: the layer
        // reads `+` before a digit, and widening it to letters would match the reduplication hyphen Sundanese
        // writes constantly (kira-kira, béda-béda, rata-rata). Its MINUS is one IUPAC chemical name, the
        // Burmese compound-hyphen case exactly. Its ITERATION is a Japanese repetition mark QUOTED in an
        // article ABOUT Japanese writing (`Misuzu (みすゞ)`) — a mention, not a use, and Sundanese has no
        // iteration mark to read it with. ⚠ Two `$28.ooUS`/`$60.ooUS` spans are the SOURCE'S OWN TYPO (`.00`
        // mistyped with letter o's); the `$` there IS read, and what the scan sees is the `US` fragment.
        // ⚠ AND gan IS THE SIXTH, WHICH CLOSES THE PREDICTION COMPLETELY — the cjy note above named
        // "gan/hak/hsn"; hak was the fourth, hsn the fifth, and Gan is now the sixth, from a sixth source.
        // gan.wikipedia opens its articles with a NANCHANG PRONUNCIATION GLOSS — `亞細亞洲（南昌話：/ŋa²¹³
        // ɕi³⁵ ŋa²¹³ t͡siiu⁴²/）`, `地球（南昌話：/tʰi¹¹ tɕʰiu²⁴/）` — i.e. the superscripts transcribe the
        // very variety the engine speaks, in the same notation the shipped dict is derived from. Six Sinitic
        // corpora, six independent routes to the same false positive. Its other classes are the family's
        // usual residue (coordinates and compass bearings for `degree`, a Japanese iteration mark, four `$`
        // in one article) plus one shape worth naming: gan's `minus` list is SHORT because the layer READS
        // the real negatives — ⟨負⟩ speaks AND is attested in sense in the corpus's own integer article
        // (`佢個哩嗰負值(-1、-2、-3...)`), which no other lect in this family could say.
        // nya has ONE, and it is the same shape ceb's is: the single currency sign in its corpus with no
        // usable name. Chichewa's dollar and pound are both attested in monetary amounts on ny.wikipedia and
        // are read; its euro scores one hit in one article, and that article is the machine-translated piece
        // the corpus already contains — so the "second haystack" is not independent evidence at all. Listed
        // by instance, never by class. Its minus and math-sign refusals are CLASS-level and live in
        // ACCEPTED_SIGN_SILENCE instead, because every one of those signs in this corpus is EasyTimeline
        // chart markup rather than Chichewa prose.
        // ⚠ AND za IS THE SEVENTH — the FIRST that is not Sinitic at all, which is what makes this a
        // property of the WRITING CULTURE rather than of the language family. za.wikipedia glosses its
        // headwords with Cantonese jyutping, labelled in the text (`Vahgvangjdungh：hung¹ hei³`). It landed
        // in the same sweep as gan, which is why both were authored as "the sixth"; gan is the sixth
        // Sinitic corpus and za the seventh corpus overall.
        // bm's three classes are each "there is nothing here to read": a `‰` whose template lost its
        // figures (three bare signs, no quantity between them), an English press headline's `£` in a
        // citation — the only non-`$` currency sign in the whole bm wiki, and `$` itself IS read — and
        // `m³`, where the cube word is a sourcing block rather than a rule gap (`kube` is attested twice on
        // bm.wikipedia and both hits mean CAPITAL CITY). All three are instance-listed rather than
        // class-silenced so that `km²` and `$`, which the layer DOES read, stay under test.
        // mad's block is the ln shape and is listed here for the same reason ln is: what it does NOT carry
        // is the argument. Its `minus` class stays OUT of ACCEPTED_SIGN_SILENCE because the corpus has two
        // genuine negatives and no Madurese sign word is attested (`korang` ×17 is comparative-phrase-bound),
        // so `review.ts --lang mad` stays red; the three spans named here are an ORDINAL prefix written with
        // a space (`ka -8`, `kapèng -20`) and a coordinate span with a compass phrase between its endpoints.
        // Its `math-sign` entry is the other shape worth naming: a ± the sentence ALREADY spells out
        // (`ra-kèra ±335,28 km²`), i.e. the playbook's trap-12 permissible drop, listed by instance because
        // the unglossed ± IS read (`korang lebbi`) and must stay under test.
        // ht is the SECOND entry after ln whose story is one character doing several jobs on a
        // French-influenced wiki, and it does one MORE than Lingala's three: `°` is the temperature degree
        // (read, `degre Sèlsiyis`), the coordinate/angle degree (read, `degre`), the French NUMERO sign
        // (read as `nimewo` — the one place ht can do what ln could not) and, uniquely here, the BIRTH
        // MARKER of an anniversary list (`aktè fransè (° )`), whose partner `(+ 1987)` is what disqualifies
        // the plus word. So ht's `degree` key is ABSENT — the sign is read — and what it lists instead is
        // the pound (no Haitian name anywhere, while `$`→`dola` IS read), two `km²` whose template lost
        // their figures, and the `=`/`+` of chart markup and a quoted binary addition table.
        // ⚠ AND ht's ABSENT `minus` KEY IS DELIBERATE, for exactly ln's reason: its ten drops include real
        // temperatures (`−20°C`) and the corpus's only candidate word is `mwen`, which is Haitian for "I".
        // A known-wrong silence does not get to be a green gate, so `review.ts --lang ht` stays red.
        // rw's three classes are each a different KIND of correct silence, which is why none of them is a
        // class-level entry: a virus-type designation (`(HIV -1)`, the `चंद्रयान -1` shape), a cent sign that
        // is dump debris inside a Cyrillic transliteration table plus a euro whose only rw.wikipedia hit is
        // the machine-translated article the corpus already contains, and a superscript zero used as a
        // French-style SECTION MARKER (`4⁰ Ihame`) rather than a power. Kinyarwanda's `$`, `FRw` and `km²`
        // are all READ, so instance-listing is what keeps those three readings under test.
        // ⚠ AND rw's SECOND minus is deliberately NOT listed — a genuine negative LATITUDE (`−2.010556`),
        // which keeps `review.ts --lang rw` red on the minus class. Same stance as `ln`: rw reads the
        // negative TEMPERATURE it has an attested phrase for and nothing else, and a bare negative that
        // would INVERT must stay visible.







        // ⚠ AND cdo IS THE EIGHTH — the LAST untreated Sinitic lect, and it closes the romanization-tone
        // prediction for the whole family by producing it from THREE romanizations in one corpus.
        // cdo.wikipedia is itself written in a Latin orthography (Bàng-uâ-cê), and it glosses other
        // varieties inline: Cantonese jyutping (`hoeng¹ gong²`), Min Nan Pe̍h-ōe-jī with Chao digits
        // (`Choân-chiu-oē /t͡suan²⁴⁻²² t͡siu³³ ue⁴¹/`) and its own Fuzhou IPA (`/y⁵³ y³⁵ touŋ³³/`). Eight
        // corpora, and the routes are now: Chao letters (wuu), jyutping quoted (nan, za), the lect's own
        // romanization (cjy, hsn, gan), other varieties glossed (hak), and all three at once (cdo).
        // ⚠ ITS `minus` ENTRY IS THE ln/rw SHAPE AND THE ABSENT SPANS ARE THE POINT: the two genuine
        // temperature negatives (`dăk gáu -15 dô`, `-6~7dô`) are deliberately NOT listed, so
        // `review.ts --lang cdo` stays red on that class. ⟨負⟩ is `hô` on Wiktionary and nothing corroborates
        // it — `attest.ts` returns 49 tokens across 20 articles and every one is a different morpheme (戶 in
        // 戶部 and 獵戶座, 父 in 父部). gan is the only lect in this family that could ship the rule, because
        // its own integer article writes the word beside the glyphs it names; cdo has no such sentence.
        // ⚠ AND ITS `ampersand` ENTRY IS A DIVERGENCE FROM EVERY OTHER SINITIC LAYER, listed by instance for
        // exactly that reason: all six surviving `&` sit inside Latin proper names (`AT&T`, `Thames &
        // Hudson`), where gan had one Han-flanked instance to justify declaring the word. An `&` between two
        // BUC words would report, which is the case that would reverse it.



        // ⚠ sn IS THE THIRD ENTRY (after `ln` and `rw`) WHOSE ABSENT KEYS CARRY THE ARGUMENT. Its `minus`
        // key is deliberately missing — Shona has six GENUINE negatives (coordinates, a debt in dollars, a
        // Kelvin) and two attested candidate words, `hwaradada` and `yakagon'a`, both of which are CONCORDED
        // ADJECTIVES in the frame NOUN + adjective and neither of which fits the operator slot. Omitting a
        // minus inverts a value, so the class stays failing rather than being silenced. Its `exponent` key
        // lists only the two RATE ABBREVIATIONS cited with no number (`(m/s²)`), never the bare-base run
        // `2⁰ … 2¹ … 2²`, which is a real reading declined for want of a class-invariant connective.


        // ⚠ bo IS THE SECOND ENTRY (after `ak`) WHOSE SPANS EXIST BECAUSE THE PROBE CANNOT SEE ITS OWN WORD,
        // and the mechanism is tonal rather than orthographic. Tibetan PREPOSES `བརྒྱ་ཆ` to its figure and the
        // corpus writes the word beside the sign in seven of the retained text's twenty-two percent
        // instances, so tibetan/normalize.ts suppresses its own copy — a permissible drop (trap 12) that is
        // byte-identical with the sign deleted. `isRedundant` probes a bare `25 %`, where `བརྒྱ་ཆ` is
        // word-INITIAL and reads *kʲa˩t͡ɕʰa˥*; in these four the corpus binds it into the phrase before it
        // with a tsheg, so it is NON-INITIAL and Lhasa's word-tone template flattens it to *kʲa˥t͡ɕʰa˥*. One
        // diacritic, and the token test misses a word that is plainly there.
        // ⚠ ITS `minus` KEY IS DELIBERATELY ABSENT, the gn/ln/rw/sn shape: the retained text has a genuine
        // negative (`Ayding Lake (−154m)`, a below-sea-level elevation), omitting a minus INVERTS where
        // omitting a plus is lossless, and Wikidata's bo label for subtraction is the operation NOUN
        // `འཕྲི་རྩིས` rather than anything a reader says between two operands. `review.ts --lang bo` stays red.

        expect(Object.keys(ACCEPTED_SILENT).sort()).toEqual(["ak", "bal", "bar", "bm", "bo", "cdo", "ceb", "cjy", "gan", "gu", "hak", "he", "hi", "hsn", "ht", "jv", "km", "kmr", "kn", "ln", "lo", "mad", "mg", "mos", "mr", "my", "nan", "nya", "ps", "rn", "rw", "si", "sn", "so", "su", "syl", "ta", "ti", "tl", "ug", "wuu", "xh", "za"]);
        // Every entry is a non-empty list of LITERAL strings — a pattern here would defeat the point.
        for (const byClass of Object.values(ACCEPTED_SILENT))
            for (const forms of Object.values(byClass)) {
                expect(forms.length).toBeGreaterThan(0);
                for (const f of forms) expect(typeof f).toBe("string");
            }
    });

    test("classes are independent — an accept for one class never covers another", () => {
        // my accepts a compound-joiner `+` (math-sign) and an apposition `-` (minus) SEPARATELY. Neither may
        // stand in for the other, and no class may borrow a sibling's list.
        expect(isAcceptedSilent("my", "math-sign", "အချိန်+ရပ်ဝန်းထု", MATH)).toBe(true);
        expect(isAcceptedSilent("my", "minus", "အချိန်+ရပ်ဝန်းထု", MINUS)).toBe(false);
        // An UNLISTED word-joining plus in my still reports — the accept names the two spacetime compounds,
        // not the shape.
        expect(isAcceptedSilent("my", "math-sign", "က+ခ", MATH)).toBe(false);
        // xh's accepted stray hyphen is minus-only; its `+` is now VOICED and must not be accepted at all.
        expect(isAcceptedSilent("xh", "math-sign", "kwe +30°C", MATH)).toBe(false);
    });
});
