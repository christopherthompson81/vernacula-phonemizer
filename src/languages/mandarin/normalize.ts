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
 *
 * ── THE SIGN CLASSES ────────────────────────────────────────────────────────────────────────────
 *
 * ⚠ AN UNCLAIMED MATH SIGN IS DROPPED, NOT MISREAD, which is what makes it dangerous: `-5 度` reads as
 * 五度, **positive** five degrees, so a below-freezing temperature is silently reported as above it. A
 * dropped sign is invisible to every check that looks for a wrong reading.
 *
 * EVERY WORD BELOW IS ATTESTED IN ITS OWN NOTATION SLOT, from zh.wikipedia via
 * `tools/normalization/attest.ts` (cached in `tools/corpus/attest/cmn.jsonc`) and, for 乘以 and 平方, from
 * the FLEURS artifact itself. The attestations are quoted because the sense is the whole question — 加 and
 * 加上 both mean "plus" in a dictionary and only one of them is the operator:
 *
 *   =  等于    "任何数字与1相乘皆等于其本身"  ·  "一加一不等於二"
 *   <  小于    "呼吸频率（RR）小于每分钟30次"
 *   >  大于    "a > b ，即 a 大于 b"          — the article glosses the notation directly
 *   ×  乘以    "29¾ 英寸乘以 24½ 英寸" (cmn.jsonc)  ·  "0乘以任何实数都等于0（0×10=0）"
 *   ÷  除以    "總人口數除以總面積"
 *   +  加      "1+1是一個數學算式 … 1+1或一加一也可能指" — Wikipedia's own gloss OF `1+1`
 *   ±  正负    "直流正负800千伏" — a ±800 kV rating, the sign in a unit context
 *   -  负      "0非正非负" · "0的负数次方" — the negative-number morpheme
 *   -  零下    "经过零下40度高寒地带" — a −40° zone, and the reason temperature gets its OWN rule
 *
 * 加上 was the first candidate for `+`, on a wiki gloss of `1+0=1`. It is the wrong word: its own
 * attestations are the CONJUNCTION sense ("加上海外市場後" — "plus the overseas market, …"), and the
 * disambiguation page for `1+1` names the arithmetic reading 一加一. Availability is not correctness.
 */
import { MANIFEST } from "./manifest.ts";

/**
 * Western fraction notation → the Chinese order, still in digits: `a/b` → `b分之a`. Guarded against dates
 * and unit ratios by requiring digits on both sides and nothing numeric adjacent. `\b` is unusable here —
 * it is defined on ASCII word characters and finds no boundary against Han script — so the boundaries are
 * explicit lookarounds, the same discipline the Hindi pass needed.
 */
const FRACTION = /(?<![\d.,/])(\d{1,4})\/(\d{1,4})(?![\d/])/gu;

/**
 * THE TWO LEFT GUARDS, and why they differ — measured, not reasoned.
 *
 * Chinese is written WITHOUT SPACES, so the character before a negative is normally a Han letter: `气温-5度`
 * is a negative and the fleet's `(?<![\p{L}\p{Nd}])` refuses it. English can use `(^|[\s(])` because English
 * always has the space. So the first attempt here excluded only a preceding DIGIT or LATIN letter, on the
 * theory that a hyphenated code in Chinese prose is always one of those.
 *
 * THE CORPUS SAID NO. It writes the aircraft as **伊尔-76** — Il-76 with the *name* transliterated and the
 * designation left in digits — twice, and the character before the hyphen is Han. The relaxed guard read it
 * as 伊尔负76, "Il negative seventy-six". The Han-adjacent negative was my invention; 伊尔-76 is attested.
 *
 * The discrimination that survives is one of RIGHT context, not left: the temperature rule can afford the
 * loose guard because a DEGREE WORD follows it, and 伊尔-76 has none. So `BELOW_ZERO` reads Han-adjacent and
 * the general negative takes the fleet's strict guard, which costs a bare unspaced `气温-5` (no degree word)
 * and buys back the corpus sentence.
 */
const SIGN = "[-−–]";
const NEG_LEFT_STRICT = "(?<![\\p{L}\\p{Nd}-])";
const NEG_LEFT_LOOSE = "(?<![\\p{Nd}\\p{sc=Latn}-])";

/** TEMPERATURE first: before a degree word Chinese says 零下 ("below zero"), not 负. `°C` is still `°C`
 *  here — the shared symbol tier turns it into 摄氏度 after this layer runs — so the lookahead accepts the
 *  raw sign, the fullwidth forms, and the bare 度. */
const BELOW_ZERO = new RegExp(`${NEG_LEFT_LOOSE}${SIGN}(\\d+(?:[.,]\\d+)?)(?=\\s*(?:°|℃|℉|度))`, "gu");
const NEGATIVE = new RegExp(`${NEG_LEFT_STRICT}${SIGN}(?=\\d)`, "gu");

/** Sign → word, applied in order. `±` is its own code point, so it cannot be reached by the `+` arm. */
const SIGNS: readonly (readonly [RegExp, string])[] = [
    [/±\s?/gu, "正负"],
    [/\s?×\s?/gu, "乘以"],
    [/\s?÷\s?/gu, "除以"],
    [/\s?=\s?/gu, "等于"],
    [/\s?<\s?/gu, "小于"],
    [/\s?>\s?/gu, "大于"],
    // Both the spaced form and the attached one (`UTC+1` → UTC加1), matching the English rule's coverage.
    [/\s?\+\s?/gu, "加"],
];

/**
 * THE AMPERSAND, the one drop left after the signs above.
 *
 * The artifact's only `&` is `一众 B&B 公司` — "a number of B&B companies" — and it read as *bˈiː bˈiː*,
 * "B B". Between LATIN letters the ampersand stays inside the Latin run and is spelled ` and `, because the
 * whole token is an English term that the engine already delegates to English: reading half of `B&B` in
 * Mandarin would be a code-switch in the middle of a word. `AT&T` and `R&D` behave the same way.
 *
 * Elsewhere it becomes 和, the ordinary Chinese "and". No corpus sentence exercises that arm — it guards
 * against silence rather than fixing a measured reading, and is marked as such.
 */
const AMP_LATIN = /(?<=[A-Za-z])\s?[&＆]\s?(?=[A-Za-z])/gu;
const AMP_ELSEWHERE = /\s?[&＆]\s?/gu;

/**
 * A BARE exponent — `5³`, no unit — becomes 的立方 ("the cube of"), the same measure word the unit case uses.
 *
 * Requires a DIGIT before the exponent, which is what keeps it off `km²`: there the exponent follows the
 * unit's letters, and the unit case belongs to the shared tier's `exponentWords` (wired in mandarin.ts as
 * 平方/立方, which PRECEDE the unit — 平方公里).
 *
 * 的2次方 / 的3次方 WAS THE FIRST ATTEMPT and is the reason the word is spelled out instead. Emitting the
 * exponent as a DIGIT walked into the engine's own 两 rule: `5²` read as 五的**两**次方, and 两 is the
 * counting-two used before a measure word, never the two of an ordinal or a power (二次方). Writing 平方/立方
 * puts the reading beyond reach of any numeral rule, and reuses a word already attested for this language.
 */
const BARE_EXPONENT = /(?<=\d)([²³])/gu;
const POWER: Readonly<Record<string, string>> = { "²": "平方", "³": "立方" };

/** Spell a Latin run as its letter names, space-separated. See the two guards at the call sites. */
function spellLetters(run: string): string {
    return ` ${[...run].map((c) => MANIFEST.letterNames[c] ?? c).join(" ")} `;
}

export function normalizeMandarin(input: string): string {
    let s = input;
    // 1) FRACTION — the reordering the western notation needs.
    s = s.replace(FRACTION, (_m, num: string, den: string) => `${den}分之${num}`);
    // 2) NEGATIVES, temperature before the general case so 零下 wins where it applies.
    s = s.replace(BELOW_ZERO, "零下$1");
    s = s.replace(NEGATIVE, "负");
    // 3) The remaining signs.
    for (const [re, word] of SIGNS) s = s.replace(re, word);
    // 3b) The ampersand, Latin-internal arm first so the general arm cannot claim it.
    s = s.replace(AMP_LATIN, " and ");
    s = s.replace(AMP_ELSEWHERE, "和");
    // 4) A bare exponent, after the signs so nothing above can strand it.
    s = s.replace(BARE_EXPONENT, (_m, e: string) => `的${POWER[e]!}`);
    return s;
}

/**
 * INITIALISMS → their letter names, spelled in Han.
 *
 * ⚠ A SEPARATE PASS, AND IT MUST RUN AFTER THE SHARED SYMBOL TIER — which is why it is not a step inside
 * `normalizeMandarin`, where it started. The engine calls `SYMBOLS(normalizeMandarin(input))`, and the tier
 * reads the SCALE LETTER of a temperature: run first, this pass rewrote the ⟨C⟩ of `20°C` to 西 and the tier
 * could no longer see the unit at all. Caught by the corpus diff (摄氏度 → 度西), not by any probe.
 *
 * ⚠ THE WINDOW IS 2–3 LETTERS, NARROWED FROM 2–4 BY MEASUREMENT. At exactly four letters this corpus is
 * 9 of 16 tokens ENGLISH WORDS — FIFA ×7, BANK, SEAL — so a 4-letter rule spells more words than
 * initialisms, and the failure is loud: FIFA reads out as six letter names. At 2–3 the corpus is 27 tokens
 * over 24 forms with essentially no word contamination (US, IT, PC, CEO, UTC, NHK, NSW…). The cost is
 * asymmetric and that is the whole argument: a genuine 4-letter initialism left on the English reader
 * (ISSN, NPWS) still says the RIGHT LETTER NAMES in the wrong accent, while a spelled-out English word is
 * confidently unintelligible. Whether an acronym is a word or letters is a LEXICAL fact
 * (`core/initialisms.ts` says so), and Mandarin has no Latin lexicon here to decide it.
 *
 * ⚠ `[IVX]{2,3}` excluded — Roman numerals belong to `core/roman.ts`, which runs in the registry WRAPPING
 * text(), so what reaches here is what it declined. Not flanked by a Latin letter or digit, so an
 * alphanumeric CODE is not an acronym. And the letters are SPACE-SEPARATED because the front end segments
 * Han by greedy longest match: run together, 西欧 (CO) is "Western Europe" and 地区 (DQ) is "region".
 */
export function spellInitialisms(input: string): string {
    let s = input.replace(
        /(?<![\p{sc=Latn}\d])[A-Z]{2,3}(?![\p{sc=Latn}\d])/gu,
        (run) => (/^[IVX]{2,3}$/u.test(run) ? run : spellLetters(run)),
    );
    // A LONE uppercase letter, only where it touches Han — `X光`, `A股`, `T恤` are letter-read, while a bare
    // single letter in Latin context is a math variable or a chemical symbol (`f(x)`, `m = 2`).
    s = s.replace(
        /(?<=\p{Script=Han})([A-Z])(?![\p{sc=Latn}\d])|(?<![\p{sc=Latn}\d])([A-Z])(?=\p{Script=Han})/gu,
        (m, a: string | undefined, b: string | undefined) => {
            const L = a ?? b!;
            return MANIFEST.letterNames[L] === undefined ? m : ` ${MANIFEST.letterNames[L]} `;
        },
    );
    return s;
}
