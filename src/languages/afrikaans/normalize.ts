/**
 * Afrikaans (af) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ AFRIKAANS USES THE ENGLISH SEPARATOR CONVENTION, which is the OPPOSITE of its sister Dutch: the PERIOD is
 * the decimal point (`12.8 km`, `$2.3 biljoen`) and the COMMA groups thousands (`17,500 myl`). Dutch is
 * dot-thousands / comma-decimal. Each language has to be measured on its own text, not inherited from the
 * neighbour it most resembles.
 *
 * ⚠ THE ORDINAL IS A NUMERAL PLUS A LETTER SUFFIX, exactly as in Dutch: `11de`, `15de`, `9e`, `60ste`,
 * `190ste`. That makes it UNAMBIGUOUS, so no bare-`N.` detector is needed. The words are the cardinal with the
 * Dutch-style ending: below 20 a small table (eerste, tweede, derde, agtste, neënde …), from 20 up `-ste`,
 * ⚠ with a sub-20 TAIL keeping its own ordinal — 190's remainder is 90, which is not sub-20, but 125's is.
 *
 * ⚠ WHY THE NUMBER RULES RUN HERE AND NOT IN THE TOKENIZER. The ordinal's spoken words must be plain text so
 * the word path stresses them; the de-grouped thousands and the dot decimal stay DIGITS so the shared symbol
 * tier can still see the number adjacent to its unit or sign. The tier is composed AFTER this pass in
 * afrikaans.ts, and the TOKEN swallows the separators.
 */
import { MANIFEST } from "./manifest.ts";
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { numberToWords } from "./numbers.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

const ORD_BELOW_20 = MANIFEST.ordinalsBelow20; // afrikaans.jsonc

/**
 * Integer → the Afrikaans ordinal word. Below 20 it is a table lookup. At or above 20 the ending is -ste,
 * EXCEPT that a sub-20 REMAINDER carries its own small-ordinal form onto the end of the compound:
 * 101e → honderd en eerste, 112e → honderd en twaalfde.
 *
 * ⚠ THE SPACING FOLLOWS THE NUMBER COMPOSITOR, not the older spelling this docblock used to claim. It said
 * *honderdeerste* / *honderdtwaalfde* as single words, but numberToWords builds "honderd en twaalf", so the
 * ordinal is "honderd en twaalfde". The stale text mattered: the fix for the drifted tails cited it as the
 * authority for what 112 should be, and it was only right about the SUFFIX.
 *
 * 190e (remainder 90, not sub-20) takes plain -ste: honderd en negentigste. ⚠ AND SO DOES 21e — the
 * docblock used to call it a sub-20 tail, but 21 % 100 is 21, which is not < 20, so it never enters that
 * branch. Its output is right for a different reason than was written here.
 */
export function ordinalWord(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 1) return undefined;
    if (n < 20) return ORD_BELOW_20[n];
    const card = numberToWords(n);
    if (card === "" || /\d/u.test(card)) return undefined;
    const r = n % 100;
    if (r >= 1 && r < 20) {
        // ⚠ THE TAIL IS THE MANIFEST'S OWN CARDINAL — it used to be two inline arrays that duplicated
        // `numbers.units` and `numbers.teens`, and the copy had DRIFTED two places: the teens array carried
        // two leading "" pads, so r=12 asked for "tien" and r=10 asked for the EMPTY string. The empty tail
        // then matched `card.endsWith("")` — true for every string — and `card.slice(0, -0)` is `""`,
        // because -0 === 0. So 110 lost its whole "honderd en " and read *tiende*, while 112…119 missed
        // the match and fell through to the regular -ste, giving *honderd en twaalfste* where this
        // function's own docblock says honderdtwaalfde.
        // ⚠ NO `!` HERE — that is the assertion #763 was landed to remove, and it would fail the same way:
        // a shortened manifest array gives `undefined`, `card.endsWith(undefined)` coerces to the string
        // "undefined", and the compound silently falls through to plain -ste. One truthiness test covers
        // both the missing entry AND the empty-string trap that caused this bug.
        const tail = r < 10 ? MANIFEST.numbers.units[r] : MANIFEST.numbers.teens[r - 10];
        if (tail && card.endsWith(tail))
            return `${card.slice(0, -tail.length)}${ORD_BELOW_20[r]}`;
    }
    return `${card}ste`;
}

/** Multi-dot abbreviations and era markers (afrikaans.jsonc `multiDotAbbreviations`). Handled BEFORE the
 *  single-dot rule so no interior dot survives as a phrase break. The manifest records why every pattern is
 *  DOT-BOUND — the unpunctuated spaced form once made `n. C.` swallow the indefinite article before any
 *  c-word, destroying Afrikaans's commonest word for a rule with no corpus instances of its own. */
const MULTI_DOT = MANIFEST.multiDotAbbreviations;

const DOTTED_ABBREV = MANIFEST.dottedAbbreviations; // afrikaans.jsonc
// The keys contain DOTS (m.p.u), so each must be regex-escaped before joining the alternation.
const ABBREV_ALT = Object.keys(DOTTED_ABBREV)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
    .join("|");
// Only the DOTTED keys may appear WITHOUT their trailing dot (`m.p.u` before a space/paren/end). A plain
// word like `dr` is NEVER matched bare — it is the start of "Dromaeosauridae" and would misfire.
const BARE_ALT = Object.keys(DOTTED_ABBREV)
    .filter((k) => k.includes("."))
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
    .join("|");

const SIGN = MANIFEST.signWords; // afrikaans.jsonc — one word per math/sign symbol
const FRAC = MANIFEST.fractionWords; // …and the two suppletive halves
const LETTER_NAME = MANIFEST.letterNames; // afrikaans.jsonc — the g2p spells these through itself

/** Afrikaans phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
export const isUnreadableAfrikaans = makeUnreadableTest({
    vowels: /[aeiouy]/u,
    legalOnsets: new Set(MANIFEST.phonotactics.legalOnsets),
    legalCodas: new Set(MANIFEST.phonotactics.legalCodas),
});

const WORD_ACRONYMS: ReadonlySet<string> = new Set(MANIFEST.wordAcronyms); // afrikaans.jsonc

const normalizeInitialisms = makeInitialismNormalizer({
    letterName: (l) => LETTER_NAME[l.toLowerCase()],
    acronymLetters: new Set(MANIFEST.acronymLetters),
    isRecorded: (w) => WORD_ACRONYMS.has(w),
    isUnreadable: isUnreadableAfrikaans,
});

/** The initialism pass, exported so the engine can re-apply it to the symbol tier's output (whose currency
 *  nouns carry caps: "VS-dollar" from U$/VS$ must read *vee-es-dollar*). */
export function normalizeAfrikaansInitialisms(text: string): string {
    return normalizeInitialisms(text);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Normalize one Afrikaans input string. Pure text→text. Steps are ORDER-DEPENDENT; each states its coupling. */
export function normalizeAfrikaans(input: string): string {
    let s = input;

    // 0) DECODE THE HTML AMPERSAND FIRST. `&amp;` appears verbatim in the corpus (B&amp;B, Qatar Airways
    //    &amp;) — an HTML-escaped `&` that is otherwise just a letter run "amp" and dropped with its neighbours.
    s = s.replace(/&amp;/giu, " & ");

    // 0b) THE INDEFINITE ARTICLE, in every spelling the corpus uses. `'n` is [ə], and `phonemizeWord`
    //    recognises exactly two spellings of it: U+0027 `'n` and U+2019 `’n`. The corpus writes it
    //    **588× as `‘n` (U+2018, the LEFT quote), 137× as `'n`, 4× as `’n` and 3× as `ń`** (U+0144,
    //    n-acute) — so the commonest word in the language read as a bare consonant `n` in 591 of 732
    //    instances, and `ń` read as *en* [ɛn]. Fold them all onto the canonical `'n` here; the article is
    //    the one thing this layer must not get wrong. A word boundary after the `n` is required, so an
    //    opening quote on an n-word (`‘nuwe’`) is untouched.
    s = s.replace(/(?<![\p{L}\p{M}])[‘’ʼ`´]n(?![\p{L}\p{M}])/gu, "'n");
    s = s.replace(/(?<![\p{L}\p{M}])ń(?![\p{L}\p{M}])/gu, "'n");

    // 1) ERA MARKERS and MULTI-DOT ABBREVIATIONS. FIRST, before the single-dot rule — otherwise the
    //    single-dot rule consumes `v.`/`d.` and leaves `C.`/`i.` behind as an interior phrase break.
    //    Also before the dotted-capital rule, so `V.C.` is not offered to it.
    for (const [body, word] of MULTI_DOT) {
        s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.(?=\\s*$)`, "giu"), `${word}.`);
        s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])${body}`, "giu"), word);
    }

    // 2) DOTTED CAPITAL RUNS → a bare all-caps run, so the initialism pass reads them as LETTERS. `V.S.`
    //    was *f . s .* — two unpronounceable stops and two spurious phrase breaks. Also `Wêreld Oorlog II`
    //    (the regnal rule below needs the digit, and the roman pass has already converted II → 2).
    s = s.replace(/(?<![\p{L}\p{M}])\p{Lu}\.(?:[ \u00a0]?\p{Lu}\.)+/gu, (m0) => m0.replace(/[.\s]/gu, ""));  // space, NBSP

    // 3) SINGLE-DOT ABBREVIATIONS. Three branches. The dotted forms come FIRST: mid-sentence the dot is
    //    CONSUMED so it cannot become a phrase break, and at a phrase end it is kept (there it really is the
    //    sentence end). The `m.p.u` form may also appear WITHOUT a trailing dot (before a space, paren or
    //    end) — the bare key covers it last, so a dotted instance is never stripped of its sentence pause.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(\\s+)(?=[\\p{L}\\d])`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}${sp}`);
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}.`);
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${BARE_ALT})(?=\\s*(?:[\\p{L}\\d(]|[,.;:!?»)]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}`);
    // The undotted `vm`/`nm` clock suffix (10:00vm, 9:30 vm) — left for the clock rule below.

    // 4) ORDINALS — the Afrikaans form is a numeral plus a LETTER suffix (`11de`, `15de`, `9e`, `60ste`),
    //    exactly as in Dutch, so no bare-`N.` detector is needed. Was *elf de* / *vyftien de* / *nege e*.
    //    BEFORE the clock rule so a digit run is not first claimed as a time. CASE-INSENSITIVE: the suffix
    //    is orthography, not a lowercase convention, and a capitalized head (`11De`, a heading or a
    //    title-cased date) would otherwise read as the cardinal with the suffix stranded as a word.
    s = s.replace(/(?<![\d,.])(\d{1,4})(?:ste[n]?|de[n]?|e)(?![\p{L}\p{M}])/giu, (m0, d: string) =>
        ordinalWord(Number(d)) ?? m0);

    // 5) CLOCK, in both written forms, BEFORE the number tokenizer sees the separator. The undotted
    //    `vm`/`nm` AM/PM markers are expanded to voormiddag/namiddag and appended (10:00vm, 9:30 vm, 5vm);
    //    the dotted n.m. was already expanded by step 3. A 4-digit military time (`0230 UTC`) is a clock too.
    // The AM/PM marker goes AFTER the minutes — "nege dertig voormiddag", the order the corpus's own
    // dotted instance (`8:30 n.m.`) already reads. Appending it to the HOUR put it inside the time:
    // `9:30 vm` read *nege voormiddag dertig*, which only stayed invisible because the tested instance
    // (`10:00vm`) drops its zero minutes.
    const clock = (h: string, min: string, period?: string): string =>
        `${numberToWords(Number(h))}${Number(min) === 0 ? "" : ` ${numberToWords(Number(min))}`}${period ?? ""}`;
    const period = (p?: string): string =>
        // ⚠ AN UNKNOWN ABBREVIATION KEEPS ITS TEXT rather than vanishing. The regex only admits vm|nm
        // today so the fallback is unreachable, but a silent "" is exactly how the sign words would have
        // leaked as `undefined` — the same class of miss, and the same policy: leave it alone.
        p === undefined ? "" : ` ${MANIFEST.clockPeriods[p.trim().toLowerCase()] ?? p.trim()}`;
    // The trailing guard rejects a further `:` or `.` FOLLOWED BY A DIGIT — a SPORTS TIME, of which the
    // corpus has three (`4:41.30`, `2:11:60`, `1:09:02`). Guarding on `:` alone let `4:41.30` through: the
    // clock claimed `4:41` and stranded `.30` as a phrase break plus a bare number. A plain `.` may NOT be
    // rejected outright — a clock at a sentence end (`begin om 11:20.`) is followed by one.
    s = s.replace(/(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![:.]?\d)(\s*(?:vm|nm))?/giu,
        (_m, h: string, min: string, p?: string) => clock(h, min, period(p)));
    // THE DOT FORM IS CONTEXT-BOUND, and must be. In this corpus the dot is the DECIMAL POINT, so
    // `H.MM` and `N.NN` are the same string: the corpus's one dot-clock is `15.00 GUT` and its decimals
    // include `6.34 duim`, `3.50-meter`, `1.50`, `2.30`. An unguarded hour/minute range check read every
    // one of them as a time — `6.34 duim` became *ses vier en dertig duim*. So the dot form is claimed
    // ONLY with a timezone or an AM/PM marker after it, which is the only evidence the corpus offers.
    s = s.replace(/(?<![\d.,:])([01]?\d|2[0-3])\.([0-5]\d)(?![\d.,:-])(?=\s*(?:GUT|UTC|SAST|GMT|vm|nm))(\s*(?:vm|nm))?/giu,
        (_m, h: string, min: string, p?: string) => clock(h, min, period(p)));
    s = s.replace(/(?<![\d:])([01]?\d|2[0-3])([0-5]\d)(?=\s*(?:UTC|GUT))/gu,
        (_m, h: string, min: string) => clock(h, min, ""));
    // An HOUR + AM/PM without a separator (`5vm`, `10:00vm`'s tail) is a clock too. `vm` ONLY: the corpus's
    // separator-less instances are both `vm`, and admitting `nm` here reads the nanometre `10nm` as *tien
    // namiddag*. A spaced or dotted `n.m.`/`nm` still reaches the forms above.
    s = s.replace(/(?<![\d:])([01]?\d|2[0-3])(vm)(?![\p{L}\p{M}])/giu,
        (_m, h: string) => `${numberToWords(Number(h))} ${MANIFEST.clockPeriods["vm"]}`);

    // 6) COMMA-GROUPED THOUSANDS. The comma is the ENGLISH grouping separator here (17,500, 100,000) — NOT
    //    a decimal. It is consumed before the symbol tier so the tier sees a plain digit run, and before the
    //    ordinal rule's lookbehind could misfire. Two passes, because the groups overlap on the shared digit.
    for (let i = 0; i < 2; i++)
        s = s.replace(/(\d),(\d{3})(?!\d)/gu, "$1$2");

    // 6b) A COMMA DECIMAL, folded onto the dot form. STANDARD Afrikaans marks the decimal with a COMMA
    //     (South Africa's official convention, as in Dutch); this corpus is the exception, not the rule,
    //     because FLEURS af_za was translated from the English set and inherited its separators. So both
    //     conventions have to read: three digits after the comma is the grouping consumed just above
    //     (17,500 · 2,243 — corpus-attested), and ONE OR TWO digits is a decimal (12,5 · R2,50) — which
    //     had no corpus instance and read as a CLAUSE PAUSE inside the number: *twaalf , vyf*. Folding to
    //     `12.5` here means the TOKEN, the "komma" reading and the symbol tier's adjacency all apply
    //     unchanged. A clause comma is written with a following SPACE ("In 1990, 5 mense") and is untouched.
    s = s.replace(/(?<![\d.,])(\d+),(\d{1,2})(?![\d,.])/gu, "$1.$2");

    // 7) VERSION DOTS, NOT the decimal. The dot IS the decimal point in this corpus (12.8, 2.3) and the
    //    TOKEN swallows `\d+\.\d+` to emit "komma" between the parts — the shared symbol tier needs the raw
    //    number for currency/units. A version is the corpus's `802.11n` (Wi-Fi) and `Figuur 1.1`, and
    //    NOTHING ELSE: the rule is bounded to those two shapes — three or more integer digits plus a
    //    single trailing letter, or the explicit figure reference. Claiming any `\d+\.\d+[a-z]` read a
    //    decimal glued to its unit as a version, so `12.5km` came out *twaalf punt vyf kilometer*.
    s = s.replace(/(?<![\d.,])(\d{3,})\.(\d+)(?=[a-z](?![a-z]))/giu, "$1 punt $2");
    s = s.replace(/Figuur (\d+)\.(\d+)/giu, "Figuur $1 punt $2");

    // 8) RATES and UNITS the shared tier cannot compose. `m.p.u` (myl per uur = mph) was already expanded by
    //    step 3; `600Mbit/s` (megabits per sekonde) is a compound unit the tier's one-letter keys cannot
    //    express. The `km/h`/`km/u`/`m/s` forms go to the shared tier.
    s = s.replace(/(\d+)\s*Mbit\/s(?![\p{L}\p{M}])/giu, "$1 megabit per sekonde");

    // 9) REGNAL ORDINALS. `Wêreld Oorlog II` → the shared Roman pass already emitted `Wêreld Oorlog 2`; the
    //    digit reads as an ORDINAL (*tweede Wêreldoorlog*), matching how Afrikaans actually names the wars.
    //    Targeted at this phrase: a generic "capitalized phrase + digit" rule would misfire on the corpus's
    //    dates ("Op September 17, 1939" reads cardinal).
    //    BOTH SPELLINGS AND BOTH WARS. The corpus writes the noun as two words 3× and as one word 2×
    //    (`Wêreldoorlog II`), and the shared roman pass only converts the two-letter `II` — so a matcher
    //    for "two words + digit" covered 2 of the 5 instances and left `Wêreldoorlog II` a cardinal and
    //    both `… Oorlog I` reading as the stray letter *i*. Take the Roman numeral here as well.
    s = s.replace(/W[êe]reld ?[Oo]orlog (\d+|I{1,3}V?|IV)(?![\p{L}\p{M}])/gu, (m0: string, d: string) => {
        const roman: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 };
        const n = /^\d+$/u.test(d) ? Number(d) : roman[d];
        const ord = n === undefined ? undefined : ordinalWord(n);
        return ord === undefined ? m0 : `${ord} Wêreldoorlog`;
    });

    // 10) DEGREES. `+30°C` came out as the bare consonant *s*; `90 ° F-hitte` dropped the sign and left a
    //     lone F. The scale letters are expanded only DIRECTLY after a degree sign, where they cannot be
    //     anything else. AFTER the rates so no `°` rule sees a speed, and after the clock.
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/gui, "$1 grade Celsius");
    s = s.replace(/(\d)\s?°\s?F(?![\p{L}\p{M}])/gui, "$1 grade Fahrenheit");
    s = s.replace(/(\d)\s?°(?![\p{L}\p{M}])/gu, "$1 grade");

    // 11) SIGNS. `+30°C`, `UTC+1` — the plus was dropped outright. `&` → *en* (Afrikaans "en" = and); the
    //     tight `X&Y` form (`B&B`) is spelled with LETTER NAMES, because the shared initialism pass cannot
    //     see a single capital either side of the `&`. A TRUE minus (`-5`) reads "minus" — but every `-\d`
    //     in this corpus is a RANGE or SCORE (`2-3 km`, `7-2`, `1469-1539`, `35-40mph`), so the rule only
    //     fires when the minus is NOT between two digits (a leading negative) — exactly the DROP-test shape.
    //     `=`, `<`, `>`, `×`, `÷` do not occur in af_za but are read for completeness.
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
    //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
    //    reading is this language's own two words juxtaposed, and ⚠ both are SIGN names rather than
    //    OPERATION names, which is what ± needs: it marks a TOLERANCE, not an addition.
    s = s.replace(/±/gu, ` ${SIGN.plusMinus} `);
    s = s.replace(/\+\s?(?=\d)/gu, ` ${SIGN.plus} `);
    // ⚠ U+2212 IS IN THE CLASS AND THE ASCII HYPHEN'S GUARDS ARE UNCHANGED. The MINUS SIGN is a distinct
    // code point whose only Unicode meaning is the arithmetic operator, and it is not on any keyboard —
    // whoever typed it meant a minus. It is not attested in this language's mined corpus, which is why an
    // earlier sweep declined it as invention; the character's identity is the evidence, not the corpus, and
    // dropping a sign INVERTS the value it belongs to. The hyphen is the ambiguous one and keeps every
    // guard it had: leading position only, so a range (`1838−1917`) and a negative exponent (`10−19`) are
    // still refused by the lookbehind.
    s = s.replace(/(?<![\p{L}\p{Nd}])[-−](\d+)(?!\s*[-\d])/gu, `${SIGN.minus} $1`);
    s = s.replace(/(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(?![\p{L}\p{M}])/gu, (_m, a: string, b: string) =>
        `${LETTER_NAME[a.toLowerCase()] ?? a} ${SIGN.ampersand} ${LETTER_NAME[b.toLowerCase()] ?? b}`);
    s = s.replace(/\s&\s/gu, ` ${SIGN.ampersand} `);
    s = s.replace(/(\S)\s*=\s*(\S)/gu, `$1 ${SIGN.equals} $2`);
    s = s.replace(/(\d)\s*<\s*(\d)/gu, `$1 ${SIGN.lessThan} $2`);
    s = s.replace(/(\d)\s*>\s*(\d)/gu, `$1 ${SIGN.greaterThan} $2`);
    s = s.replace(/(\d)\s*×\s*(\d)/gu, `$1 ${SIGN.times} $2`);
    s = s.replace(/(\d)\s*÷\s*(\d)/gu, `$1 ${SIGN.dividedBy} $2`);

    // 12) FRACTIONS (×1: `1/5 duim`). Afrikaans builds these on the ordinal, as Dutch does: 1/5 → *een vyfde*,
    //     3/4 → *drie vierde*, and 1/2 is the suppletive *een half*. The trailing guard keeps a date or a
    //     ratio chain (`1/5/2020`) out. LAST, so no earlier rule has to work around a slash.
    s = s.replace(/(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) => {
        const num = Number(a), den = Number(b);
        if (den === 2) return num === 1 ? FRAC.oneHalf : `${numberToWords(num)} ${FRAC.halves}`;
        const ord = ordinalWord(den);
        return ord === undefined ? m0 : `${numberToWords(num)} ${ord}`;
    });

    // 13) INITIALISMS, LAST of the letter rules: it must run after the era markers (else v.C. → *vee …*)
    //     and after the dotted-capital rule (else V.S. never becomes the caps run it spells out).
    s = normalizeInitialisms(s);

    return s;
}
