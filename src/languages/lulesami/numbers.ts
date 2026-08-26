/**
 * Lule Sami (smj) cardinal number → words. **SYSTEM: NATIVE Uralic DECIMAL** — no borrowed numeral series is
 * involved below 10⁶ (the magnitude words `tuvsán` 10³ / `millijåvnnå` 10⁶ / `millijárdda` 10⁹ are old
 * Scandinavian loans, but they are the only forms the language has and every source agrees on them).
 *
 *   · SOURCE (primary): the Divvun/Giellatekno **Lule Sami digit→text transducer**,
 *   `giellalt/lang-smj:src/fst/transcriptions/transcriptor-numbers-digit2text.lexc` (GPL, University of Tromsø /
 *   Norwegian Sámi Parliament). That file is *itself* authored for this exact job — its own comments mark the
 *   preferred branch "for tekst-til-tale og andre normative verkty" (for text-to-speech and other normative
 *   tools) vs the `+Use/NG` (non-generating) variants. This composer reproduces the normative branch.
 *   · Corroborated by the same repo's `devtools/testdata/numeraler.txt` (real composed forms: `lågenanvihtta` 15,
 *   `nielljalåkvihtta` 45, `tjuohteguhttalåkniellja` 164, `guoktatuvsánvihttatjuohteaktse` 2509) and
 *   `src/fst/test/gt-norm-yamls/numerals_gt-norm.yaml` (`tjuohtegålmmå` 103, `tuvsánlågenanaktse` 1019,
 *   `tuvsántjuohtenielljalåkgålmmå` 1143, `guhttatuvsán` 6000).
 *   · 0 = `nålla` — NOT in the transducer (an FST that reads digit strings never needs a zero word); taken from
 *   Omniglot "Numbers in Lule Sámi" (https://www.omniglot.com/language/numbers/lulesami.htm). Units 1–9 and the
 *   `lågev`/`låhke`/`tjuohte` shape are independently confirmed there and by
 *   languagesandnumbers.com/how-to-count-in-lule-sami ("Tens are formed starting with the multiplier digit,
 *   directly followed by a form of the word for ten (låhke)"; that site's data stops at 100).
 *
 * ⚠ ORTHOGRAPHIC SHAPE — Lule Sami writes a cardinal SOLID, as ONE word, Finnish-style
 * (kaksikymmentäyksi ≈ guoktalåkakta), all the way through the thousands: 12 345 is the single word
 * `guoktalågenantuvsángålmmåtjuotnielljalåkvihtta`. Only 10⁶/10⁹ are separate words. Hence this composer
 * returns a string whose SPACES are real word boundaries (the caller phonemizes each space-separated word),
 * and there is exactly one space per million/milliard.
 *
 * The stem alternations are the interesting part, and all four are in the cited transducer:
 *   - 10 free `lågev` (LEXICON TENS `1%0:lågev`) vs 10 as a multiplicand `-låhke` (LÅGEV `%0:låhke`) vs
 *     `-låk-` before a following unit (LÅGEV `:låk ONES`): 20 `guoktalåhke`, 21 `guoktalåkakta`.
 *   - teens: ABSOLUTE `lågenan-` + unit (TEENS `1:lågenan ONES` → 15 `lågenanvihtta`), but as a MULTIPLIER of a
 *     magnitude the order flips to unit + `lågenan` (TEENT/LOHKAIT → 12 000 `guoktalågenantuvsán`). Both are
 *     the transducer's generating branch in their respective slots; the flip is not a typo here.
 *   - 100 has three stems in the transducer: free/final `tjuohte`, `tjuot` before a remainder (CUODI
 *     `:tjuot HUNDRED`), and `tjuode` as a magnitude multiplier (CUODIT/CUODIM `:tjuode`). We emit **`tjuohte`
 *     in both the free and the pre-remainder slot**, because the repo's own corpus testdata does exactly that in
 *     every instance — `gålmmåtjuohtegålmmålåkgålmmå` 333, `guoktatuvsánvihttatjuohteaktse` 2509,
 *     `vihttatuvsánnielljatjuohtegáktsalåkgáktsa` 5488, `tjuohteguhttalåkniellja` 164 — and the transducer's own
 *     Root uses `tjuohte` for 101–199. `tjuot` is therefore an attested variant this composer does not generate.
 *     (`tjuode` IS used, in the magnitude-multiplier slot, where it is the only generating branch.)
 *   - 7 is `gietjav` in the transducer everywhere; the corpus testdata uses the combining stem `giehtja-`
 *     inside compounds (`giehtjalåkguhtta` 76). We use `gietjav` uniformly (the transducer's normative form).
 *
 * SIMPLIFICATIONS (all documented, none invented):
 *   - `tuvsán` is used unchanged after every multiplier. The gt-norm yaml shows a plural `tuvsána` when the
 *     thousand is followed by a remainder (`gålmmåtuvsánavihttatjuode…` 3593); the digit→text transducer — the
 *     TTS-targeted file — emits plain `tuvsán` in that slot, so that is what we emit.
 *   - the transducer's `+Use/NG` variants are NOT emitted: `duhát` (for `tuvsán`), `niellje` (for `niellja`),
 *     `tjuode` before a remainder, and the unit+`lågenan` order below 100.
 *   - No leading `akta` before a bare magnitude: 100 `tjuohte`, 1000 `tuvsán`, 10⁶ `millijåvnnå`, 10⁹
 *     `millijárdda` — exactly as the transducer's Root does (`1:tjuohte`, `1:tuvsán`, `1MILJON`, `1GIGA`).
 *   - ATTESTED RANGE / FALLBACK: 0 … 10¹²−1. At 10¹² and above (and for any non-safe integer) this falls back
 *     to DIGIT-BY-DIGIT, because the transducer itself stops at the milliard (there is no attested Lule Sami
 *     word for 10¹²).
 */

// Units 1–9 (index 0 unused — a bare 0 is `nålla`, handled in numberToWords).
const UNITS = ["", "akta", "guokta", "gålmmå", "niellja", "vihtta", "guhtta", "gietjav", "gáktsa", "aktse"];
const ZERO = "nålla";
const TEN_FREE = "lågev"; // 10 standing alone
const TEN_TENS = "låhke"; // ×10 with no following unit (guoktalåhke 20)
const TEN_BOUND = "låk"; // ×10 with a following unit (guoktalåkakta 21)
const TEEN = "lågenan"; // the 11–19 element
const HUNDRED = "tjuohte"; // 100 / X00, free or before a remainder (corpus-attested in both slots)
const HUNDRED_MULT = "tjuode"; // X00 as a magnitude multiplier (CUODIT/CUODIM — the only branch there)
const THOUSAND = "tuvsán";
const MILLION = "millijåvnnå";
const MILLIARD = "millijárdda";

/** 1 ≤ n < 100. `mult` = this number multiplies a magnitude (flips the teen order to unit + lågenan). */
function below100(n: number, mult: boolean): string {
    if (n < 10) return UNITS[n]!;
    if (n === 10) return TEN_FREE;
    if (n < 20) return mult ? UNITS[n - 10]! + TEEN : TEEN + UNITS[n - 10]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? UNITS[t]! + TEN_TENS : UNITS[t]! + TEN_BOUND + UNITS[u]!;
}

/** 1 ≤ n < 1000, written solid. `mult` selects the magnitude-multiplier hundred stem `tjuode`. */
function below1000(n: number, mult: boolean): string {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return below100(n, mult);
    const head = h === 1 ? HUNDRED : UNITS[h]! + (mult ? HUNDRED_MULT : HUNDRED);
    return r === 0 ? head : head + below100(r, mult);
}

/** 1 ≤ n < 10⁶, written solid (the thousand and its remainder concatenate: 1001 → tuvsánakta). */
function below1e6(n: number): string {
    const th = Math.floor(n / 1000),
        r = n % 1000;
    if (th === 0) return below1000(n, false);
    const head = th === 1 ? THOUSAND : below1000(th, true) + THOUSAND;
    return r === 0 ? head : head + below1000(r, false);
}

/** Read a digit string one digit at a time (the above-10¹² / unsafe-integer fallback). */
export function readDigits(digits: string): string {
    return [...digits].map((d) => (d === "0" ? ZERO : (UNITS[Number(d)] ?? d))).join(" ");
}

/**
 * Non-negative integer → Lule Sami cardinal words, space-separated ONLY at the 10⁶/10⁹ seams (everything below
 * a million is one solid word). ≥10¹² or non-safe → digit-by-digit.
 */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12) return readDigits(raw ?? String(n));
    if (n === 0) return ZERO;
    if (n < 1e6) return below1e6(n);
    if (n < 1e9) {
        const m = Math.floor(n / 1e6),
            r = n % 1e6;
        const head = m === 1 ? MILLION : `${below1000(m, true)} ${MILLION}`;
        return r === 0 ? head : `${head} ${below1e6(r)}`;
    }
    const b = Math.floor(n / 1e9),
        r = n % 1e9;
    const head = b === 1 ? MILLIARD : `${below1000(b, true)} ${MILLIARD}`;
    return r === 0 ? head : `${head} ${numberToWords(r)}`;
}
