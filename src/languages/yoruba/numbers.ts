/**
 * Yoruba cardinal numbers — a VIGESIMAL system with both addition and subtraction.
 *
 * Before this file every digit read in ENGLISH: `1945` → *wˈʌn θˈaᶷzənd nˈaᶦn hˈʌndɹəd fˈɔːɹt̬i fˈaᶦv*, because
 * Yoruba's Latin fallback is an English phonemizer. Fluent English inside Yoruba speech is worse for TTS than
 * silence, and it was happening to every number in a 46M-speaker language.
 *
 * THE SYSTEM, read off a 112,738-paragraph yo.wikipedia dump (see yoruba.jsonc for every count):
 *   · 1-10 are the free unit words; 11-14 are unit + `lá` (méjìlá 12).
 *   · ⚠ 1-4 PAST A TEN ARE ADDITIVE, 5-9 ARE SUBTRACTIVE FROM THE TEN ABOVE. 24 is mẹ́rìn-lé-lógún
 *     ("four exceeding twenty", 103 hits); 26 is mẹ́rìn-dín-lọ́gbọ̀n ("four less than thirty", 54). So the
 *     spoken form of a number depends on its LAST DIGIT in a way no decimal system does, and 86 of the 89
 *     values 11-99 are attested in the corpus by the exact spelling this file generates.
 *   · Hundreds are their own irregular words (igba 200, irinwó 400, ẹgbẹ̀ta 600), each corpus-glossed.
 *   · Magnitude FIRST, multiplier second, joined to a remainder by `ó lé`.
 *   · ⚠ `lọ́nà` multiplies when the multiplier is above ten: `ẹgbẹ̀rún méjì` is 2,000 but 32,000 is
 *     `ẹgbẹ̀rún lọ́nà méjìlélọ́gbọ̀n`.
 *
 * ⚠ ABOVE 10¹² AND FOR NON-FINITE INPUT IT READS DIGIT BY DIGIT in Yoruba units — the fallback chichewa and
 * igbo both use above their ceiling. An unidiomatic Yoruba reading of a huge number is a far smaller error than
 * a confident English one, and it is what guarantees no digit reaches the foreign path again.
 *
 * The anchor is the corpus's own glosses, reproduced as tests in test/yorubaNumbers.test.ts. Yoruba HAS
 * referees (wikipron yor, kaikki yor) but they are word→IPA: they can check how a numeral is PRONOUNCED, never
 * whether it is the right numeral, so the glosses are the only thing that adjudicates composition.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/** 1-10 as free-standing words. */
function unit(n: number): string {
    return N.units[n]!;
}

/**
 * 11-99. The last digit decides the shape: 1-4 additive on the ten below, 5-9 subtractive from the ten above.
 *
 * ⚠ 15 AND 25 ARE IRREGULAR AND THE IRREGULAR FORM IS THE COMMON ONE — mẹ́ẹ̀ẹ́dógún 127 against the regular
 * márùndínlógún 29. From 35 up only the regular form is attested, so this is two entries, not a pattern.
 */
function below100(n: number): string {
    if (n === 15) return N.fifteen;
    if (n === 25) return N.twentyFive;
    // ⚠ THE UNIT GUARD COMES FIRST. Without it `2` fell through to the teens arm and read *méjìlá* (12) — the
    // fusing form plus `lá` — because the arm was bounded above (n < 15) and not below.
    if (n < 11) return unit(n);
    const u = n % 10;
    if (u === 0) return N.tens[String(n)]!.free;
    if (n < 15) return `${N.front[u]!}${N.teen}`;          // 11-14: unit + lá
    const lower = n - u;
    if (u <= 4) return `${N.front[u]!}${N.add}${N.tens[String(lower)]!.fused}`;
    // 5-9: (10 − u) less than the ten above
    return `${N.front[10 - u]!}${N.subtract}${N.tens[String(lower + 10)]!.fused}`;
}

/** 100-999: an irregular hundred word, plus any remainder joined by `ó lé`. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100), rest = n % 100;
    const hundred = N.hundreds[h]!;
    return rest === 0 ? hundred : `${hundred} ${N.join} ${below1000(rest)}`;
}

/**
 * A magnitude and its multiplier. Below eleven the multiplier follows directly (`ẹgbẹ̀rún méjì`); above it
 * `lọ́nà` intervenes (`ẹgbẹ̀rún lọ́nà méjìlélọ́gbọ̀n`), and ×1 is the irregular `kan`.
 */
function scaled(magnitude: string, multiplier: number): string {
    if (multiplier === 1) return `${magnitude} ${N.multiplierOne}`;
    if (multiplier <= 10) return `${magnitude} ${unit(multiplier)}`;
    return `${magnitude} ${N.times} ${below1000(multiplier)}`;
}

/**
 * Reads each digit separately, in Yoruba units — the floor, so nothing ever escapes to English.
 *
 * ⚠ IT TAKES THE DIGIT STRING, NEVER A NUMBER, and that is a correctness fix rather than a style choice. The
 * first version was reached as `digitByDigit(String(n))`, and above 1e21 JavaScript stringifies to EXPONENTIAL
 * notation: `1e+21` was read as *ọ̀kan e + méjì ọ̀kan* — the letters `e` and `+` voiced as words, with an `e˧`
 * phoneme landing mid-number. Worse, `Number` had already lost the digits: a 24-digit run became
 * 1.2345678901234568e+23, so the digits actually spoken were not the digits given. Reading the string keeps every
 * digit and cannot produce a character that is not one.
 */
function digitByDigit(digits: string): string {
    return [...digits].map((ch) => {
        const d = Number(ch);
        return Number.isNaN(d) ? "" : d === 0 ? N.zero : unit(d);
    }).filter((x) => x !== "").join(" ");
}

/**
 * A run of DIGITS → its Yoruba cardinal reading. The string form is what the engine calls: it preserves every
 * digit of a run too long for a `number`, where `Number` would both lose precision and stringify to exponential
 * notation. See `digitByDigit`.
 */
export function yorubaNumber(digits: string): string {
    const n = Number(digits);
    // Not a safe integer → read the given digits, not a rounded reconstruction of them.
    return Number.isSafeInteger(n) ? yorubaCardinal(n) : digitByDigit(digits);
}

/** A non-negative integer → its Yoruba cardinal reading. */
export function yorubaCardinal(n: number): string {
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n) || !Number.isSafeInteger(n))
        return digitByDigit(Number.isFinite(n) ? String(Math.abs(Math.trunc(n))) : "");
    if (n === 0) return N.zero;
    if (n < 1000) return below1000(n);
    for (const [limit, word] of [[1e6, N.thousand], [1e9, N.million], [1e12, N.billion]] as const) {
        const base = limit / 1000;
        if (n < limit) {
            const mult = Math.floor(n / base), rest = n % base;
            const head = scaled(word, mult);
            return rest === 0 ? head : `${head} ${N.join} ${yorubaCardinal(rest)}`;
        }
    }
    return digitByDigit(String(n));
}

/** Every run of digits in `text` → its Yoruba cardinal reading. */
export function readYorubaNumbers(text: string): string {
    return text.replace(/\p{Nd}+/gu, (m) => yorubaNumber(m));
}
