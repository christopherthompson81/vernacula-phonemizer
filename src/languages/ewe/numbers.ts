/**
 * Ewe (Eʋegbe) cardinal number → words. DECIMAL, but *morphologically* opaque enough to need a bespoke
 * composer rather than the shared `westernNumberWords`: the teens and the round tens are PREFIXED derivations
 * of the unit stem, not "ten + unit" word pairs —
 *   11–19  wui- + unit  (wuiɖeke, wuieve … wuiasieke)
 *   20–90  bla- + unit  (blaeve 20, blaetɔ̃ 30, blaene 40, blaatɔ̃ 50, blaade 60, blaadre 70, blaenyi 80,
 *          blaasieke 90) — i.e. bla- is a multiplicative TEN prefix, so 20 is literally 'ten×two'
 *   21–99  TENS vɔ UNIT (blaeve vɔ ɖeka 21) — vɔ 'plus' (< vɔ 'to finish') links tens to units
 *   100s / 1000s  the magnitude noun alafa / akpe takes a FOLLOWING multiplier (alafa ɖeka 100, alafa eve 200,
 *          akpe ɖeka 1000), and slots are joined with kple 'and' (alafa ɖeka kple ɖeka 101).
 * NOTE ON THE "VIGESIMAL" LABEL: Ewe is often described as partly vigesimal because 20 blaeve is the pivot of
 * the older traditional counting (and Gbe relatives use 20-groups). In the MODERN standard system used here the
 * tens are a fully regular bla-+unit decimal series, so a base-20 composer would be wrong; blaeve is 10×2, and
 * blaene 40 is 10×4, not 20×2. Implemented as DECIMAL with the bla-/wui- prefix morphology.
 *
 * SOURCES (authored DATA — every form attested, none reconstructed):
 *   [c] Omniglot, "Numbers in Ewe" — units, wui- teens, the bla- tens 20–90, alafa ɖeka 100,
 *       alafa ɖeka kple ɖeka 101, akpe ɖeka 1000, akpe ewo 10000, miliɔn ɖeka 1000000.
 *   [c] "Des mots et des langues" (desmotsetdeslangues.eklablog.com/ewe) — the same units/teens/tens table
 *       plus the 21 pattern blaeve-vɔ-ɖeke (the source of the vɔ linker spelling used here).
 * Variants NOT taken: Omniglot's ⟨vɔ̃⟩ (nasalised) for the linker and its ⟨ɖekɛ⟩/⟨adrɛ⟩ final-vowel variants —
 * the unnasalised vɔ and the ɖeka/adre spellings are the ones the two sources agree on.
 * TRADITIONAL vs MODERN: modern standard forms throughout, including the loan miliɔn (Ewe has no inherited
 * numeral above akpe); the traditional 20-group counting is not modelled (see the note above).
 */

// 0–9. 0 is the negated existential naneke … o 'nothing' (Omniglot: naneke o / nadeke).
const ONES = ["naneke o", "ɖeka", "eve", "etɔ̃", "ene", "atɔ̃", "ade", "adre", "enyi", "asieke"];
const TEN = "ewo";
// The bound stem the wui-/bla- prefixes attach to (the unit minus its nominal e-/a- prefix where the sources
// show it: bla+eve→blaeve but bla+atɔ̃→blaatɔ̃, so the stems are just the unit spellings as listed).
const STEM = ["", "ɖeke", "eve", "etɔ̃", "ene", "atɔ̃", "ade", "adre", "enyi", "asieke"];
const PLUS = "vɔ"; // tens→units linker
const AND = "kple"; // magnitude-slot coordinator
const HUNDRED = "alafa";
const THOUSAND = "akpe";
const MILLION = "miliɔn";

/** 0–99: wui- teens, bla- tens, TENS vɔ UNIT compounds. */
function below100(n: number): string {
    if (n < 10) return ONES[n]!;
    if (n === 10) return TEN;
    if (n < 20) return `wui${STEM[n - 10]!}`;
    const t = Math.floor(n / 10),
        u = n % 10;
    const tens = `bla${STEM[t]!}`;
    return u === 0 ? tens : `${tens} ${PLUS} ${ONES[u]!}`;
}

/** 1–999: alafa + multiplier, remainder joined with kple. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const head = `${HUNDRED} ${ONES[h]!}`; // alafa ɖeka 100, alafa eve 200 — the multiplier FOLLOWS
    return r === 0 ? head : `${head} ${AND} ${below100(r)}`;
}

/** Non-negative integer → Ewe words; beyond the attested magnitudes (≥ 10⁹) → digit-by-digit. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9) {
        // No attested Ewe numeral above miliɔn — read the digits rather than invent a "billion".
        return [...(raw ?? String(Math.abs(n)))].filter((c) => c >= "0" && c <= "9").map((d) => ONES[Number(d)]!).join(" ");
    }
    if (n < 1000) return below1000(n);
    if (n < 1e6) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        const head = `${THOUSAND} ${below1000(th)}`; // akpe ɖeka 1000, akpe ewo 10000
        return r === 0 ? head : `${head} ${AND} ${below1000(r)}`;
    }
    const m = Math.floor(n / 1e6),
        r = n % 1e6;
    const head = `${MILLION} ${below1000(m)}`; // miliɔn ɖeka 1000000
    return r === 0 ? head : `${head} ${AND} ${numberToWords(r)}`;
}
