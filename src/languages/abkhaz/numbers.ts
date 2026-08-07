/**
 * Abkhaz (ab) VIGESIMAL cardinal number compositor. Returns composed Abkhaz TEXT (space-separated) that
 * abkhaz.ts runs through the g2p, so the IPA stays consistent with the word engine. This file owns the
 * COMPOSITION: the score split (floor(n/20) + a 0–19 remainder), the bare-vs-connective choice at each
 * boundary, the fused-vs-free thousands, and the digit-by-digit fallback past the миллиард group. The number
 * words themselves — with the base-20 system, the -и connective, the class-agreement judgment call and the
 * sources — live in abkhaz.jsonc.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;
const { units: UNITS, teens: TEENS, scores: SCORES, hundreds: HUNDREDS, thousands: THOUSANDS } = N;

/** 0–19 → the plain Abkhaz numeral (the series that attaches after a score's -и connective). */
function sub20(n: number): string {
    return n < 10 ? UNITS[n]! : TEENS[n - 10]!;
}

/** 0–99 → Abkhaz text. 20–99 is score·20 + remainder, the score in its -и connective form. */
function sub100(n: number): string {
    if (n < 20) return sub20(n);
    const s = Math.floor(n / 20), // 1–4 → ҩажә / ҩынҩажә / хынҩажә / ԥшьынҩажә
        r = n - s * 20; // 0–19
    return r === 0 ? SCORES.bare[s]! : `${SCORES.comb[s]} ${sub20(r)}`;
}

/** 0–999 → Abkhaz text. The round hundred takes its -и connective iff a sub-hundred remainder follows. */
function sub1000(n: number): string {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return sub100(n);
    return r === 0 ? HUNDREDS.bare[h]! : `${HUNDREDS.comb[h]} ${sub100(r)}`;
}

/** A thousands group: fused for a multiplier of 1–10 and for 100, otherwise multiplier + нызқь. */
function thousands(count: number): string {
    if (count <= 10) return THOUSANDS.fused[count]!;
    if (count === 100) return THOUSANDS.hundred;
    return `${sub1000(count)} ${THOUSANDS.word}`;
}

/** Read a raw digit STRING digit-by-digit — the fallback beyond the миллиард group (n ≥ 10^12). */
export function readDigits(digits: string): string {
    return digits
        .split("")
        .map((d) => UNITS[Number(d)] ?? d)
        .join(" ");
}

/** A non-negative integer (< 10^12) → space-separated Abkhaz cardinal words. */
export function numberToWords(n: number): string {
    if (n < 0 || !Number.isFinite(n)) return "";
    n = Math.floor(n);
    if (n === 0) return UNITS[0]!; // аноль
    if (n >= 1e12) return readDigits(String(n));
    const parts: string[] = [];
    const bil = Math.floor(n / 1e9);
    n %= 1e9;
    if (bil) parts.push(bil === 1 ? N.milliard : `${sub1000(bil)} ${N.milliard}`);
    const mil = Math.floor(n / 1e6);
    n %= 1e6;
    if (mil) parts.push(mil === 1 ? N.million : `${sub1000(mil)} ${N.million}`);
    const th = Math.floor(n / 1000);
    n %= 1000;
    if (th) parts.push(thousands(th));
    if (n) parts.push(sub1000(n));
    return parts.join(" ");
}
