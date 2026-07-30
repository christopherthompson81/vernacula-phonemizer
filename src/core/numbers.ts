/**
 * Native number rendering — GENERAL, not abugida-specific (declarative, portable — no espeak number data).
 *
 * Number COMPOSITION is bespoke per numbering system (there is no universal magnitude structure — see the
 * rejected Layer-A number-builder consolidation), so each system contributes its own `<system>NumberWords`
 * that decomposes an integer into an ordered list of number-WORD spellings. `renderNumber` is the reusable
 * seam: it takes a composer + a word→IPA renderer and stitches the result. The composer defaults to
 * `indicNumberWords` (the only system so far); a non-Indic native language passes its own (e.g. a Western
 * thousand/million/billion composer) to the same `renderNumber`. The magnitude-field DATA schema on
 * `NumbersDef` (currently Indic lakh/crore) generalises when that 2nd system lands (ADR-0002 defers the
 * data-schema lift to the 2nd consumer; the composer SEAM exists from day one).
 */

export interface NumbersDef {
    units: string[]; // 0..9 spellings
    teens?: string[]; // 10..19 spellings (Indic irregular teens; omitted by systems that compose them, e.g. Turkic oʻn+unit)
    tens: Record<string, string>; // "20".."90" (round) spellings (Turkic includes "10")
    hundreds?: string[]; // 0..9 → the irregular round-hundred spellings (Western/Slavic: сто, двісті, триста…), read by westernNumberWords
    // Magnitude words. hundred/thousand are universal; Indic adds lakh/crore, Western/Turkic adds million/billion.
    // (ADR-0002: the data-schema lift lands with the 2nd numbering system — Uzbek's Turkic composer.)
    magnitudes: {
        hundred: string;
        thousand: string;
        lakh?: string;
        crore?: string;
        million?: string;
        billion?: string;
    };
    /** Optional full irregular 21..99 spellings (keyed by the number); overrides tens+unit composition. */
    compound?: Record<string, string>;
    /**
     * Order of the 21..99 FALLBACK when no `compound` spelling is authored. The default is UNIT then TENS
     * (the Hindi-belt *ekchālīs* shape). DRAVIDIAN languages are the other way round — Kannada
     * ಇಪ್ಪತ್ತೊಂದು, Malayalam ഇരുപത്തിയൊന്ന് — and were reading "one twenty". Found by the Telugu run,
     * which fixed its own with a private composer and then measured the same defect in its relatives.
     */
    compoundOrder?: "unit-tens" | "tens-unit";
    /**
     * Read a bare 100/1000/lakh/crore as the magnitude word ALONE — Kannada ನೂರು, not *ondu nūru. Opt-in,
     * because the Hindi-belt languages genuinely do say *ek sau* and *ek hazār*.
     *
     * It applied to hundred and thousand ONLY when first added, so a language declaring it still read
     * "one lakh" and "one crore" while correctly saying a bare hundred — Malayalam did, and Kannada would
     * have but for writing its own composer. Reported independently by the Punjabi and Kannada runs, both
     * of which read the code rather than probing.
     */
    bareMagnitude?: boolean;
    /** Optional decimal-point word (Hindi दशमलव); when present the text path reads N.M as int दशमलव digit-by-digit. */
    decimalWord?: string;
}

/** A number-composition strategy: integer → ordered number-word spellings (`null` = un-authored gap). */
export type NumberComposer = (n: number, d: NumbersDef) => (string | null)[];

/**
 * INDIC (South Asian) number composition: 2-2-3 lakh/crore grouping. Hindi 21-99 are irregular (not
 * compositional) and require their `compound` spellings; a missing one yields `null` (a marked gap).
 */
export const indicNumberWords: NumberComposer = (n, d) => {
    if (n < 10) return [d.units[n]!];
    if (n < 20) return [d.teens![n - 10]!];
    if (n < 100) {
        const t = Math.floor(n / 10) * 10,
            u = n % 10;
        if (u === 0) return [d.tens[String(t)]!];
        if (d.compound?.[String(n)]) return [d.compound[String(n)]!];
        // 21-99 fused spelling not authored → degrade to a best-effort two-word reading instead of leaking
        // a "?" into the IPA. Approximate (the real fused form differs) but readable; a full `compound`
        // map overrides it. The ORDER is language-specific — see `compoundOrder`.
        return d.compoundOrder === "tens-unit"
            ? [d.tens[String(t)]!, d.units[u]!]
            : [d.units[u]!, d.tens[String(t)]!];
    }
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        return [
            // A bare hundred is just the magnitude word in the languages that declare it.
            ...(h === 1 && d.bareMagnitude ? [] : [d.units[h]!]),
            d.magnitudes.hundred,
            ...(r ? indicNumberWords(r, d) : []),
        ];
    }
    if (n < 100000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        return [
            ...(th === 1 && d.bareMagnitude ? [] : indicNumberWords(th, d)),
            d.magnitudes.thousand,
            ...(r ? indicNumberWords(r, d) : []),
        ];
    }
    if (n < 10000000) {
        const l = Math.floor(n / 100000),
            r = n % 100000;
        return [
            ...(l === 1 && d.bareMagnitude ? [] : indicNumberWords(l, d)),
            d.magnitudes.lakh!,
            ...(r ? indicNumberWords(r, d) : []),
        ];
    }
    const c = Math.floor(n / 10000000),
        r = n % 10000000;
    return [
        ...(c === 1 && d.bareMagnitude ? [] : indicNumberWords(c, d)),
        d.magnitudes.crore!,
        ...(r ? indicNumberWords(r, d) : []),
    ];
};

/**
 * WESTERN / Slavic decimal composition (units + teens + tens + hundreds + thousand/million/billion, space-separated).
 * Shared by the East-Slavic (uk, be) and Armenian (hy) engines — they differ only in their DATA (`d.units` etc.),
 * routed through each language's own G2P by `renderNumber`. Needs the irregular round-hundred spellings in
 * `d.hundreds` (сто, двісті, …; Armenian հարюр, երկուհարюр, …). The leading "one" is OMITTED for a bare thousand
 * (тисяча / հазар, matching the bare hundred сто), but KEPT for million/billion (один мільйон — grammatical).
 */
export const westernNumberWords: NumberComposer = (n, d) => {
    const H = d.hundreds!; // Western systems carry the irregular round-hundred spellings
    if (n < 10) return [d.units[n]!];
    if (n < 20) return [d.teens![n - 10]!];
    if (n < 100) {
        const t = Math.floor(n / 10) * 10,
            u = n % 10;
        return [d.tens[String(t)]!, ...(u ? [d.units[u]!] : [])];
    }
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        return [H[h]!, ...(r ? westernNumberWords(r, d) : [])];
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        // omit the leading "one" for exactly 1000 (тисяча, not *один тисяча — a bare magnitude like the hundred сто)
        return [...(th === 1 ? [] : westernNumberWords(th, d)), d.magnitudes.thousand, ...(r ? westernNumberWords(r, d) : [])];
    }
    if (n < 1_000_000_000) {
        const m = Math.floor(n / 1_000_000),
            r = n % 1_000_000;
        return [...westernNumberWords(m, d), d.magnitudes.million!, ...(r ? westernNumberWords(r, d) : [])];
    }
    const b = Math.floor(n / 1_000_000_000),
        r = n % 1_000_000_000;
    return [...westernNumberWords(b, d), d.magnitudes.billion!, ...(r ? westernNumberWords(r, d) : [])];
};

/** Render an integer to canonical IPA: compose it to number words (`compose`, default Indic), then map
 *  each word through `word` (a native G2P word→IPA renderer). The generic, system-agnostic seam. */
export function renderNumber(
    n: number,
    d: NumbersDef,
    word: (w: string) => string,
    compose: NumberComposer = indicNumberWords,
): string {
    return compose(n, d)
        .map((w) => (w === null ? "?" : word(w)))
        .join(" ");
}
