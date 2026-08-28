/**
 * Maltese / Malti (mt) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA. Runs inside
 * `maltese.ts`'s `text()`, before tokenization.
 *
 * ⚠ MALTESE IS SEMITIC MORPHOLOGY IN A LATIN ORTHOGRAPHY AND IS ALONE IN THIS FLEET, so the Arabic layers
 * were read for the QUESTIONS they ask and never for an answer: the script differs, the vocabulary does not
 * transfer, and every word below is sourced from Maltese text. Playbook trap 55, one taxonomic level up —
 * what travels is the procedure.
 *
 * ⚠ THE SOURCING SITUATION, STATED PLAINLY. There is no FLEURS corpus for Maltese.
 * ⚠ AND THAT SENTENCE IS NOW FALSE (#1102): `mt_mt` landed later, 1,960 unique transcript texts, and it is a
 * genuinely INDEPENDENT read-aloud corpus rather than a second sample of the wiki. ⚠ AND THE RE-MEASUREMENT HAS NOW BEEN
 * DONE FOR THE CLOCK, which is the class it changed — see the clock note below. Every OTHER "only N
 * times" in this file is still a count over the mined artifact alone: the sweep was per CLASS, not per
 * file, and the rest of #1102's expensive half is still open. The evidence is
 * `tools/corpus/mined/mt.jsonc` (118,526 paragraphs of the mt.wikipedia dump, 449 retained) plus `attest.ts`
 * against mt.wikipedia — WHICH IS THE SAME WIKI THE ARTIFACT WAS MINED FROM. That is a bigger sample of ONE
 * source, never a second independent one, and no count below should be read as corroboration across tiers.
 * espeak DOES ship Maltese, and it is used here only where its answer is corroborated (`€`→*ewro*, `&`→*u*)
 * or refused (`_%`→*procentuali*, against 140 wiki tokens of *fil-mija*); §5c's measurement of it is at the
 * INITIALISMS refusal below.
 *
 * ── WHAT WAS BROKEN, with the whole-corpus count from the artifact's own `counts` block ──────────────────
 *
 *     $250,000         → *mɪtɛjn u ħamsɪn , zɛrɔ*   ONE number read as two, with a CLAUSE PAUSE  grouped ×7673
 *     1.2°C            → *wɪħɛt . tnɛjn k*          a SENTENCE BREAK inside a number             decimals ×11311
 *     40%              → *ɛrbɪn*                     the sign silent                             percent ×3185
 *     €487 miljun      → *…tmɛnɪn mɪljun*            the sign silent                             currency ×1059
 *     148 km           → *…ɛrbɪn km*                 raw ⟨km⟩ in the phoneme stream              units ×2033
 *     2.6cm            → *…sɪtta km*    ⚠ ⟨cm⟩ READ AS ⟨km⟩ — centimetres as KILOMETRES (trap 56)
 *     28,748 km²       → *…ɛrbɪn km*                 ² silent, ⟨km⟩ raw                          exponent ×866
 *     20 °C / 68.0 °F  → *ɔʃrɪn k* / *…zɛrɔ f*       ° silent, ⟨C⟩→/k/ and ⟨F⟩→/f/ as bare letters degrees ×792
 *     -1 °C            → *wɪħɛt k*                   the MINUS silent — the reading INVERTS      signed-number ×547
 *     120 km/h         → *…ɔʃrɪn km ħ*               the slash silent, ⟨h⟩ read as [ħ]           rate ×163
 *     R&Ż              → *r s*                       the & silent                                ampersand ×1863
 *     Q.K.             → *ʔ . k .*                   two spurious sentence PAUSES + two bare consonants  era-marker ×2220
 *
 * ── THE ONE FACT THAT SHAPES EVERY RULE HERE: THE HYPHEN IS THE DEFINITE ARTICLE ─────────────────────────
 *
 * Maltese writes `il-`/`l-` and its assimilated allomorphs BOUND TO THE FOLLOWING WORD WITH A HYPHEN, and
 * every preposition fuses with it too. Counted over the 449 retained segments: **3,322 hyphens**, of which
 * the ten commonest openers alone are `tal-` ×949, `l-` ×935, `il-` ×511, `fl-` ×262, `Il-` ×236, `fil-` ×231,
 * `L-` ×155, `it-` ×83, `tas-` ×81, `tat-` ×79. A hyphen in this language is almost never a range or a minus,
 * which is why:
 *   · the MINUS rule is anchored on what PRECEDES the sign and on what FOLLOWS the number (step 4), and
 *   · there is NO range rule at all (see the refusals).
 * Digit-adjacent dashes are 32 ASCII + 26 en-dash in the retained text and are overwhelmingly YEAR SPANS.
 *
 * ── COUNT AGREEMENT, WHICH IS THE OTHER LOAD-BEARING FACT AND IS MEASURED, NOT ASSUMED ───────────────────
 *
 * Maltese takes the PLURAL after 2–10 and the SINGULAR from 11 up — the Semitic pattern, and it governs every
 * unit, currency and measure word this file emits. Tabulated over the artifact and over `attest.ts`, numeral
 * by numeral (`countForm` below):
 *
 *   SINGULAR, n ≥ 11   `16,627 kilometru` `301,338 kilometru` `23 kilometru` `15-il kilometru` `1,200 metru`
 *                      `173 metru` `200 ċentimetru` `130 ċentimetru` `20 ċentimetru` `10,331 mil` `12 mil`
 *                      `9,750,000 tunnellata` `3,900 pied` `745 miljun dollaru` `48 grad Celsius`
 *                      `54 grad Celsius` `30 grad Ċelsju` `39 grad Fahrenheit` `300 kilometru fis-siegħa`
 *   PLURAL,  n ≤ 10    `10 kilometri` ×2 `9 minuti` `għaxar dollari` `4 gradi Celsius` `10 gradi Celsius`
 *                      `għaxar gradi Fahrenheit` `-2 gradi Ċelsju`
 *   PLURAL,  DECIMAL   `2.5 metri` `9.5 mili` `1.57/1.77/1.8/2.2/4.5/7.5/8.1/9.9/13.2/14.4/10.4 ċentimetri`
 *                      `20.3 kilometri` `50.7 gradi Celsius` `56.7 gradi Celsius` `76.0/82.0 snin`
 *                      `3.6 kilometri fis-siegħa` `1.25 dollari`  — ~20 instances
 *
 * The INTEGER evidence is clean in both directions and never contradicted. The DECIMAL evidence is ~20
 * plural against 8 singular (`1.8 metru`, `26.95 tunnellata`, `1228.91 abitant`, `9,068.24 pied`,
 * `28.0 grad Ċelsju`, `27.1 grad Ċelsju`, `82.4 grad Fahrenheit`, `11.6 fil-mija`), so a fraction takes the
 * plural here — which is also what `core/normalizeSymbols.ts`'s own `numValue` comment says it intends.
 */

import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { rewrite } from "../../core/provenance.ts";

/**
 * The PERCENT reading, and the best-attested word in this layer.
 *
 * `fil-mija` — literally "in the hundred", the same *"in a hundred"* composition the playbook's Fula entry
 * endorses, except that here it is not composed at all: it is the running-text word, in the numeral slot,
 * in every instance read. `attest.ts` → **140 tokens / 20 articles, substringOnly 0**, and ×14 in the mined
 * artifact itself: *"40 fil-mija"*, *"60 fil-mija"*, *"90 fil-mija tal-popolazzjoni"*, *"96 fil-mija
 * tal-Ingliż, 62 fil-mija tat-Taljan, u 20 fil-mija tal-Franċiż"*, *"11.6 fil-mija tal-prodott gross
 * domestiku"*, *"madwar 30–35 fil-mija tal-esportazzjonijiet"*, *"Tletin fil-mija tad-dħul"*. Every hit is
 * postposed to a figure; not one is anything else.
 *
 * ⚠ AND THE COMPETITOR IS THE TRAP-37 SHAPE, CAUGHT BY READING IT. `perċentwal` is ×4 in the artifact and is
 * the NOUN "percentage" — *"il-perċentwal ta' żona koperta mill-foresti"*, *"bħala perċentwal tal-produzzjoni
 * ekonomika"*, *"dan il-perċentwal ilu jonqos"*. It never follows a numeral. espeak's `_%` is a third word
 * again, `procentuali` (an ADJECTIVE, and `mt_list` spells it without the Maltese ⟨ċ⟩), attested nowhere.
 * Three candidates, one slot; only the corpus's own word is in it.
 *
 * ⚠ INVARIANT, DELIBERATELY. `fil-mija` is a prepositional phrase, not a countable noun, so it takes one
 * form for every numeral — which is why the percent arm is the one place in this file where the agreement
 * rule above does not apply. Attested at both ends of the range: *"90 fil-mija"* and *"11.6 fil-mija"*.
 */
const PERCENT = "fil-mija";

/**
 * The DECIMAL POINT word — and the weakest sourcing in this file, said so here rather than in a footnote.
 *
 * `punt`. Two sources, neither of them a reader:
 *   · espeak `mt_list` declares `_.` → `punt`, which is a statement about how the SEPARATOR is read;
 *   · mt.wikipedia names the mark, definitionally, in the two articles that discuss decimal notation —
 *     `attest.ts` "punt deċimali" → 6 tokens / 2 articles: *"Il-punt deċimali huwa miktub bħala perjodu
 *     (punt) jew virgola"*, *"Ċifri wara l-punt deċimali huma sempliċement elenkati"*, *"il-punt deċimali
 *     jista' jinkiteb jew bħala virgola jew punt (tikka)"*.
 *
 * ⚠ THAT IS WHAT THE MARK IS CALLED, WHICH IS THE REGISTER THE PLAYBOOK WARNS ABOUT (hi's `धन`). What
 * separates this from that case is that espeak's entry is not a name but a READING SLOT, and that the two
 * sources are independent of each other. It is shipped on that basis and the limit is recorded.
 *
 * ⚠ AND THE ARTIFACT'S OWN `punt` ×10 IS NOT EVIDENCE FOR IT — every one is the ordinary noun "point" in the
 * geographic or abstract sense (*"l-aktar punt tat-Tramuntana"*, *"l-ogħla punt"*, *"il-punt fokali"*). That
 * is the same word, and none of those instances is a decimal separator. Corpus SILENCE about a separator's
 * spoken form is expected — writers type `2.5` and never spell out how they say it — which is the Igbo
 * lesson, and is why the silence was not read as a refusal.
 */
const DECIMAL_POINT = "punt";

/**
 * The DEGREE reading. `grad` (sg) / `gradi` (pl) + the scale name, postposed, and the whole phrase is
 * attested as a COLLOCATION rather than assembled from parts — playbook trap 37's constructive half.
 *
 * `attest.ts`, in the numeral slot every time:
 *   `grad Celsius`   16 tokens / 13 articles   *"48 grad Celsius (118 °F)"*, *"15-il grad Celsius (59 °F)"*,
 *                                              *"17-il grad Celsius (63 °F)"*, *"54 grad Celsius"*
 *   `gradi Celsius`   6 / 6                    *"4 gradi Celsius (39 grad Fahrenheit)"*, *"10 gradi Celsius"*,
 *                                              *"għaxar gradi Celsius"*, *"50.7 gradi Celsius"*
 *   `grad Ċelsju`     7 / 5                    *"30 grad Ċelsju"*, *"24 grad Ċelsju"*, *"27.1 grad Ċelsju"*
 *   `gradi Ċelsju`    1 / 1                    *"qrib -2 gradi Ċelsju"*
 *   `grad Fahrenheit` 3 / 3                    *"82.4 grad Fahrenheit"*, *"39 grad Fahrenheit"*,
 *                                              *"bejn 40 u 60 grad Fahrenheit (4–15 °C)"*
 *   `gradi Fahrenheit` 1 / 1                   *"għaxar gradi Fahrenheit (5 °C)"*
 * `grad` alone is 96 / 20 and `gradi` 34 / 20; the bare word is polysemous (`gradi tal-iskola primarja` in
 * the artifact is school GRADES), so the collocation is the evidence, not the count.
 *
 * ⚠ THE SPELLING CHOSEN IS THE MINORITY ONE, AND THE REASON IS THE READING. `Celsius` outnumbers `Ċelsju`
 * 22 collocation tokens to 8 — and this engine's manifest maps ⟨c⟩ → /k/, so emitting `Celsius` produces
 * **[kɛlsɪus]**, a plausible-sounding word that no Maltese speaker says. That is trap 56 exactly: a defect
 * that produces a READING is worse than one that produces garbage, and no leak class can see it. `Ċelsju`
 * is attested ×12 / 7 articles with ×8 of those in this very slot, and gives [t͡ʃɛlsju]. The frequency split
 * is recorded here so the choice stays visible and reversible.
 * `Fahrenheit` has no such problem (→ [farɛnɛɪt]) and is emitted as written.
 *
 * ⚠ `sources.ts` REPORTS `[NONE] scale-names` FOR THIS LANGUAGE AND IS WRONG, because its haystack is the
 * corpus, the referee and espeak — and the scale name is in none of those while being ×30 on the wiki. A
 * `[NONE]` from a gate is a claim about the gate's sources (trap 42's discipline, one tool along).
 */
const DEGREE_SG = "grad";
const DEGREE_PL = "gradi";
const CELSIUS = "Ċelsju";
const FAHRENHEIT = "Fahrenheit";

/**
 * The MINUS word. `minus` — `attest.ts` → 8 tokens / 7 articles, and the usable hits are DEFINITIONAL, from
 * mt.wikipedia's own arithmetic articles: *"Numri negattivi huma normalment miktuba b'SINJAL MINUS quddiem.
 * Pereżempju, -3 tirrappreżenta kwantità negattiva"* ("negative numbers are normally written with a minus
 * sign in front; for example, -3 represents a negative quantity"), *"is-sinjal negattiv jitqiegħed kemmxejn
 * ogħla mis-sinjal minus"*, *"huwa normalment indikat b'sinjal minus infiss ('-')"*.
 *
 * ⚠ TWO OF THE EIGHT ARE PROPER NOUNS and were read out rather than counted in: *Privilegium Minus* (a 1156
 * charter) and *Godzilla Minus One* (a film). Six real hits over five articles is the actual number.
 *
 * ⚠ `nieqes` WAS THE OTHER CANDIDATE AND IS REFUSED ON SENSE. It is ×1 in the artifact and ×1 / 1 article on
 * the wiki, and both are the adjective "lacking": *"ħafna aktar nieqes mill-melħ"*, *"ma kienx nieqes
 * mill-kritika"*. One article is a lead, not a finding, and the sense is not the sign's.
 */
const MINUS = "minus";

/**
 * The ERA phrases, and this is the strongest attestation in the file because the wiki states the EXPANSION
 * of the abbreviation rather than merely using it:
 *   *"ante Christum natum (li bil-Latin tfisser qabel it-twelid ta' Kristu) jew QABEL KRISTU, ġeneralment
 *   imqassar bil-Malti għal Q.K."*  — `attest.ts` "Qabel Kristu" → 13 tokens / 8 articles
 *   *"it-terminu W.K. jalludi għall-frażi WARA KRISTU"*, *"Anno Domini (AD), li bil-Malti nsibuha wkoll bħala
 *   Wara Kristu (W.K.)"*            — `attest.ts` "Wara Kristu" → 16 tokens / 8 articles
 * In the retained artifact: `Q.K.` ×13, `QK` ×5, `W.K.` ×5, `w.K.` ×1.
 */
const BCE = "Qabel Kristu";
const CE = "Wara Kristu";

/**
 * The UNIT nouns. Every one carries its own attestation IN THE NUMERAL SLOT, and where the artifact is thin
 * the wiki count is given beside it. Singular first, plural second (see `countForm`).
 *
 *   km   `kilometru` ×18 artifact / `kilometri` ×3 — *"16,627 kilometru (10,331 mil)"*, *"301,338 kilometru
 *        kwadru"*, *"15-il kilometru (9.5 mili)"*, *"10 kilometri miċ-ċentru tal-belt"*, *"20.3 kilometri"*
 *   m    `metru` ×9 / `metri` ×2 — *"1,200 metru (3,900 pied)"*, *"173 metru"*, *"253 metru 'l fuq mil-livell
 *        tal-baħar"*, *"2.5 metri kwadri"*
 *   cm   `ċentimetru` 54 / 20 and `ċentimetri` 33 / 20 on the wiki — *"200 ċentimetru u wiesa' 180
 *        ċentimetru"*, *"bejn 20 ċentimetru sa 50 ċentimetru"*, *"bejn 13.2 u 14.4 ċentimetri"*, *"minn 7.5
 *        sa 10.4 ċentimetri"*. ⚠ THIS IS THE trap-56 KEY: undeclared, ⟨cm⟩ reaches the g2p, ⟨c⟩→/k/ makes it
 *        IDENTICAL to ⟨km⟩, and `2.6cm` read as 2.6 KILOMETRES. Nothing counted it — not DROP, not RAW-LATIN.
 *   ċm   the same unit in the language's OWN spelling, which the artifact writes ×5 (*"18ċm"*, *"16-il ċm"*,
 *        *"bejn 12.7ċm u 18.6ċm"*, *"1.2ċm"*) beside the Latin ⟨cm⟩ ×5. Both keys, one reading.
 *        ⚠ FOUR OF THOSE FIVE ARE DIGIT-ADJACENT AND THE FIFTH IS NOT, which is why step 5b exists: the
 *        tier allows only `\s?` between the number and the unit, so the `-il` of *"16-il ċm"* blocked the
 *        match and this key could not fire on the very shape cited as its evidence. ⟨cm⟩ escaped that by
 *        accident — `isBareUnitKey` requires `^[A-Za-z]+$`, so the Latin spelling was rescued STANDALONE by
 *        the bare-unit fallback while ⟨ċm⟩, carrying a non-ASCII letter, was not eligible for it. Two
 *        spellings of one unit taking two different paths is exactly how a key comes to be dead.
 *   mi   `mil` / `mili` — *"16,627 kilometru (10,331 mil)"*, *"4,565 mil kwadri"*, *"12 mil"*, *"24 mil"*,
 *        *"15-il kilometru (9.5 mili)"*; `mili` 57 / 20 on the wiki. ⚠ THE ARTIFACT'S BARE `mil` ×21 IS
 *        TRAP 2 AND MOST OF IT IS THE ARTICLE — `mil-lvant`, `Mil-perjodu`, `mil-Latin` are the fused
 *        preposition *minn + il-*, not the mile. Only the digit-adjacent instances were counted.
 *   ft   `pied`, invariant — *"2,764 m (9,068.24 pied)"*, *"f'0 m (0.00 pied)"*, *"1,200 metru (3,900 pied)"*,
 *        *"8,346 pied"*, *"1,640 pied"*, and on the wiki *"1,360 pied kubu"*, *"1,165.4 pied kubu"*. `piedi`
 *        is ×0 in both sources at every magnitude, so one form is declared rather than a guessed plural.
 *   sq mi A COMPOUND KEY, because this abbreviation is not the composition of its parts (playbook trap 44,
 *        Māori's `m/h`). ×15 in the retained text, always the English gloss beside a metric figure —
 *        *"28,748 km² (11,100 sq mi)"*, *"238,397 km² (92,046 sq mi)"* — and the Maltese for it is attested:
 *        *"11,823 km² jew 4,565 MIL KWADRI"*, *"274,200 kilometru kwadru (105,900 MILI KWADRI)"*.
 */
const UNITS: Record<string, string[]> = {
    km: ["kilometru", "kilometri"],
    m: ["metru", "metri"],
    cm: ["ċentimetru", "ċentimetri"],
    "ċm": ["ċentimetru", "ċentimetri"],
    mi: ["mil", "mili"],
    ft: ["pied"],
    "sq mi": ["mil kwadru", "mili kwadri"],
};

/**
 * The SQUARED and CUBED measure words, postposed and agreeing — Maltese puts the modifier after its noun and
 * inflects it, so this is `after` with count forms rather than a fixed string.
 *
 *   squared `kwadru` 61 / 20 · `kwadri` 57 / 20 — *"301,338 kilometru kwadru"*, *"274,200 kilometru kwadru
 *           (105,900 mili kwadri)"*, *"104 mil kwadri"*, *"2.5 metri kwadri"*, *"4,565 mil kwadri"*
 *   cubed   `kubu` 44 / 20 · `kubi` 18 / 15 — *"31.2 miljun metru kubu ta' ilma tax-xorb"*, *"1,360 pied
 *           kubu"*, *"kilogramma għal kull metru kubu"*, *"229600 metri kubi"*
 *
 * ⚠ BOTH BARE WORDS ARE POLYSEMOUS AND THE COLLOCATION IS THE EVIDENCE (trap 37). `kwadru` is also the SQUARE
 * ROOT in mathematics prose (*"għerq kwadru ta' numru x"*, ~10 of the wiki hits) and `kwadri` is also
 * PAINTINGS (*"bosta kwadri żgħar pittura"*) and city BLOCKS (*"blokki perfettament kwadri"*); `kubi` is also
 * the solid shape (*"koni, sferi, kubi"*). Counting the bare word would have been a lead, not a finding — the
 * `kilometru kwadru` / `metru kubu` collocations are what settle it.
 *
 * ⚠ TWO COUNTER-INSTANCES TO THE AGREEMENT RULE, RECORDED RATHER THAN FITTED: `147,181 kilometri kwadri` and
 * `229600 metri kubi` take the plural above 11 where the majority (`274,200 kilometru kwadru`, `301,338
 * kilometru kwadru`, `31.2 miljun metru kubu`) takes the singular. The wiki is inconsistent here; the
 * majority and the far larger `ċentimetru` evidence set the rule.
 */
const SQUARED = ["kwadru", "kwadri"];
const CUBED = ["kubu", "kubi"];

/**
 * The CURRENCY nouns, emitted AFTER the amount, which is Maltese order in every attested instance.
 *
 *   €  `ewro` — 227 tokens / 20 articles, and the wiki names the SIGN in its own lead: *"L-ewro (simbolu: €;
 *      kodiċi bankarju: EUR)"*. ×4 in the artifact (*"Malta bdiet tuża l-ewro bħala l-munita tagħha"*,
 *      *"ż-żona tal-ewro"*), and espeak's `mt_list` agrees independently (`€ ewro`). Invariant.
 *   $  `dollaru` / `dollari` — *"31.6 biljun dollaru Amerikan"* and *"745 miljun dollaru"* in the artifact,
 *      both in the slot; `dollari` 26 / 20 on the wiki — *"1.25 dollari Amerikani kuljum"*, *"għaxar
 *      dollari"*, *"miljuni ta' dollari"*. Both forms land exactly where `countForm` predicts.
 *   £  `sterlina` / `sterlini` — the artifact writes both the sign and the word in one sentence,
 *      *"kienet valutata bejn wieħed u ieħor £1.60 STERLINI"*, and names the currency in another, *"Lira
 *      Sterlina Ingliża"*. espeak's `mt_list` gives `£ sterlina`. The signed instances are ×3.
 *      ⚠ That first sentence is the trap-12 REDUNDANCY, and declaring `sterlini` as a form is what keeps the
 *      tier's suppression from reading it twice.
 *
 * ⚠ NO `US$` KEY. The artifact writes a bare `$` in all 15 instances; a compound key with nothing to match is
 * an unattested guard alternative (trap 9).
 */
const CURRENCY: Record<string, string[]> = {
    "€": ["ewro"],
    $: ["dollaru", "dollari"],
    "£": ["sterlina", "sterlini"],
};

/** The magnitude words that hop with a currency sign, in the spelling the corpus writes them: `miljun`
 *  ×19 and `biljun` ×27 digit-adjacent in the retained text (`€487 miljun`, `$88.08 biljun`, `€20 biljun`).
 *  The plurals are the manifest's own (`maltese.jsonc` → `magnitudes`), included because `żewġ miljuni` is
 *  how this engine's number path itself writes 2×10⁶. NO `magnitudeConnective`: Maltese writes
 *  *745 miljun dollaru*, with nothing between the magnitude and the noun. */
const MAGNITUDES = [
    // ⚠ THE `-il` LINKED FORMS ARE MAGNITUDES TOO, AND THE CORPUS DIFF IS WHY THEY ARE HERE. A Maltese teen
    // takes the linker before a magnitude and the corpus writes it after the DIGITS: `€12-il miljun`,
    // `£15-il miljun`, `£18-il miljun`. The tier's `magAlt` allows only WHITESPACE between the number and the
    // magnitude, so `12` matched, `-il miljun` did not, and the currency word landed BETWEEN the numeral and
    // its own magnitude — *tnaʃ EWRO ɪl mɪljun*, "twelve euro il million". That is the id `US$` defect
    // (the currency audible in the wrong slot), and this layer INTRODUCED it: before, the sign was merely
    // silent. Declaring the linked form as its own alternative makes `12-il miljun` one magnitude phrase, so
    // it is re-emitted verbatim and the noun goes after it — and the linker survives, which stripping it
    // would not have done. Longest-first sorting inside the tier puts these ahead of the bare words.
    "-il miljun",
    "-il biljun",
    "-il elf",
    "miljun",
    "miljuni",
    "biljun",
    "biljuni",
    "elf",
    "elef",
    "triljun",
];

/**
 * COUNT AGREEMENT — the Semitic rule measured in this file's header, in one line.
 *
 * SINGULAR for 1 and for every whole number from 11 up; PLURAL for 2–10 and for any FRACTION. The fraction
 * arm is not an inference from the shape of `numValue` but from ~20 attested decimals against 8, and it is
 * written as "not a whole number" so it does not depend on which sentinel `core/normalizeSymbols.ts` picks
 * for a fraction.
 *
 * ⚠ AFTER A MAGNITUDE WORD, MALTESE TAKES THE SINGULAR (*745 miljun dollaru*, *31.6 biljun dollaru*,
 * *ħames miljun tunnellata*) — a magnitude governs it exactly as a numeral above ten does. This function
 * cannot answer that on its own, because it is not told whether a magnitude was matched, and `withMagnitude`
 * used to ask every language for a fixed many-count of 5. The residue was ~9 retained instances reading
 * *biljun dollari* for *biljun dollaru*: an AGREEMENT slip inside the right word.
 *
 * That is now a declaration rather than a residue. `SymbolData.magnitudeCount` names the COUNT a magnitude
 * should be resolved as, and Maltese passes 11 — the smallest count its own rule above maps to the singular,
 * so the two facts stay in one place instead of being restated as a separate form. `countForm` is unchanged
 * and the attested *għaxar dollari* (n ≤ 10) and *1.25 dollari* (a fraction) are untouched, which is what
 * declaring a single invariant form would have broken.
 */
const countForm = (n: number): number => (n === 1 || (n >= 11 && n % 1 === 0) ? 0 : 1);

/**
 * The numeral string → the value `countForm` is asked about, for the two rules that resolve their own
 * agreement (steps 4 and 5) rather than going through the tier.
 *
 * ⚠ IT MUST AGREE WITH `core/normalizeSymbols.ts`'s `numValue`, AND THE CORPUS DIFF IS WHAT CAUGHT IT NOT
 * DOING SO. A plain `Number()` makes the FRACTION invisible whenever the decimal happens to be a whole
 * value: `68.0 °F` parsed to 68 and took the singular *grad* while `30.2 °F` in the very same sentence took
 * the plural *gradi* — two decimals, one rule, two answers, and the split was on a trailing zero rather than
 * on anything about the language. A fraction is detected from the STRING, so `68.0` and `30.2` are the same
 * kind of number here, which is what the ~20 attested plural decimals say they are.
 *
 * ⚠ AND THE FIRST ATTEMPT AT IT STILL DISAGREED, ON THE ONE SHAPE THAT IS AMBIGUOUS. A three-digit block
 * after the separator is GROUPING to `numValue` (`1.234` = one thousand two hundred thirty-four, the
 * European convention) and was a DECIMAL to the hand-rolled test here, so the identical numeral took
 * opposite agreement in two rules of the same file: `1.234 °C` → *1 punt 234 GRADI Ċelsju* (plural, from
 * this function) against `1.234 m` → *1 punt 234 METRU* (singular, from the tier). A docstring that says
 * "must agree" is not a mechanism, so this is now the tier's own expression, character for character —
 * copied rather than paraphrased, since `numValue` is not exported. Whoever changes one must change both.
 */
function numeralValue(num: string): number {
    const cleaned = rewrite(num, /[ \u00a0]/gu, ""); // thin/regular space grouping, as `numValue` does  // space, NBSP
    // Grouping separators come in 3-digit blocks; a trailing 1–2 digit block after . or , is a decimal.
    const m = /^(\d+(?:[.,]\d{3})*)(?:[.,](\d+))?$/.exec(cleaned);
    if (!m) return Number.NaN;
    const int = Number(m[1]!.replace(/[.,]/g, ""));
    return m[2] !== undefined && m[2].length !== 3 ? int + 0.5 : int; // a real fraction ⇒ plural
}

/**
 * ── STEP 1. DIGIT DE-GROUPING — FIRST, because a grouping comma is otherwise read as CLAUSE PUNCTUATION ──
 *
 * `maltese.jsonc` maps `,` to a pause, so `$250,000` read *mɪtɛjn u ħamsɪn , zɛrɔ* — one number spoken as
 * two, with a break between them. ×160 in the retained text, `grouped` ×7,673 whole corpus.
 *
 * ⚠ THE GUARD IS "EXACTLY THREE DIGITS AND NO DIGIT AFTER", and the corpus proves it is needed: mt.wikipedia
 * writes the English convention throughout (comma thousands, dot decimal — 160 grouped against 181 decimal
 * dots) but lapses ONCE into the European one, `8,2 %`. A looser rule would claim that instance and every
 * genuine clause comma that happens to fall between two digits. It is left as the pause it already was; one
 * instance does not buy a second convention, and reading it wrongly as a decimal would be worse.
 *
 * ⚠ AND THE LOOP IS REQUIRED, not cosmetic: `9,750,000` needs two passes because the first replacement
 * consumes the digit the second match would have started on.
 */
function degroup(text: string): string {
    return rewrite(text, /(?<=\p{Nd})(?<!(?<![\p{Nd}\.,])0)[,](?=\p{Nd}{3}(?!\p{Nd}))/gu, "");
}

/**
 * ── STEP 2. ERA ABBREVIATIONS — the multi-dot form BEFORE the single-dot one (playbook step 4) ──
 *
 * `Q.K.` → *Qabel Kristu*, `W.K.` → *Wara Kristu*. Unhandled, the interior dots survive as PHRASE BREAKS and
 * the letters as bare consonants: `Q.K.` read *ʔ . k .* — two spurious sentence pauses in the middle of a
 * date. ×24 in the retained text, `era-marker` ×2,220 whole corpus.
 *
 * ⚠ THE BARE FORM IS BOUNDED ON BOTH SIDES with `\p{L}\p{M}` lookarounds and not with `\b` (trap 1), and the
 * bound matters more than usual here: `QK` and `WK` are two-letter runs, and this orthography glues an
 * article onto the front of everything with a hyphen — which is not a letter, so the LEFT guard alone would
 * still admit `il-QK`. That is correct and intended; what the guard excludes is a match inside a longer
 * all-caps token.
 *
 * ⚠ CASE. `Q.K.`/`W.K.` are the citation forms and the artifact also writes `w.K.` ×1, so the match is
 * case-insensitive — the lg review's second defect was a guard that was case-sensitive while the corpus
 * capitalised. `AD`/`BC`/`CE` are NOT claimed: every instance in the retained text is inside an English
 * bibliographic citation, and this language has its own pair.
 *
 * ⚠ THE SECOND DOT IS SOMETIMES A FULL STOP TOO, AND SWALLOWING IT MERGED TWO SENTENCES. The abbreviation
 * ends in a period, and at the end of a sentence that ONE character is doing both jobs — English's
 * "haplology of the period". Consuming it deleted the clause break: *"…minn madwar it-3800 sal-2800 Q.K.
 * Malta ġiet diżabitata…"* and *"Madwar 600 Q.K. Il-kultura Jastorf…"* ran on into the next sentence, which
 * is step 1's `$250,000` defect (a pause that should be there, missing) in the opposite direction from the
 * one this file usually fights. 3 of the 249 hard segments.
 *
 * The discriminator is the writer's own CAPITALISATION, which is the only evidence available at this point:
 * the dot is re-emitted when the next non-space character is upper-case or the input ends. Measured over the
 * retained text — of 10 dotted era markers, 2 are followed by a capital (both genuine sentence starts,
 * above), 2 by a comma (`fit-332 Q.K., Malta`, `fis-sena 60 W.K., wara` — no dot, correct, the comma is the
 * break) and 6 by a lower-case word (`6500 Q.K. bil-wasla`, `seklu 18 Q.K. u l-Imperu`, `73/74 W.K. sabu` —
 * no dot, correct, the sentence continues). A following capital that is merely a proper noun mid-sentence
 * would take a spurious pause; that is a PAUSE WHERE A SENTENCE MAY END, which is the safe side of this
 * error, and it is the same evidence a human reader has.
 */
const SENTENCE_AFTER = /^\s*(?:\p{Lu}|$)/u;
const eraExpansion =
    (word: string) =>
    (m: string, offset: number, full: string): string =>
        SENTENCE_AFTER.test(full.slice(offset + m.length)) ? `${word}.` : word;
function eraMarkers(text: string): string {
    return text
        .replace(/(?<![\p{L}\p{M}])Q\s?\.\s?K\s?\./giu, eraExpansion(BCE))
        .replace(/(?<![\p{L}\p{M}])W\s?\.\s?K\s?\./giu, eraExpansion(CE))
        .replace(/(?<![\p{L}\p{M}])QK(?![\p{L}\p{M}])/giu, BCE)
        .replace(/(?<![\p{L}\p{M}])WK(?![\p{L}\p{M}])/giu, CE);
}

/**
 * ── STEP 3. MINUS — narrowed by MEASUREMENT to the two contexts that are unambiguous ────────────────────
 *
 * Omitting a plus is lossless; omitting a MINUS inverts, so this class earns a rule where `+` does not.
 * `-1 °C` read as *wɪħɛt k*, a winter mean of +1.
 *
 * ⚠ THE NARROWING IS TRAP 24's, RE-MEASURED ON THIS LANGUAGE. The fleet's usual shape — a sign that opens the
 * string or follows a space/bracket — was enumerated over the 449 retained segments and returns **14
 * candidates, 13 of them genuine negatives and one a false positive**:
 *
 *     TRUE  -1 °C ×2 · -3 °C · -29 °C · (−20 °F) · '-35.5 °C · (-31.9 °F) · -38.3 °C · (-36.9 °F) ·
 *           −8 °C · -9.7% · -1.1% · -3.54 m  ("L-aktar punt baxx … -3.54 m", Germany's lowest point)
 *     FALSE `żdiedet għal fl -2021 ,`  — the article-fused preposition `fl-2021` with a stray space before
 *           its hyphen. A YEAR, and hi's `चंद्रयान -1` in a different orthography.
 *
 * So the rule takes the RIGHT context as the discriminator, which is what trap 24 says to do when the left
 * one is exhausted: the number must be followed by a DEGREE SIGN or a PERCENT SIGN. That covers 12 of the 13
 * true negatives and **zero** of the false one. The thirteenth (`-3.54 m`) is knowingly left: buying it would
 * mean admitting a bare unit after the sign, and `fl -2021` is one token away from that shape.
 *
 * ⚠ THE LEFT GUARD IS STILL THERE and is doing the other half of the work, because in Maltese the character
 * before a hyphen is usually a LETTER: `it-43.8°C` and `it-48.1%` and `l-1%` are the definite article, and
 * all three would otherwise match this rule's right context exactly. `%–30 %` (a range) is excluded by the
 * same guard, since `%` is not in the opener set.
 *
 * ⚠ RUNS BEFORE STEP 4, while the `°` it inspects still exists — a guard's evidence has a lifetime (trap 39).
 * The apostrophe is in the opener set for one attested reason: the artifact writes `ta '-35.5 °C`, with the
 * space misplaced before the apostrophe. No Maltese article ends in an apostrophe, so it cannot let one in.
 */
function minusSign(text: string): string {
    return rewrite(text, 
        /(^|[\s(‘’'"“])[-−–](\p{Nd}[\p{Nd}.,]*)(?=\s?[°%])/gu,
        `$1${MINUS} $2`,
    );
}

/**
 * ── STEP 4. °C AND °F — LOCAL, and the whole match is refused when the scale letter is absent (trap 53) ──
 *
 * `20 °C` read *ɔʃrɪn k* and `68.0 °F` read *…zɛrɔ f*: the sign silent and the scale letter surviving as a
 * bare consonant, because ⟨c⟩ and ⟨f⟩ are real Maltese graphemes. ×21 `°C` and ×15 `°F` in the retained
 * text, `degrees` ×792 whole corpus.
 *
 * ⚠ LOCAL RATHER THAN ON THE TIER for the same reason Finnish's is: this rule also has to decide the BARE
 * degree sign, which the tier has no path for — and the decision is to decline it. Of the 51 degree signs in
 * the retained text, 36 are `°C`/`°F` and the remaining 15 are COORDINATES (*"bejn il-latitudnijiet 42° u
 * 39° N"*, *"f'42° 35' 34\" latitudni N"*, *"19° 16' 50\" lonġitudni"*) plus one Richter magnitude
 * (*"b'intensità ta' 7.6° fuq l-iskala Richter"*). A bare-° rule would cut a coordinate in half and would
 * have no minutes/seconds reading to put back; `grad` is sourced and still buys nothing there, which is
 * lg's position reached independently on this corpus.
 *
 * ⚠ RUNS BEFORE THE DECIMAL STEP, AND THE ORDER DECIDES THE AGREEMENT. `21.8 °C` must be seen whole: read
 * after the decimal rewrite it would arrive as `21 punt 8 °C`, the rule would take **8** as its numeral and
 * emit the PLURAL *gradi* where 21.8 takes the singular *grad*. Same coupling as step 3's, one step along.
 */
function degrees(text: string): string {
    return rewrite(text, 
        /(\p{Nd}[\p{Nd}.,]*)\s?°\s?([CF])(?![\p{L}\p{M}])/gui,
        (_m, num: string, scale: string) => {
            const n = numeralValue(num);
            const word = Number.isNaN(n) || countForm(n) === 1 ? DEGREE_PL : DEGREE_SG;
            return `${num} ${word} ${scale.toUpperCase() === "C" ? CELSIUS : FAHRENHEIT}`;
        },
    );
}

/**
 * ── STEP 5. THE RATE — LOCAL, because the idiom is not "A per B" (playbook trap 47, reason 1) ───────────
 *
 * `120 km/h` read *…ɔʃrɪn km ħ*: the slash silent, ⟨km⟩ raw, and the denominator letter read as [ħ], a real
 * Maltese consonant. `rate` ×163 whole corpus. Every rate in the retained text, enumerated rather than
 * assumed — `\d ⟨unit⟩/⟨letters⟩` is **8 instances and exactly three shapes**:
 *
 *     km/h ×4   `120 km/h` `59 km/h` `50 km/h` `30 km/h`
 *     m/s  ×3   `299,792,458 m/s` (the speed of light) `16.5 m/s` `100 m/s`
 *     km/s ×1   `300,000 km/s`  (in the same sentence as the first m/s)
 *
 * ⚠ THE PER-SECOND HALF IS WHY THIS RULE IS NO LONGER `km/h`-ONLY, AND THE OLD SHAPE WAS THE WORSE DEFECT.
 * With only `km/h` claimed here, nothing declared `rateDenominators`, so the shared tier matched the HEAD
 * unit and stranded the denominator: `299,792,458 m/s` → *…mɛtru s* and `16.5 m/s` → *…mɛtrɪ s*, a speed
 * read out as a DISTANCE with a loose consonant after it. That is trap 53's half-a-reading — worse than the
 * raw `m/s` this layer replaced, and the very thing the `km/h` arm exists to refuse.
 *
 * Maltese says *kilometri FIS-SIEGĦA* / *kilometru FIS-SEKONDA* — a preposition fused with the definite
 * article and its noun, one lexicalised phrase, not a connective plus a denominator noun. `unitPer` is a
 * single invariant string joining a numerator to a SEPARATE denominator word, and there is no way to spell
 * this with it: the tier would emit the noun `siegħa` after the phrase that already contains it. That is the
 * el / te / kn case in trap 47's table, arriving in a Semitic language for the same structural reason.
 *
 * BOTH denominator phrases are sourced as COLLOCATIONS IN THE NUMERAL SLOT, not assembled from parts:
 *   `fis-siegħa`  `attest.ts` "kilometri fis-siegħa" → 2 tokens / 2 articles (*"tiċċaqlaq b'veloċità ta' 3.6
 *                 kilometri fis-siegħa"*, *"inqas minn 7 kilometri fis-siegħa (4.3 mph)"*), with the singular
 *                 in the same slot (*"ferroviji … li jivvjaġġaw bit-300 kilometru fis-siegħa"*). `fis-siegħa`
 *                 alone is 25 / 20 and means "per hour" in every instance read.
 *   `fis-sekonda` `attest.ts` "kilometru fis-sekonda" → **2 tokens / 2 articles, both after a figure**:
 *                 *"laqtet id-Dinja b'veloċità vertikali ta' 15-25 KILOMETRU FIS-SEKONDA (34,000-56,000
 *                 mph)"*, *"b'veloċitajiet orbitali osservati normalment ta' 200 KILOMETRU FIS-SEKONDA"*.
 *                 Note the agreement: both take the SINGULAR above ten, which is what `countForm` already
 *                 says. The phrase alone is 12 / 9 and is productive over other head nouns — *"ċiklu
 *                 fis-sekonda"* (the hertz, in the wiki's own definition of it), *"bits fis-sekonda (bps)"*,
 *                 *"200 darba fis-sekonda"*, *"newtrina … fis-sekonda"* — so it is the language's per-second
 *                 phrase and not one unit's idiom. `metru fis-sekonda` itself is ×0, which is why the HEAD
 *                 noun keeps coming from `UNITS` (each separately attested) and only the PHRASE is added.
 *
 * ⚠ THE DENOMINATOR TABLE IS CLOSED AND THE RESIDUAL IS STATED RATHER THAN GLOSSED. `h` and `s` are the only
 * two the corpus writes, ×0 of anything else. An UNLISTED denominator is not refused by this file — it falls
 * through to the tier, which matches the head unit and strands the rest (`5 km/j` → *5 kilometri/j*), which
 * is the very defect this rule just closed for `m/s`. It cannot be closed from here: the tier's unit match
 * ends in `(?![letters, marks, apostrophes])` and a `/` passes that guard, so declining a following slash is
 * a change to `core/normalizeSymbols.ts`. Reported, not edited; pinned in `test/maltese.test.ts` so the day
 * the guard lands, the assertion fails and says so.
 *
 * ⚠ RUNS BEFORE THE TIER so the tier never sees a unit with a slash after it, and before the decimal step so
 * a decimal operand still reads as one number.
 */
const RATE_DENOMINATORS: Record<string, string> = {
    h: "fis-siegħa",
    s: "fis-sekonda",
};
const UNIT_ALT = Object.keys(UNITS)
    .sort((a, b) => b.length - a.length)
    .join("|");
const RATE_RE = new RegExp(
    `(\\p{Nd}[\\p{Nd}.,]*)\\s?(${UNIT_ALT})\\s?/\\s?(${Object.keys(RATE_DENOMINATORS).join("|")})(?![\\p{L}\\p{M}])`,
    "gu",
);
function rates(text: string): string {
    return rewrite(text, RATE_RE, (_m, num: string, unit: string, denom: string) => {
        const forms = UNITS[unit]!;
        const n = numeralValue(num);
        const noun = Number.isNaN(n) ? forms[forms.length - 1]! : (forms[countForm(n)] ?? forms[0]!);
        return `${num} ${noun} ${RATE_DENOMINATORS[denom]!}`;
    });
}

/**
 * ── STEP 5b. THE `-il` LINKER BETWEEN A NUMBER AND A UNIT SYMBOL — LOCAL, because the tier allows only ──
 *    whitespace there, and this orthography writes a MORPHEME there instead.
 *
 * A Maltese teen (and every numeral from 11 up that governs a following noun) takes the linker `-il` before
 * that noun, written glued to the DIGITS: `16-il ċm`, `15-il kilometru`, `11-il metru`, `12-il mil`,
 * `48,514-il vot`. The tier's number→unit pattern is `(NUM)\s?(unit)`, so a linker between them is not a
 * gap it can cross — the number and its unit are simply not adjacent — and the unit symbol falls through to
 * the phoneme sink: `16-il ċm` → *sɪttaʃ ɪl t͡ʃm*. This is the same problem the `-il miljun` magnitude
 * alternatives solve on the currency side, one step along, and it is solved the same way: the linker is
 * MATCHED and RE-EMITTED, never stripped, because it is a real morpheme of the spoken numeral.
 *
 * ⚠ ONE INSTANCE IS ALL THE CORPUS HAS, AND IT IS THE ONE THE `ċm` KEY WAS SOURCED FROM. Enumerated over the
 * retained text, `\d+-il ⟨word⟩` is 28 hits and 27 of them already SPELL the noun (`15-il kilometru`,
 * `12-il mil`, `11-il metru`, `13-il minuta`, `19-il pajjiż`, `16-il siġġu`, …); exactly one writes an
 * abbreviation, `16-il ċm`. So this rule is not speculative reach — it closes the last leak of a unit key
 * whose other four instances the tier already reads.
 *
 * ⚠ THE TRAILING GUARD IS LOAD-BEARING AND THE SPELLED NOUNS ARE WHY. `mi` is a declared key and the corpus
 * writes `12-il mil` and `12-il minuta`; without `(?![\p{L}\p{M}])` this rule would bite the first two
 * letters off both and read *"12-il mil"* as "12 miles" with a stray ⟨l⟩ after it. `²`, `³` and `/` are
 * refused by the same lookahead rather than stranded: an exponent or a rate on a linked numeral is ×0 here,
 * and half a reading is worse than the leak (trap 53).
 *
 * The count form is resolved locally, like steps 4 and 5, and lands on the SINGULAR every time in practice —
 * `-il` is the linker of the numerals from 11 up, which is precisely `countForm`'s singular arm.
 */
const IL_UNIT_RE = new RegExp(
    `(\\p{Nd}[\\p{Nd}.,]*)-il\\s+(${UNIT_ALT})(?![\\p{L}\\p{M}²³/])`,
    "gu",
);
function ilLinkedUnit(text: string): string {
    return rewrite(text, IL_UNIT_RE, (_m, num: string, unit: string) => {
        const forms = UNITS[unit]!;
        const n = numeralValue(num);
        const noun = Number.isNaN(n) ? forms[0]! : (forms[countForm(n)] ?? forms[0]!);
        return `${num}-il ${noun}`;
    });
}

/**
 * ── STEP 6. THE € SPELLING FOLD — one instance, and it exists to stop a DOUBLING ─────────────────────────
 *
 * The tier suppresses its own currency word when the text already carries it, testing every DECLARED form.
 * The artifact writes `€0.05 euro` — the sign, then the noun in the English/Italian spelling — and `euro` is
 * not `ewro`, so the suppression cannot see it and the reading says the currency twice. Folding the loan
 * spelling to the Maltese one in this one position lets the existing guard do its job.
 *
 * ⚠ GUARDED TO THE POST-AMOUNT SLOT ON PURPOSE. `euro` is ×3 in the artifact and the other two are ordinary
 * prose (*"marbuta mal-euro"*, *"għal kull euro"*); rewriting those would be a spelling reform, not a
 * normalization, and is none of this layer's business. `ewro` is the form the artifact itself uses ×4 and
 * the wiki 227 / 20.
 */
function euroSpelling(text: string): string {
    return rewrite(text, /(€\s?\p{Nd}[\p{Nd}.,]*(?:\s\p{L}+)?\s)euro(?![\p{L}\p{M}])/giu, "$1ewro");
}

/**
 * ── STEP 8. THE DECIMAL POINT — LAST, AFTER THE SHARED TIER, and that is the load-bearing ordering ───────
 *
 * `1.2°C` read *wɪħɛt . tnɛjn k* — the dot became a SENTENCE-final pause inside a number. ×181 in the
 * retained text, `decimals` ×11,311 whole corpus, the largest single class this file touches.
 *
 * ⚠ WHY AFTER THE TIER AND NOT BEFORE IT. The fleet's usual arrangement is the reverse (Finnish: rewrite the
 * separator in normalize.ts, keep digits either side, let the tier still see number–unit adjacency). That
 * works for a unit and breaks for a CURRENCY MAGNITUDE, which is not adjacent to the number but two tokens
 * away: `$88.08 biljun` rewritten first arrives at the tier as `$88 punt 08 biljun`, the magnitude hop no
 * longer matches, and the reading becomes *…dollari punt zero tmienja biljun* — the currency in the wrong
 * slot, which is the id `US$` defect. ~15 of the 37 signed amounts in the retained text are of that shape.
 * Running last also gives the tier the TRUE quantity for agreement (`2.6cm` → *2.6 ċentimetri*, plural,
 * rather than agreeing with a stray `6`), so the coupling pays twice.
 *
 * ⚠ THE CLOCK IS EXCLUDED RATHER THAN READ, and the exclusion is counted. Maltese writes a time of day with a
 * DOT — `fl-4.00 ta' filgħodu`, `9.40am`, `10.20am`, `fl-4.30 a.m.` — which is 4 instances against 181
 * decimals. Claiming them would read *disgħa punt erbgħin*, a confidently wrong reading replacing a merely
 * wrong pause, so the guard refuses the whole match and the clause break stands exactly as it did before
 * (trap 53's ak position). The guard is the RIGHT context — `am`/`pm`/`a.m.`/`p.m.`/`ta' filgħodu` — because
 * the shape alone cannot separate `9.40am` from `$88.08 biljun`, which is also `\d{1,2}\.\d{2}`.
 *
 * ⚠ AND THE SAME ORDERING KEEPS `NOT_VERSION` ARMED, WHICH IS THE THIRD THING IT BUYS AND THE REASON THE
 * ONE-LETTER `m` KEY IS SAFE HERE. Traps 39 and 46 are about a layer that rewrites the version dot into a
 * word BEFORE the tier runs, so the tier's guard has no dot left to reject and `802.11m` reads as "…eleven
 * METRES" — the defect that broke af, ca, is and sd. Running the decimal step LAST inverts that: the tier
 * sees `802.11m` with its dot intact, `NOT_VERSION` refuses it, and only then is the dot spent. Verified on
 * the shapes the guard exists to reject rather than assumed (trap 52 — test the guard on what it must
 * refuse, and READ the output):
 *
 *     802.11m → "802 punt 11m"   802.11n → "802 punt 11n"   802.11g → "802 punt 11g"   all refused
 *     1.5m → "1 punt 5 metri"    6.5m → "6 punt 5 metri"    2,764 m → "2764 metru"     all read
 *
 * So `m` is declared and costs nothing: the residual case would need a dotted designation whose trailing
 * letter is exactly `m` AND no dot, which is not a shape this orthography writes. `version-dot` is ×55 whole
 * corpus and ×0 in the 449 retained segments either way.
 */
// ⚠ THE TIMEZONE IS IN THE LIST BECAUSE `f'12.00 GMT` WAS NOT (#1102). The exclusion above is right and
// its marker list was one short: FLEURS `mt_mt` writes four dot-separated `d.dd`, two of which are genuine
// measurements (`6.34 pulzieri`, `3.50 m`, correctly decimals) and two of which are clocks — `id-9.30 am`,
// which the list already caught, and `f'12.00 GMT`, which it did not. That one fell through to the decimal
// rule and read *tnaʃ punt zɛrɔ*, "twelve point zero" — the exact confidently-wrong reading this guard
// exists to prevent, quoted in its own note as *disgħa punt erbgħin*.
const CLOCK_TAIL = /^\s?(?:[ap]\s?\.?\s?m\b|ta['’’]\s?(?:filg|wara|bil)|(?:GMT|UTC|CET|CEST)\b)/iu;

/**
 * ── THE CLOCK ───────────────────────────────────────────────────────────────────────────────────────────
 *
 * Maltese speaks a time as `hour u minutes`, never as two bare numbers, and the corpus AUDIO attests the
 * whole frame. Ten readings, different speakers, with the recognizer's output beside each:
 *
 *     11:00                 il-ħdax                              hour ALONE — no minutes at all
 *     10:00 ta' filgħodu    fl-għaxra ta' filgħodu               hour alone again
 *     1:15  ta' filgħodu    fis-siegħa **u kwart** ta' filgħodu
 *     8:30  ta' filgħaxija  fit-tmienja **u nofs** ta' filgħaxija
 *     9.30  am              id-disgħa **u nofs** ta' filgħodu     the DOTTED spelling, same frame
 *     11:20                 fil-ħdax **u għoxrin**               bare, no minute-noun
 *     11:29                 fil-ħdax u disgħa u għoxrin *minuta*
 *     7:19  a.m.            fis-sebgħa u dsatax-**il minuta**
 *     10:08 ta' filgħaxija  fl-għaxra u **tmien minuti**          construct plural
 *     15:00 utc             **it-tlieta** ta' waranofsinhar       24h spoken as 12h
 *
 * ⚠ THIS IS WHY THE RULE EARNS ITS PLACE: `l-11:00` used to read *l ħdaʃ **,** zɛrɔ* — a pause AND the
 * literal digit zero, inside a clock time. Both halves are things no reader produces.
 *
 * ⚠ THE MINUTE-NOUN IS DELIBERATELY NOT EMITTED, because the readers do not agree on it: 11:20 is bare,
 * 11:29 takes *minuta*, 7:19 the teen linker *dsatax-il minuta*, 10:08 the construct plural *tmien minuti*.
 * Three agreements for one slot. `hour u minutes` matches four of the ten EXACTLY and the rest to within
 * that noun; choosing one agreement would be wrong more often than silence is.
 *
 * ⚠ 13–23 ARE SPOKEN AS 1–11. Maltese does not say *ħmistax* for 15:00 — the reader says *it-tlieta*. The
 * day-part that disambiguates it is already written in the text where the source supplies one, so the hour
 * is mapped and the part is never invented.
 *
 * ⚠ NOT ATTEMPTED: `nieqes kwart`. The reader gave 8:46 as *fid-disgħa nieqes kwart* — quarter TO the NEXT
 * hour — which needs rounding :46 to :45 and incrementing. That is a reader's rounding, not a rule, and one
 * attestation cannot license inventing arithmetic.
 *
 * The DOTTED spelling is claimed only with a clock tail (`9.30 am`); a bare `6.34 pulzieri` and `3.50 m` are
 * decimals. The COLON needs no gate: the corpus's 28 colon pairs are 27 clocks and one `2:2` degree class,
 * which the two-digit minute excludes.
 */
function clockPhrase(h: number, mi: number): string {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    // ⚠ ONE O'CLOCK IS `siegħa`, NOT `wieħed`. The hour is feminine in the clock frame, and the written
    //   article agrees with it — the corpus has `fis-1:15`, where `fis-` < *fi + is-* selects *siegħa*.
    //   Attested: the reader says *fis-siegħa u kwart ta' filgħodu*, `f i s s i aʊ k w a r t`.
    const hour = h12 === 1 ? "siegħa" : String(h12);
    if (mi === 0) return hour;
    if (mi === 15) return `${hour} u kwart`;
    if (mi === 30) return `${hour} u nofs`;
    return `${hour} u ${mi}`;
}

function clock(text: string): string {
    const s = rewrite(text, 
        /(?<![\d.,:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/gu,
        (_m, h: string, mi: string) => clockPhrase(Number(h), Number(mi)),
    );
    return rewrite(s, 
        /(?<![\d.,:])([01]?\d|2[0-3])\.([0-5]\d)(?![\d:])/gu,
        (m: string, h: string, mi: string, offset: number, full: string) =>
            CLOCK_TAIL.test(full.slice(offset + m.length)) ? clockPhrase(Number(h), Number(mi)) : m,
    );
}

function decimalPoint(text: string): string {
    return rewrite(text, 
        /(\p{Nd})\.(\p{Nd}+)/gu,
        (_m, a: string, b: string) => `${a} ${DECIMAL_POINT} ${b}`,
    );
}

/**
 * ── STEP 7. THE SHARED SYMBOL TIER ──────────────────────────────────────────────────────────────────────
 *
 * Runs after the local steps above and before the decimal step. It owns percent, currency (with the
 * magnitude hop), units, the squared/cubed exponent and the ampersand, composing number + sign in one pass.
 *
 * `ampersand: "u"` — the Maltese conjunction, which is `maltese.jsonc`'s OWN `numbers.connector` (the ⟨u⟩ of
 * *wieħed u għoxrin*) and espeak's `mt_list` `_& u` independently. `&` is ×19 in the retained text; the HTML
 * entities among them are decoded above this layer by `core/markup.ts`, and the bare sign's real instances
 * are `R&Ż` — *Riċerka u Żvilupp*, this language's own R&D, where ⟨u⟩ is literally the expansion — plus
 * `lR&D`, `B.E. & A. & C.E.`, `RCS & RDS`, `Thames & Hudson`, `R&B`. `R&Ż` read *r s* before this.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: [PERCENT],
    currency: CURRENCY,
    units: UNITS,
    magnitudes: MAGNITUDES,
    exponentWords: { squared: SQUARED, cubed: CUBED, position: "after" },
    ampersand: "u",
    countForm,
    // A magnitude governs the SINGULAR in Maltese, exactly as a numeral above ten does — see `countForm`.
    // 11 is the smallest count that rule maps to the singular, so the fact lives in one place.
    magnitudeCount: 11,
});

/**
 * The Maltese normalization pass. The numbered order is the one argued at each step above; the two couplings
 * that cannot be recovered from the code are that **step 3 needs the `°` step 4 spends**, and that **step 8
 * must run after the tier** or a currency magnitude loses its hop.
 */
export function normalizeMaltese(input: string): string {
    let s = degroup(input); // 1. before anything: a grouping comma is otherwise a clause pause
    s = eraMarkers(s); //     2. multi-dot abbreviations before any single-dot rule
    s = minusSign(s); //      3. needs the ° and % that steps 4 and 7 consume
    s = degrees(s); //        4. needs the whole number, so before step 8
    s = rates(s); //          5. before the tier, so no unit is ever seen with a slash after it
    s = ilLinkedUnit(s); //   5b. the tier cannot cross the `-il` linker between a number and its unit
    s = euroSpelling(s); //   6. lets the tier's own redundancy guard see a variant spelling
    s = SYMBOLS(s); //        7. percent, currency + magnitude, units, exponent, ampersand
    s = clock(s); //          7b. BEFORE the decimal — 9.30 am is a time, and step 8 now claims every
    //                            digit-dot-digit unconditionally, so the clock must take its own first
    return decimalPoint(s); // 8. last: the tier needs the number whole (see the step's note)
}

/*
 * ── WHAT IS DELIBERATELY NOT DONE, each with the count and the check that refused it ────────────────────
 *
 * · NO RANGE RULE, AND IT IS THE LARGEST THING LEFT UNDONE. `ranges` ×10,638 whole corpus; in the retained
 *   text 32 ASCII and 26 en-dash digit-to-digit spans, nearly all YEARS (`1200-1000 QK`, `1911-1997`,
 *   `2001–2010`, `1588–1589`, `1974–75`) with a handful of quantities (`100–200 kelliem`, `30–35 fil-mija`,
 *   `60,000–110,000`, `10–12-il minuta`). A joiner IS attested — `sa` ("up to"), between bare numerals, in
 *   the artifact itself: *"minn 7.5 sa 10.4 ċentimetri"*, *"bejn 20 ċentimetru sa 50 ċentimetru"*, *"erbgħa
 *   sa erbgħa u għoxrin zokk"*. It is refused anyway, on TRAP 14: `sa` fuses with the definite article the
 *   following noun requires, and the article assimilates to the first consonant of the SPOKEN word —
 *   *sal-*, *sat-*, *sas-*, *saż-*, *sax-*, … The corpus writes exactly that (`sat-68 AD`, `sal-2800`,
 *   `mill-1918 sal-1939`), and the spoken word does not exist at the point this layer sees the dash: a
 *   numeral is still digits, and the tokenizer is downstream. Emitting a bare `sa` before a year would be
 *   ungrammatical in the shape the corpus overwhelmingly writes. This is Welsh's soft mutation and
 *   Azerbaijani's vowel harmony, in an orthography where the affected morpheme is written as part of the
 *   NEXT word. The dashes stay as they were — two juxtaposed cardinals, no connective, no pause.
 *   ⚠ AND BECAUSE THERE IS NO RANGE RULE, STEP 1's DE-GROUPING IS SAFE TO RUN FIRST. Where a layer has one,
 *   de-grouping ahead of it destroys the writer's grouping, which is the only evidence separating a year
 *   from a quantity (`1974–75` against `60,000–110,000`). Nothing here reads that evidence, so nothing is
 *   lost; whoever adds the range rule must move step 1 below it.
 *
 * · NO INITIALISMS, AND THIS IS A MEASURED REFUSAL OF THE DATA, NOT OF THE SEAM. `initialism` ×22,068 and
 *   `letter-name` ×36,597 whole corpus; 206 all-caps runs in the retained text, led by `UE` ×27, `PGD` ×18,
 *   `UTC` ×11, `PPP` ×6, `PDG` ×5. The readings are exactly what `core/initialisms.ts` exists to prevent:
 *
 *       PGD → [pkt]   UTC → [utk]   PDG → [ptk]   CP → [kp]   MP → [mp]   ISBN → [ɪzbn]
 *       PPP → [pp]    ⚠ one P silently LOST to the engine's word-final degemination
 *
 *   Trap 16 says check whether the seam exists before deferring, so it was checked and it does — the seam is
 *   wired by ~30 languages and needs one thing, a `letterName` table. `sources.ts` reports
 *   `espeak 30 letters — WIREABLE`, and the refusal is about whether that source can be trusted to produce
 *   ORTHOGRAPHY, which §5c says must be validated rather than derived:
 *     · espeak's letter block is PHONETIC (`b@`, `k'@`, `'@` for ⟨q⟩, `u'@` for ⟨w⟩), so ~20 of the 30 names
 *       would be an unvalidated spelling guess on top of a transcription.
 *     · The repo's own referee can check only four of them — `ġe`, `ħa`, `te` and `għajn` are in
 *       `mt.wikipron-mlt-broad.tsv`; `effe`, `emme`, `enne`, `erre`, `esse`, `be`, `de`, `ka`, `pe`, `ve` are
 *       all absent, so there is nothing to validate the other twenty-six against.
 *     · And espeak's Maltese was measured on the values this repo CAN check independently — its own numeral
 *       block against `maltese.jsonc`, which is sourced from GF-RGL and Wiktionary. **Three of sixteen are
 *       wrong about the WORD**: `_2 nei:n` drops the initial consonant of *tnejn*, `_9 dydin'asa` is not
 *       *disgħa*, and `_1C mi:au` is not *mitejn* (200 is a DUAL, not "two hundred"). That is 19%, the same
 *       rate that made the Punjabi run decline 39 numerals, and `_% procentuali` is a fourth error in the
 *       one entry this file could check against 140 wiki tokens.
 *   A validated refusal is a result. The four corroborated letter names are recorded above so the next
 *   attempt starts from them rather than from espeak alone; what is missing is an orthographic source, and
 *   `core/initialisms.ts` is not the blocker.
 *
 * · NO MULTIPLICATION WORD. `×` is ×5 in the retained text and both of its senses occur — a DIMENSION
 *   (*"Żejt fuq tila, 361 cm × 520 cm (142.13 in × 204.72 in)"*, a painting) and SCIENTIFIC NOTATION
 *   (*"2.2 × 1012 m3"*, *"1.2 × 10 10 cu ft"*, with the exponent already flattened by the source). The tier
 *   would take `times` and `by` as data and there is no word to give it: the Maltese candidates are `bi`
 *   (the ordinary preposition "with/by", far too common for a bare token count to say anything — trap 37 in
 *   its purest form) and `darbiet` ("times", the noun), neither attested between two operands. Refused
 *   whole rather than half, so `361 cm × 520 cm` reads as two measurements juxtaposed exactly as before.
 *   Left RED in `mine.ts scan` (`DROP math-sign ×17`) rather than entered as an accepted silence, because
 *   this is a sourcing gap with a reading still to find — the ki/ak position.
 *
 * · NO `=` AND NO `+`, AND THESE ARE ARGUED RATHER THAN UNSOURCED, so they ARE entered in
 *   `defects.ts`'s `ACCEPTED_SIGN_SILENCE`. `=` ×12 and not one is arithmetic: every instance is a GLOSS
 *   inside a parenthesis (*"Bibbja hi Griega (= kotba)"*, *"HTL = istituzzjoni ta' edukazzjoni"*,
 *   *"HBLA = istituzzjoni"*, *"EN = dummy subject"*) or a Greek etymology (*"αστρονομία = άστρον + νόμος"*).
 *   `+` ×10 is that same etymology, a phone country code (*"jkollu iċempel +49 89 123456"*), and one
 *   sentence ABOUT the character (*"fejn il-+ ifisser"*). Neither sign is an operator anywhere in this
 *   corpus, so silence is the correct reading and not a missing one. `<` `>` `÷` `±` are ×0.
 *
 * · NO CLOCK. `clock` ×1,858 whole corpus; ×17 colon forms in the retained text and they are mostly not
 *   times of day — `18:04:33 ħin lokali`, `08:44:06 ta' filgħodu UTC`, `3:01:43`, `14:45:15 UTC` are
 *   three-field stamps (the `sports-time` shape: a third field is not a clock), and `09:30 UTC`, `8:00 a.m.`,
 *   `12:00 p.m.` are the rest. Maltese names a time with the definite article fused onto the numeral
 *   (*fit-tmienja*, *fl-4.00*), which is trap 14 again and the same wall the range rule hit. The colon keeps
 *   the pause it already had.
 *
 * · NO ORDINALS. `ordinal-latin` ×12,903 whole corpus, and in the retained text the shape is almost absent:
 *   `2nd`, `48th`, `2°`, `5°`, `8°`, `351°` — six, of which the first two are English and the rest are
 *   coordinates. Maltese spells its ordinals as words (*l-ewwel*, *it-tieni*, *is-seklu 15*), so there is no
 *   digit-plus-suffix form for a rule to claim.
 *
 * · NO FRACTIONS. `fractions` ×600 whole corpus. The retained `N/N` instances are overwhelmingly not
 *   fractions: `2004/05`, `1952/1958`, `2022/23` are seasons and academic years, `seklu 9/10` and
 *   `seklu 12/13` are century pairs, `4.92/10`, `3.78/10`, `2.2/10` are index scores. The one real fraction
 *   is `2⁄3` (U+2044), written with the FRACTION SLASH and already glossed in its own sentence.
 *   `sources.ts` reports `[part] fraction-series`; there is nothing in this corpus for it to compose for.
 *
 * · NO `-il` LINKER JOIN, and the reason is that it is an ENGINE question rather than a normalization one.
 *   The corpus writes the teen linker after digits ×28 (`12-il istituzzjoni`, `19-il pajjiż`, `16-il siġġu`,
 *   `48,514-il vot`), and the engine's own number path already emits it correctly for a spelled numeral —
 *   `12345` reads *tnaʃɪl ɛlf …*, one token. Written as `12-il`, the same morpheme reads *tnaʃ ɪl*, two.
 *   ⚠ NOT THE SAME QUESTION AS STEP 5b, which is about what comes AFTER the linker: that step makes the unit
 *   SYMBOL readable across it (`16-il ċm` → *16-il ċentimetru*) and leaves the linker exactly as it found
 *   it. This refusal is about the SPACE inside the numeral itself, which no normalization can close.
 *   The difference is one space in the IPA and it cannot be closed from here: the fix is for the engine's
 *   `TOKEN` class to admit an interior hyphen, which is a change to every hyphenated word in the language
 *   and owes its own corpus diff. Recorded with the count so it is not re-derived.
 *
 * · NO `l`, `t`, `in` OR `mm` UNIT KEYS, AND THREE OF THOSE ARE `sources.ts` FALSE POSITIVES WORTH NAMING.
 *   That report says the corpus writes `l×22` and `t×4` after a number. Both are artefacts of this
 *   orthography and neither is a unit: every digit-adjacent `l` is the DEFINITE ARTICLE after a year and a
 *   comma (`fl-2018, l-akbar`, `870 l-`), and all four `t` are the elided *ta'* (`15 t'Ottubru`,
 *   `25 t'Awwissu`). Declaring either would read an article as a litre. `in` is a genuine inch ×5 but is
 *   also the article before ⟨n⟩ (`2017, in-nofsinhar`) and appears only in English parenthetical glosses.
 *   `milimetru` is `absent` on the wiki (0 tokens), so `mm` has no word.
 *
 * · NO BARE-`°` READING, NO `mph`, NO `sq`-ALONE. Argued at step 4 for the degree sign; `mph` ×4 is an
 *   English gloss beside a metric figure and its Maltese rate idiom (*mili fis-siegħa*) is unattested.
 *
 * · NO SPACE-GROUPING, AND THE COUNTER-EXAMPLE IS WHY. `review.ts`'s ordinary-text probe reads `5 000` as
 *   two numbers, which looks like a gap until the shape is counted here: `\d+ \d{3}` is ×3 in the retained
 *   text, and they are `800 000 habitants`, `250 000 habitants` — both inside the same French-flavoured
 *   sentence about Bilbao — and **`telefon 089 123456`, a PHONE NUMBER**, which a grouping rule would fuse
 *   into one nine-digit numeral. This corpus writes the English convention (comma thousands ×160), so a
 *   space-grouping rule would buy two readings and invent one; that is trap 9's bar, failed. Whoever
 *   revisits it needs a left guard that excludes a preceding `telefon`/`tel.`, or a corpus that groups
 *   with spaces often enough for the ratio to reverse.
 */
