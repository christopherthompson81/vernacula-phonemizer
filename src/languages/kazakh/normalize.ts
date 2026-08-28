/**
 * Kazakh (kk) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ KAZAKH'S DEFINING RULE IS THE CASE SUFFIX WRITTEN AFTER A DIGIT — `N-ші`/`N-шы` ordinals (190-шы, 1-ші)
 * and bare numbers carrying a case ending (200-ге, 8-ден, 1000-нан, 11:00-ден, 160 км/сағ-қа).
 *
 * ⚠ THE SUFFIX MUST AGREE WITH THE WORD BY VOWEL HARMONY, so gluing the WRITTEN suffix verbatim to the digits
 * is wrong: `200-ге` is *екі жүзге* — the -ге attaches to жүз, not to the numeral as written — and `11:00-ден`
 * is *он бірден*. The written suffix tells you the CASE; the WORD supplies the harmonised ending.
 *
 * ⚠ THE TOKEN'S `\d+` SPLITS A SPACE-GROUPED THOUSAND (17 000, 5 000 000) into two numbers, and the comma of a
 * decimal reads as a pause. Both are claimed here.
 *
 * ⚠ Every boundary in this file is an explicit lookaround, never `\b`, which is ASCII-defined and finds none
 * against Cyrillic.
 */
import { ROMAN_POLICY } from "./romanOrdinals.ts";
import { SYMBOLS } from "./kazakh.ts";
import { tr } from "../../core/provenance.ts";

// ---------------------------------------------------------------------------------------------------
// ORDINALS
// ---------------------------------------------------------------------------------------------------

/** Cardinal numbers in ORTHOGRAPHY (kazakh.jsonc stores these as IPA). Used to build the ordinal beyond
 *  the romanOrdinals.ordinal cap of 100. */
const UNIT_CARD: readonly string[] = [
    "", "бір", "екі", "үш", "төрт", "бес", "алты", "жеті", "сегіз", "тоғыз",
];
/** ⚠ `UNIT_CARD[0]` is EMPTY ON PURPOSE — the table is indexed positionally, and a zero digit inside a
 *  larger number contributes no word (`20` is *жиырма*, not *жиырма нөл*). But `orthographic(0)` reached
 *  that same empty string and returned it, so a standalone zero simply vanished: `00:43` read *қырық үш*,
 *  `0.5` read *нүкте бес*, and `00:00` read as the EMPTY STRING. The zero word is needed only at the top
 *  of `orthographic`, never in the positional path.
 *  ⚠ KNOWN, PRE-EXISTING, AND NOT SPECIFIC TO ZERO: a word emitted by `orthographic` goes through the
 *  g2p, and numbers.ts records that three number words do not follow it — *нөл* has ø, *жиырма* is
 *  final-stressed, *алпыс* has a clear l. So this reads [nˈɵl] where the manifest's own digit reading is
 *  [nˈøɫ]. Every orthographic-path word already inherits that approximation; restoring a slightly
 *  off zero beats dropping it, and closing the gap properly means teaching the g2p these three. */
const ZERO_CARD = "нөл";
const TENS_CARD: readonly string[] = [
    "", "он", "жиырма", "отыз", "қырық", "елу", "алпыс", "жетпіс", "сексен", "тоқсан",
];
// ⚠ THE ORDINAL UNITS AND TENS LIVE IN romanOrdinals.ts AND ARE NOT RESTATED HERE. A second copy of both
// tables used to sit at this spot and NOTHING READ EITHER: `ordinalWord` takes 1–100 from
// ROMAN_POLICY.ordinal and builds 101–999 from UNIT_CARD, so the duplicates were free to drift away from
// the irregular жиырмасыншы / қырқыншы without a test noticing.
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
// CASE SUFFIXES — the defining rule; see the header on harmony.
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
    let v: string | undefined;
    for (const match of w.matchAll(/[аәеиоөұүыі]/gu)) v = match[0];
    return v;
}
const BACK_VOWELS = "аәоұы"; // the complement (е и ө ү і) is FRONT — every ending here is a two-way choice

/** The harmonised ending for a case, given the word's last vowel. */
function caseEnding(caseName: string, lastVowelChar: string): string {
    const back = BACK_VOWELS.includes(lastVowelChar);
    switch (caseName) {
        case "dat": return back ? "ға" : "ге";
        case "abl": return back ? "дан" : "ден";
        case "gen": return back ? "ның" : "нің";
        case "loc": return back ? "да" : "де";
        case "ins": return "мен"; // NOT harmony-conditioned — the instrumental varies by VOICING; see withCase
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
    // ⚠ THE INSTRUMENTAL IS VOICING-CONDITIONED, NOT HARMONY-CONDITIONED, and `caseEnding` could not say so:
    // it is handed only the last VOWEL, so both its branches returned -мен and `5-пен` read *бесмен*,
    // `40-пен` *қырықмен*, `9-бен` *тоғызмен* — none of them Kazakh words. The WRITTEN suffix already had it
    // right; the rewrite threw that information away and could not rebuild it.
    // MEASURED, not assumed — every C+мен/бен/пен bigram over the 1,487 distinct FLEURS kk_kz sentences
    // (411 hits, and each final letter takes exactly ONE of the three, with no counter-examples):
    //   -пен  қ×23 т×13 с×8 п×6 к×3 ш×2 д×2 г×2 ф×1   (58)
    //   -бен  з×10                                     (10)
    //   -мен  vowels ×223, р×43 н×37 у×10 л×5 м×4 й×3 ң×1   (343)
    // The closed set of words that can END a composed number (нөл бір екі үш төрт бес алты жеті сегіз тоғыз
    // он жиырма отыз қырық елу алпыс жетпіс сексен тоқсан жүз мың) ends only in л р і ш т с ы з н а қ у ң,
    // so only the -пен (ш т с қ) and -бен (з) arms are reachable, and only those two are written.
    if (voiceless && caseName === "ins") e = "пен";
    if (/[жз]$/u.test(last) && caseName === "ins") e = "бен";
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
    for (let i = 0; i < 2; i++) s = tr(s, /(?<=\d)(?<!(?<![\d\.,])0)[ \u00a0\u202f\u2009](?=\d{3}(?!\d))/gu, "");  // space, NBSP, NNBSP, thin space

    // 1) DOTTED ABBREVIATIONS and ERA MARKERS — `б.д.д.` (біздің дәуірге дейін = before our era, BC),
    //    `т.б.` (тағы басқа = etc), `т.с.с.` (тағы сол сияқты = and the like). BEFORE the single-dot
    //    rule. The dot is consumed before a following word.
    s = tr(s, /(?<![\p{L}\p{M}])б\.\s?д\.\s?д\.(\s+)(?=[\p{L}\d])/giu, "біздің дәуірге дейін$1");
    s = tr(s, /(?<![\p{L}\p{M}])б\.\s?д\.\s?д\.(?=\s*(?:[.,;:!?»)]|$))/giu, "біздің дәуірге дейін.");
    s = tr(s, /(?<![\p{L}\p{M}])т\.\s?б\.(\s+)(?=[\p{L}\d])/giu, "тағы басқа$1");
    s = tr(s, /(?<![\p{L}\p{M}])т\.\s?б\.(?=\s*(?:[.,;:!?»)]|$))/giu, "тағы басқа.");
    s = tr(s, /(?<![\p{L}\p{M}])т\.\s?с\.\s?с\.(\s+)(?=[\p{L}\d])/giu, "тағы сол сияқты$1");
    s = tr(s, /(?<![\p{L}\p{M}])т\.\s?с\.\s?с\.(?=\s*(?:[.,;:!?»)]|$))/giu, "тағы сол сияқты.");

    // 2) ORDINALS — `190-шы`, `60-шы`, `19-шы`, `1-ші`. The -шы/-ші/-ншы/-нші suffix is the ordinal
    //    ending; the READING is the ordinal word (жүз тоқсаныншы, алпысыншы). Runs BEFORE the clock
    //    rule so a digit run is not first claimed as a time.
    s = tr(s, /(?<![\d.,])(\d+)(?:-)?(ші|шы|нші|ншы)(?![\p{L}\p{M}])/giu, (m0, d: string, sfx: string) => {
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
    s = tr(s, /(?<![\d.,])(\d+)-([а-яәғқңөұүһі]+)(?![\p{L}\p{M}])/giu, (m0, d: string, tail: string) => {
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

    // 2c) НӨМІР. The NUMERO SIGN was dropped outright — the corpus's «№ 11 ғарышкер» read as *он бір
    //     ғарышкер*, the sign gone. `нөмір` ×1 here ("жергілікті нөмір алу"), and the same corpus writes the
    //     content the other way round in `1 және 2 нөмірлі реакторлар` — the postposed adjectival form, which
    //     suits a different construction and is not what a preposed sign wants. Emitted preposed, the shape ru
    //     and uk already use for this character. ⚠ ONE INSTANCE OF EACH: this is a lead acted on because the
    //     alternative is a silently dropped sign, not a strongly attested reading.
    s = tr(s, /№\s?(?=\d)/gu, "нөмір ");

    // 3) CLOCK, in the COLON form. `08:46` → сегіз қырық алты; `13:15` → он үш он бес. The corpus's
    //    `10: 00` (space after colon) is handled. Runs BEFORE the case-suffix rule so a case-suffixed
    //    clock (`11:00-ден`, `9:30-да`) is read as a time first and the suffix attaches to its last
    //    word. NOT a sports time: a THIRD `\d.\d\d` field means a pace.
    s = tr(s, /(?<![\d:.,])([01]?\d|2[0-3]):\s*([0-5]\d)(?![:.\d])(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан|ның|нің|да|де|та|те|мен|бен|пен)?/giu,
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
    //     ⚠ ZERO MINUTES ARE OMITTED, the same convention the `:`-clock rule above already applies
    //     (`mv === 0 ? hour : hour minute`). It used to fall out of `orthographic(0)` returning the
    //     EMPTY STRING, so `15.00 UTC` read *он бес UTC* by accident; with zero now rendering as a word
    //     the omission has to be stated, or the clock reads *он бес нөл* — "fifteen zero".
    s = tr(s, /(?<![\d.,])(\d{1,2})\.(\d{2})\s*(UTC|GMT)/giu, (_m, h: string, min: string, tz: string) => {
        const mv = Number(min);
        return `${orthographic(Number(h))}${mv === 0 ? "" : ` ${orthographic(mv)}`} ${tz}`;
    });

    // 4) THE CASE SUFFIX — `200-ге`, `8-ден`, `80-нен`, `60-тан`, `1000-нан`, `11:00-ден`, `9:30-да`,
    //    `160 км/сағ-қа`. The suffix tells the CASE; the number becomes words; the ending attaches to
    //    the last word with harmony. ⚠ AGREEMENT CANNOT BE APPLIED TO DIGITS, so
    //    the operand is wordified FIRST. Runs AFTER the clock rule so a clock + suffix reads the time
    //    then the suffix (11:00-ден → он бірден).
    s = tr(s, /(?<![\d.,])(\d+)(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан|ның|нің|да|де|та|те|мен|бен|пен)(?![\p{L}\p{M}])/giu,
        (m0, d: string, sfx: string) => {
            const caseName = CASE_BY_SUFFIX[sfx.toLowerCase()];
            if (caseName === undefined) return m0;
            const n = Number(d);
            // ⚠ This is the OUT-OF-RANGE guard — `orthographic` returns "" above 1e6. It used to catch
            // zero as well, so `0-ге` was left as raw digits; zero now renders and reads *нөлге*.
            if (orthographic(n) === "") return m0;
            return withCase(orthographic(n), caseName);
        });

    // 5) DEGREES. `+ 30 °C-тан` (the degree + ablative suffix — the corpus's form), `35°W` (a
    //    LONGITUDE). `градус` is the degree word. The ablative -тан attaches to it. Runs BEFORE the
    //    case-suffix rule so the °C-тан suffix is not claimed as a bare number suffix. The leading
    //    `+` is claimed here (the plus rule at the end runs after the degree consumed the number).
    s = tr(s, /(^|[\s(])\+\s?(\d+)\s?°\s?C\s?(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?/giu,
        (_m, lead: string, n: string, sfx: string) => {
            const base = `${lead}плюс ${orthographic(Number(n))} градус Цельсий`;
            if (sfx !== undefined && sfx !== "") {
                const caseName = CASE_BY_SUFFIX[sfx.toLowerCase()];
                if (caseName !== undefined) return withCase(base, caseName);
            }
            return base;
        });
    // ⚠ U+2212 HERE TOO — the degree arm runs BEFORE the general sign rule and consumes the number, so a
    // class fixed only at the end would leave `−30 °C` reading as a bare thirty. Same reasoning as there.
    s = tr(s, /(^|[\s(])[-−](\d+)\s?°\s?C\s?(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?/giu,
        (_m, lead: string, n: string, sfx: string) => {
            const base = `${lead}минус ${orthographic(Number(n))} градус Цельсий`;
            if (sfx !== undefined && sfx !== "") {
                const caseName = CASE_BY_SUFFIX[sfx.toLowerCase()];
                if (caseName !== undefined) return withCase(base, caseName);
            }
            return base;
        });
    s = tr(s, /(\d+)\s?°\s?C\s?(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?(?![\p{L}\p{M}])/giu,
        (_m, n: string, sfx: string) => {
            const base = `${orthographic(Number(n))} градус Цельсий`;
            if (sfx !== undefined && sfx !== "") {
                const caseName = CASE_BY_SUFFIX[sfx.toLowerCase()];
                if (caseName !== undefined) return withCase(base, caseName);
            }
            return base;
        });
    s = tr(s, /(\d+)\s?°\s?F\s?(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?(?![\p{L}\p{M}])/giu,
        (_m, n: string, sfx: string) => {
            const base = `${orthographic(Number(n))} градус Фаренгейт`;
            if (sfx !== undefined && sfx !== "") {
                const caseName = CASE_BY_SUFFIX[sfx.toLowerCase()];
                if (caseName !== undefined) return withCase(base, caseName);
            }
            return base;
        });
    s = tr(s, /(\d+)\s?°\s?([NSEW])(?![\p{L}\p{M}])/giu, (_m, n: string, c: string) =>
        `${orthographic(Number(n))} градус ${({ N: "солтүстік", S: "оңтүстік", E: "шығыс", W: "батыс" } as Record<string, string>)[c.toUpperCase()]!}`);

    // 5b) RATES — `83 км/сағ` (km/h), `17 500 миля/сағат` (mph), and the case-suffixed `160 км/сағ-қа`
    //    (the dative -қа attaches to the last word). The tier's `км` unit matches but `/сағ` has no
    //    rateDenominator; compose locally. AFTER the case suffix rule (which claims -қа), BEFORE the
    //    tier. The suffix on a rate is claimed here too (сағатқа = "to the hour").
    s = tr(s, /(\d[\d ]*)\s?(км)\s*\/\s*(сағ|сағат)(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?(?![\p{L}\p{M}])/giu,
        (_m, d: string, u: string, denom: string, sfx: string) => {
            const n = Number(d.replace(/ /gu, ""));
            // ⚠ The ternary this replaced had two identical branches. Here that is CORRECT rather than a
            // bug — the alternation is `(сағ|сағат)`, an abbreviation and its full form, and both read
            // *сағат*. Stated plainly so it does not read as an unfinished branch. (Fula had the same
            // shape and there the branches genuinely should have differed.)
            const base = `${orthographic(n)} километр сағат`;
            if (sfx !== undefined && sfx !== "") {
                const caseName = CASE_BY_SUFFIX[sfx.toLowerCase()];
                if (caseName !== undefined) return withCase(base, caseName);
            }
            return base;
        });
    s = tr(s, /(\d[\d ]*)\s?миля\s*\/\s*сағат(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?(?![\p{L}\p{M}])/giu,
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
    s = tr(s, /(?<![\d.,])(\d[\d ]*)\s*[-–—]\s*(\d[\d ]*)(?![\d.-])/gu, "$1–$2");

    // 7) THE SHARED SYMBOL TIER — %, units. The number must be ADJACENT to its unit and still carry its
    //    decimal comma (2,3), so it runs before step 8 folds the comma into a word.
    s = SYMBOLS(s);

    // 7z) FRACTIONS, AND THE READING COMES FROM THE CORPUS'S OWN AUDIO. There was no fraction rule at all here:
    //     the slash was dropped and the digits read in order, so `1/5` came out *бір бес* ("one five") and `2/3`
    //     *екі үш*. The corpus's only instance is the sample-depth sentence, `5 мм (1/5 дюйм)`, and the notation
    //     is in the TEXT while the reading is only in the AUDIO — so the text tiers cannot answer it at all.
    //
    //     Decoded from kk_kz/train with facebook/wav2vec2-xlsr-53-espeak-cv-ft (the recognizer this repo already
    //     uses for ta/gu/vi/th/mi/sw/zu's plus words):
    //
    //       … b i s   m i l i m e t ə r    b i s ts j e n   b y r    dʒ iː m …
    //          бес     миллиметр           бес-тен   бір          дюйм
    //
    //     ⚠ SO THE DENOMINATOR COMES FIRST, IN THE ABLATIVE, AND THE NUMERATOR FOLLOWS — `бестен бір`, "one out
    //     of five". Not the western order, and not recoverable from the digits: reading `1/5` left to right
    //     gives the two numbers in the wrong sequence AND drops the case that carries the relation.
    //
    //     `withCase(…, "abl")` supplies the ending, including the voiceless variant the audio confirms
    //     (бес ends in с, so -тен and not -ден). Verified across the numerals: бестен бір, үштен екі, төрттен үш,
    //     оннан бір, жүзден бір.
    //
    //     Digits on both sides only, and AFTER the km/сағ rate rules above so a unit slash is already consumed.
    s = tr(s, /(?<![\d.,])(\d{1,3})\s?\/\s?(\d{1,3})(?![\d.,])/gu, (m0, a: string, b: string) => {
        const num = orthographic(Number(a)), den = orthographic(Number(b));
        return num === "" || den === "" ? m0 : `${withCase(den, "abl")} ${num}`;
    });

    // 8) DECIMAL COMMA → the word. Kazakh reads the decimal comma as "бүтін" (whole) with the fraction
    //    as a separate number.
    s = tr(s, /(?<=\d),(?=\d)/gu, " бүтін ");

    // 8b) DOT DECIMALS/VERSIONS — `1.1 суретті` (Figure 1.1, the corpus's only dot-decimal; Kazakh
    //     writes decimals with commas, so a dot is a version/figure number). Read "нүкте" (point).
    //     ⚠ THE SIGNED CASE IS CLAIMED FIRST. Step 9's minus rule needs `[-−]` followed by DIGITS, and
    //     this rule rewrites those digits to words — so run unsigned-first and `-1.5` lost its sign
    //     entirely, reading *бір нүкте бес*. The comma path never had the bug because step 8 only swaps
    //     the separator and leaves the digits for the sign rule to find.
    //     The `(?<![\p{L}\p{Nd}])` guard is step 9's own, and it is what keeps a RANGE out: in
    //     `1.5-2.5` the character before the dash is a digit, so the sign arm declines.
    s = tr(s, /(?<![\p{L}\p{Nd}])[-−](\d+)\.(\d+)(?![\d.])/giu, (m0, i: string, f: string) =>
        `минус ${orthographic(Number(i))} нүкте ${orthographic(Number(f))}`);
    s = tr(s, /(?<![\d.,])(\d+)\.(\d+)(?![\d.])/giu, (m0, i: string, f: string) =>
        `${orthographic(Number(i))} нүкте ${orthographic(Number(f))}`);

    // 9) SIGNS. `+` → "плюс" (the corpus's `+ 30`, `UTC + 1`). A TRUE minus (`-5`) reads "минус".
    s = tr(s, /(^|[\s(])\+\s?(\d)/gu, "$1плюс $2");
    // THE DIVISION SIGN. ⚠ THE DIVISOR TAKES THE DATIVE, exactly as in az, and kk.wikipedia attests the
    //    construction on NUMERIC operands directly:
    //
    //      "санның цифрларының қосындысы 3-ке бөлінсе, онда санның өзі де 3-ке бөлінеді"
    //          if the sum of the number's digits is divisible BY 3, then the number itself is divisible BY 3
    //      "осы санның 2-дәрежесі (яғни квадраты) де 4-ке бөлінеді"
    //
    //    plus the division article itself — "Бөлу - берілген көбейтінді және көбейткіштердің біреуі бойынша …",
    //    and "кейде бөлу амалы қиғаш сызықпен (x/b)" (sometimes the division operation is written with a slash).
    //    `бөлінеді` ×22 / 10 articles, `-ке бөлінеді` ×11 / 9.
    //
    //    ⚠ AND THE SUFFIX MACHINERY WAS ALREADY HERE — `withCase`, built for the corpus's own `200-ге` / `60-тан`
    //    forms, which does harmony AND the voiceless/nasal variants (қырық → қырыққа). So the dative is one
    //    call and nothing about Kazakh morphology is re-derived. Verified across бір…мың: бірге, екіге, үшке,
    //    төртке, беске, алтыға, жетіге, сегізге, тоғызға, онға, жиырмаға, отызға, қырыққа, елуге, алпысқа,
    //    жетпіске, сексенге, тоқсанға, жүзге, мыңға.
    s = tr(s, /(\d+)\s?÷\s?(\d+)/gu, (_m, a: string, b: string) =>
        `${orthographic(Number(a))} ${withCase(orthographic(Number(b)), "dat")} бөлінеді`);

    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
    //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
    //    reading is this language's own two words juxtaposed, and ⚠ both are SIGN names rather than
    //    OPERATION names, which is what ± needs: it marks a TOLERANCE, not an addition.
    s = tr(s, /±/gu, " плюс минус ");
    s = tr(s, /(?<=[A-Z])\s?\+\s?(\d)/gu, " плюс $1");
    // ⚠ U+2212 IS IN THE CLASS AND THE ASCII HYPHEN'S GUARDS ARE UNCHANGED. The MINUS SIGN is a distinct
    // code point whose only Unicode meaning is the arithmetic operator, and it is not on any keyboard —
    // whoever typed it meant a minus. It is not attested in this language's mined corpus, which is why an
    // earlier sweep declined it as invention; the character's identity is the evidence, not the corpus, and
    // dropping a sign INVERTS the value it belongs to. The hyphen is the ambiguous one and keeps every
    // guard it had: leading position only, so a range (`1838−1917`) and a negative exponent (`10−19`) are
    // still refused by the lookbehind.
    s = tr(s, /(?<![\p{L}\p{Nd}])[-−](\d+)(?!\s*[-\d])/gu, "минус $1");
    s = tr(s, /(\d)\s*×\s*(\d)/gu, "$1 есе $2");
    s = tr(s, /(\S)\s*=\s*(\S)/gu, "$1 тең $2");
    s = tr(s, /(\d)\s*<\s*(\d)/gu, "$1 аз $2");
    s = tr(s, /(\d)\s*>\s*(\d)/gu, "$1 көп $2");

    return s;
}

/** Orthographic Kazakh cardinal (the manifest stores IPA; restated here in orthography for the case
 *  suffix and clock rules, which must emit words the g2p reads). */
function orthographic(n: number): string {
    if (n === 0) return ZERO_CARD; // see ZERO_CARD — the positional table has "" here
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
