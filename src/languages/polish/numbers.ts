/**
 * Polish (pl) cardinal number compositor. Returns composed Polish TEXT (space-separated) that polish.ts runs
 * through the g2p, so the IPA stays consistent with the word engine.
 *
 * SOURCE for the numeral words: pl.wikipedia's per-number articles — "1 (liczba)" → jeden, … "20 (liczba)" →
 * dwadzieścia, "40 (liczba)" → czterdzieści, "100 (liczba)" → sto, "200 (liczba)" → dwieście, "300 (liczba)" →
 * trzysta, "400 (liczba)" → czterysta, "500 (liczba)" → pięćset, "1000 (liczba)" → tysiąc; the table itself lives
 * in polish.jsonc. Magnitude agreement forms are the standard paradigm (tysiąc/tysiące/tysięcy,
 * milion/miliony/milionów, miliard/miliardy/miliardów).
 *
 * ★ WHY THIS IS NOT `westernNumberWords`: the shared Western composer stores ONE string per magnitude, but a
 *   Slavic magnitude noun agrees with its count (2 tysiące vs 5 tysięcy). Polish also DIVERGES from the shared
 *   `slavicCountForm` used by ru/cs for symbol agreement: in Polish a compound numeral ending in "jeden" takes
 *   the GENITIVE PLURAL, not the singular — "dwadzieścia jeden tysięcy" (3 hits on pl.wikipedia) vs
 *   *"dwadzieścia jeden tysiąc" (0 hits); cf. Russian двадцать одна тысяча. So the singular is reserved for an
 *   EXACT count of 1 and `agree()` below is Polish-specific rather than the shared selector.
 */

import { MANIFEST } from "./manifest.ts";

const {
    units: UNITS,
    teens: TEENS,
    tens: TENS,
    hundreds: HUNDREDS,
    magnitudes: MAG,
} = MANIFEST.numbers;

type Agreement = { sg: string; paucal: string; plural: string };

/** 0–99 → Polish text (tens and units SPACE-separated: dwadzieścia jeden). */
function sub100(n: number): string {
    if (n < 10) return UNITS[n]!;
    if (n < 20) return TEENS[n - 10]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? TENS[t]! : `${TENS[t]} ${UNITS[u]}`;
}

/** 0–999 → Polish text (irregular round hundred + the sub-hundred remainder). */
function sub1000(n: number): string {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return sub100(r);
    return HUNDREDS[h]! + (r ? ` ${sub100(r)}` : "");
}

/** The Polish count form of a magnitude noun: EXACTLY 1 → sg; …2–4 (but not …12–14) → paucal; else gen-pl.
 *  Unlike Russian, a compound ending in 1 (21, 101) takes the genitive plural — dwadzieścia jeden tysięcy. */
function agree(count: number, forms: Agreement): string {
    if (count === 1) return forms.sg;
    const m100 = count % 100,
        m10 = count % 10;
    if (m100 >= 12 && m100 <= 14) return forms.plural;
    return m10 >= 2 && m10 <= 4 ? forms.paucal : forms.plural;
}

/** One magnitude group. A bare count of 1 drops the numeral entirely (tysiąc / milion / miliard — the idiomatic
 *  reading of 1000 / 1 000 000, parallel to the bare hundred "sto"); any other count is spelled + agreed. */
function magnitude(count: number, forms: Agreement): string {
    return count === 1 ? forms.sg : `${sub1000(count)} ${agree(count, forms)}`;
}

/** Read a raw digit STRING digit-by-digit — the fallback beyond the miliard group (n ≥ 10^12). */
export function readDigits(digits: string): string {
    return digits
        .split("")
        .map((d) => UNITS[Number(d)] ?? d)
        .join(" ");
}

/** A non-negative integer (< 10^12) → space-separated Polish cardinal words. */
export function numberToWords(n: number): string {
    if (n < 0 || !Number.isFinite(n)) return "";
    n = Math.floor(n);
    if (n === 0) return UNITS[0]!; // zero
    if (n >= 1e12) return readDigits(String(n));
    const parts: string[] = [];
    const bil = Math.floor(n / 1e9);
    n %= 1e9;
    if (bil) parts.push(magnitude(bil, MAG.billion));
    const mil = Math.floor(n / 1e6);
    n %= 1e6;
    if (mil) parts.push(magnitude(mil, MAG.million));
    const th = Math.floor(n / 1000);
    n %= 1000;
    if (th) parts.push(magnitude(th, MAG.thousand));
    if (n) parts.push(sub1000(n));
    return parts.join(" ");
}
