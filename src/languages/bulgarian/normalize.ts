/**
 * Bulgarian (bg) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the
 * Bulgarian g2p cannot already read into Bulgarian words the existing pipeline speaks. Pure text→text, no
 * IPA. Runs inside bulgarian.ts's `text()`, before the tokenizer.
 *
 * ⚠ `N г.` IS THE DOMINANT PATTERN, and it is specific to this language. `1767 г.` is the ordinary way
 * Bulgarian writes a year, and unhandled it reads as the numeral, then the LETTER `г` as [k], then a SENTENCE
 * BREAK from the abbreviation dot. It expands to `година`.
 *
 * ⚠ NO ORDINAL-DOT RULE. Bulgarian does not write the Germanic ordinal dot at all — no `N.` is followed by a
 * lowercase word — so the rule that is largest in Norwegian and Danish must not exist here. Porting a
 * neighbour's biggest rule would fire on sentence boundaries.
 *
 * ⚠ UNITS ARE WRITTEN IN BOTH SCRIPTS, mostly Cyrillic — `км`, `кг`, `см`, `м` — where Norwegian, Danish and
 * Romanian all use Latin `km`. A Latin-only unit table therefore misses the bulk of them, and `км2` reaches the
 * output as the Latin letters "km" plus the numeral "две". Both key sets are declared; see `UNIT`.
 *
 * ⚠ THE COUNT FORM IS THE COUNTING PLURAL. Bulgarian says `18 процента`, `50 километра`, `20 градуса` — the
 * form after a numeral, not the citation singular (`процент`, `километър`, `градус`).
 *
 * ⚠ NO PERIOD RULES AT ALL. Bulgarian has no period-grouped thousands form, unlike Danish and Romanian, and
 * the `HH.MM` shapes that do occur are `802.11a/b/g/n` plus sports times (`4:41.30`).
 *
 * ORDERING, each constraint a bug that happened:
 *   · THE YEAR ABBREVIATION consumes its dot BEFORE the dot can become a sentence end.
 *   · DE-GROUPING FIRST, before anything reads a bare number.
 *   · DEGREES BEFORE the unit rules — the C of `20 °C` was read as the English letter name [sˈiː].
 *   · km² BEFORE the plain unit rule, or `км` is consumed and the exponent left stranded.
 */

/**
 * Unit abbreviations → the COUNTING form of the word. Longest first.
 *
 * ⚠ BOTH SCRIPTS. Cyrillic is the bulk of it, but Bulgarian also writes LATIN abbreviations after a numeral
 * ("Стандартният 35 mm филм (негатив 36 на 24 mm)"), and those reach the output as the raw letters. The Latin
 * keys map to the identical words, so this is an alias list rather than new data.
 *
 * ⚠ `м` AND `г` GET NO LATIN ALIAS, on purpose. A one-letter Latin key would collide with `m`/`g` inside
 * ordinary Bulgarian-transliterated text; the Cyrillic one-letter keys are safe because a Latin `m` cannot
 * appear inside a Cyrillic word.
 */
const UNITS: [string, string][] = [
    ["км", "километра"],
    ["кг", "килограма"],
    ["см", "сантиметра"],
    ["мм", "милиметра"],
    ["km", "километра"],
    ["kg", "килограма"],
    ["cm", "сантиметра"],
    ["mm", "милиметра"],
    ["м", "метра"],
    ["г", "грама"],
];

/** Squared / cubed units. Bulgarian PREPOSES the modifier as a separate adjective — `квадратни
 *  километра`, unlike Romanian's postposed `kilometri pătrați` and the Germanic single-word compound. */
const SQUARED: [RegExp, string][] = [
    // ⚠ BOTH boundaries are `\p{L}` lookarounds, never `\b`. `\b` is defined on ASCII word characters, so
    // it finds no boundary next to a CYRILLIC letter and the rule silently never fires — `км2` stayed
    // `км2`. ⚠ IN A NON-ASCII ORTHOGRAPHY `\b` IS NEVER THE RIGHT BOUNDARY.
    // ⚠ THE LATIN KEY AND ITS EXPONENT MUST MOVE TOGETHER. Give the plain unit a Latin alias without this
    // one and `50 km2` reads "километра ДВЕ" — the unit substituted and the exponent left to be spoken as a
    // bare numeral, which is worse than the raw `km` it replaced.
    // Bulgarian's own one-letter `м` keeps no Latin alias, so `m2` is deliberately not matched.
    [/(?<!\p{L})(?:км|km)\s*[²2](?!\d)/giu, "квадратни километра"],
    [/(?<!\p{L})м\s*[²2](?!\d)/giu, "квадратни метра"],
    [/(?<!\p{L})(?:км|km)\s*[³3](?!\d)/giu, "кубични километра"],
    [/(?<!\p{L})м\s*[³3](?!\d)/giu, "кубични метра"],
];

/** Currency sign → the counting form. */
const CURRENCY: Readonly<Record<string, string>> = {
    "$": "долара", "€": "евро", "£": "паунда", "¥": "йени",
};

/** Relational and operator signs, read in every position — a dropped sign is inaudible. */
const RELATIONAL: [RegExp, string][] = [
    [/±/gu, " плюс минус "],
    [/≈/gu, " приблизително равно на "],
    [/≤/gu, " по-малко или равно на "],
    [/≥/gu, " по-голямо или равно на "],
    [/=/gu, " равно на "],
    [/</gu, " по-малко от "],
    [/>/gu, " по-голямо от "],
    // ⚠ ASCII `x` TOO, not only `×`: `NxN` forms outnumber `×` roughly 85 to 20 across the corpora, and the
    // bare `x` was reaching the phoneme stream as its own LETTER NAME. Digit-bounded, so it cannot claim a letter.
    [/×|(?<=\p{Nd})[ \t]?x[ \t]?(?=\p{Nd})/gu, " по "],
    [/÷/gu, " делено на "],
];

export function normalizeBulgarian(input: string): string {
    let t = input;

    // 1) THE YEAR ABBREVIATION `N г.` — FIRST, so the abbreviation dot never reaches clausePunctuation as a
    //    sentence end. The bare `г` is otherwise read as a LETTER, [k].
    //    ⚠ REQUIRES A PRECEDING NUMBER, because `г.` elsewhere is `господин` and not a year.
    t = t.replace(/(\d)\s*г\./gu, "$1 година");

    // 2) ERA MARKER `пр.н.е.` — "преди новата ера", before the common era. Must run with the year rule and
    //    before anything else claims a dot: it carries THREE abbreviation dots, each becoming a sentence
    //    break, so `323 г. пр.н.е.` fragments into four clauses.
    t = t.replace(/пр\.\s*н\.\s*е\./giu, "преди новата ера");
    t = t.replace(/сл\.\s*н\.\s*е\./giu, "след новата ера");

    // 3) RATES — `мили/час` and the abbreviated `/ч`, spoken with `в` ("per"). Before the unit rule, or the
    //    numerator is consumed and the slash left bare.
    t = t.replace(/(?<!\p{L})км\s*\/\s*ч(?!\p{L})/giu, "километра в час");
    t = t.replace(/(\p{L}+)\s*\/\s*час(?!\p{L})/giu, "$1 в час");
    //    The SECOND-based rate is the same construction with `в секунда`; without it `133 м/сек` reads the
    //    denominator as the bare syllable [sɛk] and `м/с` as [s].
    t = t.replace(/(?<!\p{L})м\s*\/\s*(?:сек|с)(?!\p{L})/giu, "метра в секунда");
    //    AND THE LATIN ABBREVIATIONS, for the reason `UNIT` gives: a foreign-sourced `120 km/h` reaches the
    //    g2p with the denominator as the ENGLISH LETTER NAME [ˈeᶦt͡ʃ]. The plain Latin `km` already read
    //    correctly; only the rate did not.
    t = t.replace(/(?<!\p{L})km\s*\/\s*h(?!\p{L})/giu, "километра в час");
    t = t.replace(/(?<!\p{L})m\s*\/\s*s(?!\p{L})/giu, "метра в секунда");

    // 4) SPACE-GROUPED THOUSANDS. ⚠ A space is a token boundary, so `5 000` reads as "пет нула" — "five
    //    zero". Includes NBSP and the narrow NBSP.
    let prev: string;
    do {
        prev = t;
        t = t.replace(/(\d)[   ](\d{3})(?!\d)/gu, "$1$2");
    } while (t !== prev);

    // 5) DECIMAL COMMA. The comma is clause punctuation, so `12,5` reads as "дванайсет , пет" — a PAUSE
    //    inside a number. ⚠ Bulgarian reads the separator as `цяло и` ("whole and"), not as a bare "comma";
    //    the fractional part follows digit by digit.
    t = t.replace(/(\d+),(\d+)/gu, (_m, whole: string, frac: string) =>
        `${whole} цяло и ${[...frac].join(" ")}`);

    // 6) CLOCK, COLON FORM ONLY. The colon reaches clausePunctuation as a COMMA PAUSE, so `22:00` reads as
    //    "двайсет и две , нула". There is no period-clock form — see the header.
    t = t.replace(/(\d{1,2}):(\d{2})(?!\d)/gu, "$1 $2");

    // 6b) НОМЕР. The NUMERO SIGN is dropped outright — "космонавт № 11" reads as *космонавт единадесет*.
    //     ⚠ THIS CHARACTER IS DELIBERATELY EXCLUDED FROM THE ℃ FOLD: NFKC maps № to the Latin "No", which a
    //     Bulgarian g2p reads as an English word. A compatibility character can need a WORD rather than a fold.
    t = t.replace(/№\s?(?=\d)/gu, "номер ");

    // 7) PERCENT → the counting plural `процента`; see the header on count forms.
    t = t.replace(/(\d+)\s*%/gu, "$1 процента");

    // 8) DEGREES, BEFORE the unit rules — the C of `20 °C` is otherwise read as the English letter name.
    t = t.replace(/℃/gu, "°C").replace(/℉/gu, "°F");
    t = t.replace(/(\d)\s*°\s*C(?!\p{L})/giu, "$1 градуса по Целзий");
    t = t.replace(/(\d)\s*°\s*F(?!\p{L})/giu, "$1 градуса по Фаренхайт");
    t = t.replace(/(\d)\s*°/gu, "$1 градуса");

    // 9) SQUARED / CUBED UNITS, ⚠ BEFORE the plain unit rule — otherwise `км` is consumed first and the
    //    exponent is left stranded. Accepts both the superscript and the ASCII digit (`км2`).
    for (const [re, word] of SQUARED) t = t.replace(re, word);

    // 10) CYRILLIC UNIT ABBREVIATIONS after a number. ⚠ The trailing guard is `(?!\p{L})` and NOT `\b`:
    //    `\b` is defined on ASCII word characters and finds no boundary after a Cyrillic letter, so the rule
    //    would silently never fire.
    for (const [abbr, word] of UNITS)
        t = t.replace(new RegExp(`(\\d)\\s*${abbr}(?!\\p{L})`, "gu"), `$1 ${word}`);

    // 11) RANGES, spoken `до`.
    t = t.replace(/(?<![-–—])(\d+)\s*[-–—]\s*(\d+)(?!\d)(?!\s*[-–—]\s*\d)/gu, "$1 до $2");

    // 12) CURRENCY, both placements.
    for (const [sign, word] of Object.entries(CURRENCY)) {
        const esc = sign.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
        t = t.replace(new RegExp(`${esc}\\s*(\\d+)`, "gu"), `$1 ${word}`);
        t = t.replace(new RegExp(`(\\d+)\\s*${esc}`, "gu"), `$1 ${word}`);
    }

    // 13) SIGNED NUMBERS — a sign PREFIXED to a number. After ranges so a range's dash is already gone.
    t = t.replace(/(?<![\p{L}\d])([-−+])(\d+)/gu, (_m, sign: string, n: string) =>
        `${sign === "+" ? "плюс" : "минус"} ${n}`);

    // 14) ARITHMETIC AND RELATIONAL SIGNS — infix between digits is where arithmetic lives; the
    //     relational signs are read in every position.
    t = t.replace(/(\d)\s*\+\s*(\d)/gu, "$1 плюс $2");
    for (const [re, word] of RELATIONAL) t = t.replace(re, word);

    // 15) AMPERSAND → и.
    t = t.replace(/\s*[&＆]\s*/gu, " и ");

    // The insertions above pad with spaces so a sign never fuses with its neighbours; collapse the runs.
    return t.replace(/[ \t]{2,}/gu, " ");
}
