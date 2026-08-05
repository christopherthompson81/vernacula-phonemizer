/**
 * Kazakh (kk) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Kazakh's DEFINING rule (measured over the kk_hr FLEURS corpus — see the investigation doc) is the
 * CASE SUFFIX after a digit, exactly as trap 14 predicted:
 *   `N-ші`/`N-шы` ordinals ×16 (190-шы, 60-шы, 19-шы, 1-ші)
 *   bare numbers with a CASE suffix ×36 (200-ге, 8-ден, 80-нен, 60-тан, 1000-нан, 11:00-ден, 9:30-да,
 *     160 км/сағ-қа)
 * The suffix must AGREE with the word (vowel harmony), so gluing the written suffix verbatim to the
 * digits is wrong: `200-ге` is *екі жүзге* (the -ге on жүз), `11:00-ден` is *он бірден*. The written
 * suffix tells the CASE; the WORD supplies the harmonised ending.
 *
 * The rest of the corpus:
 *   space-grouped thousands ×6 (17 000, 5 000 000) — the TOKEN `\d+` splits these on the space
 *   comma-decimals ×5 (2,3, 3,7) — the comma is a pause
 *   clocks ×8 (11:00-ден, 08:46, 10: 00, 13:15, 9:30-да, 0230 UTC)
 *   `б.д.д.` (before the birth of Jesus = BC) ×2, `т.б.` (etc), `т.с.с.` — dotted abbreviations
 *   `км/сағ` (km/h), `миля/сағат` (mph) — the /сағ not composed
 *   degrees (`+ 30 °C-тан`, 35°W)
 *   percent `80%` (the tier's пайыз) · `АҚШ` (USA) · `XVI ғасырда` (roman ordinal — works)
 *
 * WHAT WAS BROKEN, verbatim from the pre-change engine:
 *   `190-шы`    → `ʒˈʏz toqsˈɑn ʃˈə`      the ordinal suffix read as the bare word "шы"
 *   `200-ге`    → `jˈekɪʒˈʏz ɡˈe`          the case suffix read as the bare word "ге"
 *   `11:00-ден` → `ˈonbˈɪr , nˈøɫ dˈen`    the clock + the ablative suffix
 *   `17 000`    → `ˈonʒˈetɪ nˈøɫ`           the space-thousands became two numbers
 *   `2,3 миллиард` → `jˈekɪ , ˈʏʃ …`         the comma-decimal became a pause
 *   `б.д.д.`    → `bˈə . dˈə . dˈə .`       the era marker letter-spelled
 *   `83 км/сағ` → `… kəjlomˈetr sˈɑʁ`       the rate denominator raw
 *
 * NOTE on boundaries: every one here is an explicit lookaround, never `\b` (trap 1).
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { numberToIpa } from "./numbers.ts";
import { ROMAN_POLICY } from "./romanOrdinals.ts";
import { SYMBOLS } from "./kazakh.ts";
import { MANIFEST } from "./manifest.ts";

// ---------------------------------------------------------------------------------------------------
// ORDINALS
// ---------------------------------------------------------------------------------------------------

/** Cardinal numbers in ORTHOGRAPHY (kazakh.jsonc stores these as IPA). Used to build the ordinal beyond
 *  the romanOrdinals.ordinal cap of 100. */
const UNIT_CARD: readonly string[] = [
    "", "бір", "екі", "үш", "төрт", "бес", "алты", "жеті", "сегіз", "тоғыз",
];
const TENS_CARD: readonly string[] = [
    "", "он", "жиырма", "отыз", "қырық", "елу", "алпыс", "жетпіс", "сексен", "тоқсан",
];
/** Ordinal UNITS and TENS (from romanOrdinals.ts — the irregularities жиырмасыншы/қырқыншы live there). */
const ORD_UNITS: readonly string[] = [
    "", "бірінші", "екінші", "үшінші", "төртінші", "бесінші", "алтыншы", "жетінші", "сегізінші", "тоғызыншы",
];
const ORD_TENS: readonly string[] = [
    "", "оныншы", "жиырмасыншы", "отызыншы", "қырқыншы", "елуінші", "алпысыншы", "жетпісінші", "сексенінші",
    "тоқсаныншы",
];
const HUNDRED_CARD = "жүз";
const THOUSAND_CARD = "мың";

/** Integer → the Kazakh ORDINAL, in orthography (emitted as text, phonemized by the g2p). The ordinal
 *  suffix -ыншы/-інші attaches to the LAST element only, harmony-paired (the same rule romanOrdinals
 *  documents). Extends romanOrdinals.ordinal (which caps at 100) to the hundreds the corpus writes.
 *  Above 999 → undefined (the corpus writes no 4-digit ordinal; a round thousand is its own fused form
 *  the romanOrdinals file also declines to attempt). */
function ordinalWord(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n >= 1000000) return undefined;
    // FOUR-DIGIT ORDINALS EXIST HERE, as years in the `N-жылы` form: the corpus writes `2016-жылы` and
    // `2005-жылы` ("in the year 2016"), which Kazakh reads as an ordinal — екі мың он алтыншы жылы. Only
    // the LAST element takes the ending, so the thousands head is the plain cardinal. A ROUND thousand
    // still declines: `1000-шы` needs the fused мыңыншы, which romanOrdinals also refuses to construct.
    if (n >= 1000) {
        const th = Math.floor(n / 1000), r = n % 1000;
        if (r === 0) return undefined;
        const head = `${th === 1 ? UNIT_CARD[1] : orthographic(th)} ${THOUSAND_CARD}`;
        const tail = ordinalWord(r);
        return tail === undefined ? undefined : `${head} ${tail}`;
    }
    if (n <= 100) return ROMAN_POLICY.ordinal(n);
    // 101–999: the hundreds CARDINAL (except 100, handled above) + the remainder's ordinal.
    const h = Math.floor(n / 100), r = n % 100;
    const head = h === 1 ? HUNDRED_CARD : `${UNIT_CARD[h]} ${HUNDRED_CARD}`;
    if (r === 0) {
        // A round hundred is its own ordinal: жүз → жүзінші (romanOrdinals covers 100).
        return `${head}інші`.replace("іінші", "інші");
    }
    return `${head} ${ordinalWord(r)}`;
}

// ---------------------------------------------------------------------------------------------------
// CASE SUFFIXES (trap 14 — the defining rule)
// ---------------------------------------------------------------------------------------------------

/** The Kazakh case suffixes the corpus writes after digits, keyed by the CASE they mark. The suffix the
 *  corpus writes tells us WHICH case; the word it attaches to supplies the harmonised ending.
 *
 *  DATIVE -ге/-ға/-ке/-қа · ABLATIVE -ден/-дан/-тен/-тан/-нен/-нан · GENITIVE -ның/-нің ·
 *  LOCATIVE -да/-де/-та/-те · INSTRUMENTAL -мен/-бен/-пен.
 */
const CASE_BY_SUFFIX: Readonly<Record<string, string>> = {
    ге: "dat", ға: "dat", ке: "dat", қа: "dat",
    ден: "abl", дан: "abl", тен: "abl", тан: "abl", нен: "abl", нан: "abl",
    ның: "gen", нің: "gen", дың: "gen", дің: "gen", тың: "gen", тің: "gen",
    да: "loc", де: "loc", та: "loc", те: "loc",
    мен: "ins", бен: "ins", пен: "ins",
};

/** The LAST vowel of a word — the harmony class that picks the ending. */
function lastVowel(w: string): string | undefined {
    const m = /([аәеиоөұүыі])/gu.exec(w);
    let v: string | undefined;
    for (const match of w.matchAll(/[аәеиоөұүыі]/gu)) v = match[0];
    return v;
}
const BACK_VOWELS = "аәоұы";
const FRONT_VOWELS = "еиөүі";

/** The harmonised ending for a case, given the word's last vowel. */
function caseEnding(caseName: string, lastVowelChar: string): string {
    const back = BACK_VOWELS.includes(lastVowelChar);
    const front = FRONT_VOWELS.includes(lastVowelChar);
    switch (caseName) {
        case "dat": return back ? "ға" : "ге";
        case "abl": return back ? "дан" : "ден";
        case "gen": return back ? "ның" : "нің";
        case "loc": return back ? "да" : "де";
        case "ins": return back ? "мен" : "мен";
        default: return "";
    }
}

/** The DATE possessive: `15-і` is *он бесі* (the fifteenth [day]) — the number in words with the
 *  possessive attached to its last word, harmonised. Not an ordinal and not a noun. */
function ordinal_or_cardinal_tail(n: number, tail: string): string | undefined {
    const base = orthographic(n);
    if (base === "") return undefined;
    const words = base.split(" ");
    const last = words[words.length - 1]!;
    const v = lastVowel(last);
    if (v === undefined) return undefined;
    words[words.length - 1] = `${last}${BACK_VOWELS.includes(v) ? "ы" : "і"}`;
    return words.join(" ");
}

/** Attach a case ending to the LAST WORD of a composed number, honouring harmony. `200-ге` → "екі жүз"
 *  + "ге" → "екі жүзге". */
function withCase(numberWord: string, caseName: string): string {
    const words = numberWord.split(" ");
    const last = words[words.length - 1]!;
    const v = lastVowel(last);
    if (v === undefined) return numberWord;
    const back = BACK_VOWELS.includes(v);
    // A voiceless-final stem takes the voiceless variant (қа/қә/та/те): жүз (voiced) → жүзге, but
    // қырық (voiceless k) → қырыққа. A nasal-final stem (н/м/ң) takes -нен/-нан in the ablative:
    // сегіз (voiced) → сегізден, but сексен (nasal н) → сексеннен, мың → мыңнан.
    const voiceless = /[кқпсстфхцчшщ]$/u.test(last);
    const nasal = /[нмң]$/u.test(last);
    let e = caseEnding(caseName, v);
    if (voiceless && caseName === "dat") e = back ? "қа" : "ке";
    if (voiceless && caseName === "loc") e = back ? "та" : "те";
    if (voiceless && caseName === "abl") e = back ? "тан" : "тен";
    if (nasal && caseName === "abl") e = back ? "нан" : "нен";
    words[words.length - 1] = last + e;
    return words.join(" ");
}

// ---------------------------------------------------------------------------------------------------
// THE RULES
// ---------------------------------------------------------------------------------------------------

/** Normalize one Kazakh input string. Pure text→text. */
export function normalizeKazakh(input: string): string {
    let s = input;

    // 0) SPACE-GROUPED THOUSANDS — the corpus writes 17 000, 5 000 000 (space, not comma/period). The
    //    TOKEN `\d+` splits these on the space. De-group FIRST, before anything reads a pause.
    for (let i = 0; i < 2; i++) s = s.replace(/(\d) (\d{3})(?!\d)/gu, "$1$2");

    // 1) DOTTED ABBREVIATIONS and ERA MARKERS — `б.д.д.` (біздің дәуірге дейін = before our era, BC),
    //    `т.б.` (тағы басқа = etc), `т.с.с.` (тағы сол сияқты = and the like). BEFORE the single-dot
    //    rule. The dot is consumed before a following word.
    s = s.replace(/(?<![\p{L}\p{M}])б\.\s?д\.\s?д\.(\s+)(?=[\p{L}\d])/giu, "біздің дәуірге дейін$1");
    s = s.replace(/(?<![\p{L}\p{M}])б\.\s?д\.\s?д\.(?=\s*(?:[.,;:!?»)]|$))/giu, "біздің дәуірге дейін.");
    s = s.replace(/(?<![\p{L}\p{M}])т\.\s?б\.(\s+)(?=[\p{L}\d])/giu, "тағы басқа$1");
    s = s.replace(/(?<![\p{L}\p{M}])т\.\s?б\.(?=\s*(?:[.,;:!?»)]|$))/giu, "тағы басқа.");
    s = s.replace(/(?<![\p{L}\p{M}])т\.\s?с\.\s?с\.(\s+)(?=[\p{L}\d])/giu, "тағы сол сияқты$1");
    s = s.replace(/(?<![\p{L}\p{M}])т\.\s?с\.\s?с\.(?=\s*(?:[.,;:!?»)]|$))/giu, "тағы сол сияқты.");

    // 2) ORDINALS — `190-шы`, `60-шы`, `19-шы`, `1-ші`. The -шы/-ші/-ншы/-нші suffix is the ordinal
    //    ending; the READING is the ordinal word (жүз тоқсаныншы, алпысыншы). Runs BEFORE the clock
    //    rule so a digit run is not first claimed as a time.
    s = s.replace(/(?<![\d.,])(\d+)(?:-)?(ші|шы|нші|ншы)(?![\p{L}\p{M}])/giu, (m0, d: string, sfx: string) => {
        const n = Number(d);
        const ord = ordinalWord(n);
        return ord === undefined ? m0 : ord;
    });

    // 2b) `N-НОУН` — the ordinal writing with the noun spelled out, which the case-suffix rule cannot see
    //     because the tail is a WORD, not an ending. Thirteen corpus instances and seven distinct nouns:
    //     `8-ғасырдан`, `20-ғасырдың`, `19-ғасыр`, `17-ғасырда`, `15-ғасырда`, `14-ғасыр`, `10-ғасырда`
    //     (century), `2016-жылы`, `2005-жылы` (year), `247-бабына` (article), `4-санатты` (category),
    //     `1-түрге` (type). Every one reads the digit as an ORDINAL and keeps the noun with whatever case
    //     the text gave it — `8-ғасырдан` is *сегізінші ғасырдан*, not *сегіз ғасырдан*. Runs AFTER the
    //     bare case-suffix rule, so a tail that IS an ending has already been claimed.
    //     A ONE-LETTER tail is the date possessive (`15-і` = the 15th), which attaches to the number
    //     instead of standing as a noun.
    s = s.replace(/(?<![\d.,])(\d+)-([а-яәғқңөұүһі]+)(?![\p{L}\p{M}])/giu, (m0, d: string, tail: string) => {
        const n = Number(d);
        if (CASE_BY_SUFFIX[tail.toLowerCase()] !== undefined) return m0; // an ending, not a noun
        const ord = ordinalWord(n);
        if (ord === undefined) return m0;
        if (tail.length <= 2) {
            const words = ordinal_or_cardinal_tail(n, tail);
            return words ?? m0;
        }
        return `${ord} ${tail}`;
    });

    // 2b) НӨМІР. The NUMERO SIGN was dropped outright — the corpus's «№ 11 ғарышкер» read as *он бір
    //     ғарышкер*, the sign gone. `нөмір` ×1 here ("жергілікті нөмір алу"), and the same corpus writes the
    //     content the other way round in `1 және 2 нөмірлі реакторлар` — the postposed adjectival form, which
    //     suits a different construction and is not what a preposed sign wants. Emitted preposed, the shape ru
    //     and uk already use for this character. ⚠ ONE INSTANCE OF EACH: this is a lead acted on because the
    //     alternative is a silently dropped sign, not a strongly attested reading.
    s = s.replace(/№\s?(?=\d)/gu, "нөмір ");

    // 3) CLOCK, in the COLON form. `08:46` → сегіз қырық алты; `13:15` → он үш он бес. The corpus's
    //    `10: 00` (space after colon) is handled. Runs BEFORE the case-suffix rule so a case-suffixed
    //    clock (`11:00-ден`, `9:30-да`) is read as a time first and the suffix attaches to its last
    //    word. NOT a sports time: a THIRD `\d.\d\d` field means a pace.
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-3]):\s*([0-5]\d)(?![:.\d])(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан|ның|нің|да|де|та|те|мен|бен|пен)?/giu,
        (_m, h: string, min: string, sfx: string) => {
            const hv = Number(h), mv = Number(min);
            if (hv > 23 || mv > 59) return _m;
            let base = mv === 0 ? orthographic(hv) : `${orthographic(hv)} ${orthographic(mv)}`;
            if (sfx !== undefined && sfx !== "") {
                const caseName = CASE_BY_SUFFIX[sfx.toLowerCase()];
                if (caseName !== undefined) base = withCase(base, caseName);
            }
            return base;
        });

    // 3b) DOT-CLOCK before a timezone — `15.00 UTC`, `0230 UTC` (the corpus's 24h times). The dot is
    //     otherwise a version (step 8b). The 4-digit `0230` (military time) is a bare number.
    s = s.replace(/(?<![\d.,])(\d{1,2})\.(\d{2})\s*(UTC|GMT)/giu, (_m, h: string, min: string, tz: string) =>
        `${orthographic(Number(h))} ${orthographic(Number(min))} ${tz}`);

    // 4) THE CASE SUFFIX — `200-ге`, `8-ден`, `80-нен`, `60-тан`, `1000-нан`, `11:00-ден`, `9:30-да`,
    //    `160 км/сағ-қа`. The suffix tells the CASE; the number becomes words; the ending attaches to
    //    the last word with harmony. This is trap 14's shape: agreement cannot be applied to digits, so
    //    the operand is wordified FIRST. Runs AFTER the clock rule so a clock + suffix reads the time
    //    then the suffix (11:00-ден → он бірден).
    s = s.replace(/(?<![\d.,])(\d+)(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан|ның|нің|да|де|та|те|мен|бен|пен)(?![\p{L}\p{M}])/giu,
        (m0, d: string, sfx: string) => {
            const caseName = CASE_BY_SUFFIX[sfx.toLowerCase()];
            if (caseName === undefined) return m0;
            const n = Number(d);
            if (orthographic(n) === "") return m0;
            return withCase(orthographic(n), caseName);
        });

    // 5) DEGREES. `+ 30 °C-тан` (the degree + ablative suffix — the corpus's form), `35°W` (a
    //    LONGITUDE). `градус` is the degree word. The ablative -тан attaches to it. Runs BEFORE the
    //    case-suffix rule so the °C-тан suffix is not claimed as a bare number suffix. The leading
    //    `+` is claimed here (the plus rule at the end runs after the degree consumed the number).
    s = s.replace(/(^|[\s(])\+\s?(\d+)\s?°\s?C\s?(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?/giu,
        (_m, lead: string, n: string, sfx: string) => {
            const base = `${lead}плюс ${orthographic(Number(n))} градус Цельсий`;
            if (sfx !== undefined && sfx !== "") {
                const caseName = CASE_BY_SUFFIX[sfx.toLowerCase()];
                if (caseName !== undefined) return withCase(base, caseName);
            }
            return base;
        });
    s = s.replace(/(^|[\s(])-(\d+)\s?°\s?C\s?(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?/giu,
        (_m, lead: string, n: string, sfx: string) => {
            const base = `${lead}минус ${orthographic(Number(n))} градус Цельсий`;
            if (sfx !== undefined && sfx !== "") {
                const caseName = CASE_BY_SUFFIX[sfx.toLowerCase()];
                if (caseName !== undefined) return withCase(base, caseName);
            }
            return base;
        });
    s = s.replace(/(\d+)\s?°\s?C\s?(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?(?![\p{L}\p{M}])/giu,
        (_m, n: string, sfx: string) => {
            const base = `${orthographic(Number(n))} градус Цельсий`;
            if (sfx !== undefined && sfx !== "") {
                const caseName = CASE_BY_SUFFIX[sfx.toLowerCase()];
                if (caseName !== undefined) return withCase(base, caseName);
            }
            return base;
        });
    s = s.replace(/(\d+)\s?°\s?F\s?(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?(?![\p{L}\p{M}])/giu,
        (_m, n: string, sfx: string) => {
            const base = `${orthographic(Number(n))} градус Фаренгейт`;
            if (sfx !== undefined && sfx !== "") {
                const caseName = CASE_BY_SUFFIX[sfx.toLowerCase()];
                if (caseName !== undefined) return withCase(base, caseName);
            }
            return base;
        });
    s = s.replace(/(\d+)\s?°\s?([NSEW])(?![\p{L}\p{M}])/giu, (_m, n: string, c: string) =>
        `${orthographic(Number(n))} градус ${({ N: "солтүстік", S: "оңтүстік", E: "шығыс", W: "батыс" } as Record<string, string>)[c.toUpperCase()]!}`);

    // 5b) RATES — `83 км/сағ` (km/h), `17 500 миля/сағат` (mph), and the case-suffixed `160 км/сағ-қа`
    //    (the dative -қа attaches to the last word). The tier's `км` unit matches but `/сағ` has no
    //    rateDenominator; compose locally. AFTER the case suffix rule (which claims -қа), BEFORE the
    //    tier. The suffix on a rate is claimed here too (сағатқа = "to the hour").
    s = s.replace(/(\d[\d ]*)\s?(км)\s*\/\s*(сағ|сағат)(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?(?![\p{L}\p{M}])/giu,
        (_m, d: string, u: string, denom: string, sfx: string) => {
            const n = Number(d.replace(/ /gu, ""));
            const base = `${orthographic(n)} километр ${denom === "сағат" ? "сағат" : "сағат"}`;
            if (sfx !== undefined && sfx !== "") {
                const caseName = CASE_BY_SUFFIX[sfx.toLowerCase()];
                if (caseName !== undefined) return withCase(base, caseName);
            }
            return base;
        });
    s = s.replace(/(\d[\d ]*)\s?миля\s*\/\s*сағат(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?(?![\p{L}\p{M}])/giu,
        (_m, d: string, sfx: string) => {
            const n = Number(d.replace(/ /gu, ""));
            const base = `${orthographic(n)} миля сағат`;
            if (sfx !== undefined && sfx !== "") {
                const caseName = CASE_BY_SUFFIX[sfx.toLowerCase()];
                if (caseName !== undefined) return withCase(base, caseName);
            }
            return base;
        });

    // 6) NUMERIC RANGES — `1977-1981`, `1418 – 1450`, `10-11`, `35-40`. Kazakh "ден" (to/from) or just
    //    two numbers. The corpus's `2005-жылы` (a year + -жылы) is NOT a range (the hyphen is part of
    //    the year form). A leading minus stays a sign.
    s = s.replace(/(?<![\d.,])(\d[\d ]*)\s*[-–—]\s*(\d[\d ]*)(?![\d.-])/gu, "$1–$2");

    // 7) THE SHARED SYMBOL TIER — %, units. The number must be ADJACENT to its unit and still carry its
    //    decimal comma (2,3), so it runs before step 8 folds the comma into a word.
    s = SYMBOLS(s);

    // 8) DECIMAL COMMA → the word. Kazakh reads the decimal comma as "бүтін" (whole) with the fraction
    //    as a separate number.
    s = s.replace(/(?<=\d),(?=\d)/gu, " бүтін ");

    // 8b) DOT DECIMALS/VERSIONS — `1.1 суретті` (Figure 1.1, the corpus's only dot-decimal; Kazakh
    //     writes decimals with commas, so a dot is a version/figure number). Read "нүкте" (point).
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?![\d.])/giu, (m0, i: string, f: string) =>
        `${orthographic(Number(i))} нүкте ${orthographic(Number(f))}`);

    // 9) SIGNS. `+` → "плюс" (the corpus's `+ 30`, `UTC + 1`). A TRUE minus (`-5`) reads "минус".
    s = s.replace(/(^|[\s(])\+\s?(\d)/gu, "$1плюс $2");
    // ⚠ ± IS THIS LANGUAGE'S OWN TWO WORDS, juxtaposed — zero new sourcing (#654). Both halves are lifted from
    //    the plus and minus rules in this file, so nothing is invented, and both are SIGN names rather than
    //    operation names, which is what ± needs: it marks a tolerance, not an addition. The FORM is the one every
    //    language that already read ± uses (bg/da/is/nb/ro/sv juxtapose with no conjunction). Runs BEFORE the +
    //    rule, since ± is a single character the + rule cannot see.
    s = s.replace(/±/gu, " плюс минус ");
    s = s.replace(/(?<=[A-Z])\s?\+\s?(\d)/gu, " плюс $1");
    s = s.replace(/(?<![\p{L}\p{Nd}])-(\d+)(?!\s*[-\d])/gu, "минус $1");
    s = s.replace(/(\d)\s*×\s*(\d)/gu, "$1 есе $2");
    s = s.replace(/(\S)\s*=\s*(\S)/gu, "$1 тең $2");
    s = s.replace(/(\d)\s*<\s*(\d)/gu, "$1 аз $2");
    s = s.replace(/(\d)\s*>\s*(\d)/gu, "$1 көп $2");

    return s;
}

/** Orthographic Kazakh cardinal (the manifest stores IPA; restated here in orthography for the case
 *  suffix and clock rules, which must emit words the g2p reads). */
function orthographic(n: number): string {
    if (n < 10) return UNIT_CARD[n]!;
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        // TENS AND UNIT ARE SEPARATE WORDS — он бес, жиырма тоғыз. Concatenating them produced words
        // Kazakh does not have (*онбес, *жиырматоғыз, *онбір) and the g2p then stressed each as one:
        // `15-ке` read *онбеске*, `29-да` *жиырматоғызда*, `11:00-ден` *онбірден*. The ordinal path in
        // romanOrdinals.ts spaces them correctly, which is what made the split visible.
        return u === 0 ? TENS_CARD[t]! : `${TENS_CARD[t]} ${UNIT_CARD[u]}`;
    }
    if (n < 1000) {
        const h = Math.floor(n / 100), r = n % 100;
        const head = h === 1 ? HUNDRED_CARD : `${UNIT_CARD[h]} ${HUNDRED_CARD}`;
        return r === 0 ? head : `${head} ${orthographic(r)}`;
    }
    if (n < 1000000) {
        const th = Math.floor(n / 1000), r = n % 1000;
        const head = `${th === 1 ? UNIT_CARD[1] : orthographic(th)} ${THOUSAND_CARD}`;
        return r === 0 ? head : `${head} ${orthographic(r)}`;
    }
    return "";
}
