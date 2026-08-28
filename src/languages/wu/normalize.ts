/**
 * Wu Chinese / Shanghainese (wuu) text normalization — the pre-tokenizer pass that rewrites what is not yet a
 * pronounceable word into Han text the Han→Wugniu→IPA pipeline already speaks. Pure text→text, no IPA.
 *
 * ⚠ EVERY WORD THIS FILE EMITS MUST BE A KEY IN `dict.tsv`, or the front end SKIPS it — silently, because an
 * unlisted character is dropped rather than guessed. That is a stronger sourcing gate than most languages
 * have and it is checkable in one command (`grep -P "^百分之\t" dict.tsv`). Every literal below was checked
 * that way, and separately checked for SENSE against the corpus or wuu.wikipedia prose; the evidence is in
 * `docs/investigations/wuu_normalization_investigation.md` Run 1.
 *
 * ⚠ AND IT MUST BE WU'S WORD, NOT MANDARIN'S. The dict will read any Han string, so "it phonemizes" proves
 * nothing about the language. Two places where copying the Cantonese layer would have been wrong:
 *   · THE CONJUNCTION IS 搭, NOT 和 — 搭 ×176 vs 和 ×40 in the corpus excerpts, and Wu's 和 is mostly bound
 *     (共和国, 和暖). yue ships 和; this must not.
 *   · THE TEMPERATURE WORDS SIT ON OPPOSITE SIDES OF THE NUMBER. Celsius is POSTposed (`17摄氏度`,
 *     `5.0摄氏度`) and Fahrenheit PREposed (`华氏1度`, `华氏零度`) — both straight from wuu.wikipedia prose.
 *     Cantonese reads 攝氏N度 for both. Not a symmetry worth guessing at; the two words were probed apart.
 *
 * ⚠ `\b` IS NEVER USED: it is ASCII-defined and finds no boundary against Han, so every boundary here is an
 * explicit lookaround.
 *
 * ⚠ NUMBERS STAY AS ASCII DIGITS wherever the engine's own cardinal composition is the right reading, and are
 * written out as Han ONLY where it is not — years, and the fractional part of a decimal.
 *
 * Deliberately left alone, each with the measurement:
 *   · THE CLOCK. The artifact reports `clock: 1688`, and the cell's regex is `\p{Nd}{1,2}[:.]\p{Nd}{2}` — the
 *     `.` alternative, so that count is overwhelmingly DECIMALS (its own hard-set examples are `99.37%`,
 *     `59.55千米`, `813.69`). Every real `H:MM` in the corpus excerpts is a SPORTS TIME or a UTC timestamp
 *     with a third field — `13:15.10`, `13:02.80`, `2:08:44`, `2:00:25`, `17:47:23`, `08:08:50`, 6 of 6 — and
 *     Chinese writes the time of day as 19时35分, which the corpus does (`2006年8月21号19时35分`) and the dict
 *     already reads correctly. A colon rule here would claim only the shapes it must not.
 *   · EMBEDDED LATIN THAT IS NOT AN INITIALISM — foreign proper names (Perl, Debian, Grenelle, Rasmus) and
 *     quoted English (`East China Sea`) — stays on the English phonemizer, which is right: they are not Wu
 *     words in the first place. That is ~88% of the 883 Latin runs in the artifact. The other ~12%, the
 *     ALL-CAPS initialisms, are NOT left alone any more; see step 14.
 *   · THE RELATIONAL SIGNS. 等于/小于 are in the dict AND corpus-attested in sense, so this looked like the
 *     easy win — and the count refuted it. Of the 20 `=` in the corpus excerpts, the great majority are
 *     WIKI SECTION HEADINGS (`== 参考文献 ==`) and the rest are LaTeX formula bodies (`(x-x_m)^2 + (y-y_m)^2
 *     = a^2`, `y = y_m + a \sin \theta`). Reading the sign would say 等于等于 参考文献 等于等于 aloud on
 *     every article. `<` and `>` occur ZERO times. This is playbook trap 2 from the other direction: the word
 *     was sourced and the SIGN was not what the count implied.
 *   · `+` AND `×` AS OPERATORS. 加 and 乘 are both in the dict, and neither has an attested operator sense:
 *     all 47 corpus hits of 加 are bound (外加, 加勒比, 新加坡, 加工, 增加, 加拿大) and wuu.wikipedia adds only
 *     汤加 and 毕加索; both 乘 hits are 乘坐 "to ride". That is playbook trap 2 — a count is a lead — and the
 *     lead does not survive reading the instances.
 *   · BARE NUMERIC RANGES with no unit after them. The corpus's unguarded dashes are BUS ROUTE LISTS
 *     (`公交车8 - 31 - 32 - 46 - …`), model numbers (`747-400`, `Qwen2.5-72B`) and a tone notation (`223-33`).
 *     The range rule below therefore requires a unit, scale or magnitude word on the right — see step 6.
 *   · THE RATE SLASH in general (`18元/张`, `1g/mol`). Only the population-density shape is claimed, because
 *     only that one has an attested reading (step 8).
 *
 * ⚠ The full-width ％ needs NO local fold: `core/normalizeSymbols.ts` accepts `[%٪％]`. (The yue header used to
 * say otherwise; corrected there in the same change that added this file's letter table.) ℃/℉ likewise arrive already folded to `°C`/`°F` by the registry,
 * and HTML entities are decoded there too — which matters here, because the artifact's `ampersand: 277` is
 * almost entirely `&nbsp;`, and reading the instances is the only thing that showed it.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { degroupThousands, HAN_DIGITS, spellHanDigits, readDegrees, reorderFraction } from "../../core/sinitic.ts";
import { tr } from "../../core/provenance.ts";

/** 0–9 as Han numerals — RE-EXPORTED FROM `core/sinitic.ts`, not declared here. wu.ts imports it FROM HERE
 *  so its cardinal composition and this file's digit-string reading cannot drift apart; the re-export keeps
 *  that while leaving exactly one table in the repo. */
export const DIGITS = HAN_DIGITS;

/** A digit string read one digit at a time — the reading Chinese gives a year (二零零九) and the fractional
 *  part of a decimal (点三四), as opposed to the cardinal a quantity gets. */
const spellDigits = (s: string): string => spellHanDigits(s);

// ⚠ `unspacedScript` because a sign in Wu prose is normally flanked by Han, which the tier's letter-boundary
// guard rejects. `percentPrefix` because 百分之 PRECEDES its number, as in every Sinitic language:
// wuu.wikipedia writes 百分之七十八, 百分之六十, 平均盐度百分之3.5.
//
// `¥` and `€` are DELIBERATELY ABSENT — neither sign nor word occurs anywhere in the corpus, and an unsourced
// currency word is left unread. `$` and `£` are the two the corpus actually writes (£187,500, £52,000,
// £10,500, £125,000, £367,500, $1,125,4…), and both readings are corpus-attested: 250亿美元, and
// 三十六万七千五百英镑 glossing £367,500 in the very next parenthesis.
//
// ⚠ `m` IS DELIBERATELY ABSENT, for the reason the Cantonese layer gives: 米 is a one-character unit and in an
// unspaced script that is inseparable from any name containing it (米勒 = "Miller"). 公里/公斤 are safe because
// they are two characters, and both are corpus-attested (公里 ×54; 公斤 in the article that states 單位符号kg).
const SYMBOLS = makeSymbolNormalizer({
    ampersand: "搭",
    percent: ["百分之"],
    percentPrefix: true,
    units: { km: ["公里"], kg: ["公斤"] },
    currency: { $: ["美元"], "£": ["英镑"] },
    // 平方公里 is fused and word-first, and is its own dict entry (`bin2 faon4 kon4 li4`) — 37 corpus hits.
    // Cubed is undeclared: 立方 is in the dict but 立方公里 is not a thing the corpus says, and 立方米 cannot be
    // reached while 米 stays undeclared for the 米勒 reason above. The two gaps are the same gap.
    exponentWords: { squared: ["平方"], position: "compound" },
    unspacedScript: true,
});

/** The coordinate minute/second marks, in every encoding the corpus uses. U+2032/U+2033 are the canonical
 *  pair; the rest are the typographic stand-ins wiki text is full of — U+3003 〃 ditto, U+00B4 ´ acute,
 *  U+02CA ˊ modifier acute, and the ASCII quotes. All five appear in wuu coordinates. */
const MINUTE = "[′´ˊ’']";
const SECOND = "[″〃”\"]";

/**
 * Normalize one Wu string. `measureWords` is the manifest's classifier inventory (step 12) and
 * `letterNames` its Latin letter → Han table (step 14); both are language DATA, authored in wu.jsonc.
 *
 * The steps are ORDER-DEPENDENT and the coupling is stated at each one; a future reader cannot recover it
 * from the code.
 */
export function normalizeWu(
    input: string,
    measureWords: string,
    letterNames?: Readonly<Record<string, string>>,
): string {
    let s = input;

    // ── 1. de-group thousands separators ─────────────────────────────────────────────────────────
    // ⚠ FIRST, AND THIS IS THE MOST DESTRUCTIVE DEFECT IN THE LAYER. A grouping comma is otherwise read as
    // clause punctuation, and worse: the engine tokenizes `\d+`, so `1,000人` became 一 + [pause] +
    // integerToHan(0) = 零 — the VALUE gone, not merely the pause misplaced. `grouped: 2577` corpus-wide.
    // Every later rule's "a digit is adjacent" test also needs the number to be one run.
    // ⚠ Exactly-3-digit groups only, which is what leaves the corpus's 万-grouped `1,8638.36亿元` alone
    // rather than mangling it — that is a Chinese four-digit grouping, not a thousands separator.
    s = degroupThousands(s);

    // ── 2. geographic coordinates ────────────────────────────────────────────────────────────────
    // ⚠ BEFORE EVERY OTHER ° RULE AND BEFORE THE RANGE RULE. `degrees: 241` corpus-wide and the instances are
    // overwhelmingly coordinates, not temperatures: 东经121°09′30〃至121°54′00〃, 北纬31°27′00〃, 8°30′至23°22′,
    // 13°43′30″, 东经121°48´-121°57ˊ. Left to the bare-degree rule the minute and second marks drop silently;
    // left to the range rule, `29°08ˊ-29°13ˊ` gets a 到 wedged between a minute mark and a degree sign.
    // 度/分/秒 are each their own dict entry (du6 / fen1 / miau6). Digits stay digits so the cardinal path
    // reads them, which is also what strips a written leading zero (09分 → 九分).
    s = tr(s, 
        new RegExp(`(\\d+)\\s*°\\s*(\\d+)\\s*${MINUTE}\\s*(\\d+)\\s*${SECOND}`, "gu"),
        "$1度$2分$3秒",
    );
    s = tr(s, new RegExp(`(\\d+)\\s*°\\s*(\\d+)\\s*${MINUTE}`, "gu"), "$1度$2分");
    // ⚠ AND THE DASH BETWEEN TWO COORDINATES, here rather than in step 6, because by now the endpoints end in
    // 分/秒/度 and no digit-to-digit rule can ever see them: `东经121°48´-121°57ˊ` became 一二一度四八分 …
    // 一二一度五七分 with the range silently gone (4 of the corpus's DROP-minus instances, all of them this
    // shape). 到 is the corpus's own connective for coordinates too — 121°09′30〃至121°54′00〃 writes 至.
    // ⚠ ⟨度⟩ IS DELIBERATELY NOT IN THIS CLASS, and leaving it in was a live defect: `温度-5度` read
    // 温度**到**五度 — a genuine negative rewritten as a range, on the one shape a reader would notice. Both
    // of the corpus's coordinate ranges have 分 before the dash (`121°48´-121°57ˊ`, `29°08ˊ-29°13ˊ`) and
    // none has a bare 度, so the narrower class keeps every attested case and drops the misfire. A range
    // between two whole-degree coordinates would need its own evidence before being claimed.
    s = tr(s, /([分秒])\s*[-–—－~～〜]\s*(?=\d)/gu, "$1到");

    // ── 3. temperature scales ────────────────────────────────────────────────────────────────────
    // ⚠ AFTER coordinates (step 2) and BEFORE the bare-degree rule below, which would otherwise consume the
    // ° and leave a bare `C` to be read as an ENGLISH LETTER NAME — which is what `20°C` did: *əl səʔ sˈiː*.
    // ⚠ THE TWO SCALES TAKE OPPOSITE ORDERS, and both orders are wiki-attested. See the file header.
    // ℃/℉ arrive already folded to `°C`/`°F` by the registry.
    // ⚠ SHARED — the trio and its order live in `core/sinitic.ts`: temperature first, or the bare rule eats
    // the ° and leaves a lone ⟨C⟩ read as an ENGLISH LETTER NAME, which is what `20°C` did here.
    // ⚠ THE POSITIONS ARE WU'S OWN, and are why the shared rule takes FUNCTIONS rather than words: Celsius
    // is POSTposed (`17摄氏度`) and Fahrenheit PREposed (`华氏1度`), both from wuu.wikipedia prose.
    // ⚠ THE BARE ARM IS THE SHARED RULE'S TOO, and it used to be a local copy here. That copy captured
    // `(\d+)`, the same shape that turned out to be a live bug in the PREPOSING layers (`13.3 °C` → `13.` +
    // 攝氏三度 in yue and nan). It was harmless HERE only because Wu postposes, so `2.5°` → `2.` + `5度`
    // reassembles to the same string — which is precisely the accident that hid the defect from four
    // languages. Keeping a private copy of a rule whose shared version has already been corrected is how
    // that happens again.
    s = readDegrees(s, {
        celsius: (n) => `${n}摄氏度`,
        fahrenheit: (n) => `华氏${n}度`,
        bare: (n) => `${n}度`,
    });

    // ── 4. YYYY–YYYY year ranges ─────────────────────────────────────────────────────────────────
    // ⚠ BEFORE THE SINGLE-YEAR RULE (step 5): only the RIGHT endpoint of `1966-1976年` is followed by 年, so
    // left alone the range reads cardinal-then-digits, mixing two readings inside one span. The corpus writes
    // these with an ASCII hyphen, an en/em dash, a full-width －, and a full-width ～ (`1969年～1976年`), so all
    // are accepted; a written 至/到 connective is kept rather than replaced.
    // ⚠ NOT WHEN A MAGNITUDE OR CURRENCY FOLLOWS. `资本额达1,400－1,500万元` de-groups to two 4-digit numbers
    // and is a QUANTITY range, not years — reading it 一四零零到一五零零万元 would be confidently wrong. That
    // instance is why this guard exists; step 6 claims it instead.
    const NOT_QUANTITY = "(?!\\s*[万萬亿億元块塊人米吨噸])";
    s = tr(s, 
        new RegExp(`(?<![\\d.,])(\\d{4})\\s*[-–—－~～〜]\\s*(\\d{4})(?![\\d.,])${NOT_QUANTITY}`, "gu"),
        (_m, a: string, b: string) => `${spellDigits(a)}到${spellDigits(b)}`,
    );
    s = tr(s, 
        new RegExp(`(?<![\\d.,])(\\d{4})\\s*([至到])\\s*(\\d{4})(?![\\d.,])(?=\\s*年)`, "gu"),
        (_m, a: string, conn: string, b: string) => `${spellDigits(a)}${conn}${spellDigits(b)}`,
    );
    // ⚠ AND THE FORM WHERE 年 IS WRITTEN ON BOTH ENDPOINTS — `1969年～1976年`, which the two rules above cannot
    // see because the 年 sits BETWEEN the number and the dash. Left to step 5 alone both years get their
    // digit reading and the connective silently vanishes, which reads as one date abutting another.
    s = tr(s, 
        /(?<![\d.,])(\d{4})\s*年\s*[-–—－~～〜]\s*(\d{4})(?=\s*年)/gu,
        (_m, a: string, b: string) => `${spellDigits(a)}年到${spellDigits(b)}`,
    );

    // ── 5. 4-digit year before 年 / 年代 ─────────────────────────────────────────────────────────
    // AFTER de-grouping (so no grouping comma sits inside the four digits) and AFTER step 4. `year: 25376`
    // corpus-wide — the largest class in the language by an order of magnitude. A year is read DIGIT BY DIGIT:
    // 2009年 is 二零零九年, not the cardinal 二千零九年, and 1990年代 is 一九九零年代.
    // ⚠ THE 年 MUST BE FOUND ACROSS WHITESPACE: Han corpora routinely write "2009 年", and that exact detail
    // silently defeated the same rule in Mandarin.
    s = tr(s, /(?<![\d.,:])(\d{4})(?![\d.,])(?=\s*年)/gu, (_m, y: string) => spellDigits(y));

    // ── 6. quantity ranges, RIGHT-CONTEXT GUARDED ────────────────────────────────────────────────
    // AFTER the year rules, which have already claimed the year shapes. `ranges: 1001` corpus-wide.
    // ⚠ THE GUARD IS THE WHOLE RULE. Cantonese declined bare numeric ranges over sports scores; wuu's corpus
    // has no scores but has three other things a bare `N-M` rule would wreck — BUS ROUTE LISTS
    // (`公交车8 - 31 - 32 - 46 - 49D - 55 …`), MODEL NUMBERS (`747-400`, `Qwen2.5-72B`) and a TONE NOTATION
    // (`223-33`). None of them is followed by a unit. So the range is claimed only where a unit, scale or
    // magnitude word follows, which is every genuine instance in the corpus: 3-5月, 2-8°C, 31-32‰, 15-25公里,
    // 10-15公里, 50-100公里, 3.5—4.5米, 10～13吨, 6-13世纪, 0-14 岁, 7%-10%, 1400－1500万元.
    // Digits are LEFT as digits so the cardinal path reads them; 到 is the corpus's own connective
    // (`南北宽13到18公里`, `重5.5到9.5公斤`).
    // ⚠ BEFORE the percent tier (step 9): once `7%` has become `百分之 7` the two endpoints are no longer
    // adjacent to the dash and this can never match. Run this first and `7%-10%` reads 百分之7到百分之10.
    // ⚠ THE SIGN MAY SIT ON BOTH ENDPOINTS — `7%-10%`, where the left `%` stands between the number and the
    // dash so a `\d+\s*-` pattern never reaches it. Captured and RE-EMITTED (playbook trap 10: a rule that
    // consumes a character must put it back), which is what lets step 9 read both halves: 百分之7到百分之10.
    const RANGE_UNIT = "(?:%|‰|°|摄氏度|度|月|日|号|號|年|岁|歲|世纪|世紀|公里|千米|米|毫米|公斤|吨|噸|万|萬|亿|億|元|人|个|個)";
    s = tr(s, 
        new RegExp(
            `(?<![\\d.,\\p{sc=Latn}])(\\d+(?:\\.\\d+)?)([%‰])?\\s*[-–—－~～〜]\\s*(\\d+(?:\\.\\d+)?)(?=\\s*${RANGE_UNIT})`,
            "gu",
        ),
        (_m, a: string, sign: string | undefined, b: string) => `${a}${sign ?? ""}到${b}`,
    );

    // ── 7. western fraction → the Chinese order ──────────────────────────────────────────────────
    // ⚠ a/b IS 分之 IN THE OPPOSITE ORDER: 1/5 is 五分之一, "of five parts, one". 分之 is its own dict entry
    // and the corpus uses it exactly this way ×7 (四分之一, 十分之一, 三分之二), including as a GLOSS of the
    // digit form — “即代表千分之一，或1/1000”. Digits are required on BOTH sides and nothing numeric may be
    // adjacent, which keeps Han-unit slashes and the density shape (step 8) untouched.
    // ⚠ SHARED, AND THE MOVE FIXED A LATENT BUG HERE: the local copy carried no year-pair guard, so
    // `2020/2021` read 2021分之2020 — an academic year as a fraction. jv guarded that shape, nan's whole
    // fraction rule was removed over `Fahrenheit 9/11`, cjy caught it in review, and wuu and yue were both
    // carrying it unnoticed. Five languages, one shape — which is the argument for sharing it.
    s = reorderFraction(s, "分之");

    // ── 8. population density ────────────────────────────────────────────────────────────────────
    // ⚠ THE ONLY RATE CLAIMED, and only because it is the only one with an attested reading: the corpus
    // writes the same fact in words as `人口密度是每平方公里813.69` — the PER-PHRASE FIRST, then the number.
    // The shared tier cannot express that (its rate composes numerator-per-denominator, and here the
    // numerator noun is Han), so it is local. `488/km²` and `745/km²`.
    // ⚠ THE BACKSLASH VARIANT THE CORPUS ALSO CONTAINS (`70人\km²`) IS NOT MATCHED HERE, AND MUST NOT BE:
    // `core/markup.ts` strips a backslash followed by letters as a LaTeX control sequence, so that string
    // arrives as `70人 ²` and the unit is gone before this layer runs. A `[/\\]` class here would be dead
    // code that reads as coverage. The residue is one `MARKUP exponent` line in the artifact scan.
    // AFTER the fraction rule, whose digit-only right side can never match `km²`.
    s = tr(s, 
        /(\d+(?:\.\d+)?)\s*(人?)\s*\/\s*km\s*(?:²|2)(?![\p{sc=Latn}\d])/giu,
        (_m, n: string, ren: string) => `每平方公里${n}${ren}`,
    );

    // ── 9. percent, currency and units, via the shared symbol tier ───────────────────────────────
    // AFTER de-grouping (the tier needs the number contiguous) and BEFORE the decimal rule (step 10): the
    // tier matches ASCII digits next to the sign, and step 10 replaces the "." with the Han 点, which would
    // break that adjacency for any decimal percentage — of which the corpus has many (`14.5％`, `54.15％`).
    s = SYMBOLS(s);

    // ── 10. per-mille ────────────────────────────────────────────────────────────────────────────
    // The shared tier reads `%` in three encodings and does not read `‰` at all, so this is local. The word
    // is 千分之, and the corpus DEFINES it: “像1‰，即代表千分之一” and “82‰，即代表千分之82”. That is about as
    // direct a sourcing as a symbol reading ever gets. Prefixed, like 百分之.
    // AFTER the tier so `31到32‰` still has its digits adjacent to the sign.
    s = tr(s, /(?<![\d.,])(\d+(?:\.\d+)?)\s*‰/gu, "千分之$1");

    // ── 11. decimals ─────────────────────────────────────────────────────────────────────────────
    // AFTER the year (step 5), coordinate (step 2) and percent (step 9) rules, so no period or digit run they
    // own is still in play. `decimals: 5336` corpus-wide, second only to years, and every one of them was
    // leaking a raw `.` into the phoneme stream.
    // ⚠ The separator is 点 and the FRACTIONAL part is read DIGIT BY DIGIT — 6.34 is 六点三四, never 六点三十四
    // — so it is written out as Han here while the integer part stays a digit for the cardinal path.
    // ⚠ 点 IS THE ONE WORD HERE SHIPPED WITHOUT AN ATTESTED SENSE, and knowingly: all 33 corpus hits are the
    // noun (高点, 特点, 观点). That is the Igbo lesson in the playbook — a written corpus is the weakest
    // evidence there is about how a SYMBOL is spoken, because writers type `3.5` and never spell out how they
    // would say it. It is in the dict (`ti0`), it is what cmn and yue both read, and the alternative is 5,336
    // raw stops.
    // ⚠ THE LOOKBEHIND EXCLUDES A COLON, AND THAT IS THE SPORTS-TIME GUARD. `13:15.10` is a 5000 m time, and
    // its `.10` is hundredths of a SECOND, not a decimal fraction — read as 十五点一零 it becomes a decimal
    // inside a duration. Since the clock itself is declined above, the honest outcome is to claim neither
    // half; the `.` stays raw in the 3 corpus utterances the `sports-time` cell counts, exactly as it did
    // before this layer existed. Claiming it would need a 时/分/秒 reading, and the corpus's five instances
    // split between elapsed times (2:08:44, a marathon → 小时) and UTC timestamps (17:47:23 → 时), which one
    // rule cannot serve.
    s = tr(s, 
        /(?<![\d.:])(\d+)\.(\d+)(?![\d.])/gu,
        (_m, int: string, frac: string) => `${int}点${spellDigits(frac)}`,
    );

    // ── 12. 2 + classifier → 两 ──────────────────────────────────────────────────────────────────
    // LAST of the number rules, and after de-grouping so the "no digit to the left" guard means what it says
    // (1200 间 must not become 120两间). Chinese counts with 两 before a classifier, not 二, and the corpus
    // does: 两个大都市, 两国, 两轮车, 两座, 两只岛.
    // ⚠ 月 and 日 are deliberately NOT in the manifest's inventory — "2 月" is February, which is 二月.
    // ⚠ AND NOT AFTER 第, which the Cantonese rule does not guard: 第2个 is an ORDINAL, 第二个, never *第两个.
    if (measureWords !== "")
        s = tr(s, new RegExp(`(?<![\\d.,第])2(?=\\s*[${measureWords}])`, "gu"), "两");

    // ── 13. the iteration mark ───────────────────────────────────────────────────────────────────
    // 々 repeats the preceding character, and the corpus carries it inside Japanese names quoted in Wu prose
    // (佐々木, 多々良氏, 九々蜃) — `iteration: 11`. Dropped, it deletes a whole SYLLABLE from a name: 佐々木 read
    // *t͡su˧˦ moʔ˩˨*, two syllables for three. Doubling the character is the reading Wu gives it, and costs
    // nothing since the doubled character was already in the dict by definition.
    // LAST, because it is the one rule whose input is a Han character rather than a digit or a sign, so
    // nothing above can consume it and nothing below depends on it.
    s = tr(s, /(\p{Script=Han})々/gu, "$1$1");

    // ── 14. Latin initialisms → their letter names, spelled in Han ───────────────────────────────
    // ⚠ WHY THIS IS NOT LEFT ON THE ENGLISH PHONEMIZER, which is what cmn and yue do. `中国GDP总量` read
    // *t͡soŋ˥ koʔ˧˩ ɡˈiːdˈiːpʰˈiː t͡soŋ˥ ljɛ̃˧˩* — English [iː], English stress marks, and NO TONE, in the
    // middle of a tonal utterance. The letter NAMES are right (they are English-derived in every Sinitic
    // variety — see the `letterNames` sourcing note in wu.jsonc); the PHONOLOGY is not. Rewriting to Han
    // hands the reading to the dict, so the names come out in Wu with Wu tones.
    //
    // ⚠ THE LENGTH WINDOW IS 2–3, NARROWED FROM 2–4 BY THE SIBLING CORPORA. This layer shipped 2–4 first,
    // on the count that the wuu artifact has 110 all-caps tokens at 2–4 letters and only 4 at 5+ (three of
    // them English words: PROJECT, LAWSON, LOUBAT). Extending the same rule to cmn showed the real boundary
    // is at FOUR, not five: **9 of 16 four-letter tokens in the cmn corpus are ENGLISH WORDS** — FIFA ×7,
    // BANK, SEAL — and wuu's own four-letter band carries COOH, DASH, TURE and NASA on the same shape.
    // The cost is ASYMMETRIC and that is the whole argument: a genuine 4-letter initialism left on the
    // English reader (SNCF, ISBN, AODV, LGPL) still says the RIGHT LETTER NAMES in the wrong accent, while
    // a spelled-out English word is confidently unintelligible. Whether an acronym is a word or letters is
    // a LEXICAL fact — `core/initialisms.ts` says exactly that — and dict.tsv has ZERO Latin keys, so wuu
    // has no lexical tier that could decide it. yue does, and its rule is shaped accordingly.
    //
    // ⚠ `[IVX]{2,3}` IS EXCLUDED BECAUSE IT BELONGS TO ANOTHER SEAM. `core/roman.ts` runs in the registry,
    // WRAPPING `engine.text()`, so it has already claimed every Roman numeral it is willing to claim before
    // this layer sees anything; what reaches here is what it declined (`第II次`, `世界大战II`). Spelling
    // those as *阿阿* would entrench a wrong reading in a class that is not this rule's. Measured: of the 65
    // distinct all-caps runs, 7 parse as Roman numerals — II III CD DC ML MV XL — and only the first two
    // are numerals; CD/DC/ML/MV/XL are initialisms. `[IVX]{2,3}` protects both real cases and costs none of
    // the five, where a blanket "is it a valid numeral" test would have lost all five to protect two.
    //
    // ⚠ THE LETTERS ARE SPACE-SEPARATED, AND THAT IS LOAD-BEARING RATHER THAN COSMETIC. `hanRun` segments
    // by GREEDY LONGEST MATCH over dict.tsv, so a letter-name string run together can be swallowed as a
    // REAL WORD and take that word's sandhi melody: `GDP` → 其地披 fused 地披… and `DQ` → 地区 is simply the
    // word "region". Measured over all 676 letter pairs, 10 spellings contain a dict word spanning the
    // letter boundary — 西欧 (CO, "Western Europe"), 地区 (DQ, "region"), 地衣 (DE, "lichen"), 娃娃 (YY,
    // "doll"), 开恩 (KN), 区区 (QQ), 地皮 (DB), 西区 (CQ), 披衣 (PE), 开开 (KK). A space makes each letter its
    // own Han token, which also gives it the CITATION tone — right for a spelled letter, since each is its
    // own prosodic word rather than a syllable inside one.
    //
    // ⚠ NOT FLANKED BY A LATIN LETTER OR DIGIT: `MP3`, `AODV-2`, `Qwen2.5-72B` and any CamelCase run are
    // alphanumeric CODES, and `core/roman.ts` encodes the same fact from its side (a numeral glued to a
    // digit is not a numeral). LAST in the file, after every rule that emits digits, so nothing this layer
    // itself wrote can be re-read as a code boundary.
    // ⚠ AND A LONE UPPERCASE LETTER, BUT ONLY TOUCHING HAN. `X光`, `地铁B线`, `A股`, `T恤` are letter-read in
    // every Chinese variety, while a bare single letter in a Latin context is a MATH VARIABLE or a chemical
    // symbol (`m = 2`, `f(x)`, `C 9 H 8 O 4`) and must not be. Han-adjacency separates them cleanly:
    // measured, the artifact has 6 Han-adjacent single uppercase letters and all 6 are letter-reads
    // (`P.C.亚历山大`, `里昂地铁B线`, `里昂地铁A线`, `C++原始码`, `ADS-B应答器`, `日本7&I控股公司`), while every
    // math/chemistry single letter in it is Latin-flanked and untouched. Han on one side, nothing
    // alphanumeric on the other.
    if (letterNames !== undefined)
        s = tr(s, 
            /(?<=\p{Script=Han})([A-Z])(?![\p{sc=Latn}\d])|(?<![\p{sc=Latn}\d])([A-Z])(?=\p{Script=Han})/gu,
            (m, a: string | undefined, b: string | undefined) => {
                const L = a ?? b!;
                return letterNames[L] === undefined ? m : ` ${letterNames[L]} `;
            },
        );
    if (letterNames !== undefined)
        s = tr(s, 
            /(?<![\p{sc=Latn}\d])[A-Z]{2,3}(?![\p{sc=Latn}\d])/gu,
            (run) =>
                /^[IVX]{2,3}$/u.test(run)
                    ? run
                    : ` ${[...run].map((c) => letterNames[c] ?? c).join(" ")} `,
        );

    return s;
}
