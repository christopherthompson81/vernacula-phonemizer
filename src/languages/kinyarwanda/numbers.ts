/**
 * Kinyarwanda cardinal number → words (space-separated; each runs through the g2p). This module holds the shared
 * RWANDA-RUNDI compositor: Kirundi (rn) is a near-clone of Kinyarwanda (rw) in its numeral morphology too, so
 * kirundi/numbers.ts imports `composeRwandaRundi` from here and passes its own (slightly different) word table
 * rather than duplicating the algorithm.
 *
 * Sources: languagesandnumbers.com/how-to-count-in-kinyarwanda (kin) — the rule text for each magnitude series;
 * Omniglot "Numbers in Kinyarwanda" and kinyarwanda.mofeko.com/numbers.html (independent agreement on 20–90);
 * Harvard ELIAS "Grammar: Cardinal and ordinal numbers" (elias.fas.harvard.edu) for the concord statement.
 *
 * NOUN-CLASS CONCORD. Kinyarwanda numerals 1–7 are bound stems taking the concord of the counted noun; 8 (umunani),
 * 9 (icyenda) and 10 (icumi) are invariable. So each magnitude carries its OWN multiplier series:
 *   • tens   — mirongo (class 4) + the i- series: mirongo itatu 30, ine 40, itanu 50, itandatu 60, irindwi 70,
 *              inani 80, icyenda 90. 20 is the fused irregular makumyabiri.
 *   • hundreds — ijana 100; magana (class 6) + the a- series: magana abiri 200 … magana arindwi 700,
 *              magana inani 800, magana cyenda 900.
 *   • thousands — igihumbi 1000; ibihumbi (class 8) + the bi- series: ibihumbi bibiri 2000 … birindwi 7000,
 *              munani 8000, cyenda 9000.
 * A BARE numeral (a lone digit, which is what a TTS actually has to speak) is given in its citation form —
 * `units`: rimwe, kabiri, gatatu … — and that series is also what is reused for the 11–19 and 21–99 remainders
 * and for thousand-multipliers ≥ 10, where the full concord would be contextual. Deliberate simplification.
 *
 * Covers 0 … <10⁹ (miriyoni for the millions); ≥10⁹ / non-finite → digit-by-digit.
 */
import { MANIFEST, type RwandaRundiNumbers } from "./manifest.ts";

/** Compose `n` in a Rwanda-Rundi language from its own word table. */
export function composeRwandaRundi(n: number, N: RwandaRundiNumbers): string {
    /** 1 ≤ n < 100. */
    const below100 = (v: number): string => {
        if (v < 10) return N.units[v]!;
        if (v === 10) return N.ten;
        const t = Math.floor(v / 10);
        const u = v % 10;
        const tens = t === 1 ? N.ten : N.tens[t]!;
        return u ? `${tens} ${N.and} ${N.units[u]}` : tens;
    };
    /** 1 ≤ n < 1000. */
    const below1000 = (v: number): string => {
        if (v < 100) return below100(v);
        const h = Math.floor(v / 100);
        const r = v % 100;
        const hundred = h === 1 ? N.hundred : `${N.hundreds} ${N.hundredsMul[h]}`;
        return r ? `${hundred} ${N.and} ${below100(r)}` : hundred;
    };
    /** 1 ≤ n < 10⁶. */
    const below1e6 = (v: number): string => {
        if (v < 1000) return below1000(v);
        const th = Math.floor(v / 1000);
        const r = v % 1000;
        // 2–9 thousand take the class-8 bi- multiplier; ≥10 thousand fall back to the citation series.
        const thousand =
            th === 1 ? N.thousand : th < 10 ? `${N.thousands} ${N.thousandsMul[th]}` : `${N.thousands} ${below1000(th)}`;
        return r ? `${thousand} ${N.and} ${below1e6(r)}` : thousand;
    };

    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9)
        return [...String(Math.abs(n))].map((d) => N.units[Number(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!;
    if (n < 1e6) return below1e6(n);
    const m = Math.floor(n / 1e6);
    const r = n % 1e6;
    const million = m === 1 ? N.million : `${N.million} ${below1000(m)}`;
    return r ? `${million} ${N.and} ${below1e6(r)}` : million;
}

/** Non-negative integer (< 10⁹) → Kinyarwanda words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
    return composeRwandaRundi(n, MANIFEST.numbers);
}
