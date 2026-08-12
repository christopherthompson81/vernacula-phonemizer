/**
 * Mongolian (Khalkha) cardinal number compositor → a Cyrillic number-word string (the tokenizer phonemizes each word
 * through the g2p, so the numbers stay in our convention). Khalkha numerals inflect: an ABSOLUTE form utterance-
 * finally, an ATTRIBUTIVE form when another number word follows (гурав→гурван, хорь→хорин, зуу→зуун). We build the
 * word sequence, then render every word ATTRIBUTIVE except the last (арван тав = 15, хорин таван мянга = 25000). A
 * place word (зуу/мянга/сая/тэрбум) is bare for 1× (100=зуу) and takes a multiplier for ≥2 (200=хоёр зуу).
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

interface W {
    abs: string;
    attr: string;
}
const unit = (d: number): W => ({ abs: N.units[d]!, attr: N.unitsAttr[d]! });
const ten = (d: number): W => ({ abs: N.tens[d]!, attr: N.tensAttr[d]! });
const place = (w: string, attr: string): W => ({ abs: w, attr });

/** Ordered word list for n (each word carries its absolute + attributive form). */
function words(n: number): W[] {
    if (n === 0) return [unit(0)];
    const out: W[] = [];
    const big = (divisor: number, w: string, attr: string): void => {
        const q = Math.floor(n / divisor);
        if (q === 0) return;
        if (q >= 2) out.push(...words(q)); // a multiplier ≥2 precedes the place word (1× is bare)
        out.push(place(w, attr));
        n %= divisor;
    };
    big(1_000_000_000, N.billion, N.billion);
    big(1_000_000, N.million, N.million);
    big(1000, N.thousand, N.thousandAttr);
    big(100, N.hundred, N.hundredAttr);
    if (n >= 10) { out.push(ten(Math.floor(n / 10))); n %= 10; }
    if (n > 0) out.push(unit(n));
    return out;
}

/**
 * THE DIGIT-AT-A-TIME READING — the fallback for a digit run `numberToWords` must refuse.
 *
 * ⚠ ABOVE 2^53 `numberToWords` RETURNS "" AND THE NUMBER USED TO VANISH FROM THE READING: the caller split
 * that "" and emitted nothing, so the sentence still scanned with the numeral simply gone. The refusal is
 * right — `Number()` has already lost the low digits, so the composed words would be silently WRONG — but it
 * needed an else. Digit words are `N.units`, already authored; nothing is invented, and above 2^53 the
 * reading is a digit string rather than a quantity.
 *
 * Each digit is its own utterance here, so every one takes the ABSOLUTE form (гурав, not attributive гурван)
 * — attributive is precisely the "another number word follows in the same numeral" form, which is not what a
 * read-out digit string is.
 */
export function spellDigits(digits: string): string {
    return [...digits]
        .filter((c) => c >= "0" && c <= "9")
        .map((c) => unit(Number(c)).abs)
        .join(" ");
}

/** n → Cyrillic number words (space-separated); attributive for every word but the last. */
export function numberToWords(n: number): string {
    // Guard beyond 2^53: Number() has already lost precision, so the composed words would be silently WRONG.
    if (!Number.isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER) return "";
    const ws = words(Math.floor(n));
    return ws.map((w, i) => (i < ws.length - 1 ? w.attr : w.abs)).join(" ");
}
