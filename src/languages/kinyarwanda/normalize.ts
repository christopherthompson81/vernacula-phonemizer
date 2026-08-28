/**
 * Kinyarwanda / Ikinyarwanda (rw) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which
 * is not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Evidence: `tools/corpus/mined/rw.jsonc` (54,917 paragraph segments from an rw.wikipedia dump; the 442-line
 * hard+sample artifact is what every count below is measured over) and `tools/corpus/attest/rw.jsonc`. rw has
 * no FLEURS corpus, and espeak ships no Kinyarwanda at all, so the artifact, the referee word list and
 * `attest.ts` against rw.wikipedia are the whole haystack. ⚠ Kinyarwanda and Kirundi (`rn`) are mutually
 * intelligible and share sources; nothing below leans on a Kirundi citation, and where one was available it
 * was not used.
 *
 * What the engine did before this file existed (probed, not assumed — playbook step 2):
 *
 *     60%          → miɾoŋo itandatu              the % DROPPED                       1,231 in the corpus
 *     $1,000       → ɾimwe , zeɾu                 sign dropped, grouping comma = a CLAUSE PAUSE     186 / 1,813
 *     500.000      → maɡana atanu . zeɾu          grouping period = a SENTENCE BREAK mid-number
 *     49.5%        → … ine na ikʲenda . ɡatanu    decimal point = a sentence break    3,225
 *     26,338 km²   → … km                         ² dropped, `km` reaches the IPA RAW   201 / 299
 *     km² 26,338   → km …                         unit written BEFORE the number — invisible to the tier
 *     20 °C        → makumʲabiɾi t͡ʃ               ° dropped, the scale letter read as [t͡ʃ]        227
 *     −27.2 °C     → … . kabiɾi t͡ʃ                the minus dropped — and a dropped minus INVERTS
 *     15-24        → two bare cardinals           the span joiner dropped               1,849
 *     2:51:07      → kabiɾi , … , kaɾindwi        `:` is clausePunctuation → pauses inside a race time
 *     U.R.S.S.     → u . ɾ . s . s .              four spurious sentence breaks in one token         177
 *     A & B        → a b                          the & DROPPED                           930
 *
 * ⚠ THIS FILE OWNS THE SHARED-TIER CALL, because rw needs rules on BOTH SIDES of it and no fixed order works:
 *   · DE-GROUPING must run BEFORE the tier. The corpus writes `1.300m` and `1.800m` — GROUPED THOUSANDS glued
 *     to a one-letter unit — and the tier's `NOT_VERSION` guard (`802.11g` is not eleven grams) rejects
 *     exactly `\d+[.,]\d+[a-zA-Z]`, so those metres are refused. De-grouped first, `1300m` reads. Trap 39/46
 *     seen from the other end: usually the hazard is a language SPENDING the dot before the tier; here it is
 *     the language needing to spend a GROUPING dot so the tier's version guard stops firing on a real number.
 *   · THE DECIMAL SPELL-OUT must run AFTER the tier, or the tier sees `49 5 %` and there is no number beside
 *     the sign. This is the same coupling Chichewa and Swahili record.
 * Neither the Xhosa order (`SYMBOLS(normalize(x))`) nor the Chichewa one (`normalize(SYMBOLS(x))`) can satisfy
 * both, so the sequence is written out here — the shape 33 other languages already use.
 *
 * ⚠ TRAP 14/15 DOES NOT ARISE, measured rather than assumed. Kinyarwanda numerals ARE bound stems taking
 * noun-class concord (see numbers.ts), so a Xhosa-style concord glued to the digits was the thing to look
 * for. It is not there: `digit-hyphen-letter` in the artifact is `2021-09-15`-style ISO dates, `3-5 T/Ha` and
 * `Kuva 2006-Ukwakira` (a hyphen standing for "to" before a MONTH NAME, not a suffix); `letter-hyphen-digit`
 * is `Pub. L. 100–407`, `COVID-19`, `PH5.5-6`. The 60-odd `digit + short word` pairs are ordinary particles
 * standing as WORDS (`abantu 438 kuri`, `miliyoni 70 z'amadolari`, `70% by'abatuye`), never a detached bound
 * morpheme. So every rule below is free to leave its operand as DIGITS, which is also what keeps the tier's
 * number↔unit adjacency alive.
 *
 * ⚠ AND THE CONCORD-INSIDE-A-NUMERAL QUESTION IS ALREADY SETTLED ELSEWHERE, checked rather than re-opened.
 * nya's `mamiliyoni asanu ndi anayi` carries class-6 concord in both slots of a 5+4 compound; rw's equivalent
 * is `numbers.ts`'s per-magnitude multiplier series (`mirongo itatu` / `magana abiri` / `ibihumbi bibiri`),
 * which is committed, tested, and SHARED WITH KIRUNDI. Nothing here touches it.
 *
 * Deliberately not done, each with its measurement:
 *   · NO DECIMAL-SEPARATOR WORD. `akadomo` is attested (rw.wikipedia 9 hits / 8 articles) and every sense is
 *     wrong: a full-stop metaphor (*ishyira akadomo ku kurambagiza*), a black SPOT on a bird's beak, braille
 *     dots (*akadomo 5 (koma)*), a musical dot. That is a refusal on SENSE — the `amaphuzu` shape, which
 *     stands on the evidence alone — not a refusal on silence. `sources.ts` reports `[NONE] decimal-point`
 *     independently. The separator is removed and the fractional digits are read one at a time.
 *   · NO FAHRENHEIT NAME. `farenheti` is **0 tokens / 0 articles** on rw.wikipedia. And every `°F` in the
 *     corpus sits in a parenthetical glossing a `°C` figure already given (`24 ° C (75 ° F)`, `−27.2 °C
 *     (−17.0 °F)`, `57.8 ° C (136.0 ° F)`) — trap 12 redundancy. The letter is CLAIMED so it cannot reach the
 *     g2p as a phoneme; the scale is left unsaid rather than invented.
 *   · NO `€`. `iyero` scores 1 hit in 1 article on rw.wikipedia, and that article is the one the corpus
 *     already carries — so the "second haystack" is not independent evidence. A dropped sign is missing; a
 *     wrong currency word is confidently wrong.
 *   · NO `=` RULE (×13). Not one is arithmetic: foreign-language glosses (`Yağ Camii = 'Umusigiti
 *     w'Amavuta'`, `anesthésie = perte de la sensibilité au tact`), an infobox field
 *     (`population_estimate = 2,944,459`), EasyTimeline markup (`PlotArea = left:50`), and colour mixing
 *     (`umutuku + umuhondo = ikijuju`).
 *   · NO `+` RULE (×7). Two chemical formulations (`Cypermethrin 4%+profenofos 40%`), three colour-mixing,
 *     one English (`11+ people`), one album title. No arithmetic addition anywhere, and nothing attests a
 *     Kinyarwanda word for the sign — the playbook's fleet-wide finding for the plus, which is also the one
 *     sign whose omission is LOSSLESS.
 *   · NO `×` RULE (×2). Both are LOST SUPERSCRIPTS: `gigawatt 100 (130 × 106 hp)` and `toni 500 × 106` are
 *     `10⁶` with the power flattened by the dump pipeline. Any reading of those two is wrong.
 *   · NO `<` `>` `÷` `±` RULE. All four are **×0 in the artifact** — there is nothing to read, and no
 *     Kinyarwanda word for any of them is attested in the corpus, the referee list or on rw.wikipedia.
 *     Recorded so the absence is a measurement rather than an oversight (trap 25: a zero count is a query
 *     that has been run, and this one has).
 *   · NO GENERAL MINUS. Step 5 reads the sign on a TEMPERATURE only, because that is the only slot with an
 *     attested reading (`munsi ya zeru`, "below zero" — a phrase that presupposes a scale with a zero point
 *     and says nothing about a bare `-5`). Of the artifact's 7 dropped minuses, 3 are those temperatures and
 *     the other 4 are date spans and a range (`1949 -2020`, `1937 –1994`, `1924 –1976`, `50 -150`), which
 *     step 7 claims as spans or leaves alone.
 *   · NO FRACTION RULE. The `fractions` cell (432 corpus-wide) is entirely dd/mm/yyyy DATES — `15/02/1959`,
 *     `13/04/1994`, `11/04/1994` — plus decree numbers (`029/2005`, `082/01`). Not one fraction, and
 *     `sources.ts` reports no denominator series to compose from either.
 *   · NO LETTER NAMES, so no initialisms (12,856 in the corpus). `core/initialisms.ts` needs a `letterName`
 *     table; espeak ships no Kinyarwanda and no in-repo source carries one, so wiring the pass would be a
 *     NO-OP. A sourcing gap, not a seam gap (trap 16 checked, and the answer here really is "no data").
 *
 * ── FILED WHILE PORTING TO C# (2026-08-26), NOT FIXED — each needs a decision this file cannot make ────
 *   · ⚠ `saidNear` GIVES ONE CONSTRUCTION TWO ANSWERS. It reads the ±45-character window of the string
 *     `String.replace` handed the callback — the PRE-replacement one — so a sibling match in the SAME pass
 *     is invisible to it while one in a LATER pass is not. The corpus's own °C/(°F) glosses split on it:
 *     `−27.2 °C (−17.0 °F)` says `dogere` TWICE (both figures negative, both claimed by step 4a) while
 *     `−14.4 °C (6.1 °F)` says it ONCE (the second figure falls to 4c, whose snapshot already carries 4a's
 *     insertion). `25.3°C na 27.7°C` likewise doubles it, where the corpus's own spell-out
 *     (`dogere 22° na 35° z'amajyepfo`) writes the noun once for two signs. ⚠ THE BLANKET FIX REGRESSES 4d:
 *     `2° 36′ 58″ S, 29° 44′ 34″ E` is 14 characters apart and rw repeats the noun per AXIS on purpose. So
 *     the fix is per-arm — within-pass memory for 4a/4b/4c, none for 4d — and it moves both of the golden's
 *     degree-bearing rows on n=1 and n=5. Recorded rather than guessed at.
 *   · ⚠ MAGNITUDE + NUMBER + CURRENCY IS SPLIT DOWN THE MIDDLE, ×7. `miliyari 290 Frw` reads *miliyari
 *     amafaranga y'u Rwanda 290* — the magnitude noun and its count separated by the currency phrase; same
 *     for `miliyoni 158$`, `miliyoni 20 $`, `miliyoni 2 Frw`, `miliyoni $800`, `miliyoni $440`,
 *     `miliyoni $247`. The `magnitudes` refusal above is stated as a fact about the TIER'S CAPABILITY
 *     ("`magAlt` matches NUMBER-then-magnitude, so the hop can never fire") — which is true, and is the
 *     defect: `core/normalizeSymbols.ts` has no magnitude-BEFORE-number arm at all. nya is the mirror case
 *     (NOUN+NUMBER+MAGNITUDE), so the tier already meets at least three orders. A FLEET call on the shared
 *     tier, not a per-language patch — the `roman`/`DC` shape.
 *   · Step 1 FUSES a person's spaced initials into a pseudo-word — `P. W. Botha` → *pw botha*, `H. W. Bush`
 *     → *hw buʃ*, both corpus lines. The discriminator is clean (all 6 abbreviation instances are UNSPACED,
 *     both initial runs are SPACED), but with NO LETTER NAMES every available output is wrong, so the
 *     blocker is the sourcing gap two bullets up rather than this rule's shape.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { MANIFEST } from "./manifest.ts";
import { tr } from "../../core/provenance.ts";

/** The manifest's own conjunction — the number joiner (*icumi NA umunani*), reused for `&` and for the
 *  clock's hour/minute link. Read from the manifest so the two can never drift apart. */
const AND = MANIFEST.numbers.and;

/** The manifest's own zero word, so the "below zero" phrase cannot drift from the numeral. */
const ZERO = MANIFEST.numbers.units[0]!;

/**
 * THE MEASURE NOUNS, one table shared by the tier (step 8, number-then-unit) and by step 3 (unit-then-number,
 * which the tier cannot see). Every word is an rw.wikipedia token read in the number slot, and the ORDER is
 * not in doubt either: a measure noun heads its phrase in Kinyarwanda exactly as it does in Swahili and
 * Chichewa — `kilometero 83`, `metero 900`, `toni 10`, `hegitari miliyoni ebyiri`, `litiro 4,5`, `garama 100`,
 * `santimetero 15`, `milimetero 40`, and in the rw corpus itself `metero 2700`, `Toni 10`, `kg 250`, `ml 10`.
 *
 *   kilometero  59 hits / 20 articles   `kilometero 2,798`, `kilometero 2,500`, `kilometero 83`
 *   metero     259 / 20                 `metero 400`, `metero 14.81`, `metero 1500`
 *   santimetero 43 / 20                 `santimetero 15 na 20`, `santimetero 1,5 kugera kuri 2,5`
 *   milimetero  38 / 20                 `milimetero 40 na 60`, `milimetero 10`
 *   litiro      46 / 19                 `litiro 4,5`, `Litiro enye z'amazi`
 *   hegitari    85 / 20                 `hegitari miliyoni 150`, and the corpus's `Toni 10 kuri ha`
 *   toni        77 / 20                 `toni 6996`, `toni 7 600`
 *   garama       6+                     `garama 100 z'urubuto`, `garama 18 za poroteyine`, `garama 35-40`
 *   mililitiro   3 / 3                  `107 kuri mililitiro y'amazi`, `virusi kuri mililitiro yamaraso` —
 *                                       every hit is the volume noun. ⚠ ALL THREE ARE THE DENOMINATOR
 *                                       POSITION, so the PREFIX order is inferred from the eight units above
 *                                       rather than attested for this word specifically. Said, not assumed.
 *   kirogarama   2 / 2                  ⚠ ONE of the two is the unit, and it is GLOSSED AGAINST THE SYMBOL:
 *                                       *"Hakenerwa kirogarama ijana z'imbuto kuri hegitari imwe (100kg/ha)"*.
 *                                       The other is slang for a very short person — trap 37 polysemy, and
 *                                       the collocation is what attests it, not the bare count.
 *
 * ⚠ THREE ONE-LETTER KEYS ARE DECLARED — `m`, `g`, `l` — and trap 46 says corpus-clean is not enough, so each
 * was checked against what SPENDS THE DOT:
 *   · every digit-adjacent instance is genuine (`550 m`, `1.300m`, `1.800m`, `1.000M`; `50g 20g 16g 200g
 *     100g 1300g 150 g`; `1l ×4`, `1,5l`) — 0 counter-examples;
 *   · rw writes NO word-internal apostrophe after a digit (`\dm['’]` is ×0, unlike Chichewa's locative `m'`
 *     which cost nya this very key), and the tier's own trailing guard rejects `'`/`’` anyway;
 *   · a capital `M` is NOT folded by the tier (single letters are never case-corrected, by design), which is
 *     what keeps the corpus's `amadorari 13.5M` — 13.5 MILLION dollars — out of the metre path;
 *   · and the dotted-version hazard is closed by ORDER, not by luck: `NOT_VERSION` needs to SEE the dot, and
 *     step 10 (the decimal rewrite) is the only rule that spends one — it runs after the tier. This is the
 *     fleet-level ordering fix trap 46 asks for, done rather than deferred.
 * The residual cost is stated rather than hidden: `NOT_VERSION` also rejects a genuine DECIMAL glued to a
 * one-letter key, so `1,5l/Ha` loses its litre (×1). Step 2 rescues the GROUPED cases (`1.300m`, `1.800m`)
 * by de-grouping first; a true decimal cannot be rescued without disarming the guard.
 *
 * ⚠ `t` (tonne) IS NOT DECLARED. A bare `t` is a common letter and the corpus's only instance is `3-5 T/Ha`,
 * where the capital would need folding — while `Toni`/`toni` is written OUT 15 times. Nothing to gain, a
 * whole letter to lose.
 */
const UNIT: Readonly<Record<string, string>> = {
    km: "kilometero",
    m: "metero",
    cm: "santimetero",
    mm: "milimetero",
    kg: "kirogarama",
    g: "garama",
    // ⚠ TWO NON-SI SPELLINGS OF THE GRAM SYMBOL, and this corpus writes BOTH IN ONE SENTENCE — the
    // fertiliser-dosing instructions: *"Gushyiramo ifumbire ya NPK GR 12.5 kuri buri m2 1 … agafuniko 1
    // kagira GM 6"* (apply NPK 12.5 g per m²; one bottle cap holds 6 g). Neither is the SI symbol, and
    // neither is a word being invented: `garama` is already the declared reading of ⟨g⟩ two lines up,
    // sourced there. What is claimed here is only that this text spells that symbol `gr` and `gm`.
    // ⚠ THE UNIT PRECEDES ITS FIGURE IN BOTH, which is why the shared tier's DIGIT-ADJACENT arm cannot
    // reach them (it matches number-then-symbol whatever `unitPrefix` does to the output order) and why
    // the BARE-UNIT arm is what reads them — it declines only beside a numeral, a slash or an exponent,
    // and emits the singular, which is right for a symbol standing on its own.
    // ⚠ `gr` IS THE ONE THE GATE CANNOT SEE, and that is why it is declared alongside the reported `gm`.
    // The raw-Latin differential compares the source run with the IPA token, and this engine reads ASCII
    // ⟨r⟩ as ɾ — so `gr` echoed as *ɡɾ*, which is not byte-identical to `gr` and never reported, while the
    // identical defect one clause away did. Fixing only the visible half would have left the same sentence
    // half-read.
    // ⚠ Exposure: the bare-unit path is EXACT-CASE, so `GM`/`Gr` (General Motors, a grade) cannot match;
    // the digit-adjacent path does fold case, so a `1968 GM` would read as grams. ×0 in this corpus.
    gm: "garama",
    gr: "garama",
    ml: "mililitiro",
    l: "litiro",
    ha: "hegitari",
};

/** Squared / cubed, both attested as a COLLOCATION and both POSTPOSED to the unit noun.
 *  · `kare` — the rw corpus writes `kilometero kare 1,219,912` and `kilometero kare 98.8Km2`; rw.wikipedia
 *    adds `kilometero kare 1,221,037 / 30,000 / 19,633 / 290 / 45 / 20.4 / 3,245`, and the slot probe
 *    `attest.ts --after kilometero,metero` returns `kare ×8` with NO competitor.
 *    ⚠ TRAP 37 IS LIVE AND LOUD HERE: bare `kare` is ×38 in the artifact and 36 of those are `karere`
 *    (district) or the adverb `kare` ("early"). The bare token count measures a different word entirely; only
 *    `kilometero kare` attests this one.
 *  · `kibe` — the rw corpus GLOSSES IT AGAINST THE ENGLISH, twice: `kilometero kibe 65 (16 cu mi)` and
 *    `kilometero kibe 256 (61 cu mi)`. rw.wikipedia has 31 hits / 20 articles, all `metero kibe`, one of them
 *    glossed `(metero kibe) 7,200 cubic metres (254,266 cu ft)`. */
const SQUARED = "kare";
const CUBED = "kibe";

/**
 * Degree vocabulary.
 * · `dogere` — rw.wikipedia 31/20; the corpus writes `hagati ya dogere 22° na 35° z'amajyepfo (S)`, i.e. the
 *   noun BEFORE its number and beside the sign itself. Both senses attested: temperature
 *   (`dogere selisiyusi 33`) and angle (`ugaragara kuri dogere 20`).
 * · `selisiyusi` — rw.wikipedia 17/10, EVERY one in the temperature slot (`dogere selisiyusi 31`,
 *   `dogere selisiyusi 32.4`, `dogere selisiyusi 35.4`, `dogere selisiyusi 26-28`), and the scale article
 *   names the symbol outright: *"umunzani wa selisiyusi ufite ikimenyetso cya C °"*.
 *   ⚠ `sources.ts` reports `[NONE] scale-names` for rw. The wiki OVERTURNS that, which is exactly what that
 *   tool's own header says its negatives are worth.
 * · `munsi ya zeru` — "below zero", the reading for a NEGATIVE temperature. Attested verbatim on
 *   rw.wikipedia (*"mu bushyuhe bugera kuri dogere 160 no munsi ya dogere 40 munsi ya zeru"*) and again in
 *   shape with the other zero spelling (*"ubukonje bwo hasi bwa dogere 20 munsi ya zero"*), two independent
 *   articles. `zeru` is read from the manifest, so it is the engine's own numeral rather than a second
 *   spelling of it.
 *   ⚠ POSTPOSED, and SCOPED TO TEMPERATURES. Both attestations put the phrase after the figure, and both are
 *   temperatures — "below zero" presupposes a scale with a zero point and says nothing about a bare `-5`.
 *   That is why there is no general minus rule.
 */
const DEGREE = "dogere";
const CELSIUS = "selisiyusi";
const BELOW_ZERO = `munsi ya ${ZERO}`;

/** Compass points, for a degree that is a COORDINATE rather than a temperature (`2° 36′ 58″ S`, `1.867 ° S`).
 *  Each is the ordinary directional noun the corpus uses dozens of times in exactly that sense —
 *  `mu majyaruguru`, `mu majyepfo y'iburasirazuba`, `mu burengerazuba bwa Uganda` — and the corpus's own
 *  coordinate sentence glosses two of them: *"hagati ya dogere 22° na 35° z'amajyepfo (S) na dogere 16° na
 *  33° z'iburasirazuba (E)"*. */
const COMPASS: Readonly<Record<string, string>> = {
    N: "amajyaruguru", S: "amajyepfo", E: "iburasirazuba", W: "uburengerazuba",
};

/**
 * Clock and duration nouns, each attested in its own slot on rw.wikipedia.
 * · `saa` — Kinyarwanda uses the Swahili-style clock and the hour word PRECEDES: *"hagati ya saa 10:00 za
 *   mbere ya saa sita na saa 3:00 za nyuma ya saa sita"*, *"Kuva saa moya z'igitondo kugeza saa sita
 *   z'amanywa"*. The rw corpus carries the first of those sentences.
 * · `iminota` — minutes, count AFTER: *"iminota 4: 02.12 kuri metero 1500"*, *"amasaha 2, iminota 26"*.
 * · `amasaha` / `amasegonda` — the DURATION nouns, and one wiki sentence spells out exactly the quantity
 *   `H:MM:SS` abbreviates: *"akoresha amasaha 2, iminota 26, amasegonda 5"*, in the same article class as
 *   *"akoresheje amasaha 2:19:31"*. So step 6 composes from an attested spell-out of its own shape rather
 *   than inventing a pace reading.
 */
const HOUR_MARKER = "saa";
const MINUTES = "iminota";
const HOURS = "amasaha";
const SECONDS = "amasegonda";

/** Timezone abbreviations written after a time in the corpus (`11:59:59 UTC`, `10:00:00 UTC`). Their presence
 *  is what marks a three-field colon run as a TIMESTAMP rather than a race duration — see step 6. */
const TZ = "UTC|GMT|CAT|EAT|WAT|CET|EST|BST";

/**
 * The shared symbol tier. Sourcing for every word is in the header table above; what follows is why each
 * FIELD is set the way it is.
 *
 * · `percent` / no `percentPrefix` — `ku ijana` is POSTPOSED in all 111 attestations (corpus ×2,
 *   rw.wikipedia 109/20): `9,5 ku ijana`, `46 ku ijana`, `80 ku ijana`, `2 ku ijana by'amafaranga`. Unlike
 *   Swahili's prefixed *asilimia 31* — the two Bantu languages differ and the corpus says which is which.
 * · `currency` / `currencyPrefix` — `amadolari` PRECEDES its figure (`amadolari 20.000`, `amadolari
 *   y'Amerika 1.00`, `amadolari arenga igihumbi`), matching every other measure noun in the language. The
 *   `Amadolari ya Amerika` article names `$`, `USD` and `US $` as its symbols, which is what closes both the
 *   bare and the compound key. `Frw`/`Rwf`/`RWF`/`FRw`/`RF` are declared for the same reason one step further
 *   on: the `Amafaranga yu Rwanda` article names `FRw` and `RF` outright, and the corpus writes
 *   `miliyari 290 Frw` and `Rwf120,250`.
 *   ⚠ THE CODE KEYS ARE CASE-VARIANTS, DECLARED EXPLICITLY. The tier's case folding is for UNITS, not
 *   currency keys, and the corpus writes three different casings of the same three letters.
 * · `magnitudes` IS DELIBERATELY WITHHELD, and the corpus decided it. The field makes the magnitude hop to
 *   the currency word's side of the number, which is right for *cinco millones de dólares* and pointless
 *   here: Kinyarwanda's order is MAGNITUDE + NUMBER, 30 instances and no counter-example — `miliyoni 14`,
 *   `miliyoni 56.31`, `miliyoni $800`, `miliyoni 70 z'amadolari`, `miliyari 290 Frw`, `hegitari miliyoni
 *   150`. The tier's `magAlt` matches NUMBER-then-magnitude, so the hop can never fire.
 *   ⚠ THE PLAYBOOK'S "one declaration, two consumers" WARNING WAS CHECKED, NOT ASSUMED: the field also gates
 *   `magAltU`, the UNIT path's connective hop (`2,2 miliyoni km²`). That shape is ×0 here for the same
 *   reason — rw writes `km² 2,92` — so the second consumer loses nothing.
 *   ⚠ Same conclusion nya reached, from the OPPOSITE order: Chichewa is NOUN+NUMBER+MAGNITUDE and
 *   Kinyarwanda is MAGNITUDE+NUMBER. Neither is the tier's `$5 million`, and the tier is right to be asked
 *   about each language separately.
 * · `units` / `unitPrefix` — see UNIT above for the words and for the one-letter-key audit.
 * · `unitPer` / rate — `kuri`, and the corpus GLOSSES ITS OWN SYMBOL: *"Hakenerwa kirogarama ijana z'imbuto
 *   kuri hegitari imwe (100kg/ha)"*, plus *"hashyirwa Toni 10 kuri ha z'ifumbire"*. No `rateDenominators` is
 *   needed: `ha` and `l` are wanted standalone as well (`0.3ha`, `1l` ×4) and the tier already admits every
 *   `units` key as a denominator.
 * · `exponentWords` position `after` — `kilometero kare`, `metero kibe`; the modifier follows its noun in
 *   all 17 attestations, and `unitPrefix` puts the number after both.
 * · `ampersand` — `na`, the manifest's own conjunction (×261 in the artifact), the same word the number path
 *   already spends in *icumi na umunani*. ⚠ Unlike nya, NO local entity step is needed first: `&nbsp;` and
 *   `&ndash;` are decoded UPSTREAM by `core/markup.ts` before any engine sees them (checked by probe — both
 *   already reach this layer resolved), so the tier never meets an entity name.
 * · `bareExponent` / `multiply` / `€` are NOT declared — see the header for each refusal and its count.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["ku ijana"],
    currency: {
        "US$": ["amadolari"],
        "$": ["amadolari"],
        FRw: ["amafaranga y'u Rwanda"],
        Frw: ["amafaranga y'u Rwanda"],
        RWF: ["amafaranga y'u Rwanda"],
        Rwf: ["amafaranga y'u Rwanda"],
    },
    currencyPrefix: true,
    // ⚠ `magnitudes` IS NOW DECLARED, AND SO IS THE ORDER IT COMES IN. The header used to withhold it on a
    // reason that was TRUE and was also the defect: the tier's `magAlt` matched NUMBER-then-magnitude, and
    // Kinyarwanda writes MAGNITUDE-then-number, so the hop could never fire — and the currency arm then
    // matched only the number-and-sign pair, substituting the noun BETWEEN the magnitude and its count.
    // `miliyari 290 Frw` read *miliyari amafaranga y'u Rwanda magana abiri na mirongo icyenda*.
    // 30 corpus instances, no counter-example: `miliyoni 14`, `miliyoni $800`, `miliyoni 70 z'amadolari`,
    // `miliyari 1.1 y'amadolari`, `miliyari 290 Frw`, `hegitari miliyoni 150`.
    // ⚠ WHAT IT DOES NOT CLAIM: rw's richest form links the currency with a GENITIVE (`z'amadolari`), which
    // this tier cannot emit. It emits CURRENCY + MAGNITUDE + NUMBER — the order rw's own bare
    // `amadolari 20.000` shows, with the magnitude in its attested slot. Short of the genitive, and no
    // longer stranding the magnitude from the number it counts.
    // ⚠ THE PLAYBOOK'S "one declaration, two consumers" NOTE, re-checked now that the answer changed: the
    // field also gates `magAltU`, the UNIT path's connective hop. That shape is still ×0 here (rw writes
    // `km² 2,92`), so the second consumer neither gains nor loses.
    magnitudes: ["miliyari", "miliyoni", "igihumbi", "ibihumbi"],
    magnitudePrecedes: true,
    // Derived from the ONE table above, so the tier and step 3 can never name different words for one key.
    units: Object.fromEntries(Object.entries(UNIT).map(([k, w]) => [k, [w]])),
    unitPrefix: true,
    unitPer: "kuri",
    exponentWords: { squared: [SQUARED], cubed: [CUBED], position: "after" },
    ampersand: AND,
});

/** The digits of a fractional part, spaced so the number path speaks them one at a time. ⚠ Reading `5` in
 *  `49.5` as a NUMBER would be right by accident; reading `25` in `1.25` as one would say *makumyabiri na
 *  gatanu* — "twenty-five" — which is a different quantity. */
const spell = (int: string, frac: string): string => `${int} ${[...frac].join(" ")}`;

/** Is `word` written within ~45 characters either side of this offset? The redundancy guard for `dogere`
 *  (trap 12: a text that writes both the sign and its word must say it ONCE). BOTH SIDES, because the
 *  corpus's own instance puts the noun BEFORE — *"hagati ya dogere 22° na 35°"* — while a gloss would put it
 *  after. */
function saidNear(full: string, offset: number, end: number, word: string): boolean {
    return full.slice(Math.max(0, offset - 45), end + 45).replaceAll(INSERTED + word, "").includes(word);
}

/**
 * ⚠ THE MARK THAT KEEPS THE REDUNDANCY GUARD FROM READING ITS OWN OUTPUT.
 *
 * `saidNear` asks one question — DID THE WRITER ALREADY WRITE THIS WORD? — so it must look at what the
 * writer wrote. It reads the string `String.replace` handed the callback, which is the PRE-replacement one,
 * and within a single pass that is exactly right: two matches in the same pass are invisible to each other.
 * Across passes it was not: by the time 4c runs, the string already carries 4a's INSERTED `dogere`, and 4c
 * mistook the engine's own output for the source text. So one construction got two answers depending on
 * which arm happened to claim each half:
 *
 *     −27.2 °C (−17.0 °F)   both figures negative → both 4a, one pass → `dogere` TWICE
 *     −14.4 °C (6.1 °F)     first 4a, second 4c   → 4c sees 4a's insertion → `dogere` ONCE, and the
 *                                                   parenthetical lost its noun AND its scale: bare *(6 1)*
 *
 * Every `dogere` this file emits is prefixed with U+0000, the guard strips a MARKED occurrence from the
 * window before testing, and the marks are removed at the end of the degree block. That is exact where a
 * pre-block snapshot is not: the arms rewrite as they go, so any offset into a frozen copy drifts.
 * ⚠ U+0000 cannot appear in the input — `core/clauses.ts` never emits it and no corpus line carries one —
 * and the strip is unconditional, so a mark cannot survive into the phoneme stream even if an arm declines.
 */
const INSERTED = "\u0000";

/** Normalize one Kinyarwanda input string. Steps are ORDER-DEPENDENT; each states its coupling. */
export function normalizeKinyarwanda(input: string): string {
    let s = input;

    // 1) DOTTED CAPITAL RUNS → the bare letters, BEFORE anything reads an interior dot as a phrase break
    //    (multi-dot abbreviations before single-dot). The corpus writes `U.R.S.S.`, `D.C.`, `R.R.A`,
    //    `A.L.A.R.M.`, `Pub. L.` — 177 in the corpus — each currently emitting one SENTENCE PAUSE per dot in
    //    the middle of a Kinyarwanda sentence.
    //    ⚠ THE FINAL DOT IS KEPT WHEN THE SENTENCE VISIBLY ENDS, or `…muri U.R.S.S.` loses its break. Three
    //    cases, told apart by what follows: a letter with NO space is a glued word; a space then a capital,
    //    or end of input, is a sentence end (keep the dot); anything else is mid-sentence.
    //    ⚠ THE OPTIONAL TRAILING CAPITAL is what makes `R.R.A` — dotless on its last letter, and the corpus's
    //    commonest shape for a Rwandan agency — come out `RRA` rather than `RR A`. It is bounded by
    //    `(?![\p{L}\p{M}])`, so it cannot reach into the next word.
    //    ⚠ A DOT IS ONLY EVER KEPT, NEVER ADDED — `run.endsWith(".")`, which is where this departs from the
    //    Chichewa rule it is otherwise copied from. nya's corpus writes `U.S. Census`, whose final dot is
    //    real; rw's commonest shape is the DOTLESS `R.R.A Rwanda Revenue Authority`, and the nya condition
    //    ("a space then a capital follows") would manufacture a sentence break in the middle of an agency's
    //    own name. Same three-case decision otherwise.
    s = tr(s, /(?<![\p{L}\p{M}])(?:\p{Lu}\.[ \u00a0]?){2,}(?:\p{Lu}(?![\p{L}\p{M}]))?/gu, (run: string, off: number, full: string) => {  // space, NBSP
        const letters = run.replace(/[. \u00a0]/gu, "");  // NBSP
        const rest = full.slice(off + run.length);
        if (/^[\p{L}\p{M}]/u.test(rest)) return `${letters} `;
        if (!run.endsWith(".")) return letters;
        return rest === "" || /^[ \u00a0]+\p{Lu}/u.test(rest) ? `${letters}.` : letters;  // space, NBSP
    });

    // 2) THOUSANDS DE-GROUPING, before every remaining numeric rule AND before the tier. A grouping comma
    //    reads as a clause pause and a grouping period as a full stop, so `2,944,459` came out as three
    //    clauses and `19.000.700` as three sentences.
    //
    //    ⚠ BOTH SEPARATORS DO BOTH JOBS IN THIS CORPUS, so neither identifies itself. Measured over the
    //    artifact's 442 lines:
    //
    //        separator + exactly 3 digits    38   grouping ×36   26,338 · 405,801 · 500.000 · 87.342 · 48.466
    //                                             decimal  ×2    1.867 ° S · 30.367 ° E   (COORDINATES)
    //        separator + 1–2 digits          65   ALL decimals   49.5% · 98,6% · 7.87 · 1157,3 km² · 2,92
    //        separator + 4+ digits            1   a decree number, 029/2005-style
    //
    //    36 against 2. The two counter-examples are decimal COORDINATES, and both are followed by a degree
    //    sign where no grouped number ever is — so the trailing guard rejects `°`/`º`. That is trap 24's
    //    move: when the left context is exhausted, the right context is the discriminator.
    //    ⚠ THE HEAD MUST START 1–9: a grouped number never opens with a leading zero, and without this the
    //    space arm would eat the corpus's `toni 7 600`-style figures' neighbours and any `0 620`-shaped ISBN.
    //    ⚠ THE TRAILING GUARD IS `(?!\d|[.,]\d)`, NOT `(?![\d.,])`: with the wider form a grouped number
    //    followed by a CLAUSE comma or a sentence period declines to de-group, and the leftover separator is
    //    then read as a decimal by step 10.
    //    ⚠ AND THIS IS WHY THE STEP RUNS BEFORE THE TIER. `1.300m` / `1.800m` are grouped thousands glued to
    //    a one-letter unit, and the tier's `NOT_VERSION` guard rejects exactly `\d+[.,]\d+[a-zA-Z]` — the
    //    `802.11g` defence. De-grouped first they are `1300m` and the metre reads; left alone the unit leaks
    //    raw. 2 instances, and the alternative was withdrawing the `m` key altogether.
    const NOT_COORD = "(?![ \u00a0\u202f\u2009]?[°º])";  // space, NBSP, NNBSP, thin space
    s = tr(s, new RegExp(`(?<![\\d.,])[1-9]\\d{0,2}(?:,\\d{3})+(?!\\d|[.,]\\d)${NOT_COORD}`, "gu"), (w) => w.replace(/,/gu, ""));
    s = tr(s, new RegExp(`(?<![\\d.,])[1-9]\\d{0,2}(?:\\.\\d{3})+(?!\\d|[.,]\\d)${NOT_COORD}`, "gu"), (w) => w.replace(/\./gu, ""));
    s = tr(s, /(?<![\d.,])[1-9]\d{0,2}(?:[ \u00a0\u202f\u2009]\d{3})+(?!\d)/gu, (w) => w.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space

    // 3) A UNIT ABBREVIATION WRITTEN BEFORE ITS NUMBER — `km² 26,338`, `m 900`, `cm 25`, `kg 250`, `ml 10`,
    //    `g 200`. The shared tier matches ONLY number-then-unit, so these 30 instances are structurally
    //    invisible to it: trap 47 reason 2, the Oromo case (`mm 5`, `km 6,387`), and the reason this rule is
    //    local rather than a tier setting.
    //    The output is the SAME SHAPE the tier's `unitPrefix` produces for the other 42, from the same table —
    //    `kilometero kare 26338` — so the two orders converge on one reading and neither can drift.
    //    ⚠ AFTER step 2, so a grouped operand (`km² 26,338`, `m 4,519`) is already one digit run and the
    //    exponent-plus-grouping case cannot half-match.
    //    ⚠ THE KEY IS BOUNDED ON BOTH SIDES: `(?<![\p{L}\p{M}\d])` stops `Km` matching inside a word and
    //    `(?=[ \u00a0]\d)` is what makes the rule safe at all — a bare `m` or `g` in running Kinyarwanda text is
    //    an ordinary letter, and only a following NUMBER identifies it as a unit. Case-insensitive because
    //    the corpus writes `Km² 647.7` and `Toni 10` alike (trap 7).
    //    ⚠ THE SPACE IS MANDATORY, and that is a measurement rather than tidiness: ALL 30 unit-before-number
    //    instances in the artifact are spaced (`km² 26,338`, `m 900`, `cm 25`, `kg 250`, `ml 10`, `g 200`),
    //    while the UNSPACED shape means something else entirely — `km2` is `km²` with an ASCII exponent, and
    //    an optional space let this rule read the `2` of `450,1hab/km2` as the unit's NUMBER and emit
    //    `kilometero2`. Trap 28's family: a digit touching a unit key is the one case that is not a quantity.
    //    ⚠ ONLY THE MULTI-LETTER KEYS AND `m` TAKE THIS RULE. `g`/`l` are excluded here even though they are
    //    declared on the tier: prefix position gives them no numeral guard on the LEFT that a following digit
    //    can be trusted with — `g 200` is real but so is any sentence ending in a one-letter token before a
    //    year — and the corpus's only prefixed one-letter instances are `m` ×8 and `g` ×1. `m` earns it; `g`
    //    at ×1 does not pay for the exposure.
    const PRE_UNIT = Object.keys(UNIT).filter((k) => k.length > 1 || k === "m").sort((a, b) => b.length - a.length).join("|");
    s = tr(s, 
        new RegExp(`(?<![\\p{L}\\p{M}\\d])(${PRE_UNIT})(²|³|(?<=[a-zA-Z])[23](?![\\d\\p{L}]))?(?=[ \u00a0]\\d)`, "giu"),  // space, NBSP
        (_m, key: string, exp?: string) => {
            const noun = UNIT[key.toLowerCase()]!;
            const mod = exp === undefined ? "" : ` ${exp === "²" || exp === "2" ? SQUARED : CUBED}`;
            return `${noun}${mod}`;
        },
    );

    // 4) DEGREES — the sign was dropped outright and the scale letter reached the g2p as a PHONEME: `C` as
    //    [t͡ʃ] and `F` as [f]. 227 in the corpus.
    //    ⚠ FOUR ARMS, and the order among them is longest-first so `°C` is not claimed by the bare arm.
    //    ⚠ NO FAHRENHEIT NAME IS EMITTED — see the header. The letter is CLAIMED so it cannot reach the
    //    phoneme stream raw, and the scale is left unsaid rather than invented; every `°F` in this corpus is
    //    a parenthetical gloss of a `°C` figure already given, so the reading loses nothing it had.
    //    ⚠ THE NOUN IS SUPPRESSED WHEN THE CLAUSE ALREADY CARRIES IT (`dogere 22° na 35°` writes it once for
    //    two signs), and the guard looks BOTH WAYS for the reason nya records.
    //    BEFORE step 10, which would otherwise turn `104.0 °F` into `104 0 °F` and break the adjacency.
    //    ⚠ THE DEGREE ARMS SPELL THEIR OWN DECIMAL, rather than leaving it to step 10. Step 10 takes a 1–2
    //    digit tail (see step 2's table), and the corpus's coordinate decimals are the language's ONLY
    //    three-place ones — `1.867 ° S`, `30.367 ° E` — so without this they would keep a separator that
    //    step 10 declines and step 2 deliberately excluded, and read as a sentence break inside a latitude.
    //    Claiming the number here is also trap 39 applied forward: this rule holds the evidence (the sign),
    //    so it must finish the operand rather than hand a half-read one downstream.
    const spellDec = (n: string): string => {
        const m = /^(\d+)[.,](\d+)$/u.exec(n);
        return m ? spell(m[1]!, m[2]!) : n;
    };
    const degreeBody = (n: string, off: number, end: number, full: string, scale: string): string =>
        `${saidNear(full, off, end, DEGREE) ? "" : `${INSERTED}${DEGREE} `}${scale}${spellDec(n)}`;

    //    4a) A NEGATIVE TEMPERATURE — `−27.2 °C`, `−20.1 °C`, `–7 °C`. This is the ONLY slot with an attested
    //    reading for the sign (`munsi ya zeru`, postposed; see BELOW_ZERO), and it is worth having because
    //    omitting a minus INVERTS the value where omitting a plus is lossless. All three ASCII/typographic
    //    forms of the sign are accepted; the corpus uses U+2212 and U+2013 and never the ASCII hyphen here.
    s = tr(s, /(?<![\p{L}\p{M}\d])[-−–][ \u00a0]?(\d+(?:[.,]\d+)?)[ \u00a0]?°[ \u00a0]?([CF])(?![\p{L}\p{M}])/gui,
        (w, n: string, sc: string, off: number, full: string) =>
            `${degreeBody(n, off, off + w.length, full, sc?.toUpperCase() === "C" ? `${CELSIUS} ` : "")} ${BELOW_ZERO}`);
    //    4b) A RANGE OF DEGREES — `40-42 °`, and rw.wikipedia's `dogere selisiyusi 26-28`. Claimed HERE and
    //    not by step 7, because the noun heads the whole span in Kinyarwanda (`dogere selisiyusi 26-28`, one
    //    noun for two figures) and step 7 runs later — left to itself the general range rule would split the
    //    pair and the degree arm would then attach the noun to the SECOND operand only (`40 kugeza kuri
    //    dogere 42`). Trap 14's ordering half: order by who needs the words first.
    s = tr(s, /(?<![\p{L}\p{M}\d.,-])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)[ \u00a0]?°[ \u00a0]?([CF])?(?![\p{L}\p{M}])/gui,  // space, NBSP
        (w, a: string, b: string, sc: string | undefined, off: number, full: string) =>
            Number(a) < Number(b)
                ? `${degreeBody(a, off, off + w.length, full, sc?.toUpperCase() === "C" ? `${CELSIUS} ` : "")} kugeza kuri ${b}`
                : w);
    //    4c) A SCALE TEMPERATURE.
    s = tr(s, /(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?°[ \u00a0]?([CF])(?![\p{L}\p{M}])/gui,  // space, NBSP
        (w, n: string, sc: string, off: number, full: string) =>
            degreeBody(n, off, off + w.length, full, sc?.toUpperCase() === "C" ? `${CELSIUS} ` : ""));
    //    4d) A COORDINATE — `2° 36′ 58″ S`, `1.867 ° S`, `30°33′27″ E`. The compass letter is a DIRECTION,
    //    not a scale; the prime/double-prime marks are left as they are (they carry no reading this repo has
    //    sourced) but the degree and its direction are now spoken.
    s = tr(s, /(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?°((?:[ \u00a0]?\d+[′'][ \u00a0]?)?(?:\d+[″"][ \u00a0]?)?)[ \u00a0]?([NSEW])(?![\p{L}\p{M}])/gu,  // space, NBSP
        (w, n: string, mid: string, c: string, off: number, full: string) =>
            `${degreeBody(n, off, off + w.length, full, "")} ${mid}${COMPASS[c]!}`);
    //    4e) A BARE DEGREE — `dogere 22°`, `40-42 °`.
    s = tr(s, /(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?[°º](?![\p{L}\p{M}])/gu,  // space, NBSP
        (w, n: string, off: number, full: string) => degreeBody(n, off, off + w.length, full, ""));
    //    ⚠ THE MARKS COME OFF HERE — AFTER 4e, WHICH IS THE LAST ARM. Stripping them a step earlier (my
    //    first attempt) would blind 4e to the distinction the mark exists to draw: a bare `°` following a
    //    `dogere` this file inserted would then read as one the WRITER wrote, and 4e would suppress a noun
    //    it should emit. Unconditional and once, so no mark can reach the phoneme stream even if an arm
    //    declines. See `INSERTED`.
    s = s.replaceAll(INSERTED, "");

    // 5) THE ENGLISH ORDINAL SUFFIX (`20th`, `3rd`) is NOT stripped here, because there is nothing to strip:
    //    the artifact contains ZERO `\d+(st|nd|rd|th)` instances. Kinyarwanda writes its ordinals as
    //    `wa + cardinal` (`Perezida wa 5`, `umwanya wa 101`, `icyiciro cya mbere`), which the word path
    //    already speaks. Recorded rather than left as an unexplained gap, because the `ordinal-latin` CELL is
    //    populated (4,057) and that is misleading — the cell's second alternative is `\d+\.` before a
    //    capital, which here is 93 SENTENCE-FINAL PERIODS and numbered-list markers (`1. APROSOMA`), exactly
    //    the German bare-`N.` shape trap 4 warns must not be claimed.

    // 6) COLON TIMES. The colon is `clausePunctuation`, so every one of these was emitting comma PAUSES
    //    inside a single quantity. Tabulating every `N:NN` in the artifact (trap 4's move):
    //
    //        12 THREE-FIELD runs   9 race durations   `2:51:07` `3:05:57` `2:52:50` `2:40:18` `2:33:59` `2:28:02`
    //                              2 ISO timestamps   `11:59:59 UTC` `10:00:00 UTC`   (both carry a timezone)
    //                              1 `3: 05.57`       a M:SS.dd split time
    //         2 TWO-FIELD runs     both CLOCKS, and both carry the marker: `saa 10:00`, `saa 3:00`
    //
    //    ⚠ THE MARKER IS WHAT IDENTIFIES A CLOCK, not the shape — nya's 12/12-against-0/5 discipline. Every
    //    two-field time here is preceded by `saa`, and `saa` is re-emitted rather than consumed (trap 10).
    //    ⚠ `:00` EMITS THE HOUR ALONE. The alternative is the manifest's zero word, and "saa 10 zeru zeru" is
    //    not a reading of ten o'clock in any language.
    s = tr(s, 
        new RegExp(`(?<![\\p{L}\\p{M}\\d])(${HOUR_MARKER})[ \u00a0]+([01]?\\d|2[0-3]):[ \u00a0]?([0-5]\\d)(?![:.\\d])`, "giu"),  // space, NBSP
        (_w, mark: string, h: string, m: string) =>
            Number(m) === 0 ? `${mark} ${Number(h)}` : `${mark} ${Number(h)} ${AND} ${MINUTES} ${Number(m)}`,
    );
    //    A THREE-FIELD run WITH a timezone is a timestamp: no duration reading is right for it, so the
    //    colons become spaces and the fields simply stop being three clauses. Nothing is invented.
    s = tr(s, new RegExp(`(?<![\\d:])(\\d{1,2}):(\\d{2}):(\\d{2})(?=[ \u00a0]*(?:${TZ})(?![\\p{L}\\p{M}]))`, "gu"), "$1 $2 $3");  // space, NBSP
    //    A THREE-FIELD run WITHOUT one is a RACE DURATION — 9 instances, 0 counter-examples — and the wiki
    //    spells out exactly this quantity in exactly this order: *"akoresha amasaha 2, iminota 26, amasegonda
    //    5"* beside *"akoresheje amasaha 2:19:31"*. Composed from that, not from a pace convention.
    s = tr(s, /(?<![\d:.])(\d{1,2}):[ \u00a0]?(\d{2}):[ \u00a0]?(\d{2})(?![:.\d])/gu,  // space, NBSP
        (_w, h: string, m: string, sec: string) => `${HOURS} ${Number(h)} ${MINUTES} ${Number(m)} ${SECONDS} ${Number(sec)}`);
    //    ANY REMAINING `N:NN` keeps its digits but loses the spurious pause — bible verses, split times
    //    (`3: 05.57`), sports scores. There is no attested Kinyarwanda reading for a pace or a verse
    //    reference (the playbook's `sports-time` class), so the colon is spent on a space and nothing else.
    s = tr(s, /(?<![\d:])(\d{1,2}):[ \u00a0]?(\d{2})(?![:\d])/gu, "$1 $2");  // space, NBSP

    // 7) RANGES → `kugeza kuri` ("up to"), the corpus's own span joiner: 18 digit-flanked instances
    //    (`imyaka 4 kugeza kuri 2`, `metero 2500 kugeza kuri 3200`, `abantu 2 kugeza kuri 5`, `1967 kugeza
    //    1970`, `2,2 kugeza kuri 2.8 ° C`). Tested as a PHRASE, not as a bare token (trap 41).
    //    ⚠ `kugeza kuri` RATHER THAN BARE `kugeza`: the corpus's bare form nearly always follows `kuva`
    //    ("from … to …", 12 of 13), while the form that stands alone between two figures is `kugeza kuri`
    //    (5 of 5). The rule emits the one that does not need a `kuva` in front of it.
    //    ⚠ ASCENDING ONLY, measured: of the artifact's `N-N` shapes the non-ascending ones are seasons
    //    (`1990–91`, `2013–14`), a football score (`1-0`), a fertiliser formulation (`17-17-17`) and
    //    birth–death pairs whose second operand is a YEAR that follows a full date. Claiming those would be
    //    confidently wrong.
    //    ⚠ THE GUARD EXCLUDES A HYPHEN ON EITHER SIDE, which is what declines a hyphen CHAIN: `NPK(17-17-17)`
    //    would otherwise read "17 kugeza kuri 17-17".
    //    ⚠ ONE KNOWN FALSE-POSITIVE CLASS, recorded rather than guarded away: US public-law numbers
    //    (`Pub. L. 100–407`, `103–218`, `105–394`) are ascending and read as spans. 3 against 14 genuine
    //    ascending spans, and the only available guard — "not after a capitalised word" — would decline a
    //    sentence-initial `Mu 2004-2009`.
    //    AFTER step 2 (a grouped endpoint is one digit run by now), AFTER step 4 (`40-42 °` must reach the
    //    degree rule as a number-degree pair) and BEFORE step 10.
    //
    //    ⚠ FIRST ARM: A SPAN WHOSE SECOND OPERAND CARRIES THE UNIT — `1250-1750mm`, `80-94 cm`, `1-2 ml`.
    //    The unit is HOISTED to the front of the whole span, because that is what the language writes:
    //    `santimetero 5 kugera ku 9`, `santimetero 1,5 kugera kuri 2,5`, `milimetero 40 na 60`, `garama 35-40`
    //    — one measure noun heading both figures, never repeated and never trailing.
    //    ⚠ THIS ARM MUST EXIST AT ALL BECAUSE OF THE GENERAL ARM'S RIGHT GUARD. `(?![\p{L}\p{M}])` is what
    //    keeps `2006-Ukwakira` and `COVID-19` out, so a span ending in `mm` is rejected by it — and the tier
    //    would then claim `1750mm` alone, leaving `1250-milimetero 1750`, the operands split around the noun.
    //    Trap 14's second hazard, arriving through the guard rather than through agreement: once a rule stops
    //    re-emitting an operand verbatim, its neighbours' character classes start to matter.
    //    ⚠ A PERCENT SPAN IS CLAIMED FIRST AND KEEPS ONE SIGN — `25%-30%`. The general arm cannot see it (the
    //    `%` sits between the operands) and without this the tier reads each side separately and the hyphen
    //    is DROPPED, leaving `25 ku ijana-30 ku ijana`: the span joiner silent inside a doubled noun. Emitting
    //    the sign ONCE, on the second operand, hands step 8 exactly one number to attach it to and matches
    //    what the corpus writes when it spells the span out (`hagati ya 20 na 30 %`) — the noun said once,
    //    trap 12's discipline applied to a range rather than to a redundant word.
    s = tr(s, /(?<![\d.,])(\d+)[ \u00a0]?%[ \u00a0]?[-–—][ \u00a0]?(\d+)[ \u00a0]?%/gu,  // space, NBSP
        (whole, a: string, b: string) => (Number(a) < Number(b) ? `${a} kugeza kuri ${b}%` : whole));
    const RANGE_UNIT = Object.keys(UNIT).sort((a, b) => b.length - a.length).join("|");
    s = tr(s, 
        new RegExp(`(?<![-\\d.,\\p{L}\\p{M}])(\\d+)[ \u00a0]?[-–—][ \u00a0]?(\\d+)[ \u00a0]?(${RANGE_UNIT})(²|³|(?<=[a-zA-Z])[23](?![\\d\\p{L}]))?(?![\\p{L}\\p{M}\\d'’])`, "gu"),  // space, NBSP
        (whole, a: string, b: string, key: string, exp?: string) => {
            if (Number(a) >= Number(b)) return whole;
            const mod = exp === undefined ? "" : ` ${exp === "²" || exp === "2" ? SQUARED : CUBED}`;
            return `${UNIT[key]!}${mod} ${a} kugeza kuri ${b}`;
        },
    );
    //    SECOND ARM: the bare span.
    //    ⚠ ITS RIGHT GUARD TESTS `[.,]\d` RATHER THAN A BARE `[.,]`, because a separator with no digit after
    //    it is not a decimal — it is the END OF THE CLAUSE. The bare class declined every clause-final span:
    //    `Crises 1900 – 1994,`, `hagati yimyaka 15-24.`, `Muri 2009-2010,` and `mu gihe cya 2021 - 2025.`
    //    all came back untouched and read as two juxtaposed cardinals with nothing between them, the joiner
    //    silent at exactly a sentence end (playbook trap 58, `review.ts`'s `clause-final` check).
    //    ⚠ THE DECIMAL COMMA IS STILL DEFENDED, and in this corpus that matters — Kinyarwanda writes the
    //    decimal with a comma (`2,2 kugeza kuri 2.8 ° C`, `santimetero 1,5`, `450,1hab/km2`), so a right
    //    operand continuing into `,5` must still be refused. Requiring a DIGIT after the separator refuses it
    //    for the reason it was ever refused — the number continues — while a clause comma no longer counts.
    s = tr(s, /(?<![-\d.,\p{L}\p{M}])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)(?![-\d\p{L}\p{M}]|[.,]\d)/gu,  // space, NBSP
        (whole, a: string, b: string) => (Number(a) < Number(b) ? `${a} kugeza kuri ${b}` : whole));

    // 8) THE SHARED SYMBOL TIER — percent, currency, units, rate, exponent, ampersand. See SYMBOLS above.
    //    ⚠ BETWEEN steps 2 and 10 BY NECESSITY, and both directions are load-bearing: it must see a
    //    de-grouped `1300m` (or `NOT_VERSION` refuses the unit) and it must see an intact `49.5%` (or there
    //    is no number beside the sign). That is the whole reason this file owns the call.
    s = SYMBOLS(s);

    // 9) A UNIT USED AS A BARE DENOMINATOR, with no numeral of its own — `abaturage 16.598/km²`,
    //    `450,1hab/km2`, i.e. "…per square kilometre". The tier's rate path composes NUMERATOR + `/` +
    //    denominator and cannot see a denominator standing alone, so those units reached the IPA raw with the
    //    exponent dropped. That is the tier limitation Pashto records for `هر km²`, and the connective is the
    //    same attested `kuri` step 8 uses.
    //    ⚠ AFTER THE TIER, not before: run first this would steal `200g/l` and `100kg/ha` from the rate path,
    //    which reads them properly as `garama 200 kuri litiro`. By this point a real rate has already been
    //    consumed, so a surviving `/unit` is one that had no numerator. Trap 39 in its ordinary direction —
    //    a fallback must run after the rule whose leftovers it exists to catch.
    //    ⚠ MULTI-LETTER KEYS ONLY, which is what buys the `i` flag safely (`/Ha` occurs, `/ha` is declared).
    //    A one-letter key here would read a URL PATH SEGMENT as a unit — `…archive.org/web`, `/m`, `/l` — and
    //    the two instances this arm exists for are both `km`. Trap 46's one-letter hazard through a third
    //    door: the numeral guard that makes `m` safe everywhere else does not exist in denominator position.
    const DENOM_UNIT = Object.keys(UNIT).filter((k) => k.length > 1).sort((a, b) => b.length - a.length).join("|");
    s = tr(s, 
        new RegExp(`/[ \u00a0]?(${DENOM_UNIT})(²|³|(?<=[a-zA-Z])[23](?![\\d\\p{L}]))?(?![\\p{L}\\p{M}\\d'’])`, "giu"),  // space, NBSP
        (_w, key: string, exp?: string) => {
            const mod = exp === undefined ? "" : ` ${exp === "²" || exp === "2" ? SQUARED : CUBED}`;
            return ` kuri ${UNIT[key.toLowerCase()]!}${mod}`;
        },
    );

    //    AND THE SAME GAP WITHOUT THE SLASH — `abantu 438 kuri buri km²` ("438 people per every km²"), where
    //    the numeral belongs to a different noun and the unit stands alone behind a quantifier. Claimed ONLY
    //    when an EXPONENT is present: `km²` is never anything but a unit, whereas a bare `km` behind no
    //    numeral is exactly the unguarded shape trap 46 is about. 1 instance, and it closes the last
    //    `DROP exponent` shape the artifact carries that is not a lost superscript.
    s = tr(s, 
        new RegExp(`(?<![\\p{L}\\p{M}\\d])(${DENOM_UNIT}|m)(²|³)(?![\\p{L}\\p{M}\\d'’])`, "giu"),
        (_w, key: string, exp: string) => `${UNIT[key.toLowerCase()]!} ${exp === "²" ? SQUARED : CUBED}`,
    );

    // 9b) A LONE `+`, `=` or `×` IS LEFT UNREAD, deliberately — 22 instances between them and NOT ONE is
    //    arithmetic in Kinyarwanda prose. See the header for the full tabulation; recorded in
    //    tools/normalization/defects.ts rather than guessed at.

    // 10) DECIMALS, LAST of the numeric rules — steps 2 to 8 all need their number intact, and the tier needs
    //     the digit adjacent to its sign. The separator was reaching `clausePunctuation` and becoming a
    //     SENTENCE OR CLAUSE BREAK inside a number, 3,225 times in the corpus. NO separator word is emitted;
    //     see the header for why `akadomo` was declined.
    //     ⚠ BOTH SEPARATORS, both restricted to a 1–2 digit tail — the same discipline step 2 uses from the
    //     other side. Without the tail limit these two arms would swallow any grouped thousand step 2
    //     declined (a date comma, `Ukuboza 26,2008`, has a four-digit tail and is excluded by both).
    //     ⚠ AND THIS IS THE RULE THAT SPENDS THE DOT `NOT_VERSION` NEEDS. It runs after the tier for that
    //     reason as much as for the adjacency one — trap 46's fleet-level ordering fix, applied.
    //     ⚠ THE TRAILING GUARD IS `(?!\d|[.,]\d)`, NOT `(?!\d)`, and one corpus line is the whole reason: the
    //     fertiliser grade `NPK17.17.17`. With the narrower guard the first pair matched — the following `.`
    //     is not a digit — and a product code read as "17 point one seven, 17". The wider guard rejects a
    //     separator followed by a digit, so a DOTTED CHAIN declines entirely while a decimal at a sentence
    //     END (`…49.5.`) still reads, which `(?![\d.,])` would have broken. Same shape as step 2's guard, and
    //     for the same reason: a partial match inside a longer run is the failure mode, not the neighbour.
    s = tr(s, /(?<![\d.,])(\d+)\.(\d{1,2})(?!\d|[.,]\d)/gu, (_m, i: string, f: string) => spell(i, f));
    s = tr(s, /(?<![\d.,])(\d+),(\d{1,2})(?!\d|[.,]\d)/gu, (_m, i: string, f: string) => spell(i, f));

    // ⚠ A padded replacement (` ${AND} `, `letters `) doubles a space that was already there and can leave one
    // at an edge. SLOT-GAP is a corpus-diff defect class; this pass must not feed it.
    return s.replace(/[^\S\n]{2,}/gu, " ").replace(/^[^\S\n]+|[^\S\n]+$/gu, "");
}
