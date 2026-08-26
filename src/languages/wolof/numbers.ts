/**
 * Wolof cardinal number → words. QUINARY (base-5) below ten, DECIMAL above it — the defining feature of the
 * Wolof system and the reason this is a bespoke composer rather than the shared `westernNumberWords`:
 *   6–9 are 5+n compounds on juróom 'five' (juróom benn 6, juróom ñaar 7, juróom ñett 8, juróom ñeent 9);
 *   the round tens are MULTIPLICATIVE on fukk 'ten' with the (quinary) multiplier FIRST — ñaar fukk 20,
 *   juróom fukk 50, and the doubly-quinary juróom ñeent fukk 90 (((5+4)×10));
 *   addition between magnitude slots is the coordinator ak 'and' (fukk ak benn 11, ñaar fukk ak juróom ñaar 27).
 *
 * SOURCES (numerals are authored DATA — every form below is attested, none reconstructed):
 *   [c] Kosogorova, Maria A. 2023. "Numeral systems of Fula and Wolof: A comparison of morphosyntactic
 *       characteristics". Studies in African Languages and Cultures 57: 141–170 (§4, exx. 30–33) —
 *       the units, the fukk tens, téeméer/ak hundreds (ex. 32) and the thousand (ex. 33).
 *   [c] en.wiktionary Category:Wolof_cardinal_numbers — the standard-orthography spellings used here
 *       (tus 0, benn, ñaar, ñett, ñeent, juróom(+n), fukk, fukk ak n, ñaar fukk, téeméer, junni).
 *   [c] Janga Wolof, "Wolof Numbers & Counting" (jangawolof.org) — the full 30–90 fukk series.
 *   [c] wo.wikipedia — milyoŋ 'million' (Niseeriya) and milyaar 'billion' (Lislaam) are the everyday
 *       French-derived magnitude words; Wolof has no inherited numeral above junni.
 *
 * TRADITIONAL vs MODERN: the traditional quinary/decimal system is used THROUGHOUT 0–999,999 (no borrowed
 * decimal units — Wolof speakers do not say *sis for 6). Only million/billion are the borrowed forms, because
 * no inherited word exists. Kosogorova's variants (juuni 'thousand', tééméér) are equivalent spellings of the
 * junni / téeméer used here; the 30 doublet fanweer (lit. 'days of a month') is a lexical alternative to
 * ñett fukk and is NOT used, since a compositor needs the regular multiplicative form.
 */

// 0–9. 6–9 are the quinary 5+n compounds (multi-word by design — the composer joins on spaces).
const ONES = [
    "tus", "benn", "ñaar", "ñett", "ñeent", "juróom",
    "juróom benn", "juróom ñaar", "juróom ñett", "juróom ñeent",
];
const TEN = "fukk";
const AK = "ak"; // the additive coordinator between magnitude slots
const HUNDRED = "téeméer";
const THOUSAND = "junni";
const MILLION = "milyoŋ";
const BILLION = "milyaar";

/** 1–99: fukk 'ten' takes the quinary multiplier FIRST (ñaar fukk = 2×10); units are added with ak. */
function below100(n: number): string {
    if (n < 10) return ONES[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    // 10 is the bare fukk; 20–90 are MULT + fukk (the multiplier itself may be quinary: juróom ñett fukk = 80)
    const tens = t === 1 ? TEN : `${ONES[t]!} ${TEN}`;
    return u === 0 ? tens : `${tens} ${AK} ${ONES[u]!}`;
}

/** 1–999: téeméer takes a preceding multiplier (bare for 100); the remainder is added with ak. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const head = h === 1 ? HUNDRED : `${below100(h)} ${HUNDRED}`;
    return r === 0 ? head : `${head} ${AK} ${below100(r)}`;
}

/** Non-negative integer → Wolof words; beyond the attested range → digit-by-digit (no invented magnitudes). */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12) {
        return [...(raw ?? String(Math.abs(n)))].filter((c) => c >= "0" && c <= "9").map((d) => ONES[Number(d)]!).join(" ");
    }
    if (n < 1000) return below1000(n);
    if (n < 1e6) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        const head = th === 1 ? THOUSAND : `${below1000(th)} ${THOUSAND}`; // ñaar junni = 2×1000 (ex. 33)
        return r === 0 ? head : `${head} ${AK} ${below1000(r)}`;
    }
    if (n < 1e9) {
        const m = Math.floor(n / 1e6),
            r = n % 1e6;
        const head = m === 1 ? MILLION : `${below1000(m)} ${MILLION}`;
        return r === 0 ? head : `${head} ${AK} ${numberToWords(r)}`;
    }
    const b = Math.floor(n / 1e9),
        r = n % 1e9;
    const head = b === 1 ? BILLION : `${below1000(b)} ${BILLION}`;
    return r === 0 ? head : `${head} ${AK} ${numberToWords(r)}`;
}
