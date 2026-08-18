/**
 * Vietnamese (vi) text normalization — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable Vietnamese syllable into Vietnamese words the pipeline speaks. Pure text→text; no IPA.
 * Runs inside vietnamese.ts's `text()`, BEFORE the shared symbol tier and before the tokenizer.
 *
 * THE STRUCTURAL FACTS THAT SHAPE EVERY RULE HERE.
 *
 *  · Vietnamese is written as space-separated MONOSYLLABLES, so every rule emits its words with spaces
 *    between the syllables ("ki lô mét", "trước Công nguyên"), never fused. The tokenizer matches one
 *    syllable at a time; a fused "kilômét" is not a legal syllable and falls through to the English fallback.
 *  · Vietnamese is TONAL and the tone is carried by the diacritic, so every word emitted here is written with
 *    its diacritics. A bare-ASCII rewrite is a toneless — usually unreadable — syllable.
 *  · ⚠ A SPACE IS A FREE TOKEN BOUNDARY, BUT `. , : ; ? ! …` ARE CLAUSE MARKS. This file must never EMIT
 *    one; the rules only ever CONSUME them. That is the whole point of the de-grouping / decimal / clock
 *    rules — the European `.` grouping separator and `,` decimal mark were read as SENTENCE and CLAUSE BREAKS
 *    in the middle of a number.
 *  · Vietnamese uses the EUROPEAN convention: `.` groups thousands, `,` is the decimal mark.
 *
 * Deliberately left alone:
 *   · MIXED-CASE embedded Latin (New, Internet, Canada, Olympic …). Proper nouns and loanwords whose
 *     Vietnamese reading is LEXICAL and unguessable from spelling — and unlike Japanese or Thai there is no
 *     script boundary marking them, since Vietnamese IS Latin script, so a spelling-derived rewrite would
 *     have to fire on ordinary Vietnamese words too. They keep the English fallback.
 *   · WORD-READ acronyms (NASA, UNESCO, FIFA, COVID). Which acronyms Vietnamese reads as a word rather than
 *     as letters is a lexical fact with no source here. Letter-spelling is always an available Vietnamese
 *     reading, so it is the safe default for the whole class.
 *   · `Ghz`, `inch`, `foot`/`feet`, `Mbit`, and `USD`/`AUD`/`GBP` after a number. Vietnamese renderings
 *     exist but are not confidently sourceable, and a wrong word is worse than a dropped sign.
 *   · A dash between a number and a NON-number. That is a dropped sign, not a corruption.
 */

/** Latin letter → its VIETNAMESE letter name, space-separated where the name is polysyllabic — the standard
 *  bảng chữ cái naming set. Reading an initialism as its letter names is what keeps it inside the Vietnamese
 *  phoneme inventory instead of routing to the English phonemizer. */
const VI_LETTER_NAME: Readonly<Record<string, string>> = {
    A: "a", B: "bê", C: "xê", D: "dê", E: "e", F: "ép", G: "giê",
    H: "hát", I: "i", J: "gi", K: "ca", L: "e lờ", M: "em mờ", N: "en nờ",
    O: "o", P: "pê", Q: "quy", R: "e rờ", S: "ét sì", T: "tê", U: "u",
    V: "vê", W: "vê kép", X: "ích", Y: "i", Z: "dét",
};

/** Vietnamese-native abbreviations, expanded to their spoken form. ⚠ These are NOT foreign initialisms —
 *  TCN/SCN are the Vietnamese era markers (BC/AD) and spelling them as letters is simply wrong. Longest key
 *  first so CNTT is consumed before a shorter prefix could claim part of it. */
const VI_ABBREV: readonly [string, string][] = [
    ["CNTT", "công nghệ thông tin"],
    ["TCN", "trước Công nguyên"],
    ["SCN", "sau Công nguyên"],
];

/** ⚠ `\b` is ASCII-defined and mis-fires against Vietnamese's precomposed diacritics (Tây, đầy). Every
 *  letter-edge guard in this file is an explicit lookaround over `\p{L}\p{M}` instead. */
const NL = "(?![\\p{L}\\p{M}])";
const NLB = "(?<![\\p{L}\\p{M}])";

/** Value of a possibly grouped / comma-decimal Vietnamese numeral, for the ascending test at step 7. */
const numVal = (s: string): number => Number(s.replace(/\./gu, "").replace(/,/u, "."));

/** `HH:MM` → the Vietnamese clock, `H giờ M`. Zero minutes are dropped: 12:00 is "mười hai giờ", never
 *  "…giờ không". A leading zero is not spoken, so `07` → `7` and the cardinal compositor says "bảy". */
const clock = (hh: string, mm: string): string =>
    `${Number(hh)} giờ` + (Number(mm) === 0 ? "" : ` ${Number(mm)}`);

/**
 * The ordered pass. Each step states the coupling that pins its position; a future reader cannot recover
 * those from the code.
 */
export function normalizeVietnamese(input: string): string {
    let s = input;

    // ── 1. HTML superscript markup ───────────────────────────────────────────────────────────────
    // FIRST, before anything else looks at units or numbers. Left alone, the tag letters of `km<sup>2</sup>`
    // tokenize as the syllable "sup" and are SPOKEN, twice per occurrence.
    s = s.replace(/<sup>\s*2\s*<\/sup>/giu, "²");
    s = s.replace(/<[^>]*>/gu, "");

    // ── 2. squared units ─────────────────────────────────────────────────────────────────────────
    // Composed by the shared tier (`exponentWords` in vietnamese.ts), which appends the word and keeps the
    // digits glued to the unit — `783.562 km²` must become `783.562 km vuông`, never `783.562 vuông km`.

    // ── 3. clock ranges, then sports times, then clocks ──────────────────────────────────────────
    // 3a. A clock–clock pair is always a span, so it is joined before the ambiguity of step 7 arises — and it
    // must happen HERE, because after 3c the operands are no longer bare digits ("10 giờ – 11 giờ") and the
    // generic range rule can no longer see them.
    s = s.replace(/((?<!\d)\d{1,2}:[0-5]\d)\s*[-–—]\s*(\d{1,2}:[0-5]\d(?!\d))/gu, "$1 đến $2");
    // 3b. ⚠ SPORTS TIMES `M:SS,hh` (4:41,30 — minutes:seconds:hundredths) BEFORE the clock rule: the shape is
    // a legal clock, and the clock rule would claim the first half and leave `,30` to be read as a clause
    // pause. A trailing "phút" is CONSUMED for the same reason the clock consumes "giờ" — the text writes
    // "2:11,60 phút", and re-emitting it gives "…giây 60 phút".
    s = s.replace(new RegExp(`(?<!\\d)(\\d{1,2}):([0-5]\\d),(\\d{1,2})(?!\\d)(\\s+phút${NL})?`, "gu"),
        (_m, mi: string, se: string, hu: string) => `${Number(mi)} phút ${Number(se)} giây ${Number(hu)}`);
    // 3c. Clocks. ⚠ EXACTLY TWO MINUTE DIGITS IN 00–59, which is what excludes a RATIO — `3:2` (aspect) and
    // `2:2` (a UK degree class) are the same shape as a bare `\d:\d`.
    // ⚠ The optional trailing `giờ` is CONSUMED, not left behind: a clock is often written "12:00 giờ GMT",
    // and re-emitting "giờ" produces "mười hai giờ giờ".
    // ⚠ The right guard is `(?![\d:])(?!,\d)`, NOT `(?![\d,:])`: a comma followed by a DIGIT is the
    // sports-time hundredths that 3b owns, but a comma followed by anything else is an ordinary sentence
    // comma, and the blunter guard silently skips "Vào lúc 11:20, cảnh sát …".
    s = s.replace(
        new RegExp(`(?<![\\d:])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(?!,\\d)(\\s+giờ${NL})?`, "gu"),
        (_m, hh: string, mm: string) => clock(hh, mm),
    );

    // ── 4. unit-per-hour abbreviations ───────────────────────────────────────────────────────────
    // BEFORE the symbol tier. The target forms are the ones Vietnamese prose writes out — `km/giờ`,
    // `dặm/giờ`. `/` is dropped by the tokenizer without a pause, so `165 km/giờ` reads "…ki lô mét giờ".
    // The digit guard keeps this off ordinary word slashes (và/hoặc, đi/đến).
    s = s.replace(new RegExp(`(?<=\\d\\s?)km/h${NL}`, "giu"), "km/giờ");
    s = s.replace(new RegExp(`(?<=\\d\\s?)kph${NL}`, "giu"), "km/giờ");
    s = s.replace(new RegExp(`(?<=\\d\\s?)mph${NL}`, "giu"), "dặm/giờ");

    // ── 5. degree sign ───────────────────────────────────────────────────────────────────────────
    // °C before a bare ° — otherwise the C is stranded and routes to the English phonemizer as "sˈiː".
    // "xê" and "ép" are the Vietnamese letter names (same table as step 12).
    s = s.replace(/\s*°\s*C(?![\p{L}\p{M}])/gui, " độ xê");
    s = s.replace(/\s*°\s*F(?![\p{L}\p{M}])/gui, " độ ép");
    s = s.replace(/\s*°/gu, " độ");

    // ── 6. de-group thousands ────────────────────────────────────────────────────────────────────
    // FIRST of the number rules: a grouping separator is otherwise read as clause punctuation. ⚠ EXACTLY
    // three digits per block is what separates grouping from the decimal dot at step 9 — it keeps `802.11n`
    // and `2.4 Ghz` out while claiming real grouping. Multi-block numerals (5.000.000) are covered by the `+`.
    //
    // ⚠ THE GUARD IS `(?!\d)`, NOT `(?![\d.,])`. The stricter form looks safer and skips a grouped numeral
    // followed by ordinary sentence punctuation, so `¥130.000,` comes out "130 chấm 000". Dot and comma
    // grouping are separate rules so that a mixed numeral (1.234,5) can de-group and then reach step 8.
    s = s.replace(/(?<!\d)(?<!\d[.,])\d{1,3}(?:\.\d{3})+(?!\d)/gu, (n) => n.replace(/\./gu, ""));
    // ⚠ Comma grouping is formally ambiguous under the Vietnamese convention (`7,000` is 7.0 or 7000). It is
    // claimed anyway because a currency context settles the attested case and the alternative reading
    // ("bảy , không") is wrong either way.
    s = s.replace(/(?<!\d)(?<!\d[.,])\d{1,3}(?:,\d{3})+(?!\d)/gu, (n) => n.replace(/,/gu, ""));

    // ── 7. dash ranges → "đến" ───────────────────────────────────────────────────────────────────
    // AFTER de-grouping (so 1.000-1.300 parses) and BEFORE the decimal rules — step 8 would otherwise turn
    // `4,2-3,9` into `4 phẩy 2-3 phẩy 9`, and this rule would then join the unrelated `2-3`.
    //
    // ⚠ THE DISCRIMINATOR IS DIRECTION. Vietnamese says "đến" for a SPAN but not for a SPORTS SCORE, and
    // every score is non-ascending while a span almost always ascends, so "second operand strictly greater"
    // separates them. The known miss is a span that runs BACKWARDS because it counts years AGO
    // (`4,2-3,9 triệu năm trước`); it keeps the status quo, a dropped dash rather than a wrong word.
    s = s.replace(/(?<![\d.,])(\d[\d.,]*)\s*[-–—]\s*(\d[\d.,]*)(?![\d.,])/gu,
        (m, a: string, b: string) => (numVal(b) > numVal(a) ? `${a} đến ${b}` : m));

    // ── 8. decimal comma → "phẩy" ────────────────────────────────────────────────────────────────
    // AFTER step 6, which has already consumed every comma that was a thousands separator, and after step 7.
    // `phẩy` is the name of the mark itself, which is how Vietnamese reads a decimal (14,7 = "mười bốn phẩy
    // bảy"). The fractional part is left as a digit run for the cardinal compositor.
    s = s.replace(/(?<=\d),(?=\d)/gu, " phẩy ");

    // ── 9. decimal / dotted numerals → "chấm" ────────────────────────────────────────────────────
    // AFTER step 6, so everything reaching here is a NON-grouping dot between digits: 802.11a/b/g/n, 2.4 Ghz,
    // Hình 1.1. `chấm` ("dot") is right for the identifier-shaped ones and is the ordinary colloquial reading
    // for a genuine decimal too — and it removes the spurious SENTENCE BREAK all of them produced.
    s = s.replace(/(?<=\d)\.(?=\d)/gu, " chấm ");

    // ── 10. fractions → "phần" ───────────────────────────────────────────────────────────────────
    // Digits on BOTH sides and no adjacent digit, so this cannot touch word slashes (và/hoặc, đi/đến) or the
    // unit slashes rewritten at step 4. Vietnamese writes no d/m/y dates — it writes "ngày 21 tháng 7 năm
    // 356", already words — so there is nothing for this to collide with.
    s = s.replace(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/gu, "$1 phần $2");

    // ── 11. multiplication `x` between numbers → "nhân" ──────────────────────────────────────────
    // Digit-flanked only; a bare `x` elsewhere is left alone.
    s = s.replace(/(?<=\d)\s*[x×]\s*(?=\d)/giu, " nhân ");

    // ── 11b. the plus sign → "cộng" ──────────────────────────────────────────────────────────────
    // ⚠ A READER WHO OMITS THE SIGN IS NOT LICENCE TO DELETE IT. Recordings show the cross-linguistic
    // convention — a MEASUREMENT plus is frequently left unvoiced, a UTC OFFSET is voiced — but the target is
    // TTS, so a reading habit is not content we may drop, and both arms voice it. It is safe either way
    // because omitting a plus is LOSSLESS while omitting a minus INVERTS: `+30°` and `30°` are the same
    // temperature, `-30°` and `30°` are not.
    //
    // After step 11 so `x`/`×` has already been claimed, and before the initialism pass so `UTC` is still the
    // ASCII the first arm matches on.
    s = s.replace(/(\S)\+\s?(?=\d)/gu, "$1 cộng ");
    s = s.replace(/(^|\s)\+\s?(?=\d)/gu, "$1cộng ");

    // ── 11b2. the minus and ± ────────────────────────────────────────────────────────────────────
    // ⚠ VIETNAMESE SPLITS THE SIGN FROM THE OPERATION, as Korean does. `dấu trừ` is the MINUS SIGN and `trừ`
    // the subtraction verb, while a NEGATIVE quantity is read `âm`. The rule below matches a sign directly
    // before a digit — the negative-quantity case — so it emits `âm`. Without it, `-5 °C` reads *năm độ*,
    // five degrees above zero.
    s = s.replace(/±/gu, " cộng trừ ");
    // ⚠ THE RANGE GUARD. Rejecting a sign with a space AFTER it catches a score like `26 - 00` but misses a
    // range spaced only BEFORE the sign, which then reads as a subtraction. A digit anywhere to the left
    // rejects the match: a negative quantity does not follow a number, a range does.
    s = s.replace(/(^|[\s(])[-−–](?=\d)/gu, (m0: string, pre: string, off: number, whole: string) =>
        /\d\s*$/u.test(whole.slice(0, off)) ? m0 : `${pre}âm `);

    // ── 11c. the relational and division signs ───────────────────────────────────────────────────
    // Vietnamese is SVO and all four readings are infix, so this is the ordinary rule shape.
    //
    // ⚠ `bằng` IS A HOMOGRAPH TRAP, and frequency alone picks the wrong sense: it is both the equality word
    // and the INSTRUMENTAL preposition ("by means of"), and prose is overwhelmingly the latter — "bằng các
    // chứng minh toán học" (by mathematical proofs), "tìm con mồi bằng mùi" (finds prey BY SMELL), plus
    // `bằng chứng` (evidence) as a compound. A count-only pass calls this the best-attested word in the file
    // while proving nothing about the reading.
    // ⚠ THE ESCAPE IS TO PROBE THE SLOT, NOT THE WORD: search for the SIGN'S NAME (`dấu bằng`) and for the
    // reading WITH ITS OPERANDS — "1 + 1 = 2 («một cộng một bằng hai»)" — rather than for the bare word.
    s = s.replace(/\s?=\s?/gu, " bằng ");
    s = s.replace(/\s?<\s?/gu, " nhỏ hơn ");
    s = s.replace(/\s?>\s?/gu, " lớn hơn ");
    s = s.replace(/\s?÷\s?/gu, " chia cho ");

    // THE AMPERSAND. A Latin-script printing ligature, and Vietnamese is written in Latin script, so it reads
    // with the language's own conjunction rather than as a loan — the same call `tr` (ve) and `nl` (en) make,
    // as against `ko` (앤드) and `ja` (アンド), where the symbol only ever arrives inside a Latin run.
    s = s.replace(/\s?&\s?/gu, " và ");

    // ── 12. Vietnamese abbreviations, then foreign initialisms ───────────────────────────────────
    // ⚠ ERA MARKERS BEFORE GENERIC INITIALISMS, and it is load-bearing: TCN and SCN are all-caps runs, so 12b
    // would otherwise spell "trước Công nguyên" as "tê xê en nờ".
    for (const [from, to] of VI_ABBREV)
        s = s.replace(new RegExp(`${NLB}${from}${NL}`, "gu"), to);
    // 12b. All-caps runs → Vietnamese letter names. Gated on the text containing lowercase: an all-caps
    // DOCUMENT carries no initialism signal and spelling every word would be absurd (core/initialisms.ts
    // makes the same exemption). Flanked by neither letter nor digit, which excludes A1GP and JAS 39C where
    // the caps are part of a mixed alphanumeric token. Roman numerals cannot collide: vi is not in
    // registry.ts's ROMAN_NATIVE, so `XVI` has already become `16` before text() runs.
    if (/\p{Ll}/u.test(s) || !/\s/u.test(s.trim()))
        s = s.replace(/(?<![\p{L}\p{M}\d])[A-Z]{2,6}(?![\p{L}\p{M}\d])/gu, (run) =>
            [...run].map((c) => VI_LETTER_NAME[c] ?? c).join(" "));

    return s;
}
