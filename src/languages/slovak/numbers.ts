/**
 * Slovak (sk) cardinal number compositor. Returns composed Slovak TEXT (space-separated) that the phonemizer runs
 * through the g2p, so the IPA stays consistent with the word engine. Tens+units concatenate (dvadsaťjeden = 21);
 * hundreds and thousands are space-separated. Slovak thousand/million agreement: 1 tisíc/milión, 2–4 tisíce/milióny,
 * 5+ tisíc/miliónov (paucal 2–4). Both magnitude nouns are MASCULINE INANIMATE, so the multiplier is dva, not dve —
 * see `count` below for the sources.
 */
import { MANIFEST } from "./manifest.ts";

const { units: UNITS, teens: TEENS, tens: TENS, hundreds: HUNDREDS, magnitudes: MAG } = MANIFEST.numbers;

/** 0–99 → Slovak text (tens and units concatenated: dvadsaťjeden). */
function sub100(n: number): string {
    if (n < 10) return UNITS[n]!;
    if (n < 20) return TEENS[n - 10]!;
    return TENS[Math.floor(n / 10)]! + (n % 10 ? UNITS[n % 10]! : "");
}

/** 0–999 → Slovak text (hundreds space-separated from the sub-hundred remainder). */
function sub1000(n: number): string {
    const h = Math.floor(n / 100);
    const r = n % 100;
    if (h === 0) return sub100(r);
    return HUNDREDS[h]! + (r ? ` ${sub100(r)}` : "");
}

/** Slovak agreement form for a magnitude count: 1 → sg, 2–4 → paucal, else → genitive-plural. */
function agree(count: number, forms: { sg: string; paucal: string; plural: string }): string {
    return count === 1 ? forms.sg : count >= 2 && count <= 4 ? forms.paucal : forms.plural;
}

/**
 * A magnitude count as text. NO gender switch: both magnitude nouns here are MASCULINE INANIMATE — tisíc is
 * `m-in` with nom.pl tisíce / gen.pl tisícov, and milión likewise (en.wiktionary.org/wiki/tisíc#Slovak,
 * en.wiktionary.org/wiki/milión#Slovak) — and the masculine-inanimate form of "two" is *dva*, not *dve*:
 * "The form dva is used with masculine inanimate nouns, while the form dve is used for both feminine and
 * neuter nouns" (en.wiktionary.org/wiki/dva#Slovak; en.wikipedia.org/wiki/Slovak_declension gives
 * "dva (masc. inanimate); dve (otherwise)"). This previously forced "dve" and emitted *dve tisíce / *dve
 * milióny; the agreeing forms are dva tisíce / dva milióny — matching Czech's dva tisíce (czech/numbers.ts).
 */
function count(n: number): string {
    return sub1000(n);
}

/** Read a raw digit STRING digit-by-digit (nula/jeden/…) — the fallback for out-of-range or over-long numbers
 *  (Slovak has no miliarda tier here). Operates on the string so no float precision is lost. */
export function readDigits(digits: string): string {
    return digits.split("").map((d) => UNITS[Number(d)] ?? d).join(" ");
}

/** A non-negative integer (< 1e9) → space-separated Slovak cardinal words. */
export function numberToWords(n: number, raw?: string): string {
    if (n < 0 || !Number.isFinite(n)) return "";
    n = Math.floor(n);
    if (n === 0) return UNITS[0]!; // nula
    if (n >= 1e9) return readDigits(raw ?? String(n)); // no miliarda tier → digit-by-digit
    const parts: string[] = [];
    const mil = Math.floor(n / 1000000);
    n %= 1000000;
    if (mil) parts.push((mil === 1 ? "" : `${count(mil)} `) + agree(mil, MAG.million));
    const th = Math.floor(n / 1000);
    n %= 1000;
    if (th) parts.push(th === 1 ? MAG.thousand.sg : `${count(th)} ${agree(th, MAG.thousand)}`);
    if (n) parts.push(sub1000(n));
    return parts.join(" ");
}
