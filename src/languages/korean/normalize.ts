/**
 * Korean (ko) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * readable by the Hangul engine into Hangul the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Measured over the ko_kr FLEURS corpus, 1,746 deduplicated utterances, column 3 (the cased one):
 * embedded Latin ×601 instances in 293 utterances (115 all-caps runs / 77 distinct, 57 single letters,
 * the rest mixed-case proper nouns), a digit directly followed by a Hangul counter ×~430, 년 ×149,
 * 월 ×62, 일 ×33, 명 ×42, 세기 ×24, 개 ×28, comma-grouped thousands ×33, 개월 ×8, 시 (clock) ×12,
 * 분 ×12, 시간 ×6, 번째 ×4, ranges ×19 (12 of them ~ / –), decimals ×10, %  ×11, $ ×2, ° ×2,
 * unit abbreviations after a digit ×~50 (km ×20, mm ×10, m ×6, cm ×4, mph ×3, mi ×2, km/h ×2, m/s ×1).
 *
 * FOUR DEFECTS DOMINATE, in this order.
 *
 * 1. THE NUMBER–COUNTER BOUNDARY. korean.ts tokenizes `([가-힣]+)|(\d+)|…`, so `17일` becomes two
 *    tokens and each is phonemized ALONE. Korean's sandhi is what carries the boundary: 17일 is
 *    [ɕip̚t͡ɕʰiɾiɭ] (십치릴) — the ㄹ of 칠 resyllabifies into 일 — and the split output was
 *    `sˈip̚t͡ɕʰiɭ ˈiɭ`, two words with no liaison at all. Same for 100년 [pɛŋnjʌn] (백년, ㄱ→ŋ before
 *    ㄴ) which came out `p͈ˈɛk̚ nˈjɘn`, and 6개월 [juk̚k͈ɛwʌl] (육깨월, tensification) which came out
 *    `ˈjuk̚ kɛˈwɘɭ`. Rule 8 spells the digits as Hangul and JOINS them to the counter, which puts the
 *    boundary back inside one token where g2p.ts's cross-syllable sandhi can see it. This is why the
 *    corpus diff moves ~430 utterances: it is one rule, and it is the whole reason Korean needed this
 *    layer more than a language whose numbers are already spaced words.
 *
 * 2. NATIVE vs SINO-KOREAN NUMERALS. numbers.ts is Sino-only (일 이 삼 …), which is right for dates,
 *    money, minutes and measures and FLATLY WRONG for the counters that take the native series: 3명 is
 *    세 명, not 삼 명; 11시 is 열한 시, not 십일 시. Which series a numeral takes is a property of the
 *    COUNTER, so rule 7 carries the counters the corpus actually attests and nothing else. The corpus is
 *    also what excluded 대: all seven instances are Sino (20대 "the twenties", 21 대 20 a score, 4대 왕,
 *    300대의 객차 — and ≥100 is Sino for every counter anyway), so the vehicle counter 두 대 that a
 *    grammar would list is simply not what this corpus contains, and guessing it in would have been the
 *    one change with no evidence behind it. 개 is likewise guarded against 개월 ×8 and 개국 ×4, which
 *    are Sino (육 개월, 칠 개국) and would have been corrupted into 여섯 개월 / 일곱 개국.
 *
 * 3. EMBEDDED LATIN → THE ENGLISH PHONEMIZER. core/foreign.ts is a sound default for an engine that
 *    would otherwise DROP the run, but in a Korean IPA stream it injects phonemes Korean has no
 *    inventory for: FBI → [ˈɛfbˈiːʲˈaᶦ], CCTV → [sˈiːsiːtʰˈiːvˌiː], MRI → [ˌɛmɑːɹˈaᶦ]. That is æ, ɹ, v,
 *    f and the English diphthongs inside an utterance whose inventory has none of them. A Korean reader
 *    says an initialism as its HANGUL LETTER NAMES — FBI is 에프비아이 — so rule 9 emits those and the
 *    ordinary engine speaks them natively. Letter-spelling is always an available Korean reading, so it
 *    is a safe default for an unknown all-caps run; the acronyms read as WORDS (UN 유엔, NATO 나토) are
 *    LEXICAL facts and live in a short list of established ones, not invented for the corpus's long
 *    tail. Same lexical-vs-OOV split as core/initialisms.ts, with the polarity flipped.
 *
 *    MIXED-CASE Latin (413 instances / 345 distinct — Atlanta, ZMapp, TogiNet, Hesperonychus…) is
 *    deliberately NOT converted. Those are proper nouns and loanwords whose Hangul is lexical and
 *    unguessable from spelling, and they keep the English fallback until there is a sourced loanword
 *    lexicon. Lowercase single letters (c, g, r, e — the corpus discusses their spelling) keep it too.
 *
 * 4. GROUPED THOUSANDS ×33. The comma is in korean.jsonc's clausePunctuation, so 1,000명 was a PHRASE
 *    BREAK plus a second number: `ˈiɭ , ˈjɘŋ mˈjɘŋ` — "one, zero people". Rule 1, first, for that reason.
 *
 * WHAT IS DELIBERATELY LEFT. The ASCII hyphen: five of its digit-flanked instances are 1995-1996년,
 * 35-40 mph, 56-64 km/h, 10 - 11시 — and 5-3으로 이긴, a sports score, which Korean reads 오 대 삼, not
 * 오에서 삼. The same character is also the internal hyphen of COVID-19 / XDR-TB / 슈퍼-G. Four range
 * instances are not enough to claim a mark that overloaded, so `-` keeps its current behaviour (dropped)
 * and only the unambiguous ~ – — are read. The slash likewise: 11 of its 14 instances are 및/또는
 * ("and/or") or a compound like 왕복/연결, not a fraction — the corpus's fractions are already written
 * out as 분의 — so no fraction rule exists here. °W (×1) keeps its bare 도 rather than gaining 서경,
 * and mph/km/h gain 시속 but no per-hour word, because inventing a reading is worse than a plain one.
 */
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";

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
        s = s.replace(/(\d),(\d{3})(?!\d)/gu, "$1$2");
    }

    // 2) SPEED UNITS, before rule 5 splits a range. Korean puts 시속 / 초속 ("per hour" / "per second")
    //    BEFORE the number, so this has to claim the WHOLE range in one match — 35-40 mph must become
    //    시속 35-40마일 and not 35에서 시속 40마일, which is what running it after the range rule gives.
    //    The trailing guard is `[A-Za-z\d]`, NOT Japanese's `\p{L}` — Korean writes its particle
    //    directly onto the abbreviation (83km/h의), and a letter-class guard rejects exactly those.
    //    An ALREADY PRESENT 시속 / 초속 is CONSUMED by the match rather than blocked by a lookbehind.
    //    That is the Arabic الساعة lesson from the playbook, and the first draft got it wrong in the
    //    instructive way: a `(?<!시속\s)` guard on 시속 160km/h merely pushed the match one digit to the
    //    right, so it matched `60km/h` and produced 시속 1시속 60킬로미터 — a duplicated adverb AND a
    //    severed number. Consuming it cannot do that. The leading `(?<![\d.])` is the other half: it
    //    stops any of these three from starting in the middle of a number.
    const SPAN = "\\d[\\d.]*(?:\\s?[-–—~〜～]\\s?\\d[\\d.]*)?";
    const speed = (unit: string, prefix: string, word: string): void => {
        s = s.replace(new RegExp(`(?<![\\d.])(?:${prefix}\\s?)?(${SPAN})\\s?(?:${unit})(?![A-Za-z\\d])`, "gu"),
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
    s = s.replace(new RegExp(`(?<=\\d)\\s?(${UNIT_ALT})([²³2-3])?(?![A-Za-z\\d])`, "gu"),
        (_m, unit: string, exp?: string) =>
            `${exp === undefined ? "" : exp === "³" || exp === "3" ? "세제곱" : "제곱"}${UNIT_HANGUL[unit]!}`);

    // 4) DEGREES, before rule 9 — the C of 30°C is otherwise a single capital letter and rule 9 would
    //    spell it 씨. 섭씨 / 화씨 are the Korean names for the two scales and precede the number.
    // THE TRAILING GUARD MUST REJECT A LATIN LETTER, NOT ANY LETTER (#586). Korean spaces its eojeol but not
    // its particles, so a temperature is normally followed by one — and `(?![\p{L}])` rejected exactly that:
    // `20℃` read 섭씨 20도 while `20℃에` read "20도씨에", losing 섭씨 and spelling the C as 씨 through rule 9.
    // The corpus's own instance is `32℃에 달하는` (×3), so the ordinary case was the broken one.
    s = s.replace(/(\d+)\s?°\s?C(?![\p{sc=Latn}\p{M}])/gu, "섭씨 $1도");
    s = s.replace(/(\d+)\s?°\s?F(?![\p{L}\p{M}])/gu, "화씨 $1도");
    s = s.replace(/(\d)\s?°/gu, "$1도");

    // 5) RANGES (×12 for these three marks). The mark is in no table, so it was dropped outright and
    //    1894~1895 read as two bare years. 에서 is the standard reading of 물결표 between two numbers.
    //    After rule 2 (see there) and after rule 1, so a grouped endpoint is already one number.
    s = s.replace(/(?<=\d)\s?[~〜～–—]\s?(?=\d)/gu, "에서 ");

    // 6) DECIMALS (×10). The point is clause punctuation too, so 1.5 broke into "일 . 오" — a sentence
    //    boundary inside a number. Korean says 점 and then the fractional digits INDIVIDUALLY (7.75 is
    //    칠 점 칠오, never 칠 점 칠십오, which is what the number path produced), and the whole thing is
    //    emitted as Hangul so rule 8 leaves it alone.
    s = s.replace(/(?<![\d.])(\d+)\.(\d+)(?![\d.])/gu, (_m, int: string, frac: string) =>
        `${numberToWords(Number(int))}점${[...frac].map((d) => MANIFEST.numbers.ones[Number(d)]!).join("")}`);

    // 7) NATIVE-SERIES COUNTERS, before rule 8 claims the digits for the Sino series. Gated at 99
    //    because the native numerals stop there (아흔아홉) and ≥100 is Sino for every counter: 100명 is
    //    백 명, and the corpus has 116명, 168명, 200명, 2,400명 among them. JOINED for the same reason as
    //    rule 8 — 맞춤법 spaces a counter, but the numeral and its counter are one phonological word and
    //    the sandhi runs across the boundary: 열 시 is [jʌɭɕ͈i] (열씨) and 다섯 개 is [tasʌt̚k͈ɛ]
    //    (다섣깨), neither of which the engine can produce from two separately phonemized tokens.
    s = s.replace(NATIVE_COUNTER, (m, num: string, counter: string) => {
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
    s = s.replace(/(?<!\d)6월/gu, "유월").replace(/(?<!\d)10월/gu, "시월");
    s = s.replace(/(\d+)(?=[가-힣])/gu, (m, num: string) => {
        const w = numberToWords(Number(num));
        return w === "" ? m : w; // out of safe-integer range: leave the digits for the number path
    });

    // 9) LATIN INITIALISMS → Hangul letter names, LAST, so rules 2–4 still see the ASCII they match on
    //    (the unit table is lowercase-keyed and the degree rule consumes its own C / F before this runs).
    //    Bounded by explicit letter lookarounds — never \b, which would also fire between a letter and a
    //    Hangul syllable — so a mixed-case word is untouched: ZMapp's ZM fails the trailing lookahead.
    //    The second alternative is the isolated capital (×57 in the corpus: H5N1, 슈퍼-G, W. 부시).
    return s.replace(/(?<![A-Za-z])[A-Z][A-Z-]*[A-Z](?![A-Za-z])|(?<![A-Za-z])[A-Z](?![A-Za-z])/gu, spell);
}
