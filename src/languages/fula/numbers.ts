/**
 * Fula (Fulfulde/Pulaar) cardinal number → words. QUINARY below ten, DECIMAL above it (with a vigesimal relic
 * at 20) — a mixed system the shared `westernNumberWords` cannot express:
 *   1–5  goo, ɗiɗi, tati, nayi, joyi are simple stems;
 *   6–9  are 5+n compounds on jee- < jowi/joyi 'five': jeegom 6, jeeɗiɗi 7, jeetati 8, jeenayi 9;
 *   10   sappo, 20 noogaas (a separate vigesimal-relic lexeme, not 2×10 — cf. < *no gas-i 'it is finished',
 *        i.e. all fingers AND toes counted);
 *   30–90 cappanɗe + multiplier — cappanɗe is the ƊE-class PLURAL of sappo (s→c initial mutation), and the
 *        multiplier may itself be quinary: cappanɗe jeetati = 10×(5+3) = 80;
 *   slots are joined by the comitative preposition e 'with/and' (sappo e goo 11, noogaas e jeegom 26,
 *        cappanɗe tati e goo 31);
 *   100s/1000s the magnitude NOUNS teemedere / ujundere take a following multiplier and go to their ƊE plural
 *        when multiplied: teemedde tati 300, ujunaaje ɗiɗi 2000.
 *
 * SOURCES (authored DATA):
 *   [c] Kosogorova, Maria A. 2023. "Numeral systems of Fula and Wolof: A comparison of morphosyntactic
 *       characteristics". Studies in African Languages and Cultures 57: 141–170 — §2.1 exx. 1–4 (the quinary
 *       1–9, sappo e n teens, noogay/noogas 20, the cappanɗe tens 30–90 with their 10×(5+n) glosses),
 *       the teemedere/teemeɗɗe hundreds and the worked 356 = teemeɗɗe tati e cappanɗe jowi e jeego’o;
 *       §2.2 for the Pulaar Futa-Tooro forms used here (goo, jeegom, noogas, teemedde, ujundere 'thousand');
 *       p. 148 for the French-loan magnitudes million / milionji plƊI and milyar / milyarji plƊI.
 *   [c] Peace Corps/Mauritania, "Introduction to Pulaar" — Goo, ɗiɗi, tati, nayi, joyi, jeegom, jeeɗiɗi,
 *       jeetati, jeenayi, Sappo, Sappo e + unit (11–19), Noogaas 20. This is the source for the -i final
 *       vowels (nayi/joyi) and for the ⟨noogaas⟩ spelling.
 *   [c] Omniglot, "Numbers in Fula" — cappanɗe tati/nayi/joyi tens, teemedere 100, ujunere 1000.
 *   [t] ujunaaje as the ƊE plural of ujundere (Kosogorova gives ujunere ~ ujunaaje pl ƊE for the sibling lect;
 *       the NDE→ƊE alternation is the same one teemedere ~ teemedde shows and is applied here).
 *   [r] meere 'zero' — Pulaar meere 'nothing, emptiness'; no source consulted lists a numeral 0, so this is the
 *       lowest-confidence entry in the table (same flag-and-state treatment as the Oromo zeeroo).
 *
 * LECT: Pulaar Futa-Tooro (Senegal/Mauritania) — the westernmost and best-documented lect, and the one the
 * Peace Corps material teaches. The engine's g2p is pan-Fulfulde, so the other lects differ only in the stem
 * spellings noted above (Pular go’o/jowi/noogay, Maasina jeeɗɗi/jeetti). Deliberately avoids the apostrophe
 * spellings (go’o) — that character is not in the engine's grapheme table, and Futa-Tooro's goo is apostrophe-free.
 * TRADITIONAL vs MODERN: the traditional quinary/decimal system throughout 0–999,999; the borrowed
 * million/milyar for 10⁶–10⁹ (Kosogorova: the French loans "spread wider in everyday use" than the inherited
 * ujunere/ajanere, whose values also shift between lects — ujun(d)ere is 'thousand' here).
 *
 * SCRIPTS: orthography-level, so it serves BOTH registered scripts — Adlam digits (𞥐–𞥙, U+1E950–1E959) are
 * folded to ASCII in fula.ts before this runs, and the Latin numerals then take the shared g2p path.
 */

// 0–9. 6–9 are the quinary jee- (5+n) compounds.
const ONES = ["meere", "goo", "ɗiɗi", "tati", "nayi", "joyi", "jeegom", "jeeɗiɗi", "jeetati", "jeenayi"];
const TEN = "sappo";
const TWENTY = "noogaas";
const TENS_PL = "cappanɗe"; // the ƊE plural of sappo (30–90 take a multiplier)
const E = "e"; // the comitative 'and' between magnitude slots
const HUNDRED = "teemedere";
const HUNDRED_PL = "teemedde";
const THOUSAND = "ujundere";
const THOUSAND_PL = "ujunaaje";
/** ⚠ EXPORTED because normalize.ts's `STEM_ORD` has to key on them. Hand-copied keys drifted once
 *  already: the table spelled them `miliyon`/`milion` while the compositor emitted `million`/`milyar`,
 *  so the two rows were dead and `ordinalWords(1e6)` returned undefined. */
export const MILLION = "million";
const MILLION_PL = "milionji";
export const BILLION = "milyar";
const BILLION_PL = "milyarji";

/** 0–99: sappo / noogaas / cappanɗe + multiplier, units added with e. */
function below100(n: number): string {
    if (n < 10) return ONES[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    const head = t === 1 ? TEN : t === 2 ? TWENTY : `${TENS_PL} ${ONES[t]!}`;
    return u === 0 ? head : `${head} ${E} ${ONES[u]!}`;
}

/** 1–999: teemedere (100) / teemedde + multiplier; remainder added with e. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const head = h === 1 ? HUNDRED : `${HUNDRED_PL} ${ONES[h]!}`;
    return r === 0 ? head : `${head} ${E} ${below100(r)}`;
}

/** A magnitude slot: the singular noun bare for ×1, else the plural + the multiplier. */
function magnitude(sg: string, pl: string, count: number): string {
    return count === 1 ? sg : `${pl} ${below1000(count)}`;
}

/** Non-negative integer → Fula words; out of range → digit-by-digit. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12) {
        return [...(raw ?? String(Math.abs(n)))].filter((c) => c >= "0" && c <= "9").map((d) => ONES[Number(d)]!).join(" ");
    }
    if (n < 1000) return below1000(n);
    if (n < 1e6) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        const head = magnitude(THOUSAND, THOUSAND_PL, th);
        return r === 0 ? head : `${head} ${E} ${below1000(r)}`;
    }
    if (n < 1e9) {
        const m = Math.floor(n / 1e6),
            r = n % 1e6;
        const head = magnitude(MILLION, MILLION_PL, m);
        return r === 0 ? head : `${head} ${E} ${numberToWords(r)}`;
    }
    const b = Math.floor(n / 1e9),
        r = n % 1e9;
    const head = magnitude(BILLION, BILLION_PL, b);
    return r === 0 ? head : `${head} ${E} ${numberToWords(r)}`;
}

/**
 * Adlam digits 𞥐–𞥙 (U+1E950–1E959) → ASCII, so the number branch serves both registered scripts.
 * Re-exported from the shared fold rather than re-implemented: core/unicode.ts carries the Adlam base in
 * NATIVE_DIGIT_BASES, and this file had a third copy of the same arithmetic (fulaAdlam.ts had a fourth,
 * as a lookup table).
 */
export { foldDigitsIn as foldAdlamDigits } from "../../core/unicode.ts";
