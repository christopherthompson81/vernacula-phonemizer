/**
 * Belarusian (be) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/be.jsonc` — be.wikipedia dump, 1,371,742 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `year` 673,519 · `abbrev` 335,449 · `initialism` 297,224 · `ranges`
 * 166,322 · `dotted` 94,000 · `roman` 79,181 · `decimals` 64,420 · `ordinal-latin` 30,090 · `signs` 29,356 ·
 * `exponent` 21,839 · `grouped` 19,013 · `clock` 17,488 · `percent` 16,071 · `fractions` 12,703 ·
 * `era-marker` 7,762 · `signed-number` 5,412 · `degrees` 3,673 · `currency` 1,566.
 *
 * ⚠ TWO DEFECTS HERE WERE NOT SILENCE BUT A FLUENT WRONG READING, which is why the counts above are not the
 * ranking that matters:
 *   · `3 000 000` read as *тры нуль нуль* — "three zero zero". The engine's number token is `\d+` and cannot
 *     span the grouping space, so a seven-digit figure became three numbers, two of them bare zeros.
 *   · `+28 °C` read the ⟨C⟩ as the ENGLISH LETTER NAME [sˈiː]. The tokenizer matches Cyrillic only, so the
 *     Latin run fell through to `core/foreign.ts`, which reads Latin as English — an English word inside
 *     Belarusian prose, which no leak class looks for.
 * And the ordinary ones: `70 %` dropped the sign, `1991 г.` read *год* as the bare consonant [x], `12,5 км`
 * read the unit as the cluster [km], `1-ы` read the suffix as a bare vowel, `ЗША` as [sʂa].
 *
 * ⚠ FOUR CLASSES ARE NOT THE CLASS THEY PATTERN-MATCH AS, each found by printing context before writing a
 * rule (trap 2), and each would have shipped a wrong reading:
 *   · **`с.` is *старонка* (page), not seconds** — every instance is a bibliography (`552 с.`, `196 с.`,
 *     `240 с.`). It is NOT declared as a unit, which is also why `м/с` cannot be composed by the shared tier.
 *   · **`г` after a digit is *год*, not *грам*** — 7 of its 8 instances are years (`438 г. н.э.`, `1990 г.`,
 *     `1918 г.`), the eighth `2,6—3,34 г/см³`. Declaring the gram would misread every year in the language.
 *   · **The seven `\d+/\d+` are ALTERNATIVE DATES, not fractions** — `(пам. 29/30.10.1937)`, `(нар. 673/674)`,
 *     `285/286: Марк Аўрэлій Юліян`. Zero genuine fractions occur; see step 11 for what the rule is bounded to.
 *   · **`=` is mostly a BIBLIOGRAPHIC TITLE SEPARATOR** — `Запісы = Zapisy`, `Беларусіка = Albaruthenica`.
 *     Two of nine are real equations, so the rule requires a DIGIT on at least one side.
 *
 * ⚠ AND THE SIGN READINGS COME FROM ONE SENTENCE THAT READS THE NOTATION ALOUD. be.wikipedia's
 * multiplication article:
 *
 *     «2 ⋅ 3 = 6 … чытаецца «два памножыць на тры роўна шасці», або проста «два на тры ёсць шэсць»»
 *
 * That gives BOTH readings of `×` and BOTH of `=`, in register pairs. ⚠ `роўна` GOVERNS THE DATIVE
 * (*роўна шасці*) and this layer emits nominative digits, exactly the problem `ru` and `uk` each had to
 * solve; the short reading in the same sentence is nominative (*ёсць шэсць*), so `=` takes `ёсць` and `×`
 * takes the matching short `на`. `падзяліць на` comes from the same article ("падзяліць на 256 і памножыць
 * на 1000"). The comparatives need no such care: `менш за` ×21 and `больш за` ×9 both govern a plain numeral
 * ("не менш за 20 гадоў", "больш за 4 млн").
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { slavicCountForm } from "../../core/normalizeSymbols.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { eastSlavicNumberWords, type EastSlavicNumbers } from "../ukrainian/numbers.ts";

const DEF = loadManifest<{ numbers: EastSlavicNumbers }>(import.meta.url, "belarusian.jsonc");

/** The cardinal as words — the same composer the engine's number path uses, so an ordinal's head reads
 *  exactly as a bare numeral would (`1950` → *тысяча дзевяцьсот*). */
function cardinal(n: number): string {
    return eastSlavicNumberWords(n, DEF.numbers).map((w) => w ?? "").join(" ").trim();
}

/** Pick a three-form Slavic count noun for `n` (nom.sg / nom.pl 2–4 / gen.pl). */
function counted(n: number, forms: readonly [string, string, string]): string {
    return forms[Math.min(slavicCountForm(n), 2)]!;
}

// ---------------------------------------------------------------------------------------------------
// ORDINALS
// ---------------------------------------------------------------------------------------------------

/**
 * Masculine-nominative ordinals. Every entry is a be.wikipedia TOKEN attestation with the examples read:
 * першы ×39 · другі ×40 · трэці ×47 · чацвёрты ×20 · пяты ×28 · шосты ×13 · сёмы ×23 · восьмы ×20 ·
 * дзявяты ×15 · дзясяты ×19 · дваццаты ×21 · трыццаты ×17 · саракавы ×20 · пяцідзясяты ×3 ·
 * шасцідзясяты ×1 · сямідзясяты ×1 · васьмідзясяты ×2 · дзевяносты ×8 · соты ×25 · тысячны ×41.
 * The 50–80 tens are thin but present and morphologically regular; the teens are derived from the same
 * -наццаты pattern the manifest's cardinals already spell (`пятнаццаць` → `пятнаццаты`).
 */
const ORD_1_19: readonly string[] = [
    "", "першы", "другі", "трэці", "чацвёрты", "пяты", "шосты", "сёмы", "восьмы", "дзявяты",
    "дзясяты", "адзінаццаты", "дванаццаты", "трынаццаты", "чатырнаццаты", "пятнаццаты",
    "шаснаццаты", "сямнаццаты", "васямнаццаты", "дзевятнаццаты",
];
const ORD_TENS: readonly string[] = [
    "", "дзясяты", "дваццаты", "трыццаты", "саракавы", "пяцідзясяты", "шасцідзясяты", "сямідзясяты",
    "васьмідзясяты", "дзевяносты",
];
const ORD_HUNDREDS: readonly string[] = [
    "", "соты", "двухсоты", "трохсоты", "чатырохсоты", "пяцісоты", "шасцісоты", "сямісоты",
    "васьмісоты", "дзевяцісоты",
];
const ORD_THOUSANDS: readonly string[] = [
    "", "тысячны", "двухтысячны", "трохтысячны", "чатырохтысячны", "пяцітысячны", "шасцітысячны",
    "сямітысячны", "васьмітысячны", "дзевяцітысячны",
];

/**
 * Integer → the masculine-nominative ordinal. Only the LAST element inflects (as in Russian and Ukrainian,
 * unlike Polish), so a compound is its cardinal head plus the ordinal of the final non-zero part:
 * 1950 → *тысяча дзевяцьсот* + пяцідзясяты, 2000 → двухтысячны, 2010 → *дзве тысячы* + дзясяты.
 */
function ordinalBase(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1) return undefined;
    if (n < 20) return ORD_1_19[n];
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        return u === 0 ? ORD_TENS[t] : `${DEF.numbers.tens[String(t * 10)]!} ${ORD_1_19[u]!}`;
    }
    if (n < 1000) {
        const r = n % 100;
        return r === 0 ? ORD_HUNDREDS[n / 100] : `${cardinal(n - r)} ${ordinalBase(r)!}`;
    }
    if (n < 10_000 && n % 1000 === 0) return ORD_THOUSANDS[n / 1000];
    if (n < 1_000_000) {
        const r = n % 1000;
        if (r === 0) return undefined; // a round ten-thousand needs its own stem; not attempted
        return `${cardinal(n - r)} ${ordinalBase(r)!}`;
    }
    return undefined;
}

/**
 * Belarusian adjective endings, in three paradigms, because the ordinal stems fall into three classes and
 * a single table would generate impossible forms:
 *   HARD  (першы, пяты, соты)   -ы  -ага -аму -ым  -ае  -ыя -ых -ая -ай  -ымі
 *   VELAR (другі — a ⟨г⟩ stem)  -і  -ога -ому -ім  -ое  -ія -іх -ая -ой  -імі
 *   SOFT  (трэці)               -і  -яга -яму -ім  -яе  -ія -іх -яя -яй  -імі
 * Ordered by how likely the reading is, because the written suffix is matched with `endsWith` and several
 * forms share a final letter. ⚠ `саракавы` is the one STRESSED-ENDING stem in the tables above and takes
 * the velar-shaped -ога/-ому/-ое/-ой set; it is listed separately rather than guessed at.
 */
const END_HARD: readonly string[] = ["ы", "ага", "аму", "ым", "ае", "ыя", "ых", "ая", "ай", "ымі"];
const END_VELAR: readonly string[] = ["і", "ога", "ому", "ім", "ое", "ія", "іх", "ая", "ой", "імі"];
const END_SOFT: readonly string[] = ["і", "яга", "яму", "ім", "яе", "ія", "іх", "яя", "яй", "імі"];
const END_STRESSED: readonly string[] = ["ы", "ога", "ому", "ым", "ое", "ыя", "ых", "ая", "ой", "ымі"];

/** Every case form of the ordinal for `n`, in preference order. Only the final word inflects. */
function ordinalForms(n: number): string[] {
    const base = ordinalBase(n);
    if (base === undefined) return [];
    const words = base.split(" ");
    const last = words[words.length - 1]!;
    const stem = last.slice(0, -1); // every citation form above ends in a single -ы or -і
    const endings = last === "саракавы" ? END_STRESSED
        : /[гкх]і$/u.test(last) ? END_VELAR
        : last.endsWith("і") ? END_SOFT
        : END_HARD;
    const head = words.slice(0, -1).join(" ");
    return endings.map((e) => `${head ? `${head} ` : ""}${stem}${e}`);
}

// ---------------------------------------------------------------------------------------------------
// OBLIQUE CARDINALS
// ---------------------------------------------------------------------------------------------------

/**
 * GENITIVE cardinals. Belarusian writes the oblique cardinal the same way it writes an ordinal — digits,
 * hyphen, the last letters of the word — so the corpus's `з 28-мі краін` is *дваццаці васьмі* (a cardinal)
 * while `2010-х` is *дзясятых* (an ordinal). Step 5 disambiguates them, and the `endsWith` guard is what
 * makes both safe: a candidate that does not end with the letters the writer typed is never chosen.
 */
const GEN_1_19: readonly string[] = [
    "", "аднаго", "двух", "трох", "чатырох", "пяці", "шасці", "сямі", "васьмі", "дзевяці",
    "дзесяці", "адзінаццаці", "дванаццаці", "трынаццаці", "чатырнаццаці", "пятнаццаці",
    "шаснаццаці", "сямнаццаці", "васямнаццаці", "дзевятнаццаці",
];
const GEN_TENS: readonly string[] = [
    "", "дзесяці", "дваццаці", "трыццаці", "сарака", "пяцідзесяці", "шасцідзесяці", "сямідзесяці",
    "васьмідзесяці", "дзевяноста",
];

function genitiveCardinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n >= 100) return undefined;
    if (n < 20) return GEN_1_19[n];
    const t = Math.floor(n / 10), u = n % 10;
    return u === 0 ? GEN_TENS[t] : `${GEN_TENS[t]!} ${GEN_1_19[u]!}`;
}

// ---------------------------------------------------------------------------------------------------
// INITIALISMS
// ---------------------------------------------------------------------------------------------------

/**
 * Belarusian letter NAMES (назвы літар беларускага алфавіта). ⟨ў⟩ is *у нескладовае*, ⟨й⟩ *і кароткае*,
 * ⟨ь⟩ *мяккі знак*. The corpus's caps runs are ВУП ×21, ДНС ×17, ЗША ×8, ААЭ ×5, ТАА ×3, ААН, СНД, ВІЧ,
 * ПАР, БНР, ВМФ — every one of which reached the g2p as a raw consonant cluster (`ЗША` → [sʂa]).
 */
const LETTER_NAME: Readonly<Record<string, string>> = {
    а: "а", б: "бэ", в: "вэ", г: "гэ", ґ: "гэ", д: "дэ", е: "е", ё: "ё", ж: "жэ", з: "зэ",
    і: "і", й: "і кароткае", к: "ка", л: "эль", м: "эм", н: "эн", о: "о", п: "пэ", р: "эр",
    с: "эс", т: "тэ", у: "у", ў: "у нескладовае", ф: "эф", х: "ха", ц: "цэ", ч: "чэ", ш: "ша",
    ы: "ы", ь: "мяккі знак", э: "э", ю: "ю", я: "я",
};

/** ⚠ EVERY BOUNDARY IN THIS FILE IS AN EXPLICIT LOOKAROUND, NEVER `\b` — `\b` is defined on ASCII word
 *  characters and finds none against Cyrillic, so a rule written with it silently matches nothing. That is
 *  precisely how `core/initialisms.ts` was a total no-op for Russian (США → [sʂa]) until it was fixed
 *  (playbook trap 1). */

/** Belarusian phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
export const isUnreadableBelarusian = makeUnreadableTest({
    vowels: /[аеёіоуыэюя]/u,
    legalOnsets: new Set([
        "бл", "бр", "вл", "вр", "гл", "гр", "гн", "дв", "др", "дн", "дз", "дж", "жд", "зв", "зд",
        "зл", "зм", "зн", "зр", "кл", "кн", "кр", "кв", "мн", "пл", "пр", "сл", "см", "сн", "сп",
        "ст", "св", "тр", "тв", "фл", "фр", "хл", "хр", "цв", "шк", "шл", "шп", "шт", "шч",
    ]),
    legalCodas: new Set([
        "ст", "нт", "нд", "нс", "рт", "рд", "рс", "рн", "рм", "лт", "лд", "лс", "кт", "кс",
        "пт", "фт", "зд", "зн", "сн", "см", "нк", "нг", "лм", "лк", "рк", "рг", "рх", "нь",
        "сь", "ць", "ў", "йк", "ск", "шч",
    ]),
});

/** Belarusian has no pronunciation dictionary (its g2p is a flat rule scan), so the "is this recorded"
 *  test cannot be answered — acronyms are decided by the lexical list plus the OOV rule alone. */
export function normalizeBelarusianInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        // Spelled out despite being pronounceable — the corpus's own runs. ВУП (GDP) and ААН (the UN) are
        // vowel-rich and would otherwise be read as words.
        acronymLetters: new Set(["вуп", "ааэ", "аан", "снд", "пар", "бнр", "уп", "сп", "ес", "зша", "ссср"]),
        isRecorded: () => false,
        isUnreadable: isUnreadableBelarusian,
    })(text);
}

// ---------------------------------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------------------------------

const METRE = ["метр", "метры", "метраў"] as const;
const DEGREE = ["градус", "градусы", "градусаў"] as const;

/**
 * The magnitude abbreviations, with the four forms a Belarusian numeral governs: nom.sg after a count
 * ending in 1, nom.pl after 2–4, gen.pl after 5+ and 11–14, and gen.sg after a DECIMAL (2,5 мільёна).
 * `мільёнаў` ×59, `мільярдаў` ×45 and `тысяч` ×71 are be.wikipedia token attestations; `трыльён` ×15.
 */
const MAGNITUDE_ABBREV: readonly (readonly [string, readonly [string, string, string, string]])[] = [
    ["млрд", ["мільярд", "мільярды", "мільярдаў", "мільярда"]],
    ["трлн", ["трыльён", "трыльёны", "трыльёнаў", "трыльёна"]],
    ["млн", ["мільён", "мільёны", "мільёнаў", "мільёна"]],
    ["тыс", ["тысяча", "тысячы", "тысяч", "тысячы"]],
];

/** Select the form a written quantity governs — the decimal takes the genitive singular, which is a fourth
 *  slot the three-way Slavic selector cannot express (the 2–4 slot here is the nominative plural). */
function magnitudeForm(written: string, forms: readonly [string, string, string, string]): string {
    if (/[.,]/u.test(written)) return forms[3];
    return forms[Math.min(slavicCountForm(Number(written)), 2)]!;
}

/**
 * Abbreviations whose dot is NOT a sentence end. ⚠ `г.` and `с.` and `м.` are deliberately ABSENT: all
 * three are ambiguous in this corpus and are handled by a digit-anchored rule (step 3) or refused
 * outright — `г.` is *год* after a figure but *гэтак далей* in `і г.д.` and *гадзіну* in `км/г.`; `с.` is
 * *старонка* in every bibliography instance; `м.` is *метраў* after a figure but *мыс* before a place name
 * (`у раёне м. Ігольнага`).
 */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    "гг": "гадоў",
    "ст": "стагоддзя",
    "стст": "стагоддзяў",
    "нар": "нарадзіўся",
    "пам": "памёр",
    "інш": "іншае",
    "тыс": "тысяч",
    "напр": "напрыклад",
    "гл": "глядзі",
    "вул": "вуліца",
    "дол": "долараў",
};
const ABBREV_ALT = Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|");

const NOT_LETTER = "(?![\\p{L}\\p{M}'’ʼ])";
const NOT_BEFORE = "(?<![\\p{L}\\p{M}])";

/** Normalize one Belarusian input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeBelarusian(input: string): string {
    let s = input;

    // 0) DIGIT DE-GROUPING, FIRST — per the playbook, a grouping mark left in place is read as a separate
    //    number or as clause punctuation, and every later rule (units, clock, ordinals) needs the number
    //    whole. ⚠ THIS IS THE LARGEST WRONG-MAGNITUDE DEFECT IN THE LANGUAGE, not a tidy-up: `3 000 000`
    //    read as *тры нуль нуль*. Two passes, because adjacent groups share the digit the first consumes
    //    (`5 000 000`); `X 000` is 7 of the corpus's 21 grouped figures.
    for (let i = 0; i < 2; i++) s = s.replace(/(\d)[    ](\d{3})(?!\d)/gu, "$1$2");
    s = s.replace(/[   ]/gu, " ");

    // 1) MULTI-DOT ABBREVIATIONS, before the single-dot rule (step 4) so their interior dots do not first
    //    become phrase breaks. `н.э.` ×17 glued and `н. э.` ×2 spaced — both spellings occur. The FINAL dot
    //    is kept when the abbreviation ends the sentence, or the corpus's `…у 438 г. н.э.` loses its
    //    sentence-final pause outright (the German run's check: zero sentence-final pauses may be lost).
    const multi: readonly (readonly [RegExp, string])[] = [
        [new RegExp(`${NOT_BEFORE}да\\s+н\\.\\s?э\\.`, "giu"), "да нашай эры"],
        [new RegExp(`${NOT_BEFORE}н\\.\\s?э\\.`, "giu"), "нашай эры"],
        [new RegExp(`${NOT_BEFORE}і\\s+г\\.\\s?д\\.`, "giu"), "і гэтак далей"],
        [new RegExp(`${NOT_BEFORE}т\\.\\s?зв\\.`, "giu"), "так званы"],
    ];
    for (const [re, word] of multi)
        s = s.replace(re, (m0, offset: number, full: string) => {
            const rest = full.slice(offset + m0.length);
            return /^\s*["»)']?\s*$/u.test(rest) ? `${word}.` : word;
        });

    // 2) НУМАР. The sign was dropped outright. `нумар` ×39 — "Міжнародны стандартны кніжны нумар (ISBN)".
    s = s.replace(/№\s?(?=\d)/gu, "нумар ");

    // 3) THE YEAR ABBREVIATION, digit-anchored — `1990 г.`, `438 г. н.э.`, `2014-2016 г.` The bare letter
    //    was reaching the g2p as [x]. ⚠ ANCHORED ON THE FIGURE because `г.` alone is three different words:
    //    *год* here, *гэтак далей* in `і г.д.` (step 1 has already spent that one) and *гадзіну* in
    //    `574,8 км/г.` — which is why the RATE rule below must run FIRST and take its `г` off the table.
    //    Measured: 7 of the 8 digit-adjacent `г` in the retained text are years.
    //    The genitive *года* is what a figure governs (`1990 года`), and the final dot is dropped because
    //    it is not a sentence end — step 1's clause-final test does not apply, since a year is followed by
    //    more sentence in every corpus instance.
    s = s.replace(/(\d)\s?(?:км\s?\/\s?(?:гадз|год|г)|км\/ч)(?![\p{L}\p{M}])/giu, "$1 кіламетраў на гадзіну");
    s = s.replace(new RegExp(`(\\d)\\s?г\\.${NOT_LETTER}`, "gu"), "$1 года");
    s = s.replace(new RegExp(`(\\d)\\s?гг\\.${NOT_LETTER}`, "gu"), "$1 гадоў");

    // 3b) THE MAGNITUDE ABBREVIATIONS `млн` / `млрд` / `трлн`, which reached the g2p as the raw consonant
    //     clusters [mɫn] and [mɫrd]. `млрд` is ×16 after a digit in the retained text and `дол.` ×7 beside
    //     it (`30-45 млрд долараў`, `$68.7 мільярдаў`). They are ALSO declared as `magnitudes` in
    //     belarusian.ts, but only in their spelled-out forms — the tier hops a magnitude it can read, and
    //     an unexpanded abbreviation is not one. Expanded here, with the count agreement the numeral
    //     governs, so the tier still sees a magnitude between the figure and any unit that follows.
    for (const [abbr, forms] of MAGNITUDE_ABBREV)
        s = s.replace(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s?${abbr}\\.?${NOT_LETTER}`, "gu"),
            (_m, n: string) => `${n} ${magnitudeForm(n, forms)}`);

    // 4) DOTTED ABBREVIATIONS. The dot is consumed before a following word or a comma so it cannot become a
    //    phrase break; at a real sentence end it is kept.
    s = s.replace(new RegExp(`${NOT_BEFORE}(${ABBREV_ALT})\\.(\\s+)(?=[\\p{L}\\d(])`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}${sp}`);
    s = s.replace(new RegExp(`${NOT_BEFORE}(${ABBREV_ALT})\\.(?=\\s*[,;:])`, "giu"),
        (_m, ab: string) => DOTTED_ABBREV[ab.toLowerCase()]!);
    s = s.replace(new RegExp(`${NOT_BEFORE}(${ABBREV_ALT})\\.(?=\\s*(?:[.!?»)]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}.`);

    // 5) NUMERAL + WRITTEN SUFFIX — the ordinal notation, ×23 in the retained text and `ordinal-latin`
    //    30,090 corpus-wide. The suffix is the LAST LETTERS OF THE FULL WORD, not an appendable marker, so
    //    the rule has to pick the case form that ends with what the writer typed: `4-га` → *чацвёртага*,
    //    `7-е месца` → *сёмае*, `30-ай` → *трыццатай*, `2010-х` → *дзве тысячы дзясятых*, `2000-я гады` →
    //    *двухтысячныя*. Left alone the suffix was spoken as a bare vowel (`1-ы` → […ad͡zʲin ɨ]).
    //    ⚠ AND THE SAME NOTATION WRITES AN OBLIQUE CARDINAL: the corpus's `з 28-мі краін` is *дваццаці
    //    васьмі*, not an ordinal. Both are generated and the written letters choose, which is what makes
    //    guessing at a paradigm safe — a form that does not end with the typed suffix is never returned.
    //    The suffix is capped at 3 letters and must not be followed by another letter, which keeps the rule
    //    off compound adjectives (`28-гадовы`); those keep their current cardinal-plus-word reading.
    //    MUST run before the range rule (step 12), which would otherwise eat the hyphen.
    s = s.replace(new RegExp(`(?<![\\d.,])(\\d+)\\s?-\\s?([а-яёіў]{1,3})${NOT_LETTER}`, "giu"),
        (whole, digits: string, rawSuffix: string) => {
            const n = Number(digits);
            const suffix = rawSuffix.toLowerCase();
            // `-мі` and `-ці` are cardinal-only endings in this notation; everything else prefers the ordinal.
            const cardinalFirst = suffix === "мі" || suffix === "ці";
            const gen = genitiveCardinal(n);
            if (cardinalFirst) return gen !== undefined && gen.endsWith(suffix) ? gen : whole;
            const form = ordinalForms(n).find((f) => f.endsWith(suffix));
            if (form !== undefined) return form;
            return gen !== undefined && gen.endsWith(suffix) ? gen : whole;
        });

    // 6) UNITS THE SHARED SYMBOL TIER CANNOT EXPRESS, and the two it must never be given.
    //    · `м` is claimed HERE rather than declared, because the tier's key would also have to survive the
    //      clause-final `100—200 м.` and the possessive-apostrophe hazard; the guard below is explicit.
    //    · `г` and `с` are NOT units in this language's text — see the header. Nothing declares them.
    //    Units run BEFORE the clock and the decimal fold, because both destroy number adjacency.
    s = s.replace(/(\d+(?:[.,]\d+)?)\s?м\/с(?![\p{L}\p{M}])/gu,
        (_m, n: string) => `${n} ${counted(Math.trunc(Number(n.replace(",", "."))), METRE)} на секунду`);
    s = s.replace(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s?м(?![\\p{L}\\p{M}'’ʼ²³/])`, "gu"),
        (_m, n: string) => `${n} ${counted(Math.trunc(Number(n.replace(",", "."))), METRE)}`);

    // 7) DEGREES, before the sign rules so a negative temperature still finds its `°`, and before the unit
    //    tier so the bare sign is not left behind. ⚠ THE LETTER MAY BE CYRILLIC OR LATIN and the corpus
    //    writes the Latin one, which is what made `+28 °C` read as the English letter name — the class must
    //    carry both ⟨C⟩ and ⟨С⟩, which are different characters that render identically.
    //    `градусаў Цэльсія` ×31/×50, in the exact slot: "тэмпература 25 градусаў Цэльсія", "−182.5
    //    градусаў Цэльсія"; and the Цэльсія article names the sign ("за 100° — тэмпература кіпення").
    s = s.replace(/(\d)\s?°\s?[CС](?![\p{L}\p{M}])/gu, "$1 градусаў Цэльсія");
    s = s.replace(/(\d)\s?°\s?[FФ](?![\p{L}\p{M}])/gu, "$1 градусаў Фарэнгейта");
    s = s.replace(/(\d+)\s?°/gu, (_m, n: string) => `${n} ${counted(Number(n), DEGREE)}`);

    // 8) CLOCK. The colon is clause punctuation in belarusian.jsonc, so `23:59` read as *дваццаць тры ,
    //    пяцьдзесят дзевяць*. Belarusian says the hour as a cardinal followed by the minutes; a `:00`
    //    minute is not read as *нуль*. Two-digit minutes are REQUIRED, which keeps the corpus's scores and
    //    bibliographic ratios out of the rule. A third field means a timestamp, not a clock: the colons are
    //    spent on spaces and nothing is invented (the playbook's `sports-time` reading).
    s = s.replace(/(?<![\d:])(\d{1,2}):([0-5]\d):([0-5]\d)(?![:\d])/gu, "$1 $2 $3");
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:.,])/gu,
        (whole, h: string, min: string) => {
            const hv = Number(h), mv = Number(min);
            const head = cardinal(hv);
            if (head === "") return whole;
            return mv === 0 ? head : `${head} ${cardinal(mv)}`;
        });

    // 9) SIGNS. `+57.7 °C` lost its sign entirely; `−16 °C` likewise. The corpus writes the true MINUS
    //    (U+2212) and the en-dash as well as the hyphen.
    s = s.replace(/(^|[\s(])[-−–](\d)/gu, "$1мінус $2");
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs its
    //    own rule or the sign is dropped in silence; ×4 in the retained text, every one a tolerance
    //    (`(0,28±0,04)`, `(4,004±0,040) кг`). The reading is this language's own two sign words.
    s = s.replace(/±/gu, " плюс-мінус ");
    s = s.replace(/(^|[\s(])\+\s?(\d)/gu, "$1плюс $2");

    // 10) RELATIONAL AND DIVISION SIGNS — see the header for the one sentence that sources all four.
    //     ⚠ `=` REQUIRES A DIGIT ON ONE SIDE, and that guard is the whole rule: 7 of the corpus's 9 are
    //     BIBLIOGRAPHIC TITLE SEPARATORS (`Запісы = Zapisy`, `Беларусіка = Albaruthenica`) where "ёсць"
    //     would assert an equation about a translation — the Lithuanian lesson. The two real ones are
    //     `1 аўстр. дол. = 0,71 дол. ЗША` and `фунт стэрлінгаў = 100 пенсаў`, and both have the digit.
    s = s.replace(/(\d)\s?=\s?/gu, "$1 ёсць ");
    s = s.replace(/\s?=\s?(?=\d)/gu, " ёсць ");
    s = s.replace(/(\d)\s?<\s?(?=\d)/gu, "$1 менш за ");
    s = s.replace(/(\d)\s?>\s?(?=\d)/gu, "$1 больш за ");
    s = s.replace(/(\d)\s?÷\s?(?=\d)/gu, "$1 падзяліць на ");

    // 11) FRACTIONS — feminine, agreeing with the elided *частка*: 1/5 is *адна пятая*.
    //     ⚠ BOUNDED AT A DENOMINATOR OF TEN, AND THE BOUND IS THE EVIDENCE. Every `\d+/\d+` in this corpus
    //     is an ALTERNATIVE DATE — `(пам. 29/30.10.1937)`, `(нар. 673/674)`, `285/286: Марк Аўрэлій Юліян`,
    //     `64/67: Пётр, апостал`, `5/81` — and not one is a fraction. The bound rejects all seven while
    //     still claiming the ordinary shape if it occurs, which is the honest position: a rule with no
    //     attested instance is a misfire generator (trap 9), and a rule that reads a death year as a
    //     fraction is a defect that produces a READING (trap 56).
    s = s.replace(/(?<![\d\p{L}/.,])(\d{1,2})\/(\d{1,2})(?![\d/\p{L}.,])/gu, (whole, a: string, b: string) => {
        const num = Number(a), den = Number(b);
        if (den < 2 || den > 10 || num < 1 || num >= den) return whole;
        // ⚠ THE DENOMINATOR AGREES WITH THE NUMERATOR, not merely with the elided noun. Belarusian says
        // *адна пятая* (fem.sg), *дзве пятыя* (nom.pl after 2–4) and *пяць пятых* (gen.pl from 5) — the
        // same three-way selector every count noun in this file takes. Emitting the feminine singular for
        // every numerator, which is what a one-form rule does, gives *дзве пятая*.
        const slot = [7, 5, 6][Math.min(slavicCountForm(num), 2)]!; // fem.nom · nom.pl · gen.pl
        const den_word = ordinalForms(den)[slot];
        if (den_word === undefined) return whole;
        const numWord = cardinal(num).replace(/адзін$/u, "адна").replace(/два$/u, "дзве");
        return `${numWord} ${den_word}`;
    });

    // 12) NUMERIC RANGES. The dash was dropped outright and the endpoints fused. Belarusian reads the span
    //     with `да`. Digits are required on BOTH sides so `COVID-19` and `Гран-пры` cannot match; runs
    //     AFTER the ordinal rule (step 5), which needs the hyphen, and after the sign rule, which has
    //     already spent every dash that opens a negative.
    //     ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58) — `на глыбіні 100—200 м.` is how this
    //     corpus ends a sentence. Attested spans: `10—20 мм ападкаў`, `300—350 км`, `3—6 км`, `1-3
    //     працоўных дзён`, `7-14 дзён`. The football scores (`5—2`, `9-4`) are a counted minority and were
    //     fusing their endpoints anyway, so no reading is lost there — only a wrong-ish connective gained.
    s = s.replace(/(\d)\s?[–—-]\s?(?=\d)/gu, "$1 да ");

    // 13) DOT DECIMALS → the comma form the engine's number token reads. ⚠ WIDER THAN UKRAINIAN'S ON
    //     PURPOSE, and the difference is measured rather than inherited: uk folded only a 1–2-digit integer
    //     because most of its dot-decimals were software versions, while be's 82 are dominated by genuine
    //     decimals — `+57.7 °C`, `$7.2 мільярда`, `$68.7 мільярдаў`, `(74.2 %)`, `12.7x99mm`. The known
    //     misfires are a train model (`81-717.5М`) and a mobile standard (`«2.5G»`), both of which carry a
    //     LETTER immediately after the fraction, which the guard therefore rejects.
    s = s.replace(/(?<![\d.,])(\d+)\.(\d{1,2})(?![\d.\p{L}])/gu, "$1,$2");

    // A padded replacement (` плюс-мінус `, ` ёсць `) doubles a space that was already there. Harmless
    // downstream because assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass
    // should not be the one producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
