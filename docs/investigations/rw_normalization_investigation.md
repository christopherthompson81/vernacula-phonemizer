# Kinyarwanda (rw) text normalization — investigation log

Chronological. Each run: the command, the question, the raw finding, the implication.
Negative results and dead ends are kept deliberately.

## Run 1 — 2026-08-11 (orientation)

**Command / question.** Read `docs/normalization_playbook.md` in full (1,585 lines, ~51 numbered traps),
then the Bantu precedents (`chichewa`, `xhosa`, `zulu`, `swahili`, `lingala`), then rw's own engine
(`src/languages/kinyarwanda/{kinyarwanda,manifest,numbers}.ts`, `kinyarwanda.jsonc`) and the committed
golden test `test/kinyarwanda.test.ts`. Question: what does rw already have, and what is the seam?

**Raw finding.**
- `src/languages/kinyarwanda/normalize.ts` does NOT exist. `registry.ts:795` calls `createKinyarwanda()`
  with no normalizer wrapper and no shared symbol tier.
- `kinyarwanda.ts` `text()` is `assembleClauses(input, TOKEN, …)` over
  `(LATIN_RUN)|(\d+)|([.!?…,;:])`. So a digit run becomes words via `numberToWords`; EVERY other
  character — `%`, `°`, `$`, `:`, `-`, `/`, `&`, `+` — is matched by nothing and is silently DROPPED
  (`:` is not even in `clausePunctuation`; see run 3).
- The mined artifact `tools/corpus/mined/rw.jsonc` already exists: 54,917 paragraph segments from an
  rw.wikipedia dump, cellsCovered 31/35. It is DUMP-sourced, so its `sample` tier is a real distribution.
- `numbers.ts` holds `composeRwandaRundi`, SHARED with Kirundi (`rn`). Any change there is a two-language
  change — treat it as out of scope for a rw-only commit.
- `test/kinyarwanda.test.ts` exists with 5 committed golden number tests. Append only.

**Implication.** rw is untreated: there is no normalizer and no symbol tier, so the whole symbol
inventory in the artifact's `counts` (percent 1,231 · currency 186 · degrees 227 · clock 632 ·
decimals 3,225 · grouped 1,813 · ranges 1,849 · ampersand 930) is currently silent or mis-read. Take the
baselines before touching anything (playbook §"Working concurrently" rule 2).

## Run 2 — 2026-08-11 (baselines, before any edit)

**Commands.**
```
npx tsx tools/normalization/corpus-diff.ts emit --lang rw --corpus mined:rw --out /tmp/rw.before
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/rw.jsonc --lang rw
npx tsx tools/referee-eval/eval.ts rw
npx tsx tools/normalization/review.ts --lang rw
npx tsx tools/normalization/sources.ts --lang rw
```
`emit` first threw `emit needs --lang --corpus --out` — rw has no FLEURS corpus, so the artifact is the
evidence and the flag is `--corpus mined:rw` (corpus-diff.ts's own `mined:` convention).

**Raw finding.**
- corpus-diff emit: **442 utterances**.
- artifact scan BEFORE: `DROP percent ×34 · DROP currency ×18 · DROP math-sign ×16 · DROP exponent ×14 ·
  DROP degree ×13 · DROP minus ×7 · DROP ampersand ×7 · MARKUP math-sign ×1` — 8 findings, 109 hits.
- referee-eval BEFORE: raw exact **1287/1600 (80.4%)**, folded backbone **1407/1600 (87.9%)**, symbol
  accuracy **96.6%**. Residual classes are all g2p disagreements with epitran (⟨sh c j⟩), nothing numeric.
- review: 1 FAIL — `normalize.ts missing`.
- sources: `[NONE] letter-names` (espeak does not ship rw at all) · `[NONE] decimal-point` ·
  `[NONE] scale-names` · `[NONE] fraction-series` · `[chk?]` for percent/currency/minus/equals/times/
  ampersand/exponent.

**Implication.** Every symbol class in rw is currently silent. `letter-names` NONE means
`core/initialisms.ts` is structurally blocked (12,856 initialism instances corpus-wide) — a sourcing gap,
not a seam gap, exactly as nya recorded. Take the artifact scan's 8 findings as the defect list to close.

## Run 3 — 2026-08-11 (probing the engine on attested forms — playbook step 2)

**Command.** `phonemize(form, "rw")` over 55 forms lifted verbatim from the artifact.

**Raw finding** (the defect list is what the engine produces, not what I assumed):

| written | reads | defect |
|---|---|---|
| `60%` | `miɾoŋo itandatu` | `%` DROPPED |
| `$1,000` | `ɾimwe , zeɾu` | sign dropped AND the grouping comma is a CLAUSE PAUSE |
| `500.000` | `maɡana atanu . zeɾu` | grouping period = a SENTENCE BREAK mid-number |
| `49.5%` | `miɾoŋo ine na ikʲenda . ɡatanu` | decimal point = sentence break; `%` gone |
| `26,338 km²` | `… km` | `²` dropped, `km` reaches the IPA RAW |
| `km² 26,338` | `km …` | unit written BEFORE the number — the tier can only postpose |
| `20 °C` | `makumʲabiɾi t͡ʃ` | `°` dropped, scale letter read as [t͡ʃ] |
| `−27.2 °C` | `makumʲabiɾi na kaɾindwi . kabiɾi t͡ʃ` | minus dropped — and it INVERTS |
| `cm 25` / `kg 250` | `t͡ʃm …` / `kɡ …` | raw abbreviation into the phoneme sink |
| `15-24` | two bare cardinals | range joiner dropped |
| `2:51:07` | `kabiɾi , … , kaɾindwi` | `:` is `clausePunctuation` → two comma pauses inside a sports time |
| `U.R.S.S.` | `u . ɾ . s . s .` | four spurious sentence breaks in one token |
| `A & B` | `a b` | `&` dropped |
| `1 + 1 = 2` | `ɾimwe ɾimwe kabiɾi` | `+` and `=` dropped |

`&ndash;`/`&nbsp;` are already handled UPSTREAM by `core/markup.ts` (entity table), so unlike nya this
layer needs no local entity step — checked rather than copied.

**Implication.** Confirms the scan. The two orderings that fall out immediately: `:` and both separators
must be claimed before the tokenizer sees them as clause marks, and the decimal rewrite must be LAST.

## Run 4 — 2026-08-11 (reading the corpus; sourcing every word)

**Commands.** Tabulations over the artifact's 442 lines (hard + sample, `mine.ts`'s own tiers), then
`attest.ts --lang rw --words …` in four batches and `attest.ts --lang rw --after kilometero,metero`.
⚠ The first two `attest.ts` calls returned `429 Too Many Requests` and then
`"rw.wikipedia.org does not respond as a wiki"` — three sibling agents are probing wikipedia at once.
Both were transient; a 45–90 s pause fixed them. **A 429 that presents as "not a wiki" is a manufactured
confident negative** (playbook trap 50's failure mode) — do not record such a run as evidence.

### The separator question, measured (the nya table, redone for rw)

|  | grouped (multi-block) | 3-digit tail | 1–2 digit tail | 4+ tail |
|---|---:|---:|---:|---:|
| `,` | 23 | 15 (ALL grouping) | 14 (all decimal) | 0 |
| `.` | 30 | 25 | 51 (all decimal) | 1 |

**Both separators do both jobs**, so neither identifies itself; the 3-digit tail is the discriminator.
⚠ TWO COUNTER-EXAMPLES, and they are the reason the guard is not just `\d{3}`: `1.867 ° S` and
`30.367 ° E` are DECIMAL COORDINATES with a three-place tail. Both are followed by a degree sign; zero
grouped numbers are. That right-context is the discriminator (trap 24's "the right context is often the
discriminator when the left context is exhausted"). 25-vs-2 with a clean guard.

### Unit ORDER — the finding that shapes the layer

    unit abbreviation BEFORE the number   30    km² 26,338 · m 900 · cm 25 · kg 250 · ml 10 · g 200 · km² 671,2
    number BEFORE the unit                42    26,338 km² · 893 km · 290km · 1750mm · 1,5l · 100kg · 94 cm

**Both orders, near-equally.** The shared tier matches ONLY number-then-unit, so 30 instances are
structurally invisible to it — trap 47 reason 2 (Oromo's `mm 5`, `km 6,387`), and it needs a local rule.
The SPOKEN order is not in doubt: every spelled-out measure noun heads its phrase — `kilometero 83`,
`metero 900`, `toni 10`, `hegitari miliyoni ebyiri`, `litiro 4,5`, `garama 100`, `santimetero 15`,
`milimetero 40` — so `unitPrefix: true` and the local rule emit the same shape.

### Magnitude order — `magnitudes` WITHDRAWN, and the measurement

`miliyoni` ×25 and `miliyari` ×5 in the artifact, and **every single one is MAGNITUDE BEFORE NUMBER**:
`miliyoni 14`, `miliyoni 56.31`, `miliyoni $800`, `miliyoni 158$`, `miliyoni 70 z'amadolari`,
`miliyari 290 Frw`, `hegitari miliyoni 150`. The tier's `magAlt` matches NUMBER-then-magnitude, so
declaring `magnitudes` buys nothing here: the hop can never fire. Zero counter-examples.
⚠ Checked the playbook's "one declaration, two consumers" warning rather than assuming it: the field also
gates `magAltU`, the UNIT path's connective hop — and that shape (`2,2 miliyoni km²`) is ×0 in this
corpus for the same reason, because rw writes `km² 2,92`. Both consumers lose nothing.
⚠ Same conclusion as nya, from the OPPOSITE order: Chichewa is NOUN+NUMBER+MAGNITUDE, Kinyarwanda is
MAGNITUDE+NUMBER. Neither is the tier's `$5 million`.

### The concord-inside-a-numeral question the parent flagged

nya's `mamiliyoni asanu ndi anayi` carries class-6 concord in BOTH slots of a 5+4 compound. rw's
compositor already does the equivalent and it is COMMITTED and TESTED (`numbers.ts` +
`test/kinyarwanda.test.ts`): each magnitude selects its own multiplier series — `mirongo itatu`,
`magana abiri`, `ibihumbi bibiri`. **That is `numbers.ts`, shared with Kirundi (`rn`), and nothing in this
layer touches it.** Checked rather than assumed; no change needed and none made.

### Every word this layer puts in a speaker's mouth, with its source

| slot | word | evidence |
|---|---|---|
| percent | `ku ijana` | corpus ×2 digit-adjacent (`2 ku ijana by'amafaranga`, `60 ku ijana by'urubyiruko`); rw.wikipedia **109 tokens / 20 articles**, and every printed example is a percentage in the number slot (`9,5 ku ijana`, `46 ku ijana`, `80 ku ijana`). POSTPOSED. |
| `$`, `US$` | `amadolari` | wiki 66/19. The `Amadolari ya Amerika` article NAMES THE SIGN: *"Afite ikimenyetso cya $ n'ikimenyetso cya USD, cyangwa US $"*. corpus ×7 (`amadolari 20.000`, `amadolari y'Amerika 1.00`) — PREFIXED. |
| `FRw`/`Frw`/`RWF`/`Rwf`/`RF` | `amafaranga y'u Rwanda` | wiki 160/20, and the currency article NAMES THE CODES: *"Amafaranga yu Rwanda (Afite ikimenyetso cya FRw, cyangwa se RF)"*. corpus `miliyari 290 Frw`, `Rwf120,250`. |
| degree | `dogere` | wiki 31/20; corpus `hagati ya dogere 22° na 35°`. PREFIXED. |
| Celsius | `selisiyusi` | wiki 17/10, ALL `dogere selisiyusi 31 / 32.4 / 33 / 35.4 / 26-28`, plus the scale article: *"umunzani wa selisiyusi ufite ikimenyetso cya C °"*. ⚠ `sources.ts` reported `[NONE] scale-names`; the wiki overturns it. |
| below zero | `munsi ya zeru` | wiki ×1 verbatim (`munsi ya dogere 40 munsi ya zeru`) and ×1 in shape with the other zero spelling (`dogere 20 munsi ya zero`). `zeru` is the engine's OWN numeral. |
| km / m / cm / mm / kg / g / l / ha / t | `kilometero` 59/20 · `metero` 259/20 · `santimetero` 43/20 · `milimetero` 38/20 · `kirogarama` 2/2 · `garama` 6+ · `litiro` 46/19 · `hegitari` 85/20 · `toni` 77/20 | all wiki-attested in the number slot and PREFIXED |
| squared | `kare` | corpus ×2 (`kilometero kare 1,219,912`, `kilometero kare 98.8Km2`); wiki `kilometero kare` ×6 and `--after kilometero,metero` returns **`kare` ×8 with no competitor**. Position AFTER the noun. |
| cubed | `kibe` | corpus ×2 GLOSSED against the English (`kilometero kibe 65 (16 cu mi)`, `kilometero kibe 256 (61 cu mi)`); wiki 31/20, all `metero kibe`, one glossed `(metero kibe) 7,200 cubic metres (254,266 cu ft)`. Position AFTER. |
| rate `per` | `kuri` | the corpus GLOSSES ITS OWN SYMBOL: *"Hakenerwa kirogarama ijana z'imbuto **kuri** hegitari imwe (100kg/ha)"*; also *"hashyirwa Toni 10 kuri ha"*. |
| range | `kugeza kuri` | corpus ×18 digit-flanked (`imyaka 4 kugeza kuri 2`, `metero 2500 kugeza kuri 3200`, `abantu 2 kugeza kuri 5`, `2,2 kugeza kuri 2.8 ° C`). Tested AS A PHRASE (trap 41). |
| `&` | `na` | the manifest's own conjunction, ×261 in the artifact; the same word `numbers.and` already spends in *icumi **na** umunani*. |
| clock | `saa`, `iminota` | wiki: *"hagati ya saa 10:00 za mbere ya saa sita na saa 3:00"*, *"Kuva saa moya z'igitondo kugeza saa sita"* — the Swahili-style clock, hour word PREFIXED. `iminota 4: 02.12 kuri metero 1500`. |
| duration | `amasaha` / `iminota` / `amasegonda` | wiki, spelling out exactly the quantity `H:MM:SS` abbreviates: *"akoresha amasaha 2, iminota 26, amasegonda 5"* beside *"akoresheje amasaha 2:19:31"*. |

### Found and DECLINED, with counts

- **decimal point.** `akadomo` IS attested (wiki 9/8) — and **every sense is wrong**: a full-stop metaphor
  (*ishyira akadomo ku kurambagiza*), a black SPOT on a bird's beak, braille dots (*akadomo 5 (koma)*), a
  musical dot. This is a SENSE refusal, not a silence refusal, so it stands on its own (the `amaphuzu`
  precedent, not the Igbo `ǹtụ̀kpọ` one). `sources.ts` also reports `[NONE] decimal-point`. The fraction
  digits are read one at a time.
- **Fahrenheit.** `farenheti` **0 tokens / 0 articles — absent**. And every `°F` in the corpus sits inside
  a parenthetical glossing a `°C` figure already given (`24 ° C (75 ° F)`, `−27.2 °C (−17.0 °F)`,
  `57.8 ° C (136.0 ° F)`) — trap 12 redundancy. The letter is CLAIMED so it cannot reach the g2p; the
  scale is left unsaid.
- **`€`.** `iyero` = **1 token, 1 article**, and that article is the same one the corpus already carries.
  One hit in one article is a lead, not a finding — nya's reasoning, reached independently.
- **`=` (×13).** Not one is arithmetic: foreign-language glosses (`Yağ Camii = 'Umusigiti w'Amavuta'`,
  `anesthésie = perte de la sensibilité`), an infobox field (`population_estimate = 2,944,459`),
  EasyTimeline markup (`PlotArea = left:50`), and colour mixing (`umutuku + umuhondo = ikijuju`).
- **`+` (×7).** Two chemical formulations (`4%+profenofos 40%`), three colour-mixing, one English
  (`11+ people`), one album title. No arithmetic addition anywhere, and nothing attests a Kinyarwanda
  word for the sign — the playbook's fleet-wide finding for the plus.
- **`×` (×2).** Both are LOST SUPERSCRIPTS: `130 × 106 hp` and `toni 500 × 106` are `10⁶` with the power
  flattened by the dump pipeline. Any reading of those two is wrong; no `×` word is attested either.
- **initialisms (12,856).** `sources.ts`: `[NONE] letter-names`, espeak ships no Kinyarwanda. Wiring
  `core/initialisms.ts` without a `letterName` table is a NO-OP. A sourcing gap, not a seam gap.
- **`/` as a fraction.** The `fractions` cell (432 corpus-wide) is **entirely dd/mm/yyyy DATES** —
  `15/02/1959`, `13/04/1994`, `11/04/1994`, plus decree numbers (`029/2005`, `082/01`). Not one fraction,
  and `sources.ts` reports no denominator series to compose from.

**Implication.** Enough to write the layer. The one architectural consequence: rules are needed on BOTH
sides of the shared tier, so `normalize.ts` owns the `SYMBOLS` call itself (33 languages already do).

## Run 5 — 2026-08-11 (writing the layer; the ordering that fell out)

**Question.** Which side of the shared symbol tier does each rule go on?

**Raw finding — it needs BOTH, and that is measured, not stylistic.**
- The corpus writes `1.300m` and `1.800m` (`hagati ya 1.300m na 1.800m`, altitudes corroborated by the same
  article's `m 900 kugeza kuri m 1800` and `metero 1.800`). These are GROUPED THOUSANDS glued to a one-letter
  unit, and the tier's `NOT_VERSION` guard is literally `(?!\d+[.,]\d+[a-zA-Z](?![a-zA-Z\d]))` — the
  `802.11g` defence — so it refuses them and the metre leaks. **De-grouping must run BEFORE the tier.**
- `49.5%` needs the number intact beside the sign. **The decimal spell-out must run AFTER the tier.**

Neither the Xhosa order (`SYMBOLS(normalize(x))`) nor the Chichewa one (`normalize(SYMBOLS(x))`) satisfies
both, so `normalize.ts` owns the `SYMBOLS` call — the shape 33 other languages already use, found by
`for f in src/languages/*/normalize.ts; grep -q makeSymbolNormalizer && grep -q 'SYMBOLS('`.

**Implication + the trap-46 note worth keeping.** This ordering is also what makes the three one-letter unit
keys (`m`, `g`, `l`) safe: `NOT_VERSION` works by SEEING the dot, and the only rule that spends one is the
decimal rewrite, which is downstream of the tier. That is the fleet-level ordering fix trap 46 calls for and
records as "not done" — done here for rw. Residual cost stated in the file: `1,5l/Ha` (×1) is a genuine
decimal glued to a one-letter key and cannot be rescued without disarming the guard.

## Run 6 — 2026-08-11 (first probe of the written layer — five defects it found)

**Command.** `normalizeKinyarwanda` + `phonemize` over 55 corpus-lifted forms.

**Raw findings, all fixed in the same session:**
1. `1250-1750mm` → `1250-milimetero 1750`. The general range arm's right guard `(?![\p{L}\p{M}])` — which is
   what keeps `2006-Ukwakira` and `COVID-19` out — rejects a span ending in a unit, so the TIER then claimed
   `1750mm` alone and split the operands around the noun. Fixed with a unit-HOISTING arm placed first, which
   is also what the language writes: `santimetero 5 kugera ku 9`, `milimetero 40 na 60`, `garama 35-40` — one
   measure noun heading both figures. Trap 14's second hazard arriving through a guard rather than agreement.
2. `40-42 °` → `40-dogere 42`, same shape one rule earlier. Fixed with a degree-RANGE arm in step 4, sourced
   from rw.wikipedia's `dogere selisiyusi 26-28`. Trap 14's ordering half: order by who needs the words first.
3. `450,1hab/km2` → `…kilometero2`. The unit-before-number rule's `(?=[  ]?\d)` read the ASCII exponent's `2`
   as the unit's NUMBER. **All 30 prefix instances in the artifact are SPACED**, and the unspaced shape means
   something else entirely, so the space is now mandatory. Trap 28's family.
4. `NPK17.17.17` → `17 1 7.17`. The decimal rule's `(?!\d)` guard passed because the character after the
   first pair is a DOT. Widened to `(?!\d|[.,]\d)`, which declines a dotted chain while `…49.5.` (a decimal
   at a sentence end) still reads — `(?![\d.,])` would have broken that.
5. `R.R.A Rwanda Revenue Authority` → `RRA. Rwanda …`. The Chichewa dotted-run rule keeps the final dot when
   "a space then a capital" follows, which is right for nya's `U.S. Census` and manufactures a sentence break
   in rw's commonest shape, which is DOTLESS. Now a dot is only ever KEPT, never added.

⚠ **A FALSE ALARM WORTH RECORDING.** A first read of the corpus diff appeared to show `kg`, `cm` and `ml`
still leaking. They were not: I had `grep -v`'d the unit words out of the diff to shorten it, which removed
every `+` line and left only the `-` (before) side. Re-tested the six lines directly and all were correct.
**Filtering a before/after diff on the thing you changed hides exactly the half you are checking.**

## Run 7 — 2026-08-11 (the gates)

| gate | before | after |
|---|---|---|
| `mine.ts scan` | 8 findings / **109** hits — percent ×34 · currency ×18 · math-sign ×16 · exponent ×14 · degree ×13 · minus ×7 · ampersand ×7 · MARKUP ×1 | 3 findings / **19** hits — math-sign ×16 · minus ×1 · MARKUP ×1 (+ REDUNDANT degree ×1, a note) |
| `corpus-diff` DROP | **94** | **21** · 162/442 utterances changed (36.7%) · DIGIT 0→0, SLOT-GAP 0→0, RAWMARK 0→0, THROW 0→0 |
| `referee-eval rw` | 1287/1600 raw · 1407/1600 folded (87.9%) · 96.6% symbol | **identical** — this layer touches symbols, the referee is a word list, and 0 words moved |
| `review.ts --lang rw` | 1 FAIL (`normalizer missing`) | 2 FAIL, **both the same argued item** (see below); `sourcing: all 8 high-traffic words attested` |
| `npx vitest run` | 236 files / 3575 pass | **236 files / 3593 pass** (16 new rw tests) |
| `npx tsc --noEmit` | clean | clean |
| `languageCatalogue.test.ts` | — | passes after `derive-normalization.py` + `build.py` |

**⚠ THE TWO REMAINING `review.ts` FAILS ARE ONE FACT, AND THEY STAY RED ON PURPOSE.** `sign classes: DROPPED:
minus` and `artifact scan: DROP minus ×1` are both the Kabarondo article's **genuine negative LATITUDE**,
`ku bubangikane bwa −2.010556`. Omitting a minus INVERTS the value where omitting a plus is lossless, and no
general Kinyarwanda sign word is attested in the corpus, the referee list or on rw.wikipedia. rw reads the
one slot it has an attested phrase for — the negative TEMPERATURE, `munsi ya zeru` — and nothing else. This
is the `ln` precedent applied deliberately: `rw.minus` is absent from `ACCEPTED_SILENT`'s class list so the
gate keeps failing. Trap 24: do not fix the FAIL.

**A flaky test, checked rather than assumed.** `test/onnx-optional.test.ts` failed three times in a row on a
5-second timeout while three sibling agents shared the machine. Verified environmental by A/B-ing it against
a pinned read-only worktree of the same commit (`git worktree add /tmp/vp-rw-base HEAD --detach`): back to
back, both trees passed in ~3.4 s. It is a cold-module-graph transform racing a 5 s limit, and the file's own
header already describes it as an intermittent CI break. Not a regression.

## Run 8 — 2026-08-11 (a defect in a SHARED tool, surfaced and NOT fixed)

**Command.** `python3 tools/language-catalogue/derive-normalization.py`

**Raw finding.** Regenerating the catalogue set `rw` to `done` — correct — and also flipped **`rn` (Kirundi)
to `inherited`**, which is FALSE. Kirundi's engine (`src/languages/kirundi/kirundi.ts`) calls no normalizer;
it borrows only `composeRwandaRundi` from `../kinyarwanda/numbers.ts`. The script's delegation heuristic is
"X imports from ../Y and CALLS something it imported", and its own comment says an import alone is not enough
"since a wrapper may borrow only a vowel table" — a borrowed *function* defeats that.

**It is pre-existing and fleet-wide, not something rw introduced.** Enumerating every delegation edge the
heuristic finds, four rows are already committed as `inherited` on exactly the same false premise:

    bavarian -> danish   via unitsFirstNumberToWords     bar  inherited
    faroese  -> danish   via unitsFirstNumberToWords     fo   inherited
    bashkir  -> russian  via russianWord                 ba   inherited
    bosnian  -> serbian  via phonemizeWord               bs   inherited
    kirundi  -> kinyarwanda via composeRwandaRundi       rn   (was empty, now inherited)

The genuine cases are all FACTORY calls (`createEnglish`, `createSpanish`, `createFrench`, `makeNativeHindi`),
which is what the script's header actually describes.

**Decision: REPORTED, NOT FIXED.** Narrowing the heuristic to a `create*`/`make*` factory would change five
languages' catalogue rows in a shared generated artifact while three sibling agents are working in the same
repo — the playbook's concurrency rule 3 says a shared change must be reported rather than landed as a side
effect of one language's work. The regenerated file is committed as the tool produced it, and the false `rn`
row is consistent with four rows already there. **Cost of leaving it:** Kirundi drops off the normalization
planning query while having no layer.

## Run 9 — 2026-08-11 (sources.ts, before and after)

    BEFORE                                       AFTER
    [NONE] scale-names   neither name anywhere   [part] scale-names   Celsius
    [chk?] percent-word                          [ ok ] percent-word
    [chk?] currency-word                         [ ok ] currency-word
    [chk?] ampersand-word                        [ ok ] ampersand-word
    [chk?] exponent-word                         [ ok ] exponent-word
    [NONE] letter-names  (unchanged — espeak does not ship rw; initialisms stay structurally blocked)
    [NONE] decimal-point (unchanged — and now a SENSE refusal, not just a tool negative: see run 4)
    [NONE] fraction-series (unchanged — and the 432 `/` shapes are dates, so there is nothing to compose for)
    [chk?] minus/equals/times-word (unchanged — the three argued refusals, in ACCEPTED_SIGN_SILENCE)

⚠ `scale-names` was `[NONE]` before this run and the tool was WRONG about Kinyarwanda, not about its own
sources: `selisiyusi` is 17 hits in 10 rw.wikipedia articles, every one in the temperature slot, and the
scale article names the symbol (`umunzani wa selisiyusi ufite ikimenyetso cya C °`). The tool reads the
corpus and the language's own files; the wiki is a tier it cannot see. **A `[NONE]` from `sources.ts` is a
prompt to probe, exactly as its header says — not a verdict about the language.** Fahrenheit went the other
way and stayed absent (`farenheti` 0/0), which is what makes the split verdict credible.
