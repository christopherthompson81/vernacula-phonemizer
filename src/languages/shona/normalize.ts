/**
 * Shona / chiShona (sn) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THIS LANGUAGE NEEDS RULES ON BOTH SIDES OF THE SHARED SYMBOL TIER, which is why it exports TWO functions
 * and `shona.ts` sequences them itself — the Kinyarwanda shape, not the Chichewa one. The coupling is forced
 * from both ends and neither half can move:
 *   · RANGES must run BEFORE the tier. Shona writes `20-50 cm`, `110-120km/hr`, `0-100 km/hr` — the unit sits
 *     after the SECOND operand, and once the tier has rewritten that into `masendimita 50` the two operands
 *     are no longer adjacent and no range rule can pair them. Run first, `20 kusvika 50 cm` still hands the
 *     tier an intact number-unit pair. DE-GROUPING has to precede the ranges for the same reason (a grouped
 *     endpoint must already be one digit run), so it goes in the same half.
 *   · The DECIMAL spell-out and the CONCORD pass must run AFTER the tier: the tier needs the digit adjacent
 *     to its sign, and the concord pass needs to know which measure noun the tier just attached.
 *
 * ⚠ SHONA HAS NO REFEREE FOR THIS LAYER AT ALL. There is no FLEURS corpus, no wikipron, and the kaikki
 * extract has fewer than 25 IPA entries; `epitran sna-Latn` is programmatic and word-only, so
 * `referee-eval.ts sn` is a regression tripwire on the g2p and says nothing about any rule below. espeak does
 * not ship Shona either, so `sources.ts`'s haystack is the corpus, the mined artifact and `attest.ts` against
 * sn.wikipedia — plus, for two words, cited web sources named at their declaration. Every count below is over
 * the 439 deduplicated segments of `tools/corpus/mined/sn.jsonc`; the artifact's own `counts` block carries
 * the whole-dump figures and is quoted as such where used.
 *
 * ⚠ TRAP 14/15 OCCURS HERE, MIRRORED TO THE LEFT, AND IS HARMLESS — measured rather than assumed, because it
 * is the defining rule of several Bantu and Turkic layers. Shona binds its associative/locative particle to
 * the FRONT of a digit run: `ra1923` ×14, plus `pa2`, `ne180`, `ye32`, `we120`, `che99.8`, `mu2020`, `ku38`
 * — 38 glued instances, and the SAME particles written with a space 26 times (`ra 2`, `pa 2`, `ne 2`,
 * `che 7`), which is trap 15's finding exactly. Nothing has to be done about it, for a reason worth stating:
 * a Shona proclitic agrees with the HEAD NOUN, not with the numeral. `gore ra1923` is "year OF-1923" and the
 * `ra` is fixed by `gore`, which is already in the text — so unlike Welsh's mutating `i` or Azerbaijani's
 * case suffix there is no agreement to compute, and every rule below may leave its operand as DIGITS.
 * Verified: `gore ra1923` reads *ɡore ra t͡ʃuru ne zana p͡fuᵐbamwe ne makumi piri ne tatu*, the particle its own
 * token and no pause.
 * ⚠ WHAT IT DOES COST is every borrowed LEFT-GUARD. The sibling layers open their rules `(?<![\p{L}\p{M}])`
 * and the tier's currency key is letter-bounded on the left; applied to Shona those reject the corpus's own
 * instances — `ye32 ° C`, `ne180 °`, `ye$150`. That is trap 27's shape reaching a Bantu language through a
 * proclitic instead of through an unspaced script. Step 3 and the degree rules below are written for it.
 *
 * ⚠ SHONA'S NUMERAL CONCORD REACHES INSIDE THE NUMBER, AND HALF OF IT IS COMPUTABLE. See numbers.ts: the
 * magnitude slot (`makumi maviri`, `mazana mana`, `zviuru zvisere`) is fixed there, and the slot that agrees
 * with the counted noun is fixed HERE, in step 8, for the measure and currency nouns the tier emits. What
 * remains uncomputable is a numeral agreeing with a noun this layer never sees.
 *
 * Deliberately not done, each with the measurement behind it:
 *   · NO CLOCK. Tabulating all 23 `N:NN` shapes in the artifact: 10 are an imported ENGLISH swimming-results
 *     table (`8:43.89 CR`), 9 are Bible chapter:verse (`Genesis 30:13`, `Rute 1:19` — and six of those
 *     segments are a ChiNdau parallel text, a different Shona variety), 2 are ratios (`zvibodzwa 3:2`,
 *     `30:15 migomo`), 2 are a list position, and exactly 2 are clocks (`iri pa 06:00hrs`, `08:00hrs`, both
 *     in one article). Chichewa shipped a clock on 12 marked instances and three sourced nouns; Shona has 2
 *     and no attested clock idiom. The `:` keeps reading as the comma pause it already was.
 *   · NO `=` READING (20 instances). The word IS attested — `-enzana`, "be equal": *"0 Kelvins inenge
 *     YAENZANA ne -273,15K"*, *"inoda KUYENZANA na (22/7)"*, *"mbiri (2) kuwanzana nenhatu (3) ZVAKAENZANA
 *     na 6"*. Every finite form carries a SUBJECT CONCORD (`ya-` class 9, `zva-` class 8, `ra-` class 5)
 *     which this layer cannot compute, and the maths article's own `zvakaenzana` is already a class mismatch
 *     for a numeric subject. The Fula `hakkunde` failure: a real word whose slot is not the slot I have.
 *   · NO MINUS / NEGATIVE WORD (6 genuine negatives: 3 coordinates, 2 currency, 1 Kelvin). Two candidates,
 *     both attested, both concorded adjectives: `hwaradada` (23 tokens / 9 articles, glossed *"-236 inhamba
 *     hwaradada: -236 is a negative number"* — but also meaning "empty", *"Musoro wake wakati hwaradada"*)
 *     and `yakagon'a` (the corpus's own `-$100` gloss). Both take NOUN + adjective (`nhamba hwaradada`),
 *     never `hwaradada <number>`. ⚠ Recorded with the playbook's warning attached: omitting a minus INVERTS,
 *     unlike a plus, so this refusal has to be revisited the moment a sign word in the operator slot appears.
 *   · NO `+` READING (11 instances). 8 are a coordinate sign redundant with the following letter (`+30 o E`,
 *     `+23.5 o`, and the corpus even names the convention: *"nhamba dzichipiwa vara (+)"*), 2 are ion
 *     charges (`Zn 2+`), 1 is a UTC offset (`GMT + 2hrs`) — the one contentful case, and nothing attests it.
 *   · NO `&` WORD. Every `&` in a Shona sentence here is an HTML entity — `&nbsp;` ×3, `&phi;`, `&lambda;`;
 *     the bare sign occurs only inside the English dictionary glosses this wiki carries (*"flour & water"*).
 *     Step 1 folds the entities, which is the whole defect, and no conjunction is spent.
 *   · NO FRACTIONS (12 `N/N`). `sources.ts` reports `[NONE] fraction-series` and there is none to compose
 *     from — `hafu` is attested (*"zvitatu nehafu (3.5%)"*) and nothing else is. Not claiming them also
 *     leaves the corpus's two slashed DATES (`31/07/1920`, `12/12/2000`) alone, which a fraction rule reads
 *     as a compound quantity.
 *   · NO COMPASS WORDS, and NOT for lack of candidates — this wiki's directional vocabulary contradicts
 *     itself. The Arctic article writes `maodzanyemba` for NORTH (*"kumaodzanyemba kwedenderedzwa reArtic
 *     (66° 33'N)"*) while *Afurika Chamhembe* (South Africa) and the Zimbabwean place articles use
 *     `chamhembe` for south and `maodzanyemba` for south. A compass word 180° out is the worst kind of
 *     confidently-wrong reading, so Chichewa's COMPASS table does not transfer. `17°51′50″S` keeps its
 *     letter; the degree itself IS now read.
 *   · NO CUBED WORD (`m³` ×1). `kubhiki`/`kubhiku` are ×0 on sn.wikipedia and `attest.ts --after
 *     makiromita,mamita,mita` returns only numerals; the wiki writes the English inline (*"185 cubic
 *     kilomita"*, *"ton/cubic metre"*) and its one Shona-ised candidate, `kyubhu`, comes from a
 *     self-declared neologism article. Playbook trap 51's floor, one language further on.
 *   · NO `kg`… IS NOT ON THIS LIST — see the units note in shona.ts. `ft`, `in`, `oz`, `mi` are: every
 *     instance is an English parenthetical glossing a metric figure already given (`makiromita 15 (9 maera)`,
 *     `(3,881 feet)`), and `mi` only ever appears inside `sk mi`.
 *   · NO BARE-EXPONENT READING (`2⁰`, `2¹`, `2²`, three instances in one binary-notation article). `pawa` is
 *     attested as the power word — *"pawa ra 2"*, *"pawa wa 2"*, *"nhamba b iri kuradanurwa ne pawa n"* —
 *     but its associative connective changes with the base's class (`ra`/`wa`), which is the `=` problem
 *     again on a smaller class.
 *   · NO LETTER NAMES, so no initialisms (794 in the whole corpus). `core/initialisms.ts` needs a
 *     `letterName` table; espeak ships no Shona and no in-repo source carries one, so wiring the pass would
 *     be a no-op. A sourcing gap, not a seam gap.
 */
import { numberToWords, withClass6Concord } from "./numbers.ts";

/**
 * The range joiner, and the best-attested word in this layer. `kusvika` ("to arrive at, until") is written
 * as a bare infix between two numerals, and the corpus GLOSSES it against the digit form twice in the same
 * sentence: *"padzinenge dzave nemwedzi mitanhatu KUSVIKA gumi nemiviri (6-12)"* and *"mazuva makumi mashunu
 * ne matanhatu KUSVIKA makumi manomwe nemavari (56-72)"*. Also `kubva pa 2.5 metres kusvika ku 3.2 metres`,
 * `makore ekubva 1955 kusvika 1959`, and sn.wikipedia's *"anofanirwa kukotsira maawa manomwe kusvika masere
 * (7-8) pazuva"*. `attest.ts` → 37 tokens / 20 articles. The PART-OF-SPEECH check that sank Fula's
 * `hakkunde` passes here: every attestation is the infix, not a preposition governing both operands.
 */
const RANGE = "kusvika";

/**
 * The DEGREE noun — and the sense check is the whole of this comment, because the obvious probe gets it
 * wrong. `attest.ts --lang sn --words dhigirii` returns 18 tokens across 14 articles, verdict `attested`,
 * and EVERY readable example is an ACADEMIC degree: *dhigirii reBachelor*, *dhigirii reMasters*, *dhigirii
 * raDhokotera*. That is `zu amaphuzu` exactly, and Chichewa's own file warns about the same polysemy.
 *
 * What closes it is a DEFINITIONAL sentence naming the SIGN, on sn.wikipedia's `Gonyo` (angle) article:
 * *"Gonyo kana ichipimwa inopimwa nechiyero chinonzi DHIGIRIYI chinova chinomirirwa nevara iri (o)"* — "an
 * angle, when measured, is measured by the unit called dhigiriyi, which is represented by this mark (o)".
 * The corpus corroborates the same spelling in the same sense: *"Mitsetse yakatarangana 10 madhigiriyi"*.
 * ⚠ NOTE THE SPELLING. `madhigirii` is ×0; the attested plural is `madhigiriyi`, with the glide.
 */
const DEGREE = "madhigiriyi";

/** The squared measure word, duplicated from the tier's `exponentWords` declaration for the one shape the
 *  tier structurally cannot reach (step 7). Sourced at that declaration in shona.ts. */
const SQUARED = "maskweya";

/** Temperature scale names. `sources.ts` reports `[ ok ] scale-names` for Shona, and the corpus writes both
 *  as loans in running text — *"chikero cheFahrenheit"*, *"mvura inogwamba pa 32 o F"*, *"pakati pezvinyanye
 *  zve 0-100o Celsius"*. Emitted after the degree noun, which is the order the corpus's own spelled-out
 *  instance uses. */
const SCALE: Readonly<Record<string, string>> = { C: "Celsius", F: "Fahrenheit" };

/**
 * The decimal separator words, ONE PER MARK, and this is the most contested decision in the layer.
 *
 * ⚠ sn.wikipedia CARRIES BOTH NUMERIC CONVENTIONS AND NAMES EACH MARK IN ITS OWN ARTICLE:
 *   · `Zviperengo zvehuwandu` — the article this corpus retains — states the UK/US convention and names both
 *     marks: *"ana KOMA vanotsvetwa mushure menzvimbo nhatu dzega-dzega zvichibva kurudyi"* (commas every
 *     three places from the right) and *"Pakati pezvibodzi nezvikamu panotsvetwa POYINDI"* (between the
 *     wholes and the parts a point is placed).
 *   · `Rupande rweMuravanegumi` (decimal fractions) states the SI/Southern-African convention and gives a
 *     worked SPOKEN reading: 0,286 read *"zero koma mbiri nomwe nhanhatu"*, 12,286 *"gumi nembiri koma mbiri
 *     nomwe nhanhatu"*.
 * ⚠ THE CORPUS SETTLES WHICH MARK IS WHICH, not which word: period-as-decimal ~40 instances against 6
 * comma-as-decimal, and 20 comma-grouped thousands against 0 period-grouped. So the text this layer reads
 * follows the first convention. Each mark therefore gets the word that names IT, which is the arrangement in
 * which nothing is invented and no reading calls a printed point a comma.
 * ⚠ THE LIMIT, STATED RATHER THAN HIDDEN: `koma` is the only one of the two attested inside a spoken
 * reading; `poyindi`'s citation names the written mark, which is the register trap that put `धन` into Hindi.
 * The mitigation is that this is not a two-word choice like hi's — English does the same job with the same
 * word, and `poyindi` IS the loan of it. `attest.ts` → `poyindi` 30 tokens / 13 articles (dominant sense the
 * GEOMETRIC point, the same polysemy English has); `koma` 52 / 9, of which the readable hits are the Ghanaian
 * LANGUAGE named Koma, so its comma sense rests on the two maths articles alone. `poindi` is ×0.
 */
const POINT_WORD = "poyindi";
const COMMA_WORD = "koma";

/** The digits of a fractional part, spaced so the number path speaks them one at a time — which is what
 *  sn.wikipedia's own worked reading does (*0,286* → "koma mbiri nomwe nhanhatu", three separate digits).
 *  ⚠ Reading `25` in `1.25` as a NUMBER would say *makumi maviri ne shanu*, a different quantity. */
const spell = (int: string, sep: string, frac: string): string => `${int} ${sep} ${[...frac].join(" ")}`;

/** Class-6 measure and currency nouns this layer or the tier emits, for the concord pass (step 8). Every one
 *  is a `ma-` plural whose numeral agrees — see `withClass6Concord`. Listed here rather than derived from the
 *  tier's declaration because the degree noun and the metre word are emitted LOCALLY and would be missed.
 *  ⚠ THE TIER'S NEWEST TWO UNIT NOUNS ARE DELIBERATELY NOT HERE. `hekita` and `rita` are the exact strings
 *  sn.wikipedia attests (see the units note in shona.ts — `mahekita` is ×0 and `marita` is **Malta**), so
 *  they are not `ma-` plurals and the concord pass has nothing to agree with. `mamirimita` IS one and is
 *  listed. ⚠ Order is safe by inspection: `mamita` and `mamirimita` diverge at their fifth letter, so
 *  neither is a prefix of the other and the alternation cannot mis-bind. */
const MA_NOUNS = "makiromita|masendimita|makirogiramu|mamirimita|mamita|matani|maawa|masekondi|madhora|maskweya|madhigiriyi";

/** Is `word` written within ~45 characters either side of this offset? The redundancy guard for the degree
 *  noun — playbook trap 12: a sentence that writes both the sign and its word must say it ONCE. BOTH sides,
 *  because Shona's measure noun normally PRECEDES its number and would otherwise be doubled. */
function saidNear(full: string, offset: number, end: number, word: string): boolean {
    return full.slice(Math.max(0, offset - 45), end + 45).includes(word);
}

/**
 * PASS ONE — everything that must reach the shared symbol tier already rewritten. Steps are ORDER-DEPENDENT;
 * each states its coupling.
 */
export function normalizeShonaPre(input: string): string {
    let s = input;

    // 1) HTML ENTITIES, FIRST — before anything looks for a number beside a unit. This corpus writes
    //    `46–76&nbsp;kg`, `35–50&nbsp;kg` and `80&nbsp;km/h`, where the entity sits exactly in the gap the
    //    tier's number-unit adjacency needs, and `&phi;`/`&lambda;` inside a coordinate caption.
    //    ⚠ NO AMPERSAND WORD IS SPENT. See the header: the bare sign occurs only in this wiki's English
    //    dictionary glosses, so folding the entities IS the whole defect. `&amp;` is unfolded first so a
    //    doubly-escaped entity does not survive as the word "amp" plus a semicolon.
    s = s.replace(/&amp;/giu, "&").replace(/&nbsp;/giu, " ");

    // 2) A SHONA PROCLITIC GLUED TO A CURRENCY SIGN, split off — and this exists because the tier's currency
    //    key is letter-bounded on the LEFT so that `US$30` is not split at the `$`. Shona's associative
    //    particle produces the same shape from the other direction (`ye$150`, twice in this corpus), and
    //    without this the sign is refused and dropped.
    //    ⚠ LOWERCASE ONLY, which is what keeps `US$` / `AUD$` intact for their own compound keys: a Shona
    //    proclitic is lowercase mid-sentence and an ISO currency code is not.
    s = s.replace(/(?<=\p{Ll})\$(?=\d)/gu, " $");

    // 3) DOTTED CAPITAL RUNS → the bare letters, BEFORE anything reads an interior dot as a phrase break
    //    (the playbook's "multi-dot abbreviations before single-dot"). `3000 B.C.`, `1000 C.E.`, `U.S.`,
    //    `v.t.` — each dot is currently a sentence pause in the middle of a Shona clause.
    //    ⚠ THE FINAL DOT IS KEPT WHEN THE SENTENCE VISIBLY ENDS, or a real break is lost. Three cases, told
    //    apart by what follows: a letter with no space is a glued word, a space then a capital (or the end
    //    of input) is a sentence end, anything else is mid-sentence.
    s = s.replace(/(?<![\p{L}\p{M}])(?:\p{Lu}\.[ \u00a0]?){2,}(?:\p{Lu}(?![\p{L}\p{M}]))?/gu, (run, off: number, full: string) => {
        const letters = run.replace(/[. \u00a0]/gu, "");
        const rest = full.slice(off + run.length);
        if (/^[\p{L}\p{M}]/u.test(rest)) return `${letters} `;
        // ⚠ PUT BACK THE SPACE THE RUN SWALLOWED (trap 10). `(?:\p{Lu}\.[ \u00a0]?){2,}` lets a space follow the
        // LAST dot too, so `(1000 C.E. - 1830)` matched through it and came out `CE- 1830` — a word glued to
        // the dash, which then also puts the range rule's left guard out of reach. The corpus's own era
        // marker is that exact string.
        const tail = /[ \u00a0]$/u.test(run) ? " " : "";
        return rest === "" || /^[ \u00a0]+\p{Lu}/u.test(rest) ? `${letters}.${tail}` : `${letters}${tail}`;
    });

    // 4) THOUSANDS DE-GROUPING, before every remaining numeric rule: a grouping comma reads as a CLAUSE PAUSE,
    //    so `1,606,000` came out *mot͡si , zana tan̤atu ne tan̤atu , zero* — three numbers and two pauses where
    //    the text has one number. 20 comma groups over 18 distinct tokens here (`431,257,698`, `$480,000,000`,
    //    `6,650km`, `25,339 m³`); `US$7 000` is the one space-grouped instance; period-grouping is ×0.
    //    ⚠ EXACTLY THREE DIGITS PER BLOCK, which is what keeps the six genuine comma-DECIMALS (`0,5m²` ×4,
    //    `273,15K` ×2) out of this rule and out of harm's way until step 9. 20 against 0 counter-examples.
    //    ⚠ THE HEAD MUST START 1–9, so a leading-zero run is never treated as a grouped thousand.
    //    ⚠ THE TRAILING GUARD IS `(?!\d|[.,]\d)`, NOT `(?![\d.,])`: the wider form declines to de-group a
    //    grouped number that is followed by a clause comma or a sentence period, and step 9 would then read
    //    the leftover separator as a decimal.
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2})(?:,\d{3})+(?!\d|[.,]\d)/gu, (w) => w.replace(/,/gu, ""));
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2})(?:[  ]\d{3})+(?!\d)/gu, (w) => w.replace(/[  ]/gu, ""));

    // 5) THE ENGLISH ORDINAL SUFFIX (`19th Century`, ×1 here). Shona writes its own ordinals as WORDS with a
    //    `chi-`/`re-` prefix — this corpus has *mwaka wechizana 19*, *zana ramakore rechi20*, *kechiviri*,
    //    *zuva repiri* — so a Latin suffix on a digit is always foreign orthography, and it was reaching the
    //    phoneme stream as a bare [tʰ]. Stripping it is the whole fix; no ordinal morphology is invented,
    //    because Shona's is already spelled out wherever the language means it. Case-insensitive (trap 7).
    s = s.replace(/(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])/giu, "$1");

    // 6) RANGES → `kusvika`. BEFORE THE TIER, and that ordering is the reason this pass exists at all: Shona
    //    writes the unit after the SECOND operand (`20-50 cm`, `110-120km/hr`, `0-100 km/hr`, `2-5 cm`), and
    //    once the tier has turned that into `masendimita 50` the operands are no longer adjacent. AFTER step
    //    4, so a grouped endpoint is already one digit run.
    //    ⚠ ASCENDING ONLY, measured, and it is doing real work in this corpus: of the descending pairs,
    //    `59 - 32 = 27` is a SUBTRACTION in a worked example, `1924 - 6 september 2019` is a birth-death pair
    //    whose second operand is a DAY, `3-0` is a football score and `1984-5` is a journal volume-year.
    //    Claiming any of them would be confidently wrong; they keep the bare juxtaposition.
    //    ⚠ THE GUARD EXCLUDES A DOT OR COMMA ON EITHER SIDE, so a DECIMAL range is declined: `2.1-3.4m`,
    //    `0.5-8.9kg`, `3.2-3.6kg`, `0.3-1.2m`, `0.5-1.0m` — 8 instances that keep reading as two juxtaposed
    //    quantities. Admitting them means re-implementing the decimal rule inside the range rule to keep the
    //    operands intact, and the same limit is accepted in the sibling Bantu layers.
    //    ⚠ AND A TRAILING LETTER IS EXCLUDED, which declines `13-16million` — an English magnitude glued to
    //    the second operand, in an English sentence.
    //    ⚠ THE TRAILING GUARD REJECTS NEITHER A `.` NOR A `,`, AND THE LEFT ONE STILL REJECTS BOTH — which is
    //    what keeps the decimal refusal above intact while fixing the clause-final one. A sentence period is
    //    not part of a number: `(?![-\d.,…])` declined every range that ENDS A CLAUSE — `March 20-21
    //    neSeptember 20-21.`, `25-30.`, `50-70.` — and those came back as two juxtaposed cardinals with no
    //    connective, the defect this rule exists to fix. Reported by `review.ts`'s `clause-final` check. The
    //    dot is not protecting an ordinal: a fleet-wide comparison of the numeral WORD for `5` against `5.`
    //    over the 47 languages whose range rule declined a clause-final dot found ZERO ordinal readings.
    //    ⚠ THE COMMA GOES TOO, AND HERE THAT IS SAFE ON SHONA'S OWN EVIDENCE (it is NOT in the so sibling —
    //    see that file). Shona writes the DECIMAL POINT, not the decimal comma, so a following comma is a
    //    CLAUSE comma and never a decimal tail; de-grouping (step 4) has already spent the grouping commas;
    //    and the ASCENDING-ONLY test is what declines a truncated second endpoint (`1984-5`) that a comma
    //    would otherwise be guarding by accident. +2 segments, both `March 20-21, ...`, no regression.
    //    ⚠ A DECIMAL RIGHT OPERAND IS STILL DECLINED, by the LEFT guard rather than this one: in `2.1-3.4m`
    //    the only candidate pair is `1-3`, and its `1` is preceded by a `.`.
    s = s.replace(/(?<![-\d.,\p{L}\p{M}])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)(?![-\d\p{L}\p{M}])/gu,
        (whole, a: string, b: string) => (Number(a) < Number(b) ? `${a} ${RANGE} ${b}` : whole));

    return tidy(s);
}

/**
 * PASS TWO — everything that needs the shared symbol tier to have run first. Steps continue the numbering.
 */
export function normalizeShonaPost(input: string): string {
    let s = input;

    // 7) BARE `m` AFTER A DECIMAL → *mamita*, the one metre reading the tier structurally cannot make.
    //    ⚠ THIS IS TRAP 46 ARRIVING THROUGH A THIRD DOOR. `m` IS declared in `units` (see shona.ts) and the
    //    tier reads `3m`, `500m`, `1,752 m` correctly — but its `NOT_VERSION` guard rejects a number with a
    //    dot glued to a ONE-LETTER key, because that shape is how `802.11g` once read as "802.11 grams" in
    //    ten languages. Shona's corpus contains no dotted version designation at all (its `version-dot` cell
    //    is entirely coordinates and decimals), while it writes SEVEN decimal metre figures — `1.5m`, `2.4m`,
    //    `1.2m`, `1.7m`, `3.4m`, `1.0m`, `1.68meters` — all of which the guard declines. So the guard is pure
    //    cost here and the case is claimed locally, in the tier's own prefix order (*mamita 1.5*).
    //    ⚠ THE COMMA ARM AND THE `²` ARM ARE HERE FOR THE SAME REASON, not for a new one. This corpus writes
    //    `0,5m²` four times and `273,15K` twice — the SI decimal comma, imported alongside the dominant
    //    point convention — and `NOT_VERSION` rejects `[.,]` alike, so `0,5m²` lost BOTH its unit and its
    //    exponent. A `³` is matched and claimed too, so the metre still reads, but no cubed word is emitted:
    //    Shona has none (see the header).
    //    ⚠ AFTER the tier (which gets first refusal on every shape it can do) and BEFORE step 10, which is
    //    what still leaves the decimal intact for this pattern to see.
    s = s.replace(/(?<![\d.,])(\d+[.,]\d+)[ \u00a0]?m([²³])?(?![\p{L}\p{M}'’ʼ\d])/gu,
        (_w, n: string, exp: string | undefined) => (exp === "²" ? `${SQUARED} mamita ${n}` : `mamita ${n}`));

    // 7b) A BARE COUNT OF HOURS → *maawa N*. `hr`/`hrs` were declared only as rate DENOMINATORS (shona.ts),
    //    so `50 km/hr` composed correctly while a bare count had no reading at all and `(8hr)`, `(8hrs)`
    //    and `2hrs` reached the IPA as *sere hr* — raw ASCII, and six of this language's twelve `RAW-LATIN`
    //    hits. The noun is sourced at the `rateDenominators` declaration; the `ma-` plural is the HEAD form
    //    (*maawa 2*, and sn.wikipedia's *"24 maawa echiedza"*, *"kukotsira maawa manomwe kusvika masere"*,
    //    31 tokens / 16 articles) while the bare `awa` is the denominator form, which is the split the
    //    corpus itself writes. The artifact GLOSSES the abbreviation against the word in the next clause:
    //    *"panobhadhara $60 pazuva (8hr). Kana akashanda 6 AWA anenge…"* and *"N anomirira AWA dzashandwa
    //    pazuva"*.
    //    ⚠ LOCAL RATHER THAN A `units` KEY, and both reasons were measured rather than predicted:
    //      · a `units` key is matchable as a DENOMINATOR too, so declaring it turned the attested
    //        *makiromita 50 pa awa* into *pa maawa* — a regression in the slot that already worked;
    //      · the tier cannot decline a clock. `06:00hrs` is TWO numerals and the unit belongs to neither
    //        half; through the tier it read *matanhatu, maawa zero* — "six, hours zero", a confidently
    //        wrong quantity where the old reading was merely raw.
    //    ⚠ SO THE COLON IS IN THE LOOKBEHIND, and `06:00hrs` KEEPS ITS RAW `hrs` AND STAYS REPORTED. That
    //    is the deliberate outcome: Shona has no attested 24-hour-clock reading here (the header's NO
    //    CLOCK finding), and a visible leak beats inventing one. The two artifact instances are the only
    //    colon-times with this suffix in the corpus.
    //    ⚠ AND NO SPACE IS ALLOWED BEFORE `hr` ON THE RATE SIDE by construction: this arm needs a DIGIT
    //    immediately before (bar one space), and `km/hr` has a slash there, so the rate path is untouched.
    //    AFTER the tier, like step 7, and BEFORE step 9 so the concord pass agrees the numeral.
    s = s.replace(/(?<![\d.,:\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?hrs?(?![\p{L}\p{M}\d])/gu, "maawa $1");

    // 8) DEGREES. `32 ° C / 90 ° F`, `17°51′50″S`, a bare `ne180 °`, and the mojibake-ish bare `o` this wiki
    //    writes for the sign in a dozen places (`0 o C`, `66.5 o N`, `+23.5 o`). The sign was dropped outright
    //    and the scale letter reached the g2p as a phoneme — `C` as [k], because Shona has no ⟨c⟩ grapheme.
    //    ⚠ THE LEFT GUARD IS `(?<![\d.,])`, NOT the siblings' `(?<![\p{L}\p{M}])`. Shona's proclitic writes
    //    `ye32 ° C` and `ne180 °`, and a letter-excluding lookbehind declines both — the header's trap-27
    //    point, made concrete. A letter to the left of a degree figure is a Shona particle, never a word this
    //    rule could damage.
    //    ⚠ THE NOUN IS SUPPRESSED WHEN THE CLAUSE ALREADY CARRIES IT (trap 12), on BOTH sides, because a
    //    Shona measure noun normally precedes its number and a before-only guard would double it.
    //    ⚠ THE BARE `o` ARM IS NARROWER THAN THE `°` ARMS: it demands a SPACE before the letter, so it cannot
    //    bite into an ordinary word. `23.5 o` and `0 o C` match; `10o` does not, and neither does any Shona
    //    word ending in a digit-adjacent o.
    //    BEFORE step 9, which needs `104.0` intact to be this reading's operand.
    const degreeBody = (n: string, off: number, end: number, full: string): string =>
        saidNear(full, off, end, DEGREE) ? n : `${DEGREE} ${n}`;
    const DEG = "(?:[ \u00a0]?°|[ \u00a0]o)";
    s = s.replace(new RegExp(`(?<![\\d.,])(\\d+(?:[.,]\\d+)?)${DEG}[ \u00a0]?([CF])(?![\\p{L}\\p{M}])`, "gui"),
        (w, n: string, c: string, off: number, full: string) =>
            `${degreeBody(n, off, off + w.length, full)} ${SCALE[c.toUpperCase()]!}`);
    s = s.replace(new RegExp(`(?<![\\d.,])(\\d+(?:[.,]\\d+)?)${DEG}(?![\\p{L}\\p{M}])`, "gu"),
        (w, n: string, off: number, full: string) => degreeBody(n, off, off + w.length, full));

    // 9) NOUN-CLASS CONCORD ON A MEASURE OR CURRENCY NOUN'S NUMBER — playbook trap 14, and the fix shape the
    //    trap prescribes: convert the operand to WORDS inside the rule that knows which noun it follows.
    //    Shona's measure and currency nouns are class 6, and the numeral counting them agrees:
    //    shonadictionary.com's own example for `dhora` is *"Ndakabhadhara MADHORA MAVIRI muchitoro"*, and
    //    this corpus writes `makore mashanu (5)`, `masvondo matatu (3)`, `mazuva matanhatu`, `makore maviri`.
    //    Without this the tier's `madhora 2` reads *madhora PIRI* — the recitation stem, which Shona does not
    //    use to quantify a noun (sn.wikipedia says so outright: *"Mazwi anoti motsi; posi, poshi haasiwo
    //    anoshandiswa pakutaura huwandu hwezvinhu"*).
    //    Measured over the artifact: 19 of the ~55 unit-adjacent numbers end in a stem that takes the
    //    concord; the rest end in a magnitude word whose concord numbers.ts already supplies.
    //    ⚠ TRAP 14's SECOND CLAUSE IS SATISFIED BY THE ORDER, not by extra work. Words-ifying an operand
    //    normally destroys the number-unit adjacency the tier matches on — here the tier has already run AND
    //    Shona puts the noun FIRST, so there is no adjacency left to lose.
    //    ⚠ `(?![.,]\d)` KEEPS IT OFF A DECIMAL: `masendimita 5.5` must not become "masendimita mashanu . 5".
    //    That is also why this precedes step 10 rather than following it.
    s = s.replace(new RegExp(`((?:${MA_NOUNS})[ \u00a0])(\\d+)(?![.,]?\\d)`, "gu"),
        (whole, noun: string, digits: string) => {
            const n = Number(digits);
            if (!Number.isSafeInteger(n) || n >= 1e6) return whole;
            return `${noun}${withClass6Concord(numberToWords(n))}`;
        });

    // 10) DECIMALS, LAST of the numeric rules — steps 6 to 9 all need their number intact, and the tier needs
    //     the digit adjacent to its sign. The separator was reaching `clausePunctuation` and becoming a
    //     SENTENCE BREAK (`.`) or a comma pause (`,`) inside a number: `12.9cm` read *ɡumi ne piri . …*.
    //     The whole-corpus count for this cell is 397.
    //     ⚠ ONE WORD PER MARK — see POINT_WORD / COMMA_WORD above for why, and for the limit on each.
    //     ⚠ THE COMMA ARM'S TWO GUARDS ARE WHAT DECLINE A COMMA-SEPARATED LIST OF NUMBERS, and this corpus
    //     has one — a worked example on the statistical mode, `renhamba dzinotevera: 3,4,6,7,8,9,10,4,11,2,1,4`.
    //     Every element is rejected, and it takes BOTH lookarounds to do it: an interior element is preceded
    //     by a comma (`(?<![\d.,])`) and every element but the last is followed by one (`(?![\d,])`), so the
    //     first pair `3,4` fails on the right and all the rest fail on the left. 0 of 11 claimed, against 6 of
    //     6 genuine comma-decimals (`0,5m²` ×4, `273,15K` ×2). ⚠ An earlier draft added "and a letter must
    //     follow", which took the same 6/0 — and then silently stopped taking `0,5m²` the moment step 7 moved
    //     its unit noun in front of the number. A guard that depends on what an EARLIER step left behind is
    //     the lifetime hazard of trap 39; these two depend only on the digits.
    //     ⚠ THE TWO ARMS TAKE DIFFERENT TAILS, AND THE ASYMMETRY IS MEASURED. The sibling Bantu layers cap
    //     BOTH at 1–2 digits, because a longer tail is a grouped thousand their de-grouping declined. That
    //     reasoning is about the PERIOD in a language that groups with periods, and Shona does not: this
    //     corpus has ZERO period-grouped thousands (its one candidate, `101.365kPa`, is standard atmospheric
    //     pressure — a decimal) against FOURTEEN period-decimals with a 3+ digit tail, which are the
    //     coordinates this wiki writes for every Zimbabwean place (`18.4622700`, `29.3490`, `-17.3750`) plus
    //     π at `3.14159`. Capped, every one of those emitted a SENTENCE BREAK in the middle of a number.
    //     14 against 0, so the period arm takes any tail. The COMMA arm keeps the 1–2 cap, because Shona's
    //     comma-grouped thousands ARE real (20 of them) and a longer tail there is one of those or a date.
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?![\d.,])/gu, (_m, i: string, f: string) => spell(i, POINT_WORD, f));
    s = s.replace(/(?<![\d.,])(\d+),(\d{1,2})(?![\d,])/gu, (_m, i: string, f: string) => spell(i, COMMA_WORD, f));

    return tidy(s);
}

/** ⚠ A padded replacement doubles a space that was already there and can leave one at an edge. SLOT-GAP is a
 *  corpus-diff defect class; neither pass may feed it. */
function tidy(s: string): string {
    return s.replace(/[^\S\n]{2,}/gu, " ").replace(/^[^\S\n]+|[^\S\n]+$/gu, "");
}
