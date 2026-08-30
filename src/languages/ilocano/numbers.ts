/**
 * Ilocano / Iloko cardinal number → words. NATIVE Austronesian set (not the Spanish loans), matching the
 * Tagalog/Cebuano precedent in this fleet. Ilocano composes its magnitudes MORPHOLOGICALLY rather than from an
 * irregular tens table:
 *   • a magnitude with multiplier 1 takes the prefix "sanga-" — sangapulo 10, sangagasut 100, sangaribo 1000,
 *     sangariwriw 10⁶ ("a group of ten/hundred/…");
 *   • a single-digit multiplier FUSES with the magnitude when it is vowel-final (duapulo 20, tallopulo 30,
 *     limapulo 50, pitopulo 70, walopulo 80, duagasut 200, talloribo 3000) and takes the LIGATURE "a" when it is
 *     consonant-final (uppat a pulo 40, innem a pulo 60, siam a pulo 90, uppat a gasut 400);
 *   • a multi-word multiplier always takes the ligature (sangapulo ket dua a ribo = 12 000);
 *   • the places are chained by the conjunction "ket" (sangapulo ket maysa 11, duapulo ket maysa 21,
 *     sangagasut ket maysa 101, sangaribo ket maysa 1001).
 * Covers 0 … <10⁹; ≥10⁹ degrades to digit-by-digit (no attested native billion word — riwriw 10⁶ is the top of the
 * native series; same cut-off shape as Cebuano's).
 *
 * Source: Wikipedia "Ilocano numbers" (the native table + the sanga-/ket/ligature rules, incl. duapulo, uppat a
 * pulo, sangagasut, sangariwriw); HandWiki "Ilocano numbers" (the 101 / 1001 "ket maysa" compounds); Wiktionary
 * "Category:Ilocano cardinal numbers" (maysa … siam, sangapulo, duapulo, limapulo, gasut, ribo — the "ribo"
 * spelling is the attested lemma, vs. the "ribu" variant). Spanish loans (onse, beinte, mil …) are co-current in
 * everyday Ilocano — especially for clock time, dates and money — but are NOT modelled; see ilocano.jsonc.
 */
import { digitIndex } from "../../core/numbers.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface IloNumbers {
    units: string[];
    onePrefix: string;
    ligature: string;
    connector: string;
    magnitudes: { ten: string; hundred: string; thousand: string; million: string };
}
const N = loadManifest<{ numbers: IloNumbers }>(import.meta.url, "ilocano.jsonc").numbers;

const isVowelFinal = (w: string): boolean => "aeiou".includes(w[w.length - 1] ?? "");

/** "<multiplier> <magnitude>": sanga- for 1, fused for a vowel-final digit, else the "a" ligature. */
function scaleGroup(count: number, scale: string): string {
    if (count === 1) return `${N.onePrefix}${scale}`; // sangapulo, sangagasut, sangaribo, sangariwriw
    const c = count < 10 ? N.units[count]! : below1000(count);
    return count < 10 && isVowelFinal(c) ? `${c}${scale}` : `${c} ${N.ligature} ${scale}`;
}

/** 1 ≤ n < 100 (duapulo ket maysa). */
function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    const tens = scaleGroup(t, N.magnitudes.ten);
    return u === 0 ? tens : `${tens} ${N.connector} ${N.units[u]}`;
}

/** 1 ≤ n < 1000 (sangagasut ket duapulo ket maysa). */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const hundred = scaleGroup(h, N.magnitudes.hundred);
    return r ? `${hundred} ${N.connector} ${below100(r)}` : hundred;
}

/** Non-negative integer (< 10⁹) → Ilocano words; larger / non-finite → digit-by-digit. Chains the ribo (10³) and
 *  riwriw (10⁶) scales with the "ket" conjunction. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9)
        return [...(raw ?? String(Math.abs(n)))].map((d) => N.units[digitIndex(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!; // sero
    if (n < 1000) return below1000(n);
    if (n < 1e6) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        const thousand = scaleGroup(th, N.magnitudes.thousand);
        return r ? `${thousand} ${N.connector} ${below1000(r)}` : thousand;
    }
    const mil = Math.floor(n / 1e6),
        r = n % 1e6;
    const million = scaleGroup(mil, N.magnitudes.million); // sangariwriw, duariwriw, …
    return r ? `${million} ${N.connector} ${numberToWords(r)}` : million;
}
