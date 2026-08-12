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
        expect(Object.keys(ACCEPTED_SILENT).sort()).toEqual(["ceb", "cjy", "gan", "gu", "hak", "hi", "hsn", "jv", "km", "kmr", "kn", "ln", "lo", "mg", "mr", "my", "nan", "nya", "ps", "si", "so", "su", "ta", "tl", "wuu", "xh", "za"]);
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
