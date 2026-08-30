/**
 * Macedonian (mk) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the
 * Macedonian engine cannot already read into words the existing pipeline speaks. Pure text→text; no IPA.
 * Runs inside macedonian.ts's `text()`, before the tokenizer.
 *
 * MEASURED OVER THE FLEURS mk_mk CORPUS (1,857 unique utterances, column 3). The Macedonian conventions
 * that break the naive pipeline:
 *
 *   · GROUPING IS A PERIOD and the DECIMAL is a comma (`400.000`, `19.500`, `5.000.000`, `3.850` km²;
 *     `6,5`, `12,8`, `2,3 милијарди`) — but the corpus ALSO uses comma-thousands in English-influenced
 *     spots (`1,400 луѓе`, `30,000`). A comma followed by exactly 3 digits is grouping (read as one
 *     number); 1–2 digits is a decimal (read digit by digit after "запирка"). The period+3-digit form is
 *     de-grouped here; the comma stays adjacent for the shared symbol tier and the TOKEN, like Czech.
 *
 *   · THE ORDINAL IS A SUFFIX, not a dot: `17-ти век`, `18-тиот век`, `18-от век`, `21-ви`, `7-миот`,
 *     `37-ма`, `1-та и 3-та`, `116-те`, `40-тина`, `190ти`, `1.000-та`, `1970-тите години`,
 *     `1850-те години`, `1920- тите`. The written suffix is the LAST letters of the spoken ordinal
 *     (Russian's ending-matching idea, but here it encodes GENDER + DEFINITENESS rather than case):
 *       -ти / -ви / -ми     masculine indefinite  60-ти → шеесетти, 21-ви → дваесет и први
 *       -тиот / -от / -миот masculine definite     18-тиот → осумнаесеттиот
 *       -ма                 feminine indefinite   37-ма → триесет и седма
 *       -та                 feminine definite     1-та → првата, 3-та → третата
 *       -те                 definite plural:     116-те → сто и шеснаесетте ("the 116")
 *       -тите / -ите        decade:             1970-тите → илјада деветстотини и седумдесеттите
 *       -тина               approximative:      40-тина → четириесетина ("some forty")
 *     Only the LAST element of a compound ordinalizes: 1970 → "илјада деветстотини и седумдесетти".
 *     No bare `N.` ordinal-dot rule exists: `1770.` is a year + sentence period, `4. јули` and `8. век`
 *     are the only Germanic remnants and are handled by the date/century rules, not a dot rule.
 *
 *   · Century and date ordinals: `10 век` → десетти век, `на 6 октомври 1789` → шести октомври.
 *
 *   · ERA MARKERS `г. н.е.` / `г. п.н.е.` / `пр. н. е.` → "од нашата ера" / "пред нашата ера";
 *     the year abbreviation `N г.` → "N година".
 *
 *   · CLOCK `06:30` → "шест и триесет" (cardinals joined by и; `:00` drops the minutes), with the
 *     trailing `часот`/`ч` kept.
 *
 *   · RATES the shared tier cannot express: `милји/час`, `mph`, `kph`, `Mbit/s`, and the Cyrillic
 *     squared `мм2`/`км2` (the tier's exponent lookbehind is ASCII-only).
 *
 * ORDERING COUPLINGS, each a bug that happened:
 *   · de-grouping FIRST — a period/space is otherwise a token boundary or clause mark.
 *   · multi-dot era markers BEFORE the single-dot year rule, and before the `N г.` expansion.
 *   · the ordinal-suffix rule BEFORE the century/date rules, which would otherwise claim the digits.
 *   · the range rule BEFORE the clock rule, so `22:00-23:00` becomes "22:00 до 23:00" first.
 *   · personal-initial single capitals BEFORE the initialism pass (which would otherwise see the dot).
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { mkOrdinal, numberToText } from "./numbers.ts";
import { rewrite } from "../../core/provenance.ts";

const MANIFEST = loadManifest<{ acronymLetters: string[] }>(import.meta.url, "macedonian.jsonc");

const GROUP_SPACE = " \u00a0\u202f\u2009";  // NBSP, NNBSP, thin space
/** The months — dates read the day as an ordinal. */
const MONTHS = new Set([
    "јануари", "февруари", "март", "април", "мај", "јуни", "јули",
    "август", "септември", "октомври", "ноември", "декември",
]);

// ── Initialisms ─────────────────────────────────────────────────────────────
/** Macedonian letter names — Cyrillic, plus the Latin letters that appear in embedded initialisms
 *  (GPS → ге пе ес, DVD → де ве де). Personal initials `Н. Вејн` / `Џорџ В. Буш` read through the same map. */
const LETTER_NAME: Readonly<Record<string, string>> = {
    а: "а", б: "бе", в: "ве", г: "ге", д: "де", ѓ: "ѓе", е: "е", ж: "же", з: "зе", ѕ: "ѕе",
    и: "и", ј: "је", к: "ка", л: "ел", љ: "ље", м: "ем", н: "ен", њ: "ње", о: "о", п: "пе",
    р: "ер", с: "ес", т: "те", ќ: "ќе", у: "у", ф: "еф", х: "ха", ц: "це", ч: "че", џ: "џе", ш: "ша",
    a: "а", b: "бе", c: "це", d: "де", e: "е", f: "еф", g: "ге", h: "ха", i: "и", j: "је",
    k: "ка", l: "ел", m: "ем", n: "ен", o: "о", p: "пе", q: "ку", r: "ер", s: "ес", t: "те",
    u: "у", v: "ве", w: "даблве", x: "икс", y: "ипсилон", z: "зет",
};

/** Macedonian phonotactics for the OOV "can this be read as a word" test. The vowel class carries BOTH the
 *  Cyrillic vowels and the Latin ones (a e i o u): the embedded-Latin initialisms the corpus writes
 *  (ASUS, PALM, MINAE, JAS) are READ as foreign words, so they must be "readable", while a vowel-less
 *  Latin run (GPS, DVD, CCTV, XDR) is letter-spelled by the OOV rule. Onset/coda sets are given in both
 *  scripts for the same reason. */
export const isUnreadableMacedonian = makeUnreadableTest({
    vowels: /[аеиоуaeiou]/u,
    legalOnsets: new Set([
        "бл", "бр", "вл", "вр", "гл", "гр", "дв", "др", "жв", "жд", "зб", "зг", "зд", "зл", "зм",
        "зн", "зр", "кл", "кн", "кр", "мн", "мр", "пл", "пр", "пс", "пт", "ск", "сл", "см", "сн",
        "сп", "ст", "св", "тв", "тр", "фл", "фр", "хл", "хм", "хр", "цв", "цр", "шк", "шл", "шм",
        "шн", "шп", "шт", "шв",
        "bl", "br", "vl", "vr", "gl", "gr", "dv", "dr", "zd", "zl", "zm", "zn", "zr", "kl", "kn",
        "kr", "mn", "mr", "pl", "pr", "ps", "pt", "sk", "sl", "sm", "sn", "sp", "st", "sv", "tv",
        "tr", "fl", "fr", "xl", "xm", "xr", "ts", "tʃ", "ʃk", "ʃl", "ʃm", "ʃn", "ʃp", "ʃt", "ʃv",
        "st", "spr", "str",
    ]),
    legalCodas: new Set([
        "ст", "ск", "зд", "зн", "зл", "зм", "шт", "жв", "жб", "рт", "рк", "рд", "рс", "рн", "рл",
        "рм", "рв", "лт", "лд", "лс", "лм", "нт", "нд", "нк", "нг", "мп", "цк", "цт", "чк", "чм", "пс",
        "st", "sk", "zd", "zn", "zl", "zm", "ʃt", "rt", "rk", "rd", "rs", "rn", "rl", "rm", "rv",
        "lt", "ld", "ls", "lm", "nt", "nd", "nk", "ng", "mp", "ts", "tʃ", "ps", "ks", "ŋ", "ndʒ",
    ]),
});

/** LEXICAL: acronyms Macedonian spells out although the letters could be read as a word. Authored in
 *  macedonian.jsonc beside the language's other hand-authored facts. Tokens with no vowel (ФБИ, ДНК, ТВ,
 *  СССР, МС, GPS, DVD, …) need no entry: the OOV rule letter-spells them automatically. */
const ACRONYM_LETTERS: ReadonlySet<string> = new Set(MANIFEST.acronymLetters);

/** Macedonian has no pronunciation dictionary (its g2p is rule-based), so isRecorded is always false. */
export function normalizeMacedonianInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        acronymLetters: ACRONYM_LETTERS,
        isRecorded: () => false,
        isUnreadable: isUnreadableMacedonian,
    })(text);
}

// ── Ordinal transforms ───────────────────────────────────────────────────────
/** Masculine definite: append the postpositive article -от to the LAST word (осумнаесетти → осумнаесеттиот,
 *  седми → седмиот). For compounds only the last element takes it (дваесет и првиот). */
const mascDef = (base: string): string => base.replace(/(\S+)$/u, "$1от");
/** Feminine indefinite: the last word's -и → -а (седми → седма, први → прва, илјадити → илјадита). */
const femIndef = (base: string): string => base.replace(/(\S+)и$/u, "$1а");
/** Feminine definite: append -та to the last word (прва → првата, трета → третата). */
const femDef = (base: string): string => femIndef(base).replace(/(\S+)$/u, "$1та");
/** Definite plural: append -те to the last word (седумдесетти → седумдесеттите; шеснаесет → шеснаесетте). */
const pluralDef = (words: string): string => words.replace(/(\S+)$/u, "$1те");

/**
 * The written ordinal suffix → how to build the full form from the number's masculine-indefinite ordinal.
 * `-та` is feminine DEFINITE for ordinary numbers (првата, третата) but for a round thousand/million the
 * feminine indefinite already ends in -та (илјадита, милионита) — the corpus's `1.000-та поштенска марка`
 * reads "илјадита", not "илјадитата", because the preceding possessive (Неговата) carries definiteness.
 */
type SuffixKind = "mascIndef" | "mascDef" | "femIndef" | "femDef" | "count" | "decade" | "approx";
function suffixKind(suffix: string): SuffixKind {
    switch (suffix) {
        case "тиот": case "миот": case "виот": case "риот": case "от": return "mascDef";
        case "ма": return "femIndef";
        case "та": return "femDef";
        case "тите": case "ите": return "decade";
        case "тина": return "approx";
        case "те": return "count"; // the caller decides decade-vs-count via the following word
        default: return "mascIndef"; // ти / ви / ми / ри
    }
}

/**
 * Normalize one Macedonian input string. Pure text→text. Runs BEFORE the shared symbol tier (which needs
 * the number still adjacent to its unit/sign), and the initialism pass runs after it.
 */
export function normalizeMacedonian(input: string): string {
    let s = input;

    // 0) DIGIT DE-GROUPING, first — a period/space is otherwise a token boundary or clause mark. The
    //    comma stays: it is BOTH the decimal separator (6,5) and a thousands separator in the
    //    English-influenced spots (1,400) — the TOKEN distinguishes them by the block length, like Czech.
    for (let i = 0; i < 2; i++)
        s = rewrite(s, new RegExp(`(?<=\\d)(?<!(?<![\\d\\.,])0)\\.(?=\\d{3}(?!\\d))`, "gu"), "");
    for (let i = 0; i < 2; i++)
        s = rewrite(s, new RegExp(`(?<=\\d)(?<!(?<![\\d\\.,])0)[${GROUP_SPACE}](?=\\d{3}(?!\\d))`, "gu"), "");

    // 1) ERA MARKERS (multi-dot) BEFORE the single-dot year rule, so the interior dots never reach
    //    clausePunctuation as breaks: `356 г. п.н.е.` → "356 година пред нашата ера".
    s = rewrite(s, /пр\.\s*н\.\s*е\./giu, "пред нашата ера");
    s = rewrite(s, /п\.\s*н\.\s*е\./giu, "пред нашата ера");
    s = rewrite(s, /(?<![\p{L}\p{M}])н\.\s*е\./giu, "од нашата ера");

    // 2) YEAR ABBREVIATION `N г.` / `N год.` → "N година" (a specific year) or "N години" (a count/age —
    //    the corpus's one small instance "25 г., и Заха" is an age). The dot is consumed; where it was
    //    also the sentence period, put it back.
    s = rewrite(s, /(\d+)\s*год\./gu, (m0, n: string) => `${n} ${Number(n) >= 100 ? "година" : "години"}`);
    s = rewrite(s, /(\d+)\s*г\./gu, (m0, n: string) => `${n} ${Number(n) >= 100 ? "година" : "години"}`);

    // 3) SINGLE-DOT / HYPHEN ABBREVIATIONS. "итн." (etc.), "т.е." (that is), "Г-дин" (Mr.), "Д-р" (Dr.).
    //    Hyphenated, so they do not collide with the year rule's `N г.`.
    s = rewrite(s, /(?<![\p{L}\p{M}])итн\.(?=\s|$|[,.;:!?»"')])/giu, "и така натаму");
    s = rewrite(s, /(?<![\p{L}\p{M}])т\.е\./giu, "то ест");
    s = rewrite(s, /[Гг]-дин(?![\p{L}\p{M}])/gu, "господин");
    s = rewrite(s, /[Дд]-р(?![\p{L}\p{M}])/gu, "доктор");

    // 4) VERSION / FIGURE DOTS between digits — `802.11n` (×4), `Слика 1.1`, `14.7 милијарди`,
    //    `12.00 GMT` — were breaking the sentence at the interior dot. A period followed by a SPACE or a
    //    non-digit is not this (the date/century rules own those). Read as "точка" (point).
    s = rewrite(s, /(\d)\.(\d+)(?!\d)/gu, "$1 точка $2");

    // 5) NUMERIC RANGES, BEFORE the clock — `10-60`, `6-6`, `5-3`, `1894-1895`, `1995-96`, `35-40`,
    //    `100-200`, and the clock range `22:00-23:00` → "22:00 до 23:00" so the times are claimed whole.
    //    Read "до". The LEFT side must be ≥2 digits (or both single) so an alphanumeric designation like
    //    `II-76` (→ "2-76" after the shared Roman pass) is not read as a range.
    s = rewrite(s, /(\d+)\s*[-–—]\s*(\d+)(?!\d)/gu, (_m, a: string, b: string) => {
        if (a.length === 1 && b.length > 1) return _m; // "2-76" — a designation, not a range
        return `${a} до ${b}`;
    });

    // 6) CLOCK. The colon is otherwise clause punctuation, so `06:30` reads as "шест , триесет".
    //    Macedonian reads
    //    the time CARDINALLY with "и": 6:30 = "шест и триесет"; :00 drops the minutes (10:00 = "десет").
    //    The trailing "часот"/"ч" (the hour) is kept/expanded — "ч" is the abbreviation for "часот". A
    //    comma after the minutes marks a sports time, not a clock. The range rule ran first, so
    //    `22:00-23:00` is already "22:00 до 23:00". `am`/`pm` after a time → "претпладне"/"попладне".
    s = rewrite(s,
        /([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?!,\d)(\s*ч(?!\p{L})\.?)?/gu,
        (_m: string, h: string, min: string, ...rest: unknown[]) => {
            // The optional `ч` group participates only for "23:35 ч"; otherwise the args shift so the
            // 4th element is the OFFSET. Distinguish by type, as czech.ts's keepFinal does.
            const ч = rest[0];
            const hv = Number(h), mv = Number(min);
            const body = mv === 0 ? numberToText(hv) : `${numberToText(hv)} и ${numberToText(mv)}`;
            return typeof ч === "string" ? `${body} часот` : body;
        },
    );
    // 6b) `am`/`pm` after a time → претпладне/попладне. Standalone words (the clock already consumed the
    //     digits), matched on word boundaries so "Сами" is untouched.
    s = rewrite(s, /\bam\b/giu, "претпладне");
    s = rewrite(s, /\bpm\b/giu, "попладне");

    // 7) THE ORDINAL SUFFIX, the largest class in this file. `(\d+)[- ]?` + the written suffix (the last letters of the
    //    spoken ordinal). The `-те` suffix is ambiguous between a count ("the N") and a decade: a 4-digit
    //    number followed by "години" is a decade, otherwise it is "the N".
    s = rewrite(s,
        new RegExp(
            `(?<![\\p{L}\\p{M}\\d])(\\d+)\\s*-?\\s*(тите|тиот|миот|виот|риот|тина|ите|от|ти|ви|ми|ри|та|ма|те)(?!\\p{L})`,
            "gu",
        ),
        (m0: string, digits: string, suffix: string, offset: number, whole: string) => {
            const n = Number(digits);
            const base = mkOrdinal(n);
            if (base === undefined) return m0;
            const kind = suffixKind(suffix);
            if (kind === "decade") return pluralDef(base);
            if (kind === "approx") {
                if (n % 10 !== 0) return m0;
                return `${numberToText(n)}ина`; // дваесет → дваесетина, четириесет → четириесетина
            }
            if (kind === "count") {
                const rest = whole.slice(offset + m0.length);
                if (n >= 1000 && /^\s*години/gu.test(rest)) return pluralDef(base); // decade
                return pluralDef(numberToText(n)); // "the N" — definite plural cardinal
            }
            switch (kind) {
                case "mascDef": return mascDef(base);
                case "femIndef": return femIndef(base);
                case "femDef": return n % 1000 === 0 ? femIndef(base) : femDef(base);
                default: return base; // mascIndef
            }
        },
    );

    // 8) CENTURY — `N век` → ordinal + век (10 век → десетти век), including the compound list
    //    `10 и 11 век`. Also the one Germanic remnant `8. век` (with a dot). The suffix forms (17-ти век,
    //    18-тиот век) are already claimed by step 7.
    s = rewrite(s, /(\d+)\s+и\s+(\d+)\s*век(?![\p{L}\p{M}])/gu, (_m, a: string, b: string) => {
        const oa = mkOrdinal(Number(a)), ob = mkOrdinal(Number(b));
        return oa !== undefined && ob !== undefined ? `${oa} и ${ob} век` : _m;
    });
    s = rewrite(s, /(\d+)\s*век(?![\p{L}\p{M}])/gu, (m0, n: string) => {
        const o = mkOrdinal(Number(n));
        return o === undefined ? m0 : `${o} век`;
    });
    s = rewrite(s, /(\d+)\.\s*век(?![\p{L}\p{M}])/gu, (m0, n: string) => {
        const o = mkOrdinal(Number(n));
        return o === undefined ? m0 : `${o} век`;
    });

    // 9) DATES — `N <month>` → ordinal + month (на 6 октомври → на шести октомври), including a date range
    //    `24 август - 5 септември` and the Germanic-dot form `4. јули 1776`. The day must be 1–31.
    const monthAlt = [...MONTHS].join("|");
    s = rewrite(s,
        new RegExp(`(\\d{1,2})\\s+(${monthAlt})\\s*[-–—]\\s*(\\d{1,2})\\s+(${monthAlt})(?![\\p{L}\\p{M}])`, "giu"),
        (_m: string, a: string, ma: string, b: string, mb: string) => {
            const oa = mkOrdinal(Number(a)), ob = mkOrdinal(Number(b));
            if (oa === undefined || ob === undefined) return _m;
            return `${oa} ${ma} до ${ob} ${mb}`;
        },
    );
    s = rewrite(s,
        new RegExp(`(\\d{1,2})(?:\\.)?\\s+(${monthAlt})(?![\\p{L}\\p{M}])`, "giu"),
        (_m: string, d: string, month: string) => {
            const dv = Number(d);
            const o = dv >= 1 && dv <= 31 ? mkOrdinal(dv) : undefined;
            return o === undefined ? _m : `${o} ${month}`;
        },
    );

    // 10) REGNAL ORDINALS. All three corpus Romans (Лиалофи III, Елизабета II, Луј XVI) are regnal proper
    //     names, and the shared Roman pass has already rewritten them to CARDINAL digits before this engine
    //     runs (Macedonian has no ROMAN_POLICIES entry). The digit after a capitalized NAME is read as an
    //     ordinal: Лиалофи 3 → Лиалофи трети, Луј 16 → Луј шеснаесетти. Guarded by the same ≤39 monarch
    //     range as Czech, and the name must be a capitalised word (so "на 6 октомври" and "802.11n" are
    //     untouched). The FEMININE form follows a feminine-marked name: "Кралица Елизабета II" → "Втора"
    //     (names ending in -а are feminine in Macedonian; the corpus's one queen is Елизабета). Guards,
    //     each from a corpus false positive: the digit must be 2–39 (a regnal "first" is not written as a
    //     roman, and "Формула 1" is Formula ONE, a cardinal), must be followed by PUNCTUATION or end
    //     (all three regnal instances are "III."/"II."/"XVI,"; "Цели 20 проценти" and "Имаше 2 гола" are
    //     counts), and must not open a comma-grouped thousands run ("Од 1,400 луѓе").
    s = rewrite(s, /(\p{Lu}\p{Ll}+\p{M}*)[ \u00a0](\d{1,2})(?![,\d])(?=\.?[.,;:!?]|$)/gu, (_m: string, name: string, d: string) => {  // space, NBSP
        const n = Number(d);
        const o = mkOrdinal(n);
        if (o === undefined || n < 2 || n > 39) return _m;
        return `${name} ${name.endsWith("а") ? femIndef(o) : o}`;
    });

    // 11) RATE UNITS the shared tier cannot compose. `милји/час` (miles/hour — милји is a full word, not an
    //     abbreviation), the Latin `mph`/`kph`, `Mbit/s` (megabits per second). The Cyrillic squared units
    //     `мм2`/`км2` are also local: the tier's exponent lookbehind `(?<=[a-zA-Z])` is ASCII-only and the
    //     corpus writes `3136 мм2`.
    s = rewrite(s, /(\d+)\s*милји\s*\/\s*час(?![\p{L}\p{M}])/giu, "$1 милји на час");
    s = rewrite(s, /(\d+)\s*mph(?![\p{L}\p{M}])/giu, "$1 милји на час");
    s = rewrite(s, /(\d+)\s*kph(?![\p{L}\p{M}])/giu, "$1 километри на час");
    s = rewrite(s, /(\d+)\s*Mbit\/s(?![\p{L}\p{M}])/giu, "$1 мегабити на секунда");
    s = rewrite(s, /(\d+)\s*мм\s*[²2](?!\d)/gu, "$1 квадратни милиметри");
    s = rewrite(s, /(\d+)\s*км\s*[²2](?!\d)/gu, "$1 квадратни километри");

    // 12) DEGREES — `90°F`, `35° W`, and a bare `N°`. The corpus's own spelled-out form is
    //     "30 степени целзиусови", so °C/°F use the "по" construction; `° W`/`° E` are coordinates.
    s = rewrite(s, /(\d+)\s*°\s*C(?![\p{L}\p{M}])/gui, "$1 степени по Целзиус");
    s = rewrite(s, /(\d+)\s*°\s*F(?![\p{L}\p{M}])/gui, "$1 степени по Фаренхајт");
    s = rewrite(s, /(\d+)\s*°\s*W(?![\p{L}\p{M}])/gu, "$1 степени запад");
    s = rewrite(s, /(\d+)\s*°\s*E(?![\p{L}\p{M}])/gu, "$1 степени исток");
    s = rewrite(s, /(\d+)\s*°/gu, "$1 степени");

    // 13) SIGNS. `+30` (the corpus's "над +30 степени") reads "плус". Minus, ×, ÷, =, <, > and the
    //     ampersand are the handoff's sign classes — none occurs in the corpus but a dropped sign is
    //     inaudible, so each is read.
    s = rewrite(s, /(^|[\s(])[-−]\s?(?=\d)/gu, "$1минус ");
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
    //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
    //    reading is this language's own two words juxtaposed, both taken from the plus and minus rules
    //    already in this file.
    s = rewrite(s, /±/gu, " плус минус ");
    s = rewrite(s, /(^|[\s(])\+\s?(?=\d)/gu, "$1плус ");
    s = rewrite(s, /(\d)\s*×\s*(?=\d)/gu, "$1 пати ");
    s = rewrite(s, /\s*÷\s*/gu, " поделено со ");
    s = rewrite(s, /\s*=\s*/gu, " еднакво на ");
    s = rewrite(s, /\s*<\s*/gu, " помало од ");
    s = rewrite(s, /\s*>\s*/gu, " поголемо од ");
    s = rewrite(s, /\s*[&＆]\s*/gu, " и ");

    // 14) pH → "пе ха" (letter names) and `Ghz` → "гигахерци" — the corpus's lowercase-tech tokens that
    //     would otherwise read as consonant clusters or Latin foreign.
    s = rewrite(s, /(?<![\p{L}\p{M}])pH(?![\p{L}\p{M}])/gu, "пе ха");
    s = rewrite(s, /(?<![\p{L}\p{M}])Ghz(?![\p{L}\p{M}])/giu, "гигахерци");

    // 14b) FRACTIONS — the corpus's "29¾ инчи на 24½ инчи" and "5 мм (1/5 инчи)". ¾/½ after a whole read
    //     "и три четвртини" / "и половина"; a unit fraction reads "една петтина"-shaped (numeral-ordinand
    //     stem + -тина). The vulgar-fraction glyphs are not in any clause-punctuation map, so they were
    //     being dropped outright.
    s = rewrite(s, /(\d+)¾/gu, "$1 и три четвртини");
    s = rewrite(s, /(\d+)½/gu, "$1 и половина");
    s = rewrite(s, /(\d+)¼/gu, "$1 и четвртина");
    s = rewrite(s, /(?<![\d.,])(\d{1,2})\/(\d{1,2})(?![\d.,])/gu, (_m, a: string, b: string) => {
        const denom = Number(b);
        const suffix = denom === 2 ? "половина" : denom === 3 ? "третина" : denom === 4 ? "четвртина"
            : denom === 5 ? "петтина" : denom === 6 ? "шестина" : undefined;
        if (suffix === undefined || Number(a) !== 1) return _m;
        return `една ${suffix}`;
    });

    // 15) PERSONAL-INITIAL single capitals — `Н. Вејн` (the shared LONE_INITIAL handles `В. Буш`, which
    //     sits between capitalized words; this one follows a comma in "НАСА, Н. Вејн"). And a lone Latin
    //     capital standing as a LETTER between words — `буквата V` (the letter vee) reads "ве" not the
    //     English [viː]; `H во pH` (after pH → "пе ха") reads "ха".
    s = rewrite(s, /(?<=,\s)([А-ШЃЅЈЉЊЌЏ])\.(?=\s+[А-Ш]\p{Ll})/gu, (_m, l: string) => LETTER_NAME[l.toLowerCase()] ?? l);
    s = rewrite(s, /(?<![\p{L}\p{M}])([A-Z])(?![\p{L}\p{M}])/gu, (_m, l: string) => LETTER_NAME[l.toLowerCase()] ?? l);

    return s;
}
