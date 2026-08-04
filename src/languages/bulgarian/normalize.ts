/**
 * Bulgarian (bg) TEXT NORMALIZATION (#562) — the pre-tokenizer pass that rewrites everything the
 * Bulgarian g2p cannot already read into Bulgarian words the existing pipeline speaks. Pure text→text, no
 * IPA. Runs inside bulgarian.ts's `text()`, before the tokenizer.
 *
 * MEASURED OVER THE FLEURS bg_bg CORPUS, column 3 (the ORIGINAL cased text):
 *   `N г.` year          265   ← by far the largest defect, and specific to this language
 *   space-grouped N NNN   53      Cyrillic units `N км`  50      colon clock HH:MM  41
 *   decimal comma N,N     39      percent  N %           18      decade `N-те`      20
 *   ranges N–N             9      km²                     4      degrees  N °        2
 *
 * Bulgarian's engine is rule-based, so every word below was probed through the g2p rather than looked up:
 * `година` → [ɡɔdina], `процента` → [prɔt͡sɛnta], `квадратни километра` → [kvadratni kiɫɔmɛtra].
 *
 * ★ `N г.` IS THE HEADLINE, and nothing in the previous four languages resembles it. `1767 г.` is the
 * ordinary way Bulgarian writes a year, and it was reading as the numeral, then the LETTER `г` as [k],
 * then a SENTENCE BREAK from the abbreviation dot. 265 instances — more than every other numeric pattern
 * in the corpus combined. It expands to `година`.
 *
 * ★ NO ORDINAL-DOT RULE, for the same measured reason as Romanian: of the 54 `N.` shapes, ZERO are
 * followed by a lowercase word and 2 by a capital. Bulgarian does not write the Germanic ordinal dot, so
 * the rule that is largest in Norwegian and Danish must not exist here either. That is now two of five
 * languages in this sequence where porting the previous one's biggest rule would have fired on sentence
 * boundaries.
 *
 * ⚠ UNITS ARE WRITTEN IN CYRILLIC — `км` (50), `кг`, `см`, `м` — not the Latin `km` that Norwegian,
 * Danish and Romanian all use. A Latin unit table matches nothing here. `км2` was reaching the output as
 * the Latin letters "km" plus the numeral "две".
 *
 * ⚠ THE COUNT FORM IS THE COUNTING PLURAL. Bulgarian says `18 процента`, `50 километра`, `20 градуса` —
 * the form after a numeral, not the citation singular (`процент`, `километър`, `градус`). Measured in the
 * corpus: every `N %` written out uses `процента` (8/8).
 *
 * ⚠ NO PERIOD RULES AT ALL. There is no period-grouped thousands form (0 instances, unlike Danish's 99
 * and Romanian's 56), and the 15 `HH.MM` shapes are `802.11a/b/g/n` plus sports times (`4:41.30`).
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
 * BOTH SCRIPTS, and the header's claim that "a Latin unit table matches nothing here" is half right (#586).
 * Cyrillic is what the corpus mostly writes — км ×50, см ×5, кг ×4, мм ×3, all after a numeral — but it also
 * writes LATIN abbreviations 14 times, every one of them after a numeral:
 *
 *   "Стандартният 35 mm филм (негатив 36 на 24 mm)"     mm ×12 · cm ×2
 *
 * Those were reaching the output as the raw letters, the same `ˈʊkm` shape found fleet-wide. The Latin keys map
 * to the identical words, so this is an alias list rather than new data — exactly the gap Kazakh had, where the
 * words were right and only the Cyrillic spelling of the KEY was declared.
 *
 * `м` and `г` get NO Latin alias on purpose. A one-letter key is the documented `Il-76s` hazard, and in Latin
 * it would also collide with `m`/`g` inside ordinary Bulgarian-transliterated text; the Cyrillic one-letter
 * keys are safe because a Latin `m` cannot appear inside a Cyrillic word.
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
    // `км2`. This is the third instance of the same trap in two languages (the Romanian rate rule ended
    // `or[ăa]\b`, and the trailing guard in step 8 below is written correctly for exactly this reason).
    // In a non-ASCII orthography `\b` is never the right boundary.
    // The Latin `km` is accepted here for the same reason it is in `UNITS` (#586): once the plain unit gained
    // a Latin alias, `50 km2` read "километра ДВЕ" — the unit substituted and the exponent left to be spoken
    // as a bare numeral, which is worse than the raw `km` it replaced. The pair must move together.
    // Bulgarian's own one-letter `м` keeps no Latin alias, so `m2` is deliberately not matched.
    [/(?<!\p{L})(?:км|km)\s*[²2](?!\d)/giu, "квадратни километра"],
    [/(?<!\p{L})м\s*[²2](?!\d)/giu, "квадратни метра"],
    [/(?<!\p{L})(?:км|km)\s*[³3](?!\d)/giu, "кубични километра"],
    [/(?<!\p{L})м\s*[³3](?!\d)/giu, "кубични метра"],
];

/** Currency sign → the counting form. долара 12, евро 39, лева 6 in the corpus. */
const CURRENCY: Readonly<Record<string, string>> = {
    "$": "долара", "€": "евро", "£": "паунда", "¥": "йени",
};

/** Relational and operator signs, read in every position — a dropped sign is inaudible. `минус` is
 *  attested 4 times; the rest were probed through the g2p. */
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

    // 1) THE YEAR ABBREVIATION `N г.` (265) — FIRST, so the abbreviation dot never reaches
    //    clausePunctuation as a sentence end. The bare `г` was also being read as a LETTER, [k].
    //    Requires a preceding number, because `г.` elsewhere is `господин` and not a year.
    t = t.replace(/(\d)\s*г\./gu, "$1 година");

    // 2) ERA MARKER `пр.н.е.` (17) — "преди новата ера", before the common era. Must run with the year
    //    rule and before anything else claims a dot: it carries THREE abbreviation dots, each of which
    //    was becoming a sentence break, so `323 г. пр.н.е.` fragmented into four clauses.
    t = t.replace(/пр\.\s*н\.\s*е\./giu, "преди новата ера");
    t = t.replace(/сл\.\s*н\.\s*е\./giu, "след новата ера");

    // 3) RATES — `мили/час` (2) and the abbreviated `/ч` (24). Spoken with `в` ("per"), attested 15
    //    times as `в час`. Before the unit rule, or the numerator is consumed and the slash left bare.
    t = t.replace(/(?<!\p{L})км\s*\/\s*ч(?!\p{L})/giu, "километра в час");
    t = t.replace(/(\p{L}+)\s*\/\s*час(?!\p{L})/giu, "$1 в час");
    //    THE SECOND, which this rule did not cover: the corpus's `133 м/сек` read the denominator as the bare
    //    syllable [sɛk] and `м/с` as [s]. `в секунда` ×2 ("1,5 километра в секунда"), the same construction.
    t = t.replace(/(?<!\p{L})м\s*\/\s*(?:сек|с)(?!\p{L})/giu, "метра в секунда");
    //    AND THE LATIN ABBREVIATIONS. Cyrillic is what this corpus writes and the header is right about that,
    //    but a foreign-sourced `120 km/h` reached the g2p with the denominator as the ENGLISH LETTER NAME
    //    [ˈeᶦt͡ʃ] — the same reason ru, uk and kk each declare Latin aliases beside their Cyrillic keys. The
    //    plain Latin `km` already read correctly here; only the rate did not.
    t = t.replace(/(?<!\p{L})km\s*\/\s*h(?!\p{L})/giu, "километра в час");
    t = t.replace(/(?<!\p{L})m\s*\/\s*s(?!\p{L})/giu, "метра в секунда");

    // 4) SPACE-GROUPED THOUSANDS (53). A space is a token boundary, so `5 000` read as "пет нула" —
    //    "five zero". Includes NBSP and the narrow NBSP.
    let prev: string;
    do {
        prev = t;
        t = t.replace(/(\d)[   ](\d{3})(?!\d)/gu, "$1$2");
    } while (t !== prev);

    // 5) DECIMAL COMMA (39). The comma is clause punctuation, so `12,5` read as "дванайсет , пет" — a
    //    PAUSE inside a number. Bulgarian reads the separator as `цяло и` ("whole and"), not a bare
    //    "comma"; the fractional part follows digit by digit.
    t = t.replace(/(\d+),(\d+)/gu, (_m, whole: string, frac: string) =>
        `${whole} цяло и ${[...frac].join(" ")}`);

    // 6) CLOCK, COLON FORM ONLY (41). The colon was reaching clausePunctuation as a COMMA PAUSE, so
    //    `22:00` read as "двайсет и две , нула". There is no period-clock form — see the header.
    t = t.replace(/(\d{1,2}):(\d{2})(?!\d)/gu, "$1 $2");

    // 6b) НОМЕР. The NUMERO SIGN was dropped outright — "космонавт № 11" read as *космонавт единадесет*, the
    //     sign silently gone. `номер` ×5 in this corpus (plus `номера` ×1), and ru and uk already read the sign
    //     exactly this way, preposed before the figure. THIS IS THE CHARACTER DELIBERATELY EXCLUDED FROM THE
    //     ℃ FOLD: NFKC maps № to the Latin "No", which a Bulgarian g2p would read as an English word — a
    //     compatibility character can need a WORD rather than a fold, which is why it was left for here.
    t = t.replace(/№\s?(?=\d)/gu, "номер ");

    // 7) PERCENT (18) → the counting plural `процента`, which is what the corpus writes out (8/8).
    t = t.replace(/(\d+)\s*%/gu, "$1 процента");

    // 8) DEGREES (2), BEFORE the unit rules — the C of `20 °C` was read as the English letter name.
    t = t.replace(/℃/gu, "°C").replace(/℉/gu, "°F");
    t = t.replace(/(\d)\s*°\s*C(?!\p{L})/giu, "$1 градуса по Целзий");
    t = t.replace(/(\d)\s*°\s*F(?!\p{L})/giu, "$1 градуса по Фаренхайт");
    t = t.replace(/(\d)\s*°/gu, "$1 градуса");

    // 9) SQUARED / CUBED UNITS (4), BEFORE the plain unit rule — otherwise `км` is consumed first and the
    //    exponent is left stranded. Accepts both the superscript and the ASCII digit, since the corpus
    //    writes `км2`.
    for (const [re, word] of SQUARED) t = t.replace(re, word);

    // 10) CYRILLIC UNIT ABBREVIATIONS after a number (50 for `км` alone). The trailing guard is
    //    `(?!\p{L})` and not `\b`: `\b` is defined on ASCII word characters and finds no boundary after a
    //    Cyrillic letter, so the rule would silently never fire — the trap that bit the Romanian rate
    //    rule one language earlier.
    for (const [abbr, word] of UNITS)
        t = t.replace(new RegExp(`(\\d)\\s*${abbr}(?!\\p{L})`, "gu"), `$1 ${word}`);

    // 11) RANGES (9). Spoken `до`.
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
