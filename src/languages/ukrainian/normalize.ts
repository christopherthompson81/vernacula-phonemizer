/**
 * Ukrainian (uk) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Measured over the uk_ua FLEURS corpus (1,925 unique utterances, column 3 — the CASED one):
 *   Cyrillic all-caps runs ×123 (США ×34, ООН ×7, ТБ ×4, ВВП/ЮНЕСКО/ДНК/ФБР/МРТ/АОЛ ×3 each, …)
 *     — `США` came out as the cluster [sʃa], `ДНК` as [dnk], `ВВП` as [wːp].
 *   numeral+suffix notation ×65, of which 30 are true ordinals (`1970-х`, `15-му`, `1-го`, `37-е`),
 *     6 are oblique CARDINALS (`3-х`, `78-ми`, `20-ти`), and 17 are compound adjectives (`28-річний`,
 *     `1600-кілометровий`) that this layer deliberately does NOT claim — see step 4.
 *     Before: the suffix letters were spoken as bare consonants — `1-й` → […ɔdɪn i̯], `15-му` → […mu].
 *   space-grouped thousands ×20 — the number token cannot span a space, so `100 000` read as
 *     *сто нуль* ("a hundred zero") and `5 000 000` as *п'ять нуль нуль*.
 *   ranges with a dash ×19 — the dash was dropped outright, fusing the endpoints (`1418-1450`).
 *   clock times ×18 — the colon is clause punctuation, so `20:30` was *двадцять , тридцять*.
 *   unit abbreviations ×35 (км ×11, мм ×9, км/год ×8, м ×6, кв. км/кв. миль ×6, кг ×2, ГГц ×2, м/с,
 *     Мбіт/с, км²) — every one reached the g2p raw: `км` → [km], `кг` → [kɦ], `ГГц` → [ɦːt͡s], and
 *     `км/год` read год as if it were a word.
 *   comma decimals ×14 — the decimal comma was a phrase break: `1,5 кілометра` → *один , п'ять*.
 *   dotted abbreviations ×13 (кв. ×6, н. е. ×5, р. ×2, див. ×2, ін. ×2, т. п., стор.).
 *   percent ×5 (dropped outright), № ×3 (dropped), °C ×1 (read as the ENGLISH letter C), + sign ×1.
 *
 * NOT a defect here, established by tabulation rather than assumption:
 *   · `N.` (a numeral followed by a period) occurs ×20 and **every single one is a sentence-final period**
 *     — scores (`5:3.`), years (`з 1959.`), figure numbers (`Малюнок 1.1.`). German/Turkish/Polish each
 *     derived a bare-`N.` ordinal rule from this shape; Ukrainian must NOT, because zero of its 20 are
 *     ordinals. No rule is written, and the check that matters is that zero sentence-final pauses are lost.
 *   · dot decimals ×6, of which only 2 are genuine decimals (`2.3 мільярда`, `6.5`); the rest are a
 *     software version (`802.11n` ×2), a figure number (`1.1`) and a time written with a dot (`15.00`).
 *     Only the narrow 1–2-digit-integer + 1-digit-fraction shape is folded to the comma form (step 11).
 *   · currency signs ×0 in this corpus — the corpus spells доларів / фунтів / євро out. The signs are
 *     declared in ukrainian.ts anyway (they were dropped outright), but no rule here depends on them.
 *
 * THREE-WAY COUNT AGREEMENT. Ukrainian takes the SAME selector as Russian, not Polish's: a compound
 * ending in 1 governs the nominative singular (21 відсоток), 2–4 the nominative plural (22 відсотки),
 * everything else and 11–14 the genitive plural (25 / 12 відсотків). This is already established for uk
 * in `ukrainian/numbers.ts`, which uses the shared `slavicCountForm` for its magnitude nouns and cites
 * 21 тисяча / 22 тисячі / 25 тисяч; Polish's divergence (numerals ending in 1 → genitive plural) does not
 * occur here. So `slavicCountForm` is reused rather than a `ukCountForm` being written.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { slavicCountForm } from "../../core/normalizeSymbols.ts";
import { MANIFEST as DEF } from "./manifest.ts";
import { eastSlavicNumberWords } from "./numbers.ts";
import { rewrite } from "../../core/provenance.ts";

/** The cardinal, as words — the same composer the engine's number path uses, so an ordinal's head reads
 *  exactly as a bare numeral would (`1970` → *тисяча дев'ятсот*). */
function cardinal(n: number): string {
    return eastSlavicNumberWords(n, DEF.numbers).map((w) => w ?? "").join(" ").trim();
}

/**
 * Pick a Slavic count form for `n` — the FOUR-way selector this language already declares for the shared
 * symbol tier (see ukrainian.ts `countForm`): nom.sg / nom.pl (2–4) / gen.pl, plus the GENITIVE SINGULAR
 * that a DECIMAL governs (2,4 відсотка).
 *
 * ⚠ THE DECIMAL SLOT IS NOT DECORATION, and the rules below reached it three different wrong ways before
 * this: the metre rule TRUNCATED (`1,5 м` → *метр*, `0,5 м` → *метрів*) and the degree rule counted the
 * FRACTIONAL digits (`2,4 °` matched the `4` and said *градуси*). A unit the shared tier owns sits right
 * beside them — `1,5 км` is *кілометра* — so the same construction got a different agreement
 * depending only on which layer happened to claim the unit.
 */
function counted(n: number, forms: readonly string[]): string {
    return Number.isInteger(n) ? forms[Math.min(slavicCountForm(n), 2)]! : forms[3]!;
}

// ---------------------------------------------------------------------------------------------------
// ORDINALS
// ---------------------------------------------------------------------------------------------------

/**
 * The masculine-nominative ordinal tables (ukrainian.jsonc `ordinals`). `третій` is the one SOFT stem;
 * every other form there is hard (-ий), which is what the paradigm below keys on.
 */
const ORD = DEF.ordinals;

/**
 * Integer → the masculine-nominative ordinal. Only the LAST element inflects (as in Russian, unlike
 * Polish), so a compound is its cardinal head plus the ordinal of the final non-zero part:
 * 1970 → *тисяча дев'ятсот* + сімдесятий, 1800 → *тисяча* + восьмисотий, 2008 → *дві тисячі* + восьмий.
 */
function ordinalBase(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1) return undefined;
    if (n < 20) return ORD.oneToNineteen[n];
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        return u === 0 ? ORD.tens[t] : `${DEF.numbers.tens[String(t * 10)]!} ${ORD.oneToNineteen[u]!}`;
    }
    if (n < 1000) {
        const r = n % 100;
        if (r === 0) return ORD.hundreds[n / 100];
        return `${cardinal(n - r)} ${ordinalBase(r)!}`;
    }
    if (n < 10_000 && n % 1000 === 0) return ORD.thousands[n / 1000];
    if (n < 1_000_000) {
        const r = n % 1000;
        if (r === 0) return undefined; // a round ten-thousand needs its own stem; not attempted
        return `${cardinal(n - r)} ${ordinalBase(r)!}`;
    }
    return undefined;
}

/**
 * The ordinal endings (ukrainian.jsonc `ordinals.endings`), in the order the manifest declares — which is a
 * PREFERENCE order, not a paradigm order, because the written suffix is matched by `endsWith` and several
 * forms share a final letter: `-й` is claimed by both перший and першій, and the masculine nominative is
 * what `1-й` means. `caseIndex` is how the clock rule names a case instead of indexing by a magic number.
 */
const ORD_ENDINGS = ORD.endings;
const CASE_INDEX = new Map(ORD_ENDINGS.map((e, i) => [e.case, i]));
function caseIndex(name: string): number {
    const i = CASE_INDEX.get(name);
    if (i === undefined) throw new Error(`ukrainian.jsonc: ordinals.endings has no case "${name}"`);
    return i;
}

/** Every case form of the ordinal for `n`, in preference order. Only the final word inflects. */
function ordinalForms(n: number): string[] {
    const base = ordinalBase(n);
    if (base === undefined) return [];
    const words = base.split(" ");
    const last = words[words.length - 1]!;
    const soft = last.endsWith("ій"); // третій — the only soft stem in the tables above
    const stem = last.slice(0, -2); // both "ий" and "ій" are two characters
    const head = words.slice(0, -1).join(" ");
    return ORD_ENDINGS.map((e) => `${head ? `${head} ` : ""}${stem}${soft ? e.soft : e.hard}`);
}

// ---------------------------------------------------------------------------------------------------
// OBLIQUE CARDINALS
// ---------------------------------------------------------------------------------------------------

/**
 * GENITIVE cardinals. Ukrainian writes the oblique cardinal the same way it writes an ordinal — digits,
 * hyphen, the last letters of the word — so `3-х` is *трьох* (a cardinal) while `1970-х` is *сімдесятих*
 * (an ordinal). Both shapes occur here (6 cardinals, 30 ordinals) and step 4 disambiguates them.
 * Sources: en.wiktionary.org declension tables for два / три / чотири / п'ять / … / сто.
 * Both halves of a compound decline: 54 → *п'ятдесяти чотирьох*, 78 → *сімдесяти восьми*.
 */
const GEN = DEF.genitiveCardinals;

function genitiveCardinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n >= 1000) return undefined;
    if (n < 20) return GEN.oneToNineteen[n];
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        return u === 0 ? GEN.tens[t] : `${GEN.tens[t]!} ${GEN.oneToNineteen[u]!}`;
    }
    const h = Math.floor(n / 100), r = n % 100;
    return r === 0 ? GEN.hundreds[h] : `${GEN.hundreds[h]!} ${genitiveCardinal(r)!}`;
}

// ---------------------------------------------------------------------------------------------------
// INITIALISMS
// ---------------------------------------------------------------------------------------------------

/** NOTE: every boundary in this file is an explicit lookaround, never `\b` — `\b` is defined on ASCII word
 *  characters and finds none against Cyrillic, so a rule written with it silently matches nothing. That is
 *  exactly how `core/initialisms.ts` was a total no-op for Russian (США → [sʂa]) until it was fixed. */

/** Ukrainian phonotactics, for the OOV rule in core/initialisms.ts. */
export const isUnreadableUkrainian = makeUnreadableTest({
    vowels: new RegExp(`[${DEF.phonotactics.vowels}]`, "u"),
    legalOnsets: new Set(DEF.phonotactics.onsets),
    legalCodas: new Set(DEF.phonotactics.codas),
});

/** Ukrainian has no pronunciation dictionary (its g2p is a flat rule scan), so the "is this recorded"
 *  test cannot be answered — acronyms are decided by the lexical list plus the OOV rule alone. */
export function normalizeUkrainianInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => DEF.letterNames[l],
        acronymLetters: new Set(DEF.acronymLetters),
        isRecorded: () => false,
        isUnreadable: isUnreadableUkrainian,
    })(text);
}

// ---------------------------------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------------------------------

/** Preposition → the `ordinals.endings` case it governs (ukrainian.jsonc `clock`), resolved to the index
 *  `ordinalForms` returns. `FEM_NOM` is the default when no preposition governs. */
const HOUR_CASE: Readonly<Record<string, number>> = Object.fromEntries(
    Object.entries(DEF.clock.prepositionCase).map(([prep, name]) => [prep, caseIndex(name)]),
);
const FEM_NOM = caseIndex(DEF.clock.defaultCase);

// ⚠ THE METRE AND THE SQUARE ADJECTIVE COME FROM THE SYMBOL TIER'S OWN DATA, not from a second copy here.
// Both rules below hold words the tier already declares (`symbols.units.м`, `symbols.exponentWords.squared`),
// and before the lift this file carried its own byte-identical duplicates of each — two sources for one fact,
// with nothing to keep them together.
const METRE = DEF.symbolTier.units["м"]!;
const DEGREE = DEF.degree;
/** Only the gen.pl is ever read (step 3), which is index 2 of the squared adjective's four forms. */
const SQUARE_GEN_PL = DEF.symbolTier.exponentWords.squared[2]!;

// ⚠ ONE SOURCE with the symbol tier in ukrainian.ts: the rate words below are the tier's own
// `rateDenominators`, and `SIGN.times` / `SIGN.ampersand` are what it declares for ⟨×⟩ and ⟨&⟩. `м/с` and
// `миль/год` are composed here only because the tier cannot reach them (see step 6), not because they are
// different words.
const SIGN = DEF.signWords;
const UNIT_PER = DEF.symbolTier.unitPer;
const RATE = DEF.symbolTier.rateDenominators;

/** Abbreviations whose dot is NOT a sentence end (ukrainian.jsonc `dottedAbbrev`). */
const DOTTED_ABBREV = DEF.dottedAbbrev;
const ABBREV_ALT = Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|");

/**
 * The multi-word dotted abbreviations, compiled from `multiDotAbbrev` IN MANIFEST ORDER — `до н. е.` must be
 * tried before `н. е.` or the longer reading is unreachable. The written form is reconstructed rather than
 * stored as a pattern: whitespace AFTER A DOT is optional (both `н. е.` and `н.е.` occur in the corpus),
 * whitespace after a bare word is required.
 */
const MULTI_DOT: readonly (readonly [RegExp, string])[] = DEF.multiDotAbbrev.map(({ written, reading }) => {
    const parts = written.split(" ");
    let src = "(?<![\\p{L}\\p{M}])";
    parts.forEach((part, i) => {
        if (i > 0) src += parts[i - 1]!.endsWith(".") ? "\\s?" : "\\s+";
        src += part.replace(/\./gu, "\\.");
    });
    return [new RegExp(src, "giu"), reading] as const;
});

const NOT_LETTER = "(?![\\p{L}\\p{M}'’ʼ])";

/** Normalize one Ukrainian input string. Pure text→text. */
export function normalizeUkrainian(input: string): string {
    let s = input;

    // 0) DIGIT DE-GROUPING, FIRST — a grouping space or comma is otherwise read as a separate number or as
    //    clause punctuation, and every later rule (units, clock, ordinals) needs the number whole.
    //    Two passes, because the groups overlap on the shared digit (5 000 000). Ukrainian groups with a
    //    SPACE (×20 here); the two comma-grouped instances are a mile-conversion sentence (`6,387 км
    //    (3,980 миль)` = 6387 km / 3980 mi — the conversion checks out), and requiring EXACTLY three
    //    digits keeps every comma DECIMAL in the corpus (1,5 · 2,4 · 6,34 · 12,8 · 14,7 — all 1–2 places)
    //    out of this rule. Zero three-decimal-place numbers occur.
    for (let i = 0; i < 2; i++) s = rewrite(s, /(?<=\d)(?<!(?<![\d\.,])0)[ \u00a0\u202f\u2009](?=\d{3}(?!\d))/gu, "");  // space, NBSP, NNBSP, thin space
    s = rewrite(s, /(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?!\d))/gu, "");
    s = rewrite(s, /[ \u00a0\u202f\u2009]/gu, " ");  // space, NBSP, NNBSP, thin space

    // 1) MULTI-DOT ABBREVIATIONS, before the single-dot rule (step 5) so `н. е.` and `т. п.` are claimed
    //    whole — their interior dots were becoming phrase breaks. Both spacings occur (`н. е.` and `н.е.`).
    //    The FINAL dot is kept when the abbreviation ends the sentence. Without that, the corpus's
    //    "…проіснував приблизно до 1100 року н. е." lost its sentence-final pause outright — the one
    //    regression the corpus diff caught on the first pass, and the check the German run named:
    //    zero sentence-final pauses may be lost.
    for (const [re, word] of MULTI_DOT)
        s = rewrite(s, re, (_m, offset: number, full: string) => {
            const rest = full.slice(offset + _m.length);
            return /^\s*["»)']?\s*$/u.test(rest) ? `${word}.` : word;
        });

    // 2) НОМЕР. The sign was dropped outright (×3, including the unspaced `№11`).
    s = rewrite(s, /№\s?(?=\d)/gu, `${DEF.numberSign} `);

    // 3) `кв.` = квадратний, an AGREEING adjective — so it needs the count, which is why it runs before the
    //    de-grouping's output is consumed by anything else and before the shared unit tier. `кв. км` folds
    //    to the `км²` the shared exponent seam already understands; `кв. миль` cannot, because миль is a
    //    spelled-out word rather than a unit abbreviation, so it is composed here.
    s = rewrite(s, /(\d)\s?кв\.\s?км(?![\p{L}\p{M}])/gu, "$1 км²");
    //    `кв. миль` takes the GENITIVE PLURAL adjective outright rather than a count form: the noun is
    //    written миль (gen.pl) in all three corpus instances, so the adjective must agree with what the
    //    text actually says, not with what the numeral would otherwise govern (9 174 квадратних миль).
    s = rewrite(s, /(\d)\s?кв\.\s?миль(?![\p{L}\p{M}])/gu, `$1 ${SQUARE_GEN_PL} миль`);

    // 4) NUMERAL + WRITTEN SUFFIX. The suffix is the last letters of the FULL word, not an appendable
    //    ordinal marker, and the word may be an ordinal (`1970-х` = сімдесятих) or an oblique CARDINAL
    //    (`3-х` = трьох). Three things make this safe:
    //      · the suffix is capped at 3 letters and must not be followed by another letter, which excludes
    //        the 17 compound ADJECTIVES (`28-річний`, `1600-кілометровий`, `25-хвилинну`). Those are left
    //        alone on purpose: reading them needs the combining stem (двадцятивосьмирічний), and the
    //        current cardinal-plus-word output is at least the right words in the right order.
    //      · `-ти`/`-ми` are cardinal-only endings; `-х`/`-их` are the decade ORDINAL when the number is a
    //        round 20-or-more (1970-х, 1920-их) and a cardinal otherwise (3-х, 54-х). Derived from the
    //        corpus: all 10 `-х` decades are round years ≥1800, all 4 `-х` cardinals are 1–2 digits.
    //      · every candidate is accepted only if it actually ENDS with the written letters. That guard is
    //        what makes the paradigm safe to guess with — `400-от` falls through the ordinal forms (none
    //        ends in -от) onto *чотирьохсот*, which does.
    //    MUST run before the range rule (step 9), which would otherwise eat the hyphen.
    s = rewrite(s, new RegExp(`(?<![\\d.,])(\\d+)\\s?-\\s?([а-яіїєґ]{1,3})${NOT_LETTER}`, "giu"),
        (whole, digits: string, rawSuffix: string) => {
            const n = Number(digits);
            const suffix = rawSuffix.toLowerCase();
            const cardinalFirst = suffix === "ти" || suffix === "ми"
                || ((suffix === "х" || suffix === "их") && !(n >= 20 && n % 10 === 0));
            const gen = genitiveCardinal(n);
            if (cardinalFirst) return gen !== undefined && gen.endsWith(suffix) ? gen : whole;
            const form = ordinalForms(n).find((f) => f.endsWith(suffix));
            if (form !== undefined) return form;
            return gen !== undefined && gen.endsWith(suffix) ? gen : whole;
        });

    // 5) DOTTED ABBREVIATIONS. The dot is consumed before a following word or a comma, so it cannot become
    //    a phrase break; at a real sentence end it is kept. Runs AFTER step 1 so `н. е.` is already gone.
    s = rewrite(s, new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(\\s+)(?=[\\p{L}\\d(])`, "giu"),
        (m0, ab: string, sp: string) => {
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122): the pattern is built from this table's own
            // keys but carries `i`+`u`, so JS's fold widens it and a near-miss matches while its
            // key is absent. The `!` here made `String.replace` stringify `undefined`.
            const w = DOTTED_ABBREV[ab.toLowerCase()];
            return w === undefined ? m0 : `${w}${sp}`;
        });
    s = rewrite(s, new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(?=\\s*[,;:])`, "giu"),
        (_m, ab: string) => DOTTED_ABBREV[ab.toLowerCase()]!);
    s = rewrite(s, new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(?=\\s*(?:[.!?»)]|$))`, "giu"),
        (m0, ab: string) => {
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122): the pattern is built from this table's own
            // keys but carries `i`+`u`, so JS's fold widens it and a near-miss matches while its
            // key is absent. The `!` here made `String.replace` stringify `undefined`.
            const w = DOTTED_ABBREV[ab.toLowerCase()];
            return w === undefined ? m0 : `${w}.`;
        });

    // 6) UNITS the shared symbol tier cannot express.
    //    · `м` is deliberately NOT declared as a shared unit: the tier's trailing guard is
    //      `(?![\p{L}\p{M}])`, and the Ukrainian APOSTROPHE is neither, so `41 м'яч` ("41 balls") would
    //      have become *сорок один метр'яч*. Handled here with an apostrophe-aware guard instead.
    //      Reported as a core limitation rather than patched — see the commit message.
    //    · `м/с` follows from the same exclusion: with м out of `units`, the rate cannot compose there.
    //    · `миль/год` has a SPELLED-OUT numerator, which the tier (abbreviation keys only) cannot match.
    //    Units run BEFORE the clock and before the decimal fold, because both destroy number adjacency.
    s = rewrite(s, /(\d+(?:[.,]\d+)?)\s?м\/с(?![\p{L}\p{M}])/gu,
        (_m, n: string) => `${n} ${counted(Number(n.replace(",", ".")), METRE)} ${UNIT_PER} ${RATE["с"]!}`);
    s = rewrite(s, new RegExp(`(\\d+(?:[.,]\\d+)?)\\s?м(?![\\p{L}\\p{M}'’ʼ²³/])`, "gu"),
        (_m, n: string) => `${n} ${counted(Number(n.replace(",", ".")), METRE)}`);
    //      The 3-letter lookbehind is what keeps this off `км/год`, which the shared tier composes itself.
    s = rewrite(s, /(?<=[\p{L}\p{M}]{3})\s?\/\s?год(?![\p{L}\p{M}])/gu, ` ${UNIT_PER} ${RATE["год"]!}`);
    //      ⚠ THE SCALE RULES READ THE WHOLE NUMBER, not its last digit. `(\d)` was invisible while the word
    //      was a hard-coded gen.pl (`+30°C` → *плюс 30 градусів Цельсія*, right by luck) and wrong the
    //      moment the count is read off it — and with no agreement applied at all, `1 °C` was
    //      *один градусів Цельсія* regardless of the capture.
    s = rewrite(s, /(\d+(?:[.,]\d+)?)\s?°\s?[CСc](?![\p{L}\p{M}])/gui,
        (_m, n: string) => `${n} ${counted(Number(n.replace(",", ".")), DEGREE)} ${DEF.temperatureScales["C"]!}`);
    s = rewrite(s, /(\d+(?:[.,]\d+)?)\s?°\s?[FФf](?![\p{L}\p{M}])/gui,
        (_m, n: string) => `${n} ${counted(Number(n.replace(",", ".")), DEGREE)} ${DEF.temperatureScales["F"]!}`);
    s = rewrite(s, /(\d+(?:[.,]\d+)?)\s?°/gu, (_m, n: string) => `${n} ${counted(Number(n.replace(",", ".")), DEGREE)}`);

    // 7) CLOCK. The colon is clause punctuation in ukrainian.jsonc, so `20:30` read as *двадцять ,
    //    тридцять*. Ukrainian says the hour as a FEMININE ORDINAL agreeing with the elided *година*, in
    //    the case the preposition governs — о двадцятій тридцять, з шостої тридцять, між двадцять другою.
    //    The preceding word is read off the text rather than captured, so the lookbehind stays simple.
    //    Two-digit minutes are REQUIRED, which is what keeps the corpus's scores and ratios (`5:3`, `3:2`,
    //    `26 - 00`) out of this rule.
    s = rewrite(s, /(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:.,])/gu,
        (whole: string, h: string, min: string, offset: number, full: string) => {
            const hv = Number(h), mv = Number(min);
            if (hv === 0) return whole; // *нульова година* is not said; leave it
            const prev = /([\p{L}\p{M}']+)\s+$/u.exec(full.slice(0, offset))?.[1]?.toLowerCase();
            const idx = (prev !== undefined ? HOUR_CASE[prev] : undefined) ?? FEM_NOM;
            const forms = ordinalForms(hv);
            const head = forms[idx];
            if (head === undefined) return whole;
            return mv === 0 ? head : `${head} ${mv}`;
        });

    // 8) SIGNS. `+30°C` lost its sign entirely (the ° rule above has already made it `+30 градусів …`).
    s = rewrite(s, /(^|[\s(])[-−–](\d)/gu, `$1${SIGN.minus} $2`);
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
    //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
    //    reading is this language's own two words juxtaposed, both taken from the plus and minus rules
    //    already in this file.
    s = rewrite(s, /±/gu, ` ${SIGN.plusMinus} `);
    s = rewrite(s, /(^|[\s(])\+\s?(\d)/gu, `$1${SIGN.plus} $2`);

    // 8b) RELATIONAL AND DIVISION SIGNS. uk.wikipedia's division article reads the whole expression
    //     aloud, both signs, operands in place, and — the part that matters for a case language — with the
    //     result in the NOMINATIVE:
    //
    //       "двадцять розділене на п'ять дорівнює чотири, або чотири є результатом ділення двадцяти на п'ять"
    //
    //     ⚠ `дорівнює` GOVERNS THE DATIVE IN CAREFUL PROSE (`дорівнює нулю`, ×12 attested that way), which
    //     `numbers.ts` cannot produce — it emits nominative cardinals. The quote above is what makes this
    //     shippable: in the arithmetic slot the source itself writes `дорівнює чотири`, nominative, so the
    //     reading needs no case repair. Contrast `ru`, where no such nominative attestation existed and the
    //     comparatives had to move to the `чем` construction.
    //
    //     ⚠ THE COMPARATIVES STILL DO NEED `ніж`, for the same reason as Russian: bare `менше` takes the
    //     genitive (`менше нуля`). `ніж` takes the nominative and is corpus-attested (`менше ніж` ×6,
    //     `більше ніж` ×7 phrase hits in uk_ua).
    //
    //     ⚠ ON `поділити на` (×5) VS `розділене на` (×1). These are NOT two senses — Ukrainian uses one
    //     preposition for both, so `поділити на чотири` is ambiguous exactly where English distinguishes
    //     *divide into* from *divide by*. The sense lives in the ARGUMENT: the ×5 hits take plural nouns
    //     ("поділити на чотири періоди" — into four periods), which is neither evidence for a numeric operand
    //     nor evidence against it. `розділене на` is chosen because the gloss above puts it in the exact slot
    //     between two numerals, not because the alternative is wrong. (Italian's `sorella minore di` IS a
    //     different construction — an age adjective plus a partitive — and that distinction is real.)
    s = rewrite(s, /\s?=\s?/gu, ` ${SIGN.equals} `);
    s = rewrite(s, /\s?<\s?/gu, ` ${SIGN.lessThan} `);
    s = rewrite(s, /\s?>\s?/gu, ` ${SIGN.greaterThan} `);
    s = rewrite(s, /\s?÷\s?/gu, ` ${SIGN.dividedBy} `);

    // 9) NUMERIC RANGES. The dash between two numbers was dropped outright, fusing the endpoints
    //    (`1418-1450` became one run of words). Digits are required on BOTH sides so that `COVID-19`,
    //    `A1GP` and `Гран-прі` cannot match. Runs AFTER the ordinal rule (step 4), which needs the hyphen.
    //    KNOWN false positives, counted rather than assumed: 3 of the 19 dashes are SCORES (`6-6`, `7–2`,
    //    `26 - 00`) where "до" is the wrong connective — but the endpoints were fusing there too, so no
    //    reading is lost, only a wrong-ish connective gained.
    s = rewrite(s, /(\d)\s?[–—-]\s?(?=\d)/gu, `$1 ${DEF.rangeWord} `);

    // 10) FRACTIONS — feminine, agreeing with the elided *частина*: 1/5 is *одна п'ята*.
    //     ⚠ THE FEMININE 1 AND 2 ARE `numbers.feminine`, the pair the magnitude compositor already uses for
    //     the feminine тисяча (одна тисяча, дві тисячі) — and the masculine forms they replace are
    //     `numbers.units[1]` and `[2]`. This rule held its own copies of all four.
    s = rewrite(s, /(?<![\d\p{L}])(\d{1,3})\/(\d{1,3})(?![\d/\p{L}])/gu, (whole, a: string, b: string) => {
        const num = Number(a), den = Number(b);
        const fem = ordinalForms(den)[FEM_NOM];
        if (fem === undefined) return whole;
        const numWord = cardinal(num)
            .replace(new RegExp(`${DEF.numbers.units[1]!}$`, "u"), DEF.numbers.feminine.one)
            .replace(new RegExp(`${DEF.numbers.units[2]!}$`, "u"), DEF.numbers.feminine.two);
        return `${numWord} ${fem}`;
    });

    // 11) DOT DECIMALS → the comma form the engine's number token reads. Narrow ON PURPOSE (see header):
    //     only a 1–2-digit integer with a single fractional digit, which claims the two genuine decimals
    //     (`2.3 мільярда`, `6.5`) and rejects the version string `802.11n` and the dot-time `15.00`.
    s = rewrite(s, /(?<![\d.])(\d{1,2})\.(\d)(?![\d.])/gu, "$1,$2");

    return s;
}
