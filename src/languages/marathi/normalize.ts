/**
 * Marathi (mr) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ MARATHI SHARES HINDI'S SCRIPT AND HINDI'S ABUGIDA ENGINE (`makeNativeHindi`) BUT NOT HINDI'S
 * ORTHOGRAPHIC CONVENTIONS, and the two diverge in every tier this file touches: Marathi writes the
 * percent as टक्के (not प्रतिशत), the clock as वाजून/वाजता (not बजकर/बजे), and the ordinal suffix as
 * -व्या/-वा/-वी/-वे with its own suppletive 1–4. It also writes a large fraction of its numbers in
 * DEVANAGARI DIGITS, which every ASCII-defined rule misses — see step 2, and note that the same lead
 * FAILS for several sibling Indic languages, so it must be measured per language rather than assumed.
 *
 * ⚠ THE DANDA ।/॥ DOES NOT APPEAR — Marathi text of this kind uses the ASCII period. A negative result
 * worth recording, because it is the opposite of what the script suggests.
 *
 * ⚠ A NOTE ON THE SHARED ENGINE, which shapes several rules below. `makeNativeHindi` applies HINDI's
 * normalizer and HINDI's symbol tier to every language that reuses it, and there is no seam to pass a
 * different one. So this pass runs FIRST and must leave nothing behind that Hindi's pass can claim —
 * every rule here is written to consume its input completely. Where that forced a rule into a shape it
 * would not otherwise take, it is called out at the step (5, 7, 12).
 */
import { indicNumberWords, type NumbersDef } from "../../core/numbers.ts";
import { postposedSign } from "../../core/postposedSign.ts";

/** Devanagari consonant letters (base + nukta block) — used to test whether a cardinal ends in a bare
 *  consonant, which is what conditions the ordinal's linking -आ- (साठ → साठावा). */
const DEV_CONSONANT_FINAL = /[क-हक़-य़]$/u;

/**
 * The Marathi word tables, all of them from marathi.jsonc. ⚠ THE TIER IN marathi.ts READS THE SAME KEYS —
 * `percent`, `currency`, `ampersand`, `multiply` and `units` are shared with it, and the rest are this
 * file's. Two readers, one authored copy; see the £ note in the manifest for what happened when there
 * were two copies.
 */
export interface MarathiWords {
    numbers: NumbersDef;
    currency: Record<string, string>;
    percent: { plural: string; singular: string };
    unitWords: Record<string, string>;
    magnitudeWords: string[];
    ordinals: {
        suffixForm: Record<string, 0 | 1 | 2 | 3>;
        /** ⚠ Indexed [masc, fem, plural/neuter, oblique] — the order IS the contract with `suffixForm`. */
        irregular: Record<string, readonly [string, string, string, string]>;
        stemHundred: string;
        stemNine: readonly [string, string];
        stemTens: readonly [string, string];
    };
    visargaAdverbs: string[];
    clock: { past: string; minutes: string; oclock: string };
    eraMarkers: { bc: string; ad: string };
    abbreviations: Record<string, string>;
    degree: { word: string; celsius: string; fahrenheit: string; north: string; south: string; east: string; west: string };
    fractions: { half: string; quarter: string; threeQuarters: string; dividedBy: string };
    symbolWords: { plus: string; approximately: string; plusMinus: string; lessThan: string; greaterThan: string; divide: string; equals: string; minus: string };
    rangeWord: string;
    bareHundred: string;
}

/** Build the Marathi normalizer. Takes the numbers definition so the ordinal and clock rules compose
 *  their cardinals from the same data the engine's own number path uses. */
export function makeMarathiNormalizer(def: MarathiWords): (text: string) => string {
    const numbers = def.numbers;
    // ⚠ EVERY WORD BELOW COMES FROM marathi.jsonc, and every one of them is FACTORY-SCOPED rather than
    // module-level: two normalizers built from different defs must not share a table. The tier in
    // marathi.ts reads the same keys, which is the point — where the two used to disagree, the reading
    // depended on which path claimed the token first.
    const SUFFIX_FORM = def.ordinals.suffixForm;
    const SUFFIX_ALT = Object.keys(SUFFIX_FORM).sort((a, b) => b.length - a.length).join("|");
    const IRREGULAR = def.ordinals.irregular;
    const UNIT_WORD = def.unitWords;
    const UNIT_ALT = Object.keys(UNIT_WORD)
        .sort((a, b) => b.length - a.length)
        .map((k) => k.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"))
        .join("|");
    const MAGNITUDE_ALT = def.magnitudeWords.join("|");
    const TAH_ADVERB_ALT = def.visargaAdverbs.join("|");
    const CLOCK = def.clock, ERA = def.eraMarkers, DEG = def.degree;
    const FRAC = def.fractions, SIGN = def.symbolWords;
    /** Currency sign → the Marathi noun, from the manifest and SHARED with marathi.ts's symbol tier. The two
     *  paths claim the sign in different positions (here before the amount, the tier after it) and used to
     *  answer with different words for £; marathi.jsonc records the evidence that settled it. ⚠ Scoped to
     *  the factory, not module-level: two normalizers built from different defs must not share it. */
    const CURRENCY = def.currency;
    const PERCENT = def.percent;
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
        if (w === numbers.magnitudes.hundred) return def.ordinals.stemHundred; // शे is the combining form; the ordinal is शंभरावा
        if (w === def.ordinals.stemNine[0]) return def.ordinals.stemNine[1]; // 9 → नववा, the one unit with a stem change
        if (w.endsWith(def.ordinals.stemTens[0])) return w.slice(0, -def.ordinals.stemTens[0].length) + def.ordinals.stemTens[1];
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
            : `${cardinalText(h)} ${CLOCK.past} ${cardinalText(min)} ${CLOCK.minutes}`;

    return (input: string): string => {
        let s = input;

        // 1) ZWJ / ZWNJ, and the अ‍ॅ digraph. FIRST, because U+200D is category Cf — neither \p{L} nor
        //    \p{M} — so it silently defeats every `(?<![\p{L}\p{M}])` boundary guard used below, and
        //    because `core/unicode.ts` DEVANAGARI_WORD ("ऀ-ॣॲ-ॿ") excludes it: आपल्‍या tokenized as two
        //    words, आपल् + या → [ˈaːpəl jˈaː]. 66 instances. Stripping it is orthographically lossless.
        //    अ‍ॅ / अॅ is the Marathi spelling of the loan vowel /æ/ and is folded to ऍ (candra e), which
        //    the manifest already maps to ɛː; left as अ + ॅ it read as two vowels [ə ɛː].
        s = s.replace(/अ[‌‍]?ॅ/gu, "ऍ").replace(/अ[‌‍]?ॉ/gu, "ऑ");  // ZWNJ, ZWJ
        s = s.replace(/[‌‍]/gu, "");  // ZWNJ, ZWJ

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
        //    BOTH इ and ई occur — the corpus writes ई.पू. once as well as इ.स.पू. ×4. That single instance
        //    used to be caught by HINDI's era rule running after this pass, which expanded it to Hindi's
        //    ईसा पूर्व; once Marathi supplied its own normalizer through the engine's override the Hindi
        //    rule no longer ran and the dots reached the output as two spurious pauses. Claimed here now,
        //    with Marathi's own wording rather than Hindi's.
        s = s.replace(/(?<![\p{L}\p{M}])[इई]\.?\s?स\.?\s?प[ूु]\.?/gu, ERA.bc);
        s = s.replace(/(?<![\p{L}\p{M}])[इई]\.?\s?प[ूु]\.?/gu, ERA.bc);
        s = s.replace(/(?<![\p{L}\p{M}])[इई]\.?\s?स\./gu, ERA.ad);

        // 5) ABBREVIATIONS. डॉ. is the only one in this corpus (×6, always with the dot). The dot is
        //    consumed so it cannot become a phrase break.
        s = s.replace(/(?<![\p{L}\p{M}])डॉ\.?(\s+)(?=[\p{L}])/gu, `${def.abbreviations["डॉ"]}$1`);

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
        //        which nothing downstream can re-claim.
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
                return vaajta || !/^\s*वाज/u.test(rest) ? `${body} ${CLOCK.oclock}` : body;
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
        s = s.replace(/(\d)\s?°\s?(?:C|से\.?)(?![\p{L}\p{M}])/giu, `$1 ${DEG.word} ${DEG.celsius}`);
        s = s.replace(/(\d)\s?°\s?F(?![\p{L}\p{M}])/giu, `$1 ${DEG.word} ${DEG.fahrenheit}`);
        s = s.replace(/(\d)\s?°\s?N(?![\p{L}\p{M}])/gu, `$1 ${DEG.word} ${DEG.north}`);
        s = s.replace(/(\d)\s?°\s?S(?![\p{L}\p{M}])/gu, `$1 ${DEG.word} ${DEG.south}`);
        s = s.replace(/(\d)\s?°\s?E(?![\p{L}\p{M}])/gu, `$1 ${DEG.word} ${DEG.east}`);
        s = s.replace(/(\d)\s?°\s?W(?![\p{L}\p{M}])/gu, `$1 ${DEG.word} ${DEG.west}`);
        s = s.replace(/(\d)\s?°/gu, `$1 ${DEG.word}`);

        // 9) PERCENT. Must precede the shared symbol tier, which is Hindi's and says प्रतिशत: the
        //    corpus's own word, nine times over, is टक्के. (The ASCII-digit half of the corpus was
        //    getting प्रतिशत while the Devanagari-digit half fell through to the manifest's टक्के — the
        //    same document read two different languages depending on which digits it used.) टक्का is
        //    the singular.
        s = s.replace(/(\d+(?:[.,]\d+)*)\s?[%٪％]/gu, (_m, n: string) =>
            `${n} ${Number(n.replace(/,/g, "")) === 1 ? PERCENT.singular : PERCENT.plural}`);

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
        //     the pronoun मी — the same over-counting trap any short unit key has in an abugida.
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
            (m, a: string, b: string) => (Number(b) > Number(a) ? `${a} ${def.rangeWord} ${b}` : m),
        );

        // 13) FRACTIONS. अर्धा / पाव / पाऊण are suppletive; anything else is the ordinary spoken
        //     division form "n भागिले m" (Marathi's equivalent of Hindi बटा, which the inherited pass
        //     would otherwise emit into Marathi output). Corpus: १/२, ३/४, 1/5 — all in measurements.
        s = s.replace(/(?<![\d.,])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) => {
            const num = Number(a), den = Number(b);
            if (num === 1 && den === 2) return FRAC.half;
            if (num === 1 && den === 4) return FRAC.quarter;
            if (num === 3 && den === 4) return FRAC.threeQuarters;
            const nw = cardinalText(num), dw = cardinalText(den);
            return nw === "" || dw === "" ? m0 : `${nw} ${FRAC.dividedBy} ${dw}`;
        });

        // 14) THE BARE HUNDRED. The manifest's `hundred` is शे, the COMBINING form (दोनशे, आठशे); a
        //     standalone 100 is शंभर, which the compositor cannot express because it emits
        //     units[h] + hundred unconditionally. Runs AFTER the range rule in step 12, which needs the
        //     digits, and is guarded against the dash on both sides so "100-200 मैल" and "100-मीटर"
        //     keep theirs. `(?!\s*[A-Za-z])` was added after the corpus diff caught this rule producing
        //     `शंभरm` from the swim event "100m आणि 200m" — the guard leaves any digits+Latin pair alone.
        s = s.replace(/(?<![\d,.\-–—])100(?![\d,.\-–—])(?!\s*[A-Za-z])/gu, def.bareHundred);

        // 15) SIGNS. ⚠ THE ASCII HYPHEN IS STILL REFUSED, AND THE REFUSAL IS ABOUT THE TRIGGER RATHER THAN
        //     THE WORD: Devanagari compounds are written with a hyphen (आस-पास), and a hyphen before a
        //     digit outside a range is a designation — "चंद्रयान -1", a spacecraft name — where reading
        //     "उणे एक" is worse than silence. No choice of word fixes that, so no choice of word unlocks it.
        //
        //     ⚠ U+2212 IS A DIFFERENT CHARACTER AND CARRIES NONE OF THAT AMBIGUITY. It is the MINUS SIGN:
        //     never a compound hyphen, never a designation dash, and not in step 12's range class
        //     `[-–—]` either. Until now it was simply DROPPED, so `−२५°C` read *पंचवीस अंश सेल्सिअस* — a
        //     negative temperature with the sign silently gone, which is the one reading here that is
        //     wrong rather than merely absent. उणे is not new vocabulary: `plusMinus` below is
        //     अधिक + उणे, so this file already asserts it. (वजा is the attested alternative.)
        //
        //     ⚠ ZERO CORPUS OCCURRENCES, STATED PLAINLY. U+2212 appears 0 times in the mined artifact and
        //     0 times in the 200-row golden, so nothing measures this rule — it fills a gap rather than
        //     fixing an observed defect, and the sabotage count for `minus` is 0 against any corpus probe.
        s = s.replace(/\+\s?(?=\d)/gu, ` ${SIGN.plus} `);
        s = s.replace(/−\s?(?=\d)/gu, ` ${SIGN.minus} `);  // U+2212 MINUS SIGN — NOT the ASCII hyphen
        s = s.replace(/~\s?(?=\d)/gu, ` ${SIGN.approximately} `);

        // 15b) THE RELATIONAL AND DIVISION SIGNS, and ±. ⚠ All sourced from running text rather than from
        //      Marathi's own arithmetic articles, which write the notation instead of reading it — `बरोबर`,
        //      `भागिले` and `पेक्षा कमी` are all ×0 there.
        //
        //      ⚠ THE COMPARATIVES ARE POSTPOSITIONAL, so they use core/postposedSign.ts rather than a
        //      substitution: Marathi states the standard first and the comparative after it, and the corpus
        //      writes पेक्षा FUSED to the standard — "एका मैलापेक्षा कमी" (less than one mile) ×8,
        //      "१०० फुटांपेक्षा जास्त" (more than 100 feet) ×23. An infix rule would read the comparison
        //      BACKWARDS — the same hazard any postpositional or verb-final language poses.
        //
        //      ⚠ THE DIVISION IS POSTPOSITIONAL TOO. A PARALLEL corpus is what settles this: the same
        //      sentence performs a division aloud across many languages, and the Marathi rendering is
        //      "बाराने भागणे" — instrumental -ने on the operand, THEN भागणे. So `A ÷ B` is "A, by B,
        //      dividing". `भागिले`, the infix school form, is ×0 everywhere measured.
        //
        //      ⚠ AND `बरोबर` IS A HOMOGRAPH MAJORITY. Most of its tokens are the postposition "with" —
        //      "तुमच्या बरोबर" (with you), "त्याच बरोबर" (along with that) — but the equality sense is present
        //      and is the arithmetic reading: "तो बरोबर आहे" (it is correct), "अनुक्रमे बरोबर" (respectively
        //      equal). COUNTED alone the word looks wrong; READ, it is right.
        //
        //      ± pairs this file's own अधिक with उणे — the word the minus note in step 15 names as the
        //      reading it declined, so both halves are already cited in this file.
        // ⚠ SPACED ON BOTH SIDES. `/±\s?/` with an unspaced replacement FUSES the reading onto the
        //    preceding word: `तापमान±5` reads *t̪ˈaːpmaːnəəd̪ʱɪk*, one token, with the stress of neither.
        //    The shared symbol tier's `ampersand` note records the same hazard for the same reason.
        s = s.replace(/±/gu, ` ${SIGN.plusMinus} `);
        s = postposedSign(s, "<", SIGN.lessThan);
        s = postposedSign(s, ">", SIGN.greaterThan);
        s = postposedSign(s, "÷", SIGN.divide);
        s = s.replace(/\s?=\s?/gu, ` ${SIGN.equals} `);
        s = s.replace(/ {2,}/gu, " ");

        return s;
    };
}
