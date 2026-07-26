/**
 * Slovenian (sl) cardinal number compositor. Returns composed Slovene TEXT (space-separated) that the phonemizer runs
 * through the g2p, so the IPA stays consistent with the word engine. Slovene uses the Germanic-style unit-IN-ten
 * inversion — tens+units concatenate into ONE word with the "in" infix (enaindvajset = 21, "one-and-twenty");
 * hundreds and thousands are space-separated. Number agreement uses the Slovene DUAL (2 → milijona). No numeric
 * referee exists → these are the standard forms. See docs/investigations/sl_native_bringup_investigation.md.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;
const { units: UNITS, teens: TEENS, tens: TENS, hundreds: HUNDREDS } = N;

/** 0–99 → Slovene text. 21–99 non-round: unit + "in" + ten, concatenated (enaindvajset). */
function sub100(n: number): string {
    if (n < 10) return UNITS[n]!;
    if (n < 20) return TEENS[n - 10]!;
    const u = n % 10;
    return u === 0 ? TENS[Math.floor(n / 10)]! : `${UNITS[u]}${N.and}${TENS[Math.floor(n / 10)]}`;
}

/** 0–999 → Slovene text (hundreds space-separated from the sub-hundred remainder: dvesto štiriintrideset). */
function sub1000(n: number): string {
    const h = Math.floor(n / 100);
    const r = n % 100;
    if (h === 0) return sub100(r);
    return HUNDREDS[h]! + (r ? ` ${sub100(r)}` : "");
}

/** Slovene agreement form for a magnitude noun by its count: 1→sg, 2→dual, 3–4→paucal, else genitive-plural. */
function agree(count: number, forms: { sg: string; dual: string; paucal: string; plural: string }): string {
    return count === 1 ? forms.sg : count === 2 ? forms.dual : count <= 4 ? forms.paucal : forms.plural;
}

/** The count NUMERAL, gender-agreeing for a standalone 2/3/4 with the magnitude noun's gender (m: dva/trije/štirje,
 *  f: dve/tri/štiri). Compound counts (22, 34…) fall back to the plain sub-1000 form (dvaindvajset). */
function countWord(n: number, gender: "m" | "f"): string {
    return N.countForms[gender][n] ?? sub1000(n);
}

/** Read a raw digit STRING digit-by-digit (nič/ena/…) — the fallback for out-of-range / over-long numbers. */
export function readDigits(digits: string): string {
    return digits.split("").map((d) => UNITS[Number(d)] ?? d).join(" ");
}

/** A non-negative integer (< 1e12) → space-separated Slovene cardinal words. */
export function numberToWords(n: number): string {
    if (n < 0 || !Number.isFinite(n)) return "";
    n = Math.floor(n);
    if (n === 0) return UNITS[0]!; // nič
    if (n >= 1e12) return readDigits(String(n)); // above the milijarda tier → digit-by-digit
    const parts: string[] = [];
    const mrd = Math.floor(n / 1e9);
    n %= 1e9;
    if (mrd) parts.push(mrd === 1 ? N.magnitudes.milliard.sg : `${countWord(mrd, "f")} ${agree(mrd, N.magnitudes.milliard)}`);
    const mil = Math.floor(n / 1e6);
    n %= 1e6;
    if (mil) parts.push(mil === 1 ? N.magnitudes.million.sg : `${countWord(mil, "m")} ${agree(mil, N.magnitudes.million)}`);
    const th = Math.floor(n / 1000);
    n %= 1000;
    if (th) parts.push(th === 1 ? N.thousand : `${sub1000(th)} ${N.thousand}`); // tisoč is invariant
    if (n) parts.push(sub1000(n));
    return parts.join(" ");
}
