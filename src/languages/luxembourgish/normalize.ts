/**
 * Luxembourgish (lb) TEXT NORMALIZATION — the #562 pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Measured over FLEURS lb_lu, 1,896 utterances, COLUMN 3 (the cased original):
 *   ordinals `N.` ×67 (63 licensed + 4 sentence-final that must NOT be claimed) · space-grouped thousands
 *   ×50 · units ×40 · period-CLOCKS ×26 · comma decimals ×23 · dotted abbreviations ×20 · ranges ×11 ·
 *   currency ×6 · period-grouped thousands ×4 · percent ×3 · sports times ×3 · degrees ×3 · `+N` ×2 ·
 *   fraction ×1 · dot decimal ×1. Negative numbers: ZERO (every `-N` is a compound hyphen).
 *
 * ── THE PERIOD IS THE CRUX ─────────────────────────────────────────────────────────────────────────────
 * Luxembourgish writes with German conventions, so `.` carries four jobs at once. The corpus separates
 * them with no heuristics at all, and the discriminator is FRACTION LENGTH:
 *
 *   `1.000 $`        thousands grouping   — exactly THREE digits after the dot          (×4)
 *   `7.19 Auer`      clock                — TWO digits, plus a licenser                 (×26)
 *   `16. Joerhonnert` ordinal             — NOTHING after the dot                       (×67)
 *   `802.11n` `4.41,30` `1.1.`  neither   — a trailing letter / a following `,d` / `.`  (×9)
 *
 * This is a third solution, not either precedent: German splits grouping from the decimal inside its TOKEN
 * regex (it has no period-clock), and Czech licenses its ordinal off a case-governing preposition.
 * Luxembourgish needs the length test, because it writes BOTH the clock and the grouping with a period.
 *
 * **The COLON is not a clock in this language.** All six `\d+:\d+` in the corpus are scores or ratios —
 * `7:2`, `2:2`, `6:6`, `21:20`, `3:2`, `5:3-Victoire`. A colon-clock rule would have misfired 6 times out
 * of 6, so none is written (trap 9 (a guard alternative with no attested…)).
 *
 * ── THE ORDINAL ENDING IS THE EIFELER REGEL, NOT A CASE TABLE ──────────────────────────────────────────
 * The corpus spells out enough ordinals to derive the inflection outright:
 *   vum éischte**n** Dag · gouf eeleften **am** … · gouf siechzéngten **am** … · déi 1. an 3. **New**-…
 *   am drëtte **J**oerhonnert · vum zwanzegste **J**oerhonnert · dem zwielefte **J**oerhonnert ·
 *   den éischte **J**oresdag · ass néngte **b**eim Männer-Super-G
 *   op der drëtter Plaz · op der zweeter Plaz · op der zéngter Plaz
 * One ending, `-en`, with the language's own final-n deletion applied against the FOLLOWING word — kept
 * before ⟨n d t z h⟩ and a vowel, dropped otherwise — plus `-er` after the feminine dative `der`. The
 * sandhi is `applyEifelerRegel()` in numbers.ts, the same function the numeral connector uses.
 *
 * ── SOURCING (§5e) ─────────────────────────────────────────────────────────────────────────────────────
 * Every word emitted here is attested in FLEURS lb_lu, in the wikipron referee, or in espeak-ng's
 * `dictsource/lb_list`. `bis` as a numeric infix is corpus-attested (`100 bis 250`, `siwe bis aacht`), the
 * two rate idioms are lifted verbatim (`240 Kilometer an der Stonn`, `1,5 Kilometer pro Sekonn`), and the
 * fraction composition *stem + el* is validated against espeak's own `aachtel drëttel fënneftel néngtel
 * sechstel siwentel` with `véierel` the single irregular. THE ONE EXCEPTION is `Yen`, which no in-repo
 * source records; it carries 3 of the 6 corpus currency instances and is flagged in the PR. `St.` is
 * deliberately NOT expanded — *Sankt* is unsourced and the 5 instances are US place names.
 *
 */
import { applyEifelerRegel, numberToWords } from "./numbers.ts";

/** All twelve, each attested in the corpus and in espeak's lb_list. `Mee` is capitalised on purpose —
 *  lowercase *mee* is the conjunction "but". */
const MONTHS = "Januar|Februar|Mäerz|Abrëll|Mee|Juni|Juli|August|September|Oktober|November|Dezember";
/** The nouns that follow a digit ordinal, from the AFTER table: Joerhonnert ×23, months ×27. */
const ORDINAL_NOUN = `${MONTHS}|Joerhonnert|Joerhonnerts|Joerdausend`;
/**
 * Determiners, possessives and preposition+article contractions that license an ordinal reading. Every
 * one is attested BEFORE a digit ordinal in the corpus (den 9, de 8, dem 8, am 8, vum 7, an 3, zum 2,
 * um/nom/déi/säi/säin 1 each); the rest of the paradigm is included because it is the same closed class.
 * DELIBERATELY EXCLUDED: the copula. `ass 15. beim Männer-Super-G` is a real ordinal (the corpus spells
 * the parallel out — *ass néngte beim Männer-Super-G*) but licensing off a verb turns any sentence-final
 * numeral into an ordinal, which is trap 9 (a guard alternative with no attested…) for the sake of one instance. So is `Joer`, which precedes two
 * of the four sentence-final years.
 */
const LICENSER = new Set([
    "de", "den", "dem", "der", "dat", "déi", "d'", "d’", "am", "um", "vum", "zum", "nom", "beim",
    "an", "vun", "vu", "säi", "säin", "seng", "hir", "hire", "hiren", "hiert", "deem", "dësem", "dësen",
]);
/** The feminine dative article takes `-er`: *op der zéngter Plaz* (corpus ×3). */
const FEM_DATIVE = new Set(["der"]);
/** Space characters the corpus actually uses between a number and its neighbour: plain, NBSP (U+00A0)
 *  and NARROW NBSP (U+202F). FLEURS lb_lu writes the last two almost everywhere — `88 %`, `1.000 $`,
 *  `9 000`, `1894 – 1895`, `v. Chr.` — so a rule keyed on a plain space alone matches almost nothing. */
const SP = "[ \\u00a0\\u202f]";
/** Coordinators that chain a list of ordinals — `am 11., 12. an 13. Joerhonnert`, `dem 10. bis 11.`. */
const ORDINAL_LIST = new RegExp(
    String.raw`^(?:,|${SP}+(?:an|a|bis|oder))(?:${SP}+[\p{L}'’-]+){0,2}${SP}+\d{1,4}\.`, "u");

/**
 * Integer → the Luxembourgish ordinal STEM. Cardinal + `t` below 20, + `st` from 20, with a doubled `t`
 * collapsed (8: *aacht* + t → *aacht*) and two suppletive stems.
 *
 * TRAP 13 — the branches are the table (1, 3), the `+t` path, the `tt` collapse, the `+st` path and the
 * multi-word carrier (numberToWords joins magnitude groups with a space, so 1922 is *dausend nénghonnert…*
 * and the ending must land on the last word only, which appending to the whole string does for free).
 * Validated against espeak's lb_list, which carries the compounds `véieranzwanzegst`, `nénganzwanzegst`,
 * `néngandrëssegst` and `néngafofzegst` as well as `honnertst`/`dausendst`.
 */
const IRREGULAR_STEM: Readonly<Record<number, string>> = { 1: "éischt", 3: "drëtt" };
export function ordinalStem(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 1) return undefined;
    const irr = IRREGULAR_STEM[n];
    if (irr !== undefined) return irr;
    const card = numberToWords(n);
    if (card === "" || /\d/u.test(card)) return undefined;
    return `${card}${n < 20 ? "t" : "st"}`.replace(/tt$/u, "t");
}

/**
 * Denominator → the fraction NOUN. Composition is *ordinal stem + el*, which espeak's own list confirms
 * for 3, 5, 6, 7, 8 and 9 (`drëttel fënneftel sechstel siwentel aachtel néngtel`). `4` is the one
 * irregular it records — `véierel`, not \**véiertel* — and `2` is not a noun at all but the adjective
 * `hallef`, handled by the caller. Composing rather than tabling is trap 8 (zero corpus instances is not evidence of…)'s constructive half: the
 * corpus writes exactly one fraction (`1/5`).
 */
const FRACTION_NOUN: Readonly<Record<number, string>> = { 4: "Véierel" };
function fractionNoun(den: number): string | undefined {
    const irr = FRACTION_NOUN[den];
    if (irr !== undefined) return irr;
    const stem = ordinalStem(den);
    return stem === undefined ? undefined : `${stem.charAt(0).toUpperCase()}${stem.slice(1)}el`;
}

/** Single-dot abbreviations → the spoken words: asw. ×7, Dr. ×6, Jr. ×4, Nr. ×2. `St.` ×5 is NOT here —
 *  *Sankt* is attested in no in-repo source and all five instances are US place names, where the reading
 *  is a §5b audio question rather than a text one. Five spurious pauses beat five wrong words. */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    asw: "an sou weider", dr: "Dokter", jr: "Junior", nr: "Nummer",
};
const ABBREV_ALT = Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|");

/** Time prepositions that license a period-clock on their own: um ×5, géint ×4, tëschent ×2 (+ capitals). */
const CLOCK_PREP = /^(?:um|ëm|géint|tëschent)$/iu;
/** Zone labels the corpus writes where `Auer` would otherwise be: `(15.00 UTC)`, `23.00 Auer MDT`. */
const CLOCK_MARKER = "Auer|UTC|GMT|MDT|MST|MEZ|CET|CEST";

/** `een` before a word, with the Eifeler Regel: *een Drëttel* (corpus) but *ee Fënneftel*. */
function oneBefore(word: string): string {
    return applyEifelerRegel("een", word);
}

const ERA_MID = (ab: string): RegExp =>
    new RegExp(String.raw`(?<![\p{L}\p{M}])${ab}\.${SP}?Chr\b\.?(?=${SP}+[\p{L}\d(])`, "gu");
const ERA_BEFORE_MARK = (ab: string): RegExp =>
    new RegExp(String.raw`(?<![\p{L}\p{M}])${ab}\.${SP}?Chr\b\.?(?=${SP}*[»)\]!?,;:])`, "gu");
const ERA_END = (ab: string): RegExp =>
    new RegExp(String.raw`(?<![\p{L}\p{M}])${ab}\.${SP}?Chr\b\.?`, "gu");

const MULTIDOT_ZB = new RegExp(String.raw`(?<![\p{L}\p{M}])z\.${SP}?B\.`, "gu");
const MULTIDOT_DH = new RegExp(String.raw`(?<![\p{L}\p{M}])d\.${SP}?h\.`, "gu");

const ABBREV_MID = new RegExp(
    String.raw`(?<![\p{L}\p{M}])(${ABBREV_ALT})\.(${SP}+)(?=[\p{L}\d])`, "giu");
const ABBREV_BEFORE_MARK = new RegExp(
    String.raw`(?<![\p{L}\p{M}])(${ABBREV_ALT})\.(?=${SP}*[,;:!?»)\]])`, "giu");
const ABBREV_END = new RegExp(
    String.raw`(?<![\p{L}\p{M}])(${ABBREV_ALT})\.(?=${SP}*(?:\.|$))`, "giu");

const GROUP_DOT = /(?<![\d.,])\d{1,3}(?:\.\d{3})+(?!\d)/gu;
const GROUP_SPACE = new RegExp(String.raw`(?<![\d.,])\d{1,3}(?:${SP}\d{3}(?!\d))+`, "gu");
const SPACE_ANY = new RegExp(SP, "gu");

const ORD = new RegExp(
    String.raw`(?:([\p{L}'’-]+)(${SP}+))?(?<![\d.,:])(\d{1,4})\.(?=[,;)]?${SP})`, "gu");
const ORD_NEXT = new RegExp(String.raw`^[,;)]?${SP}+([\p{L}'’-]+)`, "u");
const ORD_NOUN_RE = new RegExp(`^(?:${ORDINAL_NOUN})$`, "u");

const SPORTS_TIME = /(?<![\d.,:])(\d{1,2})\.(\d{2}),(\d{1,2})(?!\d)/gu;
const CLOCK = new RegExp(
    String.raw`(?:([\p{L}'’]+)(${SP}+))?(?<![\d.,:])([01]?\d|2[0-3])\.([0-5]\d)(?![\d,.:\p{L}])` +
    String.raw`(?:(${SP}+)(${CLOCK_MARKER}))?`, "gu");
const DOT_DECIMAL = /(?<![\d.,:])(\d{1,2})\.(\d)(?![\d,.:\p{L}])/gu;
const COMMA_DECIMAL = /(?<![\d.,:])(\d+),(\d+)(?![\d.,])/gu;
const RANGE = new RegExp(String.raw`(\d[\d.,]*\d|\d)${SP}*[–—]${SP}*(?=\d)`, "gu");
/** `mph` ×2 and `Meile/h` ×1. NOT tier data — see the SYMBOLS comment in luxembourgish.ts for why
 *  declaring `meile` as a unit was a defect. `Meilen an der Stonn` is the corpus's own phrase, and the
 *  ⟨n⟩ survives because `an` begins with a vowel. */
const MPH = new RegExp(String.raw`(\d)${SP}?(?:mph|Meilen?${SP}?/${SP}?h)(?![\p{L}\p{M}])`, "gu");
const DEG_C = new RegExp(String.raw`(\d)${SP}?°${SP}?C(?![\p{L}\p{M}])`, "gu");
const DEG_F = new RegExp(String.raw`(\d)${SP}?°${SP}?F(?![\p{L}\p{M}])`, "gu");
const DEG_BARE = new RegExp(String.raw`(\d)${SP}?°${SP}?`, "gu");
const MINUS = /(^|[\s(])[-−](\d)/gu;
const PLUS_AFTER_WORD = new RegExp(String.raw`(\S)\+${SP}?(\d)`, "gu");
const PLUS_INITIAL = new RegExp(String.raw`(^|\s)\+${SP}?(\d)`, "gu");
const FRACTION = /(?<![\d.,:/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu;

/** Digit run → the digits spoken one at a time, which is how a decimal fraction is read. */
const perDigit = (frac: string): string => [...frac].join(" ");

/** Normalize one Luxembourgish input string. Pure text→text; the words land as TEXT so the tokenizer
 *  phonemizes them through the same g2p as everything else (trap 6 (a word your layer emits must come from the…)). */
export function normalizeLuxembourgish(input: string): string {
    let s = input;

    // 1) DE-GROUP THOUSANDS — first, before anything reads a period or a space as a boundary. Both forms
    //    were broken: `1.000 $` read *eent . null* (a phrase break plus a spurious "null") and the 50
    //    space-grouped numbers read `9 000` as *néng null*. MUST PRECEDE the clock rule, because
    //    `1.000`/`2.500`/`130.000`/`7.000` each contain a `\d{1,2}\.\d{2}` prefix that would otherwise be
    //    claimed as a time — which is exactly this language's period ambiguity, resolved by requiring
    //    EXACTLY THREE digits after the dot for grouping and TWO for a clock.
    s = s.replace(GROUP_DOT, (m) => m.replace(/\./gu, ""));
    s = s.replace(GROUP_SPACE, (m) => m.replace(SPACE_ANY, ""));

    // 2) ERA markers, before the single-dot rule so their interior dot is not left behind as a phrase
    //    break (`v. Chr.` ×7, `n. Chr.` ×3 — previously *f . χr .*). Three branches: the dot is consumed
    //    when the sentence continues, consumed when the real terminator follows (`n. Chr.).`, `v. Chr.!`),
    //    and kept only when the abbreviation itself ends the utterance. One corpus instance writes
    //    `v. Chr` with no trailing dot at all, which the first branch also takes.
    for (const [ab, word] of [["v", "vir"], ["n", "no"]] as const) {
        s = s.replace(ERA_MID(ab), `${word} Christus`);
        s = s.replace(ERA_BEFORE_MARK(ab), `${word} Christus`);
        s = s.replace(ERA_END(ab), `${word} Christus.`);
    }

    // 3) MULTI-DOT abbreviations, still before the single-dot rule (`z. B.` ×4 read *t͡s . p .*).
    s = s.replace(MULTIDOT_ZB, "zum Beispill");
    s = s.replace(MULTIDOT_DH, "dat heescht");

    // 4) SINGLE-DOT abbreviations (×19). The dot is consumed when the sentence continues, so it cannot
    //    become a phrase break, and kept at a phrase end where it really is the sentence break — the
    //    German shape — with one extra branch, because `asw., déi` and `asw.).` would otherwise keep the
    //    abbreviation dot AND its real terminator, i.e. two pauses where the text has one.
    //    `asw.` was reading *asf .*, `Dr.` *dr .*, `Jr.` *jr .*, `Nr.` *nr .*.
    s = s.replace(ABBREV_MID, (_m, ab: string, sp: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}${sp}`);
    s = s.replace(ABBREV_BEFORE_MARK, (_m, ab: string) => DOTTED_ABBREV[ab.toLowerCase()]!);
    s = s.replace(ABBREV_END, (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}.`);

    // 5) ORDINALS — the largest defect (×67), every one previously a cardinal plus a spurious PAUSE.
    //    Three licensing conditions, each read off the corpus table (see the file header and trap 4 (ambiguity is resolved by evidence)):
    //      (a) the FOLLOWING word is a month or Joerhonnert                                   — 50 of 63
    //      (b) the PRECEDING word is a determiner/possessive/contraction and a word follows    — 6
    //      (c) the ordinal heads a coordinated LIST: `11., 12. an 13.`, `10. bis 11.`, `19. oder … 20.` — 6
    //    A sentence-final `N.` satisfies none of them AND the pattern requires whitespace after the dot,
    //    so all four of the corpus's sentence-final years are structurally unreachable. Coverage 62/63;
    //    the one left is `ass 15. beim …`, see the LICENSER comment.
    //    ENDING: `-en` + the Eifeler Regel against the following word, or `-er` after feminine `der`.
    //    Before punctuation (a list comma) the ⟨n⟩ is kept, because there is a pause and no sandhi.
    //    MUST FOLLOW step 1 (`Säin 1 000. Timber` is only an ordinal once the group separator is gone)
    //    and MUST PRECEDE every rule that reads a period.
    s = s.replace(ORD, (whole, prev: string | undefined, psp: string | undefined, digits: string,
        offset: number, full: string) => {
        const rest = full.slice(offset + whole.length);
        const next = ORD_NEXT.exec(rest)?.[1];
        const licensed =
            (next !== undefined && ORD_NOUN_RE.test(next))
            || (prev !== undefined && LICENSER.has(prev.toLowerCase()) && next !== undefined)
            || ORDINAL_LIST.test(rest);
        if (!licensed) return whole;
        const stem = ordinalStem(Number(digits));
        if (stem === undefined) return whole;
        const head = `${prev ?? ""}${psp ?? ""}`;
        if (prev !== undefined && FEM_DATIVE.has(prev.toLowerCase())) return `${head}${stem}er`;
        // The sandhi looks at what actually follows the dot: a comma is a pause, so the ⟨n⟩ survives.
        const sandhiCue = /^[,;)]/u.test(rest) ? "n" : (next ?? "");
        return `${head}${applyEifelerRegel(`${stem}en`, sandhiCue)}`;
    });

    // 6) SPORTS TIMES `M.SS,hh` ×3 (`4.41,30`, `2.11,60`, `1.09,02`), before the clock and before the
    //    decimal rules so neither can restart inside one — the exact failure the Russian and Indonesian
    //    runs hit. The field-separating period is dropped (it is neither a decimal point nor a pause) and
    //    the comma is read as the decimal it is; no unwritten "Minutten" is invented.
    s = s.replace(SPORTS_TIME, (_m, mm: string, ss: string, hh: string) =>
        `${mm} ${ss} Komma ${perDigit(hh)}`);

    // 7) CLOCK ×26, all written with a PERIOD. Licensed by a following `Auer`/zone label or a preceding
    //    time preposition; `802.11n` cannot match (the lookbehind blocks a digit before the hour) and a
    //    sports time cannot (the lookahead rejects a following `,`). TRAP 10: a consumed `Auer` is put
    //    back, and a consumed ZONE label is put back after an inserted `Auer` (`15.00 UTC` → *fofzéng
    //    Auer UTC*). TRAP 14: `Auer` is FEMININE, so hour 1 is *eng Auer*, never *eent Auer* — a digit
    //    could never agree, so the hour is words-ified in exactly that case (`um 1.15 Auer`, corpus ×1).
    s = s.replace(CLOCK, (whole, prev: string | undefined, psp: string | undefined, h: string,
        min: string, msp: string | undefined, marker: string | undefined) => {
        if (marker === undefined && !(prev !== undefined && CLOCK_PREP.test(prev))) return whole;
        const hour = Number(h) === 1 ? "eng" : h;
        const tail = marker === undefined || marker === "Auer" ? "" : `${msp ?? " "}${marker}`;
        const mins = Number(min) === 0 ? "" : ` ${Number(min)}`;
        return `${prev ?? ""}${psp ?? ""}${hour} Auer${mins}${tail}`;
    });

    // 8) DOT DECIMAL ×1 (`1.5 Fuerstonne`, an anglicism) — after the clock, which has first claim on
    //    `\d{1,2}.\d{2}`. The lookbehind keeps it off `802.11`, the lookahead off `1.1.` and off a
    //    version letter. THE FRACTION IS LIMITED TO ONE DIGIT on purpose: in this language a two-digit
    //    fraction after a period is the CLOCK shape (the decimal separator is the comma), so an
    //    unlicensed `20.30` is left alone rather than confidently read as *zwanzeg Komma dräi null*.
    //    The corpus's single dot-decimal has one digit, and no corpus instance falls in the gap.
    s = s.replace(DOT_DECIMAL, (_m, int: string, frac: string) => `${int} Komma ${perDigit(frac)}`);

    // 9) COMMA DECIMAL ×23 — the language's own decimal separator, previously read as a PHRASE BREAK
    //    (`1,5 Kilometer` → *eent , fënnef kilomətər*). Digits on both sides, so a clause comma is safe.
    //    The fraction is read digit by digit (7,74 → *Komma siwen véier*), and both operands stay DIGITS
    //    so the shared tier can still see a following unit (step 4 of the playbook, units-before-decimals;
    //    the lb unit nouns are invariant, so the integer/decimal count never changes the word either).
    s = s.replace(COMMA_DECIMAL, (_m, int: string, frac: string) => `${int} Komma ${perDigit(frac)}`);

    // 10) RANGES ×11 (`1894 – 1895`, `2 – 3 km`), an en dash between nbsp. Digits on BOTH sides, because
    //     the same dash is the PARENTHETICAL dash 44 times over in this corpus and must not be touched.
    //     TRAP 14: `bis` begins with ⟨b⟩, outside the Eifeler keeper set, so a left operand whose word
    //     ends in ⟨n⟩ loses it — the corpus writes `siwe bis aacht`. A digit cannot do that, so the LEFT
    //     operand is words-ified when and only when it needs to be. The right operand stays digits, which
    //     is what keeps the number↔unit adjacency alive for `2 – 3 km`. The operand class is anchored to
    //     end in a digit so it cannot swallow a clause comma (trap 14 (agreement cannot be applied to digits), hazard 2).
    s = s.replace(RANGE, (_m, left: string) => {
        const words = /^\d+$/u.test(left) ? numberToWords(Number(left)) : "";
        // Only an unstressed final ⟨-en⟩ is the rule's target — *siwen* → *siwe*, *Milliounen* →
        // *Millioune* (which the corpus writes). Testing a bare final ⟨n⟩ instead was wrong and the
        // branch enumeration caught it: 1 000 000 is *eng Millioun*, whose ⟨n⟩ is part of the stem, and
        // the range read *eng Milliou bis 9*.
        return /en$/u.test(words) ? `${applyEifelerRegel(words, "bis")} bis ` : `${left} bis `;
    });

    // 11) MILES PER HOUR ×3, which the tier must not own (see luxembourgish.ts): declaring `meile` as a
    //     unit rewrote six correct `(31 Meile)` into `Meilen`, because the corpus applies the Eifeler
    //     Regel to that noun itself. Claiming only the RATE leaves the spelled-out noun alone.
    s = s.replace(MPH, "$1 Meilen an der Stonn");

    // 12) DEGREES ×3, which the tier cannot express. `32 °C` ×2 and `35 °W`; the compass letter is left
    //     raw because *Grad West* is unsourced and it is one instance — but the ° itself is no longer
    //     silently dropped.
    s = s.replace(DEG_C, "$1 Grad Celsius");
    s = s.replace(DEG_F, "$1 Grad Fahrenheit");
    s = s.replace(DEG_BARE, "$1 Grad ");

    // 13) SIGNS. `+30 Grad Celsius` and `(UTC+1)` are the two attested instances. There is NO negative
    //     number anywhere in the corpus — every `-N` is a compound hyphen (`Typ-1-Diabetes`, `COVID-19`,
    //     `II-76`, `36-x-24-mm`) — so the minus rule keeps the German guard, which requires a space or an
    //     opening paren before the sign and therefore admits none of them. Ranges (step 10) are gone by
    //     now, so the en dash cannot reach here either.
    s = s.replace(MINUS, "$1minus $2");
    // ⚠ ± IS THIS LANGUAGE'S OWN TWO WORDS, juxtaposed — zero new sourcing (#654). Both halves are lifted from
    //    the plus and minus rules already in this file, so nothing is invented. The FORM is the one every
    //    language that already read ± uses (bg/da/is/nb/ro/sv all juxtapose with no conjunction; English is the
    //    outlier that needs "or", and it already has its own rule). Runs BEFORE the + rule: ± is a single
    //    character, so the + rule cannot see it, and putting it first keeps the sign audible either way.
    s = s.replace(/±/gu, " plus minus ");
    s = s.replace(PLUS_AFTER_WORD, "$1 plus $2");
    s = s.replace(PLUS_INITIAL, "$1plus $2");

    // RELATIONAL AND ARITHMETIC SIGNS, and the AMPERSAND. `&` has 2 corpus instances — `College of Arts
    // & Sciences` and `B&B`, both previously silent, the Czech `BB`-vs-`B B` tokenisation case; the other
    // 90 `&` in this corpus are `&apos;`, already decoded upstream by core/markup.ts (which was written
    // for lb_lu). `=` `<` `>` `×` `÷` have ZERO instances and are still read, because a phonemizer is
    // handed arbitrary text and a dropped sign is inaudible — the one outcome that cannot be right
    // (#584); the Czech layer takes the same position for the same signs. Every word is attested:
    // `gläich` (espeak lb_list + corpus ×1), `mol` (espeak; corpus `Mol` ×8), `méi` ×220, `ewéi` ×205,
    // `grouss` ×34, `kleng` ×28, `dividéiert duerch` — the corpus's own phrase, *dividéiert duerch
    // zwielef*. The ASCII `x` in `75,57 cm x 62,23 cm` is deliberately left alone: it is a LETTER of this
    // orthography, and claiming it would also claim `4x4` and `36-x-24-mm-Negativ`.
    s = s.replace(/[  ]*[=≈][  ]*/gu, " ass gläich ");
    s = s.replace(/[  ]*<[  ]*/gu, " méi kleng ewéi ");
    s = s.replace(/[  ]*>[  ]*/gu, " méi grouss ewéi ");
    s = s.replace(/(\d)[  ]*×[  ]*(?=\d)/gu, "$1 mol ");
    s = s.replace(/[  ]*÷[  ]*/gu, " dividéiert duerch ");
    s = s.replace(/[  ]*[&＆][  ]*/gu, " an ");

    // 14) FRACTIONS ×1 (`5 mm (1/5 Zoll)` → *ee Fënneftel*). Denominator 2 is the adjective `hallef`, not
    //     a noun; everything else composes as ordinal stem + `el` (see fractionNoun). The numerator 1 is
    //     `een`, itself subject to the Eifeler Regel — the corpus writes `een Drëttel` (⟨d⟩ keeps the n)
    //     and the rule therefore gives `ee Fënneftel` (⟨f⟩ does not).
    s = s.replace(FRACTION, (m0, a: string, b: string) => {
        const num = Number(a), den = Number(b);
        if (den === 2) return `${num === 1 ? oneBefore("hallef") : numberToWords(num)} hallef`;
        const noun = fractionNoun(den);
        if (noun === undefined) return m0;
        return `${num === 1 ? oneBefore(noun) : numberToWords(num)} ${noun}`;
    });

    return s;
}
