/**
 * Hiligaynon cardinal number → words. NATIVE Austronesian set (not the Spanish loans), matching the Cebuano
 * precedent in this fleet: the tens are the irregular synthetic ka-…-an forms (kaluhaan 20, kap-atan 40), compounds
 * join TENS-FIRST with the ligature "kag" (napulo kag isa = 11, kaluhaan kag isa = 21), and the magnitudes take the
 * "ka" ligature (duha ka gatos = 200, isa ka libo = 1000). Covers 0 … <10⁹; ≥10⁹ degrades to digit-by-digit (no
 * attested native billion word — same cut-off shape as Cebuano's, which stops at 10⁶).
 *
 * Source: Wiktionary "Category:Hiligaynon cardinal numbers" (isa … siyam, napulo, kaluhaan, kap-atan, kalim-an,
 * kan-uman, kapituan, kawaluan, kasiyaman — mirrored at kaikki.org/dictionary/Hiligaynon cardinal numbers);
 * Omniglot "Numbers in Hiligaynon" (gatos 100, libo 1000, milyon 10⁶, and the "isa ka gatos" ligature pattern);
 * ilonggodictionary.com "Hiligaynon Numbers" (the "kag" column connector). Spanish loans (uno, dos, baynte …) are
 * co-current in everyday Ilonggo speech but NOT modelled — see the note in hiligaynon.jsonc.
 */
import { loadManifest } from "../../core/loadManifest.ts";

interface HilNumbers {
    units: string[];
    tens: string[];
    connector: string;
    ligature: string;
    hundred: string;
    thousand: string;
    million: string;
}
const N = loadManifest<{ numbers: HilNumbers }>(import.meta.url, "hiligaynon.jsonc").numbers;

/** 1 ≤ n < 100 (tens-first: kaluhaan kag isa). */
function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? N.tens[t]! : `${N.tens[t]} ${N.connector} ${N.units[u]}`;
}

/** A "X ka <magnitude>" group: isa ka gatos, duha ka libo. */
function kaGroup(count: number, scale: string): string {
    return `${count === 1 ? N.units[1] : below1000(count)} ${N.ligature} ${scale}`;
}

/** 1 ≤ n < 1000. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const hundred = kaGroup(h, N.hundred);
    return r ? `${hundred} ${N.connector} ${below100(r)}` : hundred;
}

/** Non-negative integer (< 10⁹) → Hiligaynon words; larger / non-finite → digit-by-digit. Chains the libo (10³)
 *  and milyon (10⁶) scales with the "kag" connector. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9)
        return [...(raw ?? String(Math.abs(n)))].map((d) => N.units[Number(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!; // sero
    if (n < 1000) return below1000(n);
    if (n < 1e6) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        const thousand = kaGroup(th, N.thousand);
        return r ? `${thousand} ${N.connector} ${below1000(r)}` : thousand;
    }
    const mil = Math.floor(n / 1e6),
        r = n % 1e6;
    const million = kaGroup(mil, N.million); // isa ka milyon, duha ka milyon, …
    return r ? `${million} ${N.connector} ${numberToWords(r)}` : million;
}
