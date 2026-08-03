/**
 * Shared SYMBOL normalization (#562) — the language-independent machinery for rewriting %, currency
 * signs, and unit abbreviations into that language's words, BEFORE its tokenizer. The per-language part
 * is pure data (`SymbolData`); the engine here owns the matching, the number-magnitude hop for currency
 * ($5 million → "5 million dollars"-shaped), and COUNT AGREEMENT — which for Slavic needs more than
 * singular/plural, so forms are selected by an overridable `countForm(n)` (Russian: 1 процент /
 * 2 процента / 5 процентов, keyed on the numeral's final digits).
 *
 * English's normalize.ts predates this seam and keeps its own implementation (it also handles dates,
 * times, years and romans, which are NOT shared — their rules are language-specific by nature). The
 * contract everywhere: emit plain words and digits the language's EXISTING pipeline already speaks.
 */

/** Word forms for one countable noun. Index 0 = singular; further indices per the language's
 *  `countForm`. A language with no agreement uses a 1-element array. */
export type CountForms = string[];

/** Where a language puts the squared/cubed measure word relative to the unit noun. See `exponentWords`. */
export type ExponentPosition = "before" | "after" | "compound" | "suffix";

export interface SymbolData {
    /** The word for %, e.g. "percent", "Prozent", "por ciento", or count forms for Slavic. */
    percent: CountForms;
    /**
     * Currency sign → count forms. The sign may precede or follow the number in text; the word is emitted
     * after the number by default, or before it with `currencyPrefix`.
     *
     * A KEY MAY BE MORE THAN ONE CHARACTER, and this is the answer to a question three separate runs
     * reported as a core limitation. A bare `$` cannot match in `US$30` or `AUD$45`, because the pattern
     * is letter-bounded on the left so a code prefix would otherwise be split — that guard is deliberate.
     * The fix is to DECLARE the compound key:
     *
     *     currency: { "US$": ["US dollar"], "AUD$": ["Australian dollar"], "$": ["dollar"] }
     *
     * Keys are matched longest-first, so the compound wins over the bare sign. Likewise, a language whose
     * noun has non-concatenative plurals should declare them as further CountForms entries — the
     * "already said it" suppression below tests every declared form, so `$100 ዶላሮች` only stays quiet if
     * ዶላሮች is one of them.
     */
    currency?: Record<string, CountForms>;
    /** Unit abbreviation (lowercase) → count forms. Matched only AFTER a number. */
    units?: Record<string, CountForms>;
    /** Magnitude words that hop with a currency sign ("million" etc., in the language's spelling as it
     *  appears in running text). Omit if the language writes magnitudes after the currency word anyway. */
    magnitudes?: string[];
    /** The word joining a magnitude to the currency noun: Spanish/Portuguese/French/Catalan "de", Italian
     *  "di" — *cinco millones **de** dólares*. Omit for the languages that take none (German "fünf
     *  Millionen Dollar", Swedish "fem miljoner dollar"). Only ever emitted when a magnitude was matched,
     *  so a bare "$5" is unaffected. Found by the Italian fan-out run; it was silently missing in es, pt,
     *  fr and ca, all of which were reading *cinco millones dólares*. */
    magnitudeConnective?: string;
    /** n → index into a CountForms array. Default: n===1 → 0, else last index. Override for Slavic. */
    countForm?: (n: number) => number;
    /** The percent word PRECEDES the number (Turkish yüzde kırk, Mandarin 百分之四十). Text may write the
     *  sign on either side (%40 or 40%); both rewrite to prefix order. */
    percentPrefix?: boolean;
    /**
     * The currency noun PRECEDES the number — Swahili "dola 30", where the tier's default is to emit it
     * after. The magnitude and its connective, if any, stay with the number: "dola milioni 5". Reported by
     * the Swahili run, which had to claim currency locally for want of this.
     */
    currencyPrefix?: boolean;
    /**
     * The UNIT noun precedes the number — Swahili writes *kilomita 19,500*, *mita 100*, the mirror of the
     * `currencyPrefix` case and for the same reason (a measure noun heads its phrase in Bantu).
     *
     * Opt-in and measured, not inferred from `currencyPrefix`: counting the four unit words sw_ke attests,
     * the corpus is **82 unit-before to 0 unit-after**, while the tier's default emits it after and had no way
     * to say otherwise. Before this, sw could not declare units at all — which is why `5 km` read as *tˈɑnɔ
     * kˈm̩*, the abbreviation reaching the phoneme sink.
     */
    unitPrefix?: boolean;
    /**
     * The word joining two units in a RATE — `km/h` → "kilometres PER hour". Composition is shared; only
     * the word is language data ("per", "pro", "par"). Both units must be declared in `units`, since the
     * denominator needs its own noun (`h` → hour/Stunde/heure).
     *
     * NOT universal, which is why it is opt-in: Korean writes the rate as a PREFIX (시속 = "hour-speed"),
     * and Japanese/Vietnamese/Thai already resolve their own rate units locally for ordering reasons. Those
     * keep doing so; this serves the majority "A per B" idiom.
     *
     * MAY BE KEYED BY DENOMINATOR, because the preposition is not always one word: Serbian writes
     * `километара НА сат` but `километара У секунди`, and had to compose `/s` locally for want of this.
     * A plain string applies to every denominator; a record selects on the denominator key.
     */
    unitPer?: string | Readonly<Record<string, string>>;
    /**
     * Nouns available ONLY as a rate DENOMINATOR — `h`, `u`, `s` — never matched as a standalone unit.
     *
     * This exists because the Dutch migration proved the alternative dangerous. Declaring `s` in `units`
     * so that `m/s` could compose also made a bare `76s` match, and the corpus's `Il-76s` (the aircraft,
     * plural) became *zesenzeventig seconde* — confidently wrong, which is worse than the raw letter it
     * replaced. One-letter denominators collide with plural-s and with alphanumeric designations, so they
     * are kept out of the standalone alternation entirely.
     */
    rateDenominators?: Record<string, string>;
    /**
     * Squared and cubed units — `km²` → "square kilometres". The measure word is language data and so is
     * its POSITION, which needs FOUR values, not two:
     *   `after`    (default) — Italian, Vietnamese, Polish: *chilometri quadrati*, *kilometr kwadratowy*
     *   `before`   — Russian: *квадратных километров*, an agreeing adjective with a space
     *   `compound` — Swedish and Japanese, which fuse it BEFORE: *kvadratkilometer*, 平方キロメートル
     *   `suffix`   — Turkish, which fuses it AFTER: *kilometrekare*, *metreküp*
     * `before` and `compound` were one value at first, which silently produced Russian
     * *квадратныхкилометров* as a single unreadable token. `suffix` is the same mistake waiting on the other
     * side: Turkish attests `783.562 kilometrekare` and `120-160 metreküp` in its own corpus, and neither
     * `compound` (*karekilometre*) nor `after` (*kilometre kare*) is that word.
     *
     * ⚠ THE POSITION CAN DIFFER BETWEEN SQUARED AND CUBED, so it also takes a per-power record — the same
     * shape `unitPer` takes, for the same reason. Amharic is the case: it borrowed the two readings from
     * different directions and its corpus writes `783,562 ስኩዌር ኪ.ሜ.` (word BEFORE) beside `120-160 ሜትር ኪዩብ`
     * (word AFTER). One value per language would have had to be wrong about one of them.
     */
    exponentWords?: {
        squared?: CountForms;
        cubed?: CountForms;
        position?: ExponentPosition | Readonly<Partial<Record<"squared" | "cubed", ExponentPosition>>>;
    };
    /**
     * THIS LANGUAGE IS WRITTEN WITHOUT SPACES BETWEEN WORDS — Chinese, Japanese.
     *
     * Set it and the boundary guards around currency keys and unit abbreviations stop treating "any letter"
     * as token-continuation and treat only a LATIN letter that way. The guards exist to stop a short key
     * biting into a word (Ukrainian `41 м\u2019яч`, Dutch `Il-76s`), a hazard that only arises inside one
     * alphabetic run; a Han or kana neighbour is a token boundary by script change and never continues a
     * Latin/symbol key. Left unset, the guard rejects the ORDINARY case in these languages — measured on cmn,
     * where `38\u2103\u5f88\u70ed` dropped the \u2103 and `\u70ba$500\uff0c` dropped the `$` while their
     * punctuation-adjacent twins worked.
     */
    unspacedScript?: boolean;
}

const defaultCountForm = (n: number): number => (n === 1 ? 0 : 1);

/** The Slavic three-way selector (ru, cs): 1→0 (sg), 2–4→1 (paucal), else→2 — keyed on the final
 *  digits, with 11–14 always plural (21 процент, 22 процента, 25 процентов, 12 процентов). */
export const slavicCountForm = (n: number): number => {
    const mod100 = Math.abs(n) % 100;
    const mod10 = mod100 % 10;
    if (mod100 >= 11 && mod100 <= 14) return 2;
    if (mod10 === 1) return 0;
    if (mod10 >= 2 && mod10 <= 4) return 1;
    return 2;
};

/**
 * The form a currency noun takes after a MAGNITUDE word ("5 million dollars").
 *
 * A magnitude governs the same form a LARGE COUNT does — "5 million dollars" agrees like "5 dollars" —
 * so it is resolved by asking the language's own `countForm` for a many-count rather than by picking a
 * fixed index. The first version passed the literal 2 as a count, which for the Slavic selector means the
 * PAUCAL, so Polish read "5 milionów dolary" instead of the genitive plural. The second took the LAST
 * entry outright, which was right until a fourth form (the Slavic genitive singular, for decimals) was
 * appended and "last" stopped meaning "most plural" — it then read "5 milionów dolara". Asking countForm
 * is stable under both, because it is the language that knows.
 */
const MANY = 5; // any count that selects a language's plural/genitive-plural slot
function withMagnitude(
    forms: CountForms,
    mag: string | undefined,
    n: number,
    countForm: (n: number) => number,
): string {
    return pick(forms, mag !== undefined && mag !== "" ? MANY : n, countForm);
}

function pick(forms: CountForms, n: number, countForm: (n: number) => number): string {
    const i = Math.min(countForm(n), forms.length - 1);
    return forms[Math.max(0, i)]!;
}

/** Leading integer value of a possibly grouped/decimal numeral string ("1,234.5" → 1234; agreement is
 *  driven by the integer part, matching how the languages themselves resolve it). A decimal number
 *  always takes the plural/genitive form (1.5 процента… — close enough; decimals are rare in prose). */
function numValue(num: string): number {
    const cleaned = num.replace(/[  ]/gu, ""); // thin/regular space grouping
    // Grouping separators come in 3-digit blocks; a trailing 1–2 digit block after . or , is a decimal.
    const m = /^(\d+(?:[.,]\d{3})*)(?:[.,](\d+))?$/.exec(cleaned);
    if (!m) return NaN;
    const int = Number(m[1]!.replace(/[.,]/g, ""));
    return m[2] !== undefined && m[2].length !== 3 ? int + 0.5 : int; // a real fraction ⇒ never "one" ⇒ plural
}

// Space-grouping is only real grouping when the block is EXACTLY three digits (3 850 = 3850); otherwise
// "30 9" would fuse two separate numbers and eat the association between a number and its unit.
const NUM = "\\d+(?:[  ]\\d{3}(?!\\d)|[.,]\\d+)*";

/** Build the text→text symbol normalizer for one language's data. */
export function makeSymbolNormalizer(d: SymbolData): (text: string) => string {
    const cf = d.countForm ?? defaultCountForm;
    // LONGEST FIRST, because a shorter magnitude is often a prefix of a longer inflected one. Russian
    // lists both миллион and миллионов; in declaration order the short form matched first and stranded
    // the suffix, giving *пять миллион долларовов*. Same discipline as the currency keys below.
    // `\s*`, NOT `\s+`: A SPACE BEFORE THE MAGNITUDE IS NOT UNIVERSAL. Chinese and Japanese are written
    // without spaces, so `1350亿m³` is the ordinary form and `1350 亿 m³` the exceptional one — with `\s+`
    // the number was not adjacent to the magnitude, the match failed, and `m³` reached the IPA as the
    // ENGLISH LETTER NAME (*ˈɛm*), the same failure mode the Luxembourgish run reported for the spaced case.
    // The group is re-emitted verbatim, so it carries its own leading space when there is one and none when
    // there is not; it can never match empty, because the alternation requires a magnitude word.
    //
    // BLAST RADIUS, measured over all 66 FLEURS corpora rather than argued: exactly TWO attach a magnitude
    // to a digit — cmn (3×, `147亿美元`) and kn (4×, `3.7ದಶಲಕ್ಷ,`) — and in all seven the magnitude is
    // followed by a currency WORD or a comma, never a sign or a unit. So this fix changes no corpus reading
    // anywhere: it is robustness for plausible input, not a measured-defect repair, and is recorded as such.
    const magAlt = d.magnitudes?.length
        ? `(\\s*(?:${[...d.magnitudes].sort((a, b) => b.length - a.length).join("|")}))?`
        : "()?";
    // Currency keys are an ALTERNATION, not a character class. As a class, a key could only ever be one
    // character, so a letter-code currency — Polish `zł`, and `PLN`/`USD`/`CHF` generally — could not be
    // expressed as currency data at all; the Polish run hit this and had to omit its own złoty. Longest
    // first so a two-letter code is not shadowed by a one-letter one, and letter-bounded on both sides so
    // a bare code cannot match inside a word.
    const curKeys = d.currency
        ? Object.keys(d.currency)
            .sort((a, b) => b.length - a.length)
            .map((s) => s.replace(/[$.*+?^${}()|[\]\\]/gu, "\\$&"))
            .join("|")
        : "";
    // THE BOUNDARY GUARDS ASSUME SPACES BETWEEN WORDS, and in Chinese or Japanese there are none — so the
    // ordinary case is the one they reject. `unspacedScript` narrows the guard from "any letter" to "a letter
    // that could CONTINUE this token", which for a Latin/symbol key means a Latin letter. A Han neighbour is
    // already a token boundary by script change, so it needs no guard; marks and apostrophes still do.
    // Measured on cmn (zh.wikipedia fill), where only punctuation-adjacent instances were working:
    //   為$500，  → `$` DROPPED (Han precedes)        38℃很热     → `℃` DROPPED (Han follows)
    //   20°C很热  → reads C as English *sˈiː*         50 km²的面积 → `²` DROPPED
    // Opt-in per language rather than global, because the guard is load-bearing where words ARE spaced: it is
    // what stops a one-letter unit biting into a word (Ukrainian `41 м'яч`, Dutch `Il-76s`).
    const wordCont = d.unspacedScript ? "\\p{sc=Latn}" : "\\p{L}";
    const CUR = `(?<![${wordCont}\\p{M}])(?:${curKeys})(?![${wordCont}\\p{M}])`;
    const curBefore = d.currency
        ? new RegExp(`(${CUR})\\s?(${NUM})${magAlt}`, "gu")
        : null;
    // The magnitude is matched on BOTH sides of the number. Without it on the postposed form, "5 millions $"
    // matched nothing at all and the sign was DROPPED — silent content loss, found while fixing the
    // connective below. `magAlt` is `()?` when a language declares no magnitudes, so the group indices
    // stay fixed either way.
    const curAfter = d.currency
        ? new RegExp(`(${NUM})${magAlt}\\s?(${CUR})`, "gu")
        : null;
    const unitAlt = d.units ? Object.keys(d.units).sort((a, b) => b.length - a.length).join("|") : "";
    // Denominators may come from either map; only `units` keys are matchable standalone.
    const denomKeys = [...Object.keys(d.units ?? {}), ...Object.keys(d.rateDenominators ?? {})]
        .sort((a, b) => b.length - a.length).join("|");
    // The unit may carry a RATE denominator (`km/h`) or an EXPONENT (`km²`, `km2`). Both are consumed in
    // the same match so neither can be stranded after the unit word is substituted — the exponent was
    // being left behind as an unreadable character, and the `/h` read as the letter H.
    //
    // THE TRAILING GUARD REJECTS AN APOSTROPHE as well as a letter or mark. An apostrophe is neither, but
    // it is WORD-INTERNAL in several orthographies, so the bare guard let a one-letter unit key bite into
    // a real word: with `м` declared, Ukrainian `41 м\u2019яч` ("41 balls") read as *сорок один метр\u2019яч*.
    // Reported by the Ukrainian run. Same shape as the Dutch `Il-76s` case — a short unit key is the
    // hazard, and being confidently wrong is worse than leaving the letter raw.
    // A MAGNITUDE WORD MAY SIT BETWEEN THE NUMBER AND THE UNIT, exactly as it may between the number and
    // a currency sign — `2,2 Millioune km²`, `2.2 miljoen km2`, `2,2 милиони km2`. Currency has matched
    // `magAlt` on both sides since the Nepali run; the unit path never did, so the number was not adjacent
    // to the unit, the match failed, and the unit reached the IPA AS RAW LETTERS. Reported by the
    // Luxembourgish run (#604), which measured it and correctly declined to touch core.
    // Blast radius, measured over every corpus whose language declares both `magnitudes` and `units`:
    // SEVEN utterances, in af, az, nl, el, lb, mk and ta — and all seven are the same FLEURS sentence, the
    // 15-island archipelago. Six languages were shipping the identical defect.
    // The magnitude is re-emitted in place: it is the NUMBER's word, not the unit's.
    // `\s?` BEFORE THE EXPONENT, and deliberately OUTSIDE the capture group so the group count — which the
    // callback reads POSITIONALLY — does not change. Hindi's Wikipedia sets the exponent off with a space
    // (`km \u00b2`), and with it required to touch the unit the whole match failed and the exponent DROPPED.
    // Putting the `\s?` outside is self-limiting too: on the ASCII branch the lookbehind `(?<=[a-zA-Z])` then
    // sees the SPACE rather than the unit letter and fails, so `km 2` (a kilometre, then the number two) is
    // still not an exponent while `km \u00b2` is.
    // Zero occurrences in all 66 FLEURS corpora — robustness for the one attested wiki form, not a repair.
    // A DOTTED DESIGNATION IS NOT A QUANTITY. `802.11g` was reading as "802.11 GRAMS" — the one-letter unit
    // key `g` matching the version suffix — and `802.11n` as the English letter *ˈɛn*. Measured over all 66
    // FLEURS corpora, because the Wi-Fi article was translated into nearly every one of them:
    //
    //   dotted VERSION glued to a single letter (802.11n/a/b/g)   444
    //   a DECIMAL glued to a single-letter unit                     4   (4.892m ×3, 3.50m ×1 — and those are
    //                                                                   period THOUSANDS separators, not decimals)
    //
    // So the guard rejects a number-with-a-dot glued to exactly ONE trailing letter. It is deliberately narrow:
    // `12.5km` keeps working because `km` is two letters, and a spaced `12.5 g` keeps working because the letter
    // is not glued. This is why the `version-dot` cell exists in the inventory; it had no protection in core.
    // BOTH HALVES ARE NEEDED. The lookahead alone was not enough: rejected at `802`, the engine simply retried
    // from the FRACTIONAL part and matched `11g` on its own. The lookbehind stops a match beginning inside a
    // number, and the lookahead stops it beginning at the front of one. Verified: `802.11g` and `802.11n` are
    // left alone, while `12.5km` (two-letter key), `12.5 g` (not glued) and `1,000 km` still read.
    const NOT_VERSION = "(?<![\\d.,])(?!\\d+[.,]\\d+[a-zA-Z](?![a-zA-Z\\d]))";
    const unitRe = d.units
        ? new RegExp(
            `${NOT_VERSION}(${NUM})${magAlt}\\s?(${unitAlt})(?:\\s?/\\s?(${denomKeys})|\\s?(\u00b2|\u00b3|(?<=[a-zA-Z])[23](?![\\d\\p{L}])))?(?![${wordCont}\\p{M}\u0027\u2019\u02bc])`,
            "giu",
        )
        : null;
    // BOTH percent signs. U+066A ٪ is the Arabic-script one, and the tier used to know only ASCII `%`, so
    // ar, ur and fa each pre-folded it in their own normalize.ts before this tier could see it. Accepting
    // it here makes those folds harmless no-ops and means the next Arabic-script language gets it free.
    // U+066A ٪ is the Arabic-script sign, U+FF05 ％ the FULL-WIDTH one that is ordinary CJK typography.
    // The Cantonese run had to fold ％ locally; accepting it here means the next CJK language does not.
    const PCT = "[%\u066a\uff05]";
    const pctRe = new RegExp(`(${NUM})\\s?${PCT}`, "gu");
    // The %-before-number form (%40). The lookbehind stops a misfire after other rules run: currency turns
    // "88% $2" into "88% 2 doler", and without the guard this rule would glue "% 2" into 88's replacement.
    const pctPreRe = new RegExp(`(?<!\\d)${PCT}\\s?(${NUM})`, "gu");

    const esc = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    /**
     * "Does the text right AFTER the match already spell this noun?" — used to stay quiet rather than say
     * it twice. The magnitude connective may sit between, so "…millones de dólares" counts as already
     * said. Shared by currency and percent: the guard was currency-only at first and Malayalam's
     * `93% ശതമാനം` read as *ശതമാനം ശതമാനം*.
     */
    const saidAfter = (forms: CountForms): RegExp => {
        const conn = d.magnitudeConnective === undefined ? "" : `(?:${esc(d.magnitudeConnective)}[  ]+)?`;
        return new RegExp(`^[  ]*${conn}(?:${forms.map(esc).join("|")})`, "u");
    };
    /** The mirror, for a PREFIX word: Turkish `yüzde 40%` was reading *yüzde yüzde kırk*. */
    const saidBefore = (forms: CountForms): RegExp =>
        new RegExp(`(?:${forms.map(esc).join("|")})[  ]*$`, "u");
    const PCT_AFTER = saidAfter(d.percent);
    const PCT_BEFORE = saidBefore(d.percent);

    return (text: string): string => {
        let s = text;
        // "cinco millones DE dólares" — emitted only when a magnitude was actually matched.
        const join = (mag: string | undefined): string =>
            mag !== undefined && mag !== "" && d.magnitudeConnective !== undefined
                ? `${d.magnitudeConnective} `
                : "";
        // Both orders emit through one shape so the magnitude and its connective travel with the number
        // whichever side the noun goes on.
        //
        // `rest` is the text immediately after the whole match. When it ALREADY spells the currency noun
        // the sign is redundant and emitting the word again doubles it: `$1000 dollar` read as
        // "1000 dollar dollar", and `$45 million dollars` as "45 dollar million dollars" — the word
        // inserted before the magnitude while the written one stayed put. Reported by the Nepali run,
        // whose corpus writes `$1000 डलर`.
        const money = (num: string, mag: string | undefined, sym: string, rest: string): string => {
            const forms = d.currency![sym]!;
            const already = saidAfter(forms);
            const body = `${num}${mag ?? ""}`;
            if (already.test(rest)) return body; // the text says it; do not say it twice
            const w = withMagnitude(forms, mag, numValue(num), cf);
            return d.currencyPrefix
                ? `${w}${mag ?? ""} ${join(mag)}${num}`.replace(/\s+/gu, " ")
                : `${body} ${join(mag)}${w}`;
        };
        if (curBefore)
            s = s.replace(curBefore, (m: string, sym: string, num: string, mag: string | undefined,
                offset: number, full: string) => money(num, mag, sym, full.slice(offset + m.length)));
        if (curAfter)
            s = s.replace(curAfter, (m: string, num: string, mag: string | undefined, sym: string,
                offset: number, full: string) => money(num, mag, sym, full.slice(offset + m.length)));
        // The percent word is suppressed when the text already carries it — on whichever side this
        // language puts it. `93% ശതമാനം` doubled the suffix; `yüzde 40%` doubled the prefix.
        const pct = (num: string, offset: number, full: string, matchLen: number): string => {
            const before = full.slice(0, offset), after = full.slice(offset + matchLen);
            const w = pick(d.percent, numValue(num), cf);
            if (d.percentPrefix) return PCT_BEFORE.test(before) ? num : `${w} ${num}`;
            return PCT_AFTER.test(after) ? num : `${num} ${w}`;
        };
        s = s.replace(pctPreRe, (m: string, num: string, off: number, full: string) => pct(num, off, full, m.length));
        s = s.replace(pctRe, (m: string, num: string, off: number, full: string) => pct(num, off, full, m.length));
        if (unitRe)
            s = s.replace(unitRe, (whole, num: string, mag: string | undefined, u: string,
                denom?: string, exp?: string) => {
                // The magnitude travels with the NUMBER and is re-emitted verbatim (trap 10 — a rule that
                // consumes a word must put it back). It also governs the count form the way a LARGE COUNT
                // does, resolved through the language's own `countForm` via MANY — the same reasoning, and
                // the same constant, that `withMagnitude` uses for the currency side, and for the same
                // reason: passing a literal 2 means the PAUCAL to a Slavic selector, and taking the last
                // entry breaks as soon as a fourth form is appended.
                const hasMag = mag !== undefined && mag !== "";
                const q = hasMag ? `${num}${mag}` : num;
                const n = hasMag ? MANY : numValue(num);
                const head = pick(d.units![u.toLowerCase()]!, n, cf);
                if (denom !== undefined) {
                    // A rate needs both nouns and the connective; without any of them leave the text
                    // alone rather than emit half a reading.
                    const dl = denom.toLowerCase();
                    const dWord = d.units?.[dl]?.[0] ?? d.rateDenominators?.[dl];
                    const per = typeof d.unitPer === "string" ? d.unitPer : d.unitPer?.[dl];
                    if (per === undefined || dWord === undefined) return whole;
                    // `unitPrefix` applies here too, and forgetting it left Swahili reading
                    // "160 kilomita kwa saa" where the language writes the measure noun first. The rate is
                    // one phrase, so the whole of it hinges on the head noun's position.
                    return d.unitPrefix ? `${head} ${q} ${per} ${dWord}` : `${q} ${head} ${per} ${dWord}`;
                }
                if (exp !== undefined) {
                    const power = exp === "\u00b3" || exp === "3" ? "cubed" : "squared";
                    const forms = d.exponentWords?.[power];
                    if (forms === undefined) {
                        // NO MEASURE WORD DECLARED — emit the UNIT and hand the exponent back, rather than
                        // abandoning the whole match. Returning `whole` was silently the worst of the three
                        // options: the unit never read either, so the abbreviation reached the phoneme sink
                        // verbatim and the QUANTITY was lost, not just its power. Measured across the 66
                        // languages with an artifact, while no gate said a word:
                        //   21 read `5 km²` with a raw `km` in the IPA — de *fʏnf km*, cy *pˈɨmp km*,
                        //      tr *bˈeʃ km* — against `5 km` reading correctly in every one of them
                        //    7 more lost the unit word another way
                        // Re-emitting the exponent keeps the unit's reading AND leaves the `²` where the leak
                        // gate can see it (`RAWMARK` covers ²³), so what remains is a visible missing WORD in
                        // one language's data instead of an invisible missing reading in twenty-one.
                        return `${q} ${head}${exp}`;
                    }
                    // Count forms, because in Romance the measure word is an ADJECTIVE and agrees:
                    // "un kilómetro cuadrado" vs "cincuenta kilómetros cuadrados".
                    const word = pick(forms, n, cf);
                    const declared = d.exponentWords?.position;
                    const pos = (typeof declared === "string" ? declared : declared?.[power]) ?? "after";
                    // The unit PHRASE is assembled first and the quantity placed around it, because
                    // `unitPrefix` governs the exponent reading exactly as it governs the plain one — Oromo
                    // writes `iskuweer kiloometiiri 783,562`, noun phrase THEN number. Building the return
                    // per-position instead is what left this branch the only one of the three that ignored
                    // `unitPrefix`, so `5 km²` read in the fleet's word order rather than the language's.
                    const phrase = pos === "compound" ? `${word}${head}`
                        : pos === "suffix" ? `${head}${word}`
                        : pos === "before" ? `${word} ${head}`
                        : `${head} ${word}`;
                    return d.unitPrefix ? `${phrase} ${q}` : `${q} ${phrase}`;
                }
                return d.unitPrefix ? `${head} ${q}` : `${q} ${head}`;
            });
        return s;
    };
}
