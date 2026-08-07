/**
 * Nepali (ne) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Nepali REUSES Hindi's abugida engine (`makeNativeHindi`) and, until `overrides` existed, also inherited
 * HINDI's normalizer and HINDI's symbol words. Measured against the ne_np corpus, three of those
 * inherited choices are wrong for Nepali and the rest are right — both halves are recorded here, because
 * "the inherited default is correct" is a result, not an absence of one:
 *
 *   WRONG, overridden here          RIGHT, deliberately kept
 *   ─────────────────────────       ────────────────────────────────────────────────
 *   बजकर / मिनट (clock)             प्रतिशत  — Nepali's own word, corpus ×9 + referee
 *   डॉलर / पाउंड (currency)         डिग्री   — corpus ×3
 *   वाँ/वीं/वें (ordinal suffix)     किलोमीटर / मीटर / मिलीमीटर / किलोग्राम — the ी/ि spelling
 *                                            difference is PHONEMICALLY NULL in Nepali (no vowel
 *                                            length: मीटर and मिटर are both mˈiʈʌɾ), so Hindi's
 *                                            spellings need no override. Only सेंटीमीटर differs
 *                                            (sˈẽɳʈimiʈʌɾ vs sˈenʈimiʈʌɾ) and is owned below.
 *                                   बटा (fraction) — not attested in either ne referee nor the corpus,
 *                                            so it is CARRIED FORWARD unchanged rather than replaced by
 *                                            a guess; 1 corpus instance. See step 12.
 *
 * Measured over the ne_np FLEURS corpus (1,993 unique utterances, column 3):
 *   danda ।  ....................... 2239  (already a clause mark — no rule needed)
 *   ASCII digit runs ...............  729   of which 2-digit ×226, 4-digit ×175, 3-digit ×78, 1-digit ×92
 *   Latin runs (≥2) ................  346  (delegated to the foreign path, as today)
 *   ZWJ U+200D ×69 / ZWNJ U+200C ×35   104  (गर्‍यो ×34, -ुर्‍या ×20 … — SPLIT THE WORD; see step 1)
 *   visarga written as ASCII ':' ...   31   (प्राय: ×24+2, पुन: ×4, अन्तत: ×1)
 *   grouped numbers (1,234) ........   46   (already correct)
 *   decimals .......................   26   (already correct)
 *   clock times h:mm ...............   20   (3 of them SPORTS times mm:ss.hh — not clocks)
 *   ranges N-M .....................   18   (4 of them SPORTS SCORES — see step 11)
 *   ordinal suffix औं/औँ ...........   35   (औँ ×20 and औं ×15; 2 of them on DEVANAGARI digits)
 *   Devanagari unit abbreviations ..   11   (किमी ×6, मिमी ×3, सेमी ×1, कि.मी. ×1)
 *   currency signs .................   11   ($ ×7, ¥ ×3, £ ×1 — 3 of the $ carry a LETTER-CODE prefix)
 *   percent ........................    5
 *   rate `X/घण्टा` .................    3
 *   Devanagari digits ०-९ ..........   19 chars / 8 tokens
 *       NEGATIVE RESULT: the "native digits" lead does NOT hold for Nepali the way it did for Marathi
 *       (×597). It is folded anyway (step 2) because two of the eight are ordinals ("१९ औं") and every
 *       rule below is ASCII-defined — but it is not, on its own, a defect worth a rule.
 *   degrees ° ......................    2
 *   fractions ......................    1
 *   '+' ............................    2   (DELIBERATELY NOT CLAIMED — see step 13)
 *   '~' ............................    1
 *   Devanagari era markers (ई.पू.) .    0   NEGATIVE RESULT: this corpus writes सन् ×50 and the Latin
 *                                           "BCE" ×3 instead, so Hindi's era rule had nothing to do here.
 */
import { indicNumberWords, type NumbersDef } from "../../core/numbers.ts";
import { postposedSign } from "../../core/postposedSign.ts";

/**
 * Suppletive ordinals 1-4 and 9. Nepali's ordinal has ONE form (no gender/number agreement written on it,
 * unlike Hindi's वाँ/वीं/वें or Marathi's वा/वी/वे/व्या), so this is a flat map. All five spellings are
 * ne_np corpus-attested as running words: पहिलो, दोस्रो, तेस्रो, चौथो, नवौं/नवौँ. 9 is here because नौ
 * takes the stem नव- before the suffix; 6 (छैटौं) is NOT here and is NOT invented — it is un-attested in
 * corpus and referee alike, so `ordinal()` returns undefined for 6 and the numeral is left as written.
 */
const IRREGULAR: Readonly<Record<number, string>> = {
    1: "पहिलो", 2: "दोस्रो", 3: "तेस्रो", 4: "चौथो", 9: "नवौं",
};

/**
 * Devanagari unit abbreviations → the full Nepali word, matched only after a digit. The shared symbol
 * tier is keyed on the LATIN abbreviations, which is not what this corpus writes. Longest key first.
 * ⚠ ONLY THE ATTESTED KEYS ARE HERE, because the over-counting trap is live for this script —
 * `ग्रा` occurs 42 times, every one of them inside an ordinary word (ग्राम, ग्राहक, कार्यक्रम …), and
 * `मी` occurs inside मिटर/मिनेट, so neither is declared even though Hindi's table has ग्रा.
 * The spellings follow the corpus's own transliteration convention (किलोमिटर ×18, मिटर ×12,
 * मिलिमिटर ×4 — all with ि). That convention is why सेन्टिमिटर is written thus: unlike the others it is
 * NOT phonemically identical to Hindi's सेंटीमीटर (sˈenʈi- vs sˈẽɳʈi-).
 */
const UNIT_WORD: Readonly<Record<string, string>> = {
    "किमी": "किलोमिटर", "मिमी": "मिलिमिटर", "सेमी": "सेन्टिमिटर", "किग्रा": "किलोग्राम",
};
const UNIT_ALT = Object.keys(UNIT_WORD).sort((a, b) => b.length - a.length).join("|");

/** Rate numerator/denominator words that may be joined by a solidus. A CLOSED LIST on BOTH sides, and
 *  that is the whole point: of the 18 solidi in this corpus only 3 are rates. The rest join two ordinary
 *  words as an "or" (र/वा, गुच्छा/समूह, मा/बाट) — and crucially `100 गज/ मिटर` and `25 गज/मिटर` are
 *  "yards-or-metres", not "yards per metre", so मिटर must NOT be a denominator. */
const RATE_NUM = "किलोमिटर|मिलिमिटर|सेन्टिमिटर|मिटर|माइल|किमी|मिमी|गज";
const RATE_DEN = "घण्टा|सेकेण्ड|सेकेन्ड|मिनेट";
/** The denominators that are genuinely rates. `मिटर` appears in RATE_NUM but not here, by the note above. */
const RATE_DEN_OK = new Set(["घण्टा", "सेकेण्ड", "सेकेन्ड", "मिनेट"]);

/**
 * Currency sign → the Nepali noun. डलर (corpus ×6) and पाउन्ड (corpus ×2) are the two that DIFFER
 * audibly from Hindi's tier: डॉलर is ɖˈɔːlʌɾ where Nepali is ɖˈʌlʌɾ, and पाउंड is paˈũɳɖʌ where Nepali
 * is paˈunɖʌ. युरो is corpus-attested (×1) and is phonemically identical to Hindi's यूरो. येन is carried
 * over from Hindi's tier unchanged — ¥ occurs ×3 and no Nepali source in this repo spells it, but the
 * transliteration is invariant across the Devanagari fleet.
 * ₹ is deliberately ABSENT: it does not occur in this corpus, no ne referee spells the noun, and
 * nepali.jsonc already lists it in `stripSymbols`, so it keeps falling through to be dropped rather than
 * being given a confidently-wrong word.
 */
const CURRENCY: Readonly<Record<string, string>> = {
    "$": "डलर", "£": "पाउन्ड", "€": "युरो", "¥": "येन",
};
/**
 * The number, with a trailing `(?![\d.,])` that is NOT decoration. Without it the currency rules
 * BACKTRACK to a shorter number so that the rest of the pattern can succeed: "$1000 डलर" matched `$100`
 * and emitted "एक सय डलर शून्य डलर". The magnitude had the same problem — see NOUN_TAIL.
 */
const NUM = "\\d+(?:[.,]\\d+)*(?![\\d.,])";
/** Magnitude words that hop over the currency sign — "£27 मिलियन" is said "…मिलियन पाउन्ड". */
const MAGNITUDE_ALT = "मिलियन|बिलियन|ट्रिलियन|खरब|अर्ब|करोड|लाख|हजार";

// Only `$` is a regex metacharacter among the four signs; escaping the others is an *invalid escape* in
// `u` mode rather than a harmless belt-and-braces, which is why the class is built this way.
const CUR_ALT = Object.keys(CURRENCY).map((c) => c.replace(/[$]/gu, "\\$&")).join("|");
const NOUN_ALT = [...new Set(Object.values(CURRENCY))].join("|");
const MAG_TAIL = `(\\s*(?:${MAGNITUDE_ALT})(?![\\p{L}\\p{M}]))?`;
/**
 * The currency noun the text may ALREADY have written out ("$1000 डलर", "AUD$45 मिलियन डलर") — CAPTURED
 * rather than excluded with a negative lookahead. The lookahead version was wrong twice over, both times
 * through backtracking: with `(?!\s*डलर)` after an OPTIONAL magnitude, the engine simply dropped the
 * magnitude from the match so the lookahead would pass, and emitted "पैंतालीस डलर मिलियन डलर". Capturing
 * it means the greedy first attempt already consumes everything and the callback decides.
 */
const NOUN_TAIL = `(\\s*(?:${NOUN_ALT})(?![\\p{L}\\p{M}]))?`;
const CUR_BEFORE = new RegExp(`(${CUR_ALT})\\s?(${NUM})${MAG_TAIL}${NOUN_TAIL}`, "gu");
const CUR_AFTER = new RegExp(`(${NUM})${MAG_TAIL}\\s?(${CUR_ALT})${NOUN_TAIL}`, "gu");

/**
 * The ordinal suffix as a VOWEL SIGN. Nepali's ordinal is written -औं, but that is the INDEPENDENT
 * vowel, correct only at the start of a syllable; joined to a consonant-final cardinal it must become
 * the matra ौ. Getting this wrong is not cosmetic — पन्ध्र + औं spelled the independent vowel produced
 * पन्ध्रऔं [pˈʌnd̪ʱɾʌʌũ], a spurious extra vowel, where पन्ध्रौं is [pˈʌnd̪ʱɾʌũ]. Both anusvara and
 * chandrabindu spellings occur in the corpus and are phonemically identical here.
 */
const SUFFIX_MATRA: Readonly<Record<string, string>> = { "औं": "ौं", "औँ": "ौँ" };
/** Devanagari consonant letters (base + nukta block) — a cardinal ending in one carries the inherent
 *  vowel, which is the condition for taking the matra rather than the independent vowel. */
//  Written with codepoint escapes, not literals: the nukta letters क़…य़ (U+0958–U+095F) have canonically
//  DECOMPOSED spellings, and a decomposed literal in the source turns the range into "क + ़ - य + ़",
//  which is a `Range out of order` SyntaxError at load.
const DEV_CONSONANT_FINAL = /[\u0915-\u0939\u0958-\u095f]$/u;

/**
 * The visarga adverbs, written in this corpus with an ASCII colon (प्राय: ×24, प्राय:जसो ×2, पुन: ×4,
 * अन्तत: ×1 = 31). A CLOSED LIST, not the pattern `त:` — the corpus also contains ~20 genuine list
 * colons at exactly the same position (छ: ×5, छन्: ×2, हो:, भने:, गर्छन्:, कारक: …) which must stay
 * phrase breaks. Left alone, प्राय: read as [pɾˈaj ,] — a spurious mid-sentence pause plus a truncated
 * word; folded to प्रायः it reads [pɾˈajʌh].
 */
const VISARGA_WORD_ALT = ["प्राय", "पुन", "अन्तत", "मुख्यत", "विशेषत", "सामान्यत", "स्वत"].join("|");

/** Build the Nepali normalizer. Takes the numbers definition so the ordinal, clock, range and fraction
 *  rules compose their cardinals from exactly the data the engine's own number path uses. */
export function makeNepaliNormalizer(numbers: NumbersDef): (text: string) => string {
    const cardinal = (n: number): string[] => indicNumberWords(n, numbers).map((w) => w ?? "");
    const cardinalText = (n: number): string => cardinal(n).join(" ");

    /**
     * The ordinal. Nepali attaches -औं to the cardinal and the suffix JOINS its final word — पन्ध्र + औं
     * is ONE word, पन्ध्रौं [pˈʌnd̪ʱɾʌũ]. Emitting them apart is what the inherited engine did, and it
     * made [ˈʌũ] a stray stressed syllable in all 15 corpus instances. The suffix as WRITTEN is reused
     * (औं and औँ both occur; they are phonemically identical here, so echoing the text is free).
     */
    const ordinal = (n: number, suffix: string): string | undefined => {
        const irr = IRREGULAR[n];
        if (irr !== undefined) return irr;
        if (n === 6) return undefined; // छैटौं is un-attested in this repo's ne data — do not invent it
        const words = cardinal(n);
        if (words.length === 0 || words.some((w) => w === "")) return undefined;
        const last = words[words.length - 1]!;
        const join = DEV_CONSONANT_FINAL.test(last) ? SUFFIX_MATRA[suffix] ?? suffix : suffix;
        words[words.length - 1] = `${last}${join}`;
        return words.join(" ");
    };

    /**
     * H:MM → the Nepali clock. बजे is corpus-attested ×10 and referee-attested; मिनेट ×7 and
     * referee-attested. Hindi's बजकर and मिनट are neither, and were being spoken into Nepali output in
     * all 17 non-sports instances. बजेर is the regular -एर conjunctive participle of that same
     * corpus-attested बज- stem (the engine derives it by rule: bˈʌd͡zeɾ); it is the one form here that is
     * inflected rather than looked up, and it is flagged as such.
     * At :00 the minutes drop and बजे is exactly right.
     */
    const clock = (h: number, min: number): string =>
        min === 0 ? cardinalText(h) : `${cardinalText(h)} बजेर ${cardinalText(min)} मिनेट`;

    return (input: string): string => {
        let s = input;

        // 1) ZWJ / ZWNJ. FIRST, for two reasons. (a) U+200D is category Cf — neither \p{L} nor \p{M} —
        //    so it silently defeats every `(?<![\p{L}\p{M}])` guard used below. (b) `core/unicode.ts`
        //    DEVANAGARI_WORD excludes it, so the tokenizer SPLIT THE WORD: गर्‍यो came out [ɡˈʌɾ jˈo],
        //    two tokens with two stresses, where गर्यो is [ɡˈʌɾjo]. 104 instances and by count the
        //    single largest defect in this corpus after the numbers. Stripping is orthographically
        //    lossless — the ZWJ only requests the eyelash-ra glyph.
        s = s.replace(/[‌‍]/gu, "");

        // 2) DEVANAGARI DIGITS → ASCII. Before every rule that follows, all of which are ASCII-defined.
        //    Only 19 characters in this corpus (the Marathi lead does not carry), but two of the eight
        //    tokens are ordinals — "१९ औं", "२० औं" — which step 6 could not otherwise see. The engine's
        //    own number() already folds these, so doing it here is loss-free.
        s = s.replace(/[०-९]/gu, (d) => String(d.charCodeAt(0) - 0x0966));

        // 3) VISARGA written as ASCII ':', BEFORE the clock rules in step 7 — they compete for the same
        //    character. Word-INTERNAL is unambiguous (प्राय:जसो; a list colon is always followed by a
        //    space or end of string). Word-FINAL needs the closed list, per the note at VISARGA_WORD_ALT.
        s = s.replace(/(?<=[ऀ-ॣॲ-ॿ]):(?=[ऀ-ॣॲ-ॿ])/gu, "ः");
        s = s.replace(
            new RegExp(`(?<![\\p{L}\\p{M}])(${VISARGA_WORD_ALT}):(?![\\p{L}\\p{M}])`, "gu"),
            "$1ः",
        );

        // 4) MULTI-DOT ABBREVIATIONS, before the single-dot rule in step 5 — otherwise the interior dot
        //    survives as a phrase break, which is exactly what it was doing: "1600 कि.मी. को" read
        //    [kˈi . mˈi . kˈo], two spurious pauses and two truncated words. यु.एस. and डब्ल्यु. are
        //    Devanagari transliterations of U.S. and W.; their letter names are already the right
        //    reading, so only the dots are removed.
        s = s.replace(/(?<![\p{L}\p{M}])कि\.\s?मी\.?/gu, "किलोमिटर");
        s = s.replace(/(?<![\p{L}\p{M}])यु\.\s?एस\.?/gu, "यु एस");
        s = s.replace(/(?<![\p{L}\p{M}])(डब्ल्यु|डब्ल्यू)\.(?=\s)/gu, "$1");

        // 5) ABBREVIATIONS. डा. is the only Devanagari one in this corpus (×4, always with the dot);
        //    डाक्टर is the corpus's own spelling of the expansion (×1). The dot is consumed so it cannot
        //    become a phrase break, and the rule requires a following word so a sentence-final डा. — of
        //    which there are none, checked — could not swallow a real sentence boundary.
        s = s.replace(/(?<![\p{L}\p{M}])डा\.(\s+)(?=[\p{L}])/gu, "डाक्टर$1");

        // 6) ORDINALS. Before the clock in step 7 only incidentally (they cannot collide), but AFTER the
        //    digit fold in step 2, which is what lets "१९ औं" match at all.
        //    THE TRAILING BOUNDARY IS THE WHOLE RULE, as in every language that inherited Hindi's
        //    unguarded version: without `(?![\p{L}\p{M}])` the suffix alternative would bite into the
        //    start of a following word. The leading `(?<![\d.,:])` keeps it off a clock's minute field.
        //    The numeral alternative accepts a COMMA-GROUPED number first: the corpus writes "1,000 औँ
        //    टिकट", and with a bare `(\d+)` the leading `(?<![\d.,:])` guard refused the "000" and the
        //    whole match failed, leaving [ˈek ɦˈʌd͡zaɾ ˈʌũ] with the suffix stranded.
        s = s.replace(
            /(?<![\d.,:])(\d{1,3}(?:,\d{3})+|\d+)\s?(औं|औँ)(?![\p{L}\p{M}])/gu,
            (whole, digits: string, suffix: string) => {
                const n = Number(digits.replace(/,/gu, ""));
                return Number.isSafeInteger(n) ? ordinal(n, suffix) ?? whole : whole;
            },
        );

        // 7) TIMES. Three rules, and the guards between them are the point.
        //    7a) SPORTS times mm:ss.hh — 4:41.30, 2:11.60, 1:09.02 (×3, all in swimming results, all
        //        followed by मिनेट). These are NOT clocks. Hindi's inherited clock rule claimed them
        //        (its `(?![\d:])` permits a following dot) and produced "चार बजकर एकचालीस मिनट . तीस" —
        //        a bogus clock, two Hindi words, and a spurious phrase break. Dropping the colon leaves
        //        two plain numbers, the honest reading, which nothing downstream can re-claim.
        s = s.replace(/(?<![\d.,:])(\d{1,2}):(\d{2}\.\d{1,2})(?![\d:])/gu, "$1 $2");
        //    7b) A time RANGE h:mm-h:mm, before the clock proper so both endpoints survive as times and
        //        before the numeric range rule in step 11, whose `(?<![\d.,:])` guard would in any case
        //        refuse it. One instance ("10:00-11:00 राती"); without this the hyphen was dropped
        //        silently and the two clocks were simply juxtaposed.
        s = s.replace(
            /(?<![\d.,:])((?:[01]?\d|2[0-3]):[0-5]\d)\s?[-–—]\s?((?:[01]?\d|2[0-3]):[0-5]\d)(?![\d:.])/gu,
            "$1 देखि $2",
        );
        //    7c) The clock proper. `(?![\d:.])` refuses 7a's leftovers and any h:mm:ss. A following बजे
        //        is CONSUMED when the minutes are spoken, because बजेर already carries its sense — 9 of
        //        the 15 clocks in this corpus are written "9:30 बजे" and the alternative is a duplicate.
        //        At :00 बजे is exactly right and is supplied when absent — but NOT when the next word is
        //        another बज- form, or "11:00 बजेपछि" would become "एघार बजे बजेपछि" — ⚠ the duplicate-word
        //        trap that bites any language whose clock noun can also begin the following word.
        s = s.replace(
            /(?<![\d:.])([01]?\d|2[0-3]):([0-5]\d)(?![\d:.])(\s*बजे(?![\p{L}\p{M}]))?/gu,
            (m, h: string, min: string, baje: string | undefined, offset: number, whole: string) => {
                const body = clock(Number(h), Number(min));
                if (Number(min) !== 0) return body;
                const rest = whole.slice(offset + m.length);
                return baje || !/^\s*बज/u.test(rest) ? `${body} बजे` : body;
            },
        );

        // 8) DEGREES, before the signs and before the unit rules so the ° still has its digit adjacent.
        //    डिग्री is Hindi's word and is ALSO Nepali's (corpus ×3) — kept. What was broken is the
        //    SCALE letter: Hindi's rule has `(?![\p{L}])`, and this corpus writes "+30°Cभन्दा" with a
        //    Devanagari letter immediately after the C, so the rule failed and the C was read as the
        //    English letter name [sˈiː]. The guard here is `(?![A-Za-z])` — a following Devanagari
        //    letter is a postposition, not part of the scale. The compass directions are claimed too:
        //    "35°W" was reading [ɖˈiɡɾi dˈʌbəɫjuː].
        //    THE TRAILING SPACE in each replacement is load-bearing for the same reason: "+30°Cभन्दा"
        //    has a Devanagari postposition welded to the C, and without it सेल्सियस and भन्दा became one
        //    token [selsijʌsbʱˈʌnd̪a]. The double-space collapse at step 13 cleans up the rest.
        // THE SIGNS. प्लस is the reading for a signed quantity (`UTC+1`, `+30°C`). The degree rule below
        //    re-emits the digit it captures, so the two are order-independent.
        //
        //    ⚠ WHETHER A MINUS RULE IS SAFE IS A FACT ABOUT THE TEXT, NOT ABOUT THE GUARD. The shape no guard
        //    can reject is `word · space · hyphen · digit`, indistinguishable from a spaced range or a dashed
        //    designation; a language whose text contains that shape must decline the rule outright. Nepali
        //    text of this kind does not contain it, so a guarded rule is safe HERE and nowhere by default.
        //
        //    THREE GUARDS: a digit immediately after the sign (rejects `- 2`), a letter or digit immediately
        //    before (rejects closed designations), and a digit ANYWHERE to the left — that last one rejects a
        //    SPACED range or score, which the usual guard misses.
        //
        //    SOURCED: ne.wikipedia NAMES THE SIGN — "घटाउ (जुन माइनस चिन्ह ⟨−⟩द्वारा सङ्केत गरिन्छ)": subtraction,
        //    denoted by the MINUS SIGN ⟨−⟩. The same article pairs it with प्लस, so ± is those two juxtaposed.
        s = s.replace(/±/gu, " प्लस माइनस ");
        s = s.replace(/(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)/gu, (m0: string, off: number, whole: string) =>
            /\d\s*$/u.test(whole.slice(0, off)) ? m0 : "माइनस ");
        s = s.replace(/(\S)\+\s?(?=\d)/gu, "$1 प्लस ");
        s = s.replace(/(^|\s)\+\s?(?=\d)/gu, "$1प्लस ");

        // THE RELATIONAL AND DIVISION SIGNS, all four attested in running Nepali text:
        //   `बराबर`    "यस आकार अनुपातको बराबर" — EQUAL TO this aspect ratio
        //   `भन्दा कम` · `भन्दा बढी`             — both postposed, both with real operands
        //   `विभाजन`   "बाह्रलाई विभाजन गरेर"    — a division performed aloud
        //
        // ⚠ THE COMPARATIVES ARE POSTPOSITIONAL and भन्दा FUSES to the standard (सामान्यभन्दा धेरै), so they
        // use core/postposedSign.ts — an infix rule would read the comparison BACKWARDS. The equality and
        // division read infix.
        s = postposedSign(s, "<", "भन्दा कम");
        s = postposedSign(s, ">", "भन्दा बढी");
        s = s.replace(/\s?=\s?/gu, " बराबर ");
        s = s.replace(/\s?÷\s?/gu, " विभाजन ");

        s = s.replace(/(\d)\s?°\s?C(?![A-Za-z])/gu, "$1 डिग्री सेल्सियस ");
        s = s.replace(/(\d)\s?°\s?F(?![A-Za-z])/gu, "$1 डिग्री फरेनहाइट ");
        s = s.replace(/(\d)\s?°\s?N(?![A-Za-z])/gu, "$1 डिग्री उत्तर ");
        s = s.replace(/(\d)\s?°\s?S(?![A-Za-z])/gu, "$1 डिग्री दक्षिण ");
        s = s.replace(/(\d)\s?°\s?E(?![A-Za-z])/gu, "$1 डिग्री पूर्व ");
        s = s.replace(/(\d)\s?°\s?W(?![A-Za-z])/gu, "$1 डिग्री पश्चिम ");
        s = s.replace(/(\d)\s?°/gu, "$1 डिग्री ");

        // 9) CURRENCY, owned locally rather than through the shared tier for two measured reasons.
        //    (a) THE TIER CANNOT SEE A LETTER-CODE PREFIX. Its currency pattern is guarded with
        //        `(?<![\p{L}\p{M}])` before the sign, so "US$14.7", "US$30" and "AUD$45" matched
        //        nothing — and because `$` is in neither `symbols` nor `stripSymbols` in nepali.jsonc,
        //        the sign was then dropped by the tokenizer with no trace. Silent content loss, ×3.
        //        Reported as a core limitation; handled here by not requiring that lookbehind.
        //    (b) THE NOUN MAY ALREADY BE IN THE TEXT: "$1000 डलर" and "AUD$45 मिलियन डलर" both write it
        //        out, and adding another produced [ɖˈɔːlʌɾ ɖˈʌlʌɾ]. The trailing lookahead suppresses
        //        the duplicate.
        //    The sign is pre-posed in 5 of 7 instances and post-posed in 2 ("5$ र 100$"); both orders
        //    emit the noun after the number, which is the Nepali reading either way.
        const money = (n: string, mag: string | undefined, sign: string, noun: string | undefined) =>
            `${n}${mag ?? ""}${noun ?? ` ${CURRENCY[sign]!}`}`;
        s = s.replace(CUR_BEFORE, (_m, sign: string, n: string, mag?: string, noun?: string) =>
            money(n, mag, sign, noun));
        s = s.replace(CUR_AFTER, (_m, n: string, mag: string | undefined, sign: string, noun?: string) =>
            money(n, mag, sign, noun));

        // 10) UNITS. After the clock (step 7) so nothing looking for a bare number can claim a time, and
        //     before the fraction rule in step 12, whose solidus would otherwise compete with the rate
        //     form. Two sub-rules, in this order.
        //     10a) Devanagari abbreviations after a digit. `(?![\p{L}\p{M}])` after the key is what keeps
        //          मिमी out of longer words; the abbreviation may be followed by `/` (see 10b), which is
        //          neither a letter nor a mark, so the guard still admits it.
        //          THE SQUARED FORM FIRST, or this rule consumes the abbreviation and strands the `²` — the
        //          ordering coupling bg, is and sd all record for the same shape. The corpus writes
        //          `19,500 किमि²`, and once `किमी` became `किलोमिटर` the tier had a WORD before the `²` with no
        //          digit adjacency left, so the exponent was dropped and the area read as a length. वर्ग goes
        //          BEFORE the noun here, which is the position the tier declares and the corpus attests
        //          (`3,850 वर्ग किलोमिटर`).
        s = s.replace(
            new RegExp(`(\\d)\\s?(${UNIT_ALT})(?:\\s?²|2)(?![\\p{L}\\p{M}\\d])`, "gu"),
            (_m, d: string, u: string) => `${d} वर्ग ${UNIT_WORD[u]!}`,
        );
        s = s.replace(
            new RegExp(`(\\d)\\s?(${UNIT_ALT})(?![\\p{L}\\p{M}])`, "gu"),
            (_m, d: string, u: string) => `${d} ${UNIT_WORD[u]!}`,
        );
        //     10b) RATES. प्रति is the corpus's own connective — it writes "माइल प्रति घण्टा" in full
        //          ×2 and the solidus form ×3. The SPACE after the solidus is not optional to allow:
        //          the corpus writes "165 किमी/ घण्टा" exactly so. Both sides are closed lists; see the
        //          note at RATE_NUM for why मिटर is a numerator but never a denominator.
        s = s.replace(
            new RegExp(
                `(?<![\\p{L}\\p{M}])(${RATE_NUM})\\s*/\\s*(${RATE_DEN})(?![\\p{L}\\p{M}])`,
                "gu",
            ),
            (whole, num: string, den: string) =>
                RATE_DEN_OK.has(den) ? `${UNIT_WORD[num] ?? num} प्रति ${den}` : whole,
        );

        // 11) RANGES N-M → "N देखि M". THE ASCENDING GUARD IS EVIDENCE, NOT CAUTION, and the ne_np corpus
        //     reproduces the Marathi finding exactly: of the 17 remaining hyphenated number pairs, four
        //     are sports results — 5-3 (a hockey win), 7-2 (a head-to-head record), 6-6 (a tie-break),
        //     26-00 (a rugby scoreline) — where "देखि" ("from") is simply wrong and the silent hyphen the
        //     engine already produces is right. Every one of those four is descending or equal; every
        //     genuine range (1894-1895, 35-40 माइल, 56-64, 2-3 किलोमिटर, 100-200, 1644-1912, 1418-1450,
        //     1469–1539, 120–160) is ascending. So the rule fires only when b > a: 12 gained, 0 broken,
        //     1 real range deliberately missed (4.2-3.9 "million years ago", which descends).
        //     THE TRAILING GUARD ALSO REFUSES AN EXISTING देखि. "सन् 1995-1996 देखि" already carries the
        //     postposition and would otherwise read "…छयानब्बे देखि देखि" — the same duplicate-word trap
        //     as step 7c.
        s = s.replace(
            /(?<![\d.,:])(\d+(?:\.\d+)?)\s?[-–—]\s?(\d+(?:\.\d+)?)(?![\d.,:])(?!\s*देखि(?![\p{L}\p{M}]))/gu,
            (m, a: string, b: string) => (Number(b) > Number(a) ? `${a} देखि ${b}` : m),
        );

        // 12) FRACTIONS. One instance, "5 मिलिमिटर (1/5 इन्च)". बटा is INHERITED FROM HINDI and is not
        //     attested for Nepali — but neither is any alternative, so ⚠ it is carried forward VERBATIM
        //     rather than replaced by a guess: an unsourced substitute is worse than an inherited word.
        //     It has to be restated here because supplying this normalizer stops Hindi's from running,
        //     and without the rule "1/5" would read as two unrelated numbers.
        s = s.replace(/(?<![\d.,])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) => {
            const nw = cardinalText(Number(a)), dw = cardinalText(Number(b));
            return nw === "" || dw === "" ? m0 : `${nw} बटा ${dw}`;
        });

        // 13) THE APPROXIMATION TILDE. लगभग is Nepali's own word for it. (Plus and minus are claimed in
        //     step 8, not here.)
        s = s.replace(/~\s?(?=\d)/gu, "लगभग ");
        s = s.replace(/ {2,}/gu, " ");

        return s;
    };
}
