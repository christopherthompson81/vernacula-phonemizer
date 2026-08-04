/**
 * Zulu / isiZulu (zu) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * THE NOUN-CLASS CONCORD, which is the thing this language was expected to break on (trap 14), and what
 * measuring it showed. Zulu does not inflect the numeral. It writes a RELATIVE-CONCORD + COPULATIVE
 * prefix hyphenated onto the digit run, and that prefix is ALREADY IN THE TEXT — 349 of the corpus's
 * number occurrences carry one:
 *
 *     amakhilomitha angu-1,600   class 6   ·  abantu abangu-93%   class 2
 *     izigidi ezingu-2           class 8/10·  iminyaka engu-40    class 4   ·  ngo-2007  (nga+u-)
 *
 * The concord agrees with the HEAD NOUN, never with the value of the digits — and the head noun is either
 * already written (those 349) or is a noun THIS FILE emits. So the agreement is always determined by
 * something the layer can see, and trap 14 does not bite, on one condition: no rule may invent a concord
 * for a noun it did not itself put there. Three consequences, and they are the design:
 *
 *   1. every rule leaves the numeral as DIGITS — the tokenizer's numberToWords does the words;
 *   2. percent / currency / plain units keep the shared tier's POSTPOSED order (`ingu-36 amamilimitha`),
 *      because the head-noun slot is already filled by the written prefix. Prefixing the noun the way the
 *      corpus does when it spells a measure out (`amakhilomitha angu-1,600`) would double the copulative
 *      (`ingu-amamilimitha angu-36`) or strand it (`ka-amamilimitha angu-35` for `Ifomethi ka-35mm`) —
 *      and the abbreviated units are almost all parenthetical conversions or attributive, never heads;
 *   3. where a rule DOES emit the noun (`nemizuzu engu-20`, `amazinga angu-35`) it writes the concord,
 *      because it chose the noun.
 *
 * THE CLICK LETTERS MAKE AN UNREAD LETTER WORSE THAN MISSING. c, q and x are clicks in Zulu, so a letter
 * that reaches the g2p raw is confidently wrong rather than merely mute: `°C` read [kǀ], `B.C.` read
 * [ɓ kǀ], `sq mi` read [skǃ mˈiː]. That is why the degree, era and `sq mi` rules exist at counts of 2, 6
 * and 3 — the alternative is not silence.
 *
 * Measured over the zu_za corpus (1,478 unique cased utterances, column 3):
 *   comma-grouped thousands ×34 · dot-decimals ×20 raw / 14 real · comma-decimal ×1 · colon clocks ×15
 *   raw / 12 real (3 are sports times) · dot/comma clock + timezone ×3 · ranges ×16 (13 spans, 3
 *   scores/season) · abbreviated units ×22 · rates ×7 · exponents ×3 · `sq mi` ×3 · currency signs ×9 ·
 *   percent ×4 · degrees ×2 · era markers ×6 · dotted capital runs ×3 + lone initial ×1 · a.m./p.m. ×3 ·
 *   ampersand ×2 · fraction ×1 · SPACED DASH ×22 (dropped entirely — 22 lost pauses) ·
 *   all-caps initialisms ~110 tokens / 70 acronyms · prefix-hyphen-digit ×349.
 *
 * WHAT WAS BROKEN, verbatim from the pre-change engine:
 *   `1,000`         → `kʼˈuːɲɛ , i˥kǃˈaː˩nd̤a˥`      grouping comma → pause, `000` → *iqanda* (zero)
 *   `angu-1.5`      → `ˈaːŋɡ̤u kʼˈuːɲɛ . kʼuɬˈaːnu`  the decimal dot became a SENTENCE break
 *   `angu-6.34`     → `… i˩si˥tʰˈuː˩pʰa˩ . amaʃˈuːmi amatʰˈaːtʰu nˈaːnɛ`   …and .34 read "thirty-four"
 *   `Ngo-11:20`     → `ŋɡ̤ˈɔː … nˈaːɲɛ , amaʃˈuːmi amaɓˈiːli`  the colon became a clause pause
 *   `u-5 mm`        → `ˈuː kʼuɬˈaːnu mm`             raw letters in the IPA
 *   `90kg`          → `… kʼɡ̤`      ·  `64 kph` → `… kʼpʰ`  ·  `133 m/s` → `… m s`
 *   `83 km/h`       → `… amakʰilɔmˈiːtʰa h`          the /h read as the letter H
 *   `3.850 km²`     → `kʼutʰˈaːtʰu . … kʼm`          the ² destroyed the unit match outright
 *   `300,948 sq mi` → `… skǃ mˈiː`                   "sq" read with a CLICK
 *   `u-US$30`       → `ˈuː ˈuːs amaʃˈuːmi amatʰˈaːtʰu`   the $ DROPPED (`US$` shadowed the tier's `$`)
 *   `35-40 mph`     → `… amaʃˈuːmi amˈaːnɛ mpʰ`      no joiner, raw unit
 *   `+30°C`         → `amaʃˈuːmi amatʰˈaːtʰu kǀ`     ° dropped, C → the CLICK [kǀ]
 *   `1000 B.C.`     → `… ɓ . kǀ .`                   era marker letter-spelled, two spurious pauses
 *   `u-U.S.`        → `ˈuː ˈuː . s .`                two spurious phrase breaks
 *   `Arts & Sciences` → `ˈaːrt͡sʼ skǀiˈɛːŋǀɛs`      the & dropped;  `amaB&amp;B` → `ˈaːmaɓ ɓ`
 *   `1/5`           → `kʼˈuːɲɛ kʼuɬˈaːnu`            "one five"
 *   22 spaced dashes → no pause at all
 *
 * THE DECIMAL POINT IS DELIBERATELY UNNAMED. No Zulu decimal-point word exists in the corpus, in the
 * epitran referee's 1,047-word list, in tone.tsv, or in espeak — which ships no Zulu at all (439
 * dictsource files, zero matching `zul|^zu`). Per the standing rule on data, a confidently wrong point
 * word is worse than a missing one, so the dot is read as a boundary and the fractional digits are spoken
 * one at a time. `nengxenye` ("and a part") was considered for `.5` on the Hausa `da rabi` model and
 * rejected: all 17 corpus instances of `ingxenye` gloss it as PART, not HALF.
 *
 * INITIALISMS ARE NOT WIRED, and this is a checked deferral rather than an assumption (trap 16).
 * `src/core/initialisms.ts` exists and 37 language files use it — but read its `spellOut()`: it returns
 * `undefined` as soon as ANY letter lacks a name, and the caller then leaves the token alone. With no
 * `letterName` table the acronym branch is a literal no-op on all ~110 tokens, and no Zulu letter-name
 * table exists in espeak (no Zulu), the referee (a programmatic G2P), or the corpus. The only part that
 * would fire is the dotted-initial handling, which steps 3–4 below do directly. Same conclusion Swahili
 * reached, for the same verified reason.
 */

/** Metric / imperial unit words. Every one that the corpus writes out is attested there as a TOKEN:
 *  amakhilomitha ×3, amamayela ×10, amamitha ×2, amafidi ×2, amaphawundi ×1, amasentimitha ×1. The two
 *  that are not — `amakhilogremu` and `amamilimitha` — are the case the review tool's sourcing check
 *  deliberately EXCLUDES (`units` are absent from every source in some thirty languages and are still
 *  correct); both are the same `ama-` + borrowed-`-mitha`/`-gremu` frame as the six attested ones. */
const UNIT_WORD: Record<string, string> = {
    km: "amakhilomitha", m: "amamitha", mm: "amamilimitha", cm: "amasentimitha",
    kg: "amakhilogremu", mi: "amamayela", ft: "amafidi",
};

/** Rate denominators. `ngehora` = nga- + ihora, ×6 in the corpus and always in exactly this "per hour"
 *  slot (`amakhilomitha angu-240 ngehora`, `yamamayela angama-105 ngehora`, `amamayela ayi-149 ngehora`).
 *  `ngomzuzwana` ×2 (`amamayela angu-8 ngomzuzwana`). Both are ONE agglutinated word, which is why the
 *  rate cannot go through the shared tier — see the RATE step. */
const PER: Record<string, string> = { h: "ngehora", s: "ngomzuzwana" };

/** Compass directions for a degree reading — the corpus's own words: entshonalanga ×3, enyakatho ×6,
 *  eningizimu ×8, empumalanga ×4. */
const COMPASS: Record<string, string> = {
    N: "enyakatho", S: "eningizimu", E: "empumalanga", W: "entshonalanga",
};

/** Fraction denominators as the `ye-` ORDINAL, which is the corpus's own fraction shape: `ingxenye
 *  yesithathu` ×2 (a third) and `ingxenye yesine` ×1 (a quarter), out of `ingxenye` ×17. 5–10 compose
 *  from the same frame over stems already in zulu.jsonc. EXPLICIT rather than derived, because `ishumi`
 *  is class 5 and takes `yeshumi`, not the `*yesishumi` a derivation from the isi- nouns would give
 *  (trap 13 — the table branch and the boundary between the frames are different cases). */
const ORDINAL_YE: Record<number, string> = {
    2: "yesibili", 3: "yesithathu", 4: "yesine", 5: "yesihlanu", 6: "yesithupha",
    7: "yesikhombisa", 8: "yesishiyagalombili", 9: "yesishiyagalolunye", 10: "yeshumi",
};

/** `ngaphambi kukaKristu` — before Christ. `ngaphambi` ×28 and `kuka-` ×14 are corpus tokens; `Kristu`
 *  is attested as a STEM ×2 (`ubuKristu` / `yobuKristu`, "Christianity") and never as a bare token, which
 *  is the honest description of its sourcing. No `AD`/`A.D.` occurs in this corpus, so none is listed. */
const BCE_WORD = "ngaphambi kukaKristu";

/**
 * Expand an abbreviation whose OWN trailing dot is ambiguous with the sentence period, consuming the dot
 * only when the sentence visibly continues. Swahili's shape, and it is not optional: matching `B\.C\.`
 * outright swallows the sentence period of anything ending in the marker and silently deletes the pause.
 * `body` is the abbreviation WITHOUT its final dot.
 */
function expandDotted(s: string, body: string, word: string): string {
    const atEnd = new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.(?=[  ]*(?:$|\\p{Lu}))`, "gu");
    const inline = new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.`, "gu");
    return s.replace(atEnd, `${word}.`).replace(inline, word);
}

/** A clock's spoken body. The hour NOUN is never added (trap 12): all 12 of the corpus's colon clocks are
 *  already introduced by `ngo-`/`ngawo-`/`kuka-` ("at [the hour]"), and the corpus writes the noun itself
 *  when it wants it (`ngehora lika-10 namuhla ekuseni`). `:00` reads as the bare hour, never *iqanda*.
 *  `nemizuzu engu-M` is sourced composition: `imizuzu` ×3 (and `umzuzu` in BOTH tone.tsv and the epitran
 *  referee) gives the noun; the na- + imi- → nemi- coalescence is attested on 15+ distinct class-4 lemmas
 *  here (nemidlalo, nemithetho, nemikhumbi, neminyaka, nemizila, nemisebenzi, nemimoya, nemibuzo, …); and
 *  the class-4 copulative concord `engu-` is attested on a DIGIT RUN in `iminyaka engu-40`. The concord
 *  agrees with `imizuzu`, a noun this rule itself emits — never with the value of the digits, so nothing
 *  here needs the numeral as words (trap 14). */
function clockBody(h: string, min: string): string {
    const hv = Number(h), mv = Number(min);
    return mv === 0 ? String(hv) : `${hv} nemizuzu engu-${mv}`;
}

/** a.m./p.m. → the corpus's own half-day words: `ekuseni` ×10 (morning), `ntambama` ×1 (afternoon). */
function halfDay(marker: string | undefined): string {
    if (marker === undefined) return "";
    return marker.toLowerCase().startsWith("p") ? " ntambama" : " ekuseni";
}

/**
 * Zulu text normalization. Runs BEFORE the shared symbol tier (`SYMBOLS(normalizeZulu(input))`, the
 * Fula/Hausa order), so every rule leaves a NUMBER where the tier expects one — except the decimal
 * rewrite, which is the only rule that destroys number↔symbol adjacency and therefore claims its
 * neighbouring currency sign and unit itself (trap 14's second clause).
 */
export function normalizeZulu(input: string): string {
    let s = input;

    // 1) HTML ENTITY, first — the corpus's `amaB&amp;B` (×1) carries the escape verbatim, and the entity's
    //    characters were dropped silently. Folded to a bare `&` so step 2 has one shape to read.
    s = s.replace(/&amp;/giu, "&");

    // 2) AMPERSAND → `kanye ne-` ("and the"), the corpus's own form before a hyphenated foreign token
    //    (`kanye ne-NPWS`, ×13 of `kanye` ×290). Both instances lost the conjunction entirely: `Arts &
    //    Sciences` → [ˈaːrt͡sʼ skǀiˈɛːŋǀɛs], `amaB&B` → [ˈaːmaɓ ɓ]. The surrounding spaces are absorbed so
    //    the glued and spaced spellings both give `X kanye ne-Y` (trap 15 — the same morpheme, two
    //    spellings; here it is the SIGN that is spaced or not, and both occur once each).
    s = s.replace(/\s*&\s*/gu, " kanye ne-");

    // 3) ERA MARKERS, before the generic dotted-run rule (playbook ordering: era markers before generic
    //    abbreviations, and multi-dot before single-dot) — else `B.C.` is flattened to `BC` first and the
    //    number guard below has to carry it. ×6: BCE ×4, `B.C.` ×1, bare `BC` ×1. Bare `BC` must follow a
    //    NUMBER, because two bare capitals are otherwise an ordinary initialism; the corpus's one instance
    //    is `ku-5000 BC!`. `BCE` needs no such guard. Read as [ɓ . kǀ .] before this — a spurious pause AND
    //    a click for the C.
    s = expandDotted(s, "B\\.C\\.E", BCE_WORD);
    s = expandDotted(s, "B\\.C", BCE_WORD);
    s = s.replace(/(?<![\p{L}\p{M}])BCE(?![\p{L}\p{M}])/gu, BCE_WORD);
    s = s.replace(/(?<=\d[  ])BC(?![\p{L}\p{M}])/gu, BCE_WORD);

    // 4) DOTTED CAPITAL RUNS and a LONE INITIAL — `U.S.` ×2 read [ˈuː . s .], two spurious phrase breaks
    //    inside one token. The interior dots are abbreviation dots, not clause marks, so they go; the
    //    letters stay as they were (see the header on why no letter-name reading is available).
    //    The lone-initial shape (`uJoji W. Hlathi`, ×1) is the one the shared pass documents a false
    //    positive for — a sentence ending in a lone capital before a new one. MEASURED here rather than
    //    assumed: `\S+ [A-Z]\.(?=\s+[A-Z])` has exactly ONE match in 1,478 utterances and it is the
    //    genuine initial, so zero sentence-final pauses are at risk.
    s = s.replace(/(?<![\p{L}\p{M}])\p{Lu}\.(?:[  ]?\p{Lu}\.)+/gu, (m0) => m0.replace(/[.\s]/gu, ""));
    s = s.replace(/(?<=\p{L}[  ])(\p{Lu})\.(?=[  ]+\p{Lu})/gu, "$1");

    // 5) THOUSANDS DE-GROUPING (×34), before anything else numeric (playbook ordering rule #1): the
    //    grouping comma was read as CLAUSE PUNCTUATION and the tail as a separate number — `1,000` came
    //    out *kunye , iqanda* ("one, egg" — iqanda is Zulu's zero) and `755,688` as two numbers with a
    //    pause between them. EXACTLY three digits per block, which is what keeps the comma-clock
    //    `ngo-12,00 GMT` and the comma-decimal `ezingu-1,5` out of this rule; both get their own below.
    //    A de-grouped run is still a NUMBER, so the tier can still see `US$11000`.
    //
    //    THE TRAILING GUARD IS `(?!\d)`, NOT `(?![\d.,])`, and the corpus diff is what found the
    //    difference. With the mark in the class, a grouped number IMMEDIATELY FOLLOWED BY ITS SENTENCE'S
    //    OWN COMMA OR PERIOD does not match at all, because the lookahead sees that mark — so `angu-1,000,
    //    futhi zihamba` and `nangu-2,207.` stayed broken while `angu-17,500 ngehora` was fixed. Six of the
    //    corpus's 34 grouped numbers are in that position (`abangu-9,000,` `angu-1,000,` `kuka-5,000,`
    //    `nangu-2,207.` `ngo-2,243,` `ngu-100,000.`), i.e. 18% of the class, and the inconsistency is the
    //    tell — right where the number stands alone, wrong right where a clause boundary follows it.
    //    `(?!\d)` is safe here because the block size is EXACTLY three: a comma-decimal is 1–2 digits
    //    (`1,5`, `12,00`) and can never match, and `1,000.5` now de-groups and reaches the decimal rule
    //    intact instead of being skipped.
    s = s.replace(/(?<![\d.,])(\d{1,3})(,\d{3})+(?!\d)/gu, (whole) => whole.replace(/,/gu, ""));
    //    SPACE GROUPING too (×1, `babalelwa ku- 100 000 abantu`), which the review tool's ordinary-text
    //    probe is what surfaced. The two halves were read as two numbers — *ikhulu iqanda*, "a hundred,
    //    zero" — because the tokenizer sees `100` and `000` separately. Blocks of EXACTLY three digits
    //    only, the same discipline the shared tier states for its own `NUM`: without it `30 9` would fuse
    //    two unrelated numbers. The corpus contains exactly one `\d{1,3} \d{3}` shape and it is this one.
    s = s.replace(/(?<![\d.,])(\d{1,3})([   ]\d{3})+(?!\d)/gu, (whole) => whole.replace(/[   ]/gu, ""));

    // 5b) SPORTS TIMES (×3) — `4:41.30`, `2:11.60`, `1:09.02`, all racing paces. NOT clocks, and the clock
    //     rule below correctly refuses them (a third `.dd` field) — but refusing is not enough: the colon
    //     then survived as a CLAUSE PAUSE inside the pace (`esingu-4:41.30` → *kune , amashumi amane…*) and
    //     the decimal rule further split `.30` into "three zero". Read as three plain fields, the way a
    //     pace is said. BEFORE the clock rule, so the colon is gone before anything looks for a time.
    s = s.replace(/(?<![\d:.,])(\d{1,2}):([0-5]\d)\.(\d{2})(?![\d.])/gu, "$1 $2 $3");

    // 6) CLOCK, colon form (×12 real). The colon reached `clausePunctuation` and split every time in two:
    //    `Ngo-11:20` → *… nanye , amashumi amabili*. `10: 08` and `9: 30` put a SPACE after the colon, so
    //    `:\s?` is required — and it is safe: of the corpus's 43 colons only six match `: ?\d\d` and none
    //    of those is a clause colon. NOT a sports time: a third `.dd` field (`4:41.30`, `2:11.60`,
    //    `1:09.02`, ×3) is a pace, excluded by the trailing `(?![:.\d])`. BEFORE the decimal rules, which
    //    would otherwise claim the `11.60` tail of a sports time, and before the range rule.
    s = s.replace(
        /(?<![\d:.,])([01]?\d|2[0-3]):[  ]?([0-5]\d)(?![:.\d])(?:[  ]*([Aa]\.?[Mm]\.?|[Pp]\.?[Mm]\.?)(?![\p{L}\p{M}]))?/gu,
        (_m, h: string, min: string, ap: string | undefined) => `${clockBody(h, min)}${halfDay(ap)}`);

    // 7) CLOCK before a TIMEZONE, in the corpus's other two spellings (×3): `ngo-12,00 GMT` (comma),
    //    `(15.00 UTC)` (dot) and `(0230 UTC)` (bare four digits, marked by the leading zero). The
    //    separator is otherwise a decimal or a grouping mark; the timezone after two-digit minutes is what
    //    identifies a clock. AFTER the colon clock, BEFORE every decimal rule.
    s = s.replace(/(?<![\d.,])(\d{1,2})[.,]([0-5]\d)(?=[  ]*(?:UTC|GMT)(?![\p{L}\p{M}]))/gu,
        (_m, h: string, min: string) => clockBody(h, min));
    s = s.replace(/(?<![\d.,])(0\d)([0-5]\d)(?=[  ]*(?:UTC|GMT)(?![\p{L}\p{M}]))/gu,
        (_m, h: string, min: string) => clockBody(h, min));

    // 8) a.m./p.m. NOT attached to a clock — none occurs, but the marker is only ever readable as the
    //    half-day word and leaving it spells [pʼ . m .], two pauses and a bare consonant.
    s = s.replace(/(?<![\p{L}\p{M}])([Aa]\.[Mm]|[Pp]\.[Mm])\.?(?![\p{L}\p{M}])/gu,
        (m0) => halfDay(m0).trim());

    // 8c) THE PLUS, CLAIMED BEFORE DEGREES — the ordering coupling, and it was a live defect. The degree rule
    //     below used to open with `[+]?`, matching the sign and never re-emitting it, so `+30°C` read
    //     *amazinga angu-30* with the plus silently gone. That was harmless while zu had no sourced plus word;
    //     now that `plas` is sourced (step 14b) it HID one, and the sign could never reach step 14b anyway —
    //     after the degree rewrite the text is `+amazinga…`, and 14b's arm requires a digit after the sign.
    //     So the sign is claimed here, before its operand is consumed, and `[+]?` is gone from the degree
    //     patterns so a form this arm misses cannot be silently eaten there either.
    //
    //     ⚠ THE CORPUS INSTANCE IS `kuka-+30°C` — A HYPHEN IMMEDIATELY FOLLOWED BY THE SIGN. `kuka-` is Zulu's
    //     bound-prefix hyphen, so the text carries `-+`, two adjacent marks, and that is what the one
    //     recording is evidence about: the phoneme recognizer decodes `…kuka p l a s o m aɪ n a s v e d i…`,
    //     i.e. the reader voiced BOTH signs ("plus or minus"). That is a faithful reading of a two-character
    //     sequence, NOT evidence that Zulu says "plus or minus" before a temperature, and not a noisy decode
    //     as an earlier note here claimed. The comparison that settles it is xh, whose text writes `kwe +30°C`
    //     with a space and whose two speakers voice NOTHING. Same sign, same sentence, different neighbouring
    //     character, different reading — so the divergence is in the SOURCE ORTHOGRAPHY, not the language.
    //     The `-` is left silent (it is a prefix marker here, and zu's minus arm already requires a digit
    //     directly after the dash, which `-+` does not give).
    s = s.replace(/[  ]?\+[  ]?(?=\d)/gu, " plas ");

    // 9) DEGREES (×2). `°` was dropped and the scale letter read as a CLICK: `+30°C` → [… kǀ], `35°W` →
    //    [… w]. `amazinga` ×5 is the corpus's own degree word (`amazinga okushisa` = degrees of heat), and
    //    the concord `angu-` agrees with it — a class-6 noun THIS rule emits, so the digits may stay
    //    digits. The compass letters take the corpus's own direction words. The leading `+` is consumed
    //    here rather than read — see the PR for why it is a permissible REDUNDANT.
    //
    //    THE SCALE NAME IS ASYMMETRIC, and deliberately. Neither Celsius nor Fahrenheit has a Zulu form in
    //    any source available here, so either would have to stay in its English spelling — but ⟨c⟩ is the
    //    DENTAL CLICK in this orthography, so a retained `Celsius` reads [skǀiˈuːs] and a retained bare `C`
    //    reads [kǀ], which is exactly the confidently-wrong reading this rule exists to remove. Celsius is
    //    also the unmarked scale and the corpus's one instance (`amazinga okushisa angaphezu kuka-+30°C`)
    //    has already said it is a temperature, so `°C` reads as the bare degree phrase. `Fahrenheit`
    //    contains no click letter, is read by the g2p as an ordinary word, and is KEPT — without it `°F`
    //    and `°C` would be indistinguishable. Zero `°F` occur; the branch is pinned in the tests anyway
    //    (trap 8 — probe the adversarial neighbour of every rule).
    //    TRAP 12: THE SENTENCE MAY ALREADY SAY *amazinga*, and the corpus's only °C instance does. Emitting
    //    the noun unconditionally read `amazinga okushisa angaphezu kuka-+30°C` as *amazinga okushisa
    //    angaphezu kuka- AMAZINGA ANGU- amashumi amathathu* — the degree word twice, and two bound concords
    //    in a row (`kuka-` already governs the number). Same shape as Malay's `80% peratus`. So the head is
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

    // 10) RANGES → `kuya ku-` ("going to"), ×6 in the corpus and attested taking a DIGIT operand:
    //     `abantu abangu-8 kuya ku-100`, `ku-US$11,000 kuya ku-US$22,500`, `ka-24 Agasti kuya ku-5`. The
    //     `ku-` is class-17 locative and INVARIANT, which is exactly why it is the right joiner here:
    //     nothing about it has to agree with the value of the digits, so the operands stay digits and
    //     trap 14 cannot arise. ASCENDING ONLY, measured: of the 16 `N-N` shapes, 13 ascending ones are
    //     genuine spans (1469–1539, 1644-1912, 1894-1895, 1418 – 1450, 120-160, 100-200, 35-40, 56-64,
    //     10 -11, 3-5, 2-5, 2-3 ×2) and the 3 non-ascending are the season `1995-96` and the scores
    //     `26 -00` / `5-3` / `7–2`, which read as a juxtaposition rather than a span. `4.2-3.9` (million
    //     years ago) is a real but DESCENDING span and is left alone rather than mis-joined.
    //     DECIMAL ranges first — Hausa's lesson: the plain rule's `(?<![\d.,])` lookbehind blocks a digit
    //     that follows a dot, so a decimal range would never match here and the decimal rules below would
    //     then split both operands and strand the dash with no joiner at all.
    //     BEFORE the decimal rules and BEFORE the unit/rate rules (which then see `40 mph` in
    //     `35 kuya ku-40 mph`). Both operands are re-emitted VERBATIM and both classes END IN A DIGIT, so
    //     a trailing clause comma can never be eaten (trap 14's second hazard).
    const span = (whole: string, a: string, b: string): string =>
        Number(a.replace(/,/gu, "")) < Number(b.replace(/,/gu, "")) ? `${a} kuya ku-${b}` : whole;
    //     A DECIMAL range is joined in EITHER direction, unlike an integer one. The ascending-only guard
    //     exists to keep sports scores and seasons out, and neither is ever written with a decimal point —
    //     so the corpus's one decimal range, the DESCENDING `eminyakeni eyizigidi ezingu-4.2-3.9 edlule`
    //     ("4.2 to 3.9 million years ago"), is a genuine span and is joined. Narrowly widened on one
    //     counted instance rather than on taste (trap 9 in reverse).
    s = s.replace(/(?<![\d.,])(\d+\.\d+)[  ]*[-–—][  ]*(\d+\.\d+)(?![\d.,])/gu, "$1 kuya ku-$2");
    s = s.replace(/(?<![\d.,])(\d[\d,]*\d|\d)[  ]*[-–—][  ]*(\d[\d,]*\d|\d)(?![\d.,])/gu, span);

    // 11) RATE (×7), LOCAL and not the shared tier's. Zulu's rate is a SINGLE agglutinated word —
    //     nga- + ihora → `ngehora`, ×6 in the corpus and always in this slot — while
    //     `makeSymbolNormalizer` emits a rate as four tokens (`num head per denominator`) and requires
    //     both `per` and the denominator word, so a two-token Zulu rate cannot be expressed in
    //     `unitPer`/`rateDenominators` without a stray empty token or splitting `ngehora` across two
    //     slots. Same call Korean (시속, a prefix), Italian (an adjective) and Polish (`na` + accusative)
    //     made; the tier gap is reported, not patched.
    //     `mph`/`kph` are claimed WITHOUT requiring a preceding number: the corpus writes
    //     `ngesivinini sama-kph ayishumi nanye` with the count spelled out AFTER the unit, and neither
    //     string is ever a Zulu word, so there is nothing for an unguarded match to break.
    //     BEFORE the decimal rules (the rate operands are all integers) and before the tier, which would
    //     otherwise claim `km` and strand `/h` as the letter H.
    s = s.replace(/(?<!\d)(\d[\d.,]*)[  ]?(km|mi|m|mm|cm|kg)[  ]*\/[  ]*([hs])(?![\p{L}\p{M}])/giu,
        (_m, n: string, u: string, d: string) => `${n} ${UNIT_WORD[u.toLowerCase()]!} ${PER[d.toLowerCase()]!}`);
    s = s.replace(/(?<![\p{L}\p{M}])mph(?![\p{L}\p{M}])/giu, `${UNIT_WORD["mi"]!} ${PER["h"]!}`);
    s = s.replace(/(?<![\p{L}\p{M}])kph(?![\p{L}\p{M}])/giu, `${UNIT_WORD["km"]!} ${PER["h"]!}`);

    // 12) SQUARE MILES (×3) — `300,948 sq mi`, the imperial gloss beside the corpus's own
    //     `amakhilomitha skwele angu-783,562`. `sq` read as [skǃ], a click. `skwele` ×3 and `amamayela`
    //     ×10 are both corpus tokens, in exactly this postposed order. The `km²`/`km2`/`mm2` exponents
    //     (×3) need no rule here — the shared tier's `exponentWords` produces the same order (see
    //     zulu.ts) — but a squared unit sitting on a DECIMAL does, and step 13 claims it.
    s = s.replace(/(\d[\d.,]*)[  ]?sq[  ]?mi(?![\p{L}\p{M}])/giu, `$1 ${UNIT_WORD["mi"]!} skwele`);

    // 13) DECIMALS (14 real; the dot became a SENTENCE break mid-number, and `.34` was additionally read
    //     as the number "thirty-four"). The fractional digits are spaced so the tokenizer speaks them one
    //     at a time. NO DECIMAL-POINT WORD IS EMITTED — none is attested in the corpus, the epitran
    //     referee's 1,047 words, tone.tsv, or espeak (which has no Zulu at all); a wrong point word is
    //     worse than a missing one. See the header for the rejected `nengxenye` candidate.
    //
    //     THIS IS THE ONLY RULE THAT BREAKS number↔symbol ADJACENCY, so it claims its neighbours itself
    //     (trap 14's second clause). Five instances need it: `$14.7` and `ku-$2.3` have the sign BEFORE,
    //     `12.8 km`, `2.2 km2` and `3.50 m` have the unit AFTER. Ordered currency → unit → plain, longest
    //     context first, so neither neighbour can be stranded once the number stops being a number.
    //     `US$`/`AUD$` are listed here as well as in the tier, for the same shadowing reason.
    //     TRAILING ZEROS ARE STRIPPED from the fraction. `engu-3.50 m` read *…kuthathu kuhlanu IQANDA
    //     amamitha* — Zulu's zero word is `iqanda`, literally "egg", and 3.50 is 3.5, so the digit is not
    //     even informative. An INTERIOR zero is kept (`1.05` → "1 0 5"), and a fraction that is all zeros
    //     cannot reach here: `15.00`/`12,00` are the timezone clocks claimed at step 7.
    const dec = (i: string, f: string): string =>
        [i, ...f.replace(/0+$/u, "")].filter((t) => t !== "").join(" ");
    s = s.replace(/(?<![\p{L}\p{M}])(?:US\$|AUD\$|\$|£)[  ]?(\d+)\.(\d+)(?!\.?\d)/gu,
        (_m, i: string, f: string) => `${dec(i, f)} amadola`);
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)[  ]?(km|mi|mm|cm|kg|ft|m)([²2])?(?![\p{L}\p{M}'’])/giu,
        (_m, i: string, f: string, u: string, exp: string | undefined) =>
            `${dec(i, f)} ${UNIT_WORD[u.toLowerCase()]!}${exp === undefined ? "" : " skwele"}`);
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?!\.?\d)/gu, (_m, i: string, f: string) => dec(i, f));

    // 13b) COMMA-DECIMAL (×1, `izigidi ezingu-1,5`) — Zulu writes both separators. A comma before a
    //      THREE-digit group is thousands and was already de-grouped at step 5, so this claims only a
    //      1–2 digit fraction and cannot swallow a grouping comma. Without it the comma leaks as a clause
    //      pause inside the number.
    s = s.replace(/(?<![\d.,])(\d+),(\d{1,2})(?![\d,])/gu, (_m, i: string, f: string) => dec(i, f));

    // 14) FRACTION (×1, `u-5 mm (1/5 yintshi)`) — read "one five" before. `ingxenye ye<ordinal>` is the
    //     corpus's own fraction shape: `ingxenye yesithathu` ×2, `ingxenye yesine` ×1, of `ingxenye` ×17.
    //     NUMERATOR 1 ONLY, and deliberately: "three fifths" is *izingxenye ezintathu kwezinhlanu*, whose
    //     numerator carries a class-8 concord that would have to be applied to the digits (trap 14) using
    //     concord forms no source in this repo carries. Zero such instances occur; an unclaimed `3/5`
    //     keeps the bare juxtaposition it has today, which is not confidently wrong. AFTER the decimals,
    //     so a date-like `1.5/2` cannot reach here half-rewritten.
    s = s.replace(/(?<![\d/.,])1[  ]?\/[  ]?(\d{1,2})(?![\d/.,])/gu, (m0, d: string) => {
        const ord = ORDINAL_YE[Number(d)];
        return ord === undefined ? m0 : `ingxenye ${ord}`;
    });

    // 14b) MATH SIGNS. Every one of these was DROPPED — `x = y` read [kǁ j], `6 × 6` read the two numbers
    //      with nothing between them — and every reading below is composed from the corpus's own words
    //      rather than a borrowing:
    //        `×`  → `kuphindwe ngo-`  the corpus's OWN multiplication idiom, verbatim: `ingu-36mm ububanzi
    //                                kuphindwe ngo-24mm ubude` (36mm wide multiplied by 24mm long), beside
    //                                `aphindwe kathathu` ×2 and `uphindaphiwe ka-24 mm` ×1
    //        `=`  → `kulingana no-`   the -lingana stem, ×3 (`ukulingana`, `olingana`, `ayelingana`), with
    //                                the `ku-` prefix the corpus uses throughout (`kuhlanganisa` ×6), and
    //                                `no-` ×3 immediately before a digit run
    //        `<`  → `ngaphansi kuka-` `ngaphansi` ×14 + `kuka-` ×14      (`>` is the adversarial neighbour,
    //        `>`  → `ngaphezu kuka-`  `ngaphezu` ×15 + `kuka-` ×14        trap 8: zero instances of either)
    //        `+`  → ` no-`            "and/with", ×3 before a digit run, and the sense of the corpus's own
    //                                `(UTC+1)`. A BARE POSITIVE SIGN has zero corpus instances and this
    //                                leaves it under-specified rather than guessing a borrowing — stated
    //                                as a limit, not a source.
    //        `-`  → `ukukhipha `      "to take out / subtract" ×2, as a PREFIX. Oromo's shape (`hirʔisuu`),
    //                                and the part of speech matters (Fula's `hakkunde`): Zulu subtraction
    //                                takes the subtrahend as an object, so it cannot be an infix.
    //      A TRUE NEGATIVE HAS ZERO CORPUS INSTANCES — both `-\d` hits are the rugby score `26 -00` and the
    //      century range `10 -11` — so the minus rule carries a SECOND lookbehind rejecting a digit plus a
    //      space. Without it the score read *ukukhipha iqanda* ("subtract zero"), which is the confidently
    //      wrong reading, and the range rule has already claimed the other one at step 10.
    s = s.replace(/[  ]?×[  ]?/gu, " kuphindwe ngo-");
    s = s.replace(/[  ]?=[  ]?/gu, " kulingana no-");
    s = s.replace(/[  ]?<[  ]?/gu, " ngaphansi kuka-");
    s = s.replace(/[  ]?>[  ]?/gu, " ngaphezu kuka-");
    // ⚠ `+` IS `plas`, NOT ` no-`, AND THE CORPUS'S OWN AUDIO IS WHY. ` no-` was inferred from the SENSE of
    // `(UTC+1)` ("and/with"), with the comment above stating plainly that a bare positive sign had zero corpus
    // instances and was left under-specified rather than guessing a borrowing. The borrowing did not have to be
    // guessed: it is audible. Decoded with facebook/wav2vec2-xlsr-53-espeak-cv-ft — a PHONEME recognizer, whose
    // vocabulary holds no `+` and no digits, so it cannot echo the orthography back:
    //     5534088546704143284  →  j u t i s i  p l a s  w a n
    // ⚠ ONE SPEAKER OF THREE, and the other two are not counter-evidence but ABSENCE: they skip the whole
    // parenthetical (`…isikhathi sendawo ewhitehall…`), the same reader behaviour seen in ta, en and am. So the
    // count is 1 of 1 among speakers who read the offset at all — thinner than xh's 3 of 3, and recorded as
    // such. `plas` rather than `plus` because the attested vowel is [a] and this orthography is phonemic
    // (`plus` would read pʼlˈuːs); ⚠ the conventional isiZulu spelling of the loan is UNSOURCED.
    // The method was validated on hi, where a text ASR already gave the answer: it reproduced `p l a s e k` /
    // `p l e s w a n` for the offset and no plus phones for the temperature, 4 of 4.
    // ⚠ THE TEMPERATURE POSITION IS NOT DECIDED HERE. zu's one Montevideo recording decodes as
    // `…a ŋ a p e z u ɡ u ɡ a  p l a s o m aɪ n a s  v e d i d i ɡ r i…` — plus phones ARE present, unlike xh's
    // two speakers, but the decode is noisy enough that "plas o mainas" cannot be read as a confident reading.
    // One noisy file is not a source, so this rule claims the sign wherever it precedes a digit and no separate
    // temperature arm is invented.
    s = s.replace(/[  ]?\+[  ]?(?=\d)/gu, " plas ");
    s = s.replace(/(?<![\p{L}\p{Nd}])(?<![\p{L}\p{Nd}][  ])[-−](?=\d)/gu, "ukukhipha ");

    // 15) A SPACED DASH is a parenthetical break and was DROPPED ENTIRELY — 22 clause boundaries with no
    //     pause at all (`ilunga - bona Umfanekiso`, `ezilandelayo — ngokuvamile`, `oyedwa – ubuJuda`).
    //     LAST, so step 10 has already claimed every dash sitting between two numbers: the rugby score
    //     `26 -00` must keep its bare juxtaposition rather than gain a spurious pause.
    s = s.replace(/(?<!\d)[  ]+[-–—]+[  ]+(?!\d)/gu, ", ");

    return s;
}
