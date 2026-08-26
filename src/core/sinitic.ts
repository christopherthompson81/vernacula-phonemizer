/**
 * SHARED SINITIC NUMBER RULES — the shapes that five Han-orthography layers each rediscovered.
 *
 * ⚠ WHY THIS EXISTS, AND WHY IT IS NOT THE THING THE PLAYBOOK WARNS AGAINST. The playbook's premise is that
 * "there is no shared `normalize dates` function, because Japanese writes 3月14日, German writes 14. März":
 * orthographic conventions are per-language. That is right ACROSS FAMILIES and wrong WITHIN HAN, where the
 * orthography genuinely is shared — and the measurement says so. Across cmn, yue, wuu, nan and cjy:
 *
 *   · `/(?<![\d.,])\d{1,3}(?:,\d{3})+(?![\d,])/gu`      — BYTE-IDENTICAL in four layers
 *   · `/(?<![\d.,:])(\d{4})(?![\d.,])(?=\s*年)/gu`       — BYTE-IDENTICAL in three
 *   · the °C / °F / bare-° trio                          — near-identical in four, AND DRIFTED
 *
 * ⚠ THE DRIFT HAD ALREADY SHIPPED A BUG, which is the argument in one line. Cantonese's degree rules used
 * `\s?` (at most one space) where wu and nan used `\s*`. Two spaces is ordinary typography, so `20  °C` lost
 * its unit in yue and nowhere else — it read *jiː˨ sɐp̚˨ sˈiː*, the scale letter as an English letter name.
 * Four near-copies, one of them subtly wrong, and no test could see it because each layer tested only itself.
 *
 * ⚠ AND THE DEFECT KNOWLEDGE MATTERED MORE THAN THE CODE. These guards were each discovered the hard way and
 * then rediscovered in the next language. They are the real payload of this file:
 *
 *   · THE YEAR-RANGE ARM MUST PRECEDE THE SINGLE-YEAR RULE. Only the RIGHT endpoint of `1996-2007年` is
 *     followed by 年, so the single-year rule spells that one and leaves the left as a cardinal — one span,
 *     two readings. Rediscovered in yue, wuu AND cjy.
 *   · …AND THE BOTH-ENDPOINTS ARM MUST PRECEDE IT TOO. `1996年-2007年` has 年 after each, so both spell
 *     correctly and only the CONNECTIVE vanishes; but placed after the single-year rule the endpoints are
 *     already Han and no digit pattern can see them. (wuu, cjy.)
 *   · A SLASHED YEAR PAIR IS NOT A FRACTION. `2020/2021` is an academic year. Three languages, three
 *     corpora, one shape: jv guarded it, nan's whole fraction rule was removed when its only digit/digit
 *     slash turned out to be `Fahrenheit 9/11`, cjy hit it in review.
 *   · THE 年 MUST BE FOUND ACROSS WHITESPACE — Han corpora write `2009 年`, and that exact detail silently
 *     defeated the rule in cmn.
 *
 * ⚠ WHAT THIS FILE DELIBERATELY DOES NOT SHARE: THE WORDS. 點 vs 点, 到 vs 至, 摄氏 postposed vs 攝氏
 * preposed vs Liap-sī preposed, and above all the conjunction — wuu says 搭 (×176 against 和's 40), nan says
 * 佮, cjy and yue say 和. Those are the findings each corpus paid for, and folding them into shared code
 * would erase exactly the part that had to be measured. Every word here is a PARAMETER.
 *
 * ⚠ AND IT DOES NOT IMPOSE AN ORDER. Each rule is exported separately so a language's `normalize.ts` keeps
 * its own numbered, commented pipeline — which the playbook requires, since the ordering couplings differ
 * (wuu claims coordinates before degrees, nan claims a tilde range before its temperature, cjy declines
 * degrees outright because ⟨度⟩ is SILENT in its dict). A monolithic builder would have to hide that.
 */

/** 0–9 as Han numerals. The default; a language may pass its own (〇 vs 零 is a real corpus choice). */
export const HAN_DIGITS: readonly string[] = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** A digit string read ONE DIGIT AT A TIME — what Sinitic gives a year (二零零九) and a decimal's tail. */
export function spellHanDigits(s: string, digits: readonly string[] = HAN_DIGITS): string {
    return [...s].map((c) => digits[Number(c)] ?? c).join("");
}

/**
 * THOUSANDS DE-GROUPING — the most destructive number defect these engines have, and the same rule in four
 * languages. The tokenizer splits `\d+`, so a grouping comma is read as a clause pause AND the value is
 * destroyed: `1,000人` came out 一 + [pause] + 零人 in wuu, `1,000` as *iəʔ˨ , liŋ˩˩* in cjy.
 *
 * ⚠ EXACTLY-3-DIGIT GROUPS, which is what makes it safe three ways at once: it cannot touch a decimal
 * (1–2 digits), it cannot touch a clock (`09.00`), and it cannot touch a DOI (`10.1016`, four).
 * ⚠ AND IT LEAVES THE CHINESE FOUR-DIGIT GROUPING ALONE — `1,8638.36亿元` is a 万-grouping, not thousands,
 * and the corpus writes it. A looser pattern would mangle it.
 */
export function degroupThousands(s: string): string {
    return s.replace(/(?<![\d.,])[1-9]\d{0,2}(?:,\d{3})+(?![\d,])/gu, (m) => m.replace(/,/gu, ""));
}

/** Word data for the year rules. `rangeWord` omitted ⇒ the range arms are skipped, single years still spell. */
export interface YearRuleData {
    /** The range connective — 到 (yue/wuu/cjy), 至, kàu. Omit to decline ranges. */
    rangeWord?: string;
    /** Han digit table, if the language does not use the default. */
    digits?: readonly string[];
    /** Dash characters that count as a range. Defaults to the four the Han corpora write. */
    dashes?: string;
}

/**
 * THE YEAR TRIO, IN THE ONLY ORDER THAT WORKS — and the order is the point. A year is read DIGIT BY DIGIT
 * across Sinitic (`2009年` is 二零零九年, never the cardinal 二千零九年), and the three arms must run
 * range → both-endpoints → single, for the reasons in the file header.
 *
 * Returns the rewritten string; a language calls this as ONE step in its own pipeline.
 */
export function spellYears(s: string, d: YearRuleData = {}): string {
    const digits = d.digits ?? HAN_DIGITS;
    const dash = d.dashes ?? "-–—－~～〜";
    const spell = (y: string): string => spellHanDigits(y, digits);
    let out = s;
    if (d.rangeWord !== undefined) {
        // ⚠ FIRST: only the RIGHT endpoint sees 年, so left alone this span gets two different readings.
        out = out.replace(
            new RegExp(`(?<![\\d.,])(\\d{4})\\s*[${dash}]\\s*(\\d{4})(?![\\d.,])(?=\\s*年)`, "gu"),
            (_m, a: string, b: string) => `${spell(a)}${d.rangeWord}${spell(b)}`,
        );
        // ⚠ SECOND, AND STILL BEFORE THE SINGLE-YEAR RULE: `1996年-2007年` spells both correctly either way,
        // but after the single rule the endpoints are Han and no digit pattern can reach the dash.
        out = out.replace(
            new RegExp(`(?<![\\d.,])(\\d{4})\\s*年\\s*[${dash}]\\s*(?=\\d{4}\\s*年)`, "gu"),
            (_m, a: string) => `${spell(a)}年${d.rangeWord}`,
        );
    }
    // ⚠ THE 年 IS FOUND ACROSS WHITESPACE — `2009 年` is ordinary, and missing that silently defeated cmn.
    // ⚠ 3-DIGIT YEARS ARE NOT CLAIMED: most short `N年` forms are DURATIONS (`48年歷史`) and nothing in the
    // surface form separates them from a short year. That refusal is the fleet's, from the yue layer.
    return out.replace(/(?<![\d.,:])(\d{4})(?![\d.,])(?=\s*年)/gu, (_m, y: string) => spell(y));
}

/**
 * THE FRACTION, IN THE CHINESE ORDER — `a/b` is `b分之a`, "of b parts, a".
 *
 * ⚠ FOUR DIGITS ON BOTH SIDES IS A YEAR PAIR, NOT A FRACTION, and this guard is the whole reason the rule
 * is shared rather than copied. `2020/2021` is an academic year; jv met it as `taun 1985/1986`, nan's rule
 * was REMOVED when its only instance was `Fahrenheit 9/11`, and cjy hit it in review. Three corpora.
 *
 * ⚠ AND A LATIN LETTER IMMEDIATELY BEFORE THE NUMERATOR MEANS IT IS A CODE. Found by hak, the first language
 * built ON this module: hak.wikipedia's rolling-stock articles write train-set numbers as `A/C/B351/352`,
 * `A/C/B359/360`, `SP1900/1950`, and the digit-only lookbehind let every one of them through — `A/C/B351/352`
 * read *…352分之351*, "351 over 352". Nothing legitimate is written with a fraction fused to a letter; a real
 * one has a space or a Han character before it (`Fahrenheit 9/11`, `即1/1000`), so the guard costs nothing.
 * Verified byte-identical over the cmn, yue, wuu, nan and cjy corpora.
 */
export function reorderFraction(s: string, fractionWord: string): string {
    return s.replace(
        /(?<![\d.,/\p{sc=Latn}])(\d{1,4})\/(\d{1,4})(?![\d/])/gu,
        (m, num: string, den: string) => (num.length === 4 && den.length === 4 ? m : `${den}${fractionWord}${num}`),
    );
}

/**
 * DECIMALS — the separator is a word and the FRACTIONAL PART IS READ DIGIT BY DIGIT: 6.34 is 六點三四, never
 * 六點三十四. The integer part stays ASCII so the engine's own cardinal path reads it.
 *
 * ⚠ `(?!\.\d)` KEEPS A THREE-PART DESIGNATION OUT — `1.2.3`. Earned in the jv layer (`nomer 1.2.3` read
 * *siji koma loro . telu*) and carried by nan and cjy.
 * ⚠ THE FRACTION IS CAPPED AT 3 DIGITS, which also keeps a DOI (`10.1016`) out.
 * ⚠ `802.11n` IS **NOT** GUARDED, AND THE DOCSTRING USED TO CLAIM IT WAS. `(?!\.\d)` stops `1.2.3` on its
 * THIRD dotted group; `802.11n` has no third group, so it reads *802點一一n*. The claim came from the ten
 * Latin-script layers (es, sw, umb, qu, sn, bo …) whose guard is a trailing LETTER — a different rule.
 *
 * ⚠ NEITHER REPAIR SURVIVED MEASUREMENT, and both were tried. Counted across every corpus of the six layers
 * that call this function (cdo, cjy, gan, hak, hsn, nan):
 *     802.11-shaped designations   0
 *     decimal + unit or word      32   `1.3m/s²`, `4.68km/h`, `2.32g/cm³`, `0.1mol/L`, `2.45GHz`, `36.1±2.6ka`
 *   · A TRAILING-LETTER REFUSAL breaks all 32 and fixes nothing here. Those layers' `m` is a declared unit,
 *     so the trade lands the other way for them; here the decimal would go unread AND the bare `.` would
 *     survive as a CLAUSE PAUSE — the leak this function exists to stop.
 *   · REFUSING `802.11` BY NAME (the shape English's `NOT_VERSION` carries) does the same thing on the one
 *     string it saves: `802.11n` came out *pat̚ pak̚ laŋ ŋi · səp it ˈɛn*, the pause traded for the misread.
 * So the reading stays as it is and the DOCSTRING is what changes. ⚠ The shape is attested ×8 in the sibling
 * Sinitic corpora (cmn ×4, yue ×4) that have their own decimal rules today — if either migrates onto this
 * helper, this decision is worth re-running against a corpus where the count is not 0.
 */
export function readDecimals(s: string, decimalWord: string, digits: readonly string[] = HAN_DIGITS): string {
    return s.replace(
        /(?<![\d.,])(\d+)\.(\d{1,3})(?![\d,])(?!\.\d)/gu,
        (_m, int: string, frac: string) => `${int}${decimalWord}${spellHanDigits(frac, digits)}`,
    );
}

/** Options for the temperature/degree trio. Any field omitted is DECLINED rather than guessed. */
export interface DegreeData {
    /** Given the number, produce the whole reading — the position differs and cannot be a plain word:
     *  yue/nan write the scale name BEFORE (`攝氏20度`, `Liap-sī 20 tō͘`), wuu writes it AFTER (`20摄氏度`). */
    celsius?: (n: string) => string;
    fahrenheit?: (n: string) => string;
    /** The bare-degree reading, for coordinates and angles. Omit to leave ° unread. */
    bare?: (n: string) => string;
}

/**
 * TEMPERATURE THEN BARE DEGREE, in that order — and the order is load-bearing: run the bare rule first and
 * it eats the ° and leaves a lone ⟨C⟩ to be read as an ENGLISH LETTER NAME, which is exactly what `20°C` did
 * in three layers before it was fixed in each.
 *
 * ⚠ `\s*`, NEVER `\s?`. Cantonese shipped `\s?` and `20  °C` lost its unit there and nowhere else. Two
 * spaces is ordinary typography.
 * ⚠ THE GUARD IS `\p{sc=Latn}`, NOT `\p{L}` — a HAN CHARACTER IS `\p{L}`, so `溫度10°C到2°C` failed the
 * guard in nan and fused the degree word onto the stranded ⟨C⟩. Found only by probing in Han running text.
 *
 * ⚠ THE NUMBER INCLUDES ITS DECIMAL PART, AND OMITTING THAT WAS A SHIPPED BUG IN EVERY PREPOSING LANGUAGE.
 * The pattern used to capture `(\d+)`, which on `13.3 °C` matches only the `3` — so the scale word was
 * inserted INTO the number: yue and nan both read `13.3°C` as `13.` + 攝氏三度, the integer part orphaned in
 * front of a raw stop and the temperature off by a factor of four. wuu was accidentally immune because it
 * POSTposes Celsius (`13.3摄氏度` keeps the digits contiguous), which is exactly why four layers could carry
 * this and no test see it — the defect is invisible from the one language that happens to put the word on
 * the other side. Found by hak, whose corpus writes `13.3 °C` and `34.2 °C` and which preposes.
 * ⚠ The decimal part is OPTIONAL and the integer arm is unchanged, so `20°C` behaves exactly as before.
 */
const DEG_NUM = "(\\d+(?:\\.\\d+)?)";
export function readDegrees(s: string, d: DegreeData): string {
    let out = s;
    if (d.celsius) out = out.replace(new RegExp(`${DEG_NUM}\\s*°\\s*C(?![\\p{sc=Latn}])`, "gui"), (_m, n: string) => d.celsius!(n));
    if (d.fahrenheit) out = out.replace(new RegExp(`${DEG_NUM}\\s*°\\s*F(?![\\p{sc=Latn}])`, "gui"), (_m, n: string) => d.fahrenheit!(n));
    if (d.bare) out = out.replace(new RegExp(`${DEG_NUM}\\s*°`, "gu"), (_m, n: string) => d.bare!(n));
    return out;
}
