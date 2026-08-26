/**
 * French number → words (standard/France, vigesimal 70/80/90). Covers 0 … <10⁹. Decimals read
 * "virgule" + digits.
 *
 * TOKENIZATION: the sub-100 group is emitted as ONE hyphenated orthographic word (dix-sept,
 * vingt-et-un, quatre-vingt-dix-sept) and the magnitude groups are space-separated
 * ("mille neuf cent quatre-vingt-huit"). The hyphens are not cosmetic — they are what makes the
 * numeral resolve against the Lexique compounds. ⚠ THE SPACE-SEPARATED FORM IS PHONEMICALLY WRONG AT THE
 * JOINS, because each piece is then phonemized in isolation:
 *     17  dix sept      → [dis sɛt]   but dix-sept      is [disɛt]    (one [s], not two)
 *     18  dix huit      → [dis ɥit]   but dix-huit      is [dizɥit]   (voiced — huit blocks liaison
 *                                     as a separate word, but not compound-internally)
 *     19  dix neuf      → [dis nœf]   but dix-neuf      is [diznœf]
 *     21  vingt et un   → [vɛ̃ e œ̃]    but vingt-et-un   is [vɛ̃teœ̃]    (the t liaison was lost)
 *     90  quatre vingt dix → [katʁ vɛ̃ dis] but quatre-vingt-dix is [katʁəvɛ̃dis]
 * Lexique attests the compounds (including soixante-dix-sept, quatre-vingt-dix-sept, trente-sept), so
 * they are served as data; the few it lacks (quarante-et-un, cinquante-et-un, soixante-et-un) fall to
 * the per-part concatenation in french.ts, which reproduces the same result. Hyphenating throughout
 * also matches the 1990 orthographic reform.
 */

import { MANIFEST } from "./manifest.ts";

// Number words are authored DATA — consolidated in french.jsonc; the composition logic below is the algorithm.
const { small: SMALL, tens: TENS, magnitudes: MAG } = MANIFEST.numbers;

/** 0 ≤ n < 100 */
function below100(n: number): string {
    if (n < 20) return SMALL[n]!;
    if (n < 60) {
        const t = Math.floor(n / 10),
            u = n % 10;
        if (u === 0) return TENS[t]!;
        if (u === 1) return `${TENS[t]}-et-un`;
        return `${TENS[t]}-${SMALL[u]}`;
    }
    if (n < 80) {
        // 60–79: soixante + 0..19
        const r = n - 60;
        if (r === 0) return MAG.sixty;
        if (r === 1) return `${MAG.sixty}-et-un`;
        if (r === 11) return `${MAG.sixty}-et-onze`;
        return `${MAG.sixty}-${SMALL[r]}`;
    }
    const r = n - 80; // 80–99: quatre-vingt(s) + 0..19
    return r === 0 ? `${MAG.eighty}s` : `${MAG.eighty}-${SMALL[r]}`;
}

/** 1 ≤ n < 1000 */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const hundred =
        h === 1
            ? MAG.hundred
            : `${SMALL[h]} ${MAG.hundred}${r === 0 ? "s" : ""}`; // deux cents, deux cent un
    return r ? `${hundred} ${below100(r)}` : hundred;
}

/** Non-negative integer (< 10⁹) → French words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9)
        return [...(raw ?? String(Math.abs(n)))]
            .map((d) => SMALL[Number(d)] ?? d)
            .join(" ");
    if (n === 0) return SMALL[0]!; // zéro
    if (n < 1000) return below1000(n);
    if (n < 1e6) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        const thousand =
            th === 1 ? MAG.thousand : `${below1000(th)} ${MAG.thousand}`;
        return r ? `${thousand} ${below1000(r)}` : thousand;
    }
    const m = Math.floor(n / 1e6),
        r = n % 1e6;
    const million =
        m === 1 ? `un ${MAG.million}` : `${below1000(m)} ${MAG.millions}`;
    return r ? `${million} ${numberToWords(r)}` : million;
}
