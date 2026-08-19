/**
 * PER-LANGUAGE NUMERAL REGISTER — the language a reader voices a bare digit run in, when that is not the
 * host language. A corpus-rendering choice, applied to the TEXT before the engine sees it.
 *
 * ⚠ THIS IS CORPUS POLICY, NOT PHONEMIZER CORRECTNESS, and that is why it lives here rather than in
 * `src/registry.ts`. Wiring it into the engine was tried and reverted: it silently overrode each language's
 * own cardinal compositor, breaking 31 gold tests that encode real work — Chichewa's noun-class agreement
 * (`makumi anaji ⁿdi ziwiɽi` for 42) among them. `phonemize("1", "nya")` must stay *t͡ʃimod͡zi*; that is the
 * language's own fact. What a FLEURS news reader does with the digit `1` is a fact about this corpus, and
 * `tools/corpus/asr-align/README.md` already draws exactly this line — rendering choices are "training-corpus
 * policy, not phonemizer correctness".
 *
 * ⚠ EVERY ENTRY IS MEASURED AGAINST AUDIO, NOT INFERRED FROM THE REGION. Each candidate register was scored
 * over that language's whole digit-bearing corpus by re-phonemizing the digit runs in the candidate and
 * comparing to a phone recognizer's output. Only the CLEAN languages are wired
 * (docs/investigations/asr_align_qc_investigation.md run 19):
 *
 *     sn  381 closer /  19 further  (95%)      nya 378 /  19  (95%)
 *     zu  379 closer /  21 further  (95%)      xh  362 /  38  (91%)
 *     ln  → FRENCH, 89%
 *
 * ⚠ `ln` IS FRENCH AND WOULD HAVE BEEN WIRED TO ENGLISH BY ANALOGY with the other African languages. It
 * scores 66% for English against 89% for French — testing only the obvious candidate would have applied the
 * wrong language at a rate that still looked like an improvement. Every entry was scored against en, fr AND
 * es, and Maltese is the control that makes a low score interpretable: it reads native under all three
 * (fr 6%, en 4%, es 4%), so a low English score means "reads its own numerals", not "reads some other
 * foreign one".
 *
 * ⚠ AND THE ABSENT LANGUAGES ARE ABSENT ON EVIDENCE. de, fr, bn, ckb and mt read their own numerals — fr
 * scores 3 closer against 397 further — so this is an opt-in table, never a default with exceptions. Four
 * more (ceb, ig, mi, fil) measured 62–85%: genuine reader-to-reader variation rather than a register, and
 * a third of their rows would get worse. Read the investigation's table before adding to this one.
 *
 * ⚠ KEYS ARE REGISTRY CODES, NOT FLEURS CODES. FLEURS writes `ny_mw` and this registry ships Chichewa as
 * `nya`; a key that is not a registered code is silently dead. Checked against the registry's key set.
 */
const NUMERAL_REGISTER: Readonly<Record<string, "en" | "fr">> = {
    sn: "en", nya: "en", zu: "en", xh: "en", ln: "fr",
};

/**
 * A bare digit run, with grouping separators kept inside it so the target's compositor sees `1,234` whole.
 *
 * ⚠ IT MUST DECLINE EVERY SHAPE THE REGISTER WAS NOT MEASURED ON. The measurement covered plain cardinals;
 * the corpus contains other readings that a cardinal compositor silently mangles, all attested in the five
 * wired languages:
 *
 *     clock       `dza10:08`, `kuma9:30`, `11:20`   109 rows — a time, not two cardinals
 *     dec comma   `2,8`, `3,5`, `ezingu-1,5`         42 rows — EUROPEAN DECIMAL, not grouping. Read as
 *                                                             grouping, `1,5` comes out *fifteen*.
 *     decimal     `1.5`, `1:09.2`                             its own reading in every language
 *
 * So a separator only joins when EXACTLY three digits follow it — `1,5` and `2,8` fall through untouched —
 * and a run whose next character makes it a clock or a decimal is refused outright.
 *
 * ⚠ A GROUPED NUMBER USES ONE SEPARATOR THROUGHOUT, and saying so is what keeps two of them apart. With the
 * separators interchangeable, `783,562 300,948` — two 6-digit figures in a table — matched as a SINGLE
 * 12-digit run and read as *seven hundred eighty three billion…*. Anchoring the separator to whichever one
 * the run opened with splits it back into two numbers. 4 rows, all of this shape.
 *
 * ⚠ SENTENCE PUNCTUATION IS NOT A DECIMAL POINT. The lookahead used to refuse any run touching `.` or `,`,
 * which also refused every run at the end of a clause — `na 1992.`, `kv62.`, `1469-1539.` — 28 rows of
 * ordinary cardinals declined for a shape they did not have. Only `.`/`,` FOLLOWED BY A DIGIT is a decimal;
 * `:` stays refused unconditionally, since a trailing colon in this corpus is a clock.
 *
 * ⚠ DECLINING THESE COSTS ~115 ROWS ON THE DISTANCE METRIC, AND IS STILL RIGHT. Reading them as bare
 * cardinals scores BETTER than declining — for clock times, 102 rows beat the baseline against 16 — because
 * a wrong reading still overlaps the audio more than the host's native one does. But it IS wrong: the
 * recognizer shows Lingala readers saying `11:00` as *onz ʒyst* (onze juste) and `11:20` as *uz vent*
 * (onze vingt), real French clock readings rather than two cardinals. Emitting "onze vingt" as
 * "eleven twenty" would score well for the wrong reason. The metric cannot separate "right" from
 * "phonetically overlapping by accident", so a shape whose CORRECT reading is not implemented is declined
 * rather than approximated.
 *
 * The opportunity is real and quantified: a proper clock and decimal reading in the register language is
 * worth roughly 115 rows across the five wired languages.
 */
const GROUPED = String.raw`\d{1,3}(?:,\d{3})+|\d{1,3}(?:[  ]\d{3})+`;
const DIGIT_RUN = new RegExp(String.raw`(?<![\d:.,])(?:${GROUPED}|\d+)(?![\d:])(?![.,]\d)`, "gu");

const EN_ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const FR_ONES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
    "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];

function enWords(n: number): string {
    if (n < 20) return EN_ONES[n]!;
    if (n < 100) return EN_TENS[Math.floor(n / 10)]! + (n % 10 ? " " + EN_ONES[n % 10]! : "");
    if (n < 1000) return EN_ONES[Math.floor(n / 100)]! + " hundred" + (n % 100 ? " " + enWords(n % 100) : "");
    for (const [v, w] of [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"]] as const) {
        if (n >= v) return enWords(Math.floor(n / v)) + " " + w + (n % v ? " " + enWords(n % v) : "");
    }
    return String(n);
}

function frWords(n: number): string {
    if (n < 20) return FR_ONES[n]!;
    if (n < 70) {
        const t = Math.floor(n / 10), u = n % 10;
        const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"][t]!;
        return u === 0 ? tens : u === 1 ? `${tens} et un` : `${tens}-${FR_ONES[u]!}`;
    }
    if (n < 80) return n === 71 ? "soixante et onze" : `soixante-${FR_ONES[n - 60]!}`;
    if (n < 100) return n === 80 ? "quatre-vingts" : `quatre-vingt-${FR_ONES[n - 80]!}`;
    if (n < 1000) {
        const h = Math.floor(n / 100), r = n % 100;
        const head = h === 1 ? "cent" : `${FR_ONES[h]!} cent${r === 0 ? "s" : ""}`;
        return r ? `${head} ${frWords(r)}` : head;
    }
    for (const [v, w] of [[1e9, "milliard"], [1e6, "million"]] as const) {
        if (n >= v) {
            const q = Math.floor(n / v);
            return `${q === 1 ? "un" : frWords(q)} ${w}${q > 1 ? "s" : ""}${n % v ? " " + frWords(n % v) : ""}`;
        }
    }
    const q = Math.floor(n / 1000);
    return `${q === 1 ? "mille" : `${frWords(q)} mille`}${n % 1000 ? " " + frWords(n % 1000) : ""}`;
}

/**
 * Rewrite each digit run in `text` into the register language's WORDS, or return `text` unchanged when the
 * language has no measured register.
 *
 * ⚠ IT RETURNS SEGMENTS, so each is phonemized by the engine that owns it and the IPA is joined afterwards.
 * Two simpler shapes were tried and both are wrong:
 *
 *   · emitting the register's SPELLING into the host text — the host then applies its own grapheme rules,
 *     which is a misreading rather than an accent: `eight` → *ˈɛːiɡ̤htʼ* in Zulu (letter by letter), `mille`
 *     → *mi˩lle˩* in Lingala, and Shona has no rule for the letters at all so raw `thousaⁿd` reached the IPA.
 *   · splicing IPA into the host text — the host tokenizes and RE-READS it, destroying it outright
 *     (`fˈɔːɹ` came back as *f o*). IPA cannot travel through a text channel the host will re-parse.
 *
 * Segments avoid both: the register's own engine reads its own words, and nothing re-reads the result.
 */
export interface Segment {
    readonly text: string;
    /** `undefined` = the host language reads this segment. */
    readonly lang?: "en" | "fr";
}

/** Split `text` into segments, digit runs carrying their register. One segment when nothing applies. */
export function numeralSegments(text: string, registryCode: string): readonly Segment[] {
    const reg = NUMERAL_REGISTER[registryCode];
    if (reg === undefined || !/\d/u.test(text)) return [{ text }];
    const out: Segment[] = [];
    let last = 0;
    for (const m of text.matchAll(DIGIT_RUN)) {
        const words = registerWords(m[0], reg, text.slice(m.index + m[0].length));
        if (words === undefined) continue;
        if (m.index > last) out.push({ text: text.slice(last, m.index) });
        out.push({ text: words, lang: reg });
        last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last) });
    return out.length ? out : [{ text }];
}

/**
 * ⚠ A YEAR IS NOT ITS CARDINAL, AND THE ENGLISH ENGINE CANNOT SEE THAT FROM A SEGMENT. English reads 1998
 * as *nineteen ninety-eight*; the register was emitting *one thousand nine hundred ninety eight*. The engine
 * already knows the pair-wise reading — `src/languages/english/normalize.ts` `yearWords` — but gates it on
 * an ENGLISH context word (`in`, `since`, a month), and the context around a digit run in a Shona sentence
 * is Shona. The register therefore decides year-ness itself, and emits the same digit-pair tokens that
 * helper does (`1998` → `"19 98"`), so the English number path composes the words rather than this file.
 *
 * Worth 681 rows across the four English-register languages, 600 closer against 81 further (88%), mean
 * 0.3977 → 0.3555. Every one of the four improves. `ln` is unaffected and correctly so: French reads a year
 * as its cardinal — *mil neuf cent quatre-vingt-dix-huit* — which is what the register already emitted.
 *
 * ⚠ THE RANGE AND THE UNIT GUARD ARE THE ENGLISH NORMALIZER'S, DELIBERATELY. 1100–2099 excludes `1000`
 * (26 rows, and "one thousand" is right), and a run followed by a unit is a QUANTITY: the corpus's
 * `1600 km` trail is *one thousand six hundred kilometres*, not *sixteen hundred*. The unit evidence here
 * is only 2 rows — both further from the audio under a year reading — so the guard is carried over from the
 * engine's rule on principle rather than established independently.
 *
 * ⚠ AND `ma 1700` STAYS A YEAR. The plural-decade shape ("muzaka zama 1700", the 1700s) reads *seventeen
 * hundred* and scores 27 closer against 1; it needs no separate rule.
 */
const YEAR = /^(?:1[1-9]\d\d|20\d\d)$/u;
const UNIT_FOLLOWS = /^[  ]*-?[  ]*(?:km|kg|cm|mm|ha|mi|ft|m|%|percent|met(?:er|re)s?|kilomet(?:er|re)s?|miles?)\b/iu;

/** A year in the pair-wise reading, as tokens the English number path expands: `1998` → `"19 98"`,
 *  `1905` → `"19 oh 5"`, `1900` → `"19 hundred"`, `2007` → `"2 thousand 7"`, `2011` → `"20 11"`. */
function yearTokens(y: number): string {
    const hi = Math.floor(y / 100), lo = y % 100;
    if (y < 2010 && y >= 2000) return lo === 0 ? "2 thousand" : `2 thousand ${lo}`;
    if (lo === 0) return `${hi} hundred`;
    if (lo < 10) return `${hi} oh ${lo}`;
    return `${hi} ${lo}`;
}

/** The register reading of one digit run, or `undefined` for a shape the register does not claim.
 *  `after` is the text following the run, which the year rule needs to see a unit. */
function registerWords(run: string, reg: "en" | "fr", after: string): string | undefined {
    if (reg === "en" && YEAR.test(run) && !UNIT_FOLLOWS.test(after)) return yearTokens(Number(run));
    {
        const digits = run.replace(/[  ,]/gu, "");
        const n = Number(digits);
        // ⚠ A LEADING ZERO IS NOT A CARDINAL. `007`, `00` and `000-160` are identifiers or the tail of a
        //   grouped number, and `Number()` silently drops the zeros — `007` would read *seven*. 252 rows
        //   in the wired languages contain one.
        // ⚠ AND THE COMPOSITORS ARE BOUNDED: above 999,999,999,999 both stop composing, so hand back the
        //   digits rather than emit a truncated reading.
        if (digits.length > 1 && digits.startsWith("0")) return undefined;
        if (!Number.isSafeInteger(n) || n < 0 || n > 999_999_999_999) return undefined;
        return reg === "fr" ? frWords(n) : enWords(n);
    }
}

/** The languages with a measured register, for the corpus tooling to report what it applied. */
export const NUMERAL_REGISTER_LANGS: readonly string[] = Object.keys(NUMERAL_REGISTER);
