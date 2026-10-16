/**
 * Kazakh (kk) cardinal number compositor. Kazakh number words are lexical (their stress and a few
 * segments don't follow the regular g2p — жиырма is final-stressed, алпыс has a clear l, нөл has ø), and the
 * compositor concatenates tens+units and the hundred-multiplier WITHOUT a space (онбір, жиырмабір, екіжүз) but
 * separates magnitude groups WITH a space (бір мың екіжүз отызтөрт). So this returns finished canonical IPA
 * directly, rather than routing Kazakh text through the g2p.
 * 100 omits the leading 1 (жүз, not біржүз); 1000 keeps it (бір мің).
 */

import { MANIFEST } from "./manifest.ts";

// Number forms are authored DATA (finished IPA atoms) — consolidated in kazakh.jsonc; the compositor is the algorithm.
const N = MANIFEST.numbers;
const UNIT = N.units,
    TENS = N.tens,
    HUNDRED = N.hundred,
    THOUSAND = N.thousand,
    MILLION = N.million;
/** The scales from 10⁶ up, highest first: [word, 1000ⁿ]. Each, like the million, omits a leading 1. */
const HIGH_SCALES: readonly (readonly [string, number])[] = [
    [N.trillion, 1e12],
    [N.milliard, 1e9],
    [MILLION, 1e6],
];

/** 0–99 → concatenated IPA (tens and units glued. */
function sub100(n: number): string {
    if (n < 10) return UNIT[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return TENS[t]! + (u ? UNIT[u]! : "");
}

/** 0–999 → IPA; the hundred-multiplier is glued (екіжүз) but the sub-hundred remainder is space-separated. */
function sub1000(n: number): string {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return sub100(r);
    const hp = h === 1 ? HUNDRED : UNIT[h]! + HUNDRED; // 100 omits the leading 1
    return r ? `${hp} ${sub100(r)}` : hp;
}

/** A non-negative integer → space-separated canonical IPA (magnitude groups spaced, sub-groups glued). */
export function numberToIpa(n: number): string {
    if (n < 0 || !Number.isFinite(n)) return "";
    n = Math.floor(n);
    if (n < 1000) return sub1000(n);
    const groups: string[] = [];
    for (const [word, size] of HIGH_SCALES) {
        const count = Math.floor(n / size);
        n %= size;
        if (count) groups.push(count === 1 ? word : `${numberToIpa(count)} ${word}`); // omits the leading 1
    }
    const th = Math.floor(n / 1000);
    n %= 1000;
    if (th) groups.push(`${th === 1 ? UNIT[1]! : sub1000(th)} ${THOUSAND}`); // 1000 keeps it: бір мің
    if (n) groups.push(sub1000(n));
    return groups.join(" ");
}

/** A written digit run → IPA. Past 2⁵³ the double has already lost the low digits, so the run is read digit by
 *  digit (core/numbers.ts `spellDigits` has the account); before #1576 it was composed from the rounded double. */
export function digitsToIpa(digits: string): string {
    const n = Number(digits);
    if (/^\d+$/u.test(digits) && !Number.isSafeInteger(n)) return [...digits].map((c) => UNIT[Number(c)]!).join(" ");
    return numberToIpa(n);
}
