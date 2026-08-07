/**
 * Serbian (sr) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ SERBIAN IS DIGRAPHIC. Every rule accepts BOTH spellings of the words it matches on, via a Cyrillic→Latin
 * transliteration of the captured text, so `1624. године` and `1624. godine` behave alike. Output words are
 * emitted in LATIN, matching what `numbers.ts` emits for cardinals; the g2p maps the two scripts to the same
 * IPA, so the choice is cosmetic. `serbian.ts`'s TOKEN claims both scripts, so nothing here ever reaches
 * `core/foreign.ts`.
 *
 * ⚠ AN ORDINAL IS THE NUMERAL PLUS A PERIOD, which collides with the sentence break — the defect this file
 * exists for. Read naively, `1624. године` is a CARDINAL plus a spurious clause boundary. The rule fires only
 * before a LOWERCASE word from the closed LICENSOR list, and since Serbian capitalises every sentence start,
 * that guard leaves genuine sentence-final periods intact.
 *
 * COUNT AGREEMENT follows RUSSIAN, not Polish: 2–4 → genitive singular (`83 метра`), 5+ → genitive plural
 * (`48 сати`), so the shared `slavicCountForm` is reused unchanged. A DECIMAL needs no fourth `CountForms`
 * entry — Serbian writes `1,5 километара`, the genitive plural, which is where `numValue` already maps a
 * fraction.
 *
 * Deliberately absent:
 *   · INITIALISMS. Latin acronyms (FBI, GPS, CCTV) reach the g2p as unreadable clusters, but whether Serbian
 *     reads a foreign Latin acronym with Serbian or English letter names is a LEXICAL fact, and inventing it
 *     would be confidently wrong rather than merely raw. No `acronymLetters`/`letterName` data is declared.
 *   · `Св.` — the saint's name occurs in three different CASES, and one expansion cannot serve all three.
 *   · Roman numerals arrive already converted to digits at the registry seam (sr is not in `ROMAN_NATIVE`),
 *     so the roman-vs-initialism ordering hazard cannot arise here.
 *
 * ⚠ Every boundary in this file is an explicit lookaround, never `\b`. `\b` is defined on ASCII word
 * characters and finds none against Cyrillic — the trap that made `core/initialisms.ts` a total no-op for
 * Russian (США → [sʂa]).
 */
import { makeSymbolNormalizer, slavicCountForm } from "../../core/normalizeSymbols.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

// ---------------------------------------------------------------------------------------------------
// SCRIPT
// ---------------------------------------------------------------------------------------------------

/** Serbian Cyrillic → Gaj's Latin, a strict bijection (Vuk's alphabets were designed as one). Lets a captured
 *  word or suffix in either script be read against a single Latin key set. */
const CYR2LAT: Readonly<Record<string, string>> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", ђ: "đ", е: "e", ж: "ž", з: "z", и: "i", ј: "j",
    к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t",
    ћ: "ć", у: "u", ф: "f", х: "h", ц: "c", ч: "č", џ: "dž", ш: "š",
};

/** Lowercase and transliterate to Latin, so one key set serves both scripts. */
function lat(word: string): string {
    let out = "";
    for (const ch of word.toLowerCase()) out += CYR2LAT[ch] ?? ch;
    return out;
}

// ---------------------------------------------------------------------------------------------------
// ORDINALS
// ---------------------------------------------------------------------------------------------------

/** Masculine-nominative ordinals — the citation form the paradigm below inflects. `treći` is the one SOFT
 *  stem (see ENDINGS). */
const ORD_1_19: readonly string[] = [
    "", "prvi", "drugi", "treći", "četvrti", "peti", "šesti", "sedmi", "osmi", "deveti",
    "deseti", "jedanaesti", "dvanaesti", "trinaesti", "četrnaesti", "petnaesti", "šesnaesti",
    "sedamnaesti", "osamnaesti", "devetnaesti",
];
const ORD_TENS: readonly string[] = [
    "", "deseti", "dvadeseti", "trideseti", "četrdeseti", "pedeseti", "šezdeseti", "sedamdeseti",
    "osamdeseti", "devedeseti",
];
/** The hundreds ordinal is built on the (irregular) hundreds cardinal: sto→stoti, dvesta→dvestoti. */
const ORD_HUNDREDS: readonly string[] = [
    "", "stoti", "dvestoti", "tristoti", "četiristoti", "petstoti", "šeststoti", "sedamstoti",
    "osamstoti", "devetstoti",
];

/**
 * Integer → the masculine-nominative ordinal. Only the LAST element inflects in Serbian, so a compound is
 * its CARDINAL head plus the ordinal of the final non-zero part — 1624 → *hiljadu šeststo dvadeset* +
 * četvrti, 1500 → *hiljadu* + petstoti. The head goes through the engine's own cardinal composer so it reads
 * exactly as the bare numeral would.
 *
 * `undefined` for a round thousand other than 1000 (2000., 5000.): those need the FUSED form *dvehiljaditi*,
 * a different word-formation, not attempted here. Returning undefined leaves the text untouched rather than
 * emitting a guess.
 */
function ordinalBase(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n >= 1_000_000) return undefined;
    if (n < 20) return ORD_1_19[n];
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        return u === 0 ? ORD_TENS[t] : `${N.tens[t]!} ${ORD_1_19[u]!}`;
    }
    if (n < 1000) {
        const r = n % 100;
        return r === 0 ? ORD_HUNDREDS[n / 100] : `${numberToWords(n - r)} ${ordinalBase(r)!}`;
    }
    if (n === 1000) return "hiljaditi";
    const r = n % 1000;
    if (r === 0) return undefined; // dvehiljaditi & co. — not attempted, see above
    return `${numberToWords(n - r)} ${ordinalBase(r)!}`;
}

/**
 * Definite-adjective endings for an ordinal, [HARD stem, SOFT stem]. `treći` is the only soft ordinal, and it
 * differs exactly where the ending starts with a back vowel: trećEg / trećEm / trećE, not *trećog. Keys name
 * the slot a licensing word governs; the values replace the citation form's final `-i`.
 */
const ENDINGS: Readonly<Record<string, readonly [string, string]>> = {
    "m.nom": ["i", "i"], "m.gen": ["og", "eg"], "m.loc": ["om", "em"], "n.nom": ["o", "e"],
    "f.nom": ["a", "a"], "f.gen": ["e", "e"], "f.dat": ["oj", "oj"], "f.acc": ["u", "u"],
    "pl.gen": ["ih", "ih"],
};

/** Inflect a citation-form ordinal into one slot. Only the final word carries the ending. */
function inflect(base: string, slot: string): string | undefined {
    const e = ENDINGS[slot];
    if (e === undefined) return undefined;
    const words = base.split(" ");
    const last = words[words.length - 1]!;
    const soft = last.endsWith("ći"); // treći
    words[words.length - 1] = `${last.slice(0, -1)}${soft ? e[1] : e[0]}`;
    return words.join(" ");
}

/** Every slot's form for `n`, for the suffix-matching rule (step 5). */
function ordinalForms(n: number): string[] {
    const base = ordinalBase(n);
    if (base === undefined) return [];
    return Object.keys(ENDINGS).map((k) => inflect(base, k)!);
}

/**
 * The closed list of LICENSING words that make a bare `N.` an ordinal, each mapped to the case slot it
 * governs. Nothing outside this list is claimed, which is what keeps every sentence-final period intact.
 *   · godina is FEMININE — `1624. godine` gen, `u 1988. godini` loc, `za 2016. godinu` acc
 *   · vek is MASCULINE — `16. veka` gen, `u 20. veku` loc
 *   · a month name after a day number is the GENITIVE of a masculine noun — `21. jula` → dvadeset prvog
 */
const LICENSOR: Readonly<Record<string, string>> = {
    godine: "f.gen", godini: "f.dat", godinu: "f.acc", godina: "f.nom",
    veka: "m.gen", veku: "m.loc", vek: "m.nom", vijeka: "m.gen", vijeku: "m.loc",
    januara: "m.gen", februara: "m.gen", marta: "m.gen", aprila: "m.gen", maja: "m.gen",
    juna: "m.gen", jula: "m.gen", avgusta: "m.gen", septembra: "m.gen", oktobra: "m.gen",
    novembra: "m.gen", decembra: "m.gen",
};

// ---------------------------------------------------------------------------------------------------
// COUNTED NOUNS
// ---------------------------------------------------------------------------------------------------

/** Pick a three-form Slavic count noun for `n`: [nom.sg, gen.sg (2–4), gen.pl]. */
function counted(n: number, forms: readonly [string, string, string]): string {
    return forms[Math.min(slavicCountForm(n), 2)]!;
}
const SAT = ["sat", "sata", "sati"] as const;
const MINUT = ["minut", "minuta", "minuta"] as const;
const STEPEN = ["stepen", "stepena", "stepeni"] as const;
const METAR = ["metar", "metra", "metara"] as const;
const MEGABIT = ["megabit", "megabita", "megabita"] as const;

/** Dotted abbreviations whose dot is NOT a sentence end. */
const DOTTED: Readonly<Record<string, string>> = {
    itd: "i tako dalje",
    npr: "na primer",
    tzv: "takozvani",
};
/** Latin → Serbian Cyrillic, the inverse of CYR2LAT, so a rule keyed on Latin also matches the Cyrillic
 *  spelling. Written out rather than inverted at runtime because the digraph values (lj/nj/dž) do not invert
 *  character-by-character; none of them occurs in the keys above. */
const LAT2CYR: Readonly<Record<string, string>> = Object.fromEntries(
    Object.entries(CYR2LAT).filter(([, l]) => l.length === 1).map(([c, l]) => [l, c]),
);
function cyr(word: string): string {
    let out = "";
    for (const ch of word) out += LAT2CYR[ch] ?? ch;
    return out;
}
/** ⚠ BOTH SCRIPTS in the alternation. Latin keys alone make the rule a no-op on Cyrillic prose — `итд.` still
 *  reads as [itd] plus a phrase break. Digraphia bites the same way `\b` does: a rule that looks right
 *  matches nothing. */
const DOTTED_ALT = Object.keys(DOTTED)
    .flatMap((k) => [k, cyr(k)])
    .sort((a, b) => b.length - a.length)
    .join("|");

const NOT_LETTER = "(?![\\p{L}\\p{M}])";

/**
 * The shared symbol tier. Unit abbreviations are written in LATIN even in Cyrillic prose, so the keys are
 * Latin only; the tier lowercases before lookup, which is what lets `Ghz` match `ghz`.
 *
 * `unitPer` is "na" + ACCUSATIVE (`240 километара НА сат`). The SECOND-based rate takes a different
 * preposition — `1,5 километара У СЕКУНДИ` — which one `unitPer` cannot express, so `/s` is composed locally
 * in step 6 instead.
 */
const SYMBOLS = makeSymbolNormalizer({
    ampersand: "и",
    /** Declaring `multiply` is what makes ASCII `x` read like `×`: without it `6x6 cm` reads the `x` as a
     *  LETTER NAME. One word, so `by` is omitted and defaults to it — Serbian does not split dimension from
     *  product. */
    multiply: { times: "puta" },
    percent: ["posto"],
    /**
     * Currency words DECLINE, so all three count forms are declared: 1 долар · 2–4 долара · 5+ долара.
     *
     * ⚠ `€` AND `£` ARE DELIBERATELY ABSENT, and both are traps. The apparent euro stem `евр` is
     * overwhelmingly **Европа** — the stem of Europe. `фунти` is the WEIGHT pound ("Особа која на Земљи тежи
     * 200 фунти"), not the currency; the Malay `paun` trap exactly.
     */
    currency: { $: ["dolar", "dolara", "dolara"], "¥": ["jen", "jena", "jena"] },
    units: {
        km: ["kilometar", "kilometra", "kilometara"],
        m: ["metar", "metra", "metara"],
        mm: ["milimetar", "milimetra", "milimetara"],
        cm: ["centimetar", "centimetra", "centimetara"],
        mi: ["milja", "milje", "milja"],
        ghz: ["gigaherc", "gigaherca", "gigaherca"],
    },
    unitPer: "na",
    rateDenominators: { h: "sat" }, // `s` is NOT declared: its Serbian rate is "u sekundi", not "na …"
    // Serbian puts the measure adjective BEFORE the noun as a separate agreeing word, Russian-style —
    // *квадратних километара*, *кубних метара*.
    exponentWords: {
        squared: ["kvadratni", "kvadratna", "kvadratnih"],
        cubed: ["kubni", "kubna", "kubnih"],
        position: "before",
    },
    countForm: slavicCountForm,
});

// ---------------------------------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------------------------------

/** Normalize one Serbian input string. Pure text→text. */
export function normalizeSerbian(input: string): string {
    let s = input;

    // 0) DIGIT DE-GROUPING, FIRST — Serbian groups thousands with a PERIOD, and until it is removed the
    //    period reads as clause punctuation and the number splits in two (`1.300` → *jedan . trista*).
    //    Two passes, because adjacent groups share a digit (`800.000`). EXACTLY three digits and no space,
    //    which keeps `802.11` (a Wi-Fi standard), `12.00 сати` (step 2) and every sentence-final `N.` out.
    for (let i = 0; i < 2; i++) s = s.replace(/(\d)\.(\d{3})(?!\d)/gu, "$1$2");

    // 1) MULTI-DOT ERA MARKER, before the single-dot abbreviation rule (step 3) and before the `N.` ordinal
    //    rule (step 7) — `1000. п. н. е.` contains both, and its interior dots become phrase breaks.
    //    ⚠ THE FINAL DOT IS TWO DIFFERENT THINGS: in `Око 1000. п. н. е. Асирци су…` it is also the sentence
    //    end, and consuming it unconditionally loses the boundary. The discriminator is CASE, and the test
    //    must run in the CALLBACK: `\p{Lu}` inside an `i`-flagged pattern matches lowercase too.
    //    A YEAR immediately before the era marker is an ORDINAL with *godina* ELIDED (`Око 1000. п. н. е.` =
    //    *oko hiljadite pre nove ere*), and step 7 cannot see it because step 1 will have rewritten the
    //    marker by then. Claimed here, in the feminine genitive the elided noun governs.
    s = s.replace(/(?<![\d.,])(\d{1,4})\.\s+(?=(?:п\.\s?н\.\s?е|p\.\s?n\.\s?e)(?![\p{L}\p{M}]))/giu,
        (whole, digits: string) => {
            const base = ordinalBase(Number(digits));
            return base === undefined ? whole : `${inflect(base, "f.gen")!} `;
        });
    for (const [pat, words] of [["п\\.\\s?н\\.\\s?е", "pre nove ere"], ["p\\.\\s?n\\.\\s?e", "pre nove ere"],
        ["н\\.\\s?е", "nove ere"], ["n\\.\\s?e", "nove ere"]] as const) {
        s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])${pat}\\.(\\s*)(\\S?)`, "giu"), replaceEra(words));
        //    THE FINAL DOT IS SOMETIMES ABSENT (`п.н.е,`), so a second pass claims the dotless form. Guarded
        //    against a following letter so it cannot bite into a real word.
        s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])${pat}(?![\\p{L}\\p{M}.])`, "giu"), words);
    }

    // 2) DOT-WRITTEN CLOCK — `12.00 сати`. Claimed only when the hour noun is already WRITTEN, which is what
    //    separates it from a decimal; the trailing noun is left in place and the dot pair dropped. Must run
    //    after step 0 (which would otherwise not touch it — 2 digits, not 3) and before step 8.
    s = s.replace(/(?<![\d.,])(\d{1,2})\.(\d{2})(?=\s*(?:сати|часова|sati|časova))/gu,
        (_m, h: string, min: string) => (Number(min) === 0 ? h : `${h} i ${Number(min)}`));

    // 3) DOTTED ABBREVIATIONS. The dot is consumed before a following word so it cannot become a phrase
    //    break; at a real sentence end it is kept.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${DOTTED_ALT})\\.(\\s+)(?=[\\p{L}\\d(])`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED[lat(ab)]!}${sp}`);
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${DOTTED_ALT})\\.(?=\\s*[,;:])`, "giu"),
        (_m, ab: string) => DOTTED[lat(ab)]!);
    //    ⚠ A CLOSING BRACKET OR QUOTE IS NOT A PAUSE — serbian.jsonc maps only `.!?…,;:` — so the dot must be
    //    KEPT before one, not consumed the way it is before a comma. Grouping `)` with the comma silently
    //    loses the sentence-final pause on `…, итд.)`.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${DOTTED_ALT})\\.(?=\\s*(?:[.!?”"»)\\]]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED[lat(ab)]!}.`);

    // 3b) SIGNS, before the degree rules — the ordering matters because `±` is a single character the `+`
    //     rule cannot see, and the `+` arms must not claim the `°` shapes' spacing.
    // ⚠ THE MINUS GUARDS EACH REJECT A REAL SHAPE, and none of them is redundant:
    //      · a digit IMMEDIATELY AFTER the sign — rejects the spaced `- 2` form
    //      · a letter or digit IMMEDIATELY BEFORE — rejects `il-76` and closed ranges
    //      · a digit ANYWHERE to the left — rejects the SPACED range or score (`26 - 00`), where the character
    //        before the hyphen is a SPACE and the usual guard misses it
    //    ⚠ WHAT NONE OF THEM CAN REJECT is a spaced DESIGNATION: `word -1` has the same shape as a genuine
    //    `was -5`. Serbian accepts that residual risk; mr and nl decline the rule outright over it (see
    //    ACCEPTED_SIGN_SILENCE in defects.ts).
    s = s.replace(/(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)/gu, (m0: string, off: number, whole: string) =>
        /\d\s*$/u.test(whole.slice(0, off)) ? m0 : "минус ");
    s = s.replace(/±/gu, " плус минус ");
    s = s.replace(/(\S)\+\s?(?=\d)/gu, "$1 плус ");
    s = s.replace(/(^|\s)\+\s?(?=\d)/gu, "$1плус ");

    // 3c) RELATIONAL AND DIVISION SIGNS. All four are ADJ + од constructions read in written order.
    //     ⚠ `једнако` IS ALSO A COMMON ADVERB ("equally"), which has no arithmetic reading — the arithmetic
    //     sense has to be sourced from a mathematical register, not from running prose.
    s = s.replace(/\s?=\s?/gu, " једнако ");
    s = s.replace(/\s?<\s?/gu, " мање од ");
    s = s.replace(/\s?>\s?/gu, " веће од ");
    s = s.replace(/\s?÷\s?/gu, " подељено са ");

    // 4) DEGREES, two arms. The first claims `°C` / `°F` and supplies both the degree noun and the scale
    //    name. A WRITTEN degree noun is CONSUMED when present (`32 °C степена`), or the word is emitted
    //    twice; the count agrees with the numeral (32 → gen.sg stepena), not with what was written.
    s = s.replace(/(\d+)\s?°\s?([CFСcf])(?![\p{L}\p{M}])(\s*(?:степен[аи]|stepen[ai]))?/gu,
        (_m, n: string, unit: string, _written: string | undefined) =>
            `${n} ${counted(Number(n), STEPEN)} ${/[Ff]/u.test(unit) ? "Farenhajta" : "Celzijusa"}`);
    //    4b) THE BARE DEGREE emits the degree noun ONLY, no scale word — right for a longitude (`35°W`) and
    //    harmless for a bare temperature. Safe unguarded because the C/F arm above has already consumed
    //    those forms. It consumes a written degree noun for the same reason the C/F arm does.
    //    ⚠ THE COMPASS LETTER IS STILL NOT READ, a stated limit rather than an oversight: the full form is
    //    *35 степени западне географске дужине*, and the four-way compass table cannot be completed without
    //    inventing its missing quarter.
    s = s.replace(/(\d+)\s?°(\s*(?:степен[аи]|stepen[ai]))?/gu,
        (_m, n: string, _written: string | undefined) => `${n} ${counted(Number(n), STEPEN)}`);

    // 5) NUMERAL + HYPHEN + CASE SUFFIX (`1970-их`, `15-ог`, `11-ом`, `13-то`). As in Russian, the written
    //    suffix is the LAST LETTERS of the inflected ordinal, not an appendable marker, so the rule generates
    //    every case form and keeps the one that actually ends with those letters — a guard that makes the
    //    paradigm safe and rejects anything it does not cover.
    //    MUST run before the range rule (step 6b), which would otherwise eat the hyphen. The suffix is capped
    //    at 2 letters and may not be followed by a letter, which excludes COMPOUND ADJECTIVES
    //    (`24-часовном`, `11-годишња`): those need the combining stem (dvadesetčetvoro-, jedanaesto-), a
    //    different word-formation, and are left as the cardinal plus the word.
    s = s.replace(new RegExp(`(?<![\\d.,])(\\d+)\\s?-\\s?(\\p{Ll}{1,2})${NOT_LETTER}`, "gu"),
        (whole, digits: string, rawSuffix: string) => {
            const suffix = lat(rawSuffix);
            return ordinalForms(Number(digits)).find((f) => f.endsWith(suffix)) ?? whole;
        });

    // 6) UNITS THE SHARED TIER CANNOT EXPRESS, before the tier itself and before every rule that destroys
    //    number-to-unit adjacency (the decimal fold, step 10). The `/s` rate takes "u sekundi", not
    //    `unitPer`'s "na" + accusative, and one `unitPer` cannot carry both.
    s = s.replace(/(\d+(?:[.,]\d+)?)\s?Mbit\s?\/\s?s(?![\p{L}\p{M}])/gu,
        (_m, n: string) => `${n} ${counted(intOf(n), MEGABIT)} u sekundi`);
    s = s.replace(/(\d+(?:[.,]\d+)?)\s?m\s?\/\s?s(?![\p{L}\p{M}])/gu,
        (_m, n: string) => `${n} ${counted(intOf(n), METAR)} u sekundi`);

    // 6b) NUMERIC RANGES — the dash was dropped outright, fusing the endpoints into one run of words. Digits
    //     on BOTH sides keeps `COVID-19`, `XDR-TB` and `A1GP` out. Runs AFTER step 5 (which needs the hyphen)
    //     and BEFORE step 7, so `1000-1300. године` still has a digit on the right when this fires.
    //     Known false positives: SCORES and seasons (`6-6`, `1995-96`) where "do" is the wrong connective —
    //     but the endpoints were fusing there too, so no reading is lost, only a wrong-ish connective gained.
    s = s.replace(/(\d)\s?[-–—]\s?(?=\d)/gu, "$1 do ");

    // 7) THE `N.` ORDINAL — the rule this file exists for (see the header). Claimed ONLY when a licensing
    //    word from the closed list follows, and only when that word is LOWERCASE. The case guard is what
    //    preserves the sentence boundary: `21. Кудебек је…` is a sentence end whose next word happens to be
    //    capitalised, and Serbian starts every sentence with a capital, so requiring lowercase excludes those
    //    by construction. Nothing outside the list is touched at all.
    //    Runs AFTER step 0 (de-grouping) so `1.300` is already whole, and AFTER step 1 so `п. н. е.` is gone
    //    and cannot be mistaken for a licensor.
    s = s.replace(/(?<![\d.,])(\d{1,4})\.\s+(\p{Ll}[\p{L}\p{M}]*)/gu,
        (whole, digits: string, word: string) => {
            const slot = LICENSOR[lat(word)];
            if (slot === undefined) return whole;
            const base = ordinalBase(Number(digits));
            if (base === undefined) return whole; // round thousands — see ordinalBase
            return `${inflect(base, slot)!} ${word}`;
        });

    // 8) CLOCK. The colon is clause punctuation in serbian.jsonc, so `11:00` read as *jedanaest , nula*.
    //    Serbian says a CARDINAL hour with the counted noun — `u 11 sati` — unlike Ukrainian's feminine
    //    ordinal. TWO-DIGIT minutes are required, which keeps scores (`5:3`, `26 : 0`) out. Runs before the
    //    decimal fold (step 10).
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:.,])/gu, (_m, h: string, min: string) => {
        const hv = Number(h), mv = Number(min);
        const head = `${numberToWords(hv)} ${counted(hv, SAT)}`;
        return mv === 0 ? head : `${head} i ${numberToWords(mv)} ${counted(mv, MINUT)}`;
    });

    // 9) THE SHARED SYMBOL TIER — %, units, rates. It must see the number still ADJACENT to its unit and
    //    still carrying its decimal comma (`3,50 m`, `2,4 Ghz`), so it runs before step 10 folds the comma
    //    into a word, and after step 0 has made the integer whole.
    s = SYMBOLS(s);

    // 10) DECIMAL COMMA → *zarez*. LAST among the numeric rules, because it destroys the number: every rule
    //     above that needs the value (units, the clock, the tier's count agreement) has already run.
    s = s.replace(/(?<=\d),(?=\d)/gu, " zarez ");

    // 11) `×`/`x` between digits was dropped outright, fusing `4x4`, `6×2` and `36 x 24 mm` into two bare
    //     numerals; `+` lost its sign.
    //     ⚠ NO LEADING-MINUS RULE HERE. Reading a leading `–`/`−` before a number as a minus, the way ru and
    //     uk do, misreads the PUNCTUATION dash: `…изгледа низак – 6000 од укупно…` becomes *…nizak MINUS šest
    //     hiljada…*. Confidently wrong, which is worse than the dropped dash it replaces.
    s = s.replace(/(?<=\d)\s?[x×]\s?(?=\d)/gu, " puta ");
    s = s.replace(/(^|[\s(])\+\s?(\d)/gu, "$1plus $2");

    return s;
}

/** Integer part of a Serbian-written number ("3,50" → 3), for the local count-agreement calls. */
function intOf(n: string): number {
    return Math.trunc(Number(n.replace(/\./gu, "").replace(",", ".")));
}

/**
 * The era-marker replacer (step 1). Keeps the final dot only when it was ALSO the sentence end: end of input,
 * or a following capital. A following punctuation mark already carries the break, so the dot is consumed
 * there rather than doubled.
 */
function replaceEra(words: string): (m: string, sp: string, next: string) => string {
    return (_m: string, sp: string, next: string): string => {
        if (next === "") return `${words}.`;
        if (/[,;:!?)»”"]/u.test(next)) return `${words}${sp}${next}`;
        if (/\p{Lu}/u.test(next)) return `${words}.${sp}${next}`;
        return `${words}${sp}${next}`;
    };
}
