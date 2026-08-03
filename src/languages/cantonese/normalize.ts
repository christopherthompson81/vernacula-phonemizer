/**
 * Cantonese / Yue (yue) TEXT NORMALIZATION (#562) — the pre-tokenizer pass that rewrites what is not yet a
 * pronounceable word into Han text the existing Han→Jyutping→IPA pipeline already speaks. Pure text→text,
 * no IPA. Numbers are left as ASCII digits wherever the engine's own cardinal composition is the right
 * reading, and written out as Han ONLY where it is not (years, decimal fractions, the colloquial 兩).
 *
 * EVIDENCE — FLEURS yue_hant_hk, 1,726 unique utterances, column 3 (the cased one). Counts are instances:
 *   4-digit year + 年      119   ← the big one; read as the CARDINAL 二千零九年 instead of 二零零九年
 *   月 / 日 after a digit  38 / 27   (already correct — cardinal is the right reading for these)
 *   comma-grouped numbers   27   ← "1,000" → 一 [pause] 零: the comma was clause punctuation AND
 *                                  integerToHan(000) is 零, so the value was destroyed outright
 *   decimals                15   ← "6.34" → 六點… no: the "." was a phrase break and "34" a cardinal
 *   clock H:MM              12   ← "11:29" → 十一 [pause] 二十九; no 點/分 at all
 *   percent                 12   ← the sign was DROPPED; 80% read as 八十
 *   numeric ranges           7   (4 of them YYYY-YYYY year ranges; 2 are tennis SCORES — see step 3)
 *   世紀 after a digit      16   (already correct — cardinal)
 *   第 N                    12   (already correct)
 *   2 + classifier           4   ← 二個 instead of 兩個
 *   a/b fraction             1
 *   a.m. / p.m.              2
 *   embedded Latin runs    267   (see "What is deliberately left", below)
 *
 * WHAT IS DELIBERATELY LEFT, with the measurement that decided it:
 *
 *   · EMBEDDED LATIN stays on the English phonemizer, as Mandarin decided. Japanese and Thai both convert
 *     all-caps initialisms to native letter names instead, and that was tried here first: of the 45 distinct
 *     all-caps runs in the corpus only FOUR (KNP, TMZ, TT, XDR) can be spelled entirely from letter names
 *     that the shipped rime-cantonese dict actually contains — it has D J K L M N P Q R T X Y Z and not
 *     A B C E F G H I O S U V W. Back-deriving the missing ones from the dict's whole-acronym entries
 *     immediately conflicts: S is si1 inside PC/ABC and si4 inside GPS. That is invented data, and the
 *     playbook's rule is that a wrong word beats a dropped sign only in the other direction.
 *   · 3-DIGIT YEARS (991年, 323年, 356年 — 3 instances) keep the cardinal. The 15 non-4-digit "N 年" hits are
 *     mostly DURATIONS (10 年後, 250 年後, 48 年歷史, 100 年的物品), which take the cardinal correctly, and
 *     nothing in the surface form separates them from the 3 real short years. Same call Mandarin made.
 *   · NON-YEAR numeric ranges (2-3 公里, 100-200 英里, 10-60 分鐘) get no connective. The other two dashes in
 *     the corpus are tennis scores — 比分達到 6-6, 交手紀錄為 7–2 — which are read 六比六 / 七比二, and no
 *     surface feature separates them (6-6 is even followed by a Han character, 時, just as 2-3 is followed
 *     by 公里). Reading a score as 至 would be confidently wrong, so only YYYY-YYYY ranges are claimed.
 *   · `．` U+FF0E ×16 is NOT a sentence period in this corpus — it is the interpunct inside transliterated
 *     foreign names (瑪麗．安東尼, 卡米爾．聖桑, 巴布．狄倫). Mapping it to a clause mark would have inserted
 *     16 pauses in the middle of names. It stays unmapped, exactly like `·` ×64 and `‧` ×48.
 *   · CURRENCY: zero currency signs in the corpus. UNITS: the corpus writes its units in Han (公里, 英里,
 *     分鐘, 英寸, 級); the only ASCII unit is Ghz ×2, for which no sourced Cantonese reading was available.
 *     No units/currency tier is declared rather than guess at one.
 *
 * CORE LIMITATION (reported, not patched): core/normalizeSymbols.ts matches `[%٪]` but not the
 * FULL-WIDTH ％ U+FF05, which is ordinary CJK typography and appears once here (20％). Step 0 folds it
 * locally; the next CJK language will need the same fold until the shared tier accepts it.
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

// The percent word 百分之 PRECEDES its number, as in Mandarin — and the corpus corroborates it directly,
// writing 百分之三十 in running text ×3. Declared through the shared tier rather than reimplemented.
//
// CURRENCY (#584). `$5` read as bare *ŋ̩˩˧*. yue_hant_hk contains ZERO `$` against 54 `%`, so the
// corpus-driven gate could not see it — but the words are in that same corpus:
//
//   美元 ×8  "每次可被處以 1,000 美元的罰款"
//   英鎊 ×3  "福克蘭群島鎊 (FKP)，價值與英鎊 (GBP) 相等"
//   歐元 ×2  "每年營業額超過 100 億歐元（約 147 億美元）"
//
// Counted by substring, which is the only test an unspaced script admits; the examples are the evidence.
// `¥` is DELIBERATELY ABSENT — neither 日圓 nor 日元 occurs, and an unsourced word is left unread.
//
// `unspacedScript` because a sign in Chinese is normally flanked by Han, which the tier's letter-boundary
// guard rejected: `$500。` read 美元 while `為$500，` dropped it (#586).
const SYMBOLS = makeSymbolNormalizer({
    percent: ["百分之"],
    percentPrefix: true,
    // #586 — `5 km` read as *ŋ̩˩˧ ˈʊkm*: no unit was declared. Verified in yue_hant_hk:
    // 公里 ×50 "公園占地一萬九千平方公里", 公斤 ×2 "（ 90 公斤）的人".
    //
    // WIKIDATA'S OWN yue LABELS ARE THE WRONG VARIETY, and the corpus is what caught it: it offers 千米 and
    // 千克, the mainland standard, which occur ×0 here, against the HK 公里 ×50 and 公斤 ×2. A concept label
    // gives the language's term for a concept, not the register this corpus is in.
    //
    // `m` IS DELIBERATELY ABSENT. 米 substring-matches ×36 and the first example is 米勒 — "Miller". In an
    // unspaced script a one-character unit is unseparable from any name that contains it, so a declaration
    // would read every such name as a measurement. Trap 19's caveat, arriving as a real hazard.
    units: { km: ["公里"], kg: ["公斤"] },
    currency: { $: ["美元"], "€": ["歐元"], "£": ["英鎊"] },
    // `平方公里` ×4 ("公園占地一萬九千平方公里"), fused and word-first. 立方 is ×0 here, and `m³` could not be
    // read anyway while 米 stays undeclared for the 米勒 reason above — the two gaps are the same gap.
    exponentWords: { squared: ["平方"], position: "compound" },
    unspacedScript: true,
});

/**
 * Normalize one Cantonese string. `measureWords` is the manifest's classifier inventory (step 7).
 *
 * The steps are ORDER-DEPENDENT and the coupling is stated at each one; a future reader cannot recover it
 * from the code. `\b` is never used: it is ASCII-defined and finds no boundary against Han script, so every
 * boundary here is an explicit lookaround.
 */
export function normalizeCantonese(input: string, measureWords: string): string {
    let s = input;

    // ── 1. full-width symbol fold ────────────────────────────────────────────────────────────────
    // FIRST, so that exactly one representation reaches every rule below and the shared symbol tier.
    // ％ U+FF05 ×1 (20％) and ／ U+FF0F ×1; the shared tier knows only ASCII % and Arabic ٪.
    s = s.replace(/％/gu, "%").replace(/／/gu, "/");

    // ── 1b. degrees ──────────────────────────────────────────────────────────────────────────────
    // `20℃` read as "二十 C" — the sign DROPPED and the scale letter spelled out by the Latin fallback,
    // which is the whole unit lost rather than merely its sign (#586). The shared tier cannot express this
    // one: the scale name PRECEDES the number and 度 FOLLOWS it, so the reading wraps around the numeral
    // and a `units` entry can only append.
    //
    // Both words and the ORDER are the corpus's own, ×2 each:
    //   攝氏  "氣溫經常超過攝氏 30 度"        華氏  "在華氏 90 度的高溫中"
    // Wikidata's `degree Celsius` label for yue is 攝氏 too, independently. The SIGN itself occurs ×0 here,
    // so this is robustness for plausible input — but the words are not a guess.
    //
    // Before the thousands de-grouping is fine (no digits move), and it must be before the Latin-run pass
    // that reads a bare C as a letter name. ℃/℉ arrive already folded to `°C`/`°F` by the registry.
    s = s.replace(/(\d+)\s?°\s?C(?![\p{sc=Latn}])/gu, "攝氏$1度");
    s = s.replace(/(\d+)\s?°\s?F(?![\p{sc=Latn}])/gu, "華氏$1度");
    s = s.replace(/(\d+)\s?°/gu, "$1度");

    // ── 2. de-group thousands separators ─────────────────────────────────────────────────────────
    // BEFORE EVERYTHING ELSE. A grouping comma is otherwise read as clause punctuation, and worse: the
    // engine tokenizes `\d+`, so "1,000" became 一 + [pause] + integerToHan(0) = 零 — the value was gone,
    // not merely mispaused. Every later rule's "a digit is adjacent" test also needs the number to be one
    // run. 27 instances.
    s = s.replace(/(?<![\d.,])\d{1,3}(?:,\d{3})+(?![\d,])/gu, (m) => m.replace(/,/gu, ""));

    // ── 3. YYYY-YYYY year ranges ─────────────────────────────────────────────────────────────────
    // BEFORE the single-year rule (step 4), because only the RIGHT endpoint of "1644-1912 年" is followed
    // by 年 — left alone, the range would have read 一千六百四十四 至 一九一二, mixing cardinal and digit
    // readings inside one span. Restricted to two 4-DIGIT numbers: that claims all four year ranges in the
    // corpus (1644-1912, 1894-1895, 1418-1450, 1469–1539) and none of the five short numeric ranges, two of
    // which are tennis scores that would be confidently wrong as 至.
    // A range already written with the Han connective 至/到 is claimed too, but ONLY when 年 follows
    // ("1977 至 1981 年間"), since a 至-joined pair of 4-digit numbers can otherwise be a quantity range; the
    // written connective is kept rather than replaced. Without this the left endpoint stayed a cardinal
    // while step 4 gave the right one the digit reading — the same split, one form later.
    s = s.replace(
        /(?<![\d.,])(\d{4})\s*([-–—])\s*(\d{4})(?![\d.,])|(?<![\d.,])(\d{4})\s*([至到])\s*(\d{4})(?![\d.,])(?=\s*年)/gu,
        (_m, a1: string, _d: string, b1: string, a2: string, conn: string, b2: string) =>
            a1 !== undefined
                ? `${spellDigits(a1)}至${spellDigits(b1)}`
                : `${spellDigits(a2)}${conn}${spellDigits(b2)}`,
    );

    // ── 4. 4-digit year before 年 ────────────────────────────────────────────────────────────────
    // AFTER de-grouping (so no grouping comma can sit inside the four digits) and AFTER step 3. A year is
    // read DIGIT BY DIGIT — 2009 年 is 二零零九年, not the cardinal 二千零九年 the engine produced for all
    // 119 of them. The 年 must be found ACROSS WHITESPACE: this corpus writes "2009 年" with a space, and
    // that exact detail is what silently defeated the same rule in Mandarin.
    s = s.replace(/(?<![\d.,:])(\d{4})(?![\d.,])(?=\s*年)/gu, (_m, y: string) => spellDigits(y));

    // ── 5. clock times ───────────────────────────────────────────────────────────────────────────
    // BEFORE the decimal rule and before the shared symbol tier: a bare-number rule must not claim either
    // half of 11:29, and the colon is otherwise clause punctuation (the engine read it as a pause). Cantonese
    // says H點M分 (點 dim2 / 分 fan1); a zero minute takes no 分 (10:00 → 十點). Digits are LEFT as digits so
    // the engine's own cardinal composition reads them — that is also what strips the written leading zero
    // (06:30 → 6點30分 → 六點三十分). All 12 corpus colons are genuine clock times. a.m./p.m. ×2 become the
    // 上午/下午 PREFIX and are consumed here, which also keeps their stray letters off the English path.
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
    // a/b is 分之 in the opposite order: 1/5 is 五分之一, "of five parts, one". Digits are required on BOTH
    // sides and nothing numeric may be adjacent, which is what keeps the corpus's Han-unit slashes
    // (英里/小時, 碼/米, 國家/地區 — 10 of the 11 slashes) untouched. Reordered as DIGITS so step 5 has
    // already passed and the engine's cardinal reading still applies to both halves.
    s = s.replace(
        /(?<![\d.,/])(\d{1,4})\/(\d{1,4})(?![\d/])/gu,
        (_m, num: string, den: string) => `${den}分之${num}`,
    );

    // ── 7. percent, via the shared symbol tier ───────────────────────────────────────────────────
    // AFTER de-grouping (the tier needs the number contiguous) and BEFORE the decimal rule (step 8), because
    // the tier matches ASCII digits next to the sign and step 8 replaces the "." with the Han 點, which would
    // break that adjacency for any decimal percentage. 12 instances, every one of which lost the sign.
    s = SYMBOLS(s);

    // ── 8. decimals ──────────────────────────────────────────────────────────────────────────────
    // AFTER the clock (step 5) and the year (step 4) rules, so no period they own is still in play, and after
    // step 7. The separator is 點 and the FRACTIONAL part is read digit by digit — 6.34 is 六點三四, never
    // 六點三十四 — so it is written out as Han here while the integer part stays a digit for the cardinal
    // path. Before this the "." was a clause pause and "34" a cardinal. 15 instances.
    s = s.replace(
        /(?<![\d.])(\d+)\.(\d+)(?![\d.])/gu,
        (_m, int: string, frac: string) => `${int}點${spellDigits(frac)}`,
    );

    // ── 9. 2 + classifier → 兩 ───────────────────────────────────────────────────────────────────
    // LAST of the number rules, and after de-grouping so the "no digit to the left" guard means what it says
    // (1200 間 must not become 120兩間). Cantonese counts with 兩 loeng5 before a classifier, not 二: 兩個,
    // 兩座, 兩種. 月 and 日 are deliberately NOT in the manifest's inventory — "2 月" ×2 in this corpus is
    // February, which is 二月. 4 instances.
    if (measureWords !== "")
        s = s.replace(
            new RegExp(`(?<![\\d.,])2(?=\\s*[${measureWords}])`, "gu"),
            "兩",
        );

    return s;
}
