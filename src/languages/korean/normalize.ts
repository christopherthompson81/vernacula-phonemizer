/**
 * Korean (ko) text normalization — the pre-tokenizer pass that rewrites everything which is not already
 * readable by the Hangul engine into Hangul the pipeline speaks. Pure text→text; no IPA.
 *
 * FOUR THINGS CARRY THIS FILE.
 *
 * ⚠ 1. THE NUMBER–COUNTER BOUNDARY IS WHERE KOREAN SANDHI LIVES. korean.ts tokenizes
 *    `([가-힣]+)|(\d+)|…`, so `17일` becomes TWO tokens phonemized alone — and the liaison is lost: 17일 is
 *    [ɕip̚t͡ɕʰiɾiɭ] (십치릴), where the ㄹ of 칠 resyllabifies into 일, but split it reads `sˈip̚t͡ɕʰiɭ ˈiɭ`.
 *    Same for 100년 [pɛŋnjʌn] (ㄱ→ŋ before ㄴ) and 6개월 [juk̚k͈ɛwʌl] (tensification). Rule 8 spells the digits
 *    as Hangul and JOINS them to the counter, putting the boundary back inside one token where g2p.ts's
 *    cross-syllable sandhi can see it.
 *
 * ⚠ 2. NATIVE vs SINO-KOREAN NUMERALS, and WHICH SERIES A NUMERAL TAKES IS A PROPERTY OF THE COUNTER.
 *    numbers.ts is Sino-only (일 이 삼 …), which is right for dates, money, minutes and measures and FLATLY
 *    WRONG for the counters taking the native series: 3명 is 세 명, not 삼 명; 11시 is 열한 시, not 십일 시.
 *    So rule 7 lists only the counters actually attested. ⚠ 개 is guarded against 개월 and 개국, which are
 *    Sino (육 개월, 칠 개국) and would otherwise be corrupted into 여섯 개월 / 일곱 개국. ⚠ And ≥100 is Sino
 *    for EVERY counter.
 *
 * ⚠ 3. EMBEDDED LATIN ROUTES TO THE ENGLISH PHONEMIZER, which is a sound default for an engine that would
 *    otherwise DROP the run and wrong here: FBI → [ˈɛfbˈiːʲˈaᶦ], CCTV → [sˈiːsiːtʰˈiːvˌiː] — æ, ɹ, v, f and
 *    the English diphthongs inside an utterance whose inventory has none of them. A Korean reader says an
 *    initialism as its HANGUL LETTER NAMES (FBI is 에프비아이), so rule 9 emits those.
 *    Letter-spelling is a safe DEFAULT because it is always available; the word-read acronyms (UN 유엔,
 *    NATO 나토) are LEXICAL and live in a short list. Same split as core/initialisms.ts, polarity flipped.
 *    ⚠ MIXED-CASE Latin is deliberately NOT converted — proper nouns and loanwords whose Hangul is lexical
 *    and unguessable from spelling. Lowercase single letters keep the fallback too.
 *
 * ⚠ 4. GROUPED THOUSANDS. The comma is in korean.jsonc's clausePunctuation, so `1,000명` is a PHRASE BREAK
 *    plus a second number: `ˈiɭ , ˈjɘŋ mˈjɘŋ`, "one, zero people". Rule 1, first, for that reason.
 *
 * ⚠ WHAT IS DELIBERATELY LEFT: the ASCII hyphen. It is a range (1995-1996년, 56-64 km/h), a sports SCORE
 * (5-3으로 이긴, which Korean reads 오 대 삼 and not 오에서 삼), and the internal hyphen of COVID-19 / XDR-TB /
 * 슈퍼-G. Too overloaded to claim, so it keeps its current dropped behaviour.
 */
import { digitIndex } from "../../core/numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";
import { rewrite } from "../../core/provenance.ts";

const NATIVE = MANIFEST.numbers.native;

/**
 * A native-Korean numeral 1–99 in its PRENOMINAL form — the form a counter takes, which is not the
 * citation form: 하나/둘/셋/넷 become 한/두/세/네 before a counter, and 20 alone is 스무 (스물 only when
 * a ones digit follows: 스물한 명). Above 99 there is no native series at all and Sino is what a reader
 * says, which is why callers gate on n ≤ 99.
 */
function nativeNumeral(n: number): string {
    const t = Math.floor(n / 10), u = n % 10;
    if (t === 2 && u === 0) return NATIVE.twenty;
    return (NATIVE.tens[t] ?? "") + (NATIVE.ones[u] ?? "");
}

/**
 * The counters that take the NATIVE series, exactly as attested in ko_kr — 명 ×42, 개 ×28, 시 ×12,
 * 시간 ×6, 번째 ×4, 마리 ×4, 살 ×4, 번 ×3, 가지 ×2, 척 ×2, 사람 ×1.
 *
 * ORDER INSIDE THE ALTERNATION IS LOAD-BEARING. 번째 must precede 번 and 시간 must precede 시, or the
 * shorter counter claims the first syllable of the longer one and leaves 째 / 간 stranded as a word.
 * 시 additionally excludes a following 드 or 속 — the corpus's 제5시드국 ("5th seed") and the 시속 that
 * rule 2 emits, in neither of which 시 is a counter — and 개 excludes 개월 ×8 / 개국 ×4, which take the
 * SINO series (육 개월, 칠 개국) and
 * would have been corrupted into 여섯 개월 / 일곱 개국.
 *
 * 번 is the one entry the corpus does not settle cleanly: two of its three instances are the "times"
 * counter that is unambiguously native (24번 이상 스물네 번, 60번 이상 예순 번) and the third is
 * 11번 우주인, a DESIGNATION, which is Sino (십일 번). Nothing on the surface separates them, so the
 * majority reading is taken and the designation is a known miss rather than a silent one.
 */
const NATIVE_COUNTER =
    /(?<![\d.,])(\d{1,2})\s?(명|번째|번|시간|시(?![간드속])|개(?![월국])|마리|살|가지|척|사람)/gu;

/**
 * Unit abbreviation → its Hangul word. These live HERE rather than in korean.ts's shared symbol tier
 * (makeSymbolNormalizer) for the same reason Japanese owns its table: that tier matches a unit only when
 * a NUMBER is directly adjacent, and rule 5 (ranges) and rule 6 (decimals) both destroy that adjacency,
 * so the unit rewrite has to run before them. It also has to emit the unit JOINED to the number for
 * rule 8, which the shared tier cannot do — it always inserts a space.
 *
 * Matched CASE-SENSITIVELY, which is the point: an uppercase run is an initialism, not a unit. The SI
 * abbreviations are always written lowercase, so nothing is lost. `m` and `mi` are the ones the corpus
 * proved were missing — 83m came out `ˈɛm` (the English letter M) and 50 mi came out `ˈɛmɑː`.
 *
 * `g`, `l` and `t` are DELIBERATELY ABSENT. Korean glues its particles straight onto the abbreviation
 * (83m이고, 2~3km의), so the rule below cannot use Japanese's "not followed by a letter" guard, and
 * without it a one-letter unit key starts matching things that are not units: all three of this
 * corpus's digit-adjacent `g`s are 802.11g, a Wi-Fi standard, which would have become 802.11그램.
 */
const UNIT_HANGUL: Readonly<Record<string, string>> = {
    km: "킬로미터", cm: "센티미터", mm: "밀리미터", nm: "나노미터", m: "미터",
    kg: "킬로그램", mg: "밀리그램", ha: "헥타르", ml: "밀리리터", mi: "마일", ft: "피트",
};
/** Longest first, so km is not read as k + m and mm is not read as m + m. */
const UNIT_ALT = Object.keys(UNIT_HANGUL).sort((a, b) => b.length - a.length).join("|");

/** Latin letter → its Hangul name. The 26 are fixed and uncontroversial in everyday Korean use. */
const LETTER_HANGUL: Readonly<Record<string, string>> = {
    A: "에이", B: "비", C: "씨", D: "디", E: "이", F: "에프", G: "지",
    H: "에이치", I: "아이", J: "제이", K: "케이", L: "엘", M: "엠", N: "엔",
    O: "오", P: "피", Q: "큐", R: "알", S: "에스", T: "티", U: "유",
    V: "브이", W: "더블유", X: "엑스", Y: "와이", Z: "제트",
};

/**
 * Acronyms Korean reads as a WORD rather than as letters — a lexical fact, so this list holds only
 * established ones. Anything absent falls through to letter-spelling, which is always a legitimate
 * Korean reading and therefore a safe default: WHO is 더블유에이치오, not a guess at a word reading.
 */
const WORD_ACRONYM: Readonly<Record<string, string>> = {
    UN: "유엔", NATO: "나토", NASA: "나사", UNESCO: "유네스코", UNICEF: "유니세프",
    ASEAN: "아세안", OPEC: "오펙", AIDS: "에이즈", FIFA: "피파", COVID: "코비드",
};

/** One all-caps Latin run → Hangul: the listed word reading if it has one, else its letter names,
 *  joined, because a Korean acronym is written and said as a single word (FBI 에프비아이). The internal
 *  hyphen of XDR-TB is the only character that reaches here without a name; it is dropped. */
function spell(run: string): string {
    const word = WORD_ACRONYM[run];
    if (word !== undefined) return word;
    let out = "";
    for (const ch of run) out += LETTER_HANGUL[ch] ?? "";
    return out === "" ? run : out;
}

/** Normalize one Korean input string. Pure text→text; every rule emits Hangul or ASCII digits and lets
 *  the existing engine do the pronouncing. */
export function normalizeKorean(input: string): string {
    // 1) COMMA-GROUPED THOUSANDS (×33), FIRST — the comma is clause punctuation here, so 1,000명 was a
    //    phrase break plus a second number ("일 , 영 명"). It also has to precede rules 7 and 8, which
    //    key on a digit run being adjacent to its counter: 24,000개 is one number, not 24 then 000개.
    //    Only a comma with exactly three digits after it and no fourth is grouping. Looped, so
    //    1,000,000 collapses across both separators.
    let s = input;
    for (let prev = ""; prev !== s; ) {
        prev = s;
        s = rewrite(s, /(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?!\d))/gu, "");
    }

    // 2) SPEED UNITS, before rule 5 splits a range. Korean puts 시속 / 초속 ("per hour" / "per second")
    //    BEFORE the number, so this has to claim the WHOLE range in one match — 35-40 mph must become
    //    시속 35-40마일 and not 35에서 시속 40마일, which is what running it after the range rule gives.
    //    The trailing guard is `[A-Za-z\d]`, NOT Japanese's `\p{L}` — Korean writes its particle
    //    directly onto the abbreviation (83km/h의), and a letter-class guard rejects exactly those.
    //    An ALREADY PRESENT 시속 / 초속 is CONSUMED by the match rather than blocked by a lookbehind.
    //    ⚠ The same duplicate-word trap Arabic's الساعة poses, and the first draft got it wrong in the
    //    instructive way: a `(?<!시속\s)` guard on 시속 160km/h merely pushed the match one digit to the
    //    right, so it matched `60km/h` and produced 시속 1시속 60킬로미터 — a duplicated adverb AND a
    //    severed number. Consuming it cannot do that. The leading `(?<![\d.])` is the other half: it
    //    stops any of these three from starting in the middle of a number.
    const SPAN = "\\d[\\d.]*(?:\\s?[-–—~〜～]\\s?\\d[\\d.]*)?";
    const speed = (unit: string, prefix: string, word: string): void => {
        s = rewrite(s, new RegExp(`(?<![\\d.])(?:${prefix}\\s?)?(${SPAN})\\s?(?:${unit})(?![A-Za-z\\d])`, "gu"),
            `${prefix} $1${word}`);
    };
    speed("mph", "시속", "마일");
    speed("kph|km/h", "시속", "킬로미터");
    speed("m/s", "초속", "미터");

    // 3) UNITS, while a digit is still adjacent and the number is still plain ASCII — see UNIT_HANGUL
    //    for why this cannot be left to the shared symbol tier. Any space is CONSUMED, joining the unit
    //    to the number so rule 8 can spell them as one word (20km → 이십킬로미터, one sandhi domain).
    //    A trailing 2 is the corpus's mm2, an ASCII-typed square; 제곱 is the word it is already using
    //    elsewhere in the same corpus (제곱미터, 제곱 마일), so the exponent is consumed here rather
    //    than left stranded after the unit is claimed.
    s = rewrite(s, new RegExp(`(?<=\\d)\\s?(${UNIT_ALT})([²³2-3])?(?![A-Za-z\\d])`, "gu"),
        (_m, unit: string, exp?: string) =>
            `${exp === undefined ? "" : exp === "³" || exp === "3" ? "세제곱" : "제곱"}${UNIT_HANGUL[unit]!}`);


    // 4) DEGREES, before rule 9 — the C of 30°C is otherwise a single capital letter and rule 9 would
    //    spell it 씨. 섭씨 / 화씨 are the Korean names for the two scales and precede the number.
    // ⚠ THE SCALE NAME PRECEDES THE SIGNED NUMBER, NOT THE SIGN, so the sign is captured and carried across
    //. This rule REORDERS — it lifts 섭씨 in front of the number — and without the capture it lifted
    //    the scale name over the sign as well: `-5 °C` became `-섭씨 5도`, stranding the minus where the sign
    //    rules below can no longer see a digit after it, and reading `마이너스 섭씨 오도` ("minus Celsius five
    //    degrees") once they were taught to. Carrying it gives 섭씨 마이너스 오도, which is the Korean order.
    //    This is the ordering rule the sign work keeps rediscovering: a rule that consumes a sign next to an
    //    operand must run before — or be taught about — any rule that MOVES that operand.
    // THE TRAILING GUARD MUST REJECT A LATIN LETTER, NOT ANY LETTER. Korean spaces its eojeol but not
    // its particles, so a temperature is normally followed by one — and `(?![\p{L}])` rejected exactly that:
    // `20℃` read 섭씨 20도 while `20℃에` read "20도씨에", losing 섭씨 and spelling the C as 씨 through rule 9.
    // The corpus's own instance is `32℃에 달하는` (×3), so the ordinary case was the broken one.
    s = rewrite(s, /([-−–±]?)(\d+)\s?°\s?C(?![\p{sc=Latn}\p{M}])/gui, "섭씨 $1$2도");
    s = rewrite(s, /([-−–±]?)(\d+)\s?°\s?F(?![\p{L}\p{M}])/gui, "화씨 $1$2도");
    s = rewrite(s, /(\d)\s?°/gu, "$1도");

    //     ⚠ AND `+`, `−`, `±` WERE DROPPED OUTRIGHT TOO — pre-existing, and found while checking this rule's
    //     output on `3 + 4 = 7`. Korean had no rule for any additive sign, so `3 + 4` read 삼 사, two bare
    //     numbers, and `-5` read as plain 오 with the sign inverted away. The same article that glosses the
    //     division and equality expressions also names these two — 「덧셈과 뺄셈」, 「더하기표와 빼기표」 — so they
    //     cost no additional sourcing.
    //
    //     AFTER the relational rules, deliberately: those match digits on both sides, so `3 + 4 = 7` must have
    //     its `= 7` consumed first. The result reads 삼 더하기 사는 칠과 같다, which is the school register.
    //     ⚠ THE TWO REGISTERS ARE NOT INTERCHANGEABLE, and Korean keeps them apart: 더하기 / 빼기 are the
    //     OPERATORS (three plus four), 플러스 / 마이너스 the SIGNS (minus five degrees). So the additive rule
    //     below uses 더하기 while the negative rule uses 마이너스, and ± — which is a sign and not an operation —
    //     juxtaposes the loan pair. ⚠ ± NEEDS ITS OWN RULE: it is a single character (U+00B1), not a `+`,
    //     so no `+` rule can match inside it and the sign would otherwise be dropped in silence.
    s = rewrite(s, /±/gu, " 플러스 마이너스 ");
    s = rewrite(s, /(\d)\s?\+\s?(?=\d)/gu, "$1 더하기 ");
    //     The LEADING plus is the sign, not the operation, so it takes 플러스 (`+5` → 플러스 5) — the same
    //     operator/sign split as the pair above.
    s = rewrite(s, /(^|[\s(])\+\s?(?=\d)/gu, "$1플러스 ");
    s = rewrite(s, /(^|[\s(])[-−–](?=\d)/gu, "$1마이너스 ");

    // 4b) RELATIONAL AND DIVISION SIGNS. ko.wikipedia's arithmetic articles read the notation out beside
    //     the notation, which is the article class this issue's tier 4 looks for:
    //
    //       "3을 4로 나눈 몫 3 ÷ 4(3 나누기 4)"          — the ÷ expression glossed, and INFIX
    //       "제곱은 근과 같다 (ax2 = bx)"                 — the = expression glossed, and POSTPOSED
    //       "1보다 무한소만 작다"  ·  "37보다 크거나 같은"   — the comparisons, also postposed
    //       "등호(=)를 사용하기 시작하였다"                 — names the sign, which is not the same as reading it
    //
    //     ⚠ SO ONLY THE DIVISION SIGN IS INFIX. Korean is verb-final: `A = B` is 「A는 B와 같다」 and `A < B` is
    //     「A는 B보다 작다」, with the predicate after both operands. Substituting between them the way the
    //     European rules in this issue do would produce word salad, so these three consume BOTH operands.
    //
    //     ⚠ AND THE PARTICLES ARE ALLOMORPHIC ON THE SPELLED NUMBER, WHICH IS WHY THIS RULE SPELLS ITS OWN
    //     OPERANDS. 는/은 and 와/과 are selected by whether the preceding syllable has a final consonant, and
    //     that is a property of the WORD, not the digit: 7 → 칠 (final ㄹ, so 은) but 4 → 사 (no final, so 는).
    //     The digit-to-word pass runs later and could not fix a particle already chosen wrongly, so the rule
    //     calls `numberToWords` itself and picks the allomorph from the result's last jamo.
    //
    //     ⚠ AN OPERAND IS A NUMBER, A HANGUL WORD, OR A LONE LATIN LETTER — the three things that appear either
    //     side of these signs, and all three have to be spelled HERE so the particle can be chosen. The Latin
    //     case is why `x = y` is in scope at all: rule 9 below converts only UPPERCASE Latin, so a lowercase
    //     variable name never becomes Hangul and there would be no syllable to test. `LETTER_HANGUL` already
    //     holds the letter names this file emits, so the operand spells through the same table (x → 엑스).
    //
    //     Anything else — a parenthesis, a longer Latin word, a formula — leaves the sign dropped, as before.
    //     The postposed clause cannot be built without knowing both operands, and a rule that is right about
    //     what it claims beats a total rule that garbles the rest.
    const OPERAND = String.raw`\d+|[가-힣]+|[A-Za-z]`;
    const kWord = (t: string): string =>
        /^\d+$/u.test(t) ? (numberToWords(Number(t)) || t) : (LETTER_HANGUL[t.toUpperCase()] ?? t);
    /** Does this word end in a closed syllable? Decodes the Hangul syllable block: T = (code − AC00) % 28. */
    const kClosed = (w: string): boolean => {
        const c = w.codePointAt(w.length - 1) ?? 0;
        return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
    };
    const kTopic = (w: string): string => `${w}${kClosed(w) ? "은" : "는"}`;
    const relational = (sign: string, tail: (y: string) => string): void => {
        s = rewrite(s, new RegExp(`(${OPERAND})\\s?${sign}\\s?(${OPERAND})`, "gu"),
            (_m, a: string, b: string) => `${kTopic(kWord(a))} ${tail(kWord(b))}`);
    };
    relational("=", (y) => `${y}${kClosed(y) ? "과" : "와"} 같다`);
    relational("<", (y) => `${y}보다 작다`);
    relational(">", (y) => `${y}보다 크다`);
    s = rewrite(s, /\s?÷\s?/gu, " 나누기 ");

    //     THE AMPERSAND, which was dropped outright, is not an arithmetic sign and is not Korean: it is a
    //     Latin-script printing ligature, and in Korean text it occurs only inside a Latin run — R&B, P&R.
    //     So its reading is a LOAN and not native vocabulary, which is why it is 앤드 rather than the native
    //     conjunction 및. `ja` already ships exactly this (`&` → アンド), so the fleet has the precedent and the
    //     register question is settled by it.
    s = rewrite(s, /\s?&\s?/gu, " 앤드 ");


    // 5) RANGES (×12 for these three marks). The mark is in no table, so it was dropped outright and
    //    1894~1895 read as two bare years. 에서 is the standard reading of 물결표 between two numbers.
    //    After rule 2 (see there) and after rule 1, so a grouped endpoint is already one number.
    s = rewrite(s, /(?<=\d)\s?[~〜～–—]\s?(?=\d)/gu, "에서 ");

    // 6) DECIMALS (×10). The point is clause punctuation too, so 1.5 broke into "일 . 오" — a sentence
    //    boundary inside a number. Korean says 점 and then the fractional digits INDIVIDUALLY (7.75 is
    //    칠 점 칠오, never 칠 점 칠십오, which is what the number path produced), and the whole thing is
    //    emitted as Hangul so rule 8 leaves it alone.
    s = rewrite(s, /(?<![\d.])(\d+)\.(\d+)(?![\d.])/gu, (_m, int: string, frac: string) =>
        `${numberToWords(Number(int))}점${[...frac].map((d) => MANIFEST.numbers.ones[digitIndex(d)]!).join("")}`);

    // 7) NATIVE-SERIES COUNTERS, before rule 8 claims the digits for the Sino series. Gated at 99
    //    because the native numerals stop there (아흔아홉) and ≥100 is Sino for every counter: 100명 is
    //    백 명, and the corpus has 116명, 168명, 200명, 2,400명 among them. JOINED for the same reason as
    //    rule 8 — 맞춤법 spaces a counter, but the numeral and its counter are one phonological word and
    //    the sandhi runs across the boundary: 열 시 is [jʌɭɕ͈i] (열씨) and 다섯 개 is [tasʌt̚k͈ɛ]
    //    (다섣깨), neither of which the engine can produce from two separately phonemized tokens.
    s = rewrite(s, NATIVE_COUNTER, (m, num: string, counter: string) => {
        const n = Number(num);
        return n >= 1 && n <= 99 ? `${nativeNumeral(n)}${counter}` : m;
    });

    // 8) A DIGIT RUN DIRECTLY FOLLOWED BY HANGUL → Sino-Korean words, JOINED. The largest change in this
    //    file; see the header for why the split tokens lost the sandhi that carries the boundary. Only
    //    an ADJACENT Hangul character triggers it: a digit before a space, a bracket or a Latin letter
    //    keeps going through korean.ts's number path exactly as before.
    //    WHAT JOINING COSTS, measured rather than assumed: g2p.ts's lexical-tensification list
    //    (tensification.tsv) is keyed on the WHOLE word, so a number word fused to its counter no
    //    longer matches it. Of the 619 digit-runs this rule claims, exactly 15 produced a word that was
    //    in that list — 13 of them 백, whose entry marks it TENSE and is the loanword 백 (bag), not the
    //    number, so those 13 are FIXED by the fusion; the two real losses are 팔십 [pʰaɭs͈ip̚]. Net
    //    positive by an order of magnitude, which is why the fusion stands.
    //    The month irregulars are the one place where the Sino series itself changes shape — 6월 is
    //    유월 and 10월 is 시월, never 육월 / 십월 — so they are spelled here rather than composed
    //    (×4 and ×7 in the corpus). 16월 does not exist, but the lookbehind keeps 16 out of it anyway.
    s = rewrite(rewrite(s, /(?<!\d)6월/gu, "유월"), /(?<!\d)10월/gu, "시월");
    s = rewrite(s, /(\d+)(?=[가-힣])/gu, (m, num: string) => {
        const w = numberToWords(Number(num));
        return w === "" ? m : w; // out of safe-integer range: leave the digits for the number path
    });

    // 9) LATIN INITIALISMS → Hangul letter names, LAST, so rules 2–4 still see the ASCII they match on
    //    (the unit table is lowercase-keyed and the degree rule consumes its own C / F before this runs).
    //    Bounded by explicit letter lookarounds — never \b, which would also fire between a letter and a
    //    Hangul syllable — so a mixed-case word is untouched: ZMapp's ZM fails the trailing lookahead.
    //    The second alternative is the isolated capital (×57 in the corpus: H5N1, 슈퍼-G, W. 부시).
    //    ⚠ THE BOUNDARY IS ALL OF LATIN, not `[A-Za-z]`. An ASCII-only lookaround does not see an accented
    //    letter as a letter, so the `S` of `São` passed the isolated-capital test and was spelled out as a
    //    LETTER NAME with the rest of the name left behind: `São` → *esu / ˈʌɔː*.
    return rewrite(s, /(?<![\p{Script=Latin}\p{M}])[A-Z][A-Z-]*[A-Z](?![\p{Script=Latin}\p{M}])|(?<![\p{Script=Latin}\p{M}])[A-Z](?![\p{Script=Latin}\p{M}])/gu, spell);
}
