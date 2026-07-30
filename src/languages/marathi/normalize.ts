/**
 * Marathi (mr) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Marathi shares Hindi's script and Hindi's abugida engine (`makeNativeHindi`), but NOT Hindi's
 * orthographic conventions, and the two diverge in every tier this file touches: Marathi writes the
 * percent as टक्के (not प्रतिशत), the clock as वाजून/वाजता (not बजकर/बजे), the ordinal suffix as
 * -व्या/-वा/-वी/-वे with its own suppletive 1-4, and — the one that mattered most — it writes a large
 * fraction of its numbers in DEVANAGARI DIGITS, which every ASCII-defined rule in the fleet misses.
 *
 * Measured over the mr_in FLEURS corpus (1,992 unique utterances, column 3):
 *   Devanagari digits ०-९ .......... 597   (the "native digits" lead HOLDS here, unlike hi/bn/ur)
 *   two-digit numbers .............. 233   (every one of them mis-read — see marathi.jsonc `compound`)
 *   four-digit years ............... 171
 *   three-digit numbers ............  76
 *   ordinal suffixes (व्या/वा/वे) ...  45
 *   grouped numbers (1,234) ........  46
 *   ZWJ inside a word .............. 66   (्‍य ×45, अ‍ॅ ×21 — split the word in the tokenizer)
 *   ASCII ':' written for visarga ..  ~42  (विशेषत: ×12, स्वत:* ×17, सामान्यत: ×9 …)
 *   decimals .......................  29
 *   Devanagari unit abbreviations ..  32   (किमी, मिमी, मी, किमी/तास, किमी²)
 *   clock times h:mm ...............  17   (3 of which are SPORTS times 4:41.30 — not clocks)
 *   ranges N-M .....................  17   (4 of which are SPORTS SCORES — see step 12)
 *   currency signs .................  11   ($ ×7, ¥ ×3, € ×1 — 7 of them on Devanagari digits)
 *   percent ........................   5
 *   fractions ......................   3
 *   era markers इ.स.पू. ............   4
 *   डॉ. ............................   6
 *   degrees ° ......................   2
 *   danda ।/॥ ......................   0   (NEGATIVE RESULT: the Marathi corpus uses the ASCII period)
 *
 * A NOTE ON THE SHARED ENGINE, which shapes several rules below. `makeNativeHindi` applies HINDI's
 * normalizer and HINDI's symbol tier unconditionally to all seven languages that reuse it, and there is
 * no seam to pass a different one. So this pass runs FIRST and must leave nothing behind that Hindi's
 * pass can claim — every rule here is written to consume its input completely. Where that forced a rule
 * into a shape it would not otherwise take, it is called out at the step (5, 7, 12).
 */
import { indicNumberWords, type NumbersDef } from "../../core/numbers.ts";

/** Ordinal suffixes → the agreement slot they mark. Marathi attaches these to the cardinal (सोळावा,
 *  पंधराव्या) and the suffix itself carries the agreement, so it is read off the text, not guessed.
 *  Corpus: व्या ×36 (oblique, by far the most common — "१६व्या शतकात"), वा ×6, वे ×3. Longest first. */
const SUFFIX_FORM: Readonly<Record<string, 0 | 1 | 2 | 3>> = {
    "व्या": 3, "वा": 0, "वी": 1, "वे": 2,
};
const SUFFIX_ALT = Object.keys(SUFFIX_FORM)
    .sort((a, b) => b.length - a.length)
    .join("|");

/** Suppletive ordinals 1-4, indexed [masc, fem, plural/neuter, oblique]. Marathi's differ from Hindi's
 *  (पहिला not पहला, तिसरा not तीसरा, and the oblique is -ऱ्या not -े). 5 upward are regular: the
 *  cardinal stem plus the suffix. All four rows are corpus-attested (पहिल्या ×21, दुसऱ्या ×18,
 *  तिसऱ्या ×2, चौथ्या ×1, चौथा ×2). */
const IRREGULAR: Readonly<Record<number, readonly [string, string, string, string]>> = {
    1: ["पहिला", "पहिली", "पहिले", "पहिल्या"],
    2: ["दुसरा", "दुसरी", "दुसरे", "दुसऱ्या"],
    3: ["तिसरा", "तिसरी", "तिसरे", "तिसऱ्या"],
    4: ["चौथा", "चौथी", "चौथे", "चौथ्या"],
};

/** Devanagari consonant letters (base + nukta block) — used to test whether a cardinal ends in a bare
 *  consonant, which is what conditions the ordinal's linking -आ- (साठ → साठावा). */
const DEV_CONSONANT_FINAL = /[क-हक़-य़]$/u;

/**
 * Devanagari unit abbreviations → the full Marathi word. The shared symbol tier
 * (`core/normalizeSymbols.ts`) is keyed on the LATIN abbreviations, which is not what this corpus
 * writes: किमी ×14, मिमी ×8, मी ×3, किमी/तास ×3, किमी² ×2, मिमी2 ×1. Unexpanded, किमी was read as a
 * word, [kˈɪmiː]. The Latin `km²`/`mm2` forms are here too because Hindi's symbol tier declares no
 * `exponentWords`, so its ² was dropped silently. Longest key first (किमी/तास must beat किमी).
 * चौरस = "square", and it PRECEDES the unit in Marathi (चौरस किलोमीटर), unlike Italian/Polish.
 */
const UNIT_WORD: Readonly<Record<string, string>> = {
    "किमी/ताशी": "किलोमीटर ताशी", // ताशी already means "per hour"; प्रति would double it
    "किमी/तास": "किलोमीटर प्रति तास",
    "मी/से": "मीटर प्रति सेकंद",
    "किमी²": "चौरस किलोमीटर", "किमी2": "चौरस किलोमीटर",
    "सेमी²": "चौरस सेंटीमीटर", "सेमी2": "चौरस सेंटीमीटर",
    "मिमी²": "चौरस मिलीमीटर", "मिमी2": "चौरस मिलीमीटर",
    "मी²": "चौरस मीटर", "मी2": "चौरस मीटर",
    "किमी": "किलोमीटर", "सेमी": "सेंटीमीटर", "मिमी": "मिलीमीटर",
    "किग्रॅ": "किलोग्रॅम", "ग्रॅ": "ग्रॅम",
    "मी": "मीटर",
    "km²": "चौरस किलोमीटर", "km2": "चौरस किलोमीटर",
    "m²": "चौरस मीटर", "cm²": "चौरस सेंटीमीटर",
    "mm²": "चौरस मिलीमीटर", "mm2": "चौरस मिलीमीटर",
    // The plain Latin units too. Hindi's shared tier already renders these and its words happen to be
    // Marathi's as well, but the bare-hundred rewrite in step 14 turns `100 km` into `शंभर km`, which
    // that tier can no longer match (its NUM is a digit run) — the Latin would have been stranded and
    // read out as letter names. Owning them here settles the ordering. Single-letter `m` is deliberately
    // NOT here: the playbook's `rateDenominators` note records a one-letter unit matching an
    // alphanumeric designation, and this corpus's only `100m`/`200m` are swim events, 2 instances.
    "km": "किलोमीटर", "cm": "सेंटीमीटर", "mm": "मिलीमीटर", "kg": "किलोग्रॅम",
};
const UNIT_ALT = Object.keys(UNIT_WORD)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"))
    .join("|");

/** Currency sign → the Marathi noun. डॉलर and येन are the fleet spellings; युरो and पौंड are the
 *  Marathi ones (Hindi's tier says यूरो / पाउंड) — both are corpus-attested here as युरोज ×1 and
 *  पौंड ×2 / पाउंड ×3. */
const CURRENCY: Readonly<Record<string, string>> = {
    "$": "डॉलर", "€": "युरो", "¥": "येन", "£": "पौंड", "₹": "रुपये",
};

/** Magnitude words that hop over the currency sign — "$२.३ बिलियन" is said "…बिलियन डॉलर". */
const MAGNITUDE_ALT = "बिलियन|ट्रिलियन|मिलियन|दशलक्ष|अब्ज|कोटी|लाख|हजार";

/** The -तः adverbs, written in this corpus with an ASCII colon for the visarga (विशेषत: ×12,
 *  सामान्यत: ×9, स्वत: ×3, साधारणत: ×2, संभाव्यत: ×1, अंशत: ×1). A CLOSED LIST, not the pattern
 *  `त:` — that would also claim the genuine list colons in आहेत: ×5 and करतात: ×1, turning a phrase
 *  break into a stray [h]. */
const TAH_ADVERB_ALT = [
    "विशेषत", "सामान्यत", "साधारणत", "संभाव्यत", "मुख्यत", "अंशत", "स्वत", "दुख",
].join("|");

/** Build the Marathi normalizer. Takes the numbers definition so the ordinal and clock rules compose
 *  their cardinals from the same data the engine's own number path uses. */
export function makeMarathiNormalizer(
    numbers: NumbersDef,
): (text: string) => string {
    /** Integer → its Marathi cardinal words, exactly as the engine's number path would render them. */
    const cardinal = (n: number): string[] =>
        indicNumberWords(n, numbers).map((w) => w ?? "");
    const cardinalText = (n: number): string => cardinal(n).join(" ");

    const UNITS = new Set(numbers.units);
    const TEENS = new Set(numbers.teens ?? []);

    /**
     * The ordinal STEM of the last cardinal word. Marathi's ordinal is the cardinal plus -वा/-वी/-वे/-व्या,
     * but the stem alternates and the alternation is conditioned by which slot the word came from:
     *   units and teens take the suffix bare .... पाच→पाचवा, आठ→आठवा, सोळा→सोळावा, अठरा→अठराव्या
     *   -ीस shortens to -िसा ..................... वीस→विसावा, एकोणीस→एकोणिसावा, सदतीस→सदतिसावा
     *   other consonant-final tens/compounds/
     *     magnitudes take a linking -आ- .......... साठ→साठावा, नव्वद→नव्वदावा, हजार→हजारावा, चोपन्न→चोपन्नाव्या
     *   vowel-final ones take it bare ............ ऐंशी→ऐंशीवा, कोटी→कोटीवा
     * The unit/teen test is what keeps आठ (8, आठवा) apart from साठ (60, साठावा) — they are homographs
     * at the suffix and cannot be told apart by spelling alone.
     */
    const ordinalStem = (w: string): string => {
        if (w === numbers.magnitudes.hundred) return "शंभरा"; // शे is the combining form; the ordinal is शंभरावा
        if (w === "नऊ") return "नव"; // 9 → नववा, the one unit with a stem change
        if (/ीस$/u.test(w)) return w.replace(/ीस$/u, "िसा");
        if (UNITS.has(w) || TEENS.has(w)) return w;
        return DEV_CONSONANT_FINAL.test(w) ? `${w}ा` : w;
    };

    const ordinal = (
        n: number,
        form: 0 | 1 | 2 | 3,
        suffix: string,
    ): string | undefined => {
        const irr = IRREGULAR[n];
        if (irr !== undefined) return irr[form];
        const words = cardinal(n);
        if (words.length === 0 || words.some((w) => w === "")) return undefined;
        // The suffix JOINS the final cardinal word — सोळा + व्या is ONE word, सोळाव्या. Emitting them
        // apart is what the engine did before this file existed, and it made [ʋjˈaː] a stray syllable.
        words[words.length - 1] = `${ordinalStem(words[words.length - 1]!)}${suffix}`;
        return words.join(" ");
    };

    /** H:MM → the Marathi clock. वाजून is the equivalent of Hindi बजकर; at :00 the minutes drop and
     *  the postposition is वाजता (never बजे). */
    const clock = (h: number, min: number): string =>
        min === 0
            ? cardinalText(h)
            : `${cardinalText(h)} वाजून ${cardinalText(min)} मिनिटे`;

    return (input: string): string => {
        let s = input;

        // 1) ZWJ / ZWNJ, and the अ‍ॅ digraph. FIRST, because U+200D is category Cf — neither \p{L} nor
        //    \p{M} — so it silently defeats every `(?<![\p{L}\p{M}])` boundary guard used below, and
        //    because `core/unicode.ts` DEVANAGARI_WORD ("ऀ-ॣॲ-ॿ") excludes it: आपल्‍या tokenized as two
        //    words, आपल् + या → [ˈaːpəl jˈaː]. 66 instances. Stripping it is orthographically lossless.
        //    अ‍ॅ / अॅ is the Marathi spelling of the loan vowel /æ/ and is folded to ऍ (candra e), which
        //    the manifest already maps to ɛː; left as अ + ॅ it read as two vowels [ə ɛː].
        s = s.replace(/अ[‌‍]?ॅ/gu, "ऍ").replace(/अ[‌‍]?ॉ/gu, "ऑ");
        s = s.replace(/[‌‍]/gu, "");

        // 2) DEVANAGARI DIGITS → ASCII. Second, and before EVERY rule that follows, because all of them
        //    — and the shared symbol tier, whose NUM is `\d+(?:[ ]\d{3}|[.,]\d+)*` — are ASCII-defined.
        //    597 native digits in this corpus, and without this step the consequences were silent:
        //    `$२२,५००` lost its डॉलर entirely (the sign is in neither `symbols` nor `stripSymbols`, so
        //    the tokenizer simply never emitted it), `३५°` dropped its degree sign, `१५व्या` kept its
        //    stray suffix syllable and `१/२` read as "एक दोन". The engine's own number() already folds
        //    these digits to ASCII, so doing it here is loss-free.
        s = s.replace(/[०-९]/gu, (d) => String(d.charCodeAt(0) - 0x0966));

        // 3) The two colon/visarga confusions, both before the clock rule in step 7 (they compete for
        //    the same characters).
        //    3a) ः (visarga) written where a clock colon was meant: ११ः०० वाजता ×1, १ः२ ×1, १ः० ×1.
        s = s.replace(/(\d)ः(\d)/gu, "$1:$2");
        //    3b) ASCII ':' written where a visarga was meant. Word-INTERNAL is unambiguous (स्वत:चे —
        //        a list colon is always followed by a space). Word-FINAL needs the closed adverb list.
        s = s.replace(/(?<=[ऀ-ॣॲ-ॿ]):(?=[ऀ-ॣॲ-ॿ])/gu, "ः");
        s = s.replace(
            new RegExp(`(?<![\\p{L}\\p{M}])(${TAH_ADVERB_ALT}):(?![\\p{L}\\p{M}])`, "gu"),
            "$1ः",
        );

        // 4) ERA MARKERS, before the abbreviation rule in step 5 so a bare इ. / स. / पू. is not claimed
        //    first, and before anything that reads a dot as a phrase break: इ.स.पू. was producing three
        //    of them ([ˈɪ . sˈə . pˈuː .]). The corpus writes both पू. and पु.; इ. ×5, स. ×4 and पू. ×3
        //    occur ONLY inside these markers (checked — no bare-letter false positives).
        s = s.replace(/(?<![\p{L}\p{M}])इ\.?\s?स\.?\s?प[ूु]\.?/gu, "इसवी सन पूर्व");
        s = s.replace(/(?<![\p{L}\p{M}])इ\.?\s?स\./gu, "इसवी सन");

        // 5) ABBREVIATIONS. डॉ. is the only one in this corpus (×6, always with the dot). The dot is
        //    consumed so it cannot become a phrase break.
        s = s.replace(/(?<![\p{L}\p{M}])डॉ\.?(\s+)(?=[\p{L}])/gu, "डॉक्टर$1");

        // 6) ORDINALS. Before the numeral-spelling rule in step 6b, which exists only to mop up what
        //    this step legitimately leaves behind.
        //    THE BOUNDARY IS THE WHOLE RULE. `(?![\p{L}\p{M}])` after the suffix is not decoration: the
        //    inherited Hindi rule has no such guard and its `वा` alternative matches the first two
        //    characters of वाजता, वाजल्यानंतर, वाजण्याच्या, वादळे, वाईल्ड and (via वे) वेळा, वेगवेगळ्या —
        //    13 live corruptions in this corpus, e.g. "8:30 वाजता" → [ˈaːʈʰ , t̪iːsʋˈaːd͡zt̪aː]. A
        //    leading `(?<![\d.,])` likewise keeps the rule off the minute field of a clock time.
        s = s.replace(
            new RegExp(`(?<![\\d.,])(\\d+)\\s?(${SUFFIX_ALT})(?![\\p{L}\\p{M}])`, "gu"),
            (whole, digits: string, suffix: string) =>
                ordinal(Number(digits), SUFFIX_FORM[suffix]!, suffix) ?? whole,
        );

        // 6b) SPELL OUT a numeral that is still adjacent to a व-initial word. This rule exists for one
        //     reason and is documented as a workaround rather than an idiom: the shared engine runs
        //     Hindi's normalizer AFTER this one, and Hindi's unguarded ordinal rule would claim the वा /
        //     वी / वे at the start of the following word (7 वेळा → "सातवाळा"-shaped glue). Removing the
        //     digit removes the match. The output is correct Marathi either way — "सात वेळा", "पाच
        //     वाजता", "चार वेगवेगळ्या" — so the cost is nil; only the MOTIVE is external.
        s = s.replace(/(?<![\d.,:])(\d+)(\s*)(?=व[ाीे])/gu, (whole, d: string, sp: string) => {
            const n = Number(d);
            if (!Number.isSafeInteger(n)) return whole;
            const words = cardinal(n);
            if (words.length === 0 || words.some((w) => w === "")) return whole;
            return `${words.join(" ")}${sp || " "}`;
        });

        // 7) TIMES. Two rules, and the guard between them is the point.
        //    7a) SPORTS times mm:ss.hh — 4:41.30, 2:11.60, 1:09.02 (×3, all in swimming/athletics
        //        contexts, all followed by मिनिटांच्या/मिनिटांनी). These are NOT clocks. The inherited
        //        Hindi clock rule claims them (its `(?![\d:])` permits a following dot) and produced
        //        "चार बजकर एकेचाळीस मिनट . तीस" — a bogus clock, a Hindi word, and a spurious phrase
        //        break. Dropping the colon leaves two plain numbers, which is the honest reading and
        //        which nothing downstream can re-claim. (Same failure the playbook records for ru/id.)
        //        (the trailing guard is `(?![\d:])`, NOT `(?![\d.,:])` — the corpus writes these in a
        //        comma-separated list, "4:41.30, 2:11.60", and excluding a following comma made the rule
        //        miss the first of the two.)
        s = s.replace(/(?<![\d.,:])(\d{1,2}):(\d{2}\.\d{1,2})(?![\d:])/gu, "$1 $2");
        //    7b) The clock proper. `(?![\d:.])` is what refuses 7a's leftovers and any h:mm:ss. A
        //        following वाजता is CONSUMED when the minutes are spoken, because वाजून already carries
        //        its sense; at :00 the postposition is exactly right and is supplied when absent — but
        //        NOT when the next word is another वाज- form ("11:00 वाजल्यानंतर" must not become
        //        "अकरा वाजता वाजल्यानंतर").
        s = s.replace(
            /(?<![\d:.])([01]?\d|2[0-3]):([0-5]\d)(?![\d:.])(\s*वाजता(?![\p{L}\p{M}]))?/gu,
            (m, h: string, min: string, vaajta: string | undefined, offset: number, whole: string) => {
                const body = clock(Number(h), Number(min));
                if (Number(min) !== 0) return body;
                const rest = whole.slice(offset + m.length);
                return vaajta || !/^\s*वाज/u.test(rest) ? `${body} वाजता` : body;
            },
        );
        //    7c) The same clock written with a DOT, which only occurs beside a timezone marker in this
        //        corpus ("१२.०० GMT वाजता", "(15.00 यूटीसी)"). No वाजता is added — the sentence already
        //        carries one after the timezone, and adding a second read as "बारा वाजता GMT वाजता".
        s = s.replace(
            /(?<![\d.,:])([01]?\d|2[0-3])\.([0-5]\d)(?![\d.,:])(?=\s*(?:GMT|UTC|यूटीसी|जीएमटी))/gu,
            (_m, h: string, min: string) => clock(Number(h), Number(min)),
        );

        // 8) DEGREES, before the signs in step 14 so the ° still has its digit adjacent ("+30°से."). अंश
        //    is the Marathi word (corpus-attested in "90(फ)- अंश तापमानात"), not Hindi's डिग्री. से. is
        //    the corpus's abbreviation for सेल्सिअस and its dot must be eaten, or it becomes a break.
        s = s.replace(/(\d)\s?°\s?(?:C|से\.?)(?![\p{L}\p{M}])/giu, "$1 अंश सेल्सिअस");
        s = s.replace(/(\d)\s?°\s?F(?![\p{L}\p{M}])/giu, "$1 अंश फॅरेनहाइट");
        s = s.replace(/(\d)\s?°\s?N(?![\p{L}\p{M}])/gu, "$1 अंश उत्तर");
        s = s.replace(/(\d)\s?°\s?S(?![\p{L}\p{M}])/gu, "$1 अंश दक्षिण");
        s = s.replace(/(\d)\s?°\s?E(?![\p{L}\p{M}])/gu, "$1 अंश पूर्व");
        s = s.replace(/(\d)\s?°\s?W(?![\p{L}\p{M}])/gu, "$1 अंश पश्चिम");
        s = s.replace(/(\d)\s?°/gu, "$1 अंश");

        // 9) PERCENT. Must precede the shared symbol tier, which is Hindi's and says प्रतिशत: the
        //    corpus's own word, nine times over, is टक्के. (The ASCII-digit half of the corpus was
        //    getting प्रतिशत while the Devanagari-digit half fell through to the manifest's टक्के — the
        //    same document read two different languages depending on which digits it used.) टक्का is
        //    the singular.
        s = s.replace(/(\d+(?:[.,]\d+)*)\s?[%٪％]/gu, (_m, n: string) =>
            `${n} ${Number(n.replace(/,/g, "")) === 1 ? "टक्का" : "टक्के"}`);

        // 10) CURRENCY, likewise before the shared tier (which would give यूरो / पाउंड for € / £). The
        //     sign is always PRE-posed in this corpus and the noun always follows the number, with any
        //     magnitude word hopping along: "$२.३ बिलियन" → "२.३ बिलियन डॉलर".
        s = s.replace(
            new RegExp(
                `([$€¥£₹])\\s?(\\d+(?:[.,]\\d+)*)(\\s*(?:${MAGNITUDE_ALT})(?![\\p{L}\\p{M}]))?`,
                "gu",
            ),
            (_m, sign: string, n: string, mag: string | undefined) =>
                `${n}${mag ?? ""} ${CURRENCY[sign]!}`,
        );

        // 11) UNITS. After the clock (step 7) so that no rule looking for a bare number can claim a
        //     time, and after currency so the magnitude hop is already done; before the fraction rule in
        //     step 13, whose solidus would otherwise have to compete with किमी/तास. The shared tier
        //     matches a unit only when a NUMBER is adjacent and these keys are Devanagari, so this stays
        //     local. `(?![\p{L}\p{M}])` after the key is what keeps मी (metre) out of मीटर, मिनिटे and
        //     the pronoun मी — the same over-counting trap that bit Bengali's ম.
        s = s.replace(
            new RegExp(`(\\d)\\s?(${UNIT_ALT})(?![\\p{L}\\p{M}])`, "gu"),
            (_m, d: string, u: string) => `${d} ${UNIT_WORD[u]!}`,
        );

        // 12) RANGES N-M → "N ते M". THE ASCENDING GUARD IS EVIDENCE, NOT CAUTION. Of the 17 hyphenated
        //     number pairs in this corpus, 4 are sports results — 5-3 (a hockey win), 7-2 (a head-to-head
        //     record), ६-६ (a tennis tie-break), २६-०० (a rugby scoreline) — where "ते" ("to") is simply
        //     wrong and the silent hyphen the engine already produces is correct. Every one of those 4 is
        //     descending or equal, and every one of the 11 genuine ranges (१६४४-१९१२, ३५-४० मीटर,
        //     १०००-१३००, 100-200 मैल, 1469-1539 …) is ascending. So the rule fires only when b > a:
        //     11 gained, 0 broken, 2 real ranges deliberately missed (१९९५-९६, an abbreviated year span,
        //     and 4.2-3.9, a descending "million years ago" span).
        s = s.replace(
            /(?<![\d.,])(\d+(?:\.\d+)?)\s?[-–—]\s?(\d+(?:\.\d+)?)(?![\d.,])/gu,
            (m, a: string, b: string) => (Number(b) > Number(a) ? `${a} ते ${b}` : m),
        );

        // 13) FRACTIONS. अर्धा / पाव / पाऊण are suppletive; anything else is the ordinary spoken
        //     division form "n भागिले m" (Marathi's equivalent of Hindi बटा, which the inherited pass
        //     would otherwise emit into Marathi output). Corpus: १/२, ३/४, 1/5 — all in measurements.
        s = s.replace(/(?<![\d.,])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) => {
            const num = Number(a), den = Number(b);
            if (num === 1 && den === 2) return "अर्धा";
            if (num === 1 && den === 4) return "पाव";
            if (num === 3 && den === 4) return "पाऊण";
            const nw = cardinalText(num), dw = cardinalText(den);
            return nw === "" || dw === "" ? m0 : `${nw} भागिले ${dw}`;
        });

        // 14) THE BARE HUNDRED. The manifest's `hundred` is शे, the COMBINING form (दोनशे, आठशे); a
        //     standalone 100 is शंभर, which the compositor cannot express because it emits
        //     units[h] + hundred unconditionally. Runs AFTER the range rule in step 12, which needs the
        //     digits, and is guarded against the dash on both sides so "100-200 मैल" and "100-मीटर"
        //     keep theirs. `(?!\s*[A-Za-z])` was added after the corpus diff caught this rule producing
        //     `शंभरm` from the swim event "100m आणि 200m" — the guard leaves any digits+Latin pair alone.
        s = s.replace(/(?<![\d,.\-–—])100(?![\d,.\-–—])(?!\s*[A-Za-z])/gu, "शंभर");

        // 15) SIGNS. Plus and the approximation tilde only. The MINUS rule used elsewhere in the fleet
        //     is deliberately NOT applied, on the same evidence Hindi recorded: Devanagari compounds are
        //     written with a hyphen (आस-पास), the corpus's one hyphen-before-digit outside a range is
        //     "चंद्रयान -1" — a spacecraft name — and reading it as "उणे एक" is worse than silence.
        s = s.replace(/\+\s?(?=\d)/gu, " अधिक ");
        s = s.replace(/~\s?(?=\d)/gu, " सुमारे ");
        s = s.replace(/ {2,}/gu, " ");

        return s;
    };
}
