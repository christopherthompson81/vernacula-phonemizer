import { tr } from "../../core/provenance.ts";
/**
 * Sindhi (sd) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the Sindhi g2p
 * cannot already read into Sindhi words the existing pipeline speaks. Pure text→text, no IPA. Runs inside
 * sindhi.ts's `text()`, before the tokenizer.
 *
 * MEASURED OVER THE FLEURS sd_in CORPUS, column 3 (the ORIGINAL cased text):
 *   unit words already spelled out  87      decimal point N.N   56      ranges N–N   48
 *   colon clock HH:MM               43      comma-grouped N,NNN 35      percent N %  11
 *   degrees N °                      5
 *
 * ⚠ THIS LAYER DEPENDS ON THE NUMBER COMPOSER. Without one, `sindhi.ts` hands every
 * digit run to the foreign phonemizer, so `5` was spoken as English "five". Every rule below produces
 * digits for that composer to read, so none of them would have helped. The composer landed first,
 * deliberately.
 *
 * ⚠ SINDHI USES THE ENGLISH NUMERIC CONVENTIONS, exactly like Central Kurdish and unlike the four
 * European languages in this sequence. The split is total and leaves no ambiguity to resolve:
 *
 *     comma followed by exactly three digits   35   ← grouping, never a decimal (0 instances)
 *     period followed by one or two digits     56   ← decimal, never a grouping (0 instances)
 *
 * ⚠ EVERY WORD BELOW IS ATTESTED IN THIS CORPUS, and several are not the form a translator would reach
 * for: percent is سيڪڙو (41), the decimal separator is the borrowed پوائنٽ ("point", 39), and a range is
 * the circumfix کان … تائين ("from … until", 1446 / 384).
 *
 * ORDERING:
 *   · DE-GROUPING BEFORE THE DECIMAL RULE, or `400,000` is read as a fraction.
 *   · DEGREES BEFORE the unit rules — the scale letter would otherwise reach the Latin fallback and be
 *     read as an English letter name.
 */

/** Relational and operator signs, read in every position — a dropped sign is inaudible. All attested:
 *  برابر 17, جمع 17, ڀيرا 27. */
const RELATIONAL: [RegExp, string][] = [
    [/[=≈]/gu, " برابر "],
    [/</gu, " کان گهٽ "],
    [/>/gu, " کان وڌيڪ "],
    // ⚠ ASCII `x` TOO, not only `×`: `NxN` forms outnumber `×` roughly 85 to 20 across the corpora, and the
    // bare `x` was reaching the phoneme stream as its own LETTER NAME. Digit-bounded, so it cannot claim a letter.
    [/×|(?<=\p{Nd})[ \t]?x[ \t]?(?=\p{Nd})/gu, " ڀيرا "],
    [/÷/gu, " ورهايل "],
];

/** Currency sign → the Sindhi word. ڊالر 28, يورو 13 in the corpus. */
const CURRENCY: Readonly<Record<string, string>> = {
    "$": "ڊالر", "€": "يورو", "£": "پائونڊ", "¥": "ين", "₹": "رپيا",
};

/** Latin unit abbreviations → the Sindhi word. The corpus overwhelmingly spells the unit out already
 *  (87 instances), so these catch the residue rather than the common case. */
const UNITS: [RegExp, string][] = [
    [/km/giu, "ڪلوميٽر"],
    [/kg/giu, "ڪلوگرام"],
    [/cm/giu, "سينٽيميٽر"],
    [/mm/giu, "ملي ميٽر"],
    // ⚠ NO BARE `m`, though ميٽر ×32 is spelled out and digit-adjacent bare `m` is ×0 here. Added and
    // withdrawn on measurement: `802.11m` read as "…hiku hiku MĪṬARU". The tier's `NOT_VERSION` guard covers
    // that class, but it works by seeing the DOT and this file has already rewritten it to a word — ⚠ a local rule that depends on a character this file has already rewritten will not fire.
    // Nothing is lost: the squared and cubed rules below are LOCAL and do not consult this table.
];

export function normalizeSindhi(input: string): string {
    // The registry folds native digits to ASCII before any engine sees the text, so every rule below can
    // count on `\d`. Sindhi's corpus mixes both systems heavily, which is why that fold is fleet-wide.
    let t = input;

    // 1) COMMA-GROUPED THOUSANDS (35), before the decimal rule. The comma is clause punctuation, so
    //    `400,000` read as "four hundred" + a PAUSE + "zero zero zero". Exactly three digits — the
    //    English convention, and the corpus has no comma-decimal at all.
    let prev: string;
    do {
        prev = t;
        t = tr(t, /(?<=\d)(?<!(?<![\d\.,])0)[,،](?=\d{3}(?!\d))/gu, "");
    } while (t !== prev);

    // 2) THE PERIOD CLOCK, but ONLY when a timezone marks it. `HH.MM` occurs 18 times and is mostly
    //    genuine decimals with units (`6.34 انچ`, `3.50 ميٽر`) plus the `802.11n` standard; exactly TWO
    //    are clocks, and both are followed by GMT/UTC. So the timezone is the evidence, not the shape —
    //    claiming `HH.MM` outright would turn six measurements into times. Must run BEFORE the decimal
    //    rule, which would otherwise read `12.00 GMT` as "twelve point zero zero".
    t = tr(t, /(\d{1,2})\.(\d{2})(?=\s*(?:GMT|UTC|وڳي|بجي))/gu, "$1 ڪلاڪ $2 منٽ");

    // 3) DECIMAL POINT (56). The period is clause punctuation too, so `2.4` read as "two" + a SENTENCE
    //    BREAK + "four". `پوائنٽ` is a borrowing of "point" and is what the corpus writes (39).
    t = tr(t, /(\d+)\.(\d+)/gu, (_m, whole: string, frac: string) =>
        `${whole} پوائنٽ ${[...frac].join(" ")}`);

    // 4) CLOCK, COLON FORM (43). The colon was reaching clausePunctuation as a pause, so `11:00` split
    //    into two unrelated numerals.
    t = tr(t, /(\d{1,2}):(\d{2})(?!\d)/gu, "$1 ڪلاڪ $2 منٽ");

    // 5) PERCENT (11) → سيڪڙو, attested 41 times. Both placements of the sign are claimed: the
    //    Arabic-script convention puts it before the number, as Central Kurdish does.
    t = tr(t, /(\d+)\s*%/gu, "$1 سيڪڙو");
    t = tr(t, /%\s*(\d+)/gu, "$1 سيڪڙو");

    // 6) DEGREES (5), BEFORE the unit rules — the scale letter would otherwise reach the Latin fallback
    //    and be read as an English letter name.
    t = tr(t, /℃/gu, "°C").replace(/℉/gu, "°F");
    t = tr(t, /(\d)\s*°\s*C(?!\p{L})/giu, "$1 ڊگري سينٽي گريڊ");
    t = tr(t, /(\d)\s*°\s*F(?!\p{L})/giu, "$1 ڊگري فارينهائيٽ");
    t = tr(t, /(\d)\s*°/gu, "$1 ڊگري");

    // 7) SQUARED UNITS, before the plain unit rule or the `km` is consumed and the exponent stranded.
    t = tr(t, /(?<!\p{L})km\s*[²2](?!\d)/giu, "مربع ڪلوميٽر");
    t = tr(t, /(?<!\p{L})m\s*[²2](?!\d)/giu, "مربع ميٽر");
    //    …and CUBED, the same shape and the same word order. `ڪيوبڪ ميٽر` is the corpus's own: "لونو ۾
    //    120–160 ڪيوبڪ ميٽر تيل هو" — the loan, preceding the noun exactly as مربع does.
    t = tr(t, /(?<!\p{L})km\s*[³3](?!\d)/giu, "ڪيوبڪ ڪلوميٽر");
    t = tr(t, /(?<!\p{L})m\s*[³3](?!\d)/giu, "ڪيوبڪ ميٽر");

    // 8) LATIN UNIT ABBREVIATIONS after a number. The trailing guard is `(?!\p{L})`, never `\b`: `\b` is
    //    defined on ASCII word characters and finds no boundary against Perso-Arabic script, so the rule
    //    would silently never fire — the trap that bit Romanian and Bulgarian earlier in this sweep.
    // RATES, BEFORE the plain unit loop, which would otherwise consume the numerator and leave the
    // denominator to read as an English letter name (`120 km/h` → …ڪلوميٽر [ˈeᶦt͡ʃ], `133 m/s` → [ˈɛm ˈɛs]).
    // Every word is the corpus's own, spelled out in its rate sentence: "480 ڪلو ميٽر في ڪلاڪ (133 ميٽر في
    // سيڪنڊ؛ 300 ميل في ڪلاڪ)" — `في` is "per", `ڪلاڪ` the hour, `سيڪنڊ` the second.
    t = tr(t, /(?<!\p{L})km\s*\/\s*h(?![\p{L}\p{M}])/giu, "ڪلوميٽر في ڪلاڪ");
    t = tr(t, /(?<!\p{L})m\s*\/\s*s(?![\p{L}\p{M}])/giu, "ميٽر في سيڪنڊ");
    // ⚠ `re.flags`, NOT A HARD-CODED "gu" — the table declares `/km/giu` and the composed regex was
    // throwing the `i` away, so an UPPERCASE abbreviation fell through to the initialism reading:
    // `12 KM پري` read *ɓˈaːɾəhənə kʰˈeᶦ ˈɛm pˈəɾeː* ("twelve kay em door") while `15 km پري` read the
    // unit. Every other rule in this file is `giu`, and the rate rules above kept their own flags, which
    // is why `480 KM/H` was never affected. Reading the flags off the declaration is what makes the
    // declaration mean something.
    for (const [re, word] of UNITS)
        t = tr(t, new RegExp(`(\\d)\\s*(?:${re.source})(?!\\p{L})`, re.flags), `$1 ${word}`);

    // 9) RANGES (48). Sindhi uses a CIRCUMFIX — کان … تائين, "from … until" — not a single connective
    //    word like the European languages' `til` / `până la` / `до`. Both halves are attested (1446 and
    //    384), and the full `N کان N تائين` shape occurs in the corpus.
    t = tr(t, /(?<![-–—])(\d+)\s*[-–—]\s*(\d+)(?!\d)(?!\s*[-–—]\s*\d)/gu, "$1 کان $2 تائين");

    // 10) CURRENCY, both placements.
    for (const [sign, word] of Object.entries(CURRENCY)) {
        const esc = sign.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
        t = tr(t, new RegExp(`${esc}\\s*(\\d+)`, "gu"), `$1 ${word}`);
        t = tr(t, new RegExp(`(\\d+)\\s*${esc}`, "gu"), `$1 ${word}`);
    }

    // 11) SIGNED NUMBERS — a sign PREFIXED to a number. The boundary admits a LETTER before the sign, as
    //     in Kurdish, because a timezone offset is written directly against its abbreviation (`UTC+1`).
    t = tr(t, /(?<!\d)([-−+])(\d+)/gu, (_m, sign: string, n: string) =>
        ` ${sign === "+" ? "جمع" : "منفي"} ${n}`);

    // 12) ARITHMETIC AND RELATIONAL SIGNS — infix between digits is where arithmetic lives; the
    //     relational signs are read in every position, because a dropped sign is inaudible.
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
    //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
    //    reading is this language's own two words juxtaposed, both taken from the plus and minus rules
    //    already in this file.
    t = tr(t, /±/gu, " جمع منفي ");
    t = tr(t, /(\d)\s*\+\s*(\d)/gu, "$1 جمع $2");
    for (const [re, word] of RELATIONAL) t = tr(t, re, word);

    // 13) AMPERSAND → ۽, the Sindhi "and" and the corpus's second-commonest word (2731).
    t = tr(t, /\s*[&＆]\s*/gu, " ۽ ");

    // The insertions above pad with spaces so a sign never fuses with its neighbours; collapse the runs.
    return t.replace(/[ \t]{2,}/gu, " ");
}
