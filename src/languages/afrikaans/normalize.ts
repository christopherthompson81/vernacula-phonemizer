/**
 * Afrikaans (af) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * MEASURED over the 1,236 unique cased af_za FLEURS utterances (column 3):
 *   ordinals `Ne/Nde/Nste` ×31   (11de Hussars, 15de eeu, 9e Augustus, 190ste, 60ste van die seisoen)
 *   comma-grouped thousands ×21  (1,000 · 17,500 · 9,000 · 100,000 · 2,220 · 104,500)
 *   DOT decimals ×17             (12.8 km, 2.3 miljoen, 6.34 duim, $2.3 biljoen, 3.50-meter)
 *   space-grouped thousands ×…   (3 000 myl, 55 000 vate, 3 850 km²)
 *   clocks ×12                   (11:20, 10:00vm, 8:30 n.m., 15.00 GUT, 0230 UTC, + racing times)
 *   rates ×6                     (480 km/h, 133 m/s, 300 mph, 40 m.p.u, 600Mbit/s)
 *   currency ×6 ($ £ ¥, incl. U$/VS$ prefix forms) · percent ×4 · degrees ×2 · &amp; ×2
 *   era markers ×7 (v.C./vC/V.C. = voor Christus, d.i. = dit is) · dotted ×13 (V.S., n.m., m.p.u, Dr.)
 *   initialisms ×94 · letter names ×26 (A(H5N1), U-bote)
 *
 * THE SEPARATORS — AFRIKAANS IN THIS CORPUS USES THE ENGLISH CONVENTION. FLEURS af_za is a translation of
 * the English FLEURS set, so it inherits English numerals: the PERIOD is the decimal point (12.8 km, $2.3
 * biljoen) and the COMMA groups thousands (17,500 myl, 100,000 mense). This is the OPPOSITE of Afrikaans's
 * sister Dutch (dot-thousands / comma-decimal) — each language measured on its own corpus. The mined
 * hard-set is explicit: "Sewe punte agter, is Johnson tweede met 2,243" is a score, and "wat teen 1.5
 * kilometer per sekonde" is a decimal.
 *
 * THE ORDINAL. Afrikaans writes the ordinal as a numeral plus a LETTER suffix, exactly as Dutch does:
 * `11de`, `15de`, `9e`, `60ste`, `190ste`. Unambiguous — no bare-`N.` detector needed (see the Dutch
 * file's rationale). The words are the cardinal with the Dutch-style ending: below 20 a small table
 * (eerste, tweede, derde, agtste, neënde, elfde, vyftiende …), from 20 up `-ste` (twintigste,
 * honderd en negentigste) with a sub-20 tail keeping its own ordinal (190's remainder 90 is not sub-20).
 *
 * WHAT WAS BROKEN, verbatim from the pre-change engine:
 *   `11de Hussars`  → `ɛlf də ɦœsars`        ordinal read as the cardinal plus the bare suffix as a word
 *   `17,500 myl`    → `siəvəntin , fəif ɦɔndərt məil`   comma grouping → a COMMA PAUSE
 *   `12.8 km`       → `tvɑːlf . aχt km`      the decimal point → a PHRASE BREAK
 *   `3 000 myl`     → `dri nœl məil`          space grouping → "drie nul"
 *   `10:00vm`       → `tin , nœl fm`          the colon → a pause, and `vm` read as a word
 *   `8:30 n.m.`     → `aχt , dɛrtəχ n . m .`  the PM marker letter-spelled
 *   `40 m.p.u`      → `fiərtəχ m . p . yː`    mph written the Afrikaans way — dotted, letter-spelled
 *   `93%`           → `dri ɛn niəχəntəχ`      percent dropped
 *   `$2.3 biljoen`  → `tviə . dri bəljun`     currency sign dropped, decimal broken
 *   `1000 V.C.`     → `dœysənt f . s .`       era marker letter-spelled
 *   `B&amp;B`       → `p p`                   the HTML entity is not even `&`
 *   `Wêreld Oorlog II` → `… uərlɔχ tviə`      regnal Roman read as a cardinal digit
 *
 * WHY THE NUMBER RULES RUN HERE AND NOT IN THE TOKENIZER. The ordinal's spoken words must be plain text so
 * the word path stresses them; the de-grouped thousands, the comma-grouping and the dot decimal stay DIGITS
 * so the shared symbol tier can still see the number adjacent to its unit/sign — the tier is composed AFTER
 * this pass in afrikaans.ts, and the TOKEN swallows the separators (see afrikaans.ts).
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { numberToWords } from "./numbers.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Afrikaans ordinals 1–19. The regular ending is the cardinal plus -de; `eerste`, `derde` and `agtste`
 *  are the suppletive/assimilated forms. From 20 up the ending is -ste (twintigste, vyftigste). */
const ORD_BELOW_20: readonly string[] = [
    "", "eerste", "tweede", "derde", "vierde", "vyfde", "sesde", "sewende", "agtste", "neënde", "tiende",
    "elfde", "twaalfde", "dertiende", "veertiende", "vyftiende", "sestiende", "sewentiende", "agtiende",
    "negentiende",
];

/**
 * Integer → the Afrikaans ordinal word. Below 20 it is a table lookup. At or above 20 the ending is -ste,
 * EXCEPT that a sub-20 remainder carries its own small-ordinal form onto the end of the compound — 101e is
 * *honderdeerste*, 112e *honderdtwaalfde*. 190e (remainder 190 % 100 = 90, not sub-20) takes plain -ste:
 * honderd en negentigste. 21e (remainder 21 % 100 = 21) is a sub-20 tail: een-en-twintigste.
 */
export function ordinalWord(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 1) return undefined;
    if (n < 20) return ORD_BELOW_20[n];
    const card = numberToWords(n);
    if (card === "" || /\d/u.test(card)) return undefined;
    const r = n % 100;
    if (r >= 1 && r < 20) {
        const tail = r < 10
            ? ["", "een", "twee", "drie", "vier", "vyf", "ses", "sewe", "agt", "nege"][r]!
            : ["", "", "tien", "elf", "twaalf", "dertien", "veertien", "vyftien", "sestien", "sewentien",
                "agtien", "negentien"][r - 10]!;
        if (card.endsWith(tail))
            return `${card.slice(0, -tail.length)}${ORD_BELOW_20[r]}`;
    }
    return `${card}ste`;
}

/** Multi-dot abbreviations and era markers. Handled BEFORE the single-dot rule so no interior dot survives
 *  as a phrase break. `v.C.` = voor Christus (BC); `d.i.` = dit is (i.e.); `n.C.` = na Christus (AD).
 *
 *  EVERY LETTER PAIR HERE IS DOT-BOUND, and that is load-bearing. The corpus's four BC instances are
 *  `v. C.`, `v.C.`, `V.C.` and the undotted `vC`/`VC` — a dotted form, or the two letters ADJACENT, never
 *  "letter space letter". Allowing the unpunctuated spaced form (`v\.?\s?C\.?`) made `n\.?\s?C\.?` match
 *  the indefinite article before any c-word: `'n Chinese skip` → *'na Christushinese skip*. Afrikaans's
 *  commonest word, destroyed by a rule with ZERO corpus instances of its own (na Christus never occurs). */
const MULTI_DOT: readonly (readonly [string, string])[] = [
    ["v\\.\\s?C\\.?", "voor Christus"],
    ["vC(?![\\p{L}\\p{M}])", "voor Christus"],
    ["n\\.\\s?C\\.?", "na Christus"],
    ["d\\.\\s?i\\.", "dit is"],
];

/** Single-dot abbreviations → the spoken words. The dot is a phrase break otherwise, and the stem is usually
 *  unpronounceable. `m.p.u` = myl per uur (mph, the Afrikaans way); `n.m.` = namiddag (PM). The undotted
 *  `vm`/`nm` AM/PM suffixes are handled by the clock rule instead — they attach to a clock. */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    "dr": "Dokter",
    "m.p.u": "myl per uur",
    "m.p.u.": "myl per uur",
    "n.m": "namiddag",
    "n.m.": "namiddag",
};
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

/** Afrikaans letter names — aa, bee, see … (the corpus's own alphabet article: "die gewone alfabet as die
 *  ABC (uitgespreek aa-bee-see)"). The g2p spells them through itself. */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "aa", b: "bee", c: "see", d: "dee", e: "ee", f: "ef", g: "gee", h: "haa", i: "ie", j: "jee",
    k: "kaa", l: "el", m: "em", n: "en", o: "oo", p: "pee", q: "kuu", r: "er", s: "es", t: "tee",
    u: "uu", v: "vee", w: "wee", x: "eks", y: "ei", z: "zet",
};

/** Afrikaans phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
export const isUnreadableAfrikaans = makeUnreadableTest({
    vowels: /[aeiouy]/u,
    legalOnsets: new Set([
        "bl", "br", "ch", "dr", "dw", "fl", "fr", "gl", "gn", "gr", "kl", "kn", "kr", "kw", "pl", "pr",
        "ps", "sc", "sch", "sf", "sj", "sk", "sl", "sm", "sn", "sp", "st", "sw", "th", "tj", "tr", "tw",
        "vl", "vr", "wr", "zw",
    ]),
    legalCodas: new Set([
        "ch", "ck", "ft", "ht", "kt", "ld", "lf", "lg", "lk", "lm", "lp", "ls", "lt", "mp", "ms", "mt",
        "nd", "ng", "nk", "ns", "nt", "pt", "rd", "rf", "rg", "rk", "rl", "rm", "rn", "rp", "rs", "rt",
        "sp", "st", "ts", "ks", "ps", "sk",
    ]),
});

/** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics. REM (REM-slaap), COVID,
 *  FIFA, NATO, OPEC, UNESCO, AIDS are all said as words in Afrikaans ("die GPS" would be read as letters). */
const WORD_ACRONYMS: ReadonlySet<string> = new Set(["rem", "covid", "fifa", "nato", "opec", "unesco", "aids"]);

const normalizeInitialisms = makeInitialismNormalizer({
    letterName: (l) => LETTER_NAME[l.toLowerCase()],
    acronymLetters: new Set(["uk", "vk", "vn", "vsa", "vs", "aol"]),
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
    s = s.replace(/(?<![\p{L}\p{M}])\p{Lu}\.(?:[  ]?\p{Lu}\.)+/gu, (m0) => m0.replace(/[.\s]/gu, ""));

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
        p === undefined ? "" : ` ${p.trim().toLowerCase() === "vm" ? "voormiddag" : "namiddag"}`;
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
        (_m, h: string) => `${numberToWords(Number(h))} voormiddag`);

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
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/gu, "$1 grade Celsius");
    s = s.replace(/(\d)\s?°\s?F(?![\p{L}\p{M}])/gu, "$1 grade Fahrenheit");
    s = s.replace(/(\d)\s?°(?![\p{L}\p{M}])/gu, "$1 grade");

    // 11) SIGNS. `+30°C`, `UTC+1` — the plus was dropped outright. `&` → *en* (Afrikaans "en" = and); the
    //     tight `X&Y` form (`B&B`) is spelled with LETTER NAMES, because the shared initialism pass cannot
    //     see a single capital either side of the `&`. A TRUE minus (`-5`) reads "minus" — but every `-\d`
    //     in this corpus is a RANGE or SCORE (`2-3 km`, `7-2`, `1469-1539`, `35-40mph`), so the rule only
    //     fires when the minus is NOT between two digits (a leading negative) — exactly the DROP-test shape.
    //     `=`, `<`, `>`, `×`, `÷` do not occur in af_za but are read for completeness.
    // ⚠ ± IS THIS LANGUAGE'S OWN TWO WORDS, juxtaposed — zero new sourcing. Both halves are lifted from
    //    the plus and minus rules in this file, so nothing is invented, and both are SIGN names rather than
    //    operation names, which is what ± needs: it marks a tolerance, not an addition. The FORM is the one every
    //    language that already read ± uses (bg/da/is/nb/ro/sv juxtapose with no conjunction). Runs BEFORE the +
    //    rule, since ± is a single character the + rule cannot see.
    s = s.replace(/±/gu, " plus of minus ");
    s = s.replace(/\+\s?(?=\d)/gu, " plus ");
    s = s.replace(/(?<![\p{L}\p{Nd}])-(\d+)(?!\s*[-\d])/gu, "minus $1");
    s = s.replace(/(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(?![\p{L}\p{M}])/gu, (_m, a: string, b: string) =>
        `${LETTER_NAME[a.toLowerCase()] ?? a} en ${LETTER_NAME[b.toLowerCase()] ?? b}`);
    s = s.replace(/\s&\s/gu, " en ");
    s = s.replace(/(\S)\s*=\s*(\S)/gu, "$1 gelyk aan $2");
    s = s.replace(/(\d)\s*<\s*(\d)/gu, "$1 kleiner as $2");
    s = s.replace(/(\d)\s*>\s*(\d)/gu, "$1 groter as $2");
    s = s.replace(/(\d)\s*×\s*(\d)/gu, "$1 keer $2");
    s = s.replace(/(\d)\s*÷\s*(\d)/gu, "$1 gedeel deur $2");

    // 12) FRACTIONS (×1: `1/5 duim`). Afrikaans builds these on the ordinal, as Dutch does: 1/5 → *een vyfde*,
    //     3/4 → *drie vierde*, and 1/2 is the suppletive *een half*. The trailing guard keeps a date or a
    //     ratio chain (`1/5/2020`) out. LAST, so no earlier rule has to work around a slash.
    s = s.replace(/(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) => {
        const num = Number(a), den = Number(b);
        if (den === 2) return num === 1 ? "een half" : `${numberToWords(num)} halwe`;
        const ord = ordinalWord(den);
        return ord === undefined ? m0 : `${numberToWords(num)} ${ord}`;
    });

    // 13) INITIALISMS, LAST of the letter rules: it must run after the era markers (else v.C. → *vee …*)
    //     and after the dotted-capital rule (else V.S. never becomes the caps run it spells out).
    s = normalizeInitialisms(s);

    return s;
}
