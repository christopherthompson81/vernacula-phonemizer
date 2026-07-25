/**
 * Slovak (sk) cardinal number compositor. Returns composed Slovak TEXT (space-separated) that the phonemizer runs
 * through the g2p, so the IPA stays consistent with the word engine. Tens+units concatenate (dvadsaťjeden = 21);
 * hundreds and thousands are space-separated. Slovak thousand/million agreement: 1 tisíc/milión, 2–4 tisíc/milióny,
 * 5+ tisíc/miliónov (paucal 2–4). See docs/investigations/sk_native_bringup_investigation.md.
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

/** A non-negative integer → space-separated Slovak cardinal words. */
export function numberToWords(n: number): string {
    if (n < 0 || !Number.isFinite(n)) return "";
    n = Math.floor(n);
    if (n === 0) return UNITS[0]!; // nula
    const parts: string[] = [];
    const mil = Math.floor(n / 1000000);
    n %= 1000000;
    if (mil) parts.push((mil === 1 ? "" : `${sub1000(mil)} `) + agree(mil, MAG.million));
    const th = Math.floor(n / 1000);
    n %= 1000;
    if (th) parts.push(th === 1 ? MAG.thousand.sg : `${sub1000(th)} ${agree(th, MAG.thousand)}`);
    if (n) parts.push(sub1000(n));
    return parts.join(" ");
}
