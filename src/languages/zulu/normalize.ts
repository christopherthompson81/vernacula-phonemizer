/**
 * Zulu / isiZulu (zu) text normalization — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * THE NOUN-CLASS CONCORD is what this language looks like it should break on, and does not. Zulu does not
 * inflect the numeral. It writes a RELATIVE-CONCORD + COPULATIVE prefix hyphenated onto the digit run, and
 * that prefix is ALREADY IN THE TEXT:
 *
 *     amakhilomitha angu-1,600   class 6   ·  abantu abangu-93%   class 2
 *     izigidi ezingu-2           class 8/10·  iminyaka engu-40    class 4   ·  ngo-2007  (nga+u-)
 *
 * The concord agrees with the HEAD NOUN, never with the value of the digits — and the head noun is either
 * already written or is a noun THIS FILE emits. So agreement is always determined by something the layer can
 * see, on one condition: ⚠ NO RULE MAY INVENT A CONCORD FOR A NOUN IT DID NOT ITSELF PUT THERE. Three
 * consequences, and they are the design:
 *
 *   1. every rule leaves the numeral as DIGITS — the tokenizer's numberToWords does the words;
 *   2. percent / currency / plain units keep the shared tier's POSTPOSED order (`ingu-36 amamilimitha`),
 *      because the head-noun slot is already filled by the written prefix. Prefixing the noun would double
 *      the copulative (`ingu-amamilimitha angu-36`) or strand it (`ka-amamilimitha angu-35`);
 *   3. where a rule DOES emit the noun (`nemizuzu engu-20`, `amazinga angu-35`) it writes the concord,
 *      because it chose the noun.
 *
 * ⚠ THE CLICK LETTERS MAKE AN UNREAD LETTER WORSE THAN MISSING. c, q and x are clicks, so a letter reaching
 * the g2p raw is confidently wrong rather than merely mute: `°C` read [kǀ], `B.C.` read [ɓ kǀ], `sq mi` read
 * [skǃ mˈiː]. That is why the degree, era and `sq mi` rules exist at all — the alternative is not silence.
 */

/** Metric / imperial unit words, all the same `ama-` + borrowed-stem frame. */
const UNIT_WORD: Record<string, string> = {
    km: "amakhilomitha", m: "amamitha", mm: "amamilimitha", cm: "amasentimitha",
    kg: "amakhilogremu", mi: "amamayela", ft: "amafidi",
    // The corpus's own spelling of km (`ongama-1600 kma kusuka`), read as [kʼmˈaː] before this.
    kma: "amakhilomitha",
};

/** Rate denominators. `ngehora` = nga- + ihora. Both are ONE agglutinated word, which is why the rate cannot
 *  go through the shared tier — see the RATE step. */
const PER: Record<string, string> = { h: "ngehora", s: "ngomzuzwana" };

/** Compass directions, for a degree reading. */
const COMPASS: Record<string, string> = {
    N: "enyakatho", S: "eningizimu", E: "empumalanga", W: "entshonalanga",
};

/** Fraction denominators as the `ye-` ORDINAL — `ingxenye yesithathu` (a third). ⚠ EXPLICIT rather than
 *  derived: `ishumi` is class 5 and takes `yeshumi`, not the `*yesishumi` a derivation from the isi- nouns
 *  would give. */
const ORDINAL_YE: Record<number, string> = {
    2: "yesibili", 3: "yesithathu", 4: "yesine", 5: "yesihlanu", 6: "yesithupha",
    7: "yesikhombisa", 8: "yesishiyagalombili", 9: "yesishiyagalolunye", 10: "yeshumi",
};

/** `ngaphambi kukaKristu` — before Christ. No `AD`/`A.D.` form is declared. */
const BCE_WORD = "ngaphambi kukaKristu";

/**
 * Expand an abbreviation whose OWN trailing dot is ambiguous with the sentence period, consuming the dot only
 * when the sentence visibly continues. ⚠ Not optional: matching `B\.C\.` outright swallows the sentence
 * period of anything ending in the marker and silently deletes the pause. `body` is the abbreviation WITHOUT
 * its final dot.
 */
function expandDotted(s: string, body: string, word: string): string {
    const atEnd = new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.(?=[  ]*(?:$|\\p{Lu}))`, "gu");
    const inline = new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.`, "gu");
    return s.replace(atEnd, `${word}.`).replace(inline, word);
}

/** A clock's spoken body. ⚠ The hour NOUN is never added: a colon clock is already introduced by
 *  `ngo-`/`ngawo-`/`kuka-` ("at [the hour]"), and emitting the noun again doubles it. `:00` reads as the bare
 *  hour, never *iqanda* (zero). The class-4 concord in `nemizuzu engu-M` agrees with `imizuzu`, a noun this
 *  rule itself emits — never with the value of the digits. */
function clockBody(h: string, min: string): string {
    const hv = Number(h), mv = Number(min);
    return mv === 0 ? String(hv) : `${hv} nemizuzu engu-${mv}`;
}

/** a.m./p.m. → the half-day words. */
function halfDay(marker: string | undefined): string {
    if (marker === undefined) return "";
    return marker.toLowerCase().startsWith("p") ? " ntambama" : " ekuseni";
}

/**
 * Zulu text normalization. Runs BEFORE the shared symbol tier (`SYMBOLS(normalizeZulu(input))`, the
 * Fula/Hausa order), so every rule leaves a NUMBER where the tier expects one — except the decimal rewrite,
 * which is the only rule that destroys number↔symbol adjacency and therefore claims its neighbouring
 * currency sign and unit itself.
 */
/**
 * ENGLISH LETTER NAMES SPELLED IN NGUNI ORTHOGRAPHY, for reading initialisms.
 *
 * ⚠ WHY THIS EXISTS AND WHY IT IS SPELLED, NOT TRANSCRIBED. c, q and x are CLICK letters, so an acronym
 * reaching the g2p raw is confidently wrong rather than merely mute — `UTC` read [ˈuːtʼkǀ], a word ending
 * in a dental click, and `PBS` read [pʼɓs]. The header's refusal ("no letter names, for want of a source")
 * left that in place. The source question is answerable in one direction: acronyms in isiZulu/isiXhosa are
 * English borrowings, kept in capitals, and read with the English letter names — so what is needed is not
 * an indigenous letter-name series but the English one, ADAPTED. Writing each name in Nguni orthography
 * and letting this language's own g2p read it is what produces the adaptation, rather than splicing in
 * American English phonology (which the OmniVoice ASR probe measured readers as NOT doing).
 *
 * ⚠ EVERY SPELLING AVOIDS c, q AND x, or it would reintroduce the exact click bug it exists to fix — hence
 * `si` for C, `khyu` for Q, `eksi` for X. And aspirated `bh/ph/th/kh` rather than bare `b/p/t/k`, because
 * bare b is the IMPLOSIVE /ɓ/ and bare p/t/k are ejective; English letter names have the pulmonic ones.
 * Verified through this engine — all 26 render click-free: b→b̤ˈiː, c→sˈiː, q→kʰjˈuː, x→ˈɛːkʼsi,
 * w→d̤ab̤ulˈiːju, h→ɛjˈiːt͡ʃʼi.
 */
const NGUNI_LETTER_NAME: Readonly<Record<string, string>> = {
    A: "eyi", B: "bhi", C: "si", D: "di", E: "i", F: "efu", G: "ji", H: "eyitshi", I: "ayi",
    J: "jeyi", K: "kheyi", L: "eli", M: "emu", N: "eni", O: "o", P: "phi", Q: "khyu", R: "a",
    S: "esi", T: "thi", U: "yu", V: "vi", W: "dabhuliyu", X: "eksi", Y: "wayi", Z: "zedi",
};

/**
 * All-caps runs → letter names. Gated on the text containing lowercase, since an all-caps DOCUMENT carries
 * no initialism signal (core/initialisms.ts makes the same exemption). Flanked by neither letter nor digit,
 * which leaves mixed alphanumeric codes alone.
 *
 * ⚠ THE LOOKBEHIND MUST ALLOW A LOWERCASE LETTER, unlike the general rule: Nguni glues its concord to the
 * borrowed acronym (`i-PBS`, `weNPWS`, `kwiTV`), so requiring a non-letter on the left would decline exactly
 * the forms this language writes. A concord followed by capitals is the normal shape here.
 */
/** Acronyms said as WORDS, not letters — the same exemption core/initialisms.ts keeps for every other
 *  language that wires this. COVID is /ˈkoʊvɪd/, never C-O-V-I-D, and `i-COVID-19` proved it. */
const WORD_ACRONYMS: ReadonlySet<string> = new Set([
    "covid", "nato", "fifa", "opec", "unesco", "unicef", "aids", "laser", "sars", "eskom", "sadc",
]);

function spellNguniInitialisms(s: string): string {
    if (!/\p{Ll}/u.test(s) && /\s/u.test(s.trim())) return s;
    // ⚠ `$` in the trailing guard: `US$`/`AUD$` are MULTI-CHARACTER CURRENCY KEYS owned by the ENGINE
    // tier (zulu.ts/xhosa.ts), not by this pass. Spelling `US` here strips the tier's key and the
    // amount loses its "amadola" — which is exactly what happened before this guard.
    return s.replace(/(?<![\p{Lu}\p{M}\d])[A-Z]{2,6}(?![\p{L}\p{M}\d$])/gu, (run) =>
        WORD_ACRONYMS.has(run.toLowerCase()) ? run : [...run].map((c) => NGUNI_LETTER_NAME[c] ?? c).join(" "));
}

export function normalizeZulu(input: string): string {
    let s = input;

    // 1) HTML ENTITY, first — `amaB&amp;B` carries the escape verbatim. Folded to a bare `&` so step 2 has
    //    one shape to read.
    s = s.replace(/&amp;/giu, "&");

    // 2) AMPERSAND → `kanye ne-` ("and the"), the form used before a hyphenated foreign token. The
    //    surrounding spaces are absorbed so the glued and spaced spellings both give `X kanye ne-Y`.
    s = s.replace(/\s*&\s*/gu, " kanye ne-");

    // 3) ERA MARKERS, before the generic dotted-run rule below (else `B.C.` is flattened to `BC` first and
    //    the number guard has to carry it). Bare `BC` must follow a NUMBER, because two bare capitals are
    //    otherwise an ordinary initialism; `BCE` needs no such guard.
    s = expandDotted(s, "B\\.C\\.E", BCE_WORD);
    s = expandDotted(s, "B\\.C", BCE_WORD);
    s = s.replace(/(?<![\p{L}\p{M}])BCE(?![\p{L}\p{M}])/gu, BCE_WORD);
    s = s.replace(/(?<=\d[  ])BC(?![\p{L}\p{M}])/gu, BCE_WORD);

    // 4) DOTTED CAPITAL RUNS and a LONE INITIAL — `U.S.` read [ˈuː . s .], two spurious phrase breaks inside
    //    one token. The interior dots are abbreviation dots, not clause marks, so they go; the letters stay
    //    as they were, since no letter-name reading is available for Zulu.
    //    The lone-initial arm (`uJoji W. Hlathi`) risks eating a sentence-final period before a new capital,
    //    which is why it requires a letter and a space immediately before the initial.
    s = s.replace(/(?<![\p{L}\p{M}])\p{Lu}\.(?:[  ]?\p{Lu}\.)+/gu, (m0) => m0.replace(/[.\s]/gu, ""));
    s = s.replace(/(?<=\p{L}[  ])(\p{Lu})\.(?=[  ]+\p{Lu})/gu, "$1");

    // 5) THOUSANDS DE-GROUPING, before anything else numeric: the grouping comma reads as CLAUSE
    //    PUNCTUATION and the tail as a separate number — `1,000` came out *kunye , iqanda* ("one, egg").
    //    EXACTLY three digits per block, which keeps the comma-clock `ngo-12,00 GMT` and the comma-decimal
    //    `ezingu-1,5` out; both get their own rules below. A de-grouped run is still a NUMBER, so the tier
    //    can still see `US$11000`.
    //    ⚠ THE TRAILING GUARD IS `(?!\d)`, NOT `(?![\d.,])`. With the marks in the class, a grouped number
    //    IMMEDIATELY FOLLOWED BY ITS SENTENCE'S OWN COMMA OR PERIOD does not match at all — `angu-1,000,
    //    futhi` and `nangu-2,207.` stay broken while `angu-17,500 ngehora` is fixed. `(?!\d)` is safe
    //    because the block size is EXACTLY three: a comma-decimal is 1–2 digits and can never match, and
    //    `1,000.5` de-groups and reaches the decimal rule intact instead of being skipped.
    s = s.replace(/(?<![\d.,])(\d{1,3})(,\d{3})+(?!\d)/gu, (whole) => whole.replace(/,/gu, ""));
    //    SPACE GROUPING too (`ku- 100 000 abantu`) — read as two numbers, *ikhulu iqanda*. Blocks of EXACTLY
    //    three digits only, the same discipline the shared tier states for its own `NUM`: without it `30 9`
    //    would fuse two unrelated numbers.
    s = s.replace(/(?<![\d.,])(\d{1,3})([   ]\d{3})+(?!\d)/gu, (whole) => whole.replace(/[   ]/gu, ""));

    // 5b) SPORTS TIMES — `4:41.30`, racing paces. NOT clocks, and the clock rule below correctly refuses
    //     them (a third `.dd` field) — but refusing is not enough: the colon then survives as a CLAUSE PAUSE
    //     inside the pace and the decimal rule splits `.30` into "three zero". Read as three plain fields,
    //     the way a pace is said. BEFORE the clock rule, so the colon is gone before anything looks for a
    //     time.
    s = s.replace(/(?<![\d:.,])(\d{1,2}):([0-5]\d)\.(\d{2})(?![\d.])/gu, "$1 $2 $3");

    // 6) CLOCK, colon form. The colon reaches `clausePunctuation` and splits every time in two. `10: 08`
    //    puts a SPACE after the colon, so `:\s?` is required. NOT a sports time: a third `.dd` field is a
    //    pace, excluded by the trailing `(?![:.\d])`. BEFORE the decimal rules, which would otherwise claim
    //    the `11.60` tail of a sports time, and before the range rule.
    s = s.replace(
        /(?<![\d:.,])([01]?\d|2[0-3]):[  ]?([0-5]\d)(?![:.\d])(?:[  ]*([Aa]\.?[Mm]\.?|[Pp]\.?[Mm]\.?)(?![\p{L}\p{M}]))?/gu,
        (_m, h: string, min: string, ap: string | undefined) => `${clockBody(h, min)}${halfDay(ap)}`);

    // 7) CLOCK before a TIMEZONE, in Zulu's other two spellings: `ngo-12,00 GMT` (comma), `(15.00 UTC)`
    //    (dot) and `(0230 UTC)` (bare four digits, marked by the leading zero). The separator is otherwise a
    //    decimal or a grouping mark; the timezone after two-digit minutes is what identifies a clock. AFTER
    //    the colon clock, BEFORE every decimal rule.
    s = s.replace(/(?<![\d.,])(\d{1,2})[.,]([0-5]\d)(?=[  ]*(?:UTC|GMT)(?![\p{L}\p{M}]))/gu,
        (_m, h: string, min: string) => clockBody(h, min));
    s = s.replace(/(?<![\d.,])(0\d)([0-5]\d)(?=[  ]*(?:UTC|GMT)(?![\p{L}\p{M}]))/gu,
        (_m, h: string, min: string) => clockBody(h, min));

    // 8) a.m./p.m. NOT attached to a clock. The marker is only ever readable as the half-day word; leaving
    //    it spells [pʼ . m .], two pauses and a bare consonant.
    s = s.replace(/(?<![\p{L}\p{M}])([Aa]\.[Mm]|[Pp]\.[Mm])\.?(?![\p{L}\p{M}])/gu,
        (m0) => halfDay(m0).trim());

    // 8c) THE PLUS AND ±, claimed HERE rather than with the other signs at step 14b — ⚠ THE ORDERING IS
    //     LOAD-BEARING and step 14b deliberately has no plus arm. The degree rule below consumes its
    //     operand, so after it runs the text reads `+amazinga…` and a digit lookahead can no longer match.
    //     Taking the sign first is the only position that works, and `[+]?` is gone from both degree
    //     patterns so a form this arm misses cannot be quietly eaten there either.
    //     ⚠ SPELLED `plas`, NOT `plus`: this orthography is phonemic and the vowel is [a], so `plus` would
    //     read pʼlˈuːs. The conventional isiZulu spelling of the loan is unsourced; these spellings are
    //     chosen to reproduce the phones. `o` is the reduced English "or", not Zulu's own conjunction
    //     (`noma`), which would substitute a word for the one actually said.
    //     ⚠ ± IS NOT FREE FOR zu's SISTER xh, which is otherwise nearly identical here: xh's minus word is
    //     `thabatha`, the VERB "subtract", so juxtaposing would read "plus subtract" — an operation where
    //     the sign marks a tolerance.
    s = s.replace(/±/gu, " plas o mayinas ");
    s = s.replace(/[  ]?\+[  ]?(?=\d)/gu, " plas ");

    // 9) DEGREES. `°` was dropped and the scale letter read as a CLICK: `+30°C` → [… kǀ], `35°W` → [… w].
    //    `amazinga` is the degree word and the concord `angu-` agrees with it — a class-6 noun THIS rule
    //    emits, so the digits may stay digits.
    //    ⚠ THE SCALE NAME IS ASYMMETRIC, and deliberately. Neither scale has a Zulu form, so either would
    //    stay in its English spelling — but ⟨c⟩ is the DENTAL CLICK here, so a retained `Celsius` reads
    //    [skǀiˈuːs] and a bare `C` reads [kǀ], the confidently-wrong reading this rule exists to remove.
    //    Celsius is also the unmarked scale, so `°C` reads as the bare degree phrase. `Fahrenheit` contains
    //    no click letter, is read by the g2p as an ordinary word, and is KEPT — without it `°F` and `°C`
    //    would be indistinguishable.
    //    ⚠ THE SENTENCE MAY ALREADY SAY *amazinga*. Emitting the noun unconditionally gives the degree word
    //    twice and two bound concords in a row (`kuka-` already governs the number). So the head is
    //    suppressed when the clause already carries it, leaving the written concord to do its job; the
    //    `angu-` goes with it, because it agrees with the head that is no longer being emitted.
    const saidDegrees = (before: string): boolean =>
        /amazinga[^.!?;]*$/u.test(before);
    const deg = (whole: string, digits: string, tail: string, offset: number, full: string): string =>
        `${saidDegrees(full.slice(0, offset)) ? "" : "amazinga angu-"}${digits}${tail}`;
    s = s.replace(/(\d[\d.,]*)[  ]?[°º][  ]?C(?![\p{L}\p{M}])/gu,
        (m0, d: string, off: number, full: string) => deg(m0, d, "", off, full));
    s = s.replace(/(\d[\d.,]*)[  ]?[°º][  ]?F(?![\p{L}\p{M}])/gu,
        (m0, d: string, off: number, full: string) => deg(m0, d, " Fahrenheit", off, full));
    s = s.replace(/[+]?(\d[\d.,]*)[  ]?[°º][  ]?([NSEW])(?![\p{L}\p{M}])/gu,
        (m0, d: string, c: string, off: number, full: string) =>
            deg(m0, d, ` ${COMPASS[c.toUpperCase()]!}`, off, full));
    s = s.replace(/[+]?(\d[\d.,]*)[  ]?[°º]/gu,
        (m0, d: string, off: number, full: string) => deg(m0, d, "", off, full));

    // 10) RANGES → `kuya ku-` ("going to"). The `ku-` is class-17 locative and INVARIANT, which is exactly
    //     why it is the right joiner: nothing about it has to agree with the value of the digits, so the
    //     operands stay digits.
    //     ⚠ ASCENDING ONLY for integers — a non-ascending `N-N` is a season (`1995-96`) or a score (`26 -00`,
    //     `5-3`), which read as a juxtaposition rather than a span.
    //     DECIMAL ranges FIRST: the plain rule's `(?<![\d.,])` lookbehind blocks a digit that follows a dot,
    //     so a decimal range would never match, and the decimal rules below would then split both operands
    //     and strand the dash with no joiner at all.
    //     BEFORE the decimal rules and BEFORE the unit/rate rules (which then see `40 mph` in
    //     `35 kuya ku-40 mph`). Both operands are re-emitted VERBATIM and both classes END IN A DIGIT, so a
    //     trailing clause comma can never be eaten.
    const span = (whole: string, a: string, b: string): string =>
        Number(a.replace(/,/gu, "")) < Number(b.replace(/,/gu, "")) ? `${a} kuya ku-${b}` : whole;
    //     ⚠ A DECIMAL range is joined in EITHER direction, unlike an integer one. The ascending-only guard
    //     exists to keep scores and seasons out, and neither is ever written with a decimal point — so a
    //     DESCENDING decimal span (`ezingu-4.2-3.9 edlule`, "4.2 to 3.9 million years ago") is genuine.
    s = s.replace(/(?<![\d.,])(\d+\.\d+)[  ]*[-–—][  ]*(\d+\.\d+)(?![\d.,])/gu, "$1 kuya ku-$2");
    s = s.replace(/(?<![\d.,])(\d[\d,]*\d|\d)[  ]*[-–—][  ]*(\d[\d,]*\d|\d)(?![\d.,])/gu, span);

    // 11) RATE, LOCAL and not the shared tier's. Zulu's rate is a SINGLE agglutinated word — nga- + ihora →
    //     `ngehora` — while `makeSymbolNormalizer` emits a rate as four tokens (`num head per denominator`)
    //     and requires both `per` and the denominator word, so a two-token Zulu rate cannot be expressed in
    //     `unitPer`/`rateDenominators` without a stray empty token or splitting `ngehora` across two slots.
    //     `mph`/`kph` are claimed WITHOUT requiring a preceding number — the count is sometimes spelled out
    //     AFTER the unit (`sama-kph ayishumi nanye`), and neither string is ever a Zulu word, so there is
    //     nothing for an unguarded match to break.
    //     BEFORE the decimal rules (the rate operands are all integers) and before the tier, which would
    //     otherwise claim `km` and strand `/h` as the letter H.
    s = s.replace(/(?<!\d)(\d[\d.,]*)[  ]?(km|mi|m|mm|cm|kg)[  ]*\/[  ]*([hs])(?![\p{L}\p{M}])/giu,
        (_m, n: string, u: string, d: string) => `${n} ${UNIT_WORD[u.toLowerCase()]!} ${PER[d.toLowerCase()]!}`);
    s = s.replace(/(?<![\p{L}\p{M}])mph(?![\p{L}\p{M}])/giu, `${UNIT_WORD["mi"]!} ${PER["h"]!}`);
    s = s.replace(/(?<![\p{L}\p{M}])kph(?![\p{L}\p{M}])/giu, `${UNIT_WORD["km"]!} ${PER["h"]!}`);

    // 12) SQUARE MILES — `300,948 sq mi`, where `sq` read as [skǃ], a click. Postposed, matching the way the
    //     metric equivalent is written out (`amakhilomitha skwele angu-783,562`). A plain `km²` needs no
    //     rule here — the shared tier's `exponentWords` produces the same order — but a squared unit sitting
    //     on a DECIMAL does, and step 13 claims it.
    s = s.replace(/(\d[\d.,]*)[  ]?sq[  ]?mi(?![\p{L}\p{M}])/giu, `$1 ${UNIT_WORD["mi"]!} skwele`);

    // 13) DECIMALS. The currency and unit arms come first because this rewrite is the one that destroys
    //     number↔symbol adjacency, so it has to claim its own neighbours before the tier could.
    const dec = (i: string, f: string): string =>
        [i, ...f.replace(/0+$/u, "")].filter((t) => t !== "").join(" ");
    s = s.replace(/(?<![\p{L}\p{M}])(?:US\$|AUD\$|\$|£)[  ]?(\d+)\.(\d+)(?!\.?\d)/gu,
        (_m, i: string, f: string) => `${dec(i, f)} amadola`);
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)[  ]?(km|mi|mm|cm|kg|ft|m)([²2])?(?![\p{L}\p{M}'’])/giu,
        (_m, i: string, f: string, u: string, exp: string | undefined) =>
            `${dec(i, f)} ${UNIT_WORD[u.toLowerCase()]!}${exp === undefined ? "" : " skwele"}`);
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?!\.?\d)/gu, (_m, i: string, f: string) => dec(i, f));

    // 13b) COMMA-DECIMAL — Zulu writes both separators. A comma before a THREE-digit group is thousands and
    //      was already de-grouped at step 5, so this claims only a 1–2 digit fraction and cannot swallow a
    //      grouping comma. Without it the comma leaks as a clause pause inside the number.
    s = s.replace(/(?<![\d.,])(\d+),(\d{1,2})(?![\d,])/gu, (_m, i: string, f: string) => dec(i, f));

    // 14) FRACTION — `1/5` read "one five" before. ⚠ NUMERATOR 1 ONLY, and deliberately: "three fifths" is
    //     *izingxenye ezintathu kwezinhlanu*, whose numerator carries a class-8 concord that would have to
    //     be applied to the digits. An unclaimed `3/5` keeps the bare juxtaposition it has today, which is
    //     not confidently wrong. AFTER the decimals, so a date-like `1.5/2` cannot reach here half-rewritten.
    s = s.replace(/(?<![\d/.,])1[  ]?\/[  ]?(\d{1,2})(?![\d/.,])/gu, (m0, d: string) => {
        const ord = ORDINAL_YE[Number(d)];
        return ord === undefined ? m0 : `ingxenye ${ord}`;
    });

    // 14b) MATH SIGNS. Every one of these was DROPPED — `x = y` read [kǁ j], `6 × 6` read the two numbers
    //      with nothing between them.
    //        `×`  → `kuphindwe ngo-`  Zulu's own multiplication idiom
    //        `=`  → `kulingana no-`   the -lingana stem with the `ku-` prefix
    //        `<`  → `ngaphansi kuka-`
    //        `>`  → `ngaphezu kuka-`
    //        `-`  → `ukukhipha `      "to take out / subtract", as a PREFIX. The part of speech matters:
    //                                 Zulu subtraction takes the subtrahend as an object, so it cannot be
    //                                 an infix.
    //      ⚠ THE MINUS CARRIES A SECOND LOOKBEHIND rejecting a digit plus a space. Without it the rugby
    //      score `26 -00` reads *ukukhipha iqanda* ("subtract zero"); the range rule has already claimed
    //      the other `-\d` shape at step 10.
    s = s.replace(/[  ]?×[  ]?/gu, " kuphindwe ngo-");
    s = s.replace(/[  ]?=[  ]?/gu, " kulingana no-");
    s = s.replace(/[  ]?<[  ]?/gu, " ngaphansi kuka-");
    s = s.replace(/[  ]?>[  ]?/gu, " ngaphezu kuka-");
    // ⚠ THE PLUS IS NOT CLAIMED HERE — step 8c takes it, before the degree rule. An arm here would be
    // unreachable, so there is deliberately none. See step 8c.
    s = s.replace(/(?<![\p{L}\p{Nd}])(?<![\p{L}\p{Nd}][  ])[-−](?=\d)/gu, "ukukhipha ");

    // 15) A SPACED DASH is a parenthetical break and was DROPPED ENTIRELY, taking the clause boundary with
    //     it (`ilunga - bona Umfanekiso`). LAST, so step 10 has already claimed every dash sitting between
    //     two numbers: the rugby score `26 -00` must keep its bare juxtaposition rather than gain a
    //     spurious pause.
    s = s.replace(/(?<!\d)[  ]+[-–—]+[  ]+(?!\d)/gu, ", ");
    // `njl.` / `njll.` is *njalonjalo* ("et cetera") — corpus: `izinto zokuthutha, njll.`, previously
    // the cluster [ɲd͡ʒ̤l] plus a leaked break. Dot optional: FLEURS strips it.
    s = s.replace(/(?<![\p{L}\p{M}])njll?\.?(?![\p{L}\p{M}])/giu, "njalonjalo");
    // `udkt.` is *udokotela* (Doctor) — corpus: `KwaZulu-Natal. udkt …`, previously [ˈuːd̤kʼtʼ].
    s = s.replace(/(?<![\p{L}\p{M}])u?dkt\.?(?![\p{L}\p{M}])/giu, "udokotela");

    // INITIALISMS LAST. Every rule above owns capitals of its own — `US$`, `°C`, `B.C.`, `sq mi` — and
    // spelling them out first would take those away, which is exactly what happened when this ran early.
    s = spellNguniInitialisms(s);

    return s;
}
