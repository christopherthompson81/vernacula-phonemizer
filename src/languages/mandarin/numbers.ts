/**
 * Arabic number → Chinese numeral characters (quantity reading). The result is spliced back into the Han
 * character stream and phonemized like any other characters, so it inherits segmentation, polyphone
 * disambiguation, and tone sandhi for free (e.g. 一百 → yì bǎi via the phrase dict). Covers integers up to
 * 10¹⁶ and simple decimals (整数 + 点 + digit-by-digit). 2 is read 二 throughout (二千 is understood; the
 * colloquial 两 alternation is a future refinement). Year/phone/ID digit-string readings are out of scope —
 * this is the default quantity reading.
 */

import { digitIndex } from "../../core/numbers.ts";
import { MANIFEST } from "./manifest.ts";

// Number-reading tables are authored DATA — consolidated in cmn.jsonc; the compositor below is the algorithm.
const N = MANIFEST.numbers;
const DIG = N.digits; // 0–9 (DIG[0] 零 doubles as the internal zero-gap filler)
const POS = N.positions; // position value within a 4-digit group
const BIG = N.bigUnits; // 10⁴ⁿ group multipliers
const TWO = N.two; // colloquial 两

/**
 * 0 ≤ n ≤ 9999 → characters, with a single internal 零 for zero gaps. `top` marks the highest group so 2 as a
 * leading multiplier of 百 reads 两 (两百五十) but a non-leading 二百 stays 二 (两千二百). 2 before 千 is always
 * 两; 2 in tens/units stays 二 (二十, 十二).
 */
function group4(n: number, top: boolean): string {
    let s = "";
    let zeroPending = false;
    const digits = [
        Math.floor(n / 1000) % 10,
        Math.floor(n / 100) % 10,
        Math.floor(n / 10) % 10,
        n % 10,
    ];
    for (let i = 0; i < 4; i++) {
        const d = digits[i]!;
        if (d === 0) {
            if (s !== "") zeroPending = true;
            continue;
        }
        if (zeroPending) {
            s += DIG[0]!;
            zeroPending = false;
        }
        let dig = DIG[d]!;
        if (d === 2 && i === 0)
            dig = TWO; // 千 → always 两千
        else if (d === 2 && i === 1 && s === "" && top) dig = TWO; // 百 → 两百 only when leading
        s += dig + POS[i]!;
    }
    return s;
}

/** Non-negative integer → Chinese numeral characters (quantity reading; colloquial 两 for standalone 2). */
export function integerToChinese(n: number): string {
    if (n === 0) return DIG[0]!;
    const groups: number[] = [];
    let x = n;
    while (x > 0) {
        groups.push(x % 10000);
        x = Math.floor(x / 10000);
    }
    let s = "";
    for (let i = groups.length - 1; i >= 0; i--) {
        const g = groups[i]!;
        if (g === 0) continue;
        if (s !== "" && g < 1000) s += DIG[0]!; // a group < 1000 below a higher group needs a spoken 零
        const gs = g === 2 && BIG[i] ? TWO : group4(g, s === ""); // 2万/2亿 → 两万/两亿
        s += gs + BIG[i]!;
    }
    return s.replace(new RegExp(`^${DIG[1]}${POS[2]}`), POS[2]!); // 12 → 十二 (not 一十二); 十万, 十亿…
}

/** Digit string → per-digit numeral characters (0 → 〇). Used for year / ID / oversized readings (2024 →
 *  二〇二四). These are read one digit at a time, so 一 among them is a spoken digit (citation), never the
 *  quantity word — the caller marks them sandhi-exempt. */
export function digitsToChinese(digits: string): string {
    return [...digits]
        .map((d) => (d === "0" ? N.zeroDigit : (DIG[digitIndex(d)] ?? d)))
        .join("");
}
