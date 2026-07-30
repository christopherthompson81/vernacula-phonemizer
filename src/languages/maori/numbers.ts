/**
 * Māori cardinal number → words. Polynesian decimal with an additive particle, so a bespoke composer:
 *   • units tahi … iwa; 10 tekau; 20–90 are <unit> tekau (rua tekau 20 … iwa tekau 90);
 *   • the unit digit is introduced by the additive particle MĀ — tekau mā tahi 11, rua tekau mā rima 25,
 *     kotahi rau mā tahi 101, iwa rau iwa tekau mā iwa 999. Everything larger is juxtaposed with no particle
 *     (kotahi rau tekau mā tahi 111, kotahi mano rua rau toru tekau mā whā 1234);
 *   • a magnitude with multiplier 1 uses KOTAHI ("one and only one"), not tahi: kotahi rau 100, kotahi mano 1000,
 *     kotahi miriona 10⁶, kotahi piriona 10⁹.
 * This is the MODERN STANDARD series. The older/alternative decade forms (ngahuru 10, and the ngahuru mā tahi /
 * tekau mā tahi doublet) are NOT used: modern te reo — as taught and as used in Māori-medium numeracy — is uniformly
 * tekau-based, which also keeps 10 and 20–90 morphologically consistent (tekau, rua tekau, …). Covers 0 … <10¹²;
 * ≥10¹² degrades to digit-by-digit.
 *
 * Source: Omniglot "Numbers in Māori (Ngā tau)" (kore 0, tahi…iwa, tekau ~ ngahuru, the tekau mā teens, rua tekau
 * decades, (kotahi) rau, (kotahi) mano); The Te Reo Māori Classroom "Māori Numbers — Beyond 100" (mā comes between
 * the tens and the ones only: kotahi rau mā tahi 101, kotahi rau tekau mā tahi 111, kotahi rau rua tekau mā whā);
 * Superprof NZ "How to Count Numbers in Māori from 1 to 1 Billion" (mano/miriona/piriona, kotahi before a magnitude,
 * "kotahi mano, rua rau, toru tekau mā whā" = 1234).
 */
import { loadManifest } from "../../core/loadManifest.ts";

interface MiNumbers {
    zero: string;
    units: string[]; // 1..9; index 0 unused (zero is its own field)
    ten: string;
    and: string; // the additive particle mā
    one: string; // kotahi — the multiplier form of "one" before a magnitude
    magnitudes: { hundred: string; thousand: string; million: string; billion: string };
}
const N = loadManifest<{ numbers: MiNumbers }>(import.meta.url, "maori.jsonc").numbers;

/** 1 ≤ n < 100 (rua tekau mā rima). */
function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    const tens = t === 1 ? N.ten : `${N.units[t]} ${N.ten}`;
    return u === 0 ? tens : `${tens} ${N.and} ${N.units[u]}`;
}

/** "<multiplier> <magnitude>": kotahi rau, rua rau, tekau mā rua mano. */
function scaleGroup(count: number, scale: string): string {
    return `${count === 1 ? N.one : below1000(count)} ${scale}`;
}

/** Append a remainder to a higher group: a BARE unit digit takes mā, anything else is juxtaposed. */
function join(high: string, r: number): string {
    if (r === 0) return high;
    return r < 10 ? `${high} ${N.and} ${N.units[r]}` : `${high} ${numberToWords(r)}`;
}

/** 1 ≤ n < 1000 (kotahi rau tekau mā tahi). */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100);
    return join(scaleGroup(h, N.magnitudes.hundred), n % 100);
}

/** Non-negative integer (< 10¹²) → Māori words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...String(Math.abs(n))].map((d) => (d === "0" ? N.zero : (N.units[Number(d)] ?? d))).join(" ");
    if (n === 0) return N.zero; // kore
    if (n < 1000) return below1000(n);
    for (const [base, scale] of [
        [1e9, N.magnitudes.billion],
        [1e6, N.magnitudes.million],
        [1e3, N.magnitudes.thousand],
    ] as const) {
        if (n < base) continue;
        return join(scaleGroup(Math.floor(n / base), scale), n % base);
    }
    return below1000(n); // unreachable (n < 1000 handled above)
}
