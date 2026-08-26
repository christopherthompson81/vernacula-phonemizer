/**
 * Mooré (Mossi) cardinal number → words. DECIMAL — and deliberately so: 6–9 (yoobe, yopoe, nii, wɛ) are
 * opaque stems with no living 5+n formation, so unlike its Atlantic neighbours Wolof/Fula there is nothing
 * quinary left to model (any base-5 influence is etymological only, and the sources give a flatly decimal
 * system: "Le système numéral mooré est décimal"). Bespoke rather than the shared `westernNumberWords`
 * because of the two Gur features that composer cannot express:
 *   TWO STEM SERIES — each unit has a full/citation form and a SHORT combining form used inside compounds
 *   (yembre ~ ye, yiibu ~ yi, tãabo ~ tã); the tens/hundreds/thousands are built on the SHORT series.
 *   THE NUMERAL PARTICLE a — a bare unit inside a compound is preceded by a (piig la a ye 11, tus a yi 2000),
 *   while a tens phrase is joined by la alone (koabga la pis tã 130).
 *   Round tens are the noun-class PLURAL of piiga 'ten': pisi 20, then pis + SHORT (pis tã 30 … pis wɛ 90).
 *   Hundreds/thousands likewise alternate singular↔plural: koabga 100 / kobs a X, tusri 1000 / tus a X.
 *
 * SOURCES (authored DATA):
 *   [c] "Des mots et des langues" (desmotsetdeslangues.eklablog.com/moore) — units 1–10, the piig la a teens,
 *       the pisi / pis-tã … pis-wae tens 20–90, koabga 100, tusri 1000, and the "décimal" characterisation.
 *   [c] Peace Corps/Burkina Faso, "Introduction to Mooré" (2006) — the full/short unit doublets
 *       (yembre ~ ye, yiibu ~ yi, tãabo ~ tã) and the piig la a + unit teens.
 *   [c] Lexique français-mooré (montivilliersnassere.fr) — zaalem 'zero', and the same teens/tens series.
 *   [t] the thousands pattern tus a yi (2000), from the attested tus a yi la a ye '2001'; the parallel
 *       hundreds plural kobs a X (200) follows the same singular↔plural alternation (koabga → kobs-).
 * Written with a SPACE where the sources hyphenate (pis-tã → "pis tã"): the hyphen is orthographic only and
 * the two halves are separate phonological words, which is what the g2p wants.
 * TRADITIONAL vs MODERN: traditional/inherited forms throughout below 10⁶.
 *
 * ⚠ THE MAGNITUDES ABOVE tusri WERE REFUTED BY THE CORPUS AND CORRECTED. This file used to say "NO million:
 * no attested Mooré numeral above tusri (the French loan is not documented in any source consulted), so
 * ≥ 10⁶ falls back to digit-by-digit rather than inventing one." That was a statement about the sources
 * consulted, not about Mooré: measured over the mos.wikipedia dump, filtered to Mooré paragraphs
 * (`filter-by-language.py --lang mos`), the loans are ordinary running vocabulary —
 *
 *     milyõ   ×219   (10⁶,  French million)     milyaar  ×51   (10⁹, French milliard)
 *
 * — and, decisively, the corpus supplies the SYNTAX as well as the word. What follows each one is the same
 * particle-plus-SHORT-stem compound the tens/hundreds/thousands already use in this file: `milyõ a yembr`
 * ×5, `milyõ a yiib` ×4, `milyõ a ye` ×7, `milyõ a yopoe` ×5, `milyaar a ye` ×4, `milyaar a yoob`; and for
 * a multiplier of ten or more the bare figure, `milyõ 37` ×6, `milyõ 20` ×3, `milyaar 128`, `milyaar 44`.
 * That is exactly `tus a yi` (2000) and `kobs a nu` (500), so the composition below is the existing one
 * with two more scale words, not a new mechanism. Attested in the slot: `ligd milyõ a yopoe` ("7 million in
 * money"), `ton milyõ 29`, `dolaar milyaar a 9`, `UNESCO bao ligidi … bɩ milyõ 2.26`.
 *
 * ⚠ NO SINGULAR/PLURAL ALTERNATION FOR EITHER, unlike piiga→pisi, koabga→kobs and tusri→tus: the corpus
 * writes `milyõ a ye` for ONE million rather than a bare singular, so both scale words take the particle at
 * every multiplier and there is no second stem to record. That is the evidence, not a simplification.
 *
 * ≥ 10¹² still falls back to digit-by-digit — nothing above milyaar is attested.
 *
 * ⚠ WHY THIS LANDED WITH THE NORMALIZATION LAYER. `normalize.ts` de-groups thousands separators, and 25
 * figures in the corpus cross 10⁶ once their separators are removed (`19,811,000`, `13 025 000`,
 * `1,286,728`). Before the de-grouping those figures never reached the number path as one integer, so the
 * fallback was unreachable for them; after it, every one of the 25 would have read as a string of loose
 * digits. The two changes are coupled and were measured together.
 */

// Citation/full forms 0–10 (0 = zaalem 'nothing').
const ONES = ["zaalem", "yembre", "yiibu", "tãabo", "naase", "nu", "yoobe", "yopoe", "nii", "wɛ", "piiga"];
// SHORT combining forms 1–9, used after the particle a and inside the pis-/kobs-/tus- compounds.
const SHORT = ["", "ye", "yi", "tã", "naase", "nu", "yoobe", "yopoe", "nii", "wɛ"];
const LA = "la"; // 'and' — the additive coordinator
const A = "a"; // the numeral particle before a bare unit
const TEN = "piiga";
const TEN_COMB = "piig"; // the combining form of piiga in the teens (piig la a ye)
const TWENTY = "pisi"; // the plural of piiga; 30–90 use the bare plural stem pis
const TEN_PL = "pis";
const HUNDRED = "koabga";
const HUNDRED_PL = "kobs";
const THOUSAND = "tusri";
const THOUSAND_PL = "tus";
// 10⁶ / 10⁹ — the French loans, attested ×219 / ×51 in the filtered corpus with the particle compound.
// Neither alternates for number (see the header), so one stem each.
const MILLION = "milyõ";
const BILLION = "milyaar";

/** A bare unit as a compound member: the particle a + the SHORT stem. */
const unit = (u: number): string => `${A} ${SHORT[u]!}`;

/** Round tens 10–90. */
function tens(t: number): string {
    return t === 1 ? TEN : t === 2 ? TWENTY : `${TEN_PL} ${SHORT[t]!}`;
}

/** 0–99. */
function below100(n: number): string {
    if (n < 10) return ONES[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    const head = n < 20 ? TEN_COMB : tens(t); // the teens use the combining piig, not piiga
    return u === 0 ? tens(t) : `${head} ${LA} ${unit(u)}`;
}

/** 1–999: koabga (100) / kobs a X (200…), remainder joined with la. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const head = h === 1 ? HUNDRED : `${HUNDRED_PL} ${unit(h)}`;
    // a bare unit remainder needs the particle; a tens phrase does not
    return r === 0 ? head : `${head} ${LA} ${r < 10 ? unit(r) : below100(r)}`;
}

/** 1–999,999: tusri (1000) / tus a X (2000…), remainder joined with la. */
function below1e6(n: number): string {
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000),
        r = n % 1000;
    const head = th === 1 ? THOUSAND : th < 10 ? `${THOUSAND_PL} ${unit(th)}` : `${THOUSAND_PL} ${below1000(th)}`;
    return r === 0 ? head : `${head} ${LA} ${r < 10 ? unit(r) : below1000(r)}`;
}

/**
 * A scale word (milyõ 10⁶, milyaar 10⁹) plus its multiplier, then the remainder joined with la.
 *
 * The multiplier takes the particle-plus-SHORT-stem compound below ten (`milyõ a yopoe` = 7 million) and
 * the bare composed figure at ten and above (`milyõ 37`) — the same split `below1000` already makes for
 * `kobs`/`tus`, and the same one the corpus writes. ⚠ NO SINGULAR FORM: 1 million is `milyõ a ye`, not a
 * bare `milyõ`, which is why this does not take the `th === 1` branch `below1e6` has for tusri.
 */
function scaled(n: number, scale: number, word: string, rest: (r: number) => string): string {
    const c = Math.floor(n / scale),
        r = n % scale;
    const head = c < 10 ? `${word} ${unit(c)}` : `${word} ${below1000(c)}`;
    return r === 0 ? head : `${head} ${LA} ${r < 10 ? unit(r) : rest(r)}`;
}

/** Non-negative integer → Mooré words; ≥ 10¹² (nothing above milyaar is attested) → digit-by-digit. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12) {
        return [...(raw ?? String(Math.abs(n)))].filter((c) => c >= "0" && c <= "9").map((d) => ONES[Number(d)]!).join(" ");
    }
    if (n < 1e6) return below1e6(n);
    if (n < 1e9) return scaled(n, 1e6, MILLION, below1e6);
    return scaled(n, 1e9, BILLION, (r) => (r < 1e6 ? below1e6(r) : scaled(r, 1e6, MILLION, below1e6)));
}
