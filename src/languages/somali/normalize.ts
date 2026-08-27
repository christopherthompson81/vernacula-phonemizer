/**
 * Somali (so) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * Counts are from the LANGUAGE-FILTERED so.wikipedia dump (`tools/normalization/filter-by-language.py
 * --lang so`, 70,854 paragraphs). ⚠ The filter matters less here than it did for Sundanese — so.wikipedia is
 * 88.5% Somali against su's 75.9% — but it is still applied, because the cheap check is worth more than the
 * assumption and the artifact records it.
 *
 * ⚠ SOMALI WRITES THE ENGLISH CONVENTION, DECISIVELY, and that is the opposite of its Austronesian
 * neighbours in this repo:
 *
 *     comma  + exactly 3 digits   2,381,741   ×3,598     ← thousands
 *     period + exactly 3 digits   2.381       ×190
 *     period + 1-2 digits         0.53        ×3,082     ← decimal
 *     comma  + 1-2 digits         0,53        ×84
 *
 * 19:1 and 37:1. Both separators were CLAUSE PUNCTUATION, so a grouped number came apart into three spoken
 * clauses — `2,381,741` read *laba , saddex boqol iyo kow iyo siddeetan , todoba boqol…*.
 *
 * ⚠ THE BIGGEST SINGLE CLASS IN THE CORPUS IS ALREADY CORRECT AND IS DELIBERATELY UNTOUCHED (playbook trap
 * 16 — check whether the seam exists). Somali attaches bound morphology to a numeral with a hyphen, ×7,498:
 *
 *     -kii ×3,023 · -aad ×1,436 · -meeyadii ×800 · -dii ×547 · -ka ×440 · -tii ×230
 *
 * `2010-kii` already reads *laba kun iyo toban kii* — the engine's TOKEN splits on the hyphen and both halves
 * are ordinary Somali. A rule here would have to re-join them and would gain nothing. Same for `1aad` →
 * *kow aad*, the ordinal.
 *
 * ⚠ AND SOMALI ⟨c⟩ IS /ʕ/, WHICH IS WHY THE LATIN ABBREVIATIONS ARE NOT MERELY UNREAD BUT AUDIBLY WRONG.
 * `CE` read as *ʕe*, `BC` as *bʕ*, `°C` as *ʕ* — the g2p is correct to do that, since ⟨c⟩ is a real Somali
 * consonant; it is the abbreviations that have to be spent before they reach it.
 *
 * ── THE RAW-LATIN PASS: 18 HITS, AND THE ENGLISH SPELLINGS OF THINGS SOMALI ALREADY WRITES ─────────────
 *
 * `rawLatinIn` reports an ASCII run with no vowel that the source typed and the IPA still says verbatim.
 * With ⟨c⟩ = /ʕ/ these were audible, not silent: `sq mi` reached the IPA as *sq mi*, `48th` as *afartan th*.
 * Step 3b spends four of the five populations, and each one is a different mechanism:
 *
 *   `sq ×7`, `cu ×1`   the ENGLISH measure words, standing between the number and the unit — so they cost
 *                      TWO readings each, since `mi` (declared `mayl`) lost its digit adjacency too.
 *   `th ×2`            the English ordinal tail, in a corpus whose own ordinal suffix is `-aad` ×1,436 —
 *                      and one of the two sentences writes BOTH (`33aad meridian bari iyo 48th meridian`).
 *   `km ×3`            six occurrences over three lines, and no two are the same shape: a spaced exponent
 *                      (`91 km 2`), a bare rate (`26,800/km 2`), the connective spelled out (`1,200 qof
 *                      halkii km2`) and a hyphen-attached unit (`750-km`). ⚠ The first of those was not a
 *                      leak at all but a MIS-READING — *kiiloomitir 2*, a number the source never said.
 *   `mph ×1`           spelled as the rate it abbreviates, out of words this file already sourced.
 *
 * ── AND THE SIX LEFT REPORTED ──────────────────────────────────────────────────────────────────────────
 *
 *   `ft ×3`, `sq ×1`   ⚠ THE IMPERIAL FOOT, AND IT IS REFUSED RATHER THAN GUESSED. `4 ft 8+1⁄2 in`, `cu
 *                      ft`, `430 sq ft` — and because `sq`/`cu` are only spent BEFORE A DECLARED UNIT, one
 *                      `sq` stays with its `ft` instead of half the phrase being read. No Somali foot is
 *                      attested in a corpus that has no `kiilogaram` either (see `SYMBOLS`), and half a
 *                      reading is the thing the shared tier refuses on principle.
 *   `pm ×1`            a clock in the English convention — `saacaddu marka ay ahayd 8:28PM … 10:50 pm`.
 *                      Step 3 reads the TIME; the meridiem word is unsourced and stays visible.
 *   `ps ×1`            ⚠ NOT A DEFECT — Greek `ὤψ` transliterated `ōps` in an etymology. The ⟨ō⟩ is not
 *                      ASCII, so a plain-ASCII run falls out of the middle of the word. The same shape as
 *                      Igbo `ndị` → `nd`, and the detector's documented false-positive population.
 */
import { isBareUnitKey, makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/**
 * THE UNIT TABLE, named once so the tier and the four local rules in step 3b cannot disagree about which
 * keys exist. ⚠ `kg` IS ABSENT ON PURPOSE — see the note above `SYMBOLS`.
 */
const UNIT = { km: "kiiloomitir", m: "mitir", cm: "sentimitir", mm: "milimitir", ha: "hektar", mi: "mayl" } as const;
/** The measure words, so step 3b-vi reads a bare exponent with the same words the tier uses. */
const EXPONENT = { "\u00b2": "laba jibaaran", "\u00b3": "cubo", 2: "laba jibaaran", 3: "cubo" } as const;
/** Any declared key, longest first so `km` cannot be matched as `m`. */
const UNIT_KEYS = Object.keys(UNIT).sort((a, b) => b.length - a.length).join("|");
/**
 * The keys safe to read with NO NUMBER ATTACHED — `isBareUnitKey`'s test, applied to this language's own
 * table rather than restated. It excludes the one-letter `m` and the vowel-carrying `mi`/`ha`, which are
 * ordinary Somali material (`ha` is the corpus's own particle, *si kastaba ha ahaatee*).
 */
const BARE_KEYS = Object.keys(UNIT).filter(isBareUnitKey).sort((a, b) => b.length - a.length).join("|");

/**
 * The shared symbol tier. Somali marks number on the noun but the measure words below are used in their
 * citation form after a numeral throughout the corpus, so each CountForms is a single entry.
 *
 * Sourced by whole-word count on the filtered corpus (playbook 5e):
 *   boqolkiiba ×499 · kiiloomitir ×403 · mitir ×780 · hektar ×134 · doolar ×102 · shilin ×78 ·
 *   iyo ×76,283 · laba jibaaran ×123 (the SQUARE, literally "two multiplied": `kiiloomitir laba jibaaran`)
 *
 * ⚠ `%` FOLLOWS ITS NUMBER, on a split the corpus itself makes: `N boqolkiiba` ×251 against `boqolkiiba N`
 * ×163. Both orders are real Somali; the tier's default (suffix) is the commoner one.
 * ⚠ NO `kg`: the abbreviation occurs ×51 and no Somali word for it is attested — `kiilo` ×143 outside
 * `kiiloomitir` is the loose "kilo", never a declared unit, and `kiilogaram` is absent. Left unread rather
 * than invented, and it is the one unit slot this corpus cannot fill.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["boqolkiiba"],
    currency: { $: ["doolar"], "US$": ["doolar Maraykanka"], "€": ["yuuro"], "Sh.So.": ["shilin Soomaali"] },
    // milyan ×1,506 · bilyan ×519 · malyan ×36 · tirilyan ×2 · kun ×1,355. ⚠ `balyan` was in this list and
    // scores ZERO — dropped. A magnitude that is not written cannot strand a currency noun.
    magnitudes: ["kun", "malyan", "milyan", "bilyan", "tirilyan"],
    /** ⚠ From the ONE table above, so a key added there is covered by step 3b's rules without a second edit. */
    units: Object.fromEntries(Object.entries(UNIT).map(([k, w]) => [k, [w]])),
    // ⚠ `cubo` FOR THE CUBE, NOT `saddex jibaaran`. The parallel form to `laba jibaaran` is what the pattern
    // suggests and it scores ZERO in 70,854 paragraphs; `cubo` ×4 is what the corpus actually writes, and it
    // writes it in exactly this frame — `11.548 Sentimitir cubo cm³`. Caught by auditing every declared word
    // against the corpus rather than trusting the symmetry.
    exponentWords: { squared: ["laba jibaaran"], cubed: ["cubo"] },
    unitPer: "halkii",
    rateDenominators: { s: "ilbiriqsi", h: "saacad" },
    ampersand: "iyo",
    multiply: { times: "ku dhufan" },
});

/** Compass points for the COORDINATE sense of `°`, keyed lowercase because the rule matches case-insensitively. */
const COMPASS: Readonly<Record<string, string>> = {
    n: "waqooyi", s: "koonfur", e: "bari", w: "galbeed",
};

/** Every rule emits DIGITS where a number is involved and lets the engine's own number path speak them. */
export function normalizeSomali(input: string): string {
    let s = input;

    // ── 1. DE-GROUP THOUSANDS — FIRST, and the most destructive defect this layer repairs ───────────────
    // ×3,598 comma + ×190 period. `.`/`,` are both clause punctuation and the TOKEN splits on `\d+`, so a
    // grouping separator became a PAUSE and the value came apart: `2,381,741 kiiloomitir` was spoken as three
    // clauses. ⚠ EXACTLY THREE DIGITS PER GROUP, REPEATED, is the disambiguation — `0.53` (two) and `2.5`
    // (one) are decimals and must survive untouched. The trailing guard rejects only a following DIGIT, so a
    // group followed by the decimal separator (`1,234.56`, ×49) still de-groups.
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2}(?:,\d{3})+)(?!\d)/gu, (m) => m.replaceAll(",", ""));
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2}(?:\.\d{3})+)(?!\d)/gu, (m) => m.replaceAll(".", ""));

    // ── 2. THE GLUED CALENDAR LETTERS — BEFORE the tier, which would otherwise strand the `M` ──────────
    // ⚠ ORDER IS LOAD-BEARING HERE AND THE PROBE FOUND IT: with this after the shared tier, `$2M` had its
    // `$2` claimed as currency first, leaving an orphan `M` to glue onto the noun — *laba doolarM*. Spent
    // here, the tier sees `$2 milyan` and hops the magnitude correctly.
    // ⚠ THE GLUED CALENDAR LETTERS, ×567 + ×25, and they are the largest era class in the language — bigger
    // than every spaced marker combined. A Hijri year is written `728H`, `1332H`, and (×305) as a TWO-DIGIT
    // early-Islamic year, `sanadkii 18H`, `bishii Safar 12H`. All of them read as a stray letter h.
    s = s.replace(/(?<![\p{L}\p{M}])(\d+)H(?![\p{L}\p{M}])/gu, "$1 Hijri");
    // ⚠ `M` IS SPLIT BY DIGIT COUNT AND THAT SPLIT IS LOAD-BEARING: three or four digits is the MIILAADI year
    // (`1999M`, `766M`, ×25), one or two is MILLION (`$2M`, `8M oo higtar`, `1M oo ay beeraty`, ×21). Reading
    // the short form as an era would date a sum of money to the year 2; reading the long form as a magnitude
    // would make the year 1999 into 1,999 million. Counted before either rule was written.
    // ⚠ AND THE LONG FORM ADDITIONALLY NEEDS A YEAR CONTEXT, which the corpus diff's adversarial probe forced
    // and the corpus then confirmed. `\d{3,4}M` is ×25 here and TWO of them are not years at all:
    // `Diyaaradda Tu-154M` is a Tupolev airliner, and `badda kasareysa 2,407M` is 2,407 METRES. Requiring a
    // year word, a Hijri year or an `=` within the preceding 45 characters fires on 23 of 25 and excludes
    // exactly those two — measured, not guessed. (The tier cannot rescue the metres case: its unit keys are
    // case-SENSITIVE, so `2407m` reads as mitir but `2407M` does not.)
    // The SHORT form needs no such gate: one or two digits before `M` is the million idiom (`$2M`, `8M`).
    s = s.replace(/(?<![\p{L}\p{M}])(\d+)M(?![\p{L}\p{M}])/gu, (whole, n: string, off: number, src: string) => {
        if (n.length < 3) return `${n} milyan`;
        // ⚠ `Hijri`, not `\d+H` — the H arm above has ALREADY run and rewritten `150H/766M` to
        // `150 Hijri/766M`, so a check for the raw form silently fails on exactly the calendar-pair frame
        // this context test exists to recognise.
        return /[Ss]anad|[Bb]ish|[Qq]arni|Hijri|=/u.test(src.slice(Math.max(0, off - 45), off))
            ? `${n} Miilaadi`
            : whole;
    });

    // ── 3. CLOCK — BEFORE the decimal rule, which would otherwise claim `2:00` and `8:15` ───────────────
    // ×288 (`9:00 Subaxnimo`, `8:15 PM`, `12:25`). The colon is clause punctuation, so the time read as two
    // numbers with a pause between them. `saacaddu waa` ("the hour is") is the corpus's frame; the minutes
    // are joined with `iyo` ("and"), which is how Somali builds every compound numeral and needs no separate
    // sourcing — it is the same ×76,283 conjunction the ampersand rule spends.
    // ⚠ ON THE HOUR THE MINUTES DROP OUT, as in every language treated so far.
    // ⚠ THREE GUARDS, AND THE COLON CHAIN IS THE ONE THAT MATTERS. `h:mm` is a clock only when nothing
    //   further is chained onto it, and this corpus writes four things that are NOT clocks:
    //     `NPK 19:19:19` ×2   a fertiliser ratio, read as *19 iyo 19* with a stray `:19` left as a PAUSE
    //     `2:15:16`           an Olympic time, read as *2 iyo 15* + `:16`
    //     `(12:00:00) GMT`    h:m:s, truncated to *12*
    //     `2019-02-07T23:28:34+04:00`  an ISO 8601 stamp, read as *23 iyo 28* + `:34` + *ku dar 4*
    //   `(?!:\d)` declines all four. It does NOT touch `13:25: 13:35`, two real clocks separated by a
    //   colon and a SPACE, which still read — the guard is a colon followed by a DIGIT.
    // ⚠ AND THE TIMEZONE OFFSET IS LEFT TO THE CLOCK RULE ON PURPOSE — I tried excluding it and it was a
    //   REGRESSION. `UTC+04:00` reads *UTC ku dar 4*, and that is the correct reading of an offset: the `+`
    //   rule says "plus", the clock rule turns `04:00` into the bare hour, and "UTC plus four" is exactly
    //   what the string means. Adding `+` to the lookbehind produced *UTC ku dar 04:00*, leaving a raw
    //   colon to become a clause PAUSE. A rule getting the right answer by an unintended route is still
    //   the right answer, and the measurement is what said so.
    // ⚠ AND THE GLUED MERIDIEM, which is what the header above promised and did not deliver: JS `\b` is
    //   ASCII-`\w`-based, so `8:28PM` has no boundary between `8` and `P` and the whole match FAILED —
    //   the time was not read at all, the opposite of the documented "reads the TIME, leaves the meridiem
    //   visible". The alternation lets a meridiem satisfy the boundary; the meridiem itself is still left
    //   for the reader, unsourced, exactly as the header says.
    s = s.replace(/(?<![\d.:])([01]?\d|2[0-3]):([0-5]\d)(?!:\d)(?!\.?\d)(?:(?=\s?[AaPp]\.?[Mm]\.?)|\b)/gu,
        (_m, h: string, min: string) => (Number(min) === 0 ? `${Number(h)}` : `${Number(h)} iyo ${Number(min)}`));

    // ── 3b. THE ENGLISH SPELLINGS OF THINGS SOMALI ALREADY WRITES ITS OWN WAY ──────────────────────────
    //
    // Four shapes, all of them found by `rawLatinIn` and none of them visible to any earlier gate, because
    // in a Latin-script language an ASCII run looks exactly like a word. ⚠ AND SOMALI ⟨c⟩ IS /ʕ/, so these
    // were not silence: `sq` reached the IPA as *sq* and `48th` as *afartan th*.
    //
    // 3b-i. THE ORDINAL TAIL. ×2, and the corpus settles it INSIDE ONE OF THE TWO SENTENCES: *"longitudes
    //       33aad meridian bari iyo 48th meridian bari"* writes the Somali ordinal and the English one in
    //       the same clause, about the same kind of thing. `-aad` is this corpus's ordinal suffix ×1,436
    //       (header), and the engine already reads `1aad` as *kow aad* with no rule at all — so the
    //       rewrite hands the result to a path that is known to work rather than inventing a reading.
    s = s.replace(/(?<![\p{L}\p{M}])(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])/giu, "$1aad");

    // 3b-ii. THE BARE RATE — `26,800/km 2`, `69,000/sq mi`, `610 deggane/sq mi`. A slash with a unit after
    //       it and NO unit before it, so the tier's rate branch has nothing to key on. `halkii` is the same
    //       connective already declared as `unitPer` above, and the corpus writes it out in exactly this
    //       frame one clause later — *"1,200 qof halkii km2"*. ⚠ FIRST of the four, because every rule
    //       below rewrites the very text this one's lookahead is reading.
    s = s.replace(
        new RegExp(String.raw`(?<=[\d\p{L}])\s*/\s*(?=(?:sq |cu )?(?:${UNIT_KEYS})(?:[²³23])?(?![\p{L}\p{M}\d]))`, "gu"),
        " halkii ",
    );

    // 3b-iii. THE EXPONENT WRITTEN WITH A SPACE — `91 km 2`, `26,800/km 2`. ⚠ THIS ONE IS A MIS-READING AND
    //       NOT A LEAK, which is why it needs saying: the tier read `91 km 2` as *kiiloomitir 2* — the
    //       kilometre correctly and then a stray "two" — so the utterance gained a number the source never
    //       said. Joined only against a DECLARED unit and only when no digit follows, so a range or a
    //       citation cannot be swallowed.
    s = s.replace(new RegExp(String.raw`(?<![\p{L}\p{M}])(${UNIT_KEYS})\s+([23])(?![\d\p{L}\p{M}])`, "gu"), "$1$2");

    // 3b-iv. `sq` AND `cu` — the ENGLISH measure words, ×7 and ×1, and every one of them is an imperial
    //       parenthetical beside a metric figure the sentence has already given in Somali: *"1,104,300
    //       kiiloomitir laba jibaaran (426,372.61 sq mi)"*. ⚠ THE COST OF LEAVING THEM IS NOT ONE LEAK BUT
    //       TWO READINGS: `sq` stands BETWEEN the number and the unit, so it also breaks the digit
    //       adjacency the tier's unit path requires, and `mi` — declared as `mayl` and read correctly
    //       everywhere else — went unread in all six of these.
    //       ⚠ IT EMITS THE WORDS RATHER THAN A SUPERSCRIPT, and the first version did the opposite. Turning
    //       `sq mi` into `mi²` is neat where a digit precedes and WRONG where one does not: `610
    //       deggane/sq mi` has a word in front, so the tier's digit-adjacent path declines and a `²` this
    //       layer INVENTED reaches the phoneme sink as a RAWMARK — trading a reported leak for an
    //       unreported one. Somali's measure words take no count agreement, so writing them here costs
    //       nothing the tier would have done differently.
    //       ⚠ ONLY BEFORE A DECLARED UNIT: `sq ft` stays raw, because Somali has no foot and half a
    //       reading is worse than a visible leak — the same rule the shared tier applies to rates.
    //       ⚠ BOTH CAPTURES ARE CASE-FOLDED BEFORE THE LOOKUP, and the unit one was not: this rule is the
    //       only arm in step 3b carrying the `i` flag, so `SQ MI` matched and then indexed `UNIT` with
    //       `"MI"`, which is not a key — the template stringified `undefined` and the LITERAL WORD reached
    //       the phoneme sink as *ʔundefined*, a leak strictly worse than the one the rule removes. Folding
    //       here does not weaken the tier's case-SENSITIVE unit keys (the note above `M`, step 2): what
    //       makes `2407M` ambiguous is a bare magnitude letter after a digit, and an `M` preceded by
    //       `sq `/`cu ` is the English measure frame and nothing else.
    s = s.replace(
        new RegExp(String.raw`(?<![\p{L}\p{M}])(sq|cu)\s+(${UNIT_KEYS})(?![\p{L}\p{M}\d])`, "giu"),
        (_m, mod: string, u: string) =>
            `${UNIT[u.toLowerCase() as keyof typeof UNIT]} ${mod.toLowerCase() === "sq" ? EXPONENT[2] : EXPONENT[3]}`,
    );

    // 3b-v. `mph` ×1 — spelled as the rate it abbreviates, so the tier reads it with words this file has
    //       ALREADY sourced (`mi` → mayl, `h` → saacad, `unitPer` → halkii). Nothing new is claimed about
    //       Somali; what is claimed is what `mph` stands for.
    s = s.replace(/(?<![\p{L}\p{M}])(\d)\s*mph(?![\p{L}\p{M}])/gu, "$1 mi/h");

    // 3b-vi. A BARE UNIT CARRYING AN EXPONENT — what 3b-ii and 3b-iii leave behind, and what the SHARED
    //       bare-unit pass refuses on purpose: `makeBareUnitNormalizer` declines before a `²` because
    //       "reading the unit and leaving a stray 2 behind is worse than the visible leak". That reason is
    //       about a language which may not have a measure word; Somali has BOTH (`laba jibaaran` ×123,
    //       `cubo` ×4, sourced above), so the whole phrase is read and nothing is stranded. The corpus
    //       writes this shape with its own connective spelled out — *"1,200 qof halkii km2"* — and after
    //       3b-ii the rate frames land here too (*"26,800 halkii km2"*).
    //       ⚠ ONLY THE VOWEL-LESS MULTI-LETTER KEYS, via `isBareUnitKey`: a bare `m` or `ha` is ordinary
    //       Somali, and that is the same test the shared pass applies for the same reason.
    s = s.replace(
        new RegExp(String.raw`(?<![\p{L}\p{M}\p{Nd}'’ʼ-])(${BARE_KEYS})([²³23])(?![\p{L}\p{M}\d])`, "gu"),
        (_m, u: string, e: string) => `${UNIT[u as keyof typeof UNIT]} ${EXPONENT[e as keyof typeof EXPONENT]}`,
    );

    // 3b-vii. THE HYPHEN-ATTACHED UNIT — `750-km (470 mi)`. Somali's commonest pattern is a hyphen joining
    //       a numeral to BOUND MORPHOLOGY (`2010-kii` ×3,023, header), so the hyphen itself proves nothing;
    //       what separates this from that class is that the thing after it is a DECLARED UNIT KEY, which
    //       is not a Somali suffix. Restoring the space hands it to the tier's ordinary digit-adjacent path.
    s = s.replace(new RegExp(String.raw`(\d)-(?=(?:${UNIT_KEYS})(?:[²³23])?(?![\p{L}\p{M}\d]))`, "gu"), "$1 ");

    // ── 4. THE SHARED TIER — percent, currency, units, rates, exponents, `&`, `×` ───────────────────────
    // ⚠ BEFORE THE DECIMAL RULE ("units before decimals", the playbook's own coupling): the tier matches a
    // unit or a sign only when a NUMBER is adjacent, and rewriting `84.3` to `84 dhibic 3` destroys that
    // adjacency — `84.3 boqolkiiba` would put the percent word after the fraction instead of after the
    // number. AFTER de-grouping, or the tier sees `2,381,741 km` as `741 km`.
    s = SYMBOLS(s);

    // ── 5. DECIMALS → `dhibic` ─────────────────────────────────────────────────────────────────────────
    // ×3,082 period + ×84 comma, every one previously a clause pause mid-number.
    //
    // ⚠⚠ THE WORD IS AN INFERENCE FROM SENSE, NOT AN ATTESTATION OF THE READING, and it is labelled as one.
    // `dhibic` occurs ×40 in the corpus and ×21 across 20 Wikipedia articles (attest.ts), and EVERY instance
    // is the word meaning POINT/DOT in some other sense — the northernmost point of Africa, the freezing
    // point, a deep point cut into rock. Not one is a decimal separator. Nothing else is closer: `nuqte` and
    // `meeldhibic` are absent outright, `faaruq` means "empty", and the ×46 `point` hits are English text
    // inside the Somali wiki. espeak ships no Somali dictionary at all and the kaikki referee is 233 words.
    //
    // It ships anyway, for the reason the Wu, Jin, Xiang, Madurese and Lingala layers ship theirs: **a
    // written corpus is the weakest evidence there is about how a SYMBOL is spoken** — writers type `0.53`
    // and never spell out how they would say it, so the word can be in universal spoken use and score zero
    // (the Igbo `ǹtụ̀kpọ` lesson, playbook §"corpus silence is not a refusal"). What IS established is that
    // `dhibic` is the Somali word for a point or dot. The alternative is 3,082 decimals read with a clause
    // break where the point was.
    // ⚠ The fractional part is read DIGIT BY DIGIT, which is what a decimal is; the integer part keeps the
    // engine's ordinary cardinal composition.
    s = s.replace(/(\d)[.,](\d{1,2})(?![\d.,])/gu, (_m, a: string, b: string) => `${a} dhibic ${[...b].join(" ")}`);

    // ── 6. ERA MARKERS ─────────────────────────────────────────────────────────────────────────────────
    // ⚠ `C.H.` IS SOMALI'S OWN AND THE CORPUS GLOSSES IT: `1391 ilaa 1271 C.H (Ciise Hortiis)` — "before
    // Christ", spelled out in the same sentence. ×121, and it read as *ʕ . h .*: two letters and two clause
    // pauses. The Latin era letters ×454 are the borrowed set, and they are worse than unread because ⟨c⟩ is
    // /ʕ/ — `BC` was *bʕ*. `Miilaadi` ×47 is the corpus's word for the Christian era, `Hijri` ×61 for the
    // Islamic one.
    // ⚠ LONGEST FIRST, and BCE before BC or the `E` is stranded.
    s = s.replace(/(\d)\s*C\.?\s?H\.?(?![\p{L}\p{M}])/gu, "$1 Ciise Hortiis");
    // ⚠ AND ITS COUNTERPART `C.D` ×213 — "Ciise Dabadiis", after Christ — which the first draft missed
    // entirely because the probe list was built from `C.H.` and never asked what the OTHER direction was.
    // Glossed in the corpus the same way (`Ciise Dabadiis` ×2) and written both spaced and glued
    // (`70 C.D. Rooma`, `900 – 1870 CD`). ⚠ THE LEADING DIGIT IS WHAT KEEPS IT OFF `CD-yada iyo Internetka`
    // — compact discs, in the same corpus.
    s = s.replace(/(\d)\s*C\.?\s?D\.?(?![\p{L}\p{M}])/gu, "$1 Ciise Dabadiis");
    s = s.replace(/(\d)\s*(?:BCE|BC)(?![\p{L}\p{M}])/gu, "$1 Ciise Hortiis");
    s = s.replace(/(\d)\s*(?:CE|AD)(?![\p{L}\p{M}])/gu, "$1 Miilaadi");
    s = s.replace(/(\d)\s*AH(?![\p{L}\p{M}])/gu, "$1 Hijri");
    // ── 7. RANGES → `ilaa` ("up to") ───────────────────────────────────────────────────────────────────
    // ×2,690, and `ilaa` is one of the commonest words in the language (×11,059) in exactly this sense
    // (`1391 ilaa 1271`, `27 ilaa 39 boqolkiiba`). The hyphen was dropped, leaving two numbers abutting.
    // ⚠ THE TWO GUARDS THE SUNDANESE RUN PAID FOR, carried over rather than re-earned: do not double a
    // connective the text already wrote (`ilaa`/`inta u dhaxaysay`), and do not claim a HYPHEN CHAIN, which
    // is an identifier rather than a span. ⚠ AND A THIRD, SPECIFIC TO SOMALI AND THE REASON THIS RULE IS
    // ORDERED HERE: the bound-suffix form `2010-kii` is a hyphen between a number and a WORD, so the
    // digits-both-sides requirement is what keeps this rule off the language's single commonest pattern.
    // ⚠ THE TRAILING GUARD DOES NOT REJECT A `.`. A sentence period is not part of a number, so `(?![\d.,-])`
    // declined every range that ENDS A CLAUSE — `Sanadihii 2012-2013.`, `19-30.`, `2010-2012.` — and each one
    // came back as two juxtaposed cardinals. Reported by `review.ts`'s `clause-final` check. The dot is not
    // protecting an ordinal either: a fleet-wide comparison of the numeral WORD for `5` against `5.` over the
    // 47 languages whose range rule declined a clause-final dot found ZERO ordinal readings, and Somali's own
    // ordinal is the bound `-aad` ×1,436. ⚠ ONE OF THE FOUR GAINS IS NOT A CLAUSE-FINAL CASE AT ALL BUT A
    // SIGN FIX: `Sanadihii 1960 -1969.` was falling through to the signed-number rule and reading *1960 LAGA
    // JARAY 1969* — "1960 minus 1969" — precisely because the range rule had declined it. The span rule
    // claiming it first is what removes the subtraction.
    // ⚠ AND THE `,` STAYS, REFUSED ON MEASUREMENT rather than kept by default. Dropping it gains 7 more
    // segments, but TWO of them are TRUNCATED SECOND ENDPOINTS: `1654-57,` → *1654 ilaa 57* and `1620-21,` →
    // *1620 ilaa 21*. This rule has no ascending-only test — it cannot have one, since Somali year spans and
    // percentages both run in either direction — so unlike its sn/ee/nya siblings it has nothing that
    // declines a truncated endpoint, and the comma is doing that work by accident. Trading 5 real gains for 2
    // confidently wrong readings replacing silent ones is the wrong trade; the `.` arm above is clean at 4/4.
    s = s.replace(
        /(?<!\b(?:ilaa|dhaxaysay|inta)\s)(?<![\d.,\p{L}-])(\d+)\s?[-–]\s?(\d+)(?![\d,-])/gu,
        "$1 ilaa $2",
    );

    // ── 8. FRACTIONS ───────────────────────────────────────────────────────────────────────────────────
    // ×235. `1/2` read as *kow laba* — the slash dropped, two bare numbers. `nus` ("half") ×149 and `rubuc`
    // ("quarter") ×74 are the corpus's own words for the two that have one; everything else composes with
    // `meelood` ("parts"), the ordinary Somali fraction frame.
    s = s.replace(/(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (_m, a: string, b: string) => {
        const [n, d] = [Number(a), Number(b)];
        if (n === 1 && d === 2) return "nus";
        if (n === 1 && d === 4) return "rubuc";
        return `${a} ${b} meelood`;
    });

    // ── 9. DEGREES ─────────────────────────────────────────────────────────────────────────────────────
    // `°` ×664 dropped outright; `°C` additionally read the C as /ʕ/. `darajo` ×105, and the corpus writes
    // the full phrase — `5 darajo Celsius` — which is where both words come from.
    // ⚠ THE GUARD IS `(?![\\p{L}\\p{M}])`, NOT `\\b`. JS defines `\\b` on ASCII `\\w`, so a following
    // NON-ASCII letter counts as a boundary and this rule fired when it must not: `25°Cölner` ate the ⟨C⟩
    // as Celsius and left "ölner" behind. Invisible to any ASCII fixture, and this language's own
    // orthography is what supplies the accented letter. 71 other engines already guard it this way.
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/giu, "$1 darajo Celsius");
    s = s.replace(/(\d)\s?°\s?F(?![\p{L}\p{M}])/giu, "$1 darajo Fahrenheit");
    s = s.replace(/(\d)\s?°\s?([NSEW])(?![\p{L}\p{M}])/giu,
        (m, d: string, dir: string) => {
            // ⚠ REFUSE THE WHOLE MATCH ON AN UNKNOWN DIRECTION (#1122). The pattern carries `i` AND `u`, so
            // JS folds U+017F LONG S onto `s` and `12°ſ` MATCHES `[NSEW]` — while `ſ` is not a COMPASS key.
            // The `!` that used to be here asserted non-null on `undefined`, and `String.replace` stringified
            // it, so the reading carried the literal word: *laba ijo toban darad͡ʒo undefined*.
            const word = COMPASS[dir.toLowerCase()];
            return word === undefined ? m : `${d} darajo ${word}`;
        });
    s = s.replace(/(\d)\s?°/gu, "$1 darajo");

    // ── 10. SIGNS ───────────────────────────────────────────────────────────────────────────────────────
    // Sourced from the filtered corpus: `ka badan` ×2,109 ("more than"), `ka yar` ×561 ("less than"),
    // `ku dar` ×439 ("add"), `laga jaray` ×17 ("subtracted"), `u dhiganta` ×214 ("equivalent to").
    // ⚠ PLUS BEFORE MINUS, the coupling the Sundanese run found: run the other way, the minus arm claims the
    // bracketed operand of `5 + (−3)` and the `+` is dropped, silently turning a sum into a difference.
    s = s.replace(/(\S)\+\s?(\(?\s?[-−]?\d)/gu, "$1 ku dar $2");
    s = s.replace(/(^|\s)\+\s?(\(?\s?[-−]?\d)/gu, "$1ku dar $2");
    s = s.replace(/(^|[\s(])[-−–](\d)/gu, "$1laga jaray $2");
    // ⚠ `±` IS ONE CHARACTER (U+00B1) and no `+` rule can match inside it — ×22, and it needs its own arm.
    s = s.replace(/±/gu, " ku dar ama laga jaray ");
    s = s.replace(/\s?=\s?/gu, " u dhiganta ");
    s = s.replace(/\s?<\s?/gu, " ka yar ");
    s = s.replace(/\s?>\s?/gu, " ka badan ");
    s = s.replace(/\s?÷\s?/gu, " loo qeybiyay ");

    return s;
}
