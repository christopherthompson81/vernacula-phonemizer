/**
 * Tigrinya (ti) text normalization — pure text→text, run inside `text()` before tokenization.
 *
 * EVIDENCE: tools/corpus/mined/ti.jsonc, a ti.wikipedia dump artifact (1,338 segments; the committed
 * hard+sample tiers are 323 deduplicated lines). Counts below are over those 323 lines. The full
 * investigation, including every refusal and its count, is docs/investigations/ti_normalization_investigation.md.
 *
 * ⚠ `\b` IS ASCII-DEFINED AND MATCHES NOTHING AGAINST ETHIOPIC — every boundary here is an explicit
 * `(?<![\p{L}\p{M}])` / `[ሀ-ፚ]` lookaround (trap 1).
 *
 * ⚠ AMHARIC IS THE NEAR NEIGHBOUR AND IS NOT THE SAME LANGUAGE. Every `am` rule was re-measured against
 * this corpus and SEVEN DID NOT SURVIVE — the ordinal suffix ኛ (×0 here; ti writes `Nይ` and `መበል N`), the
 * comma-only de-grouping (ti also groups with the period), the ASCII-colon clock (ti's only `d:dd` is a
 * scripture citation), the `12.00 GMT` clock (×0), the `US$`/plural-currency workarounds (×0), the plus
 * (×1, declined) and the relational/division signs (×0 — the two `=` are wiki markup and a URL). The
 * script makes an Amharic word look right in Tigrinya; only the count tells them apart.
 *
 * THE LARGEST DEFECT IS NOT A NUMBER RULE. `፡` (U+1361) occurs 998× in 323 lines and produced NO PAUSE:
 * it is outside the letter class, outside the punctuation branch, and `makeGeezG2P` treats it as a bare
 * word boundary. 910 of those are clause breaks. See step 5.
 *
 * Deliberately not done — each with its count:
 *   · THE MINUS. The fleet shape `(^|[\s(])[-−–](\d)` has ONE true hit (`ኤሌክትሮናት -1 ኣሃዱ … ኣሉታዊ ቻርጅ`) and
 *     ONE false one (`( –500 ቅድሚ ልደተ ክርስቶስ)`, an era dash), against 25 digit-adjacent hyphens that are all
 *     ranges (`1937-1938`, `60–70%`) or designations (`COVID-19`, `ICD-10`, `G-20`, `ሚግ-21`, `DSM-5`).
 *     hi's narrowing arms do not rescue it — the false positive IS the bracket arm. The word exists
 *     (`ኣሉታ`, Gaim); the rule does not. Re-check with one grep from the investigation's Run 7.
 *   · THE PLUS, ×1 and no `UTC+n` anywhere. `< > ÷ ×` are ×0.
 *   · THE AMPERSAND, for want of a SIGN and not a word: `&` ×27 and not one is a Tigrinya ampersand —
 *     13 `&nbsp;`, 11 numeric entities (`&#x5B;`, `&#x2013;`), the rest inside English strings. Wiki
 *     markup that survived the dump extraction. `=` ×2 is the same (an English gloss and a URL query),
 *     even though `ማዕረ` "equal" is attested ×9 — the word is available and the sign is not Tigrinya.
 *   · `ዓ.ም` ×19 is left a letter-run: `ዓመተ ምሕረት` is ABSENT from ti.wikipedia (0 token, 0 substring), and
 *     the Ethiopian calendar offset is not applied for the reason `am` gives — nothing in the text settles
 *     which frame a bare year is in, so converting would be guessing.
 *   · `ናቕፋ` is NOT declared as the Eritrean currency. ×5 in the corpus and every one is the TOWN of Nakfa
 *     (`ናቕፋ ብድፋዓት ተኸቢባ ትርከብ`) — trap 37. No `Nfk` sign occurs anyway. `ብር` ×41 is likewise almost all
 *     inside longer words (`ክብርኻ`, `ክብርን`), the finding `am` already records for itself.
 *   · ORDINALS ABOVE 10 in the `Nይ` shape. Every one of the corpus's 22 is 1–10; `መበል N` (×35) is the
 *     form above ten and it already reads correctly with no rule at all.
 */

/** Ethiopic syllabary letters, EXCLUDING the punctuation (U+1360+) and numeral (U+1369+) sub-blocks. */
const FID = "[\\u1200-\\u135A]";

/** Tigrinya decimal point. SOURCE: Gaim, arXiv:2601.03403 — `ነጥቢ /näTbi/ (point)`, in a paper about
 *  Tigrinya number VERBALIZATION, i.e. about what is said rather than what is written.
 *  ⚠ THE CORPUS ARGUES AGAINST IT AND IS THE WRONG INSTRUMENT. `ነጥቢ` is ×6 here and ×19 on the wiki and
 *  not one is a decimal separator — point-of-sale (`ነጥቢ መሸጣ`), a geometric point (`ነጥቢ B`), a score, a
 *  place (`ዝወሓደ ነጥቢ ኣብ መሬት`). That is the shape of zu's `amaphuzu`, but NOT the same case: zu's was a
 *  refusal on SENSE, this would be a refusal on SILENCE. Writers type `48.33`; they never write down how
 *  they would say it, so a written corpus can score zero on a word in universal spoken use — the Igbo
 *  `ǹtụ̀kpọ` lesson, which requires a dictionary-grade check before believing the silence. Gaim is that
 *  check and is stronger than a dictionary, being specifically about verbalization. */
const POINT = "ነጥቢ";

/** Range connective. ti writes the frame out in full 15× — `ካብ 1,600 ክሳብ 2,100 ሜትሮ`, `ካብ 8 ክሳብ 29 ለካቲት`
 *  — which is what the hyphenated form abbreviates. ⚠ NOT Amharic's `ከ … እስከ`: that pair is ×0 here. */
const FROM = "ካብ", UNTIL = "ክሳብ";

/**
 * ORDINALS 1–10. Tigrinya does NOT use Amharic's `ኛ` suffix (×0 in this corpus). It has a Semitic pattern
 * series, and the corpus abbreviates it by writing the digit plus the word's final letter — `6ይ`, `7ይ`,
 * `2ይቲ` (feminine), `10ይን` (with the ን conjunction). 22 instances, EVERY ONE 1–10.
 *
 * SOURCE, and it is split on purpose:
 *   · 1–5 come from THIS CORPUS — ቀዳማይ ×31, ካልኣይ ×29, ሳልሳይ ×13, ራብዓይ ×7, ሓምሻይ ×1.
 *   · 6, 8, 10 come from ti.wikipedia in the right sense — `እቲ ሻድሻይ እምነት` (the sixth article of faith),
 *     `ኣብ ሻሙናይ ደረጃ` (in eighth place), `ዓስራይ ክፍሊ` (tenth grade).
 *   · ⚠ 7 AND 9 REST ON GAIM (arXiv:2601.03403) TABLE 1 ALONE and are absent from ti.wikipedia (0 token /
 *     0 substring, as are ሻውዐይ ታሽዐይ ትሽዓይ ትሽዓተይ). For 7th the wiki instead attests the CLASSICAL `ሳብዓይ`
 *     ×1, in `ሄንሪ ሳብዓይ` (Henry VII) — a different word, recorded here as a competitor rather than adopted,
 *     because Gaim's table is a VERBALIZATION table and is the source this manifest already took its
 *     cardinals from. The slot itself is not in doubt: the corpus writes `7ይ` ×5 and `9ይ` ×3.
 *   · Where the wiki attests a different SPELLING of the same word the attested spelling wins — `ሓምሻይ`
 *     over the paper's `ሓሙሽተ`-stem `ሓሙሻይ`, `ሻሙናይ` over `ሻምናይ`. That is the policy tigrinya.jsonc already
 *     states for the cardinals.
 */
const ORDINAL: Record<number, string> = {
    1: "ቀዳማይ", 2: "ካልኣይ", 3: "ሳልሳይ", 4: "ራብዓይ", 5: "ሓምሻይ",
    6: "ሻድሻይ", 7: "ሻውዓይ", 8: "ሻሙናይ", 9: "ታሽዓይ", 10: "ዓስራይ",
};

/**
 * ETHIOPIC NUMERALS → the VALUE WORD OF EACH CHARACTER, and deliberately not an arithmetic evaluation.
 *
 * 20 instances in 323 lines, and before this rule EVERY ONE READ AS THE EMPTY STRING: U+1369–U+137C is
 * outside `[ሀ-ፚ]`, outside `\d`, and outside the punctuation branch, so `፻፲ ኪሎሜተር` read *kilometəɾ* with
 * the number simply gone. This is the `ug`/`bal` empty-reading class, in its Ethiopic form. `\p{Nd}` does
 * not match these either — they are `No` — so a rule keyed on `\p{Nd}` or `[0-9]` is blind to them.
 *
 * ⚠ WHY NOT EVALUATE. The system is ADDITIVE with no zero, so `፻፲` is 110. But THIS CORPUS WRITES IT BOTH
 * WAYS, and says so itself in one parenthesis:
 *
 *     እቲ ካብ ፪፬፬፬(፳፻፬፻፵፬) ልዕሊ ጽፍሒ ባሕሪ ንላዕሊ ዘሎ ቦታ
 *
 * `፳፻፬፻፵፬` is proper additive Ge'ez for 2444; `፪፬፬፬` is the digits 2-4-4-4 typed one glyph apiece. Same
 * number, same sentence, two conventions. Sorted, 7 of the 20 are proper additive (`፻፲`, `፳፭፻`, `፶፭`, `፭`,
 * `፬`, `፮`, `፳፻፬፻፵፬`) and the rest are the positional misuse (`፩፱፱፱` for 1999, `፩፭` for 15, `፪፯` for 27,
 * `፩፶፬` for 154 …). An evaluator would read `፩፱፱፱` as 1+9+9+9 = 28 — confidently wrong on the majority,
 * and nothing in the text separates the conventions.
 *
 * ⚠ AND THE PER-CHARACTER READING IS SOURCED, not a fallback. ti.wikipedia's own numeral pages gloss them
 * exactly this way: `ሚእቲ ቁጽሪ ፻።` and `ሓሙሽተ ሚእቲ ቁጽሪ ፭፻።` — `፭፻` read as `ሓሙሽተ` + `ሚእቲ`, character by
 * character, which is what this rule emits.
 *
 * STATED LIMIT: for a proper additive numeral the words and their order are right but the additive `ን`
 * conjunction is not applied (`፻፲` → `ሚእቲ ዓሰርተ`, where full Tigrinya is `ሚእትን ዓሰርተን`). Applying it would
 * mean committing to the additive reading, which is wrong for over half the instances. A prosodic
 * imperfection replacing a total silence.
 */
const GEEZ_DIGIT: Record<string, number> = {
    "፩": 1, "፪": 2, "፫": 3, "፬": 4, "፭": 5, "፮": 6, "፯": 7, "፰": 8, "፱": 9,
    "፲": 10, "፳": 20, "፴": 30, "፵": 40, "፶": 50, "፷": 60, "፸": 70, "፹": 80, "፺": 90,
    "፻": 100, "፼": 10000,
};

/**
 * Build the Tigrinya normalizer.
 *
 * `numberToText` is injected rather than imported so that normalize.ts and tigrinya.ts do not form an
 * import cycle: tigrinya.ts owns the number composer and hands it over here.
 *
 * `symbols` is the shared `makeSymbolNormalizer` pass (%, currency, units, exponent). It is threaded
 * THROUGH this function instead of wrapping it, because the ordering is load-bearing in both directions —
 * see step 9.
 */
export function makeTigrinyaNormalizer(
    numberToText: (n: number) => string,
    symbols: (text: string) => string,
): (text: string) => string {
    /** Spell one integer string; falls back to the digits when out of the composer's range. */
    const words = (digits: string): string => {
        const n = Number(digits);
        return Number.isSafeInteger(n) && n >= 0 && n < 1e12 ? numberToText(n) : digits;
    };
    /** Digits read one at a time — the fractional tail of a decimal. */
    const eachDigit = (digits: string): string =>
        [...digits].map((d) => numberToText(Number(d))).join(" ");

    return (input: string): string => {
        let s = input;

        // 1. ፡፡ → ። . TWO U+1361 ETHIOPIC WORDSPACE is the typewriter substitute for ። (ኣርባዕተ ነጥቢ), and
        //    `::` is its ASCII substitute (`ይረጋገጽ:: "ብርግጽ …"`). ×1 each. FIRST, so step 5 sees only lone ፡.
        s = s.replace(/፡፡/gu, "።").replace(/::/gu, "።");

        // 2. THE CLOCK, and it is claimed ONLY on the ETHIOPIC separator. ×1: `ሰዓት 10፡00 ቅድሚ ቐትሪ`.
        //    ⚠ THE NARROWNESS IS THE RULE, and it is where Amharic's step 6 does not survive re-measurement.
        //    ti's only ASCII `d:dd` in 323 lines is a SCRIPTURE CITATION — `أَفَلَا تَعْقِلُون: 21:10`,
        //    surah 21 verse 10 — so a rule keyed on `:` would have one false positive and zero true ones.
        //    Keyed on `፡` it has one true positive and zero false ones. BEFORE step 5, which claims every
        //    remaining lone ፡, and before any rule that could read a bare number.
        //    ⚠ ONLY THE SEPARATOR IS RESOLVED — no ሰዓት/ደቒቕ is inserted, because the text already supplies
        //    the frame (`ሰዓት 10፡00`) and adding the word would double it. `፡00` is the whole hour and reads
        //    as the bare hour, not as "…zero".
        s = s.replace(/(?<!\d)(\d{1,2})፡([0-5]\d)(?!\d)/gu, (_m, h: string, mi: string) =>
            Number(mi) === 0 ? ` ${words(h)} ` : ` ${words(h)} ${words(mi)} `);

        // 3. ERA MARKERS, BEFORE the generic abbreviation pass in step 4 — which would otherwise strip the
        //    dots and leave `ቅልክ`, an unpronounceable letter-run rather than a phrase. This is the
        //    playbook's "era markers before generic abbreviations" coupling.
        //    ⚠ BOTH EXPANSIONS ARE THE CORPUS'S OWN WORDS, not a translation: `ቅድሚ ልደተ ክርስቶስ` is written
        //    out IN FULL 12× in this corpus (`ካብ ከባቢ 9600 ቅድሚ ልደተ ክርስቶስ`) and ×28 on the wiki, and
        //    `ድሕሪ ልደተ ክርስቶስ` ×3 on the wiki in exactly this slot (`4ይ ክፍለ ዘመን ድሕሪ ልደተ ክርስቶስ`).
        //    Trailing dot optional; `ቅ.ል.` and `ቅ.ል.ክ` are both written.
        s = s.replace(/(?<![ሀ-ፚ])ቅ\.ል\.(?:ክ\.?)?/gu, " ቅድሚ ልደተ ክርስቶስ ");
        s = s.replace(/(?<![ሀ-ፚ])ድ\.(?:ል|ክ)\.(?:ክ\.?)?/gu, " ድሕሪ ልደተ ክርስቶስ ");

        // 4. DOTTED ABBREVIATIONS. ti writes unit abbreviations and initialisms with ASCII dots between
        //    Ethiopic letters (ኪ.ሜ ×15, ሜ. ×11, ኪ.ግ, ዓ.ም ×19, ዓ.ም.ፈ ×5). 71 interior dots in 323 lines,
        //    each mapped by `clausePunctuation` to a full STOP, shattering one abbreviation into phrases.
        //    Removing them leaves a fidel run, which IS the spelled reading.
        //    MULTI-DOT FIRST (trap: the interior dot of a 3-part form survives a single-dot rule), and the
        //    multi-dot form also loses its TRAILING dot. ⚠ Safe only because ti terminates sentences with ።
        //    rather than an ASCII dot, so no sentence-final pause is at risk.
        s = s.replace(new RegExp(`(?:${FID}{1,5}\\.){2,}${FID}{0,5}\\.?`, "gu"), (m) => m.replace(/\./gu, ""));
        //    Then the single INTERIOR dot, bounded by a fidel on BOTH sides, so it cannot touch 1.5,
        //    802.11a, or a genuine trailing period after a word.
        s = s.replace(new RegExp(`(?<=${FID})\\.(?=${FID})`, "gu"), "");
        //    ⚠ A TRAILING dot on a single-dot abbreviation (`ሜ.`, `ኪ.ሜ.`) is deliberately LEFT: that shape
        //    is indistinguishable from a word plus a sentence period.

        // 5. ⚠ THE LARGEST READING CHANGE IN THIS LAYER, and it is punctuation, not arithmetic. Any lone ፡
        //    is a clause break. It occurs 998× in 323 lines and contributed NO PAUSE AT ALL — it is outside
        //    the letter class, outside TOKEN's punctuation branch, and `makeGeezG2P` merely splits on it.
        //    Broken down: 806 `X፡ Y`, 104 `X ፡ Y`, 2 unspaced. Read in context they are clause boundaries —
        //    `ኣብ 2010፡ ንኣስታት 9,000 ሰባት ሞት ከስዕብ ከሎ፡ …`, `ስርሓት ካይላ፡ ካብ እምኒ፡ ኣስራዝን ዑንቊን …` — and NOT the
        //    traditional word separator: ordinary word gaps here are plain spaces, and 910 marks across
        //    ~15,000 words is far too sparse for one. The two unspaced instances are a place-name list
        //    (`ገጀረት፡ሰምበል፡ሰኒታ`) and a clause break, so they want a comma too.
        //    Mapped to ASCII ',', which `clausePunctuation` already carries, so TOKEN needs no change.
        //    AFTER steps 1 and 2, which took the sentence terminator and the clock.
        s = s.replace(/፡-?/gu, ",");

        // 6. DIGIT DE-GROUPING, before anything reads the separator as clause punctuation.
        //
        //    ⚠ ti GROUPS WITH THE PERIOD AS WELL AS THE COMMA, which Amharic does not — its step 5 says
        //    "commas only", and that is one of the seven am rules that failed re-measurement. `200.000 ሰባት`
        //    (Samoa, >200,000 people) read as "two hundred . zero": a sentence STOP mid-number plus the word
        //    for zero. Measured over all five `\d\.\d{3}` instances in the artifact: FOUR are thousands
        //    separators (`200.000`, `38.800`, `16.000` islands, `26.990 ኪ.ሜ2`) and ONE is a decimal
        //    (`451,170.7 ሄክታር (1,741.980)`) — and the decimal is the one number that ALREADY CARRIES A
        //    COMMA GROUP. A number cannot use both marks for the same job, and that is the discriminator.
        //
        //    ⚠ THE GUARD IS PER-NUMBER, NOT PER-STRING, and it has to run FIRST. Keying it on "does this
        //    TEXT contain a comma group" would disable the rule for any paragraph that happens to mention
        //    one other grouped figure; keying it on `s` after the comma pass would be worse still, since
        //    that pass has just deleted the evidence. So the token is matched whole — `[\d.]+` bounded by
        //    `(?<![\d,.])`/`(?![\d,.])`, which cannot start or end inside a comma-grouped number — and only
        //    then is the period spent. `1,741.980` matches nothing here and stays a decimal; `48.33` and
        //    `451,170.7` are untouched because the fraction is not exactly three digits.
        //    RESIDUAL RISK, stated: a genuine 3-decimal-place figure written without any comma group would
        //    be de-grouped. The artifact contains none, and 4-against-1 is the whole argument.
        s = s.replace(/(?<![\d,.])[\d.]+(?![\d,.])/gu, (n) => n.replace(/(\d)\.(?=\d{3}(?!\d))/gu, "$1"));
        //    Then the comma, ×66. `1,600` read as `ħadə , ʃɨdʃtə miʔti` — "one, six hundred", a phrase break
        //    inside a number.
        s = s.replace(/(\d),(?=\d{3}(?!\d))/gu, "$1");
        s = s.replace(/(\d),(?=\d{3}(?!\d))/gu, "$1"); // second pass for 5,000,000

        // 7. RANGES, restricted to the ካብ ("from") frame — `ካብ 51-70 ኪ.ሜ` → `ካብ 51 ክሳብ 70 ኪ.ሜ`. ×5, and
        //    the frame is not invented: the corpus writes `ካብ N ክሳብ M` out in full 15 times.
        //    ⚠ THE RESTRICTION IS THE RULE, and it is why the minus is declined (see the header). Of the 27
        //    hyphenated digit pairs here, 22 are year spans (`1937-1938`, `2016-17`), sports scores
        //    (`6-1`, `2 – 1`) or designations (`COVID-19`, `ICD-10`, `G-20`, `ሚግ-21`) — none of which may
        //    become "from…to". They are left as two adjacent numbers, which is what they already were:
        //    TOKEN drops the hyphen and emits no pause.
        s = s.replace(/(?<![\p{L}\p{M}])ካብ\s?(\d[\d.]*)\s?[-–—]\s?(\d[\d.]*)/gu,
            (_m, a: string, b: string) => `${FROM} ${a} ${UNTIL} ${b}`);

        // 8. SQUARED AREA, ⚠ BEFORE the plain ኪሜ expansion in step 8b, which would otherwise strand the
        //    exponent and drop it. The dots are already gone (step 4), so the key here is the bare ኪሜ.
        //    ⚠ ትርብዒት PRECEDES the unit and is TIGRINYA'S OWN WORD, not Amharic's ካሬ or ስኩዌር: ×7 in this
        //    corpus and ×11 on the wiki, always in front — `916,445 ትርብዒት ኪ.ሜ`, `172,300 ትርብዒት ማይል`,
        //    `ልዕሊ 8.5 ሚልዮን ትርብዒት ኪ.ሜ.`. ካሬ appears ×1, an Amharic borrowing, and is the loser here.
        s = s.replace(/(?<![ሀ-ፚ])ኪሜ\s?[²2](?![\d\p{L}])/gu, "ትርብዒት ኪሎ ሜተር");

        // 8b. ኪ.ሜ / ኪሜ → ኪሎ ሜተር. ×15. Trap 38: the word was already there — this corpus writes it out in
        //     full ×6 (`ኪሎሜተር` ×3, `ኪሎ ሜተር` ×3), so the expansion is the spoken form and not the letter-run
        //     "kime" the fidel g2p produces. ⚠ Unconditional rather than routed through the shared unit
        //     tier, because it also occurs with no adjacent number (`ኪ.ሜ ንታሕቲ`).
        s = s.replace(/(?<![ሀ-ፚ])ኪሜ(?![ሀ-ፚ])/gu, "ኪሎ ሜተር");

        // 9. SHARED SYMBOL TIER (%, $, €, £) runs HERE, in the middle: after de-grouping and the clock (so
        //    `$17 ሚልዮን` and `10፡00` are already settled) but BEFORE decimals, because the tier's own NUM
        //    pattern matches `1.65` as one number and a decimal rewrite would destroy the currency
        //    adjacency — `ብ1.65 ቢልዮን ዶላር` must reach it intact.
        s = symbols(s);

        // 10. DECIMALS. Integer part as a number, ነጥቢ, then the fraction ONE DIGIT AT A TIME. 57 instances;
        //     before this, `48.33%` read "forty eight . thirty three" — a sentence STOP inside the number
        //     and the fraction read as a whole number. After the clock (step 2), the de-grouping (step 6)
        //     and the symbol tier (step 9); the abbreviation dots are long gone (step 4).
        s = s.replace(/(?<![\d.])(\d+)\.(\d+)(?![\d.])/gu,
            (_m, i: string, f: string) => ` ${words(i)} ${POINT} ${eachDigit(f)} `);

        // 11. ORDINALS — `Nይ`, ti's own abbreviated form, ×22 and EVERY ONE 1–10. Before this, `6ይ` read as
        //     `ʃɨdʃtə jɨ`: the cardinal plus a bare orphan syllable, because the ordinal's final letter was
        //     tokenized as a word of its own.
        //     ⚠ THIS IS WHERE AMHARIC IS MOST WRONG FOR TIGRINYA. am's `ኛ` suffix and its whole
        //     consonant-final-cardinal morphology have ZERO instances here; ti has a Semitic pattern series
        //     (see ORDINAL above). Nothing about the rendering says so — only the count.
        //     Any feminine (ቲ/ት) or conjunction (ን) tail is preserved. Out-of-table values are LEFT ALONE
        //     rather than composed: the corpus has none, and `መበል N` (×35) is the above-ten form and
        //     already reads correctly with no rule.
        //     After de-grouping (step 6) so a grouped numeral is a single digit run.
        //     ⚠ THE SECOND ARM IS THE GE'EZ-NUMERAL SPELLING OF THE SAME THING — `፮ይ ክፍሊ` ("sixth grade"),
        //     ×1. It must be claimed HERE and not left to step 12, because step 12 reads a numeral run as
        //     bare value words and would leave the `ይ` behind as an orphan syllable, which is the very
        //     defect this step exists to remove. One character only: every ordinal the corpus writes is
        //     1–10, and a multi-character numeral before `ይ` would need the additive reading step 12
        //     declines to commit to.
        const ordinalize = (m: string, value: number, tail: string): string => {
            const o = ORDINAL[value];
            return o === undefined ? m : ` ${o}${tail} `;
        };
        s = s.replace(/(?<![\d.])(\d+)\s*ይ([ቲትን]?)(?![ሀ-ፚ])/gu,
            (m, d: string, tail: string) => ordinalize(m, Number(d), tail));
        s = s.replace(/(?<![፩-፼])([፩-፼])ይ([ቲትን]?)(?![ሀ-ፚ])/gu,
            (m, c: string, tail: string) => ordinalize(m, GEEZ_DIGIT[c] ?? 0, tail));

        // 12. ETHIOPIC NUMERALS → the value word of each character. 20 instances, ALL of which read as the
        //     EMPTY STRING before this rule. See GEEZ_DIGIT above for why this is character-wise and not
        //     arithmetic, and for the ti.wikipedia gloss that sources it.
        //     ⚠ AFTER step 11, so `፮ይ` ("6th grade") keeps its ይ as an ordinary letter rather than being
        //     claimed by the Arabic-digit ordinal rule — and after step 4, whose fidel-bounded dot guard
        //     must not see numeral characters as letters (`፩፶፬()ሜ.`).
        s = s.replace(/[፩-፼]+/gu, (m) =>
            ` ${[...m].map((c) => { const v = GEEZ_DIGIT[c]; return v === undefined ? "" : numberToText(v); })
                .filter(Boolean).join(" ")} `);

        // 13. ° → ዲግሪ. ×10 — coordinates (`6°54′ ሰሜን`) and temperatures (`፶፭°C`).
        //     SOURCED IN THE NUMBER-ADJACENT ANGULAR SENSE, which matters because the word is polysemous:
        //     ti.wikipedia has ዲግሪ ×16, of which `30 ዲግሪ ጽላታት` and `360 ዲግሪ ዝዓቐኑ` are the angular measure
        //     and the rest are the ACADEMIC degree (`ማስተርስ ዲግሪ`). Trap 37, and the numeric slot settles it.
        //     ⚠ Only the SIGN is resolved: the Latin scale letter after it (C, W) is outside TOKEN's
        //     alphabet and stays dropped, and no Tigrinya spelling of Celsius is sourceable — `sources.ts`
        //     reports `scale-names ??` for exactly this reason.
        s = s.replace(/°/gu, " ዲግሪ ");

        return s.replace(/[ \u00a0]{2,}/gu, " ");  // space, NBSP
    };
}
