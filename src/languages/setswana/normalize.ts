/**
 * Setswana / Tswana (tn) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THIS LANGUAGE NEEDS RULES ON BOTH SIDES OF THE SHARED SYMBOL TIER, so it exports TWO functions and
 * `setswana.ts` sequences them — `normalizeSetswanaPost(SYMBOLS(normalizeSetswanaPre(input)))`, the Shona
 * shape rather than the Chichewa one. Neither half can move:
 *   · HTML ENTITIES must be folded BEFORE the tier, and this is not cosmetic. tn.wikipedia writes
 *     `1,400&nbsp;km²`, `$52&nbsp;million`, `31&nbsp;°C`, `R1&nbsp;billion` — the entity sits BETWEEN the
 *     number and its unit or sign, so un-folded it breaks the number-adjacency the tier matches on and the
 *     abbreviation reaches the phoneme sink raw. 21 of the artifact's 32 ampersands are `&nbsp;`.
 *   · The DEGREE, currency-SUFFIX and RAND rules must run before the tier too: they need the number intact
 *     and, for the rand, a guard the tier cannot express (below).
 *   · DE-GROUPING and the DECIMAL spell-out must run AFTER it: the tier needs the digit adjacent to its
 *     sign, and `26.931 km²` has to reach the unit path as one number. De-grouping is safe on that side
 *     because it keys on the DIGIT RUN alone, which the tier leaves intact — the Chichewa argument.
 *
 * ⚠ AND THAT ORDER IS WHAT KEEPS `NOT_VERSION` ALIVE (playbook traps 39, 46). This layer declares the
 * one-letter unit key `m`, which is exactly the key that turned `802.11m` into "802.11 metres" in four
 * languages — and the tier's guard for it works by SEEING THE DOT. Because the decimal rule runs AFTER the
 * tier here, the dot is still there when the guard looks. Verified end to end, not assumed.
 *
 * ⚠ EVERY NUMERAL STAYS AS DIGITS, and trap 14/15 was measured rather than assumed, because it is the
 * defining rule of several Bantu layers. Setswana does not bind a concord to a digit run: the artifact's
 * `digit + short word` pairs are ordinary free words (`ka 2008`, `mo 100 m`, `ya 2011`), and the language's
 * numeral concord lives on the MEASURE NOUN, not on the numeral — which is why every unit and currency form
 * below carries its own copula (`di le`) and no agreement has to be computed downstream.
 *
 * ⚠ THE MEASURE NOUN'S COPULA IS PART OF THE WORD, AND IT WAS COUNTED. Of the 51 measure-noun occurrences in
 * the artifact, every one is followed by a concord copula before its numeral — `di le` / `dile` / `tse di` /
 * `di ka nna` — and there are ZERO instances of a bare measure noun immediately followed by a digit
 * (`dikilometara di le 200`, `dimetara di le 650`, `diheketara di le 15,254,700`, `metsotswana e le 44.55`).
 * So the tier's `units` and `currency` forms are declared WITH the copula and with `unitPrefix` /
 * `currencyPrefix`, which also makes the exponent and rate compositions come out in the attested order:
 * `sekwere sa dikilometara di le 604.3`, `dimetara di le 0.8 ka motsotswana`.
 *
 * ⚠ THE SEPARATORS WERE RE-MEASURED ON tn's OWN CORPUS (trap 55 — Sepedi and Sesotho are close siblings and
 * were being treated concurrently; nothing was carried across). Over the 448 retained segments:
 *
 *     comma + exactly 3 digits    59   ALL grouping   231,626 · 92,859 · 15,254,700 (ha) · $2,266,160
 *     comma + 1–2 digits           4   ALL decimal    18 443,8 · dimilione di le 3,4 · $1 200,20
 *     comma + 4+ digits            0
 *     period + exactly 3 digits    5   4 grouping (4.389 · 3.132.463 · 1.766 · 1.300m2), 1 decimal (0.001)
 *     period + 1–2 digits        123   ALL decimal    41.9 °C · 604.3 km2 · 88.5% · 9.75
 *     space + 3 digits            21   ALL grouping   581 730 · 224 607 · 111 000 000 · 290 000
 *
 * The single period-grouping counter-example opens with a LEADING ZERO and a grouped number never does, so
 * the "head must start 1–9" guard separates the two populations 4 against 0.
 *
 * Deliberately not done, each with the measurement behind it — see
 * `docs/investigations/tn_normalization_investigation.md` for the full sourcing trail:
 *   · NO `€` READING (4 instances). `diyuro` is ×0 on tn.wikipedia and `yuro` is 6 tokens in 2 articles, of
 *     which FIVE are the UEFA football tournament (*Yuro ya Basadi ya UEFA ya 2017*). The sixth is a genuine
 *     currency use in one article — a lead, not a finding. A wrong currency word is confidently wrong where
 *     a silent sign is only missing.
 *   · NO `×` / `x` READING (6 relay formats, 2 scientific-notation mantissas, 1 product, 1 dental formula).
 *     The corpus's own gloss of `4×100m relay` is a PARAPHRASE, *batho ba le bane dimmithara dile lekgolo
 *     mongwe le mongwe* ("four people, one hundred metres each"), not a word in the slot; `makgetlho`
 *     ("times/occasions", *makgetlho a le lesome le borataro*) is the occurrence word, not the multiplier —
 *     a real word whose slot is not this slot, which is the Fula `hakkunde` failure.
 *   · NO `=` `<` `>` `±` `÷` `+`. Every `=` in the artifact is an EasyTimeline chart directive
 *     (`ScaleMajor = unit:year increment:11000`) or an English book title; `<` `>` `±` `÷` are ×0; the only
 *     `+` is `UTC+02:00`, which the playbook records fleet-wide as the one contentful plus nothing attests.
 *   · NO LETTER NAMES, so no initialisms (11,486 in the corpus). `core/initialisms.ts` needs a `letterName`
 *     table; espeak does not ship Setswana at all and no in-repo source carries one, so wiring the pass
 *     would be a NO-OP. A sourcing gap, not a seam gap.
 *   · NO `ml` OR `ft` READING. `mililithara`/`dimililithara`/`difiti` are all ×0 on tn.wikipedia; the
 *     corpus's single `ml` gloss spells `dimelemetha`, a hapax nothing corroborates, and every `ft` sits
 *     inside an English parenthetical glossing a metric figure already given. Both keep leaking VISIBLY.
 *   · NO FRACTIONS, NO ERA PHRASE. `sources.ts` reports `[NONE] fraction-series` — no denominator series to
 *     compose from.
 *   · NO SPORTS-TIME READING (20 of the artifact's 39 colon shapes). See the clock step.
 */
import { MANIFEST } from "./manifest.ts";

/** The manifest's own conjunction — the number joiner (*lesome LE bongwe*), reused for the clock's
 *  hour/minute link and, at the tier's `ampersand`, for `&`. Read from the manifest so they cannot drift. */
const AND = MANIFEST.numbers.and;

/**
 * The DEGREE noun, and the sense check is the whole of this comment because the bare probe gets it wrong.
 * `attest.ts --lang tn --words dikirii` returns 50 tokens across 20 articles, verdict `attested`, and every
 * displayed example is an ACADEMIC degree — *baithuti ba dikirii ya ntlha*, *dikirii tsa bongaka*. That is
 * `zu amaphuzu` exactly (playbook trap 37).
 *
 * What attests the ANGULAR/thermal sense is the collocation, in three places and two independent articles:
 * the corpus's own *"kgotsa dikirii di le 23 kwa Borwa jwa ekhweitha"* (23 degrees south of the equator),
 * and, from a second article, *"dikirii tsa masome a mabedi tsa longitute ya botlhaba"* and *"dikirii tsa
 * masome a mabedi le bobedi ya latitšhutu ya borwa"*. Those also supply the connective `tsa` and confirm the
 * class-8/10 concord `di le` the unit nouns already use.
 */
const DEGREE = "dikirii";

/**
 * Temperature scale names — and `sources.ts` reports `[NONE] scale-names` for tn, which is WRONG for this
 * language. tn.wikipedia glosses both against the sign, twice each:
 *   · *"mogote wa Celcius e le nngwe (1 °C)"* and *"selekanyo sa mogote sa Celcius e le boraro (3 °C)"* —
 *     note the tn spelling `Celcius`, with ⟨c⟩.
 *   · *"degree Fahrenheit di le lekgolo le borataro ntlha lefela (106.0 °F)"* — and that same sentence is
 *     where `di le` and the decimal word below come from.
 * Emitted after `dikirii tsa`, the connective its own attestations take.
 */
const SCALE: Readonly<Record<string, string>> = { C: "Celcius", F: "Fahrenheit" };

/**
 * The NEGATIVE-temperature reading. From tn.wikipedia's own gloss: *"degree Celsius tse di KWA TLASE GA
 * LEFELA di le thataro ntlha botlhano (−6.5 °C)"* — "degrees Celsius that are below zero, six point five".
 * `attest.ts` → 2 tokens / 2 articles, the second also a temperature (*ka mariga di wela kwa tlase ga
 * lefela*).
 *
 * ⚠ CLAIMED ONLY ON A SCALE-MARKED DEGREE, never on a bare number. Of the artifact's seven dropped minus
 * signs, five are temperatures (−15.0 °C, −6.0 °C, −6.1 °C, −8.0 °C and the pair in one article) and one is
 * a negative LATITUDE (`-21.95 (21° 56' 60 S)`), which "below zero" does not say. Worth the narrowness:
 * omitting a plus is lossless and omitting a minus INVERTS.
 */
const BELOW_ZERO = "kwa tlase ga lefela";

/**
 * The DECIMAL SEPARATOR word — the layer's best-sourced surprise, and the one every other tier reported as
 * unsourceable (`sources.ts` has no class for it, espeak ships no Setswana, and Wikidata has no tn label for
 * "decimal separator" at all). Two tn.wikipedia sentences spell a decimal out beside its digit form:
 *
 *     "… di le thataro NTLHA botlhano (−6.5 °C)"              6.5   = thataro ntlha botlhano
 *     "… di le lekgolo le borataro NTLHA lefela (106.0 °F)" 106.0   = lekgolo le borataro ntlha lefela
 *
 * They settle the word AND that the fractional part is read ONE DIGIT AT A TIME (`.0` → *lefela*), which is
 * what `spell` below does.
 *
 * ⚠ THE LIMIT, STATED RATHER THAN HIDDEN: those are two sentences in one climate-table article family.
 * `ntlha bobedi`, `ntlha boraro`, `ntlha bone`, `ntlha borataro` and `ntlha bosupa` are all ×0. What makes
 * it usable anyway is that the SENSE cannot be anything else — the word sits between an integer and a single
 * fractional digit, beside the printed mark.
 * ⚠ AND THE POLYSEMY COSTS NOTHING HERE. Bare `ntlha` is 185 tokens / 19 articles, overwhelmingly the
 * ordinal *wa ntlha* ("first") and the connective *ka ntlha ya* ("because of"). This layer only ever EMITS
 * it; it never matches it.
 */
const POINT_WORD = "ntlha";

/** The digits of a fractional part, spaced so the number path speaks them one at a time — which is what the
 *  two glossed readings above do. ⚠ Reading `75` in `9.75` as a NUMBER would say *masome a supaŋ le botlhano*
 *  ("seventy-five"), a different quantity. */
const spell = (int: string, frac: string): string => `${int} ${POINT_WORD} ${[...frac].join(" ")}`;

/**
 * Magnitude words for a currency amount, and the two SUFFIX spellings the corpus glues to one.
 * `dimilione` and `dibilione` are attested in exactly this slot — *didolara di le dimilione di le 65*,
 * *didolara di le dibilione di le 2,2*, *diranta di le dimilione di le 112* — and the suffixed forms are
 * `$2.1bn` ×2, `$1.2bn` ×2, `US$1.4bn` ×2, `R268.26bn`, `US$1.5M`, `US $82.3m`, `US $73.7m`, `US $8.7m`.
 * Left raw, `bn` reaches the IPA as raw Latin (the artifact scan's `LEAK RAW-LATIN bn ×3`).
 */
const MAGNITUDE_SUFFIX: Readonly<Record<string, string>> = {
    bn: "dibilione",
    m: "dimilione",
    M: "dimilione",
};

/** Magnitude words already written as words beside a currency amount, for the rand guard below. Both the
 *  English forms the corpus uses and the Setswana borrowings, because tn.wikipedia writes both. */
const MAGNITUDE_WORD = "billion|million|bilione|milione|dibilione|dimilione";

/**
 * Day-part words attested BESIDE a clock in this corpus, and they are what a.m./p.m. become — the language
 * already writes them in that position: *"ka 10:00 thapama"*, *"ka 1:00 kgotsa 1:30 mo mosong"*, and
 * *"ka ura ya boraro mo mosong"*. Nothing is composed that is not attested in this slot.
 */
const AM = "mo mosong";
const PM = "thapama";
/** A day-part already in the text MARKS a colon-number as a clock — and is RE-EMITTED, never consumed
 *  (trap 10): the writer typed *mo mosong* and deleting it would lose a word. */
const DAYPART = "mo mosong|thapama|maitseboa|mosong|bosigo";
/** Timezone abbreviations. Their presence is what marks a time; re-emitted unchanged, since without a
 *  letter-name table there is nothing better to do with them than what the engine already does. */
const TZ = "UTC|GMT|CAT|SAST|BST|CET|EST";
/** Clock nouns, both attested with their own concord: *diura di le robedi ka letsatsi* ("eight hours a day")
 *  and *metsotso e le lesome* ("ten minutes"). The hour noun is class 8/10 (`di le`), the minute noun class
 *  4 (`e le`) — which is why the copula is per-noun data here and in the unit table. */
const HOURS = "diura di le";
const MINUTES = "metsotso e le";

/** The span joiner. `go ya go` / `go ya kwa go` is the corpus's own, and one instance GLOSSES a printed
 *  range: *"dingwaga di le lesome le botlhano GO YA KWA GO di masome a mane le boferabongwe (15–49)"*. It
 *  recurs unglossed throughout — *"go tswa go 69% ka 1991 GO YA GO 83% ka 2008"*, *"17° GO YA GO 31 °C"*,
 *  *"0.5 GO YA GO 3 m3"*. The part-of-speech check that sank Fula's `hakkunde` passes: every attestation is
 *  the infix between two operands, not a preposition governing both. */
const RANGE = "go ya go";

/**
 * PASS ONE — everything that must reach the shared symbol tier already rewritten.
 * Steps are ORDER-DEPENDENT; each states its coupling.
 */
export function normalizeSetswanaPre(input: string): string {
    let s = input;

    // 1) HTML ENTITIES, FIRST OF EVERYTHING. 21 of the artifact's 32 ampersands are `&nbsp;` and 4 more are
    //    `&#x5B;` / `&#x5D;` / `&#x20;`, so the tier's own `&` fold would emit the conjunction plus "nbsp"
    //    for most of them — the entity table has to be consulted BEFORE the sign is read, and only a local
    //    step can sequence that.
    //    ⚠ AND THE FOLD IS LOAD-BEARING FOR THE UNIT PATH, not just for the ampersand: `1,400&nbsp;km²`,
    //    `$52&nbsp;million`, `31&nbsp;°C` and `R1&nbsp;billion` all put the entity between the number and
    //    the thing that has to be adjacent to it.
    s = s
        .replace(/&nbsp;/giu, " ")
        .replace(/&#x20;/giu, " ")
        .replace(/&#x5B;/giu, "[")
        .replace(/&#x5D;/giu, "]")
        .replace(/&amp;/giu, "&");

    // 2) A MAGNITUDE SUFFIX GLUED TO A CURRENCY AMOUNT → the magnitude word, BEFORE the tier claims the
    //    number. `bn`/`m`/`M` after a currency sign is a scale, never a unit; the corpus writes ten of them.
    //    ⚠ ANCHORED ON THE CURRENCY SIGN, which is the whole guard: `915 m` and `4 × 400 m` are metres and
    //    must not be touched, and they have no sign in front. Case is honoured (`M` and `m` both scale here)
    //    because after a sign neither can be anything else.
    s = s.replace(
        /((?:US[ \u00a0]?\$|\$|£|P|R)[ \u00a0]?\d[\d \u00a0.,]*)(bn|M|m)(?![\p{L}\p{M}\d])/gu,  // space, NBSP
        (_w, amount: string, suf: string) => `${amount} ${MAGNITUDE_SUFFIX[suf]!}`,
    );

    // 3) THE RAND, LOCALLY — because the tier CANNOT express the guard this sign needs (trap 47 reason 1).
    //    `R` + digits in the artifact: `R268.26bn` and `R1&nbsp;billion` are money, and
    //    `jaaka R59, N12, N17 le N3` is a list of SOUTH AFRICAN ROAD NUMBERS. 2 true against 1 false, and a
    //    road read as an amount of money is confidently wrong, which this tree ranks below silence.
    //    ⚠ THE DISCRIMINATOR IS THE AMOUNT, NOT THE SIGN: a rand figure carries a separator or a magnitude
    //    word, a road number is a bare 1–3 digit integer. Both true instances pass, the road declines.
    //    ⚠ THE NUMBER CLASS ENDS IN A DIGIT (trap 14's Welsh lesson) — without that, `R268.26bn, mme` would
    //    swallow the clause comma the moment the rule stopped re-emitting its operand verbatim.
    s = s.replace(
        new RegExp(
            `(?<![\\p{L}\\p{M}\\d])R[ \u00a0]?(\\d[\\d \u00a0.,]*\\d|\\d)(?![\\p{L}\\p{M}])([ \u00a0]*(?:${MAGNITUDE_WORD})(?![\\p{L}\\p{M}]))?`,  // space, NBSP
            "gu",
        ),
        (whole: string, n: string, mag: string | undefined) => {
            const scaled = mag !== undefined && mag !== "";
            if (!scaled && !/[., \u00a0]/u.test(n)) return whole; // a bare small integer is a road, not money  // NBSP
            return `diranta di le ${n}${mag ?? ""}`;
        },
    );

    // 4) DEGREES, before the tier and before every numeric rule in pass two, which all need the number whole.
    //    The sign was dropped outright and the scale letter reached the g2p as a PHONEME — `40 °C` read
    //    *masʊmɪ a manɪ K* and `5.0 °F` *lɪfɪla F*, because Setswana has no ⟨c⟩ grapheme and falls back to
    //    the Latin phone. 11 dropped degrees and 180 in the whole corpus.
    //    ⚠ THE MINUS ARM IS CLAIMED ONLY HERE — see BELOW_ZERO. The left guard rejects a DIGIT as well as a
    //    letter so a range's second operand cannot be read as a negative; rejected there, the engine simply
    //    starts later and matches the bare number (trap 52), which is the safe outcome rather than a miss.
    s = s.replace(
        /(?<![\p{L}\p{M}\d])([-−–]?)(\d+(?:[.,]\d+)?)[ \u00a0]?°[ \u00a0]?([CF])(?![\p{L}\p{M}])/gui,  // space, NBSP
        (_w, sign: string, n: string, sc: string) =>
            sign === ""
                ? `${DEGREE} tsa ${SCALE[sc.toUpperCase()]!} di le ${n}`
                : `${DEGREE} tsa ${SCALE[sc.toUpperCase()]!} tse di ${BELOW_ZERO} di le ${n}`,
    );
    //    A BARE degree — a coordinate (`21° 57' 0"`, `(26°)`) or the open end of a temperature span
    //    (`17° go ya go 31 °C`). `º` (U+00BA) is accepted beside `°` because it stands in for it in
    //    imported text, which the playbook records for hi and it.
    s = s.replace(/(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?[°º](?![\p{L}\p{M}])/gu, `${DEGREE} di le $1`);  // space, NBSP

    return s;
}

/**
 * PASS TWO — everything that must run after the shared symbol tier has attached its nouns.
 * Steps are ORDER-DEPENDENT; each states its coupling.
 */
export function normalizeSetswanaPost(input: string): string {
    let s = input;

    // 5) THE CLOCK — and the MARKER is what identifies it, not the shape. Tabulating every `N:NN` in the
    //    artifact (playbook trap 4's move, the German bare-ordinal table):
    //
    //        13 TRUE clocks, and every one carries a right-hand marker
    //             `10:00 thapama` · `1:30 mo mosong` · `7:00 a.m.` · `7:00 p.m.` · `2:00 p.m.` · `8:00 p.m.`
    //             `6:19 p.m.` · `5:07 p.m.` · `8:19 p.m.` · `5:37 p.m.` · `5:40 p.m.` · `7:02 p.m.` · `7:10 p.m.`
    //        20 SPORTS TIMES, and NOT ONE carries a marker
    //             `1:41.73` · `1:43.11` · `2:54.47` · `2:57.76` · `1:44.59 min` · `3:39.60 min` · `1:15.22`
    //             `01:04:02` · `2:28:48` · `29:86` · `11:51` · `11:38 seconds` …
    //         1 RATIO  `selekanyo … 1:1.05`      1 UTC OFFSET  `UTC+02:00`
    //
    //    ⚠ A TWO-DIGIT MINUTE FIELD IS NOT ENOUGH — `11:51` and `1:15.22` pass any `[0-5]\d` shape guard.
    //    The marker requirement declines all 22 non-clocks at no cost to the 13. The trailing `(?![:.\d])`
    //    declines a third field twice over.
    //    ⚠ ONE TRUE CLOCK IS DECLINED and it is recorded rather than chased: `ka diura tsa 13:11` is marked
    //    on its LEFT, and a left arm would have to re-emit `diura tsa` or say it twice (trap 10). One
    //    instance does not buy a second guard shape (trap 9).
    //    ⚠ BEFORE step 6 and step 10: de-grouping and the decimal rule must not see a colon operand, and
    //    `:` is `clausePunctuation`, so every one of these was reading as a comma pause mid-number.
    //    ⚠ THE a.m./p.m. DOTS ARE CONSUMED IN THE SAME MATCH — afterwards nothing can associate them with
    //    the time they belong to, and each was one more sentence break mid-clause.
    s = s.replace(
        new RegExp(
            `(?<![\\d:.,])([01]?\\d|2[0-3]):[ \u00a0]?([0-5]\\d)(?![:.\\d])` +  // NBSP
                `(?:[ \u00a0]*(?:([AaPp])\\.?[Mm]\\.?|(${TZ})(?![\\p{L}\\p{M}])|(${DAYPART})(?![\\p{L}\\p{M}])))`,  // space, NBSP
            "gu",
        ),
        (whole: string, h: string, m: string, ap?: string, tz?: string, part?: string) => {
            const hv = Number(h), mv = Number(m);
            if (hv > 23 || mv > 59) return whole;
            // `:00` emits the hour alone — the alternative is the manifest's zero word *lefela*, and
            // "diura di le 7 le metsotso e le lefela" is not a reading of 7:00 in any language.
            const body = mv === 0 ? `${HOURS} ${hv}` : `${HOURS} ${hv} ${AND} ${MINUTES} ${mv}`;
            if (ap !== undefined) return `${body} ${ap.toLowerCase() === "p" ? PM : AM}`;
            return `${body} ${tz ?? part}`;
        },
    );

    // 6) THOUSANDS DE-GROUPING, before every remaining numeric rule: a grouping COMMA reads as a clause pause
    //    and a grouping PERIOD as a full stop, so `1,500 m` came out *bʊŋwɪ , makχʰʊlʊ a matɬʰanʊ* ("one,
    //    five hundred") and `3.132.463` broke one number into three sentences. 59 comma-grouped,
    //    4 period-grouped, 21 space-grouped in the artifact; 1,553 in the whole corpus.
    //    ⚠ EXACTLY THREE DIGITS PER BLOCK — see the header's table. That is also what keeps a genuine decimal
    //    comma (`dimilione di le 3,4`) and a decimal dot (`604.3`) out of this rule.
    //    ⚠ THE HEAD MUST START 1–9, which is the single guard that separates period-grouping from
    //    period-decimal here: the one three-place decimal in the corpus is `0.001 mm`, and a grouped number
    //    never opens with a leading zero. 4 groupings against 0 false claims.
    //    ⚠ THE TRAILING GUARD IS `(?![\d]|[.,]\d)`, NOT `(?![\d.,])`: with the wider form a grouped number
    //    followed by a CLAUSE comma or a sentence period declines to de-group, and the leftover separator is
    //    then read as a decimal by step 10.
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2})(?:,\d{3})+(?![\d]|[.,]\d)/gu, (w) => w.replace(/,/gu, ""));
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2})(?:\.\d{3})+(?![\d]|[.,]\d)/gu, (w) => w.replace(/\./gu, ""));
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2})(?:[ \u00a0\u202f\u2009]\d{3})+(?![\d])/gu, (w) => w.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space

    // 7) THE ENGLISH ORDINAL SUFFIX (`20th`, `3rd`, `2nd`). Setswana writes its own ordinals as words —
    //    *wa ntlha*, *ya bobedi*, *la bo 18 la dingwaga* — so a Latin suffix on a digit is always foreign
    //    orthography, and it was reaching the phoneme stream as a bare [tʰ]. Stripping it is the whole fix;
    //    no ordinal morphology is invented, because Setswana's is already written out wherever the language
    //    means it. Case-insensitive (trap 7).
    s = s.replace(/(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])/giu, "$1");

    // 8) RANGES → `go ya go`. 2,042 in the whole corpus; the dash was dropped outright, so `15–49` read as
    //    two bare cardinals.
    //    ⚠ ASCENDING ONLY, measured: of the artifact's dash-flanked pairs, the non-ascending ones are
    //    football scores (`40-0`, `8-4`) and SEASONS (`2016-17`, `2018–19`, `2019–20`, `2020–21`) — a season
    //    is descending by construction, so one guard declines both classes. Claiming them would be
    //    confidently wrong; they keep the bare juxtaposition the engine already produced.
    //    ⚠ THE GUARD EXCLUDES A HYPHEN ON EITHER SIDE, which is what declines an ISBN chain: without it
    //    `ISBN 978-92-5-1…` and `1-58479-341-4` read as a cascade of spans.
    //    ⚠ TWO KNOWN LOSSES, recorded rather than guarded away — this said "ONE" until #1104, and both the
    //    count and the price were wrong.
    //    THE SHAPE: `bokete jwa 4 -5 kg` has its unit AFTER the second operand, so the tier has already
    //    rewritten `5 kg` into `dikilogerama di le 5` by the time this runs and the two operands are no
    //    longer both digits. Moving ranges above the tier only moves the damage
    //    (`4 go ya go dikilogerama di le 5`).
    //    ⚠ THE SECOND INSTANCE WAS ALREADY IN THE TREE, as evidence for something else: `12-13 m3 ka
    //    motsotswana` (`tools/corpus/attest/tn.jsonc`) is quoted in setswana.ts's own `unitPer` comment as
    //    the attestation for `ka motsotswana`. So "one instance did not earn a third pass" was counting one
    //    of the two it had.
    //    ⚠ AND THE PRICE IS NOT "the bare juxtaposition the engine already produced". Measured:
    //        Selekanyo sa metsi ke 12-13 m3 ka motsotswana.
    //        → … kɪ lɪsʊmɪ lɪ bʊbɪdi │ dikʰubikimitara di lɪ lɪsʊmɪ lɪ bʊrarʊ │ ka mʊt͡sʊt͡swana
    //             twelve               cubic-metres THIRTEEN                    per second
    //    The first operand is stranded IN FRONT OF THE SECOND OPERAND'S MEASURE NOUN, so the span reads as
    //    one quantity phrase with a loose `twelve` before it — not as two operands with a missing joiner.
    //    A missing joiner is neutral; a number standing in front of somebody else's measure noun is not,
    //    and that is the trap-53 calculus this note is applying, with the wrong number in it.
    //    ⚠ STILL NOT FIXED HERE, and deliberately: the objection above stands, so a repair means the range
    //    rule LEARNING TO SEE an already-rewritten second operand (`\d+` dash measure-noun-phrase, then
    //    reorder) — a new pattern shape rather than a move, against a count of two. Priced properly now so
    //    the next reader decides on the real number.
    //    AFTER step 6, so a grouped endpoint is already one run of digits, and AFTER step 5.
    //    ⚠ THE TRAILING GUARD EXCLUDES A DOT THAT CONTINUES THE NUMBER, NOT A CLAUSE MARK — `(?![\d]|[.,]\d)`
    //    is the form step 6 above already argues for, and this arm did not follow it. A plain `.` in the
    //    class declines the whole match at exactly a sentence end, so `2005-2006.` came back untouched and
    //    read as two cardinals with nothing between them (trap 58, `review.ts`'s `clause-final` check).
    //    `\.\d` keeps every reason the dot was there: a decimal right operand and a DOI's inner pair
    //    (`10.1111/1469-8219.00039` — ascending, digit-dash-digit, and reached by no other guard here since
    //    `/` is not in the lookbehind) are still declined.
    //    ⚠ THE COMMA STAYS IN THE CLASS: this corpus writes the DECIMAL COMMA as well as the comma group,
    //    so `5–13,7` must not be claimed with its fraction left behind.
    s = s.replace(/(?<![-\d.,\p{L}\p{M}])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)(?![-\d\p{L}\p{M}]|[.,]\d)/gu,  // space, NBSP
        (whole, a: string, b: string) => (Number(a) < Number(b) ? `${a} ${RANGE} ${b}` : whole));

    // 9) DECIMALS, LAST of the numeric rules — steps 5 to 8 all need their number intact, the shared tier
    //    (which runs before this pass) needs the digit adjacent to its sign, and the tier's `NOT_VERSION`
    //    guard needs the DOT to still be there when it looks (traps 39, 46 — this layer declares the
    //    one-letter key `m`, which is exactly the key that made that guard load-bearing).
    //    2,317 decimals in the corpus; the dot was reaching `clausePunctuation` and becoming a SENTENCE
    //    BREAK inside a number.
    //    ⚠ BOTH SEPARATORS, both restricted to a 1–2 digit tail — the same discipline step 6 uses from the
    //    other side. Without the tail limit these two arms would swallow any grouped thousand step 6
    //    declined (a date comma with a four-digit tail is excluded by both).
    s = s.replace(/(?<![\d.,])(\d+)\.(\d{1,2})(?![\d])/gu, (_m, i: string, f: string) => spell(i, f));
    s = s.replace(/(?<![\d.,])(\d+),(\d{1,2})(?![\d,])/gu, (_m, i: string, f: string) => spell(i, f));
    //    ⚠ AND A THIRD ARM FOR THE LEADING-ZERO LONG TAIL, which the other two and step 6 all decline by
    //    design and which therefore fell through to `clausePunctuation` as a SENTENCE BREAK: the corpus's
    //    `0.001 mm` and `0.00004 in` (the micrometre article) read *lefela . bongwe*. A head of exactly `0`
    //    can never be a grouped thousand, so the 3-digit tail that step 6 reserves for grouping is safe here.
    s = s.replace(/(?<![\d.,])(0)[.,](\d{3,})(?![\d])/gu, (_m, i: string, f: string) => spell(i, f));

    // ⚠ A padded replacement (` le `, ` go ya go `) doubles a space that was already there and can leave one
    // at an edge. SLOT-GAP is a corpus-diff defect class; this pass must not feed it.
    return s.replace(/[^\S\n]{2,}/gu, " ").replace(/^[^\S\n]+|[^\S\n]+$/gu, "");
}
