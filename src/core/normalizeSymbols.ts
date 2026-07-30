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

export interface SymbolData {
    /** The word for %, e.g. "percent", "Prozent", "por ciento", or count forms for Slavic. */
    percent: CountForms;
    /** Currency sign → count forms. The sign may precede or follow the number in text; the word is
     *  always emitted AFTER the number (with any magnitude word hopping along). */
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
     * The word joining two units in a RATE — `km/h` → "kilometres PER hour". Composition is shared; only
     * the word is language data ("per", "pro", "par"). Both units must be declared in `units`, since the
     * denominator needs its own noun (`h` → hour/Stunde/heure).
     *
     * NOT universal, which is why it is opt-in: Korean writes the rate as a PREFIX (시속 = "hour-speed"),
     * and Japanese/Vietnamese/Thai already resolve their own rate units locally for ordering reasons. Those
     * keep doing so; this serves the majority "A per B" idiom.
     */
    unitPer?: string;
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
     * its POSITION, which needs three values, not two:
     *   `after`    (default) — Italian, Vietnamese, Polish: *chilometri quadrati*, *kilometr kwadratowy*
     *   `before`   — Russian: *квадратных километров*, an agreeing adjective with a space
     *   `compound` — Swedish and Japanese, which fuse it into one word: *kvadratkilometer*, 平方キロメートル
     * `before` and `compound` were one value at first, which silently produced Russian
     * *квадратныхкилометров* as a single unreadable token.
     */
    exponentWords?: {
        squared?: CountForms;
        cubed?: CountForms;
        position?: "before" | "after" | "compound";
    };
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
 * A magnitude always governs the most-plural form a language has, so this takes the LAST entry outright
 * rather than routing a count through `countForm`. The previous code passed the literal 2 as a *count*,
 * which for the Slavic selector means the paucal — so a Slavic language declaring magnitudes would read
 * "5 миллионов долларА" instead of the required genitive plural "долларов". Found by the Polish run,
 * reading the code rather than probing; it is latent only because Russian declared no magnitudes at all.
 */
function withMagnitude(
    forms: CountForms,
    mag: string | undefined,
    n: number,
    countForm: (n: number) => number,
): string {
    return mag !== undefined && mag !== "" ? forms[forms.length - 1]! : pick(forms, n, countForm);
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
    const magAlt = d.magnitudes?.length
        ? `(\\s+(?:${[...d.magnitudes].sort((a, b) => b.length - a.length).join("|")}))?`
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
    const CUR = `(?<![\\p{L}\\p{M}])(?:${curKeys})(?![\\p{L}\\p{M}])`;
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
    const unitRe = d.units
        ? new RegExp(
            `(${NUM})\\s?(${unitAlt})(?:\\s?/\\s?(${denomKeys})|(\u00b2|\u00b3|(?<=[a-zA-Z])[23](?![\\d\\p{L}])))?(?![\\p{L}\\p{M}])`,
            "giu",
        )
        : null;
    // BOTH percent signs. U+066A ٪ is the Arabic-script one, and the tier used to know only ASCII `%`, so
    // ar, ur and fa each pre-folded it in their own normalize.ts before this tier could see it. Accepting
    // it here makes those folds harmless no-ops and means the next Arabic-script language gets it free.
    const PCT = "[%\u066a]";
    const pctRe = new RegExp(`(${NUM})\\s?${PCT}`, "gu");
    // The %-before-number form (%40). The lookbehind stops a misfire after other rules run: currency turns
    // "88% $2" into "88% 2 doler", and without the guard this rule would glue "% 2" into 88's replacement.
    const pctPreRe = new RegExp(`(?<!\\d)${PCT}\\s?(${NUM})`, "gu");

    return (text: string): string => {
        let s = text;
        // "cinco millones DE dólares" — emitted only when a magnitude was actually matched.
        const join = (mag: string | undefined): string =>
            mag !== undefined && mag !== "" && d.magnitudeConnective !== undefined
                ? `${d.magnitudeConnective} `
                : "";
        if (curBefore)
            s = s.replace(curBefore, (_m, sym: string, num: string, mag?: string) => {
                const w = withMagnitude(d.currency![sym]!, mag, numValue(num), cf);
                return `${num}${mag ?? ""} ${join(mag)}${w}`;
            });
        if (curAfter)
            s = s.replace(curAfter, (_m, num: string, mag: string | undefined, sym: string) => {
                const w = withMagnitude(d.currency![sym]!, mag, numValue(num), cf);
                return `${num}${mag ?? ""} ${join(mag)}${w}`;
            });
        if (d.percentPrefix) {
            s = s.replace(pctPreRe, (_m, num: string) => `${pick(d.percent, numValue(num), cf)} ${num}`);
            s = s.replace(pctRe, (_m, num: string) => `${pick(d.percent, numValue(num), cf)} ${num}`);
        } else {
            s = s.replace(pctPreRe, (_m, num: string) => `${num} ${pick(d.percent, numValue(num), cf)}`);
            s = s.replace(pctRe, (_m, num: string) => `${num} ${pick(d.percent, numValue(num), cf)}`);
        }
        if (unitRe)
            s = s.replace(unitRe, (whole, num: string, u: string, denom?: string, exp?: string) => {
                const head = pick(d.units![u.toLowerCase()]!, numValue(num), cf);
                if (denom !== undefined) {
                    // A rate needs both nouns and the connective; without any of them leave the text
                    // alone rather than emit half a reading.
                    const dl = denom.toLowerCase();
                    const dWord = d.units?.[dl]?.[0] ?? d.rateDenominators?.[dl];
                    if (d.unitPer === undefined || dWord === undefined) return whole;
                    return `${num} ${head} ${d.unitPer} ${dWord}`;
                }
                if (exp !== undefined) {
                    const forms = exp === "\u00b3" || exp === "3" ? d.exponentWords?.cubed : d.exponentWords?.squared;
                    if (forms === undefined) return whole; // not declared ⇒ untouched, as before
                    // Count forms, because in Romance the measure word is an ADJECTIVE and agrees:
                    // "un kilómetro cuadrado" vs "cincuenta kilómetros cuadrados".
                    const word = pick(forms, numValue(num), cf);
                    const pos = d.exponentWords?.position ?? "after";
                    if (pos === "compound") return `${num} ${word}${head}`;
                    return pos === "before" ? `${num} ${word} ${head}` : `${num} ${head} ${word}`;
                }
                return `${num} ${head}`;
            });
        return s;
    };
}
