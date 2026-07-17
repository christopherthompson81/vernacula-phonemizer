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
    teens: string[]; // 10..19 spellings
    tens: Record<string, string>; // "20".."90" (round) spellings
    magnitudes: {
        hundred: string;
        thousand: string;
        lakh: string;
        crore: string;
    };
    /** Optional full irregular 21..99 spellings (keyed by the number); overrides tens+unit composition. */
    compound?: Record<string, string>;
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
    if (n < 20) return [d.teens[n - 10]!];
    if (n < 100) {
        const t = Math.floor(n / 10) * 10,
            u = n % 10;
        if (u === 0) return [d.tens[String(t)]!];
        if (d.compound?.[String(n)]) return [d.compound[String(n)]!];
        // 21-99 fused spelling not authored → degrade to a best-effort UNIT+TENS reading (the Indic order, e.g.
        // ekchalis-shape) instead of leaking a "?" into the IPA. Approximate (the real fused form differs) but
        // readable; a full `compound` map overrides it. See the per-language "21-99 deferred" notes.
        return [d.units[u]!, d.tens[String(t)]!];
    }
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        return [
            d.units[h]!,
            d.magnitudes.hundred,
            ...(r ? indicNumberWords(r, d) : []),
        ];
    }
    if (n < 100000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        return [
            ...indicNumberWords(th, d),
            d.magnitudes.thousand,
            ...(r ? indicNumberWords(r, d) : []),
        ];
    }
    if (n < 10000000) {
        const l = Math.floor(n / 100000),
            r = n % 100000;
        return [
            ...indicNumberWords(l, d),
            d.magnitudes.lakh,
            ...(r ? indicNumberWords(r, d) : []),
        ];
    }
    const c = Math.floor(n / 10000000),
        r = n % 10000000;
    return [
        ...indicNumberWords(c, d),
        d.magnitudes.crore,
        ...(r ? indicNumberWords(r, d) : []),
    ];
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
