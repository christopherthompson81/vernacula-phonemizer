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

/** A bare digit run. Grouping separators and a decimal point stay inside it so the target's own compositor
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
 * and a run adjacent to `:` or `.` is refused outright.
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
const GROUPED = String.raw`\d{1,3}(?:[  ,]\d{3})+`;
const DIGIT_RUN = new RegExp(String.raw`(?<![\d:.,])(?:${GROUPED}|\d+)(?![\d:.,])`, "gu");

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
 * ⚠ IT EMITS WORDS, NOT IPA, so the host engine still phonemizes them — which is what a reader does: a Shona
 * speaker saying "four hundred eighty" produces English words in a Shona phonetic setting, not English
 * phonemes. Emitting IPA here would also break the host's clause assembly, which counts tokens.
 */
export function applyNumeralRegister(text: string, registryCode: string): string {
    const reg = NUMERAL_REGISTER[registryCode];
    if (reg === undefined || !/\d/u.test(text)) return text;
    return text.replace(DIGIT_RUN, (run) => {
        const digits = run.replace(/[  ,]/gu, "");
        const n = Number(digits);
        // ⚠ A LEADING ZERO IS NOT A CARDINAL. `007`, `00` and `000-160` are identifiers or the tail of a
        //   grouped number, and `Number()` silently drops the zeros — `007` would read *seven*. 252 rows
        //   in the wired languages contain one.
        // ⚠ AND THE COMPOSITORS ARE BOUNDED: above 999,999,999,999 both stop composing, so hand back the
        //   digits rather than emit a truncated reading.
        if (digits.length > 1 && digits.startsWith("0")) return run;
        if (!Number.isSafeInteger(n) || n < 0 || n > 999_999_999_999) return run;
        return ` ${reg === "fr" ? frWords(n) : enWords(n)} `;
    });
}

/** The languages with a measured register, for the corpus tooling to report what it applied. */
export const NUMERAL_REGISTER_LANGS: readonly string[] = Object.keys(NUMERAL_REGISTER);
