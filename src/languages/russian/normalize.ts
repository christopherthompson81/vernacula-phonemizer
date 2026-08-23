/**
 * Russian (ru) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THE HARD PART IS ORDINAL NOTATION. Russian writes `5-е`, `1-й`, `1970-х`, `3-м`, and the suffix is NOT
 * an ordinal marker — it is the CASE ENDING. `5-е` is пятое (neuter nominative), `5-го` пятого (genitive),
 * `1970-х` семидесятых (genitive plural). So the rule reads the ending off the text and INFLECTS the
 * ordinal to match, rather than concatenating: what is written is the last letters of the full form, not a
 * suffix that can be appended. Unclaimed, each of these speaks the bare letter as a word — `5-е` comes out
 * [pʲætʲ je], "five ye".
 *
 * Already correct and untouched: dates take a plain cardinal day, the decimal comma reads as *целых*
 * (1,5 → один целых пять), % carries proper Slavic count agreement through the shared symbol tier
 * (процент / процента / процентов), and Roman numerals arrive already converted at the registry seam —
 * with `russian/romanOrdinals.ts` supplying the ORDINAL reading a century wants, so `XV век` is already
 * *пятнадцатый век*. That also means the roman-vs-initialism ordering hazard cannot arise here.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { slavicCountForm } from "../../core/normalizeSymbols.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";
import { russianOrdinal } from "./romanOrdinals.ts";

const GROUP_SPACE = "    ";

/**
 * Written case ending → the ordinal's full ending, for a HARD-stem ordinal (пятый, шестой, сороковой) and
 * for the one soft stem among them (третий). The written form shows only the last letters, so this maps
 * back to the whole ending rather than appending.
 */
const CASE_ENDING: Readonly<Record<string, readonly [string, string]>> = {
    // written    hard      soft (третий)
    "й": ["", "ий"], // masculine nominative — the base form already
    "е": ["ое", "ье"], "ое": ["ое", "ье"],
    "я": ["ая", "ья"], "ая": ["ая", "ья"],
    "го": ["ого", "ьего"], "ого": ["ого", "ьего"],
    "м": ["ом", "ьем"], "ом": ["ом", "ьем"],
    "му": ["ому", "ьему"], "ому": ["ому", "ьему"],
    "х": ["ых", "ьих"], "ых": ["ых", "ьих"],
    "ю": ["ую", "ью"], "ую": ["ую", "ью"],
    "ой": ["ой", "ьей"], "ей": ["ой", "ьей"],
    "ые": ["ые", "ьи"], "ие": ["ые", "ьи"],
    "ым": ["ым", "ьим"], "ыми": ["ыми", "ьими"],
};
/** Longest first, so `ого` is not matched as `го`. */
const CASE_ALT = Object.keys(CASE_ENDING).sort((a, b) => b.length - a.length).join("|");

/**
 * Integer → the masculine-nominative ordinal, extended past `russianOrdinal`'s own 1–100 range. ⚠ ONLY THE
 * LAST ELEMENT INFLECTS in Russian, so a larger number is its cardinal head plus the ordinal of its final
 * ≤100 part: 1970 → "тысяча девятьсот" + семидесятый. That is what `1970-х` needs, and `russianOrdinal`
 * alone returns undefined there.
 */
function ordinalBase(n: number): string | undefined {
    const direct = russianOrdinal(n);
    if (direct !== undefined) return direct;
    const rest = n % 100;
    if (rest === 0) return undefined; // a round hundred/thousand needs сотый/тысячный — not attempted
    const tail = russianOrdinal(rest);
    if (tail === undefined) return undefined;
    return `${numberToWords(n - rest)} ${tail}`;
}

/** Inflect a masculine-nominative ordinal to the case the written suffix marks. */
function inflectOrdinal(base: string, written: string): string | undefined {
    const forms = CASE_ENDING[written];
    if (forms === undefined) return undefined;
    const words = base.split(" ");
    const last = words[words.length - 1]!;
    const soft = last.endsWith("ий"); // третий is the only soft stem in the 1–19 table
    const stem = last.replace(/(ый|ой|ий)$/u, "");
    words[words.length - 1] = stem + (soft ? forms[1] : forms[0] || last.slice(stem.length));
    return words.join(" ");
}

/** Cyrillic letter names, for initialisms. США is [эс ша а], ДНК [дэ эн ка], ТВ [тэ вэ]. */
const LETTER_NAME: Readonly<Record<string, string>> = {
    а: "а", б: "бэ", в: "вэ", г: "гэ", д: "дэ", е: "е", ё: "ё", ж: "жэ", з: "зэ", и: "и",
    й: "и краткое", к: "ка", л: "эль", м: "эм", н: "эн", о: "о", п: "пэ", р: "эр", с: "эс",
    т: "тэ", у: "у", ф: "эф", х: "ха", ц: "цэ", ч: "че", ш: "ша", щ: "ща", ы: "ы",
    э: "э", ю: "ю", я: "я",
};

/** NOTE: every boundary in this file is an explicit lookaround, never `\b` — `\b` is defined on ASCII
 *  word characters and finds none against Cyrillic, so a rule written with it silently matches nothing.
 *  The same trap has now appeared in French, Hindi, Bengali, Mandarin and here, including inside
 *  core/initialisms.ts itself, which this run had to fix. */

/** Russian phonotactics, for the OOV rule in core/initialisms.ts. */
export const isUnreadableRussian = makeUnreadableTest({
    vowels: /[аеёиоуыэюя]/u,
    legalOnsets: new Set([
        "бл", "бр", "вл", "вр", "гл", "гр", "дв", "др", "жд", "зв", "зд", "кл", "кр", "пл", "пр",
        "сл", "см", "сн", "сп", "ст", "тр", "фл", "фр", "хл", "хр", "цв", "шк", "шл", "шп", "шт", "щи",
    ]),
    legalCodas: new Set([
        "ст", "сть", "нт", "нд", "нс", "рт", "рд", "рс", "рн", "рм", "лт", "лд", "лс", "кт", "кс",
        "пт", "фт", "зд", "зн", "сн", "см", "тр", "др", "бр", "вр", "гр", "пр", "кр", "нк", "нг",
    ]),
});

/** LEXICAL: acronyms spelled out. Authored in russian.jsonc beside the other hand-authored facts. */
const ACRONYM_LETTERS: ReadonlySet<string> = new Set(MANIFEST.acronymLetters);

/** Russian's lexicon is a STRESS dictionary, not a wordlist of attested forms, so it cannot serve as the
 *  "is this recorded" test. Acronyms are decided by the lexical list plus the OOV rule alone. */
export function normalizeRussianInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        acronymLetters: ACRONYM_LETTERS,
        isRecorded: () => false,
        isUnreadable: isUnreadableRussian,
    })(text);
}

/** Slavic count agreement for a counted noun: [nominative sg, paucal, genitive pl]. */
function counted(n: number, forms: readonly [string, string, string]): string {
    return forms[Math.min(slavicCountForm(n), 2)]!;
}
const HOUR = ["час", "часа", "часов"] as const;
const MINUTE = ["минута", "минуты", "минут"] as const;

/** Abbreviations. `г.`/`гг.` are the frequent ones (×10) and were reading as a bare [k]. */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    "г": "года", "гг": "годов", "в": "века", "вв": "веков",
    "ул": "улица", "им": "имени", "стр": "страница", "проф": "профессор", "акад": "академик",
    "руб": "рублей", "тыс": "тысяч", "млн": "миллионов", "млрд": "миллиардов",
};
const ABBREV_ALT = Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|");

/** Normalize one Russian input string. Pure text→text. */
export function normalizeRussian(input: string): string {
    let s = input;

    // 0) DIGIT GROUPING with a space — the Russian convention, and the number token cannot span a space, so
    //    "5 000 лет" read as "пять ноль лет".
    s = s.replace(new RegExp(`(\\d)[${GROUP_SPACE}](\\d{3})(?!\\d)`, "gu"), "$1$2");
    s = s.replace(new RegExp(`(\\d)[${GROUP_SPACE}](\\d{3})(?!\\d)`, "gu"), "$1$2");
    s = s.replace(/[    ]/gu, " ");

    // 1) MULTI-DOT ABBREVIATIONS, before the single-letter rule so `н. э.` and `т. е.` are claimed whole —
    //    their interior dots were becoming phrase breaks.
    //
    //    THE TRAILING DOT IS TWO DIFFERENT THINGS and the first version consumed it unconditionally, so
    //    "в 200 г. н. э. Затем…" ran straight into the next sentence with the boundary GONE. Found by the
    //    Ukrainian run, which hit the identical bug in its own first pass and reported it here.
    //    The discriminator is CASE, which a cased script gives for free: a lowercase word or a digit after
    //    the dot continues the sentence, so the dot was the abbreviation's own and is consumed; an
    //    uppercase word or end-of-input means it was doing double duty as the sentence end, so it stays.
    //    Following punctuation already carries the break, so the dot is consumed there too rather than
    //    doubled (`н. э.,` was emitting both a `.` and a `,`).
    const MULTI_DOT: ReadonlyArray<readonly [string, string]> = [
        ["до\\s+н\\.\\s?э", "до нашей эры"],
        ["н\\.\\s?э", "нашей эры"],
        ["т\\.\\s?е", "то есть"],
        ["т\\.\\s?д", "так далее"],
        ["т\\.\\s?п", "тому подобное"],
    ];
    //    The case test happens in the CALLBACK, not in the pattern. `\p{Ll}` inside a regex carrying the
    //    `i` flag matches uppercase as well — case-insensitive matching case-folds property escapes — so a
    //    lookahead written that way fired on "Затем" and ate the boundary anyway. The abbreviation itself
    //    still needs `i` (both `н. э.` and `Н. Э.` occur), so the two cannot share one pattern.
    for (const [pat, words] of MULTI_DOT) {
        s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])${pat}\\.(\\s*)(\\S?)`, "giu"),
            (_m: string, sp: string, next: string) => {
                if (next === "") return `${words}.`; // end of input ⇒ it was the sentence end
                if (/[,;:!?)»]/u.test(next)) return `${words}${sp}${next}`; // the mark carries the break
                if (/\p{Lu}/u.test(next)) return `${words}.${sp}${next}`; // a new sentence starts
                return `${words}${sp}${next}`; // the sentence continues
            });
    }

    // 2) НОМЕР. The sign was dropped outright.
    s = s.replace(/№\s?(?=\d)/gu, "номер ");

    // 3) ORDINAL NOTATION. The suffix is the CASE ending, not an appendable marker (see the file header).
    s = s.replace(new RegExp(`\\b(\\d+)\\s?-\\s?(${CASE_ALT})(?![а-яё])`, "giu"),
        (whole, digits: string, written: string) => {
            const base = ordinalBase(Number(digits));
            if (base === undefined) return whole;
            return inflectOrdinal(base, written.toLowerCase()) ?? whole;
        });

    // 3b) `г.` after a year is года, EXCEPT after the preposition в, which governs the prepositional
    //     году ("в 2007 г." = в 2007 году). All three corpus instances are year contexts — none is the
    //     city sense of г., which would need a different expansion and does not occur here.
    s = s.replace(/(?<![\p{L}\p{M}])(в|во)\s+(\d+)\s*г\./giu, "$1 $2 году");

    // 4) DOTTED ABBREVIATIONS. The dot is consumed so it cannot become a phrase break.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(\\s+)(?=\\p{L})`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}${sp}`);
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}.`);

    // 5) UNITS the shared tier cannot express: the Cyrillic slash unit and the degree signs.
    s = s.replace(/(\d)\s?км\/ч(?![а-яё])/giu, "$1 километров в час");
    s = s.replace(/(\d)\s?м\/с(?![а-яё])/giu, "$1 метров в секунду");
    // ⚠ THE LOWERCASE SCALE LETTERS GO IN THE CLASS, NOT IN AN `i` FLAG. `[а-яё]` is the guard against a
    //    SPELLED-OUT scale name (`30 °Cельсия` — the ⟨C⟩ is the word's first letter, not the symbol), and
    //    under `i` that property folds to reject uppercase Cyrillic too, quietly narrowing what the rule
    //    will claim. The class carries both cases of both alphabets instead.
    s = s.replace(/(\d)\s?°\s?[CСcс](?![а-яё])/gu, "$1 градусов Цельсия");
    s = s.replace(/(\d)\s?°\s?[FФfф](?![а-яё])/gu, "$1 градусов Фаренгейта");
    s = s.replace(/(\d)\s?°/gu, "$1 градусов");

    // 6) CLOCK. The colon was a clause mark, so "11:00" read as "одиннадцать , ноль". час and минута take
    //    Slavic count agreement (1 час / 2 часа / 5 часов).
    //    Guarded against a SPORTS time: "2:11,60 минуты" is 2 minutes 11.60 seconds, not two o'clock, and
    //    the corpus contains one. A comma-plus-digit after the minutes marks decimal seconds.
    s = s.replace(/\b([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?!,\d)/gu, (_m, h: string, min: string) => {
        const hv = Number(h), mv = Number(min);
        const head = `${numberToWords(hv)} ${counted(hv, HOUR)}`;
        return mv === 0 ? head : `${head} ${numberToWords(mv)} ${counted(mv, MINUTE)}`;
    });

    // 7) SIGNS.
    s = s.replace(/(^|[\s(])[-−–](\d)/gu, "$1минус $2");
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
    //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
    //    reading is this language's own two words juxtaposed, both taken from the plus and minus rules
    //    already in this file.
    s = s.replace(/±/gu, " плюс минус ");
    s = s.replace(/(\S)\+\s?(\d)/gu, "$1 плюс $2");
    s = s.replace(/(^|\s)\+\s?(\d)/gu, "$1плюс $2");

    // 7b) RELATIONAL AND DIVISION SIGNS. ⚠ THE SOURCE HERE IS A PRONUNCIATION GLOSS, which is the strongest
    //     shape this kind of evidence takes: the arithmetic articles do not merely use these words, they
    //     QUOTE THE SPOKEN READING of the notation beside the notation itself —
    //
    //       6 : 3 = 2    («шесть разделить на три равно два»)
    //       65 : 5 = 13  («шестьдесят пять разделить на пять равно тринадцать»)
    //       «два плюс два равно четыре»
    //
    //     — so the division word and the equals word are sourced together, in the slot, as speech.
    //
    //     ⚠ AND THE CORPUS EVIDENCE FOR `равно` IS THE WRONG SENSE. It is ×4 TOKEN in ru_ru and every hit is the
    //     conjunction `равно как и` ("as well as"), which has no arithmetic reading at all. ⚠ A COUNT-ONLY
    //     PASS WOULD HAVE CALLED THE EQUALS WORD CORPUS-SOURCED — the count is right and the sense is wrong.
    //
    //     ⚠ THE COMPARATIVES TAKE `чем` RATHER THAN THE BARE GENITIVE, and that is a grammatical requirement,
    //     not a stylistic choice. Russian `меньше` governs the GENITIVE — the register quotes are `меньше нуля`,
    //     `больше 1` — and `numbers.ts` emits NOMINATIVE cardinals, so `7 < 3` would read *семь меньше три*,
    //     an ungrammatical case. The `чем` construction takes the nominative and is what the corpus itself
    //     uses (`меньше чем` ×8, `больше чем` ×6 phrase hits in ru_ru — "фотоны намного меньше чем те",
    //     "в четыре раза больше чем у 35-миллиметрового негатива"), so it is both grammatical and tier-2
    //     attested. `разделить на` governs the accusative, which for these numerals is identical to the
    //     nominative, so the division rule needs no such repair.
    s = s.replace(/\s?=\s?/gu, " равно ");
    s = s.replace(/\s?<\s?/gu, " меньше чем ");
    s = s.replace(/\s?>\s?/gu, " больше чем ");
    s = s.replace(/\s?÷\s?/gu, " разделить на ");

    // 8) FRACTIONS — feminine, agreeing with the elided *часть*: 1/5 is «одна пятая».
    s = s.replace(/\b(\d{1,3})\/(\d{1,3})\b(?!\s*[/\d])/gu, (m0, a: string, b: string) => {
        const num = Number(a), den = Number(b);
        if (num === 1 && den === 2) return "одна вторая";
        const base = ordinalBase(den);
        if (base === undefined) return m0;
        const fem = inflectOrdinal(base, "я");
        const numWord = numberToWords(num).replace(/один$/u, "одна").replace(/два$/u, "две");
        return fem === undefined ? m0 : `${numWord} ${fem}`;
    });

    return s;
}
