/**
 * Sepedi / Northern Sotho (nso) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THIS LANGUAGE HAS NO REFEREE AT ALL — no wikipron, no kaikki, no epitran, no espeak (see
 * sepedi.jsonc's own header, which records the engine as `cannot-verify`).
 * ⚠ THIS LIST USED TO END "no FLEURS", AND THAT WAS TWO ERRORS IN ONE (#1102). `nso_za` EXISTS — 1,758
 * unique transcript texts — and FLEURS was never a referee in the first place: it supplies TEXT to read,
 * not IPA to score against, so its absence never belonged in a list of referees and its presence does not
 * give nso one. What it does give is a second, INDEPENDENT source for the counts below, which still rest
 * on the mined artifact alone; re-measuring them is the expensive half of #1102 and is not done here.
 * So nothing here rests on a referee score, and none is quoted. What every rule below rests on instead
 * is (a) a SOURCED word form, cited at the constant that holds it, and (b) a reading that was produced by
 * running the phonemizer. The sourcing tiers available for nso are THREE: the mined artifact
 * (`tools/corpus/mined/nso.jsonc`, nso.wikipedia dump,
 * 12,077 paragraphs), `attest.ts` against nso.wikipedia — and `nso_za` above, which no count below uses
 * yet. `sources.ts --lang nso` reports
 * `letter-names NONE · decimal-point NONE · scale-names NONE · fraction-series NONE`.
 *
 * ⚠ IT RUNS *AFTER* THE SHARED SYMBOL TIER — `normalizeSepedi(SYMBOLS(input))`, the Chichewa/Swahili order.
 * The coupling is forced from both ends:
 *   · the DECIMAL spell-out (step 9) must happen AFTER the percent/currency word is attached, or the tier
 *     sees `61 9 %` and there is no number left beside the sign;
 *   · the LOCAL UNIT step (step 5) must still see the version DOT — `802.11m` is a designation, not eleven
 *     metres — and step 9 is what spends that dot, so step 5 sits above it (playbook traps 39/46).
 *
 * ⚠ SEPEDI PUTS THE MEASURE NOUN FIRST AND LINKS IT TO ITS FIGURE WITH THE CLASS-8/10 CONCORD `tše`. This is
 * the shape every single unit attestation takes, without exception:
 *
 *     dikhilomithara tše 2,798      dimithara tše 100        dikhilograma tše 7.5
 *     dikhilomithara tše 40         dimithara tše 2,6        dimilimithara tše 60
 *     diranta tše dikete tše 1,6    disekwere-khilomithara tše 1 221 037
 *
 * `tše` is the same particle `numbers.ts` already spends as `class8Concord` in *dikete tše pedi*, so the two
 * can never name different concords — it is read from the manifest.
 *
 * ⚠ AND THAT IS WHY THE UNITS ARE LOCAL RATHER THAN ON THE SHARED TIER (playbook trap 47, reasons 1 and 4).
 * `unitPrefix` gets the ORDER right and nothing else does:
 *   1. THE EXPONENT COMPOUND RE-PREFIXES ITS HEAD. Sepedi writes `disekwere-khilomithara`, not
 *      `disekwere dikhilomithara` — the class-10 `di-` migrates to the FRONT of the compound and the head
 *      noun appears in its bare form. `exponentWords.position` has four values and none of them can express
 *      a head that changes shape.
 *   2. THE CUBED WORD IS UNSOURCEABLE, and a HALF refusal is worse than the raw symbol (trap 53). With
 *      `exponentWords` undeclared the tier's own fallback is `${q} ${head}${exp}` — which for a
 *      `unitPrefix` language emits the number FIRST and strands the superscript: `5 dimithara tše²`. That
 *      is a defect in `src/core/normalizeSymbols.ts` and is reported to the backlog rather than worked
 *      around here; keeping the unit path local means nso never reaches it.
 *   3. THE ONE-LETTER KEY `s` MUST BE A DENOMINATOR AND NEVER A UNIT. `\ds` is ×62 in the corpus and 60 of
 *      them are DECADES — `1910s`, `1940s`, `1960s`, `1990s`, `2000s` — against two genuine seconds
 *      (`9.90s`, `9.99s`). `rateDenominators` expresses that, but only alongside a tier `units` map, which
 *      reasons 1 and 2 have already ruled out.
 *
 * Deliberately not done, each with the measurement behind it:
 *   · NO DECIMAL-SEPARATOR WORD, and the refusal survived a dictionary-grade check rather than resting on
 *     silence (the Igbo lesson). nso.wikipedia's own punctuation article names the character —
 *     *"khutlo(.) ; fegelwana(,) ; leswao potsiso(?) , leswao la makalo (!)"* — so `khutlo` is a real,
 *     attested Sepedi word for the mark `.`. It is the mark's NAME, in the wrong REGISTER for what a reader
 *     says inside `9.84`; adopting it would read that as "nine FULL-STOP eight four". This is the trap that
 *     put `धन` into Hindi, and it is the more dangerous form of it because the citation looks perfect.
 *     `desimale`, `tikimale` and `khoma` are ×0. The separator is removed and the fractional digits are read
 *     one at a time — which is also what `sources.ts` recommends for `[NONE] decimal-point`.
 *   · NO `+ − × ÷ = < >` READING. `concept.ts --items Q32043,Q40754,Q40276,Q1226939 --langs nso` returns a
 *     complete blank — no Wikidata label and no article title in nso, st or tn for addition, subtraction,
 *     multiplication or division. The corpus's 8 `=` are one arithmetic line (`64+8+1 = 73`), five
 *     EasyTimeline chart directives (`ScaleMajor = unit:year`) and two English infobox rows; its 4 `×` are
 *     all the same English phrase `4 × 100 metres relay`; its 8 `+` are wind readings (`+2.0 m/s`), antenna
 *     gains (`+73 dBm`) and a percentage change. Nothing attests what a Sepedi reader puts in any of those
 *     slots, and the playbook's fleet-wide finding is that a written sign is absent from text BY
 *     CONSTRUCTION. Left visible to the DROP gate rather than guessed.
 *   · NO `£` / `€` READING. The obvious candidate is refuted rather than merely unfound: `diponto` is ×5 on
 *     nso.wikipedia and **every one is the POUND WEIGHT**, glossed against kilograms in the same sentence —
 *     `dikhilograma tše 7.5 (diponto tše 17)`, `dikhilograma tše 5 (diponto tše 11)`. Declaring it would
 *     read every sterling amount as a mass. `diyuro` is ×0. Same shape as the playbook's `ms paun`.
 *   · NO `°F` SCALE NAME. `Fahrenheit` is ×0 in every source nso has. `°C` IS read — see CELSIUS.
 *   · NO LETTER NAMES, so no initialisms (2,975 in the corpus). `core/initialisms.ts` needs a `letterName`
 *     table; `sources.ts` reports `[NONE] letter-names — espeak does not ship this language at all`, and no
 *     in-repo source carries one. Wiring the pass without it is a NO-OP. A sourcing gap, not a seam gap.
 *   · NO FRACTION RULE. `sources.ts` reports `[NONE] fraction-series`, and of the corpus's 13 `N/N` shapes
 *     exactly ONE is a fraction (`ke 1/100 ya metšo ya mašeleng`); the rest are financial years (`2017/18`,
 *     `2015/16`, `2020/2021`), award years (`1995/1996`) and a time signature (`4/4`).
 *   · NO CLOCK **WORD**. The retained corpus contains no `N:NN` at all; the whole-corpus `clock` cell is
 *     65, and with nothing retained there is no instance to tabulate the marker distribution from. No hour
 *     noun is sourced, so none is emitted, and that half of the refusal stands.
 *     ⚠ BUT "THERE IS NOTHING TO MEASURE" WAS TRUE OF ONE CORPUS ONLY (#1108). `nso_za` carries 13
 *     sentences and 16 instances, 13 of 13 a time of day, and most with the very marker the bullet says
 *     could not be tabulated (`am`, `pm`, `mesong`, `nako ya selegae`). What that supports is not a word
 *     but the PAUSE removal — see `DIGIT_COLON_RUN` above, which emits nothing and therefore does not need
 *     the marker distribution the refusal was waiting on.
 *   · NO `ha` UNIT KEY, though `hektare` is attested ×5. Digit-adjacent `ha` is ×0 in the corpus, while `ha`
 *     is an extremely common word in the Sesotho that contaminates this wiki (`ha ho tla ho keteka`,
 *     `ha a bua le parishe`). A key with no true positive and a live false-positive population is a misfire
 *     generator (trap 9).
 */
import { makeBareUnitNormalizer, makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import type { SepediNumbers } from "./numbers.ts";

const N = loadManifest<{ numbers: SepediNumbers }>(import.meta.url, "sepedi.jsonc").numbers;

/** The class-8/10 concord `tše`, read from the manifest so this file and `numbers.ts` can never name two
 *  different particles for one language — the number path already spends it in *dikete tše pedi*. */
const TSE = N.class8Concord;
/** The conjunction `le`, likewise from the manifest — the number path's *lekgolo LE masomehlano*. */
const AND = N.and;

/**
 * THE UNIT TABLE — key → [citation form, counted form].
 *
 * ⚠ INDEX 0 IS THE BARE NOUN AND INDEX 1 ADDS THE CONCORD, and that split is what the two consumers need:
 * the counted form is the attested collocation (`dikhilomithara tše 40`), while a unit standing ALONE — a
 * caption, a table header — must not end in a dangling particle, so `makeBareUnitNormalizer` gets the bare
 * noun. Index 0 is also what `1 km` takes; a one-count is ×0 in this corpus except `1 kg` ×2, and
 * "dikhilograma 1" under-specifies the number of the noun where "dikhilograma tše 1" would be wrong about it.
 *
 * ⚠ EVERY STRING HERE IS A TOKEN SOMEBODY ELSE WROTE. Counts are `attest.ts --lang nso` token hits /
 * distinct articles on nso.wikipedia, and the SENSE of each was read from the printed prose:
 *
 *   km  dikhilomithara  16/10  `dikhilomithara tše 2,798 (1,739 mi) tša lebopong`, `… tše 40 ka borwa bja toropo`
 *   m   dimithara       37/10  `dimithara tše 100`, `dimithara tše 2,6 le dikhilograma tše 135`
 *   cm  senthimetara     1/1   `5–8 senthimetara (2–3 inches) ka bophara` — glossed against inches
 *   mm  dimilimithara    2/1   `matlakala a botelele bja dimilimithara tše 60 goya go 200`
 *   kg  dikhilograma    10/2   `boima bja dikhilograma tše 7.5 (diponto tše 17)`, `… tše 5 … tše 8`
 *
 * ⚠ `cm` KEEPS THE SINGULAR-SHAPED NOUN IN BOTH SLOTS, deliberately: `disenthimetara` is ×0 and the one
 * attestation is a PLURAL quantity written with the bare noun and no concord (`5–8 senthimetara`). Writing
 * the `di-`/`tše` pair here would be composing a form the language's own text declines to write.
 *
 * ⚠ `dikilogeramo` IS THE OTHER KILOGRAM SPELLING (×1/1, `di ka imela go feta dikilogeramo tše 250`) and is
 * NOT shipped: `dikhilograma` outnumbers it 10-to-1 across two independent articles and is the spelling that
 * matches the attested `khilomithara` aspirate. Recorded so the loser is not re-derived as a discovery.
 */
const UNIT: Readonly<Record<string, readonly [string, string]>> = {
    km: ["dikhilomithara", `dikhilomithara ${TSE}`],
    m: ["dimithara", `dimithara ${TSE}`],
    cm: ["senthimetara", "senthimetara"],
    mm: ["dimilimithara", `dimilimithara ${TSE}`],
    kg: ["dikhilograma", `dikhilograma ${TSE}`],
};

/**
 * THE SQUARED COMPOUND, per unit — and it is a table rather than a modifier because the compound RE-SHAPES
 * its head. `disekwere-khilomithara` (3 hits / 2 articles: `lefelo la disekwere-khilomithara tše 1 221 037
 * (disekwere-khilomithara tše 471 445)`, `le nabile disekwere-khilomithara tše 30 560 860`) takes the class-10
 * `di-` on the FRONT of the compound and leaves the head bare, so it is not `di-khilomithara` with a modifier
 * bolted on.
 *
 * ⚠ THE PATTERN IS PRODUCTIVE AND THE WIKI PROVES IT ON A DIFFERENT UNIT: `Sekwere-maele se se hwetšago kudu
 * sa Afrika` — the richest SQUARE MILE in Africa. `sekwere-`/`disekwere-` prefixed to a measure noun is the
 * construction, which is why `m²` is composed here from the attested singular `mithara` (`gola go feta
 * mithara e tee ka botelele`). That is composing from the language's own morphology, not coining a word.
 *
 * ⚠ NO CUBED ROW, AND NO cm²/mm²/kg² ROW EITHER. Nothing attests a cube word for nso and nothing attests
 * these compounds; step 5 therefore REFUSES THE WHOLE MATCH for them (trap 53) rather than emitting a length
 * where the text wrote an area, which is what `790 km2` → "790 kilometres two" cost Igbo.
 */
const SQUARED: Readonly<Record<string, string>> = {
    km: `disekwere-khilomithara ${TSE}`,
    m: `disekwere-mithara ${TSE}`,
};

/**
 * RATE DENOMINATORS. `ka` is the corpus's own per-word — *mehlare ya mo e ka bago 100 KA hektare* ("about
 * 100 trees per hectare"), *R50,000 … KA kgwedi* ("per month"). The two nouns:
 *   · `iri` — hour. `Iri ke motso wa kelo ya nako. Iri e lekana le metsotso ye 60.` (14 hits / 10 articles)
 *   · `motsotswana` — second, and the attestation glosses THE VERY SYMBOL: `Motsotswana (taetšo ya SI : s)
 *     ke leina la motšo wa nako` — "the second (SI symbol: s) is the name of the unit of time" (3/2).
 * The SINGULAR is right in a denominator: the rate is one hour, one second.
 */
const PER = "ka";
const DENOM: Readonly<Record<string, string>> = { h: "iri", s: "motsotswana" };

/**
 * The rand, `R`. `Ranta (rand) ke mašeleng a Afrika Borwa` — nso.wikipedia's own definitional gloss of the
 * currency, and `ge R ele taetšo ya Ranta` ("where R is the symbol for the rand") in the corpus itself, which
 * is an attestation of the SIGN and the word in one clause. The counted form is likewise attested:
 * `diranta tše dikete tše 1,6`, `e tšweletša diranta tše dimilione tše 100`.
 */
const RAND = `diranta ${TSE}`;
/** The dollar. `dimilione tše 450 tša ditolara`, `ba phela bodiiding ka ditolara tša PPP` (2 hits / 2 arts). */
const DOLLAR = `ditolara ${TSE}`;

/**
 * The Celsius scale name — the ONE degree reading this language can source, and it is deliberately shipped
 * without a degree NOUN.
 *
 * ⚠ THE DEGREE NOUN IS NOT MERELY UNFOUND, IT IS REFUTED. `dikgato` ×16 over 13 articles is the obvious
 * candidate and every sense is a step or a stage — decisively, `bodiba bja dimetara tše 3 (dikgato tše 10)`,
 * a pit of 3 metres = 10 FEET. It is this wiki's word for the imperial foot, so declaring it would read every
 * temperature in the language as a length. `dikhutlo` ×2 is the geometric ANGLE (`dikhutlo tše mmalwa tša
 * tšona di bogale` — several of its angles are acute), which is the object, not the unit. `digirii`,
 * `digrii`, `tikirii` are ×0.
 *
 * ⚠ `Celsius` ITSELF IS LEAD-GRADE EVIDENCE AND IS SAID SO HERE: 2 hits in ONE article, `di be di le magareng
 * ga 2.24º le 1.02º Celsius … fasefase go - 3.12º Celsius`. What makes it shippable anyway is that it is the
 * international scale NAME written by this wiki in exactly this slot, and that the alternative is worse:
 * claiming the sign and saying nothing DELETES the scale from the sentence, while `1.2 °C` currently reads
 * `tʼee . pʼedi k` — a sentence break inside the number and the scale letter pronounced as a bare [k].
 * `Fahrenheit` gets no such treatment: it is ×0, so `°F`'s letter is claimed and left unsaid.
 */
const CELSIUS = "Celsius";

/**
 * Compass points, for a degree that is a COORDINATE rather than a temperature (`55°S`). Each is an ordinary
 * high-frequency Sepedi direction noun in this corpus's own geography — borwa ×22 (`200 km borwa bja
 * Mauritius`), leboa ×10 / lebowa ×2 (`156 km lebowa la Queenstown`), bohlabela ×13, bodikela ×5.
 */
const COMPASS: Readonly<Record<string, string>> = {
    N: "leboa", S: "borwa", E: "bohlabela", W: "bodikela",
};

/**
 * THE SPAN JOINER — `go ya go`, "going to". Attested between bare figures three times in the retained corpus
 * and in exactly the frame this rule emits:
 *
 *     batho ba, ba mo e ka bago 7,000 GO YA GO 3,500 B.C.E.
 *     yeo e fetogilego go tloga ka 2000 GO YA GO 2015
 *     mehlare ya 800 GO YA GO 3300 ya di hektare
 *
 * ⚠ DESCENDING SPANS ARE ADMITTED, and that is a MEASURED divergence from the ascending-only guard nya and rw
 * ship (trap 55 — a sibling's guard travels as badly as its vocabulary). The first attestation above is
 * itself descending (7,000 → 3,500 B.C.E.), and the corpus's two dashed descending spans are the same kind of
 * thing: `33,500–32,500 BP` and `26,000-23,500 BC`, dates counted backwards from the present. An
 * ascending-only rule would decline all three.
 */
const UNTIL = "go ya go";

/** The digits of a fractional part, spaced so the number path speaks them one at a time. ⚠ Reading `84` in
 *  `9.84` as a NUMBER would say *masomeseswai nne* — "eighty-four" — a different quantity from "eight four". */
const spell = (int: string, frac: string): string => `${int} ${[...frac].join(" ")}`;

/** Is `word` written within ~45 characters either side of this offset? The redundancy guard for CELSIUS
 *  (trap 12: a text that writes both the sign and its word must say it ONCE). BOTH SIDES, because the one
 *  corpus sentence that writes the scale name writes it AFTER two figures that each carry the sign —
 *  `magareng ga 2.24º le 1.02º Celsius` — where a before-only guard would say it three times. */
function saidNear(full: string, offset: number, end: number, word: string): boolean {
    return full.slice(Math.max(0, offset - 45), end + 45).includes(word);
}

/**
 * THE SHARED SYMBOL TIER, for the three classes it can express for nso. Why each field is set as it is:
 *
 * · `percent` / `percentPrefix` — the noun PRECEDES its figure, in both attested forms:
 *   `peresente ye masometharo tshela(36) ya barutiši` ("36 percent of teachers") and, glossed against the
 *   sign itself, `(gantši ka fase ga diperesente tše tharo (3%))`. The corpus writes the sign postposed
 *   (`40% ya palomoka`, ×48 in the retained text, all postposed) and the tier rewrites both orders to the
 *   prefix one. Two count forms because BOTH are attested and they differ in concord as well as number:
 *   cl.9 `peresente ye` for one (compare `iri ye tee`), cl.10 `diperesente tše` for the rest.
 *   ⚠ `dipersente` ×4/2 and `phesente` ×1/1 are the same word in other spellings and are NOT shipped;
 *   `diperesente` is the spelling whose attestation stands beside the sign.
 * · `currency` / `currencyPrefix` — `$` and `US$` only. `R` is claimed LOCALLY in step 4, because it needs a
 *   guard the tier cannot express; `£`/`GB£`/`€` are declined (see the header).
 * · `magnitudes` — the loan magnitudes this corpus writes beside a currency figure (`R125 milione`,
 *   `R6.4 bilione`, `US$2.1 pilione`, `$450 dimilione`). Declared so the magnitude travels with the number
 *   instead of being stranded behind the noun, which is the shape the language itself writes:
 *   `diranta tše dimilione tše 100`.
 *   ⚠ THE PLAYBOOK'S "one declaration, two consumers" WARNING WAS CHECKED, NOT ASSUMED: `magnitudes` also
 *   gates `magAltU`, the UNIT path's connective hop — and nso declares no tier `units` at all, so there is
 *   no second consumer to break.
 * · `ampersand` — `le`, the manifest's own conjunction, already spent by the number path in *lekgolo le
 *   masomehlano*. ⚠ ALL of this corpus's real ampersands sit inside ENGLISH names (`R&B` ×2,
 *   `Mail & Guardian`, `Poso & Mohlokomedi`, `Science &Technology`), so they are trap-34 text and are NOT
 *   the evidence for the word; reading a conjunction sign as the language's conjunction cannot be the wrong
 *   word. `&nbsp;` — which is 6 of the retained corpus's ampersand hits — is decoded UPSTREAM by
 *   `core/markup.ts` before this layer runs, verified by probe rather than copied from Chichewa.
 * · `units` / `exponentWords` / `multiply` / `bareExponent` are NOT declared — see the header for why the
 *   unit path is local, and for the four sign classes nothing attests.
 */
const SYMBOLS = makeSymbolNormalizer({
    // ⚠ THE CONCORD IS PART OF THE WORD HERE, and it is a DIFFERENT one in each slot — cl.9 `ye` for the
    // singular noun, cl.10 `tše` for the plural. Only the second can come from the manifest.
    percent: ["peresente ye", `diperesente ${TSE}`],
    percentPrefix: true,
    currency: { "US$": [DOLLAR], $: [DOLLAR] },
    currencyPrefix: true,
    magnitudes: ["dimilione", "milione", "dibilione", "bilione", "dipilione", "pilione"],
    ampersand: AND,
});

/** The bare unit token — a `km` with no numeral of its own. The guards (never one letter, no vowel, exact
 *  case, not before an exponent or a slash) live in `core/normalizeSymbols.ts`; only the WORD is local, and
 *  it is index 0 of the table, the citation form with no dangling concord. */
const BARE_UNIT = makeBareUnitNormalizer(Object.entries(UNIT).map(([k, [cite]]) => [k, cite] as const));

/** Unit keys longest-first, so `km` is tried before `m`. */
const UNIT_ALT = Object.keys(UNIT).sort((a, b) => b.length - a.length).join("|");
const DENOM_ALT = [...Object.keys(UNIT), ...Object.keys(DENOM)].sort((a, b) => b.length - a.length).join("|");

/**
 * ⚠ A DOTTED DESIGNATION IS NOT A QUANTITY, and a one-letter unit key will claim it (playbook traps 28/46/52).
 * `802.11m` must not read as "802.11 metres". BOTH HALVES ARE NEEDED: the lookahead stops a match beginning
 * at the front of the designation, and the lookbehind stops one beginning inside it — rejected at `802`, the
 * engine simply retries from `11m` (trap 52, three independent sightings in one batch). This is also why
 * step 5 runs ABOVE step 9: the guard works by SEEING THE DOT, and step 9 is what spends it (trap 39).
 */
const NOT_VERSION = String.raw`(?<![\d.,])(?!802[.,]11[a-zA-Z](?![a-zA-Z\d]))`;

/** Normalize one Sepedi input string — the shared symbol tier first, then this language's own rules. Steps
 *  are ORDER-DEPENDENT; each states its coupling, and the tier's position is argued in the header. */
/**
 * A COLON BETWEEN TWO DIGIT RUNS LOSES ITS PAUSE, and that is ALL it does (#1108).
 *
 * ⚠ IT EMITS NO WORD, so it makes no claim about what the figure is and needs no sourced hour noun —
 * which nso does not have. `:` is `clausePunctuation`, so `ka 11:35 pm` read *kʼa lesometʼee **,**
 * masometʰaro ɬano pʼm*, a phrase break inside one time expression.
 * ⚠ UNGUARDED, AND THAT IS MEASURED RATHER THAN LAZY. The refusal below is right that the mined artifact
 * retains no `N:NN` at all — so it has no counter-examples either. Over FLEURS `nso_za`: 13 distinct
 * sentences, 16 instances, **13 of 13 a TIME OF DAY**, zero verse references, zero sports times, zero
 * census brackets. With no population to tell apart, a marker guard would only cost the four that carry
 * no marker (`Ka 11:20`, `ka morago ga 11:00`).
 * ⚠ A COLON FOLLOWED BY A SPACE IS UNTOUCHED — there it is introducing something and the pause belongs.
 */
const DIGIT_COLON_RUN = /(?<![\d:])(\d{1,2})((?::\d{2})+)(?![\d])/gu;
const COLON_G = /:/gu;

export function normalizeSepedi(input: string): string {
    let s = SYMBOLS(input);

    // 0) The digit-colon-digit run loses its colon — see DIGIT_COLON_RUN. First, because every numeric
    //    step below reads a digit run and the colon was splitting one in half.
    s = s.replace(DIGIT_COLON_RUN, (_m, head: string, rest: string) => head + rest.replace(COLON_G, " "));

    // 1) DOTTED CAPITAL RUNS → the bare letters, BEFORE anything reads an interior dot as a phrase break
    //    (multi-dot abbreviations before single-dot). The retained corpus writes `B.C.E.`, `C.E.`, `F.W.`,
    //    `J.C.`, `M.C.`, `P.H.`, `T.L.`, `A.O.`, `B.P.J.` — each currently emitting one SENTENCE PAUSE per
    //    dot in the middle of a Sepedi sentence, and the whole-corpus `dotted` cell is 58.
    //    ⚠ THE FINAL DOT IS KEPT WHEN THE SENTENCE VISIBLY ENDS, or `…kua Korea Borwa B.C.E.` loses its
    //    sentence break. Three cases, told apart by what follows: a letter with NO space is a glued word; a
    //    space then a capital, or end of input, is a sentence end (keep the dot); anything else is
    //    mid-sentence. ⚠ A DOT IS ONLY EVER KEPT, NEVER ADDED — rw's correction to the Chichewa rule.
    //    ⚠ THE OPTIONAL TRAILING CAPITAL is what keeps a dotless-final run whole rather than splitting its
    //    last letter off. It is bounded by `(?![\p{L}\p{M}])`, so it cannot reach into the next word.
    //    ⚠ THE LETTERS ARE JOINED WITH A HYPHEN, NOT GLUED — and in this language that is not cosmetic. The
    //    tokenizer's word arm is `LATIN_RUN`, which does not include `-`, so a hyphen makes each letter its
    //    own token; GLUED, the run is one word and meets the g2p's DIGRAPH table. Measured on the corpus's
    //    own initials: `T.L.` glued reads `t͡ɬʼ` — ⟨tl⟩ is the Sepedi lateral affricate — and `P.H.` reads
    //    `pʰ`, the aspirate. Two of the nine dotted runs in the retained text turn into a single phoneme the
    //    text never wrote. That is trap 56 in miniature: a defect that produces a plausible READING, which no
    //    leak class can see. Hyphenated they read `tʼ l` and `pʼ ɦ`, which is what spelling out looks like.
    //    ⚠ NO LETTER-NAME TABLE EXISTS FOR nso (`sources.ts`: espeak does not ship this language at all), so
    //    `core/initialisms.ts` would be a no-op and this is the best available: the SENTENCE PAUSES go, which
    //    is the measured defect, and no name is invented.
    s = s.replace(/(?<![\p{L}\p{M}])(?:\p{Lu}\.[ \u00a0]?){2,}(?:\p{Lu}(?![\p{L}\p{M}]))?/gu, (run: string, off: number, full: string) => {  // space, NBSP
        const letters = [...run.replace(/[. \u00a0]/gu, "")].join("-");  // NBSP
        const rest = full.slice(off + run.length);
        if (/^[\p{L}\p{M}]/u.test(rest)) return `${letters} `;
        if (!run.endsWith(".")) return letters;
        return rest === "" || /^[ \u00a0]+\p{Lu}/u.test(rest) ? `${letters}.` : letters;  // space, NBSP
    });

    // 2) THOUSANDS DE-GROUPING, before every remaining numeric rule: a grouping comma reads as a CLAUSE
    //    PAUSE and a grouping period as a FULL STOP, so `1,600,000` came out *tʼee , makxolot͡sʰela ,
    //    lefeela* — "one, six hundred, zero" — and `216.061 badudi` broke one population figure into two
    //    sentences.
    //
    //    ⚠ SEPEDI'S WIKI WRITES ALL THREE CONVENTIONS AT ONCE, and each arm is load-bearing. Measured over
    //    the artifact's 405 retained segments:
    //
    //        `,` + exactly 3 digits   28   ALL grouping    1,600,000 · 306 897 · 2,798 · 20,000 · 3,500
    //        `,` + 1–2 digits          4   3 decimal (221,6 km² · 430,9 km² · +3,4%) + ONE LIST, `(1,2,3,4,5,6)`
    //        `.` + exactly 3 digits    2   ALL grouping    216.061 badudi · 1.800.000 badudi
    //        `.` + 1–2 digits         70   ALL decimal     9.84 · 61.9% · 10.4 cm · 1.2 °C · 6.4 bilione
    //        ` ` + 3-digit blocks     many ALL grouping    30 560 860 · 1 221 037 · 471 445 · 170 000
    //
    //    28-against-0 for the comma and 70-against-0 for the dot decimal are what let both separators carry
    //    both roles here without either rule guessing: the discriminator is the BLOCK LENGTH, never the
    //    character. `216.061` and `221,6` sit in the SAME TWO ARTICLES (the Brazilian/Chilean city stubs,
    //    which use continental typography throughout), which is the strongest possible demonstration that
    //    neither separator identifies itself in this corpus.
    //    ⚠ THE HEAD MUST START 1–9: a grouped number never opens with a leading zero, and without it the
    //    space arm eats the neighbours of any `0 620`-shaped identifier.
    //    ⚠ THE COMMA ARM'S TRAILING GUARD IS `(?!\d|[.,]\d)` — it must decline a grouped run that is followed
    //    by a further separator-plus-digit, or a partial match inside a longer chain leaves a stray separator
    //    for step 9 to read as a decimal.
    //    ⚠ AT MOST FOUR GROUPS, AND THAT CAP IS A MEASURED REPAIR RATHER THAN TIDINESS. The corpus's base-16
    //    article tabulates powers of two as space-grouped runs of 43 and 60 digits
    //    (`2 658 455 991 569 831 744 654 692 615 953 842 176`). De-grouped, that exceeds
    //    `Number.MAX_SAFE_INTEGER`, so the engine's own `Number(m[2])` yields `2.658455991569832e+42` and
    //    `numberToWords` spells the EXPONENT NOTATION digit by digit — the reading came out
    //    *seɲane pʼedi t͡sʰela … tʰaro pʼedi **e** tʰaro t͡sʰela*, with the letter ⟨e⟩ of `e+42` voiced as a
    //    numeral. Four groups is 15 digits at most, inside the safe-integer range, and the corpus's largest
    //    genuine grouped number is `30 560 860` (three). The precision limit itself is an ENGINE defect, not
    //    a normalization one, and is recorded in the investigation doc rather than worked around here.
    s = s.replace(/(?<![\d.,])[1-9]\d{0,2}(?:,\d{3}){1,4}(?!\d|[.,]\d)/gu, (w) => w.replace(/,/gu, ""));
    s = s.replace(/(?<![\d.,])[1-9]\d{0,2}(?:\.\d{3}){1,4}(?!\d|[.,]\d)/gu, (w) => w.replace(/\./gu, ""));
    s = s.replace(/(?<![\d.,])[1-9]\d{0,2}(?:[ \u00a0\u202f\u2009]\d{3}){1,4}(?!\d)/gu, (w) => w.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space

    // 3) THE ENGLISH ORDINAL SUFFIX (`4th`, `16th`, `19th`). Sepedi writes its own ordinals as WORDS and this
    //    corpus does exactly that beside the Latin form — *"mokgatlokgolo wa lesome senyane (19th)"*,
    //    *"wa lesome tshela (16th)"* — so a Latin suffix here is foreign orthography sitting on a digit, and
    //    it was reaching the phoneme stream as a bare [tʰ]. Stripping it is the whole fix; no ordinal
    //    morphology is invented, because the language's own is already written out wherever it is meant.
    //    Case-insensitive (trap 7). BEFORE the range step, so `1990s-2000s` cannot be confused, and before
    //    step 9 so no decimal shape is disturbed.
    s = s.replace(/(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])/giu, "$1");

    // 4) THE RAND SIGN — LOCAL, because the guard is a measurement the shared tier cannot hold. `R` is also
    //    South Africa's ROUTE prefix, and this corpus writes both:
    //
    //        CURRENCY  9   R9 bilione · R20 milione · R125 milione · R300 Milione · R800 milione
    //                      R6.4 bilione · R11.8 milione · R22.8 milione · R50,000
    //        ROADS     2   "ditsela tše pedi tše kgolo, e lego R37 le R555"   (two major roads)
    //
    //    ⚠ THE DISCRIMINATOR IS WHAT THE FIGURE CARRIES, not the number's size: every one of the nine
    //    currency instances has a MAGNITUDE word after it, or a decimal point, or a grouping separator, and
    //    NEITHER road number has any of the three. 9/9 against 0/2. A bare `R100` is therefore left unread
    //    rather than guessed — an unclaimed sign is visible to the DROP gate, where a route read as money is
    //    not visible to anything.
    //    ⚠ AFTER step 2, so `R50,000` is already one digit run by the time the grouping test would have been
    //    needed; the arm below tests the ORIGINAL text through the `\d` shape that survives de-grouping (a
    //    decimal) plus the magnitude, and the grouped case reaches it as a plain long run — which is why the
    //    long-run alternative `\d{4,}` is there and why `R37`/`R555` (2–3 digits) still fall through.
    //    ⚠ THE NOUN PRECEDES ITS FIGURE and the magnitude stays with the number, matching both the attested
    //    order (`diranta tše dimilione tše 100`) and what the tier does for `$` two steps earlier.
    const MAG = "dimilione|milione|dibilione|bilione|dipilione|pilione";
    s = s.replace(
        new RegExp(String.raw`(?<![\p{L}\p{M}\d])R[ \u00a0]?(\d+\.\d+|\d{4,})([ \u00a0](?:${MAG}))?(?![\p{L}\p{M}\d])`, "giu"),  // space, NBSP
        (_w, num: string, mag: string | undefined) => `${RAND}${mag ?? ""} ${num}`,
    );
    s = s.replace(
        new RegExp(String.raw`(?<![\p{L}\p{M}\d])R[ \u00a0]?(\d+)([ \u00a0](?:${MAG}))(?![\p{L}\p{M}\d])`, "giu"),  // space, NBSP
        (_w, num: string, mag: string) => `${RAND}${mag} ${num}`,
    );

    // 5) UNITS — noun first, concord, then the figure. LOCAL for the three reasons in the header.
    //    ⚠ ABOVE step 9 and BELOW step 2: `NOT_VERSION` works by seeing the version DOT, which step 9 spends
    //    (trap 39), and a grouped operand must already be one digit run or `19,500 km` matches only its last
    //    three digits.
    //    ⚠ THE OPERAND IS ANCHORED ON BOTH EDGES (`(?<![\d.,])` … `(?![\d.,])` around the whole number), not
    //    just in front of the key — a lookbehind rejects a starting POSITION and the engine simply starts
    //    later (trap 52).
    //    ⚠ THREE BRANCHES, and the ORDER inside the match matters: a rate (`km/h`, `m/s`) and an exponent
    //    (`km²`, `km2`) are consumed in the SAME match as the unit, so neither can be stranded after the
    //    noun is substituted.
    //    ⚠ AN UNSAYABLE POWER REFUSES THE WHOLE MATCH (trap 53). `cm²`, `kg³`, `m³` return the text
    //    untouched rather than emitting a LENGTH where the writer wrote an area or a volume — that is the
    //    `790 km2` → "790 kilometres two" defect, and it is worse than the raw symbol it would replace.
    //    ⚠ A RATE WITH AN UNDECLARED DENOMINATOR LIKEWISE REFUSES THE WHOLE MATCH, for the same reason: half
    //    a reading is not a reading.
    //    Case-insensitive on the key, because the corpus writes `Km`/`KM` beside `km` (trap 7); the exponent
    //    branch's ASCII `2`/`3` needs the preceding character to be a LETTER so `km 2` (a kilometre, then
    //    two) is not read as an area while `km ²` is.
    s = s.replace(
        new RegExp(
            `${NOT_VERSION}(\\d+(?:[ \u00a0\u202f\u2009]\\d{3}(?!\\d)|[.,]\\d+)*)(?![\\d.,])[ \u00a0\u202f\u2009]?(${UNIT_ALT})` +  // NBSP, NNBSP, thin space
                `(?:[ \u00a0\u202f\u2009]?/[ \u00a0\u202f\u2009]?(${DENOM_ALT})|[ \u00a0\u202f\u2009]?(²|³|(?<=[a-zA-Z])[23](?![\\d\\p{L}])))?` +  // NBSP, NNBSP, thin space
                `(?![\\p{L}\\p{M}\\d'’ʼ])`,
            "giu",
        ),
        (whole: string, num: string, key: string, denom: string | undefined, exp: string | undefined) => {
            const k = key.toLowerCase();
            const forms = UNIT[k];
            if (forms === undefined) return whole;
            const head = Number(num) === 1 ? forms[0] : forms[1];
            if (denom !== undefined) {
                const dl = denom.toLowerCase();
                const dWord = DENOM[dl] ?? UNIT[dl]?.[0];
                if (dWord === undefined) return whole; // half a rate is not a reading
                return `${head} ${num} ${PER} ${dWord}`;
            }
            if (exp !== undefined) {
                if (exp === "³" || exp === "3") return whole; // no cube word exists for nso
                const sq = SQUARED[k];
                if (sq === undefined) return whole; // no square compound attested for this unit
                return `${sq} ${num}`;
            }
            return `${head} ${num}`;
        },
    );

    // 6) THE BARE UNIT TOKEN, after the digit-adjacent path has had every chance at the text. A `km` still
    //    standing here has no numeral of its own — a caption or a table header — and reached the phoneme
    //    sink as `kʼm`. ⚠ AND TWO OF THESE KEYS ARE TRAP-56 MISREADS RATHER THAN LEAKS, which is why the
    //    step is not optional: `kg` is the Sepedi DIGRAPH for /kx/, so `1200 kg` read as a well-formed
    //    Sepedi consonant, and `cm` reads [km] (⟨c⟩ has no grapheme rule and falls through to latinPhone),
    //    one ejective mark away from ⟨km⟩ → [kʼm]. No leak class can see either.
    s = BARE_UNIT(s);

    // 7) DEGREES. `1.2 °C`, `85°F`, `55°S`, and the bare `90°`. The sign was dropped outright and the scale
    //    letter reached the g2p as a phoneme — `C` as [k], because Sepedi has no ⟨c⟩ grapheme at all.
    //    ⚠ ONLY CELSIUS IS NAMED. `Fahrenheit` is ×0 in every source nso has, so `°F`'s letter is CLAIMED —
    //    without the arm it falls through every branch below (the bare-degree arm's trailing guard rejects a
    //    letter) and loses the ° while the F still reads — and the scale is left unsaid rather than invented.
    //    ⚠ NO DEGREE NOUN, and that refusal is refuted-not-unfound: see CELSIUS above for why `dikgato` is
    //    this wiki's word for the FOOT.
    //    ⚠ THE SCALE NAME IS SUPPRESSED WHEN THE CLAUSE ALREADY CARRIES IT — the corpus writes
    //    `magareng ga 2.24º le 1.02º Celsius`, and emitting it again would say it three times (trap 12).
    //    BEFORE step 9, which needs `1.2` intact to be recognised as the reading's operand.
    //    ⚠ BOTH `°` (U+00B0) AND `º` (U+00BA) — the corpus's own Celsius sentence writes the MASCULINE
    //    ORDINAL INDICATOR, the same substitution `dell'11º` made in Italian, and a class holding only U+00B0
    //    would leave every one of them raw in the IPA.
    const degreeC = (n: string, off: number, end: number, full: string): string =>
        saidNear(full, off, end, CELSIUS) ? n : `${n} ${CELSIUS}`;
    s = s.replace(/(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?[°º][ \u00a0]?C(?![\p{L}\p{M}])/gui,  // space, NBSP
        (w: string, n: string, off: number, full: string) => degreeC(n, off, off + w.length, full));
    s = s.replace(/(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?[°º][ \u00a0]?F(?![\p{L}\p{M}])/gui, "$1");  // space, NBSP
    s = s.replace(/(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?[°º][ \u00a0]?([NSEW])(?![\p{L}\p{M}])/gu,  // space, NBSP
        (_w, n: string, c: string) => `${n} ${COMPASS[c]!}`);
    s = s.replace(/(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?[°º](?![\p{L}\p{M}])/gu, "$1");  // space, NBSP

    // 8) RANGES → `go ya go`. See UNTIL for the three in-corpus attestations and for why DESCENDING spans are
    //    admitted here where the nya/rw siblings admit only ascending ones.
    //    ⚠ THE ONE NUMERIC GUARD IS A DIGIT-LENGTH GAP OF TWO OR MORE, and it is what separates a span from a
    //    designation and from an abbreviated year. Tabulated over every digit–dash–digit in the corpus, after
    //    step 2 has de-grouped:
    //
    //        CLAIMED   1901–2012 · 1950–2020 · 1880–1881 · 1899–1902 · 1964–1987 · 1970–2000 · 1978 -1989
    //                  33500–32500 · 17000–15000 · 26000-23500 · 800-2000 · 15 -24 · 11-12 · 5–8 · 2–3
    //        DECLINED  ISO 3166-1  (4 vs 1)   a standard's part number, not a span
    //                  1876-77     (4 vs 2)   an ABBREVIATED year span — the tail is the last two digits of
    //                                         the second year, exactly as this corpus writes `2017/18`
    //
    //    A one-digit gap is ordinary (`800-2000`); a two-digit gap never was a span in this text. ⚠ AND THE
    //    SHORT SPANS ARE THE REASON THIS IS NOT A "both operands ≥ 2 digits" RULE, which was tried first and
    //    silently declined `5–8 senthimetara (2–3 inches)` — the corpus's only two MEASUREMENT spans.
    //    ⚠ THE GUARD EXCLUDES A HYPHEN AND A LETTER ON EITHER SIDE, which is what declines a hyphen CHAIN and
    //    a designation: `737 Next Generation (-700, -800, -900ER)` has no left operand at all, and
    //    `ISO 3166-1 alpha-2` is letter-preceded.
    //    ⚠ AND THE HYPHEN GUARD MUST REACH ACROSS A SPACE, which the first version did not — nso.wikipedia's
    //    YEAR-INDEX pages are chains of SPACED hyphens (`1970 - 1969 - 1968 - 1967 - …`, ×4 in the retained
    //    corpus), and with only the adjacent-hyphen test every ALTERNATE pair was claimed: *1970 go ya go
    //    1969*, a navigation list read as five descending spans. Found by reading the corpus diff, which is
    //    the only instrument that could have seen it — the shape passes every unit probe.
    //    AFTER step 2, so a grouped endpoint (`33,500–32,500`) is already one run of digits.
    //    ⚠ THE RIGHT GUARD TESTS `[.,]\d`, NOT A BARE `[.,]`, and that one character was a defect: a
    //    separator with no digit after it is not a decimal, it is the END OF THE CLAUSE. `nakong ya
    //    1901–2012.`, `magareng ga 1950–2020,` and `ea 2020-2100.` were all declined for their sentence
    //    punctuation and read as two juxtaposed cardinals with no connective between them — the span joiner
    //    silent at exactly a sentence end (playbook trap 58, reported by `review.ts`'s `clause-final` check).
    //    What the separator exclusion is for is a CONTINUATION of the number into step 9's decimal, and a
    //    following digit is what tests that: `9.84-9.90` is still declined and so is a grouped `1-1,000`.
    s = s.replace(/(?<![-–—\d.,\p{L}\p{M}])(?<![-–—][ \u00a0])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)(?![-–—\d\p{L}\p{M}]|[.,]\d)(?![ \u00a0][-–—])/gu,  // space, NBSP
        (whole: string, a: string, b: string) =>
            Math.abs(a.length - b.length) >= 2 ? whole : `${a} ${UNTIL} ${b}`);

    // 9) DECIMALS, LAST of the numeric rules — steps 2 to 8 all need their number intact, and the shared tier
    //    (which runs BEFORE this whole pass) needs the digit adjacent to its sign. The dot was reaching
    //    `clausePunctuation` and becoming a SENTENCE BREAK inside a number: `9.84` read *seɲane . …*.
    //    NO separator word is emitted; see the header for the `khutlo` register finding.
    //    ⚠ BOTH SEPARATORS, both restricted to a 1–2 digit tail — the same discipline step 2 uses from the
    //    other side, and the tail limit is what keeps a grouped thousand step 2 declined out of these arms.
    //    ⚠ THE COMMA ARM'S `(?![\d,])` IS WHAT DECLINES A LIST. The corpus writes `(1,2,3,4,5,6)` — six
    //    single digits, not three decimals — and every member is either followed by a comma or preceded by
    //    one, so both guards reject the whole run. Measured: 3 true decimals, 0 list members claimed.
    s = s.replace(/(?<![\d.,])(\d+)\.(\d{1,2})(?![\d])/gu, (_m, i: string, f: string) => spell(i, f));
    s = s.replace(/(?<![\d.,])(\d+),(\d{1,2})(?![\d,])/gu, (_m, i: string, f: string) => spell(i, f));

    // ⚠ A padded replacement (` le `, `letters `) doubles a space that was already there and can leave one at
    // an edge. SLOT-GAP is a corpus-diff defect class; this pass must not feed it.
    return s.replace(/[^\S\n]{2,}/gu, " ").replace(/^[^\S\n]+|[^\S\n]+$/gu, "");
}
