/**
 * Vietnamese (vi) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable Vietnamese syllable into Vietnamese words the existing pipeline speaks.
 * Pure text→text; no IPA. Runs inside vietnamese.ts's `text()`, BEFORE the shared symbol tier and before
 * the tokenizer.
 *
 * THE STRUCTURAL FACTS THAT SHAPE EVERY RULE HERE.
 *
 *  · Vietnamese is written as space-separated MONOSYLLABLES, and every rule below therefore emits its
 *    words with spaces between the syllables ("ki lô mét", "trước Công nguyên"), never fused. The
 *    tokenizer (`TOKEN` in vietnamese.ts) matches one syllable at a time; a fused "kilômét" is not a
 *    legal syllable and would fall through to the English fallback.
 *  · Vietnamese is TONAL and the tone is carried by the diacritic. Every word this file emits is written
 *    with its diacritics; a bare-ASCII rewrite would be a toneless (and usually unreadable) syllable.
 *    Probed after writing: every emitted word phonemizes to a well-formed toned syllable.
 *  · A space is a free token boundary — `assembleClauses` neither pauses nor drops on it. But `. , : ; ?
 *    ! …` ARE clause marks, so this file must never emit one; the rules only ever CONSUME them. That is
 *    the whole point of the de-grouping / decimal / clock rules: the European `.` grouping separator and
 *    `,` decimal separator were being read as SENTENCE and CLAUSE BREAKS in the middle of a number.
 *  · Vietnamese uses the EUROPEAN convention — `.` groups thousands, `,` is the decimal mark. Confirmed
 *    against the corpus: 45 instances of `\d{1,3}(\.\d{3})+` are all genuine grouping (40.000, 783.562,
 *    1.600 km) and 19 instances of `\d+,\d+` are all genuine decimals (14,7 tỷ USD; 3,5 mét; 6,34 inch).
 *
 * MEASURED OVER THE FLEURS vi_vn CORPUS, column 3 (1,978 unique utterances):
 *   dot-grouped thousands   45 in 35 utterances      decimal comma       19 in 16
 *   d:d colon forms         19 in 13 (14 clocks, 3 sports times, 2 ratios — tabulated at step 4/5)
 *   dash ranges             21 in 20 (16 spans, 5 sports scores — tabulated at step 7)
 *   all-caps initialisms   119 in 114 (83 distinct)  unit abbrevs after a digit ~44 in 33
 *   decimal dot (non-group)  9 in  5 (802.11a/b/g/n ×5, 2.4/5.0 Ghz, 6.5 độ, Hình 1.1)
 *   percent  9   currency signs  7   <sup>2</sup>  6   fractions a/b  3   `x` between digits  3   °  2
 *   dates written d/m/y     ZERO — Vietnamese writes "ngày 21 tháng 7 năm 356", already words, already
 *                           correct. No date rule exists here because the corpus needs none.
 *
 * WHAT THE ENGINE PRODUCED BEFORE, probed form by form (the defect list is measurement, not assumption):
 *   40.000 người   → "bˈo˧˥n mˈɨə˧j . xˈo˧ŋ ŋˈɨə˨˩j"      "forty" + a FULL STOP + "zero" — the grouping
 *                                                          period read as a sentence break, and `000`
 *                                                          pronounced as the word "không"
 *   14,7 tỷ USD    → "mˈɨə˨˩j bˈo˧˥n , bˈa˧˩˧j t̪ˈi˧˩˧ …"  decimal comma read as a CLAUSE PAUSE
 *   9:30 sáng      → "t͡ɕˈi˧˥n , bˈaː˧ mˈɨə˧j sˈaː˧˥ŋ"     colon read as a clause pause; no "giờ"
 *   2:11,60 phút   → "hˈaː˧j , mˈɨə˨˩j mˈo˨˩ˀt̪ , …"       a sports time broken at BOTH marks
 *   783.562 km<sup>2</sup> → "… kˈi˧ lˈo˧ mˈɛ˧˥t̪ sˈu˧p hˈaː˧j sˈu˧p"   the HTML tag spoken as "sup … sup"
 *   165 km/h       → "… kˈi˧ lˈo˧ mˈɛ˧˥t̪ ˈeᶦt͡ʃ"          the `h` routed to English as the letter "aitch"
 *   40 mph (64 kph)→ "… ˈɛmpˈiːʲˈeᶦt͡ʃ … kʰˈæf"            English phonemes, and "kph" as a nonsense word
 *   +30°C          → "bˈaː˧ mˈɨə˧j sˈiː"                   the ° silently DROPPED, the C read as English
 *   100-200 dặm    → "mˈo˨˩ˀt̪ t͡ɕˈa˧m hˈaː˧j t͡ɕˈa˧m zˈa˨˩ˀm"  the dash dropped, two numbers juxtaposed
 *   1/4 sang 1/2   → "mˈo˨˩ˀt̪ bˈo˧˥n … mˈo˨˩ˀt̪ hˈaː˧j"    "one four", "one two"
 *   36 x 24 mm     → "… ˈɛks …"                            the multiplication sign as English "ex"
 *   năm 356 TCN    → "… tʰˈiː sˈiː ˈɛn"                    a VIETNAMESE abbreviation (trước Công nguyên)
 *                                                          spelled with ENGLISH letter names
 *   giờ GMT        → "d͡ʒˈiː ˈɛm tʰˈiː"                     English phonemes (d͡ʒ, ɹ, θ, ʃ, æ, ɫ …) in a
 *                                                          Vietnamese stream — see step 12
 *
 * WHAT IS DELIBERATELY LEFT ALONE, and why:
 *   • MIXED-CASE embedded Latin (New, Internet, Canada, Olympic, Zealand, John, Greenland, Pakistan …;
 *     ~2,300 token instances). These are proper nouns and loanwords whose Vietnamese reading is LEXICAL
 *     and unguessable from spelling, and unlike Japanese or Thai there is no script boundary marking
 *     them — Vietnamese IS Latin script, so a spelling-derived rewrite would have to fire on ordinary
 *     Vietnamese words too. They keep the English fallback (vietnamese.ts's `foreign`) until there is a
 *     sourced loanword lexicon. This is the same call ja and th made, for a different reason.
 *   • WORD-READ acronyms (NASA, UNESCO, FIFA, COVID, OPEC, ASUS, ISIS — 17 of the 119 caps instances).
 *     Which acronyms Vietnamese reads as a word rather than as letters is a lexical fact and I have no
 *     source for their Vietnamese spellings (na-sa? u-nét-xcô?). Letter-spelling is always an available
 *     Vietnamese reading, so it is the safe default for the whole class — Thai's argument, adopted here.
 *   • `Ghz` ×2, `inch` ×5, `foot`/`feet` ×3, `Mbit` ×1. Vietnamese renderings exist but I could not
 *     source them with confidence, and the playbook's rule is that a wrong word is worse than a dropped
 *     sign. Left to the English fallback; reported instead of guessed.
 *   • `USD`/`AUD`/`GBP` after a number. Vietnamese commonly says "đô la Mỹ", but which of the two
 *     readings a given text intends is not derivable, so these fall through to step 12 and are spelled.
 *   • The one clock RANGE `10:00 – 11:00` is handled (step 3), but a dash between a number and a
 *     non-number is still dropped. That is a dropped sign, not a corruption.
 *   • 2-digit `\d{1,3},\d{3}` grouping is claimed at step 6 on the strength of a SINGLE corpus instance
 *     (¥7,000). Under the Vietnamese convention `7,000` is formally ambiguous (7.0 vs 7000); the ¥
 *     context settles this one, and the previous output ("bảy , không") was wrong under either reading.
 */

/** Latin letter → its VIETNAMESE letter name, space-separated where the name is polysyllabic. This is
 *  the standard bảng chữ cái naming set. Probed: every syllable emitted here phonemizes to a well-formed
 *  toned Vietnamese syllable (ép → ʔˈɛ˧˥p, quy → kwˈi˧, ích → ʔˈi˧˥k, dét → zˈɛ˧˥t̪). Reading an
 *  initialism as its letter names is what keeps it inside the Vietnamese phoneme inventory instead of
 *  routing to the English phonemizer. */
const VI_LETTER_NAME: Readonly<Record<string, string>> = {
    A: "a", B: "bê", C: "xê", D: "dê", E: "e", F: "ép", G: "giê",
    H: "hát", I: "i", J: "gi", K: "ca", L: "e lờ", M: "em mờ", N: "en nờ",
    O: "o", P: "pê", Q: "quy", R: "e rờ", S: "ét sì", T: "tê", U: "u",
    V: "vê", W: "vê kép", X: "ích", Y: "i", Z: "dét",
};

/** Vietnamese-native abbreviations, expanded to their spoken form. These are NOT foreign initialisms —
 *  TCN/SCN are the Vietnamese era markers (BC/AD) and spelling them as letters is simply wrong. Longest
 *  key first so CNTT is consumed before a shorter prefix could claim part of it. */
const VI_ABBREV: readonly [string, string][] = [
    ["CNTT", "công nghệ thông tin"], // ×1
    ["TCN", "trước Công nguyên"], // ×2 — "năm 356 TCN"
    ["SCN", "sau Công nguyên"], // ×1 — "năm 1100 SCN"
];

/** `\b` is ASCII-defined and mis-fires against Vietnamese's precomposed diacritics (Tây, đầy) — the trap
 *  that bit six of the first thirteen languages. Every letter-edge guard in this file is an explicit
 *  lookaround over `\p{L}\p{M}` instead. */
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
    // FIRST, before anything else looks at units or numbers. The corpus carries six `km<sup>2</sup>`
    // (one variant with an interior space, `km<sup>2 </sup>`); left alone the tag letters tokenize as
    // the syllable "sup" and are SPOKEN, twice per occurrence.
    s = s.replace(/<sup>\s*2\s*<\/sup>/giu, "²");
    s = s.replace(/<[^>]*>/gu, "");

    // ── 2. squared units → "<unit> vuông" ────────────────────────────────────────────────────────
    // BEFORE the shared symbol tier (which runs after this whole pass, in vietnamese.ts). That tier
    // matches a unit only when a NUMBER is adjacent on the left, so the rewrite must keep the digits
    // and the unit abbreviation glued together and only append the word — `783.562 km²` must become
    // `783.562 km vuông`, never `783.562 vuông km`. Covers the ASCII spelling too (3136mm2).
    // Composed by the shared tier now (exponentWords in vietnamese.ts); migrating it was verified
    // byte-identical over the whole vi_vn corpus. The ASCII spelling (3136mm2) composes too.

    // ── 3. clock ranges, then sports times, then clocks ──────────────────────────────────────────
    // 3a. A clock–clock pair is always a span, so it can be joined before the ambiguity of step 7
    // arises; done here because after 3c the operands are no longer bare digits ("10 giờ – 11 giờ")
    // and the generic range rule could no longer see them.
    s = s.replace(/((?<!\d)\d{1,2}:[0-5]\d)\s*[-–—]\s*(\d{1,2}:[0-5]\d(?!\d))/gu, "$1 đến $2");
    // 3b. Sports times `M:SS,hh` (4:41,30 — minutes:seconds,hundredths) BEFORE the clock rule: the
    // shape is a legal clock and the clock rule would claim the first half and leave `,30` to be read
    // as a clause pause. Three instances, all swimming/athletics results. This is the same trap the
    // playbook records for Russian (2:11,60) and Indonesian (1:09.02).
    // A trailing "phút" is CONSUMED for the same reason the clock consumes "giờ": the corpus writes
    // "2:11,60 phút", and re-emitting it would give "…giây 60 phút".
    s = s.replace(new RegExp(`(?<!\\d)(\\d{1,2}):([0-5]\\d),(\\d{1,2})(?!\\d)(\\s+phút${NL})?`, "gu"),
        (_m, mi: string, se: string, hu: string) => `${Number(mi)} phút ${Number(se)} giây ${Number(hu)}`);
    // 3c. Clocks. Tabulated over the 19 `d:d` instances in the corpus: 14 clocks, 3 sports times
    // (consumed by 3b), 2 RATIOS — `3:2` (aspect ratio) and `2:2` (a UK degree class). Requiring
    // exactly two minute digits in 00–59 excludes both ratios, which is why the rule is written this
    // way rather than as a bare `\d:\d`. The optional trailing `giờ` is CONSUMED, not left behind:
    // five of the fourteen are written "12:00 giờ GMT" / "8:30 giờ tối", and re-emitting "giờ" would
    // produce "mười hai giờ giờ" — the duplicate-الساعة bug the playbook records for Arabic.
    // The right guard is `(?![\d:])(?!,\d)`, NOT `(?![\d,:])`: a comma followed by a DIGIT is the
    // sports-time hundredths that step 3b owns, but a comma followed by anything else is an ordinary
    // sentence comma, and the blunter guard silently skipped "Vào lúc 11:20, cảnh sát …".
    s = s.replace(
        new RegExp(`(?<![\\d:])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(?!,\\d)(\\s+giờ${NL})?`, "gu"),
        (_m, hh: string, mm: string) => clock(hh, mm),
    );

    // ── 4. unit-per-hour abbreviations ───────────────────────────────────────────────────────────
    // BEFORE the symbol tier, and the target forms are taken from the CORPUS ITSELF rather than
    // invented: the same corpus writes `km/giờ` ×2 and `dặm/giờ` ×4 in full, so those are the attested
    // Vietnamese spellings. `/` is dropped by the tokenizer without a pause, so `165 km/giờ` reads
    // "một trăm sáu mươi lăm ki lô mét giờ". The digit guard keeps this off ordinary word slashes
    // (và/hoặc, đi/đến). Left alone: `Ghz`, `Mbit` — no sourced Vietnamese reading (see header).
    s = s.replace(new RegExp(`(?<=\\d\\s?)km/h${NL}`, "giu"), "km/giờ");
    s = s.replace(new RegExp(`(?<=\\d\\s?)kph${NL}`, "giu"), "km/giờ");
    s = s.replace(new RegExp(`(?<=\\d\\s?)mph${NL}`, "giu"), "dặm/giờ");

    // ── 5. degree sign ───────────────────────────────────────────────────────────────────────────
    // °C before a bare ° — otherwise the C is left stranded and routes to the English phonemizer as
    // "sˈiː". "xê" and "ép" are the Vietnamese letter names (same table as step 12).
    s = s.replace(/\s*°\s*C(?![\p{L}\p{M}])/gu, " độ xê");
    s = s.replace(/\s*°\s*F(?![\p{L}\p{M}])/gu, " độ ép");
    s = s.replace(/\s*°/gu, " độ");

    // ── 6. de-group thousands ────────────────────────────────────────────────────────────────────
    // FIRST of the number rules and the playbook's oldest coupling: a grouping separator is otherwise
    // read as clause punctuation. Requiring EXACTLY three digits per block is what separates grouping
    // from the decimal dot at step 9 — it keeps `802.11n` and `2.4 Ghz` out (2 digits, 1 digit) while
    // claiming all 45 corpus instances of real grouping. Multi-block numerals (5.000.000) are covered by
    // the `+`.
    //
    // THE GUARD IS `(?!\d)`, NOT `(?![\d.,])`. The stricter form looked safer and was a live bug the
    // corpus diff caught: a grouped numeral followed by ordinary sentence punctuation was skipped, so
    // `¥130.000,` came out "130 chấm 000" and `¥7,000.` came out "7 phẩy 000". Dot and comma grouping
    // are separate rules so that a mixed numeral (1.234,5) can still de-group and then reach step 8.
    s = s.replace(/(?<!\d)(?<!\d[.,])\d{1,3}(?:\.\d{3})+(?!\d)/gu, (n) => n.replace(/\./gu, ""));
    // Comma grouping, on the evidence of ONE instance (¥7,000) — see the header for why it is claimed.
    s = s.replace(/(?<!\d)(?<!\d[.,])\d{1,3}(?:,\d{3})+(?!\d)/gu, (n) => n.replace(/,/gu, ""));

    // ── 7. dash ranges → "đến" ───────────────────────────────────────────────────────────────────
    // AFTER de-grouping (so 1.000-1.300 parses) and BEFORE the decimal rules (step 8 would otherwise
    // turn `4,2-3,9` into `4 phẩy 2-3 phẩy 9`, and this rule would then join the unrelated `2-3`).
    //
    // THE DISCRIMINATOR IS EVIDENCE, NOT INTUITION. Tabulating all 21 dashed pairs in the corpus:
    // 16 are SPANS (1995-1996, 10-60 phút, 120 - 160 mét khối, 100-200 dặm, 2 – 3 km, 2-5 ngày,
    // 1418 - 1450, 1894-1895, 1644-1912, 1469–1539, 1000-1300, 10 - 11, 35-40, 56-64, 4,2-3,9) and 5
    // are SPORTS SCORES (5-3, 6-6, 7-2, 26 – 00, 21 - 20). Vietnamese says "đến" for a span but not
    // for a score. Every one of the five scores is NON-ASCENDING and fifteen of the sixteen spans are
    // ascending, so "second operand strictly greater" separates them with zero false positives; the
    // single miss is `4,2-3,9 triệu năm trước`, a span that runs backwards because it counts years
    // AGO. It keeps the status quo (dash dropped) — a dropped sign, not a wrong word.
    s = s.replace(/(?<![\d.,])(\d[\d.,]*)\s*[-–—]\s*(\d[\d.,]*)(?![\d.,])/gu,
        (m, a: string, b: string) => (numVal(b) > numVal(a) ? `${a} đến ${b}` : m));

    // ── 8. decimal comma → "phẩy" ────────────────────────────────────────────────────────────────
    // AFTER step 6, which has already consumed every comma that was a thousands separator, and after
    // step 7. `phẩy` is the name of the mark itself, which is how Vietnamese reads a decimal (14,7 =
    // "mười bốn phẩy bảy"). The fractional part is left as a digit run for the cardinal compositor —
    // "sáu phẩy ba mươi bốn" for 6,34 — which is one of the two attested readings.
    s = s.replace(/(?<=\d),(?=\d)/gu, " phẩy ");

    // ── 9. decimal / dotted numerals → "chấm" ────────────────────────────────────────────────────
    // AFTER step 6. Everything reaching here is a NON-grouping dot between digits: 802.11a/b/g/n ×5,
    // Hình 1.1, 2.4 and 5.0 Ghz, 6.5 độ richter. `chấm` ("dot") is right for the six identifier-shaped
    // ones and is the ordinary colloquial reading for the three genuine decimals too ("Wi-Fi hai chấm
    // bốn"); more importantly it removes the spurious SENTENCE BREAK that all nine produced before.
    s = s.replace(/(?<=\d)\.(?=\d)/gu, " chấm ");

    // ── 10. fractions → "phần" ───────────────────────────────────────────────────────────────────
    // Digits on BOTH sides and no adjacent digit, so this cannot touch the word slashes (và/hoặc,
    // đi/đến, vùng nước/đầm lầy) or the unit slashes rewritten at step 4. The corpus writes the same
    // construction in words elsewhere ("khoảng một phần ba"), which is where the target form comes
    // from. No d/m/y dates exist in this corpus, so there is nothing for this to collide with.
    s = s.replace(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/gu, "$1 phần $2");

    // ── 11. multiplication `x` between numbers → "nhân" ──────────────────────────────────────────
    // 36 x 24 mm, 6x6 cm, 56x56 mm. Digit-flanked only; a bare `x` elsewhere is left alone.
    s = s.replace(/(?<=\d)\s*[x×]\s*(?=\d)/giu, " nhân ");

    // ── 11b. the plus sign → "cộng", SOURCED FROM THE CORPUS'S OWN AUDIO ─────────────────────────
    // The two instances are the fleet's usual pair, `(UTC +1)` and `+30°C`, and both dropped the sign
    // outright before this. The WORD could not be got from text: Wikidata's label for vi's "plus sign"
    // is the bare character `+`, and prose writes the glyph, so there is nothing to probe for.
    //
    // FLEURS ships audio aligned to every transcript. Cohere-transcribe over vi_vn/train, both sentences,
    // TWO speakers each and unanimous:
    //   (UTC +1) → "…giờ địa phương utc cộng một tại bạch sảnh…"     ← cộng, 2 of 2
    //   +30°C    → "…nhiệt độ thường trên ba mươi độ c"              ← sign NOT voiced, 2 of 2
    //
    // ⚠ THE OMISSION IS NOT FOLLOWED, and that is a deliberate policy choice, not an oversight. The target
    // is TTS: a reader who skips a character the author explicitly typed tells us about reading habit, not
    // about content we may delete. So both arms voice it. vi joins en and hi in the cross-linguistic
    // convention the recordings show — a MEASUREMENT plus is frequently omitted, a UTC OFFSET is voiced —
    // and the reason it is safe either way is that omitting a plus is LOSSLESS while omitting a minus
    // INVERTS (`+30°` and `30°` are the same temperature; `-30°` and `30°` are not).
    //
    // After step 11 so `x`/`×` has already been claimed, and before the initialism pass so `UTC` is still
    // the ASCII the arm below matches on.
    s = s.replace(/(\S)\+\s?(?=\d)/gu, "$1 cộng ");
    s = s.replace(/(^|\s)\+\s?(?=\d)/gu, "$1cộng ");

    // ── 11b2. the MINUS and ±, which this file argued for and never had ────────────────────
    // The note above ends "omitting a plus is LOSSLESS while omitting a minus INVERTS" — and then no minus
    // rule followed. Both signs were dropped outright, so `-5 °C` read as *năm độ*, five degrees above zero.
    //
    // ⚠ VIETNAMESE SPLITS THE SIGN FROM THE OPERATION, as Korean does. `dấu trừ` is the MINUS SIGN and `trừ`
    // the subtraction verb, while a NEGATIVE quantity is read `âm` — vi.wikipedia keeps them apart explicitly:
    // "dấu trừ và số âm, đôi khi dấu âm được đặt cao hơn một chút so với dấu trừ". The rule below matches a
    // sign directly before a digit, which is the negative-quantity case, so it emits `âm`.
    //
    // ± is defined by the same article: "± 1. Ký hiệu dấu cộng hoặc dấu trừ" — the plus-or-minus sign — so the
    // juxtaposed reading is the sourced one, and it uses this file's own `cộng` (`dấu trừ` ×5 / 4 articles).
    s = s.replace(/±/gu, " cộng trừ ");
    // ⚠ THE RANGE GUARD IS THE SAME ONE `th` NEEDED, and for the same reason: the fleet's usual convention
    // rejects a sign with a space AFTER it (which catches a score like `26 - 00`) and so misses a range spaced
    // only BEFORE the sign — th_th's `ค.ศ. 1000 -1300` was read as a subtraction until this was added. A digit
    // anywhere to the left rejects the match: a negative quantity does not follow a number, a range does.
    s = s.replace(/(^|[\s(])[-−–](?=\d)/gu, (m0: string, pre: string, off: number, whole: string) =>
        /\d\s*$/u.test(whole.slice(0, off)) ? m0 : `${pre}âm `);

    // ── 11c. the relational and division signs ────────────────────────────────────────────
    // Vietnamese is SVO and all four readings are infix, so this is the ordinary rule shape.
    //
    // ⚠ `bằng` IS THE في TRAP: ×352 TOKEN HITS ON vi.wikipedia AND EVERY ONE THE WRONG SENSE. Vietnamese
    // `bằng` is both the equality word and the INSTRUMENTAL preposition ("by means of"), and prose is
    // overwhelmingly the latter — "bằng các chứng minh toán học" (by mathematical proofs), "được viết ra bằng
    // chữ" (written in words), plus `bằng chứng` (evidence) as a compound. The corpus is the same: ×224 phrase
    // hits, the sampled one being "tìm con mồi bằng mùi" (finds prey BY SMELL). A count-only pass would have
    // called this the best-attested word in the issue while proving nothing about the reading.
    //
    // ⚠ SO THE SLOT WAS PROBED INSTEAD OF THE WORD, which is the general escape from a homograph majority:
    // search for the SIGN'S NAME and for the reading WITH ITS OPERANDS, not for the bare word.
    //
    //   "Kết quả được biểu thị sau dấu bằng. Ví dụ: 1 + 1 = 2  («một cộng một bằng hai»)"
    //   "cho biết chúng bằng nhau, biểu diễn thông qua dấu bằng ( = )"
    //
    // — the sign named, and the reading quoted beside the notation. `dấu bằng` ×5 / 4 articles.
    //
    // The other three need no such rescue: `nhỏ hơn` ×20 and `lớn hơn` ×15 as corpus phrases, and `chia cho`
    // ×2 from the parallel division sentence ("tỷ lệ khung hình cho định dạng này chia cho mười hai"), which
    // FLEURS carries in 57 of its 67 languages and is therefore audio-aligned evidence for the division word.
    s = s.replace(/\s?=\s?/gu, " bằng ");
    s = s.replace(/\s?<\s?/gu, " nhỏ hơn ");
    s = s.replace(/\s?>\s?/gu, " lớn hơn ");
    s = s.replace(/\s?÷\s?/gu, " chia cho ");

    // THE AMPERSAND, dropped before. A Latin-script printing ligature, and Vietnamese is written in Latin
    // script, so it reads with the language's own conjunction rather than as a loan — the same call `tr` (ve)
    // and `nl` (en) make, as against `ko` (앤드) and `ja` (アンド) where the symbol only ever arrives inside a
    // Latin run and takes a loan reading.
    s = s.replace(/\s?&\s?/gu, " và ");

    // ── 12. Vietnamese abbreviations, then foreign initialisms ───────────────────────────────────
    // ERA MARKERS BEFORE GENERIC INITIALISMS — the playbook's coupling, and load-bearing here: TCN and
    // SCN are all-caps runs, so step 12b would otherwise spell "trước Công nguyên" as "tê xê en nờ".
    for (const [from, to] of VI_ABBREV)
        s = s.replace(new RegExp(`${NLB}${from}${NL}`, "gu"), to);
    // 12b. All-caps runs → Vietnamese letter names. Gated on the text containing lowercase: an all-caps
    // DOCUMENT carries no initialism signal and spelling every word would be absurd (core/initialisms.ts
    // makes the same exemption). Flanked by neither letter nor digit, which excludes A1GP and JAS 39C
    // where the caps are part of a mixed alphanumeric token. Roman numerals cannot collide: vi is not in
    // registry.ts's ROMAN_NATIVE, so `XVI` has already become `16` before text() runs.
    if (/\p{Ll}/u.test(s) || !/\s/u.test(s.trim()))
        s = s.replace(/(?<![\p{L}\p{M}\d])[A-Z]{2,6}(?![\p{L}\p{M}\d])/gu, (run) =>
            [...run].map((c) => VI_LETTER_NAME[c] ?? c).join(" "));

    return s;
}
