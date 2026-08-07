/**
 * Cantonese / Yue (yue) text normalization — the pre-tokenizer pass that rewrites what is not yet a
 * pronounceable word into Han text the Han→Jyutping→IPA pipeline already speaks. Pure text→text, no IPA.
 *
 * ⚠ NUMBERS STAY AS ASCII DIGITS wherever the engine's own cardinal composition is the right reading, and are
 * written out as Han ONLY where it is not — years, decimal fractions, and the colloquial 兩.
 *
 * ⚠ `\b` IS NEVER USED: it is ASCII-defined and finds no boundary against Han, so every boundary here is an
 * explicit lookaround.
 *
 * Deliberately left alone:
 *   · EMBEDDED LATIN stays on the English phonemizer, as Mandarin decided. Converting all-caps initialisms to
 *     native letter names needs a letter-name table the shipped rime-cantonese dict does not have — it carries
 *     D J K L M N P Q R T X Y Z and not A B C E F G H I O S U V W, and back-deriving the rest from whole-acronym
 *     entries conflicts immediately (S is si1 inside PC/ABC and si4 inside GPS).
 *   · 3-DIGIT YEARS (991年) keep the cardinal. Most short "N 年" forms are DURATIONS (10 年後, 48 年歷史), which
 *     take the cardinal correctly, and nothing in the surface form separates them from a real short year.
 *   · NON-YEAR numeric ranges (2-3 公里) get no connective, because a dash between short numbers is as likely a
 *     SPORTS SCORE (6-6, 7–2), read 六比六, and no surface feature separates them. Reading a score as 至 would be
 *     confidently wrong, so only YYYY-YYYY is claimed.
 *   · `．` U+FF0E is NOT a sentence period here — it is the interpunct inside transliterated foreign names
 *     (瑪麗．安東尼). Mapping it to a clause mark would insert a pause in the middle of a name. It stays
 *     unmapped, like `·` and `‧`.
 *
 * ⚠ CORE LIMITATION: core/normalizeSymbols.ts matches `[%٪]` but not FULL-WIDTH ％ U+FF05, which is ordinary CJK
 * typography. Step 1 folds it locally; the next CJK language needs the same fold until the shared tier accepts it.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/** 0–9 as Han numerals. Shared with cantonese.ts's cardinal composition (which imports it from here, so the
 *  digit-string reading below and the cardinal reading cannot drift apart). */
export const DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** A digit string read one digit at a time — the reading Chinese gives a year (二零零九) and the fractional
 *  part of a decimal (點三四), as opposed to the cardinal a quantity gets. 零 (not 〇): the corpus writes 零
 *  ×4 and 〇 ×0. */
function spellDigits(s: string): string {
    return [...s].map((c) => DIGITS[Number(c)] ?? c).join("");
}

// The percent word 百分之 PRECEDES its number, as in Mandarin, and Cantonese prose writes 百分之三十 out.
//
// ⚠ `unspacedScript` because a sign in Chinese is normally flanked by Han, which the tier's letter-boundary guard
// rejects: `$500。` reads 美元 while `為$500，` drops it.
//
// `¥` is DELIBERATELY ABSENT — neither 日圓 nor 日元 is attested here, and an unsourced word is left unread.
const SYMBOLS = makeSymbolNormalizer({
    // ⚠ `multiply` is STANDARD MATHEMATICAL REGISTER, not a corpus attestation: a corpus sweep for the operator
    // returns homographs of PREPOSITIONS in every language tried. One word, so `by` defaults to it; Cantonese
    // does not split dimension from product.
    multiply: { times: "乘" },
    ampersand: "和",
    percent: ["百分之"],
    percentPrefix: true,
    // ⚠ THE HK REGISTER, NOT THE MAINLAND ONE: 公里/公斤, not the 千米/千克 a concept label offers. A label gives
    // the language's term for a concept, not the register the text is in.
    // ⚠ `m` IS DELIBERATELY ABSENT. 米 is a one-character unit, and in an UNSPACED script that is inseparable
    // from any name containing it — 米勒 is "Miller". Declaring it would read every such name as a measurement.
    units: { km: ["公里"], kg: ["公斤"] },
    currency: { $: ["美元"], "€": ["歐元"], "£": ["英鎊"] },
    // 平方公里 is fused and word-first. Cubed is undeclared, and could not be read anyway while 米 stays
    // undeclared for the 米勒 reason above — the two gaps are the same gap.
    exponentWords: { squared: ["平方"], position: "compound" },
    unspacedScript: true,
});

/**
 * Normalize one Cantonese string. `measureWords` is the manifest's classifier inventory (step 9).
 *
 * The steps are ORDER-DEPENDENT and the coupling is stated at each one; a future reader cannot recover it from
 * the code.
 */
export function normalizeCantonese(input: string, measureWords: string): string {
    let s = input;

    // ── 1. full-width symbol fold ────────────────────────────────────────────────────────────────
    // FIRST, so exactly one representation reaches every rule below and the shared symbol tier: the tier knows
    // only ASCII % and Arabic ٪, not the full-width ％ U+FF05 that is ordinary CJK typography.
    s = s.replace(/％/gu, "%").replace(/／/gu, "/");

    // ── 1b. the plus sign ───────────────────────────────────────────────────────────────────────
    // 加 reads kaː˥. Spaced on both sides for the same reason the ampersand cell is: an adjacent initialism
    // (「UTC 加一」) would otherwise fuse into one token.
    // ⚠ BEFORE THE DEGREE RULES, or the degree pattern consumes the sign's operand and this can no longer match.
    s = s.replace(/\s*\+\s*(?=\d)/gu, " 加 ");

    // ── 1c. relational and division signs ───────────────────────────────────────────────────────
    // Spaced on both sides for the reason the 加 rule gives: an adjacent initialism would otherwise fuse.
    s = s.replace(/\s*=\s*/gu, " 等於 ");
    s = s.replace(/\s*<\s*/gu, " 小於 ");
    s = s.replace(/\s*>\s*/gu, " 大於 ");
    s = s.replace(/\s*÷\s*/gu, " 除以 ");

    // ── 1d. degrees ─────────────────────────────────────────────────────────────────────────────
    // `20℃` read as "二十 C" — the sign DROPPED and the scale letter spelled out by the Latin fallback, which
    // loses the whole unit rather than merely its sign.
    // ⚠ THE SHARED TIER CANNOT EXPRESS THIS ONE: the scale name PRECEDES the number and 度 FOLLOWS it, so the
    // reading wraps around the numeral and a `units` entry can only append.
    // Must run before the Latin-run pass that would read a bare C as a letter name. ℃/℉ arrive already folded
    // to `°C`/`°F` by the registry.
    s = s.replace(/(\d+)\s?°\s?C(?![\p{sc=Latn}])/gu, "攝氏$1度");
    s = s.replace(/(\d+)\s?°\s?F(?![\p{sc=Latn}])/gu, "華氏$1度");
    s = s.replace(/(\d+)\s?°/gu, "$1度");

    // ── 2. de-group thousands separators ─────────────────────────────────────────────────────────
    // ⚠ BEFORE EVERYTHING ELSE. A grouping comma is otherwise read as clause punctuation, and worse: the
    // engine tokenizes `\d+`, so "1,000" becomes 一 + [pause] + integerToHan(0) = 零 — the value gone, not
    // merely mispaused. Every later rule's "a digit is adjacent" test also needs the number to be one run.
    s = s.replace(/(?<![\d.,])\d{1,3}(?:,\d{3})+(?![\d,])/gu, (m) => m.replace(/,/gu, ""));

    // ── 3. YYYY-YYYY year ranges ─────────────────────────────────────────────────────────────────
    // ⚠ BEFORE THE SINGLE-YEAR RULE (step 4), because only the RIGHT endpoint of "1644-1912 年" is followed
    // by 年 — left alone, the range reads 一千六百四十四 至 一九一二, mixing cardinal and digit readings inside
    // one span. Restricted to two 4-DIGIT numbers, which excludes the short ranges and the tennis scores.
    // A range already written with the Han connective 至/到 is claimed too, but ONLY when 年 follows, since a
    // 至-joined pair of 4-digit numbers is otherwise a quantity range; the written connective is kept rather
    // than replaced. Without this arm the left endpoint stays a cardinal while step 4 gives the right one the
    // digit reading — the same split, one form later.
    s = s.replace(
        /(?<![\d.,])(\d{4})\s*([-–—])\s*(\d{4})(?![\d.,])|(?<![\d.,])(\d{4})\s*([至到])\s*(\d{4})(?![\d.,])(?=\s*年)/gu,
        (_m, a1: string, _d: string, b1: string, a2: string, conn: string, b2: string) =>
            a1 !== undefined
                ? `${spellDigits(a1)}至${spellDigits(b1)}`
                : `${spellDigits(a2)}${conn}${spellDigits(b2)}`,
    );

    // ── 4. 4-digit year before 年 ────────────────────────────────────────────────────────────────
    // AFTER de-grouping (so no grouping comma can sit inside the four digits) and AFTER step 3. A year is
    // read DIGIT BY DIGIT — 2009 年 is 二零零九年, not the cardinal 二千零九年.
    // ⚠ THE 年 MUST BE FOUND ACROSS WHITESPACE: Han corpora routinely write "2009 年" with a space, and that
    // exact detail silently defeated the same rule in Mandarin.
    s = s.replace(/(?<![\d.,:])(\d{4})(?![\d.,])(?=\s*年)/gu, (_m, y: string) => spellDigits(y));

    // ── 5. clock times ───────────────────────────────────────────────────────────────────────────
    // BEFORE the decimal rule and before the shared symbol tier: a bare-number rule must not claim either half
    // of 11:29, and the colon is otherwise clause punctuation. Cantonese says H點M分; a zero minute takes no 分
    // (10:00 → 十點). Digits are LEFT as digits so the engine's own cardinal composition reads them — which is
    // also what strips a written leading zero (06:30 → 6點30分 → 六點三十分). a.m./p.m. become the 上午/下午
    // PREFIX and are consumed here, which also keeps their stray letters off the English path.
    s = s.replace(
        /(?<![\d:])(\d{1,2}):([0-5]\d)(?![\d:])(?:\s*([ap])\s*\.?\s*m\s*\.?(?![\p{L}\p{M}]))?/giu,
        (_m, h: string, mm: string, ap: string | undefined) => {
            const pre = ap === undefined ? "" : ap.toLowerCase() === "a" ? "上午" : "下午";
            // A minute under ten takes the spoken 零 (10:08 → 十點零八分); a zero minute takes no 分 at all.
            const min = Number(mm);
            const tail = min === 0 ? "" : min < 10 ? `零${min}分` : `${min}分`;
            return `${pre}${Number(h)}點${tail}`;
        },
    );

    // ── 6. western fraction → the Chinese order ──────────────────────────────────────────────────
    // ⚠ a/b IS 分之 IN THE OPPOSITE ORDER: 1/5 is 五分之一, "of five parts, one". Digits are required on BOTH
    // sides and nothing numeric may be adjacent, which keeps Han-unit slashes (英里/小時, 國家/地區) untouched.
    // Reordered as DIGITS so the engine's cardinal reading still applies to both halves.
    s = s.replace(
        /(?<![\d.,/])(\d{1,4})\/(\d{1,4})(?![\d/])/gu,
        (_m, num: string, den: string) => `${den}分之${num}`,
    );

    // ── 7. percent, via the shared symbol tier ───────────────────────────────────────────────────
    // AFTER de-grouping (the tier needs the number contiguous) and BEFORE the decimal rule (step 8): the tier
    // matches ASCII digits next to the sign, and step 8 replaces the "." with the Han 點, which would break
    // that adjacency for any decimal percentage.
    s = SYMBOLS(s);

    // ── 8. decimals ──────────────────────────────────────────────────────────────────────────────
    // AFTER the clock (step 5) and year (step 4) rules, so no period they own is still in play, and after
    // step 7. ⚠ The separator is 點 and the FRACTIONAL part is read DIGIT BY DIGIT — 6.34 is 六點三四, never
    // 六點三十四 — so it is written out as Han here while the integer part stays a digit for the cardinal path.
    s = s.replace(
        /(?<![\d.])(\d+)\.(\d+)(?![\d.])/gu,
        (_m, int: string, frac: string) => `${int}點${spellDigits(frac)}`,
    );

    // ── 9. 2 + classifier → 兩 ───────────────────────────────────────────────────────────────────
    // LAST of the number rules, and after de-grouping so the "no digit to the left" guard means what it says
    // (1200 間 must not become 120兩間). Cantonese counts with 兩 loeng5 before a classifier, not 二.
    // ⚠ 月 and 日 are deliberately NOT in the manifest's inventory — "2 月" is February, which is 二月.
    if (measureWords !== "")
        s = s.replace(
            new RegExp(`(?<![\\d.,])2(?=\\s*[${measureWords}])`, "gu"),
            "兩",
        );

    return s;
}
