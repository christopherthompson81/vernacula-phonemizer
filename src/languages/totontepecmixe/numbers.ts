/**
 * Totontepec Mixe (mto / ayöök) cardinal number → words. VIGESIMAL (base 20) — hence Pattern B.
 *
 * ★ CRAWFORD DOES NOT COVER NUMERALS. This engine's g2p is authored from Crawford, *Totontepec Mixe
 * Phonotagmemics* (SIL, 1963), but that is a PHONOLOGY — it has no numeral list, and
 * docs/investigations/mto_native_bringup_investigation.md accordingly lists "numbers" among the deferred
 * items. So the numeral DATA here cannot be cited to Crawford and is not.
 *
 * SOURCE: "Of Languages and Numbers", *Totontepec Mixe numbers*
 * (languagesandnumbers.com/how-to-count-in-totontepec-mixe/en/mto), which is variety-specific to mto (NOT
 * one of the other Mixe varieties — Quetzaltepec pxm, Guichicovi mir, Coatlán mco, Tlahuitoltepec mxp all
 * have separate pages with different forms) and whose bibliography is Schoenhals & Schoenhals, *Vocabulario
 * Mixe de Totontepec* (ILV/SIL, Serie Mariano Silva y Aceves 14, 1965) — the standard Totontepec lexicon.
 * The orthography is the SIL practical one that page uses, which is also the current Totontepec convention:
 * ⟨c⟩ = /k/ (Omniglot's mto alphabet notes ⟨k⟩ is "used mainly or solely in Spanish loanwords"), ⟨v⟩, ⟨j⟩,
 * doubled vowels for length, and the UNDERLINE diacritic on ⟨u̱ o̱ e̱⟩. totontepecmixe.ts reads all of this;
 * NOTE that it deliberately STRIPS the underline (its value is the engine's disclosed residual — it is not in
 * Crawford), so the central/back quality those vowels mark is not recovered here either.
 *
 * ★ THE SCORES ALTERNATE 20 / 20+10 (verbatim from the source): majc 10 · ii'px 20 · ii'pxmajc 30 ·
 *   vu̱jxtcupx 40 · vu̱jxtcupxu̱cmajc 50 · toogupx 60 · toogupxu̱cmajc 70 · majctupx 80 · majctupxu̱cmajc 90.
 *   So the real bases are the four TWENTIES (ii'px, vu̱jxtcupx, toogupx, majctupx) and the "+10" forms are
 *   those plus the ten-word.
 *
 * ★★ THE COMPOSITION RULES, quoted: "Compound numbers are formed starting with the ten directly followed
 *   with the unit when the ten is a multiple of twenty (e.g.: ii'pxto'c [21], toogupxme̱jtsc [62]), and
 *   starting with the ten where the word for ten (majc) is replaced by the number from eleven to nineteen
 *   when the ten is not a multiple of [twenty] (e.g.: ii'pxmacmó̱cx [35], majctupxu̱cmactojt [96])."
 *   Everything is written SOLID (no space) below 100. The ⟨u̱c⟩ element visible in 50/70/90 and in 96 appears
 *   between the 40/60/80 bases and a following ⟨mac-⟩/⟨majc⟩ element, but NOT after ii'px (30 is ii'pxmajc,
 *   35 is ii'pxmacmó̱cx) and NOT before a bare unit (62 is toogupxme̱jtsc) — that distribution is exactly what
 *   `link()` below encodes, and every one of the five cited examples is reproduced.
 *
 * ★ HUNDREDS, quoted: "Hundreds are formed starting with the multiplier digit, followed by the word for
 *   hundred (mó̱cupx) separated with a space, except for one hundred: mó̱cupx [100], me̱jtsc mó̱cupx [200] …".
 *
 * ATTESTED RANGE: 1 … 999. The source states outright that "due to lack of data, it is only possible to count
 * accurately up to 999 in Totontepec Mixe" — there is NO attested word for a thousand, so ≥ 1000 falls back
 * to DIGIT-BY-DIGIT. Nothing above 999 is invented here.
 *
 * TWO DISCLOSED GAPS, neither invented-over:
 *  1. ⟨8⟩. The source's standalone units list is CORRUPT at 8: it prints 9's form ⟨taxtojtu̱c⟩ for both 8 and
 *     9 (and likewise repeats it for 800/900). Its TEENS are unaffected and distinguish them — 18 is
 *     ⟨mactodojt⟩ vs 19 ⟨mactaxtojt⟩ — so the standalone 8 is RECONSTRUCTED as ⟨todojtu̱c⟩ from the attested
 *     compound (10+8), by the same unit→teen relation that holds for 6 (tojtu̱c / mactojt) and 7 (vuxtojtu̱c /
 *     macvuxtojt). Flagged rather than silently guessed.
 *  2. How a HUNDRED joins a remainder (101, 555) is not stated by the source. A space is used, matching the
 *     multiplier–hundred join it does document. Not attested; disclosed.
 *  3. ZERO is not attested at all. ⟨sero⟩ (the Spanish loan *cero*, spelled with ⟨s⟩ because ⟨c⟩ is /k/ in
 *     this orthography) is emitted so the engine can render "0" and the digit-by-digit fallback; it is a
 *     LOAN STOPGAP, not an attested Totontepec Mixe numeral.
 */

const ZERO = "sero"; // loan stopgap — NOT attested (see the header)
// 1..9. Index 8 is the reconstruction discussed in the header.
const UNITS = ["", "to'c", "me̱jtsc", "toojc", "mactaaxc", "mugo̱o̱xc", "tojtu̱c", "vuxtojtu̱c", "todojtu̱c", "taxtojtu̱c"];
const TEN = "majc";
// 10..19 as they appear bound after a score (index 0 = 10). 11..19 verbatim from the source.
const TENS_PART = [TEN, "macto'c", "macme̱jtsc", "mactoojc", "macmajcts", "macmó̱cx", "mactojt", "macvuxtojt", "mactodojt", "mactaxtojt"];
// The four TWENTIES, index 1..4 → 20, 40, 60, 80.
const SCORES = ["", "ii'px", "vu̱jxtcupx", "toogupx", "majctupx"];
const HUNDRED = "mó̱cupx";
// The ⟨u̱c⟩ element that joins 40/60/80 to a following ⟨majc⟩/⟨mac-⟩ element (50, 70, 90, 96) but never
// follows ii'px (30 ii'pxmajc, 35 ii'pxmacmó̱cx) and never precedes a bare unit (62 toogupxme̱jtsc).
const link = (k: number): string => (k === 1 ? "" : "u̱c");

/** 1 ≤ n < 100, written SOLID. */
function below100(n: number): string {
    if (n < 10) return UNITS[n]!;
    if (n < 20) return TENS_PART[n - 10]!;
    const k = Math.floor(n / 20), r = n % 20;
    if (r === 0) return SCORES[k]!;
    if (r < 10) return SCORES[k]! + UNITS[r]!; // ii'pxto'c 21, toogupxme̱jtsc 62
    return SCORES[k]! + link(k) + TENS_PART[r - 10]!; // ii'pxmacmó̱cx 35, majctupxu̱cmactojt 96
}

/** Non-negative integer → Totontepec Mixe words. ≥ 1000 (no attested thousand) → digit-by-digit. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1000) {
        return [...String(Math.abs(n))].filter((c) => c >= "0" && c <= "9")
            .map((d) => (d === "0" ? ZERO : UNITS[Number(d)]!)).join(" ");
    }
    if (n === 0) return ZERO;
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100), r = n % 100;
    const head = h === 1 ? HUNDRED : `${UNITS[h]} ${HUNDRED}`; // bare mó̱cupx for 100
    return r === 0 ? head : `${head} ${below100(r)}`; // the hundred→remainder space is not attested
}
