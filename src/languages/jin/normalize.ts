/**
 * Jin Chinese / 晋语 (cjy, Taiyuan) text normalization — the pre-tokenizer pass that rewrites what is not yet
 * a pronounceable word into Han the dict already speaks. Pure text→text, no IPA.
 *
 * ⚠ THIS LANGUAGE HAS NO CORPUS, AND THAT BOUNDS EVERY RULE BELOW. There is no `cjy.wikipedia` (gan, hak and
 * cdo have one; cjy and hsn do not) and no FLEURS. The only Jin text that exists is the Wikimedia Incubator's
 * `Wp/cjy` — 159 pages, 15,088 characters of raw wikitext of which **3,060 are Han**, most of the rest CSS
 * and markup from the main page. It is mined to `tools/corpus/mined/cjy.jsonc` anyway, and the artifact's own
 * verdict is the finding: **covered 7/35 cells**, with degrees, fractions, units, ranges, currency, percent,
 * grouped, ampersand and twenty more EMPTY. The playbook says an empty cell is a query to run — here the
 * query has been run and the text does not exist.
 *
 * So this layer cannot be sized by frequency and its corpus diff cannot carry the usual weight. It rests on
 * two tiers instead, and says which is which at every rule.
 *
 * ⚠ TIER 1, AND IT IS A HARD GATE: THE SHIPPED DICT DECIDES WHETHER A WORD SPEAKS AT ALL. The shared engine
 * (`sinitic/hanDictIpa.ts`) segments by greedy longest match and **skips an uncovered character SILENTLY** —
 * so an unsourced word is not mispronounced, it VANISHES, which is worse than leaving the symbol unread.
 * Every word this file emits was checked through the engine:
 *
 *     SPEAKS   百分之 · 分之 · 點 · 到 · 和 · 公里 · 公尺 · 公斤 · 平方 · 立方 · 零 一 二 …
 *     SILENT   度 · 摄氏/攝氏 · 两/兩 · 正 · 减
 *     HALF     等于 → təŋ˥˧ — ONE syllable, because 于 is silent: it would say "děng" and drop "yú"
 *
 * That decides four refusals on FACT rather than taste, and they are listed below rather than inferred.
 *
 * ⚠ TIER 2 — the incubator text, thin but the language's own, and it settles the two choices that are
 * genuinely dialectal rather than pan-Chinese:
 *     和 ×16, coordinating — `吳語、粵語和閩南語`, `并州話和呂梁話`, `河南省…大部和河北省西面`
 *     到 ×5, "up to"       — `到了1996年`, `到2007年`
 * (⟨跟⟩ ×5 is the colloquial alternative and 和 is three times commoner here. ⟨箇⟩ ×15 against ⟨个⟩ ×4 is a
 * real Jin orthographic fact, noted for whoever adds a classifier rule — this file needs none.)
 *
 * Deliberately left alone, each on the dict check rather than a feeling:
 *   · THE DEGREE. ⟨度⟩ is SILENT, so `20°C` would lose the word as well as the sign — strictly worse than
 *     the raw sign, which at least survives as a RAWMARK the scan can see. ⟨摄氏⟩ is silent too.
 *   · THE `2 + classifier → 两` RULE that cmn and yue both carry: ⟨两⟩ and ⟨兩⟩ are both SILENT.
 *   · THE RELATIONAL SIGNS. ⟨等于⟩ emits one syllable and drops the second.
 *   · CURRENCY. ⟨元⟩ speaks, but its four incubator instances are 維基元 (Meta-Wiki) and the names 元好問 /
 *     柳宗元 — never money. No Jin currency word is attested anywhere available, so the sign stays unread.
 *   · THE CLOCK, and every other class the artifact reports EMPTY. Nothing to measure means nothing to claim.
 *
 * ⚠ THE ONE WORD SHIPPED WITHOUT AN ATTESTED SENSE is the decimal ⟨點⟩: its three incubator instances are the
 * NOUN (特點 "characteristic", 點“寫動” "click"), never a separator. That is the same trap wuu's 点, jv's
 * `koma` and nan's `tiám` hit, and it is shipped for the same reason — a written corpus is the weakest
 * evidence there is about how a SYMBOL is spoken, and the alternative is a decimal point read as a clause
 * pause. Here the argument is thinner than in those languages, because there is no corpus to count against.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/** 0–9 as Han numerals, for the digit-by-digit readings (years, decimal fractions). Every one speaks. */
const DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** A digit string read one digit at a time — what Chinese gives a year (一九九六) and a decimal's tail. */
function spellDigits(s: string): string {
    return [...s].map((c) => DIGITS[Number(c)] ?? c).join("");
}

/**
 * ⚠ `unspacedScript`, because a sign in Han prose is flanked by Han and the tier's letter-boundary guard
 * would otherwise refuse it. `percentPrefix` because 百分之 PRECEDES its number, as in every Sinitic variety.
 *
 * ⚠ NO `currency` AND NO `degree`, for the reasons in the header — both would emit silence.
 * ⚠ `m` IS ABSENT for the reason yue and wuu give: 米 is a one-character unit, and in an unspaced script that
 * is inseparable from any name containing it. 公尺 is declared instead, which is two characters and speaks.
 */
const SYMBOLS = makeSymbolNormalizer({
    ampersand: "和",
    percent: ["百分之"],
    percentPrefix: true,
    units: { km: ["公里"], kg: ["公斤"] },
    exponentWords: { squared: ["平方"], cubed: ["立方"], position: "compound" },
    unspacedScript: true,
});

/**
 * Normalize one Jin string. The steps are ORDER-DEPENDENT and each says what breaks if it moves.
 */
export function normalizeJin(input: string): string {
    let s = input;

    // ── 1. de-group thousands ────────────────────────────────────────────────────────────────────
    // ⚠ FIRST, and this is the most destructive defect the engine has on numbers: the tokenizer splits
    // `\d+`, so a grouping comma is read as a clause pause AND the value is destroyed — `1,000` came out
    // *iəʔ˨ , liŋ˩˩*, "one … zero". Exactly-3-digit groups, which cannot touch a decimal.
    s = s.replace(/(?<![\d.,])\d{1,3}(?:,\d{3})+(?![\d,])/gu, (m) => m.replace(/,/gu, ""));

    // ── 2. a year before 年 ──────────────────────────────────────────────────────────────────────
    // AFTER de-grouping, so no grouping comma sits inside the four digits. A year is read DIGIT BY DIGIT
    // across Sinitic — `1996年` is 一九九六年, not the cardinal 一千九百九十六年, which is what the engine
    // produced. ⚠ INFERENCE, and flagged as one: the incubator writes `到了1996年` and `到2007年` in digits
    // and never spells a year out, so this is the pan-Chinese convention (corpus-verified in the cmn and wuu
    // layers) applied to a language whose own corpus cannot confirm it.
    // ⚠ THE 年 MUST BE FOUND ACROSS WHITESPACE — that exact detail silently defeated the same rule in cmn.
    // ⚠ AND THE RANGE ARM COMES FIRST, because only the RIGHT endpoint of `1996-2007年` is followed by 年:
    // left alone it read 一千九百九十六 二零零七年, mixing the cardinal and the digit reading inside one span —
    // and the range rule in step 6 could never repair it, since by then the right endpoint is Han and no
    // longer adjacent to the dash. The same shape bit the cmn, yue and wuu layers.
    s = s.replace(
        /(?<![\d.,])(\d{4})\s*[-–~〜]\s*(\d{4})(?![\d.,])(?=\s*年)/gu,
        (_m, a: string, b: string) => `${spellDigits(a)}到${spellDigits(b)}`,
    );
    // ⚠ AND THE FORM WITH 年 ON BOTH ENDPOINTS — `1996年-2007年` — which must run BEFORE the single-year
    // rule, not after: placed after, both endpoints are already Han and a digit pattern can never see them.
    // Both years take the digit reading either way (each is followed by its own 年), so nothing is misread;
    // what vanishes is the CONNECTIVE, leaving one date abutting another. wuu needed the same third arm.
    // ⚠ 3-DIGIT YEARS ARE NOT CLAIMED anywhere here, which is the fleet's position: most short `N年` forms
    // are DURATIONS (`48年歷史`) and nothing in the surface form separates them from a short year.
    s = s.replace(
        /(?<![\d.,])(\d{4})\s*年\s*[-–~〜]\s*(?=\d{4}\s*年)/gu,
        (_m, a: string) => `${spellDigits(a)}年到`,
    );
    s = s.replace(/(?<![\d.,:])(\d{4})(?![\d.,])(?=\s*年)/gu, (_m, y: string) => spellDigits(y));


    // ── 3. the fraction, in the Chinese order ────────────────────────────────────────────────────
    // ⚠ `a/b` IS `b分之a` — "of b parts, a" — and both 分 and 之 speak. Digits required on BOTH sides with
    // nothing numeric adjacent, which keeps a date or a path out. BEFORE the percent tier, whose output
    // contains 分之 itself and would otherwise be re-read by this rule.
    // ⚠ NOT WHEN BOTH SIDES ARE FOUR DIGITS — `2020/2021` is an academic year or a season, not a fraction,
    // and the rule read it as "2020 twenty-twenty-firsts". THIS IS THE THIRD TIME THAT SHAPE HAS SURFACED in
    // this sweep: Javanese guarded it (`taun 1985/1986`) and Min Nan's whole fraction rule was removed when
    // its only slash turned out to be `Fahrenheit 9/11`. Carried here on their evidence, since cjy has no
    // corpus of its own to count either shape in.
    s = s.replace(
        /(?<![\d.,/])(\d{1,4})\/(\d{1,4})(?![\d/])/gu,
        (m, num: string, den: string) => (num.length === 4 && den.length === 4 ? m : `${den}分之${num}`),
    );

    // ── 4. percent, units, exponents and the ampersand, via the shared tier ──────────────────────
    // AFTER de-grouping (the tier needs the number contiguous) and BEFORE the decimal rule: the tier matches
    // ASCII digits next to the sign, and step 5 replaces the "." with 點, which would break that adjacency
    // for a decimal percentage.
    s = SYMBOLS(s);

    // ── 5. decimals ─────────────────────────────────────────────────────────────────────────────
    // LAST of the number rules, for the reason above. ⚠ The separator is 點 and the FRACTIONAL part is read
    // DIGIT BY DIGIT — 6.34 is 六點三四, never 六點三十四 — so it is written out as Han while the integer part
    // stays a digit for the engine's own cardinal path.
    // ⚠ `(?!\.\d)` KEEPS A DOTTED DESIGNATION OUT (`1.2.3`), a guard the Javanese and Min Nan layers both
    // earned; with no corpus here it is carried on their evidence rather than this language's.
    s = s.replace(
        /(?<![\d.,])(\d+)\.(\d{1,3})(?![\d,])(?!\.\d)/gu,
        (_m, int: string, frac: string) => `${int}點${spellDigits(frac)}`,
    );

    // ── 6. ranges ───────────────────────────────────────────────────────────────────────────────
    // LAST, so every rule that owns a dash has already consumed it. ⟨到⟩ is the incubator's own connective
    // (×5, `到了1996年`, `到2007年`) and the one this language demonstrably uses for "up to".
    // ⚠ NOT CLAIMED WHEN A LATIN LETTER OR ANOTHER DASH IS ADJACENT — that keeps a designation (`ISO 8859-1`)
    // and a chained identifier out. With no corpus to count the false-positive shapes, the guard is
    // deliberately tighter than the corpus-backed layers': digits only, both sides, nothing else touching.
    // ⚠ AND NOT AFTER A LATIN RUN AT ALL, which a one-character lookbehind cannot express: `ISO 8859-1` put
    // a SPACE between the identifier and the digits, so the guard saw the space and read the designation as
    // "8859 到 1". Checked over the preceding characters instead.
    s = s.replace(
        /(?<![\d.,/\-\p{sc=Latn}])(\d+)\s*[-–~〜]\s*(\d+)(?![\d.,/\-\p{sc=Latn}])/gu,
        (m, a: string, b: string, off: number, full: string) =>
            /\p{sc=Latn}[\s\p{sc=Latn}]*$/u.test(full.slice(Math.max(0, off - 12), off)) ? m : `${a}到${b}`,
    );

    return s;
}
