/**
 * Mandarin (cmn) TEXT NORMALIZATION — the pre-tokenizer pass for what is left after the engine's own
 * number handling and the shared symbol tier. Pure text→text; no IPA.
 *
 * This file is DELIBERATELY SMALL, and that is the finding rather than an omission. Mandarin already had
 * more of this tier than any other language audited: years read digit-by-digit (2009年 → 二零零九年, which
 * is right and is NOT the cardinal reading), full dates compose correctly (2011年3月14日), centuries take
 * the cardinal (20世纪), 点/分 clock readings work, 第N ordinals work, 百分之 is emitted as a PREFIX by the
 * shared symbol tier, full-width punctuation is already a clause mark, and embedded Latin runs are
 * delegated to English — which is the right reading for UTC / NBA / GPS as Chinese speakers say them.
 *
 * The defects the audit did find were in the ENGINE, not here, and are fixed in mandarin.ts:
 *   · the "following character" test for the year rule and the 两 rule did not skip whitespace, and the
 *     corpus writes "2009 年" and "2 个人" WITH a space — so all 272 years were read as cardinals;
 *   · the number pattern did not accept comma grouping, so "783,562" became two numbers and a pause;
 *   · currency signs were dropped outright and °C fell through to the English letter name.
 *
 * What genuinely needs a rewrite here is the FRACTION, because Chinese states it in the opposite order
 * from the western notation: 1/5 is 五分之一, "of five parts, one". Emitting the reordered form as DIGITS
 * lets the engine's own numeral substitution do the reading.
 */

/**
 * Western fraction notation → the Chinese order, still in digits: `a/b` → `b分之a`. Guarded against dates
 * and unit ratios by requiring digits on both sides and nothing numeric adjacent. `\b` is unusable here —
 * it is defined on ASCII word characters and finds no boundary against Han script — so the boundaries are
 * explicit lookarounds, the same discipline the Hindi pass needed.
 */
const FRACTION = /(?<![\d.,/])(\d{1,4})\/(\d{1,4})(?![\d/])/gu;

export function normalizeMandarin(input: string): string {
    return input.replace(FRACTION, (_m, num: string, den: string) => `${den}分之${num}`);
}
