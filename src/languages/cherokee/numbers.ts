/**
 * Cherokee (chr / ᏣᎳᎩ) cardinal number → words, written in the CHEROKEE SYLLABARY (the only script this
 * engine reads — cherokee.ts tokenizes [Ꭰ-Ᏽꭰ-ꮿ] and looks each character up in the 85-char table, so a
 * romanized numeral would phonemize to the empty string). DECIMAL, and a bespoke compositor rather than a
 * `NumbersDef` because the tens CLIP before a unit (ᏔᎵᏍᎪᎯ 20 → ᏔᎵᏍᎪ ᏌᏊ 21) and the hundreds are built by
 * suffixing the TENS word, not the unit word.
 *
 * SOURCES (two, layered):
 *  ⚠ 0–100 — Cherokee Nation Language Department, "Numbers 1 – 100 written in the Cherokee syllabary"
 *    (language.cherokee.org/posters/syllabary-and-numbers/, media/nvafexqb/numbers.pdf). Every one of the
 *    101 forms below 101 is copied from that poster, including the clipped compounds it spells out in full:
 *    "21- ᏔᎵᏍᎪ ᏌᏊ … 99- ᏐᏁᎳᏍᎪ ᏐᏁᎳ", "100- ᏍᎪᎯᏥᏆ".
 *    Cross-checked against Montgomery-Anderson, *Cherokee: A Reference Grammar of Oklahoma* pp. 517–519
 *    (examples 52–55, citing Pulte & Feeling 1975:228–229) — this engine's existing citation. It agrees on
 *    every romanization (saakwu, thali, joi, nvhki, hiski, suutali, kahlkwooki, chaneela, sohneela, skoohi;
 *    satu … sohnelatu; thalskohi … sohnelskohi; skohitskwa 'one hundred') and states the compound rule
 *    outright: "The number words above twenty consist of the base ten numeral followed by the single number."
 *    Note the grammar's example 54 writes 21 UNCLIPPED (thalskohi saakwuu); the Nation's syllabary poster
 *    clips it (ᏔᎵᏍᎪ ᏌᏊ). The poster wins here — it is the syllabary-native source and spells all 79 compounds.
 *  ⚠ 0, and 200–1000 — English Wiktionary Cherokee numerals (ᏃᏘ 'nought/zero', a borrowing from English;
 *    ᏍᎪᎯᏥᏆ 'hundred'; ᎢᏯᎦᏴᎵ 'thousand') + Omniglot "Numbers in Cherokee" for the 200–900 series
 *    (omniglot.com/language/numbers/cherokee.htm: ᏔᎵᏍᎪᎯᏥᏆ 200, ᏦᏍᎪᎯᏥᏆ 300, … ). Neither the poster nor
 *    the grammar goes above 100.
 *
 * WHAT IS EXTRAPOLATED (disclosed, not attested):
 *  1. The 200–900 series is DERIVED here as ⟨tens word for N×10⟩ + ᏥᏆ, which reproduces Omniglot's forms
 *     exactly for 100–700 and reproduces ᏍᎪᎯ+ᏥᏆ = ᏍᎪᎯᏥᏆ for 100. For 800/900 Omniglot has ᏧᏁᎵᏍᎪᎯᏥᏆ /
 *     ᏐᏁᎵᏍᎪᎯᏥᏆ, whose ᏧᏁᎵ-/ᏐᏁᎵ- roots differ from the Nation poster's 80/90 (ᏁᎳᏍᎪᎯ / ᏐᏁᎳᏍᎪᎯ); the poster's
 *     roots are used for internal consistency.
 *  2. JUXTAPOSITION of a remainder onto a hundred/thousand (101 → ᏍᎪᎯᏥᏆ ᏌᏊ) is extrapolated from the
 *     attested 21–99 pattern. The *Cherokee Phoenix* (Vol. 1 No. 27, 3 Sept. 1828, "Cherokee Language")
 *     reports an explicit ADDITIVE particle ᏫᏚᎾᏢᏗ (wi-du-na-tlv-di, "which denotes addition") for readings
 *     like "one thousand and two hundred"; we do NOT emit it, having no modern corroboration for where it is
 *     obligatory. Also unattested-and-unclipped: whether the hundred word clips before a remainder.
 *
 * ATTESTED/COMPOSED RANGE: 0 … 999,999. At 1,000,000 and above there is no modern numeral this file trusts
 * (the 1828 *Phoenix* offers ᎠᎦᏴᎵᏯ 'million' but says it "is not universally known"), so ≥ 10⁶ falls back to
 * DIGIT-BY-DIGIT rather than invent one.
 */

// 0..10. 8 is ᏣᏁᎳ (chaneela) per the poster + the grammar, not the ᏧᏁᎳ (tsunela) some word lists give.
const UNITS = ["ᏃᏘ", "ᏌᏊ", "ᏔᎵ", "ᏦᎢ", "ᏅᎩ", "ᎯᏍᎩ", "ᏑᏓᎵ", "ᎦᎵᏉᎩ", "ᏣᏁᎳ", "ᏐᏁᎳ", "ᏍᎪᎯ"];
// 11..19 — a suppletive series (-Ꮪ / -ᎦᏚ), not derivable from the units (grammar: "these patterns are
// unpredictable … should be treated as distinct words").
const TEENS = ["ᏌᏚ", "ᏔᎵᏚ", "ᏦᎦᏚ", "ᏂᎦᏚ", "ᏍᎩᎦᏚ", "ᏓᎳᏚ", "ᎦᎵᏆᏚ", "ᏁᎳᏚ", "ᏐᏁᎳᏚ"];
// 20..90, the full (standalone) forms; index 2..9. All end in ᏍᎪᎯ (skohi 'ten').
const TENS = ["", "ᏍᎪᎯ", "ᏔᎵᏍᎪᎯ", "ᏦᏍᎪᎯ", "ᏅᎩᏍᎪᎯ", "ᎯᏍᎩᏍᎪᎯ", "ᏑᏓᎵᏍᎪᎯ", "ᎦᎵᏆᏍᎪᎯ", "ᏁᎳᏍᎪᎯ", "ᏐᏁᎳᏍᎪᎯ"];
const HI = "Ꭿ"; // U+13BF ⟨hi⟩ — the syllable the tens word drops before a following unit (ᏔᎵᏍᎪᎯ → ᏔᎵᏍᎪ)
const HUNDRED_SUFFIX = "ᏥᏆ"; // ⟨tsiqua⟩: ᏍᎪᎯ+ᏥᏆ = ᏍᎪᎯᏥᏆ 100, ᏔᎵᏍᎪᎯ+ᏥᏆ = ᏔᎵᏍᎪᎯᏥᏆ 200 …
const THOUSAND = "ᎢᏯᎦᏴᎵ"; // ⟨iyagayvli⟩

/** The clipped (pre-unit) shape of a tens word: ᏔᎵᏍᎪᎯ → ᏔᎵᏍᎪ (poster: "21- ᏔᎵᏍᎪ ᏌᏊ"). */
const clip = (t: string): string => (t.endsWith(HI) ? t.slice(0, -HI.length) : t);

/** 1 ≤ n < 100. */
function below100(n: number): string {
    if (n <= 10) return UNITS[n]!;
    if (n < 20) return TEENS[n - 11]!; // TEENS[0] is 11 (10 lives in UNITS)
    const t = Math.floor(n / 10), u = n % 10;
    return u === 0 ? TENS[t]! : `${clip(TENS[t]!)} ${UNITS[u]!}`;
}

/** 1 ≤ n < 1000. The hundred word for N×100 is the TENS word for N×10 plus ᏥᏆ. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100), r = n % 100;
    const head = TENS[h]! + HUNDRED_SUFFIX;
    return r === 0 ? head : `${head} ${below100(r)}`;
}

/** Non-negative integer → Cherokee syllabary number words. ≥ 10⁶ (no trusted magnitude) → digit-by-digit. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e6) {
        return [...(raw ?? String(Math.abs(n)))].filter((c) => c >= "0" && c <= "9").map((d) => UNITS[Number(d)]!).join(" ");
    }
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000), r = n % 1000;
    const head = th === 1 ? THOUSAND : `${below1000(th)} ${THOUSAND}`; // bare ᎢᏯᎦᏴᎵ for 1,000
    return r === 0 ? head : `${head} ${below1000(r)}`;
}
