/**
 * Madurese (mad) text normalization — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the Latin → IPA pipeline already speaks. Pure text→text, no IPA.
 *
 * ⚠ THE EVIDENCE. `tools/corpus/mined/mad.jsonc` (mad.wikipedia pages-articles dump, 37,821 paragraph
 * segments, 31/35 cells). Corpus-wide counts from its header: decimals 1,541 · ranges 3,606 · grouped 973 ·
 * percent 367 · units 580 · exponent 241 · clock 195 · currency 124 · degrees 93 · signed-number 64 ·
 * arithmetic 56 · era-marker 30. Every reading below is sourced from that corpus or from mad.wikipedia via
 * `tools/normalization/attest.ts`, and the citation sits at the declaration.
 *
 * ⚠ MADURESE WRITES BOTH SEPARATOR CONVENTIONS, and this layer is built around telling them apart. The
 * Indonesian/Dutch convention dominates (a period GROUPS thousands, a comma marks the DECIMAL) and the wiki
 * also carries English-format imports — sometimes in the same article. Tabulated over the artifact's 437
 * lines:
 *
 *     period + exactly 3 digits   2.093 · 5.168 · 2.150.000        ×79   thousands, dominant
 *     comma  + exactly 3 digits   676,578 · 54,806,012 · 22,966    ×10   thousands, English
 *     comma  + 1–2 digits         1,6 · 62,63 · 16,09 · 35,29      ×55   DECIMAL, dominant
 *     period + 1–2 digits         39.33% · 4.5 · 1.6m              ×16   DECIMAL, English
 *
 * The campaign-finance article writes `Rp 16.31 milyad` and `Rp 16,09 milyad` two sentences apart, which is
 * the proof that the SEPARATOR alone cannot decide: the DIGIT COUNT does. Exactly three digits after a
 * separator is a grouping; one to three otherwise is a decimal.
 * ⚠ AND ONE MEASURED EXCEPTION MAKES THE COMMA ARM SAFE: a thousands group never begins with a bare `0`.
 * The corpus's `0,001%` (the share of Earth's water held as atmospheric vapour) is a three-place DECIMAL
 * with the same shape as `652,000 km²`, and `(?!0,)` is the whole discrimination. Without it that value
 * read as one thousand.
 * ⚠ AND `1.857,530 km²` (Sumenep's land area) IS A THREE-PLACE DECIMAL TOO, saved by the lookbehind
 * instead: the period arm consumes `1.857` first, after which the comma arm's `(?<![\d.,])` refuses to
 * start inside the remaining digits. That is why the fraction below is `\d{1,3}` and not `\d{1,2}` —
 * de-grouping has already spent every real thousands group by the time the decimal rule runs.
 *
 * ⚠ `\b` IS NEVER USED. It is ASCII-defined and Madurese writes ⟨â è é ò ḍ ṭ⟩ plus the glottal ⟨'⟩/⟨’⟩, so
 * a boundary test against them silently fails (playbook trap 1). Every boundary here is an explicit
 * lookaround over `[\p{L}\p{M}]`.
 *
 * ⚠ TWO SEAMS ALREADY WORK AND ARE DELIBERATELY UNTOUCHED (playbook trap 16 — check before you build):
 *   · THE ORDINAL. `abad ka-20` already reads *abɤt ka duwɤ pɔlɔ*, because ⟨ka-⟩ is an ordinary Madurese
 *     word and the hyphen falls out of the token class. The SPACED variants the corpus also writes —
 *     `Perdana Mantrè Indonesia ka -8`, `abad sè kapèng -20` — read the same way. `ordinal-latin` is 4,496
 *     corpus-wide and needs no rule at all.
 *   · ROMAN NUMERALS. `Olimpiade XXIX` is already digits by the time this runs: `core/roman.ts` is applied
 *     in `registry.ts`, wrapping `text()`, and `mad` is not in `ROMAN_NATIVE`.
 *
 * ⚠ FOUR CLASSES ARE DELIBERATELY LEFT UNREAD, each with its measurement. A dropped sign is visible to
 * `mine.ts scan`; a guessed word is not (the Fula `tere` lesson), so silence is the better failure here.
 *
 *   1. THE MINUS. Six sign-leading hyphens in the artifact and only TWO are negatives (`0, 1, -1, 2, - 2`
 *      in the integers article; `-1 mèter dpl`). The other four are shapes other rules own: an ordinal
 *      (`ka -8`, `kapèng -20`), a coordinate span (`35° Lintang Dâjâ -71° Lintang Dâjâ`) and a year span
 *      (`taon 1953 -1955`). And no Madurese word for the arithmetic negative is attested: `korang` ×17 is
 *      real but every instance is bound into a COMPARATIVE PHRASE — `korang lebbi` ("more or less") ×13 and
 *      `korang ḍâri` ("less than") ×4 — never a prefixed sign. That is the Fula `hakkunde` failure exactly:
 *      the word is real and the part of speech does not fit the slot. Omitting a minus INVERTS a value, so
 *      a known-wrong reading does not get to be a green gate.
 *   2. THE PLUS. Four in the artifact: two phone country codes (`Kode telepon: +31 (Èropa), +599`), one UTC
 *      offset (`UTC+7`) and a song title (`"1+1"`). `tamba` is attested ×9 articles on mad.wikipedia and
 *      every hit is the verb/adverb "to increase" (`pânḍuḍuk Katolik tamba bânnya'`), not the operator.
 *      Playbook trap 48 already settles the general case: nothing in any corpus attests how `UTC+1` is
 *      said.
 *   3. THE EQUALS. Five in the artifact and NOT ONE is arithmetic — they are bilingual GLOSSES
 *      (`"dahana" = apoy, "pura" = kotta`, `Eatore, konye' gunong = Silahkan dimakan`, a German/Indonesian
 *      title equation, `tangghâl 1 bulân Tisyri = Rosh Hashanah`) and the physics formula `E = mc²`. A
 *      reading for the relation would be wrong in every attested instance.
 *   4. LATIN LETTER NAMES, i.e. initialisms. The traffic is real — `IAIN` ×13, `SMA` ×11, `PT` ×9, `UIN` ×8,
 *      `PBB` ×5 in 437 lines, and `PBB` currently reads [ppː], a vowel-less cluster. But there is no source:
 *      `sources.ts` reports `letter-names NONE — espeak does not ship this language at all`, the corpus
 *      never spells an acronym out, and mad.wikipedia's own `Alfabèt Latin` article gives the letter SHAPES
 *      and no nomenclature table. Javanese shipped an INFERRED (Indonesian) inventory on the argument that
 *      its own g2p supplies the phonology; that argument transfers, but the inventory would still be a
 *      guess, and this pass declines to make it. Recorded as a re-runnable measurement rather than a TODO.
 *
 * ⚠ ONE ADJACENT DEFECT THIS LAYER UNCOVERS AND DELIBERATELY DOES NOT FIX, recorded so the next reader does
 * not have to rediscover it. `numbers.ts` composes 0 … <10⁶ and falls back to DIGIT-BY-DIGIT above that, by
 * design ("larger / non-finite → digit-by-digit"). De-grouping newly hands it whole millions, so `2.150.000`
 * went from three fragmented values with phrase breaks between them (*duwɤ . sapɔlɔ bɤn lɛmaʔ …*) to one
 * ordered digit run — better, and still not how the number is said. Measured: **26 instances in the
 * artifact's 437 lines**, all populations and areas. Closing it means asserting Madurese's million and
 * billion words and their composition order; both are in fact well attested in this corpus (`juta` ×18 in
 * the magnitude slot — `361 juta kilometer persegi`, `41,15 juta orèng`, `80 juta rekaman` — and `miliar`
 * ×11), but that is a change to the NUMBER PATH rather than to this layer, it has no referee to gate it, and
 * it deserves its own corpus diff. The fix exposing the next defect is normal; this one is named, counted
 * and left.
 *
 * ⚠ AND ONE MORE, SMALLER: the ARC-MINUTE and ARC-SECOND marks of a coordinate (`7°53’-8°34’`,
 * `112º4’41’’`). The degree sign IS read; `’`/`′`/`”` are not, because no Madurese word for them is
 * attested anywhere and the same characters are the language's own GLOTTAL STOP (`sampè’`, `ta’`), so a
 * generic rule would eat ordinary words. Only their range-dash role is claimed, in step 3.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/** Not-a-letter, on both sides. `\b` cannot be used — see the header. */
const L = "[\\p{L}\\p{M}]";

/**
 * The shared symbol tier. Madurese has no nominal plural, so every CountForms is a single entry.
 *
 * ⚠ THE ORTHOGRAPHY OF THIS WIKI IS MIXED — the 2008 revision writes ⟨è⟩ for /ɛ/, and the corpus carries
 * both the Madurese-marked spelling and the Indonesian one for the same loan (`mèter` ×8 / `meter` ×4,
 * `kilomèter` ×1 / `kilometer` ×2, `hèktar` ×5 / `hektar` ×1). Each key below takes the spelling that is
 * ATTESTED, and where both are, the marked one — it is the form the language's own g2p was written for.
 */
const SYMBOLS = makeSymbolNormalizer({
    // ⚠ ONE WHOLE-TOKEN HIT IN THE ARTIFACT AND IT IS THE EXACT SLOT: `Sangang polo petto' persen aèng è
    // attas permukaan` — "ninety-seven percent of water is at the surface", a spelled-out numeral followed
    // by the word. (`persenjataan`/`persengketaan` account for the other two raw matches, which is why the
    // token/substring split in `corpus-words.ts` matters.) The sign occurs 367 times corpus-wide and was
    // dropped in silence: `71%` read *pətːɔʔ pɔlɔ bɤn sətːɔŋ*, the percentage gone.
    percent: ["persen"],
    currency: {
        // ⚠ MULTI-CHARACTER KEYS, LONGEST FIRST. A bare `$` cannot match in `US$550` — the tier's pattern is
        // letter-bounded on the left, correctly, so the compound key is the only way in. The corpus writes
        // `US$550 juta`, `US$47 per dosis`, `US$130`, `AS$1,21`.
        // The reading is the corpus's own: `dolar Amèrika Serikat` (×1, in the euro article) and `dolar AS`
        // (×1). `Amèrika` alone is everywhere; `AS` would read as two bare letters, so the noun is spelled.
        "US$": ["dolar Amèrika"],
        "AS$": ["dolar Amèrika"],
        $: ["dolar"],
        // ⚠ `Rp` IS LETTERS, NOT A SIGN, and it is the second commonest currency here — ×9 in the artifact,
        // always with an amount (`Rp 16,09 milyad`, `Rp 729 jutah`, `Rp56 triliun`, `Rp 18.900.000`). It
        // read as *ɾp*, two bare consonants. `rupiah` scores ZERO in the corpus and ×19 in 16 articles on
        // mad.wikipedia, in the monetary sense throughout (`arghâ ra-kèra 1 juta rupiah per orèng`,
        // `uang kertas Rp 10.000`) — the wiki is the weaker tier and it is the one that has this word.
        Rp: ["rupiah"],
        // ×1 (`lebbi ḍâri €1,3 triliun sè beredar`) and the same sentence names the currency: `Euro panèka
        // obâng cadangan palèng rajâ kapèng ḍuwâ'`.
        "€": ["euro"],
        // ⚠ `¥`, `S$` AND `HK$` ARE DELIBERATELY ABSENT. All three occur (`¥ 150.000 otabâ Rp 18.900.000`,
        // `abhândhâ S$8 miliar`, `HK$`) and no Madurese name for the yen, the Singapore dollar or the Hong
        // Kong dollar is attested in the corpus or on the wiki. `S$`/`HK$` cannot be reached by the bare `$`
        // key anyway (letter-bounded), so they stay silent rather than guessed — the ceb/su/xh precedent.
    },
    // ⚠ WITHOUT THESE THE CURRENCY NOUN LANDS INSIDE THE QUANTITY: `US$550 juta` read *lima ratos lèma' polo
    // DOLAR juta*, the noun wedged between the number and its magnitude. Spellings exactly as this corpus
    // writes them, which is four ways for two words — `juta` ×18 beside `jutah` ×2, `miliar` ×11 beside
    // `milyad` ×6, `triliun` ×3 beside `triliyun` ×1. A magnitude that is written but not declared is
    // precisely the one that gets stranded.
    magnitudes: ["èbu", "ebu", "juta", "jutah", "miliar", "milyad", "milyar", "triliun", "triliyun"],
    units: {
        km: ["kilomèter"],
        m: ["mèter"],
        cm: ["sèntimèter"],
        mm: ["milimeter"],
        kg: ["kilogram"],
        ha: ["hèktar"],
    },
    // ⚠ ⟨m⟩ IS DECLARED AND TRAP 46 SAYS THAT IS THE DANGEROUS ONE — a one-letter unit key claims a dotted
    // designation (`802.11m`), and the tier's `NOT_VERSION` guard defends against it by SEEING THE DOT. It
    // can only see one if the version dot is still there, which is exactly why the tier runs at step 7 and
    // the decimal rule at step 9 in this file and not the other way round. Measured here: the corpus's
    // digit-adjacent ⟨m⟩ is ten instances and every one is a metre (`40m tèngghina`, `1.000m ḍâri
    // pa'aḍa'ân tasè'`, `156 m`, `3.952 m`), and `24.000m2`/`42.300m2` are the ASCII-exponent spelling of
    // m² which the same key unlocks.
    // ⚠ ⟨g⟩ AND ⟨l⟩ ARE NOT DECLARED: digit-adjacent ⟨g⟩ is ×1 and ⟨l⟩ ×0 in this corpus, which is a rule
    // with no instance to justify it on the two keys whose length makes a misfire likeliest (trap 9).
    // ⚠ ⟨kg⟩ WAS THE LOUDEST UNIT DEFECT AND IT IS NOT A DROP: `30kg nitrogen` read *təlɔ pɔlɔ **kk***,
    // because the g2p reads a doubled consonant letter as a GEMINATE. An audible wrong word, invisible to
    // every leak class. `kilogram` is attested ×11 articles on mad.wikipedia in the mass slot
    // (`bom saberrâ' 12,5 kilogram`, `berrâ'en 40 sampè' 90 kilogram`).
    // ⚠ ⟨mm⟩'s word is the corpus's own, in the Indonesian spelling it happens to use there —
    // `korang ḍâri sèttong milimeter`, the only instance, so that is the spelling declared.
    // ⚠ ⟨cm⟩'s word comes from the wiki, which GLOSSES THE ABBREVIATION ITSELF: `ècapa' 120 sentimeter
    // (cm)`. The marked spelling `sèntimèter` is attested in 4 further articles and is the one taken.
    // ⚠ ⟨ha⟩ is the corpus's `10-15 ton/ha` and `126.182 Ha`, and `hèktar` ×5 is its own gloss of it
    // (`10 ton/hèktar`, `20kg kalium per hèktar`).
    // The rate word is `per`, which this corpus uses in exactly this construction ×15 (`orèng per km²`,
    // `US$47 per dosis`, `PDB per kapita`, `1.500 buwâ per bhungka`).
    unitPer: "per",
    // ⚠ DENOMINATOR-ONLY, never standalone (the `Il-76s` hazard the field exists for). `taon` is the
    // corpus's own slash denominator — `2000–3000 mm/taon` — and `detik` is mad.wikipedia's, in the same
    // slot with the word spelled out: `kapasitas aliran maksimumna 13.500 meter kubik per detik` ×3.
    rateDenominators: { taon: "taon", detik: "detik" },
    // ⚠ BOTH WORDS ARE ATTESTED IN THE UNIT-MODIFIER SLOT, which is the only slot that counts (trap 37 —
    // the bare modifier is never the attestation). `persegi`: the corpus's `ḍaèra ra-kèra 361 juta
    // kilometer persegi`, and mad.wikipedia's `120 meter persegi (1.300 kaki persegi)` ×20 articles.
    // `kubik`: absent from the corpus, ×19 hits in 8 articles on the wiki and every one a volume —
    // `volume 181.000 meter kubik`, `kapasitas 8.930.000 meter kubik`, `200 meter kubik per detik`.
    // Position is `after`, the default, which is what both citations show.
    exponentWords: { squared: ["persegi"], cubed: ["kubik"] },
    // ⚠ `bareExponent` IS DELIBERATELY NOT DECLARED. This corpus's superscripts are overwhelmingly UNIT
    // exponents (km² and m², which the unit path above already reads); what a bare-base rule would newly
    // claim is `E = mc²` and mangled scientific notation (`8 x 1013`), i.e. it would trade a silent
    // superscript for a wrong reading. Same call `so` records, for the same reason.
    // ⟨bân⟩ ×536 is the ordinary Madurese conjunction. The `&` is dropped outright without this, and all 16
    // of the artifact's are bibliographic (`Hendra Pasuhuk & Edith Koesoemawiria`, `Woman & Violence`,
    // `art, style & entertainment`) — a citation register, but a dropped conjunction is still inaudible.
    ampersand: "bân",
    // ⚠ THE WORD IS ATTESTED AND THE SLOT IS AN INFERENCE, flagged the way Javanese flags the identical
    // field. `kalè` ×2 is Madurese's "times" and both corpus instances are FREQUENCY (`6 kalè`); the eight
    // `x`/`×` in the artifact are DIMENSIONS and PRODUCTS (`96x100cm`, `55.5x71cm`, `2 x 2`, `4×4`,
    // `8 × 120`). One word, so `by` defaults to it. What it replaces is not silence but audible garbage:
    // `96x100cm` read *saŋaʔ pɔlɔ bɤn ənːəm **z** atɔs cm*, the ASCII ⟨x⟩ taken as a Madurese letter.
    multiply: { times: "kalè" },
});

/** Unit abbreviation → its Madurese noun, for the two RATE shapes the shared tier cannot reach (a unit
 *  after the WORD `per`, and a slash rate whose numerator is a word). Same spellings as `units` above. */
const UNIT_WORD: Readonly<Record<string, string>> = {
    km: "kilomèter", m: "mèter", cm: "sèntimèter", mm: "milimeter", kg: "kilogram", ha: "hèktar",
};
const EXP_WORD: Readonly<Record<string, string>> = { "": "", "²": " persegi", "³": " kubik", "2": " persegi", "3": " kubik" };

/** The clock words this corpus writes, all three of them: `pokol` ×5, the clipped `kol` ×2, and `jhâm` ×3. */
const HOUR_WORD = "(?:pokol|kol|jhâm|jam)";
/** What marks a bare `H.MM`/`H:MM` as a TIME when no hour word precedes it — every such instance in the
 *  artifact carries one (`17:00 WIB`, `10:00 PM`, `12:00 malem`, `21.00 WIB`). */
const CLOCK_MARK = "(?:WIB|WITA|WIT|PM|AM|malem|bâkto)";

/** Every rule emits DIGITS where a number is involved and lets the engine's own number path speak them,
 *  which keeps the numerals out of this layer entirely (playbook trap 6). */
export function normalizeMadurese(input: string): string {
    let s = input;

    // ── 1. THE CLOCK — FIRST, before any rule that reads a dot ────────────────────────────────────
    // ⚠ A CLOCK'S DOT IS NEITHER A THOUSANDS SEPARATOR NOR A DECIMAL and only the context says so. The
    // corpus writes both separators and three hour words: `pokol 14.00`, `pokol 18.56`, `pokol 18:45`,
    // `pokol 11:00`, `kol 17.30 – 21.00 WIB`, `kol 17:00 WIB`, `jhâm 8:00 PM kantos 10:00 PM`. Before this
    // rule `pokol 14.00` read *pɔkɔl sapɔlɔ bɤn əmpaʔ . nɔla* — fourteen, a phrase break, zero.
    // ⚠ ONLY THE WHOLE HOUR IS CLAIMED, and the refusal is the same shape Javanese records: NO MADURESE
    // "past"/"minutes-after" construction is attested anywhere — `mennèt` ×1 and `menit` ×1 exist as the
    // noun (`40 mennèt`, `8 menit bân 8 detik`) but never in a time-of-day reading. So `pokol 18:45` is
    // left alone rather than read with a guessed connective; seven of the artifact's ten clocks are whole
    // hours and are the ones repaired.
    // ⚠ AND THE BARE ARM IS GUARDED BY A CLOCK MARKER, NOT BY SHAPE, because `Rp 16.31 milyad` proves a
    // bare `HH.MM` rule would destroy money: that is 16.31 BILLION rupiah, two sentences from
    // `Rp 16,09 milyad` in the same article. Every markerless `H.MM` in this corpus is a decimal.
    // ⚠ THE RANGE ARM RUNS FIRST — `kol 17.30 – 21.00 WIB` needs the second endpoint claimed by its own
    // trailing marker, and step 8's range rule can only see the dash once both endpoints are bare numbers.
    s = s.replace(
        new RegExp(`(?<![\\p{L}\\p{M}])(${HOUR_WORD})(\\s*)(\\d{1,2})[.:]00(?![\\d.:])`, "giu"),
        (_m, w: string, sp: string, h: string) => `${w}${sp}${Number(h)}`,
    );
    s = s.replace(
        new RegExp(`(?<![\\d.:,])(\\d{1,2})[.:]00(?![\\d.:])(?=\\s*${CLOCK_MARK}(?!${L}))`, "gu"),
        (_m, h: string) => String(Number(h)),
    );
    // ⚠ AND A BARE COLON WHOLE HOUR, WITH NO WORD AND NO MARKER — but ONLY the colon, never the period.
    // Every one of the artifact's seven colon-times is a clock (`8:00 PM`, `10:00`, `11:00`, `12:00`,
    // `17:00 WIB`, `18:45`, and the three-field `08:08:08` the trailing guard refuses), while the period is
    // contested by money (`Rp 16.31 milyad`) and by every English-format decimal in the corpus. The colon is
    // otherwise `clausePunctuation`, so `2:00` read *duwɤ , nɔla* — a phrase break inside a time. The hour
    // is capped at 23 and the minutes at `00`, which is what keeps a SPORTS TIME or a score out (the
    // `sports-time` cell is ×1 corpus-wide and is a Chinese-language Olympics line).
    s = s.replace(/(?<![\d.:,])([01]?\d|2[0-3]):00(?![\d.:])/gu, (_m, h: string) => String(Number(h)));

    // ── 2. DE-GROUP THOUSANDS — the single most destructive defect this layer repairs ──────────────
    // ⚠ AFTER the clock (whose `14.00` is 2 digits and safe either way) and BEFORE every other number rule.
    // The tokenizer splits on `\d+` and `.`/`,` are both `clausePunctuation`, so a grouping separator
    // became a PAUSE and the value was destroyed: `5.168 km²` read *lɛmaʔ . atɔs bɤn ənːəm pɔlɔ bɤn bɤluʔ*
    // — "five, one hundred and sixty-eight" for 5,168. ×79 period + ×10 comma in 437 lines; 973 corpus-wide.
    // ⚠ EXACTLY THREE DIGITS PER GROUP, REPEATED, IS THE WHOLE DISAMBIGUATION (see the header table).
    // ⚠ THE PERIOD ARM REFUSES A FOLLOWING PERIOD AND ALLOWS A FOLLOWING COMMA. Allowing the comma is what
    // makes the native mixed number work — `2.093,45 km²`, `1.485,36`, `115.114,32`, `57.365,09` — and
    // refusing the period is what keeps the two conventions apart and leaves the corpus's malformed
    // `87.017.41 km²` alone rather than half-reading it.
    // ⚠ THE COMMA ARM CARRIES `(?!0,)`, WHICH IS A MEASURED GUARD AND NOT A STYLE CHOICE: see the header.
    s = s.replace(/(?<![\d.,])\d{1,3}(?:\.\d{3})+(?![\d.])/gu, (m) => m.replaceAll(".", ""));
    s = s.replace(/(?<![\d.,])(?!0,)\d{1,3}(?:,\d{3})+(?![\d,])/gu, (m) => m.replaceAll(",", ""));

    // ── 3. THE COORDINATE RANGE'S DASH ────────────────────────────────────────────────────────────
    // ⚠ BEFORE the degree rules, which destroy the adjacency this needs, and before step 8, which cannot
    // see it at all: the LEFT endpoint of a coordinate span ends in a degree, minute or second mark rather
    // than in a digit, so a digit–dash–digit rule can never match it. Ten of the artifact's dropped minus
    // signs are this shape: `7°53’-8°34’`, `111°24-112°11’`, `112º–113º`, `6º–7º`, `4°55'-7°24'`,
    // `112º4’41’’-112º`, `25°-38 °C`, `(77°-100 °F)`, `7°35′–7°45′`.
    // ⚠ THE MARK MUST BE PRECEDED BY A DIGIT. `’` and `'` are Madurese's own GLOTTAL STOP (`sampè’`,
    // `ta'`, `petto'`) — a rule that claimed them anywhere would eat ordinary words.
    // ⚠ AND IT MATCHES A RUN, NOT ONE CHARACTER. This wiki writes the arc-second as TWO apostrophes rather
    // than as `″`, so the character before the dash in `6º51’54’’-7º23’6’’` is itself a `’` and a
    // single-character rule fails the digit lookbehind on exactly the two densest coordinate sentences in
    // the corpus (Lamongan's bounding box, ×2 spans each). Found by re-reading the scan's residual DROPs
    // after the first version of this rule went in — the count went 10 → 5 and the leftovers named the bug.
    // ⟨sampè'⟩ ×14 is the corpus's own span connective and it is used with coordinate endpoints in exactly
    // this construction: `111º05′ sampè' 112º13′ Bujur Tèmor bân 7º20′ sampè' 7º59′ Lintang Lao'`.
    s = s.replace(/(?<=\d)(['’′″"”º°]+)\s*[-–—]\s*(?=\d)/gu, "$1 sampè' ");

    // ── 4. DEGREES — the scale letters, then the bare sign ────────────────────────────────────────
    // ⚠ °C BEFORE THE BARE °, or the bare rule eats the sign and leaves a lone ⟨C⟩ — which is exactly what
    // `36°C` did: it read *təlɔ pɔlɔ bɤn ənːəm **c***, the scale letter taken as Madurese ⟨c⟩ = /c/.
    // ⚠ BOTH `°` (U+00B0) AND `º` (U+00BA) — this wiki writes the masculine ordinal indicator for the
    // degree sign in roughly half its coordinates (`112º–113º`, `6º51’54’’`, `7º59′`), the same
    // substitution the Italian run found in `dell'11º`. A rule that knows one and not the other gives
    // false assurance (`º` is in the scan's RAWMARK class for precisely this reason).
    // ⟨derajat⟩ ×2 and its scale name are sourced from ONE corpus sentence that carries both:
    // `kalabân suhu rata-rata 30 derajat celcius`. ⟨Fahrenheit⟩ is mad.wikipedia's, from a sentence that
    // likewise pairs the two: `(èsebbhut titi' bekku, 0° Celcius, 32° Fahrenheit)`.
    // ⚠ THE TRAILING SPACE ON THE BARE ARM IS LOAD-BEARING: a coordinate glues its compass word straight
    // onto the sign, so without it `6°LU` becomes one unreadable token. The clause sink trims the
    // duplicate-space case.
    s = s.replace(/(\d)\s?[°º]\s?C(?![\p{L}\p{M}])/gu, "$1 derajat celcius");
    s = s.replace(/(\d)\s?[°º]\s?F(?![\p{L}\p{M}])/gu, "$1 derajat fahrenheit");
    s = s.replace(/(\d)\s?[°º]\s?/gu, "$1 derajat ");

    // ── 5. `±` IS "ABOUT", NOT A TOLERANCE — and the corpus glosses it itself ──────────────────────
    // All four instances are a rounded area or a rounded height: `±1.752,21 km²`, `otabâ ±3.78%`,
    // `tombu sampè’ ± 15 mètèr`, `ra-kèra ±335,28 km²`. ⟨korang lebbi⟩ ×13 is the phrase Madurese writes
    // for that sense, and one instance settles it by writing BOTH: `Loas wilayana korang lebbi ±1.752,21
    // km²` — the phrase and the sign, side by side.
    // ⚠ WHICH IS ALSO WHY THE GUARD EXISTS. Substituting blind DOUBLES a connective the text already wrote,
    // in two of the four instances (`korang lebbi ±…` and `ra-kèra ±…`). The lookbehind is spelled out
    // because these are words, not a character class.
    s = s.replace(
        /(?<!(?:korang lebbi|ra-kèra|sakètar|kèra-kèra)\s?)(?<![\p{L}\p{M}])±\s*(?=\d)/gu,
        "korang lebbi ",
    );
    // …and where the text DID write it, the sign is redundant and simply comes out (playbook trap 12: say
    // it once, in the position the language puts it).
    s = s.replace(/((?:korang lebbi|ra-kèra|sakètar|kèra-kèra)\s?)±\s*(?=\d)/gu, "$1");

    // ── 6. ERA MARKERS — SM before M, always ──────────────────────────────────────────────────────
    // ⚠ `M` MATCHES INSIDE `SM` and would leave a stranded S. `940 M`, `950 M`, `1037 M`, `875 M.` and
    // `abad ka-16—12 SM` in the artifact; 30 era markers corpus-wide. Both read as bare consonants before
    // this rule (*… m*, *… sm*).
    // ⟨Masèhi⟩ is attested in 20 articles on mad.wikipedia in exactly this slot — `neng taon 622 Masèhi`,
    // `abad ke-18 Masehi`, `taon 700-an Masehi` — and the BC phrase is attested twice over, independently:
    // mad.wikipedia's own `Alfabèt Latin` article writes `rakèra molàèn abad ka-7 sabellunna Masèhi`, and
    // the Madurese Bible (YouVersion `MAD`) uses `Sabellunna Masehi` in its book introductions.
    // ⚠ A DIGIT MUST PRECEDE, which is what keeps a personal initial out: the corpus is full of `W.M.`,
    // `H.A.`, `M.A.`, `K.H.` and a bare `M.` ×3, none of them after a number.
    // ⚠ A FOLLOWING PERIOD IS ALLOWED, unlike the Sundanese rule, because `875 M.` is a sentence-final era
    // marker here and excluding the period would miss it. A Roman `M` cannot reach this rule: `mad` is not
    // in `ROMAN_NATIVE`, so `core/roman.ts` has already turned any Roman numeral into digits.
    s = s.replace(/(?<![\p{L}\p{M}\d])(\d+)\s?SM(?![\p{L}\p{M}\d])/gu, "$1 sabellunna Masèhi");
    s = s.replace(/(?<![\p{L}\p{M}\d])(\d+)\s?M(?![\p{L}\p{M}\d])/gu, "$1 Masèhi");

    // ── 7. THE TWO RATE SHAPES THE SHARED TIER CANNOT REACH ───────────────────────────────────────
    // ⚠ BEFORE the tier. The tier matches a unit only when a NUMBER is adjacent, and in both of these the
    // thing next to the unit is a WORD — so the abbreviation leaked raw into the IPA.
    //   · A SLASH RATE WITH A WORD NUMERATOR — `jiwa/km²`, `jiwa/km2`, `orèng/km²` (population density) —
    //     read *ɟiwa km*, the unit bare and the exponent gone.
    //   · A UNIT AFTER THE WORD `per` — `orèng per km²` ×5, `orèng per Km²` ×2 (the wiki capitalises it),
    //     `1.027 oreng per Km²` — read *pər km*.
    // ⚠ A LETTER MUST PRECEDE THE SLASH, so a numeric `10/01/2007` stays a date for nobody to touch and
    // `km/jam` stays the tier's. And the DENOMINATOR must be a declared unit key: this corpus's other
    // slashes are the "or" slash Madurese writes constantly (`bân/otabâ`, `daging/ajam/tempe`,
    // `atoran/kabiyasaan`, `axle/gardan`, `dhisa/kelurahan`), and a general word/word rule would read
    // every one of them as a rate.
    const rateUnit = "(km|cm|mm|kg|ha|m)";
    s = s.replace(
        new RegExp(`(?<=${L})\\s?/\\s?${rateUnit}(²|³|2|3)?(?![\\p{L}\\p{M}\\d])`, "giu"),
        (_m, u: string, exp: string | undefined) =>
            ` per ${UNIT_WORD[u.toLowerCase()]!}${EXP_WORD[exp ?? ""] ?? ""}`,
    );
    s = s.replace(
        new RegExp(`(?<![\\p{L}\\p{M}])per\\s+${rateUnit}(²|³|2|3)?(?![\\p{L}\\p{M}\\d])`, "giu"),
        (_m, u: string, exp: string | undefined) =>
            `per ${UNIT_WORD[u.toLowerCase()]!}${EXP_WORD[exp ?? ""] ?? ""}`,
    );

    // ── 8. THE SHARED TIER — percent, currency, units, rates, exponents, `&`, `×` ──────────────────
    // ⚠ AFTER de-grouping, or the tier sees `5.168 km²` as `168 km²`.
    // ⚠ AND BEFORE THE DECIMAL RULE, which is the coupling the playbook names ("units before decimals"):
    // the tier matches a unit or a currency sign only when a NUMBER is adjacent, and rewriting `1,3` into
    // `1 koma 3` destroys that adjacency. Run the other way round, `€1,3 triliun` comes out with the noun
    // wedged between the integer and its own fraction.
    // ⚠ THAT ORDER IS ALSO WHAT KEEPS `NOT_VERSION` ALIVE, which is playbook traps 39 and 46 in one line:
    // the guard that stops `802.11m` reading as eleven metres works by SEEING THE DOT, and the decimal rule
    // below spends it. Declaring the one-letter key ⟨m⟩ is only safe because the tier runs first.
    // ⚠ AND AFTER the degree rules, so the tier's unit alternation never has to compete with a scale letter
    // for the same `C`.
    s = SYMBOLS(s);

    // ── 9. RANGES → `sampè'` ──────────────────────────────────────────────────────────────────────
    // ⚠ LAST OF THE RULES THAT OWN A DASH. Every earlier rule has already taken the dashes it owns — the
    // clock span in step 1 and the coordinate pair in step 3 — so what reaches here is a bare numeric span.
    // 3,606 corpus-wide; the hyphen was dropped outright, so `70-90%` read as two numbers running together
    // with no connective at all (*pətːɔʔ pɔlɔ saŋaʔ pɔlɔ*).
    // ⟨sampè'⟩ ×14 is the corpus's own connective and it is used between numeric endpoints:
    // `1998 sampè' taon 2008`, `2015 sampè' taon 2019`, `bisa sampè' 30 - 60cm`, and on the wiki
    // `berrâ'en 40 sampè' 90 kilogram`, `tegghina 1 sampè' 1,7 mèter`. (⟨kantos⟩ ×26 is the same slot in a
    // higher register — `30 kantos 38 ppt`, `1596 kantos taon 1651` — and is recorded here as the attested
    // alternative rather than shipped, since one connective is enough and `sampè'` is the everyday form.)
    // ⚠ THE OPERANDS MAY CARRY A DECIMAL, because this rule runs BEFORE the decimal step: `(0,3-2,7%)` and
    // `pH-na 4.5 - 7` are both in the artifact, and an integers-only pattern silently skips them.
    // ⚠ THREE GUARDS, EACH FOR A COUNTED SHAPE.
    //   1. `/` ON BOTH SIDES — the corpus's dates and year pairs are `10/01/2007 – 18/03/08` and
    //      `(1998/1999-2008/2009)`, where the digits either side of the dash belong to different fields.
    //      Without it `2007 – 18` reads as a span.
    //   2. NO LEADING LETTER, DIGIT, SEPARATOR OR HYPHEN — which is what excludes an identifier chain
    //      (ISBN ×8 in the artifact) and a designation (`Ḍ3-Akuntansi`).
    //   3. NOTHING BUT WHITESPACE MAY FOLLOW A TRAILING SEPARATOR OR HYPHEN, for the same chain reason.
    s = s.replace(
        /(?<![\d.,\p{L}\p{M}/-])(\d+(?:[.,]\d+)?)\s?[-–—]\s?(\d+(?:[.,]\d+)?)(?![\d,\p{L}\p{M}/-])/gu,
        "$1 sampè' $2",
    );

    // ── 10. DECIMALS → `koma` ─────────────────────────────────────────────────────────────────────
    // ⚠ LAST, because every rule above needs its separator intact — de-grouping, the tier's `NOT_VERSION`,
    // the clock and the range operands. 1,541 corpus-wide, and before this rule the separator was read as a
    // CLAUSE PAUSE, which destroys the value rather than merely leaving it unread: `1,6% aèng` came out
    // *sətːɔŋ , ənːəm aɛŋ*.
    // ⚠ THE WORD IS THE ONE THING IN THIS FILE THE CORPUS CANNOT ATTEST, AND THAT IS SAID PLAINLY.
    // ⟨koma⟩ scores 0 whole-token hits in the artifact and ×18 in 12 articles on mad.wikipedia — where
    // EVERY recorded instance is the astronomical COMA of a comet (`Bâgiyân-bâgiyân komèt aèssè inti,
    // koma, ondem hidrogèn, bân bunto'`). That is a real competing sense and it is not an attestation of
    // the reading. What justifies shipping it anyway is the playbook's own rule that a written corpus is
    // the WEAKEST evidence there is about how a SYMBOL is spoken — writers type `1,6` and never spell out
    // how they say it — plus the fact that Madurese's entire numeric-technical stratum here is the
    // Indonesian one and every other member of it IS attested in this corpus (persen, derajat, celcius,
    // persegi, kubik, mèter, kilogram, rupiah, dolar, triliun, miliar, per). Indonesian's decimal word is
    // `koma`. The alternative is 1,541 values destroyed by a phrase break.
    // ⚠ A MADURESE SPEAKER REVIEWING THIS LAYER SHOULD START HERE. It is the one unattested reading shipped.
    // ⚠ THE FRACTION IS READ DIGIT BY DIGIT, the Austronesian convention `indonesian.ts` and `sundanese.ts`
    // both take (`43,34` → *… koma telu empa'*, never "thirty-four"), and emitted as SPACED DIGITS so the
    // engine's own cardinal path speaks each one.
    const decimal = (int: string, frac: string): string => `${int} koma ${[...frac].join(" ")}`;
    s = s.replace(/(?<![\d.,])(\d+),(\d{1,3})(?![\d,])/gu, (_m, i: string, f: string) => decimal(i, f));
    // ⚠ THE PERIOD ARM CARRIES TWO EXTRA GUARDS THE COMMA ARM DOES NOT NEED.
    //   · `(?!\.\d)` KEEPS A VERSION/SECTION TRIPLE OUT. The corpus writes `2.4.1` and `No 01/0/SKB/2004`;
    //     without it `2.4.1` read *duwâ koma empa' . settong*, a decimal plus a stray pause. Refusing only
    //     when ANOTHER dot-plus-digit follows is what still lets a sentence-final decimal through.
    //   · A CLOCK CONTEXT IS EXCLUDED OUTRIGHT. Step 1 claims the whole hours it can identify; what it
    //     leaves behind is a clock with REAL MINUTES, and this rule read `kol 17.30` as *kol 17 koma 3 0* —
    //     a decimal inside a time. The corpus's `pokol 18.56` is the same shape. Found by probing the
    //     leftovers of step 1's deliberate refusal, not by the corpus, whose other clocks are whole hours.
    s = s.replace(
        /(?<![\d.,])(\d+)\.(\d{1,3})(?![\d,])(?!\.\d)/gu,
        (m, i: string, f: string, off: number, full: string) =>
            new RegExp(`(?<![\\p{L}\\p{M}])${HOUR_WORD}\\s*$`, "iu").test(full.slice(0, off))
                ? m
                : decimal(i, f),
    );

    return s;
}
