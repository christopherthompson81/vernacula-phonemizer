/**
 * Bambara / Bamanankan cardinal number → words. DECIMAL, with two lexicalised irregularities that rule out the
 * shared `westernNumberWords`: 10 tan and 20 mugan are unrelated to the bi- tens series, and every magnitude
 * word takes a FOLLOWING multiplier (kɛmɛ fila = 100×2) while 100 itself is the bare kɛmɛ —
 *   0–9    fu, kelen, fila, saba, naani, duuru, wɔɔrɔ, wolonwula, seegin, kɔnɔntɔn
 *   10, 20 tan, mugan (both lexical, NOT bi-derived)
 *   30–90  bi- + unit, written solid: bisaba, binaani, biduuru, biwɔɔrɔ, biwolonwula, biseegin, bikɔnɔntɔn
 *   11–99  TENS ni UNIT (tan ni kelen 11, mugan ni kelen 21, bisaba ni fila 32) — ni 'and'
 *   100s   kɛmɛ (100) / kɛmɛ + multiplier (kɛmɛ fila 200); 1000s waga + multiplier (waga kelen 1000)
 * Bambara is NOT quinary: 6–9 are opaque monomorphemic stems (wɔɔrɔ, wolonwula, seegin, kɔnɔntɔn), so unlike
 * its Atlantic neighbours Wolof/Fula there is no 5+n formation to model.
 *
 * SOURCES (authored DATA — every form attested, none reconstructed):
 *   [c] Omniglot, "Numbers in Bambara (Bamanankan)" — units, tan/mugan, the bi- tens 30–90, tan ni + unit
 *       teens, kɛmɛ hundreds, waga kelen / ba kelen 1000, milyɔn kelen 1000000.
 *   [c] languagesandnumbers.com "Bambara numbers" (bam) — the tens/hundreds/thousands algebra, incl. the
 *       worked 1234 = waga kelen ni kɛmɛ fila ni bisaba ni naani that fixes the ni-joined slot order and the
 *       "bare kɛmɛ for 100" exception.
 *   [c] kasahorow "Bambara Numbers Zero To 20" — fu 'zero'.
 * Variants NOT taken: ba kelen for 1000 (Omniglot lists waga kelen and ba kelen; waga is the form the
 * languagesandnumbers algebra uses), and the fla / wolofila / ségin / kònòntò spelling doublets.
 * TRADITIONAL vs MODERN: the inherited decimal system throughout 0–999,999; only milyɔn is a loan, because
 * Bambara has no inherited numeral above waga. Tone is lexical and unwritten in the standard orthography, so
 * (as everywhere in this engine) the numerals are written untoned.
 *
 * SCRIPTS: the composer is orthography-level, so it serves BOTH registered scripts — N'Ko digits (߀–߉,
 * U+07C0–07C9) are folded to ASCII by bambara.ts before this runs, and the resulting Latin numerals go through
 * the same g2p the N'Ko path already uses (identical IPA).
 */

const ONES = ["fu", "kelen", "fila", "saba", "naani", "duuru", "wɔɔrɔ", "wolonwula", "seegin", "kɔnɔntɔn"];
// Round tens. 10/20 are lexical; 30–90 are the solid bi- + unit derivations.
const TENS: Record<number, string> = {
    1: "tan", 2: "mugan", 3: "bisaba", 4: "binaani", 5: "biduuru",
    6: "biwɔɔrɔ", 7: "biwolonwula", 8: "biseegin", 9: "bikɔnɔntɔn",
};
const NI = "ni"; // additive coordinator between magnitude slots
const HUNDRED = "kɛmɛ";
const THOUSAND = "waga";
const MILLION = "milyɔn";

/** 0–99: lexical tan/mugan + the bi- tens, units added with ni. */
function below100(n: number): string {
    if (n < 10) return ONES[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? TENS[t]! : `${TENS[t]!} ${NI} ${ONES[u]!}`;
}

/** 1–999: bare kɛmɛ for 100, kɛmɛ + multiplier above it; remainder added with ni. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const head = h === 1 ? HUNDRED : `${HUNDRED} ${ONES[h]!}`;
    return r === 0 ? head : `${head} ${NI} ${below100(r)}`;
}

/** Non-negative integer → Bambara words; beyond the attested magnitudes (≥ 10⁹) → digit-by-digit. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9) {
        // No attested Bambara numeral above milyɔn — read the digits rather than invent a "billion".
        return [...String(Math.abs(n))].filter((c) => c >= "0" && c <= "9").map((d) => ONES[Number(d)]!).join(" ");
    }
    if (n < 1000) return below1000(n);
    if (n < 1e6) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        const head = `${THOUSAND} ${below1000(th)}`; // waga kelen 1000 (the multiplier is kept, unlike kɛmɛ)
        return r === 0 ? head : `${head} ${NI} ${below1000(r)}`;
    }
    const m = Math.floor(n / 1e6),
        r = n % 1e6;
    const head = `${MILLION} ${below1000(m)}`; // milyɔn kelen 1000000
    return r === 0 ? head : `${head} ${NI} ${numberToWords(r)}`;
}

/** N'Ko digits ߀–߉ (U+07C0–07C9) → ASCII, so the number branch serves both registered scripts. */
export function foldNkoDigits(s: string): string {
    return [...s].map((ch) => {
        const c = ch.codePointAt(0)!;
        return c >= 0x07c0 && c <= 0x07c9 ? String(c - 0x07c0) : ch;
    }).join("");
}
