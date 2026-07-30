/**
 * Ancient Greek (5th-c. BCE Attic) number → words. A compositor for 0–9,007,199,254,740,991 (before this the
 * grc engine passed digit strings straight through, so `phonemize("21", "grc")` leaked "21" into the IPA).
 *
 * SOURCE: Smyth, *Greek Grammar for Colleges* §§347–354 (the cardinal table, the fused teens πεντεκαίδεκα…,
 * the καί-linked compounds, the χίλιοι/μύριοι and μυριάς series); cross-checked against Wiktionary's Ancient
 * Greek numeral entries. Spellings are POLYTONIC and fully accented because the grc g2p reads breathings and
 * pitch accents off the diacritics (see ancientgreek.ts): a bare ⟨εις⟩ would lose the [h] of `εἷς`.
 *
 * ── The three things that make Greek not a plain units/tens/hundreds table ────────────────────────────────
 *  1. **★ καί-LINKED COMPOUNDS.** Every part of a composed numeral is joined by καὶ. Smyth §347 lists BOTH
 *     orders for the 21–99 range — units-first `εἷς καὶ εἴκοσι` and tens-first `εἴκοσι καὶ εἷς`. The
 *     TENS-FIRST (descending) order is chosen here and used uniformly at every magnitude, so that one rule
 *     covers 25, 555 and 12,345 alike (πεντακόσιοι καὶ πεντήκοντα καὶ πέντε) and the spoken order tracks the
 *     written digit order — the property that matters for a TTS reading figures aloud. Units-first would
 *     invert only the last two elements and read against the digits.
 *     EXCEPTION: 13 and 14 keep Smyth's own units-first phrases `τρεῖς καὶ δέκα` / `τέτταρες καὶ δέκα`, which
 *     are the attested forms for those two (15–19 are fused: πεντεκαίδεκα, ἑκκαίδεκα, …).
 *  2. **★ MYRIAD (10⁴) GROUPING, not thousands.** Greek's top simple magnitude is μύριοι "10,000"; large
 *     numbers are counted in myriads, and the nesting is genitive — Archimedes' μυριὰς μυριάδων = 10⁸. So this
 *     decomposes in BASE 10,000: each group of four digits is composed with the <10,000 machinery and tagged
 *     `μυριάδες` (+ one `μυριάδων` per extra level). 1,000,000 = ἑκατόν μυριάδες ("a hundred myriads");
 *     10⁹ = δέκα μυριάδες μυριάδων. A Western thousand/million/billion ladder would be an anachronism.
 *     Within a group, 1000–9000 uses the multiplicative χίλιοι series (δισχίλιοι, τρισχίλιοι, τετρακισχίλιοι…).
 *  3. **Inflection.** 1–4 and the hundreds/thousands adjectives decline. The CITATION FORM chosen is the
 *     MASCULINE NOMINATIVE (εἷς, δύο, τρεῖς, τέτταρες, διακόσιοι, χίλιοι) — the paradigm form, and the one a
 *     reader hears as "the numeral" out of context. The neuters (ἕν, τρία, τέτταρα) are not emitted. 5–100 and
 *     the fused teens are indeclinable anyway. ATTIC ⟨τέτταρες⟩ is used, not Ionic/koine ⟨τέσσαρες⟩, matching
 *     this engine's 5th-c. Attic target.
 *
 * ZERO: Classical Greek has no cardinal zero. 0 → `οὐδέν` ("nothing"), the conventional stand-in — flagged
 * here rather than silently naturalised.
 */

// Cardinals 0–9 (masculine nominative citation forms). ⟨τέτταρες⟩ is the Attic form.
const UNITS = ["οὐδέν", "εἷς", "δύο", "τρεῖς", "τέτταρες", "πέντε", "ἕξ", "ἑπτά", "ὀκτώ", "ἐννέα"];
// 10–19. 13/14 are Smyth's units-first phrases; 15–19 are the fused -καίδεκα forms (Smyth §347).
const TEENS = [
    "δέκα", "ἕνδεκα", "δώδεκα", "τρεῖς καὶ δέκα", "τέτταρες καὶ δέκα",
    "πεντεκαίδεκα", "ἑκκαίδεκα", "ἑπτακαίδεκα", "ὀκτωκαίδεκα", "ἐννεακαίδεκα",
];
// Round tens, keyed by VALUE.
const TENS: Record<string, string> = {
    "20": "εἴκοσι", "30": "τριάκοντα", "40": "τετταράκοντα", "50": "πεντήκοντα",
    "60": "ἑξήκοντα", "70": "ἑβδομήκοντα", "80": "ὀγδοήκοντα", "90": "ἐνενήκοντα",
};
// Round hundreds 100–900. ἑκατόν is indeclinable; 200+ are -κόσιοι adjectives.
const HUNDREDS = [
    "", "ἑκατόν", "διακόσιοι", "τριακόσιοι", "τετρακόσιοι",
    "πεντακόσιοι", "ἑξακόσιοι", "ἑπτακόσιοι", "ὀκτακόσιοι", "ἐνακόσιοι",
];
// Round thousands 1000–9000: the multiplicative χίλιοι series (δίς-, τρίς-, then the -κις- adverbs).
const THOUSANDS = [
    "", "χίλιοι", "δισχίλιοι", "τρισχίλιοι", "τετρακισχίλιοι",
    "πεντακισχίλιοι", "ἑξακισχίλιοι", "ἑπτακισχίλιοι", "ὀκτακισχίλιοι", "ἐνακισχίλιοι",
];
const KAI = "καὶ"; // the universal link between composed elements
const MYRIAD_SG = "μυριάς", MYRIAD_PL = "μυριάδες", MYRIAD_GEN = "μυριάδων"; // 10⁴, and the genitive for nesting

/** 1–9999 — the contents of ONE myriad group. Elements joined descending by καὶ. */
function underMyriad(n: number): string {
    const parts: string[] = [];
    const th = Math.floor(n / 1000), h = Math.floor((n % 1000) / 100), rem = n % 100;
    if (th) parts.push(THOUSANDS[th]!);
    if (h) parts.push(HUNDREDS[h]!);
    if (rem) parts.push(rem < 10 ? UNITS[rem]! : rem < 20 ? TEENS[rem - 10]! : tensUnits(rem));
    return parts.join(` ${KAI} `);
}

/** 20–99: tens-first, καὶ-linked (εἴκοσι καὶ εἷς) — the order chosen in the header note. */
function tensUnits(n: number): string {
    const t = Math.floor(n / 10) * 10, u = n % 10;
    return TENS[String(t)]! + (u ? ` ${KAI} ${UNITS[u]!}` : "");
}

/** The myriad tag for power level `k` (k≥1): μυριάδες, then one genitive μυριάδων per extra level (10⁸ = k 2). */
function myriadTag(k: number, singular: boolean): string {
    return [singular ? MYRIAD_SG : MYRIAD_PL, ...Array(k - 1).fill(MYRIAD_GEN)].join(" ");
}

/** Non-negative integer → Ancient Greek words. Out-of-range input falls back to digit-by-digit. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0) {
        return [...String(n)].filter((c) => c >= "0" && c <= "9").map((d) => UNITS[Number(d)]!).join(" ");
    }
    if (n === 0) return UNITS[0]!; // οὐδέν
    // Decompose in BASE 10,000 (the myriad), highest group first.
    const groups: number[] = [];
    for (let r = n; r > 0; r = Math.floor(r / 10000)) groups.push(r % 10000);
    const parts: string[] = [];
    for (let k = groups.length - 1; k >= 0; k--) {
        const g = groups[k]!;
        if (g === 0) continue;
        if (k === 0) parts.push(underMyriad(g));
        else if (g === 1) parts.push(myriadTag(k, true)); // μυριάς, μυριὰς μυριάδων (10⁴, 10⁸)
        else parts.push(`${underMyriad(g)} ${myriadTag(k, false)}`);
    }
    return parts.join(` ${KAI} `).replace(/\s+/gu, " ").trim();
}
