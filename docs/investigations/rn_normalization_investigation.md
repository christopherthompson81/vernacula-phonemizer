# Kirundi (rn) text normalization — investigation log

Chronological. Each run: the command, the question, the raw finding, the implication.
Negative results and dead ends are kept deliberately.

⚠ **The standing hazard of this run.** Kinyarwanda (`rw`) got its layer yesterday
(`ca46b3f`, `docs/investigations/rw_normalization_investigation.md`) and rn/rw are mutually
intelligible. That makes rw the closest precedent this sweep will ever produce AND the biggest
risk in it: the rw run itself found that Chichewa's dotted-run rule, inherited from *its* closest
analogue, manufactured a sentence break in rw's dotless `R.R.A`. So every rw rule is treated here
as a HYPOTHESIS to re-measure against rn's own corpus, never as a settled fact, and every place
the two corpora differ is recorded as a finding.

⚠ **And where a source is about Kinyarwanda, it is labelled as such.** Burundi's orthography and
its French-influenced typography are not Rwanda's. No rn word below is sourced from an rw citation.

## Run 1 — 2026-08-12 08:05 (orientation)

**Commands / question.** Read `docs/normalization_playbook.md` in full (1,586 lines, 51 numbered
traps), then `src/languages/kinyarwanda/normalize.ts` (583 lines) and the rw investigation log
(311 lines), then rn's own engine — `src/languages/kirundi/{kirundi,manifest,numbers}.ts`,
`kirundi.jsonc` — and the committed golden `test/kirundi.test.ts`. Question: what does rn already
have, what is the seam, and how much of rw is even applicable?

**Raw finding.**
- `src/languages/kirundi/normalize.ts` does NOT exist. `registry.ts` calls `createKirundi()` with
  no normalizer wrapper and no shared symbol tier.
- `kirundi.ts` `text()` is `assembleClauses(input, TOKEN, …)` over `(LATIN_RUN)|(\d+)|([.!?…,;:])`
  — identical in shape to what rw had before its layer. A digit run becomes words via
  `numberToWords`; **every other character** (`%`, `°`, `$`, `:`, `-`, `/`, `&`, `+`) is matched by
  nothing and silently DROPPED.
- rn borrows exactly ONE thing from Kinyarwanda: `composeRwandaRundi` in
  `kinyarwanda/numbers.ts`, called by `kirundi/numbers.ts` with the KIRUNDI table. It runs **no
  Kinyarwanda normalizer at all** — the `inherited` catalogue row (`966fcbf`) was false, and this
  is the whole reason rn was invisible to the planning query.
- `test/kirundi.test.ts` EXISTS: 7 committed golden tests over the g2p and the numerals. Append
  only.
- `tools/corpus/mined/rn.jsonc` exists: **4,125 paragraph segments** from an rn.wikipedia dump,
  `cellsCovered 27/35`, and 374 hard+sample lines.

**⚠ THE FIRST AND LARGEST rn/rw DIFFERENCE, and it conditions everything below.** rn's wiki is
**13× smaller** than rw's, and every symbol class is one to two orders of magnitude sparser:

| cell | rw corpus | rn corpus |
|---|---:|---:|
| segments | 54,917 | **4,125** |
| percent | 1,231 | **15** |
| decimals | 3,225 | **145** |
| grouped | 1,813 | **138** |
| ranges | 1,849 | **49** |
| degrees | 227 | **7** |
| currency | 186 | **3** |
| ampersand | 930 | **10** |
| exponent | — | 24 |
| clock | 632 | 29 |
| initialism | 12,856 | **224** |

**Implication.** rn is untreated and the defect surface is the same SHAPE as rw's but at ~8% of
the volume. Two consequences for method: (a) a per-instance justification is affordable here in a
way it was not for rw — I can read *every* instance of most classes; (b) trap 8 is sharper than
usual, because a zero or a two in this corpus means much less than a zero in rw's. Take the
baselines before touching anything (playbook §"Working concurrently" rule 2).

## Run 2 — 2026-08-12 08:12 (baselines, before any edit)

**Commands.**
```
npx tsx tools/normalization/corpus-diff.ts emit --lang rn --corpus mined:rn --out /tmp/rn.before
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/rn.jsonc --lang rn
npx tsx tools/referee-eval/eval.ts rn
npx tsx tools/normalization/review.ts --lang rn
npx tsx tools/normalization/sources.ts --lang rn
```
As with rw, rn has no FLEURS corpus, so the artifact is the evidence and the flag is
`--corpus mined:rn`.

**Raw finding.**
- corpus-diff emit: **364 utterances** (rw: 442).
- artifact scan BEFORE: **7 findings / 60 hits** —
  `DROP exponent ×19 · DROP percent ×16 · DROP ampersand ×9 · DROP degree ×7 · DROP currency ×4 ·
  DROP math-sign ×3 · DROP minus ×2`.
  ⚠ Note the RANK ORDER differs from rw's (`percent ×34 · currency ×18 · math-sign ×16 ·
  exponent ×14 · degree ×13 · minus ×7 · ampersand ×7`): rn's biggest single class is the
  EXPONENT, not the percent. That is a real difference in what Burundian Wikipedia writes about
  — area figures for communes — and it means the exponent rule earns its place here more than it
  did in rw.
- referee-eval BEFORE: raw exact **1284/1600 (80.3%)**, folded backbone **1467/1600 (91.7%)**,
  symbol accuracy **98.0%**. Every residual class is a g2p disagreement with epitran over
  NC-spirantisation (`nt→nh`, `nk→ŋx`) and ⟨c⟩ — nothing numeric, nothing this layer can move.
- review: 1 FAIL — `normalize.ts missing`.
- sources: `[NONE] letter-names` (espeak ships no Kirundi) · `[NONE] decimal-point` ·
  `[NONE] scale-names` · `[NONE] fraction-series` · `[chk?]` for
  percent/currency/minus/equals/ampersand/exponent.

**Implication.** Every symbol class in rn is currently silent, exactly as rw's was. The
`[NONE] letter-names` means `core/initialisms.ts` is structurally blocked for the 224 corpus
initialisms — a sourcing gap, not a seam gap (trap 16 checked and the answer really is "no data",
same as rw and nya). The 7 scan findings are the defect list to close.

## Run 3 — 2026-08-12 08:30 (probing the engine on attested forms — playbook step 2)

**Command.** `phonemize(form, "rn")` over 55 forms lifted VERBATIM from rn's artifact
(a scratch probe under `tools/tmp/`, deleted rather than committed). Question: what does the engine actually produce — not
what rw's log says it produced for Kinyarwanda.

**Raw finding.** The defect list is what the engine emits:

| written | reads | defect |
|---|---|---|
| `30%` | `miɾoŋo itatu` | `%` DROPPED |
| `100%` | `id͡ʒana` | reads as the bare number "hundred" |
| `12.100.000` | `it͡ʃumi na kabiɾi . id͡ʒana . zeɾu` | grouping periods = TWO SENTENCE BREAKS mid-number |
| `1,964.54` | `ɾimwe , amad͡ʒana … . miɾoŋo itanu na kane` | grouping comma = clause pause, decimal dot = sentence break |
| `606km²` | `amad͡ʒana atandatu na ɡatandatu km` | `²` dropped, `km` reaches the IPA RAW |
| `3.287.263 km2` | `… km kabiɾi` | the ASCII exponent read as the NUMBER "two" |
| `km² 517` | `km amad͡ʒana atanu …` | unit written BEFORE the number — invisible to the tier |
| `(233/km²)` | `amad͡ʒana abiɾi … km` | a bare denominator, exponent dropped |
| `0,6 ° C` | `zeɾu , ɡatandatu t͡ʃ` | decimal comma = clause pause; `°` dropped; `C` read as [t͡ʃ] |
| `-39°C` | `miɾoŋo itatu na it͡ʃenda t͡ʃ` | the minus dropped — and a dropped minus INVERTS |
| `9°55'` | `it͡ʃenda miɾoŋo itanu na ɡatanu` | a coordinate read as two bare numbers |
| `dogere 22/25` | `doɡeɾe … miɾoŋo ibiɾi na ɡatanu` | the `/` span joiner silently dropped |
| `1884-1885` | two bare cardinals | the span joiner dropped |
| `26.08.1940` | `… . umunani . iɡihumbi …` | a DOTTED DATE = two spurious sentence breaks |
| `11:22` | `it͡ʃumi na ɾimwe , miɾoŋo ibiɾi na kabiɾi` | `:` is `clausePunctuation` → a comma pause inside a reference |
| `U.S.A.` | `u . s . a .` | three spurious sentence breaks in one token |
| `R & D` | `ɾ d` | `&` DROPPED |
| `US $ 4,000` | `us kane , zeɾu` | sign dropped AND the grouping comma is a clause pause |

**Implication.** Same defect SHAPES as rw, plus **two rn-only ones rw's corpus never contained**:
the dotted date `d.m.yyyy` (×10) and the `/` used as a span between two measurements (×5).
`&ndash;`/`&nbsp;` are decoded upstream by `core/markup.ts` before this layer runs — checked by
probe, not copied from rw.

## Run 4 — 2026-08-12 08:45 (reading the corpus; re-measuring every rw rule)

**Commands.** Tabulations over the artifact's 374 hard+sample lines, then
`attest.ts --lang rn --words …` and `attest.ts --lang rn --after dogere,ibirometero,kirometero`.

### ⚠ THE SEPARATOR QUESTION — rn IS NOT rw

| | grouped (multi-block) | 3-digit tail | 1–2 digit tail |
|---|---:|---:|---:|
| `,` | 27 | 27 (ALL grouping) | **2** (both decimal) |
| `.` | 23 | 23 (ALL grouping) | 17 (7 decimal + **10 dotted DATES**) |
| ` ` (space) | 7 | 7 (ALL grouping) | — |

rw measured its comma at **15 grouping vs 14 decimal** — genuinely ambiguous. rn's comma is
**27 grouping vs 2 decimal**, and rn additionally writes the ANGLO form `1,964.54` (comma
grouping AND dot decimal in ONE number, ×9, all `Ibirometero kwadarato N`) alongside the
FRENCH/European `12.100.000` (dot grouping, ×23) and space grouping (×7, `104 000 000 000 $`,
`756 102 km²`, `2 780 400`). **Burundi's francophone typography and the Anglo convention coexist
in one corpus.** All three de-grouping arms are needed and all three are load-bearing here,
where rw's space arm was near-idle.

⚠ **rw's coordinate counter-example does NOT recur.** rw needed a `NOT_COORD` right-guard because
`1.867 ° S` and `30.367 ° E` are three-place DECIMAL coordinates. rn writes its coordinates as
`9°55'`, `10°40'`, `1°05'`, `0°15'` — degree-and-arcminute, never a decimal degree. Measured: `0`
instances of `\d+[.,]\d{3}\s*°` in rn. **The guard is dropped**, and its absence is a measurement.

⚠ **10 DOTTED DATES — a cell rw did not have.** `2.2.1946`, `24.11.1949`, `17.12.2020`,
`26.08.1940`, `16.07.1983`, `2.05.1953`, `6.03.1955`, `6.04.1994`, `11.3.1933`, `1.12.2018` — all
in the `(* birth — † death)` biography frame. Each currently emits two sentence breaks.

### ⚠ THE SQUARED WORD — rw's `kare` IS WRONG FOR KIRUNDI, refuted twice

| | corpus collocation | wiki tokens/articles | what the bare word means |
|---|---:|---:|---|
| `kwadarato` | **36** | **29 / 20** | — (only ever the area modifier) |
| `kare` | **1** | 20 / 15 | **"early"** — `hakiri kare`, `kuyifata kare` |

`Ibirometero kwadarato N` is rn.wikipedia's standard area line, across 20 independent articles.
The single `kilometero kare` is in the **Canada** article — one hit, one article, a lead and not
a finding. And the slot probe closes it from the other side: `attest.ts --after ibirometero,
kirometero` returns **`kwadarato ×3` with no competitor at all**.

**`kwadarato` is a French borrowing (*quadrat*/*carré*), and it is exactly the divergence the
francophone-typography warning predicted.** Had rw's table been ported unmeasured, every area
figure in Kirundi would have read "square" as the adverb "early".

### ⚠ THE CLOCK AND DURATION RULES DO NOT SURVIVE — rw's step 6 has no rn attestation

rn corpus: `saa` **×0**, `isaha` ×0, `amasaha` ×0, `iminota` ×0, `amasegonda` ×0, `zeru` ×0.
All 6 colon runs are **Bible verse references** (`11:22`, `9:31`, `12:22/24`, `16:16`, `19:3\7`,
`2:38\41`) plus **one** wiki-signature timestamp (`19:09, 27 Ruhuhuma 2023 (UTC)`).
**Zero clocks. Zero race durations.** rw had 12 three-field runs (9 race durations) and 2 clocks
carrying `saa`; rn has none of either, and none of the vocabulary.
`amasaha`/`iminota` ARE attested on the wiki (`amasaha mirongo ibiri n'ane`, `iminota 15`) but
never against a colon shape. **So rn gets no clock rule and no duration rule** — the colon is
spent on a space so a verse reference stops being two clauses, and nothing is invented. A
sourced refusal, not an oversight.

### ⚠ THE RANGE — every span in rn is a YEAR span, and the joiner needs a frame

15 hyphen/dash digit spans, and **14 are year or reign spans** (`(1884-1885)`, `(1522-1588)`,
`1997–2005`, `(1911-2004)`, `(1981-1989)`, `2005 – 2007`, `2007 – 2008`, `2008 - 2009`,
`2010 – 2012`, `(1987—1993`, `1996—2003)`, `(1966—1976)`, `(2003—2005)`), one a date span
(`24.11.1949 - 17.12.2020`). **Not one measurement span** — where rw had 18 digit-flanked
`kugeza kuri` instances and genuine `1250-1750mm` shapes. rw's unit-HOISTING range arm therefore
has **zero** rn instances and is not written.

The joiner: `gushika` ×20 in corpus / attested on the wiki; `kugeza` ×2; `kugera` ×1.
⚠ **Every digit-flanked `gushika` sits in a `kuva …` frame** — `kuva mu 1996 gushika mu 2003`,
`guhera mu mwaka w'i 1966 gushika mu 1993`, `kuva muri Myandagaro 2005 gushika muri Ruheshi 2020`,
`kuva kuwa 15 Rusama 2012 gushika kuwa 14 Rusama 2017`. This is the Fula `hakkunde` question
(part of speech, not word existence) and it is unresolved from the corpus alone — web search
pending.
★ **The wiki glosses its own dash**: `umukuru w'igihugu c'Uburundi (1987—1993 na 1996—2003)` in
the corpus against `Batwaye … guhera mu mwaka w'i 1966 gushika mu 1993 … kuva mu 1996 gushika mu
2003` on the wiki — the same KIND of fact, the same reign-span slot, written both ways.

### ⚠ THE `/` SPAN — an rn shape rw's corpus does not contain

5 instances, all measurements: `dogere 22/25`, `27/28 ° C`, `30/31 ° C`, `metero 1.500 / 1.800`,
`mm 1,200 / 1,400 mm`. All ascending. Against them, `/` is also 6 dd/mm/yyyy dates, 1 verse
reference (`12:22/24`) and 4 rate denominators (`hab/km²`, `personnes/km²`, `233/km²`, `hab/km`).
A 2-field guard that rejects a third field and a preceding colon separates them cleanly: **5
wanted, 0 false positives, verified by running the candidate regex over the corpus.**
rw's `/` cell was **entirely dates**; rn's is dates *plus* this.

### ⚠ THE ONE-LETTER UNIT KEYS — rn takes the opposite decision from rw, and trap 46 is why

rw declares `m`, `g`, `l` and records: *"rw writes NO word-internal apostrophe after a digit
(`\dm['’]` is ×0, unlike Chichewa's locative `m'` which cost nya this very key)."*
**In rn the elision IS there**: `N’izihe ntara zibiri zigira 49 na 50 m’ubumwe bwa Leta Zunze
Ubumwe bwa Amerika` — `m'` = the locative, not a metre. And digit-adjacent `m` in rn is ×1, that
one. Meanwhile `metero` is spelled out in every one of its 6 wiki attestations (`metero 1214`,
`Metero 1 539`, `metero 1330`, `Metero 1 566`, `Metero 1 265`, `Metero 1 543`).
**So `m` buys zero true positives and risks one false one: it is NOT declared.** rn is on
Chichewa's side of this line, not Kinyarwanda's. `g`/`l`/`cm`/`kg`/`ha`/`t` are digit-adjacent ×0
and their nouns are ×0 in rn — not declared either.

### ⚠ DE-GROUPING BEFORE THE TIER — re-confirmed for rn, and 6× stronger than in rw

rw needed this for 2 instances (`1.300m`, `1.800m`). rn's `version-dot` cell is **12 instances**
and not one is a software version — all are grouped thousands glued to an abbreviation:
`83.497.147hab`, `357.588km²`, `783.356km²`, `505.911km²`, `20.764hab`, `17.600hab` ×2,
`3.265hab`, `1.097hab`, `5.748.769hab`, `83.307.674hab`, `46.934.632hab`. The tier's
`NOT_VERSION` guard rejects `\d+[.,]\d+[a-zA-Z]`, so de-grouping must run first.
⚠ And the residual cost rw records does NOT apply here: `NOT_VERSION`'s inner
`(?![a-zA-Z\d])` only fires on a ONE-letter trailing key, so rn's genuine decimal-plus-unit
`196.7km²` reads correctly — because `km` is two letters and because rn declares no one-letter key.

### Every word this layer puts in a speaker's mouth, with its rn-only source

| slot | word | evidence (all Kirundi; no rw citation is used) |
|---|---|---|
| percent | `kw'ijana` | corpus ×7, wiki **11 tokens / 8 articles**. ★ Attested in the BARE number slot, not only after `ibice`: `amajwi 24,4 kw'ijana`, `yaronse 68,7 kw'ijana` — a decimal directly followed by the word. POSTPOSED. ⚠ rw's spelling `ku ijana` is **×0** in rn; rn writes the elided form 7/7. |
| `km`, `km²` | `ibirometero` | corpus glosses its own abbreviation in a PARALLEL SENTENCE: `ikaba ifise km 1,965` (Cankuzo) against `ikaba ifise ibirometero 1,960` (Bubanza) — the same commune-infobox sentence, one writing the symbol and one the word. wiki 20/20. |
| `km²` denominator | `kirometero` | `ku kirometero kwadarato (3372 hab/km²)`, `Abantu 542 ku kirometero kwadarato` — the singular class-7 form in per-unit position, wiki 20/20. |
| squared | `kwadarato` | corpus ×36, wiki 29/20, slot probe ×3 with no competitor. See above. |
| `mm` | `milimetero` | wiki `milimetero 1.086`, `(milimetero 154)`, `(milimetero 3)`, `milimetero 800`; corpus `mm 1.000`, `mm 1,200 / 1,400 mm`. PREFIXED. |
| degree | `dogere` | corpus ×2 (`dogere 22/25`, `dogere 29`), wiki 9/4 — `dogere 20`, `(dogere 25)`, `(dogere 18)`, `dogere zigera kuri 35`. PREFIXED, temperature and the corpus's own sign-adjacent use. |
| Celsius | `selisiyusi` | wiki **2 hits / 1 article** — `dogere selisiyusi 20 na 25`, `hejuru ya dogere selisiyusi 28`. ⚠ ONE ARTICLE IS A LEAD, so it was closed from the other side: `attest.ts --after dogere` returns `selisiyusi ×2` and **nothing else** — no competitor occupies the scale slot. `sources.ts` reported `[NONE] scale-names`; the wiki overturns it, as it did for rw, but on rn's own evidence. |
| Fahrenheit | — | `farenheti` **0/0**. `°F` is ×0 in the corpus. Nothing to read, nothing invented. |
| `&` | `na` | the manifest's own conjunction (`numbers.and`), ×178 in the artifact, already spent by the number path in *icumi **na** umunani*. |
| rate `/` | `kuri` | corpus ×25; `ku`/`kuri` is the per-unit connective in `Abantu 542 ku kirometero kwadarato`, `102 personnes ku kirometero kwadarato`, `ufise 613 hab/km`. |

### Found and DECLINED, with counts

- **NO DECIMAL-SEPARATOR WORD.** `sources.ts`: `[NONE] decimal-point`, no `_dpt`, no manifest word.
  The fractional digits are read one at a time. Same outcome as rw, reached from rn's own tool run.
- **NO CURRENCY WORD YET.** `amadolari` **0 tokens / 0 articles** on rn.wikipedia, and `idolari`,
  `amayero`, `ifaranga` all 0/0. `amafaranga` is 14/11 but the sense is generic **money/fee**
  (`kikagurishwa amafaranga` = sold for money; `amafaranga yagenwe ya US $ 4,000` = *the fee set at*
  US$4,000 — the word sits BESIDE the dollar amount, it does not translate it). ⚠ And 2 of the
  corpus's 4 `$` instances are inside an ENGLISH sentence (`Croatia's GDP is 104 000 000 000 $`) —
  trap 34. The corpus's one Kirundi instance is `miliyoni 3.8 z'amadolari`. Web search pending;
  a refusal resting on silence needs a dictionary check first (the Igbo lesson).
- **NO `+` RULE (×2).** Both are Wikipedia portal size markers — `+1 000 000 : English · Deutsch ·
  Français` and `+100 000 : Nederlands · Polski` — i.e. "wikis with over 1,000,000 articles". Not
  arithmetic, and the playbook's fleet-wide finding is that no language attests a plus word.
- **NO `=`, `×`, `÷`, `±`, `<`, `>` RULE.** All **×0** in the artifact. A zero count that has been
  queried (trap 25), recorded so the absence is a measurement.
- **NO `hab` UNIT.** `hab` (French *habitants*) is glued to digits ×9 and reaches the g2p as a
  readable word. It is REDUNDANT — every instance sits under the infobox label `Abanyagihugu:`
  ("inhabitants"), which already says it — and it is a French abbreviation, not a Kirundi unit.
  Trap 12's redundancy, declined rather than translated.
- **NO FRACTION RULE.** `sources.ts`: `[NONE] fraction-series`, nothing to compose from. The 12
  `fractions`-cell instances are the 6 dates and the rate denominators tabulated above.
- **NO LETTER NAMES, so no initialisms (224 in the corpus).** `sources.ts`: `[NONE] letter-names`;
  espeak ships no Kirundi. `core/initialisms.ts` without a `letterName` table is a NO-OP — a
  sourcing gap, not a seam gap (trap 16 checked; the answer really is "no data").
- **NO MAGNITUDE DECLARATION.** `miliyoni`/`imiliyoni`/`imiriyoni` ×17 and **every one is
  MAGNITUDE + NUMBER** (`miliyoni zirenga 406`, `miliyoni 180`, `imiliyoni 4`, `imiriyoni icumi`,
  `miliyoni 3.8`). The tier's `magAlt` matches NUMBER-then-magnitude, so the hop can never fire.
  ⚠ The "one declaration, two consumers" warning checked, not assumed: `magAltU` (the unit path's
  connective hop, `2,2 miliyoni km²`) is ×0 here for the same reason. Both consumers lose nothing.
  Same conclusion as rw, re-measured on rn's own 17 instances.
- **NO TRAP 14/15 CONCORD RULE, measured.** `digit + space + short token` is `z'` ×4, `na` ×4,
  `hab` ×4, `n'` ×3, `kw'` ×2, `y'` ×2, `m'` ×1 — ordinary particles and elisions standing as
  words, never a detached bound morpheme. So every rule below may leave its operand as DIGITS,
  which is also what keeps the tier's number↔unit adjacency alive.

**Implication.** Enough to write the layer. rn needs rules on BOTH sides of the shared tier for
the same two reasons rw does — de-grouping before it (12 instances, not 2), the decimal spell-out
after it — so `normalize.ts` owns the `SYMBOLS` call.

## Run 5 — 2026-08-12 09:05 (writing the layer; the ordering that fell out)

**Question.** Which side of the shared symbol tier does each rule go on?

**Raw finding — rn needs BOTH sides, for the same two reasons rw does but with much stronger evidence
on one of them.**
- rn's entire `version-dot` cell (12 instances) is GROUPED THOUSANDS glued to an abbreviation —
  `357.588km²`, `783.356km²`, `505.911km²`, `17.600hab` ×2, `20.764hab`, `3.265hab`, `1.097hab`,
  `83.497.147hab`, `5.748.769hab`, `83.307.674hab`, `46.934.632hab` — and the tier's `NOT_VERSION`
  guard is `(?!\d+[.,]\d+[a-zA-Z](?![a-zA-Z\d]))`, so it refuses them. **De-grouping must run BEFORE
  the tier.** rw needed this for 2 instances; rn has 12.
- `24,4%` and `196.7km²` need the number intact beside the sign. **The decimal spell-out must run
  AFTER the tier.**

⚠ **AND THE RESIDUAL COST rw RECORDS DOES NOT TRANSFER.** rw states that `NOT_VERSION` also rejects a
genuine decimal glued to a one-letter key (`1,5l/Ha`, ×1, unrescuable). Reading the guard rather than
copying the note: its inner `(?![a-zA-Z\d])` only fires when the trailing key is exactly ONE letter, so
rn's `196.7km²` reads correctly — `km` is two letters, and rn declares no one-letter key at all. The
cost is rw's, not Kirundi's.

**Implication.** `normalize.ts` owns the `SYMBOLS` call, the shape 34 languages now use.

## Run 6 — 2026-08-12 09:20 (first probe of the written layer — four defects it found)

**Command.** `normalizeKirundi` + `phonemize` over 55 corpus-lifted forms.

**Raw findings, all fixed in the same session:**
1. **`1,964.54` did not de-group at all** — nine instances, the single commonest numeric shape in this
   corpus. I had copied rw's trailing guard `(?!\d|[.,]\d)`, which rejects a grouped run followed by
   *any* separator-plus-digit. That is right for rw, whose corpus has no Anglo form; in rn it rejects
   exactly the `1,964.54` shape the guard was supposed to protect. The comma arm now uses `(?!\d|,\d)`
   — it declines a comma-decimal chain and admits a dot decimal. **A guard copied from the closest
   analogue, refuted by the target's own commonest instance.**
2. **`bane kw'ijana (4%)` → "…kw'ijana kane kw'ijana"** — the percent word said TWICE. rn writes the
   word and the parenthesised sign together five times (`ibice mirongo icenda kw'ijana (90%)` ×2,
   `ibice bitatu kw'ijana (3%)`, `bane kw’ijana (4%)`, `ibice mirongo ine kw'ijana (40%)`). Added a
   trap-12 redundancy guard, matching both apostrophe encodings.
3. **`27/28 ° C` → "kuva 27 gushika dogere 28"** — the operands split around the measure noun, because
   the general span rule ran first and the degree rule then attached the noun to the second operand
   only. Fixed with a degree-span arm placed FIRST (trap 14's ordering half: order by who needs the
   words first) — the same fix rw needed for `40-42 °`, re-derived here rather than inherited.
4. **`-39°C` → `-dogere 39`** — the minus stranded in front of a word, because the degree arms matched
   from the first digit. The sign is now captured and re-emitted after the noun (`dogere -39`); it is
   still unread and still visible to the scan, which is the point.

⚠ **AND A METHOD ERROR CAUGHT AND CORRECTED.** My first reading of the corpus diff paired the emit file
against the artifact's 374 hard+sample lines by index. `corpus-diff emit` writes **364** utterances (it
drops empties), so every SRC annotation was off by up to ten rows. `emit` writes a `.src` sidecar for
exactly this reason; re-read against that, all 103 changes line up. **A diff you have aligned by hand
is a diff you have not read** — the same family as rw's run-6 false alarm, where filtering the diff hid
the half being checked.

## Run 7 — 2026-08-12 09:40 (the sourcing that overturned two decisions)

**Commands.** `attest.ts --lang rn --words …` in one combined run (see run 9 on why not in batches),
`attest.ts --lang rn --after dogere,ibirometero,kirometero`, plus a web-sourcing pass over Kirundi
running text (VOA *Radiyo Yacu*'s Burundi desk, ~370 documents language-classified by Kirundi
`canke/cane/vy-/ico` against Kinyarwanda `cyangwa/cyane/by-/icyo`, because that service is joint and its
markup claims `lang="rw"`), the NSW *English–Kirundi* bilingual dictionary, and rn.wikipedia's own
`Ikirundi` article.

### ⚠ THE CURRENCY REFUSAL WAS WRONG, AND IT IS TRAP 40 EXACTLY

Run 4 recorded "no currency word": `amadolari` **0 tokens / 0 articles** on rn.wikipedia, `idolari`
0/0, `amayero` 0/0, `ifaranga` 0/0. That is a refusal resting on SILENCE, which the playbook says needs
a dictionary check first (the Igbo `ǹtụ̀kpọ` lesson). It does not survive one, and the reason is
orthographic:

★ **KIRUNDI HAS NO ⟨l⟩.** rn.wikipedia's `Ikirundi` article reproduces the resolutions of the third
Kirundi teachers' orthography conference (Bujumbura, 29 Myandagaro – 2 Nyakanga 1983; Kaminuza
y'Uburundi + Bureau d'Éducation Rurale). Its l/r table rules on **this exact word**:
*INGORANE l/r · UTURORERO: `Amadolari/Amadorari` · IRYAPFUNDITSWE: **`Amadorari`** · IMVO: "Mu kirundi
iryo jwi ryegereye r gusumba l"*. The phoneme inventory printed above it contains no `l`.
Corroborated by the NSW bilingual dictionary (`dollar` → `amahera y'idorari`, examples
`nivy'amadorari atanu`, `kuva ku madorari cumi`) and by Kirundi running text
(`idorari ry'Abanyamerika rirushirije kuduga agaciro`; `ingabire y'imiliyoni 6 z'amadorari` —
29 tokens / 16 Kirundi-classified documents).

**I probed the Kinyarwanda spelling and read its absence as the language's.** That is the trap in one
line: *a word-first probe cannot find a spelling you did not guess.*

⚠ And the in-repo probe stays nearly silent even with the right spelling — `attest.ts --words
amadorari` returns **1 hit / 1 article**, and reading it disqualifies it: *"binjije amadorari ibihumbi
50 **cyangwa** arenga"*, where `cyangwa` is Kinyarwanda. Trap 34, caught by reading the example rather
than the count. The word ships on the orthography ruling, the dictionary and the Burundi-desk text.
Position PREFIX (`amadorari atanu`, `ku madorari cumi`, `amafaranga y'Amarundi 3,300`).
`amafaranga` (14/11) was declined: it means money/fee generically and its own example sits BESIDE a
dollar amount rather than translating it (`amafaranga yagenwe ya US $ 4,000`, "the fee set at
US$4,000") — the Fula `hakkunde` shape. `FBu`/`BIF`/`€` are ×0 so no key is declared, though the franc
is sourceable if one ever appears (`ifaranga ry'Uburundi` for the currency, `amafaranga y'amarundi`
for an amount).

### ⚠ THE CELSIUS WORD WAS ALSO WRONG — AND THIS ONE WAS A BORROWED rw READING

Run 4 accepted `selisiyusi` on 2 rn.wikipedia hits in ONE article, closing the "one article is a lead"
objection with the slot probe (`--after dogere` → `selisiyusi ×2`, no competitor). Four further
measurements say Kirundi should not read it:
- `selisiyusi` is **×0 in rn's corpus**, and `sources.ts` reports `[NONE] scale-names`.
- On rn.wikipedia, bare `dogere` occupies the temperature slot **6 times across 4 articles**
  (`dogere 20`, `(dogere 25)`, `(dogere 18)`, `dogere zigera kuri 35`, `dogere 29`, `dogere 22/25`)
  against `dogere selisiyusi` twice in one. **rn's own writing reads a Celsius temperature as bare
  `dogere` 6 times out of 8.**
- Independent Kirundi running text writes **`degre Celsius`** (`igipimo ca degre Celsius 40`, `ku
  rugero rwa degre Celsius 43`) and never `selisiyusi`. ⚠ **Every `dogere selisiyusi` document in that
  corpus is KINYARWANDA**, identified by `ubushyuhe`/`cyangwa`/`kugeza` against Kirundi
  `ubushuhe`/`canke`/`gushika`. So `selisiyusi` is, on the best evidence available, the Rwandan form —
  which is precisely the borrowing this run exists to avoid.
- And the Burundian alternative cannot be emitted anyway: this g2p reads ⟨c⟩ as [t͡ʃ], so writing the
  Latin `Celsius` into the text yields [t͡ʃelsius] — replacing a dropped sign with a mangled spelling
  is a new defect, not a fix (trap 6's family).

**Decision: the scale LETTER is claimed (so `C` cannot reach the g2p as [t͡ʃ] — the defect that
mattered), the degree is spoken, and no scale name is emitted for `°C` or `°F`.** rw's stance for
Fahrenheit, applied to both scales because rn's evidence points the same way for both.

### ⚠ THE SPAN JOINER'S PART OF SPEECH — resolved, and it has TWO shapes

Run 4 left this open (the Fula `hakkunde` question). Against the Kirundi corpus:
- **Bare `N gushika M` is the MAJORITY use** — 354 `gushika` tokens, only ~58 with a `kuva` in the
  preceding 90 characters. Attested between figures with no "from" word: `ku matariki ya 15 gushika
  17`, `ibilometero 26 gushika kuri 28`, `iminsi 7 gushika ku ndwi zitatu`, `gushika kuri 33`. So the
  connective IS infix-capable, and `kuri` is the form before a bare cardinal.
- **BUT A FOUR-DIGIT YEAR SPAN IS UNANIMOUS THE OTHER WAY** — 14 of 14 carry `kuva`, and there are
  **zero** instances of `1987 gushika 1993` standing alone. The corpus sentence is literally this run's
  own example: `kuva mu mwaka w'1987 gushika mu mwaka w'1993, ubwa kabiri hari kuva mu mwaka w'1996
  gushika mu mwaka w'2003`.
- **And a TEMPERATURE range takes neither** — Kirundi uses `hagati ya X na Y`. rn's own two sources
  agree: the corpus's `hagati ya 17°C na 29°C` and the wiki's `dogere selisiyusi 20 na 25`.

So three joiners, chosen by what is spanned, each attested in its own frame. This matters because rn's
corpus puts each shape in exactly the idiom it wants: all 14 dash spans are years, all 5 slash spans
are measurements, and the degree spans are temperatures.

⚠ **A FOUR-DIGIT COUNT ALONE DOES NOT IDENTIFY A YEAR, and the tests caught it.** `metero 1.500 /
1.800` is a pair of ALTITUDES whose operands look exactly like 1500 and 1800 AD, and it was taking the
year frame. The separator is the second discriminator — dash ⇒ year, slash ⇒ measurement, a clean
14/5 split in this corpus — so the frame now needs BOTH. This also keeps a future `35-40 cm` out of the
year idiom without widening a guard for a shape rn has ×0 of.

## Run 8 — 2026-08-12 10:05 (the gates)

| gate | before | after |
|---|---|---|
| `mine.ts scan` | 7 findings / **60** hits — exponent ×19 · percent ×16 · ampersand ×9 · degree ×7 · currency ×4 · math-sign ×3 · minus ×2 | **1 real finding / 1 hit** — `DROP minus ×1` (+ `ACCEPTED minus ×1`, `ACCEPTED-CLASS math-sign ×3`, `REDUNDANT percent ×4`, all notes) |
| `corpus-diff` DROP | **55** | **5** · 103/364 utterances changed (28.3%) · DIGIT 0→0, SLOT-GAP 0→0, RAWMARK 0→0, THROW 0→0 |
| `referee-eval rn` | 1284/1600 raw · 1467/1600 folded (91.7%) · 98.0% symbol | **identical** — this layer touches symbols, the referee is a word list, and 0 words moved |
| `review.ts --lang rn` | 1 FAIL (`normalizer missing`) | 2 FAIL, **both the same argued item** (the minus; see below) |
| `sources.ts --lang rn` | `[chk?]` percent · currency · ampersand · exponent | **`[ ok ]` all four**; `[NONE]` letter-names / decimal-point / fraction-series / scale-names unchanged — and scale-names is now a REASONED refusal, not a gap |
| `npx vitest run` | 240 files / 3679 pass | **240 files / 3697 pass** (18 new rn tests) |
| `npx tsc --noEmit` | clean | clean |
| `languageCatalogue.test.ts` | — | passes after `derive-normalization.py` + `build.py`; exactly ONE catalogue cell changed (`rn` → `done`) |

**⚠ THE TWO REMAINING `review.ts` FAILS ARE ONE FACT AND THEY STAY RED ON PURPOSE.** `sign classes:
DROPPED: minus` and `artifact scan: DROP minus ×1` are both the corpus's single genuine negative,
`hakaba hakonje cane (nko munsi ya -39°C)`. No Kirundi word for the sign is attested in the corpus, the
referee list or on rn.wikipedia, and **rw's `munsi ya zeru` is a Kinyarwanda citation this language does
not get to borrow** — the whole premise of this layer. Omitting a minus INVERTS the value where
omitting a plus is lossless. Trap 24: do not fix the FAIL. rn's OTHER minus, the French grade range
`(Kindergaten –2ème année)`, IS listed in `ACCEPTED_SILENT` because no Kirundi reading of it could be
right.

**A flaky test, checked rather than assumed.** `test/onnx-optional.test.ts` timed out at 5 s during the
full run while sibling agents shared the machine, then passed in **3.15 s** in isolation immediately
afterwards. Environmental, as the file's own header describes. Not a regression.

## Run 9 — 2026-08-12 10:20 (two shared-tool defects, surfaced and handled differently)

**1. `attest.ts` writes a file its own carry-forward parser cannot read.** After the first successful
probe wrote `tools/corpus/attest/rn.jsonc`, every subsequent run refused:
`REFUSING TO WRITE: 6 existing finding(s) could not be parsed for carry-forward … Writing now would
delete them.` The file was not hand-edited — the tool had just written it. Its emitted indentation
(`    //` header lines, and finding blocks alternating between 12- and 8-space indents) does not match
the block pattern its reader expects.
**Handled by WORKING AROUND IT, not by fixing it**: every word was probed in ONE invocation at the
default `--limit`, so no carry-forward is needed and the committed file is a single authoritative
write. Reported rather than patched — `attest.ts` is shared with three sibling agents working right
now, and the playbook's concurrency rule 3 says a shared change must not land as a side effect of one
language's work.

**2. A `languageCatalogue.test.ts` assertion pinned the very bug rw's run reported — and this one had
to be fixed, because correct work made it fail.** The test names five languages that BORROW a helper
(`rn`, `bar`, `fo`, `ba`, `bs`) and asserted `value(code) === ""`. Its own comment states the invariant
correctly — *"`inherited` MUST MEAN DELEGATION, NEVER BORROWING"* — but the assertion is stricter than
that: it pinned the accident that none of the five had a layer YET, and would have fired on whichever
was treated first. rn is now the first, and correctly reads `done`.
Changed to `.not.toBe("inherited")`, which is the stated invariant exactly. ⚠ **A sibling agent is
treating `bar` in this same batch and would have hit this identically**, so the narrower assertion
unblocks that run too rather than colliding with it. Trap 5: correct the test, do not preserve the
behaviour.

⚠ **AND THE UNDERLYING HEURISTIC IS STILL WRONG AND STILL NOT FIXED** — `derive-normalization.py`'s
delegation test is "X imports from ../Y and CALLS something it imported", which a borrowed FUNCTION
defeats. rw's run 8 reported it and declined to change it for the same concurrency reason; that
decision stands here. rn no longer suffers from it (it reads `done` on its own merits), but `bar`,
`fo`, `ba` and `bs` still would if their engines' imports changed. Reported, not fixed.

## Run 10 — 2026-08-12 10:30 (what rn's corpus can and cannot show — the standing limits)

Recorded so the next reader does not re-open them:
- **The number compositor tops out below 10⁹.** `numberToWords(1465549626)` and `(104000000000)` fall
  back to digit-by-digit spelling; `composeRwandaRundi`'s magnitudes stop at `million`. De-grouping
  makes this visible on exactly TWO corpus numbers, and **both are parenthetical glosses of a figure
  the sentence has already spelled out in Kirundi** (`…n'amajana atandatu y'imirongo ibiri n'itandatu
  (1.465.549.626 hab.)`), so nothing is lost that the reading did not already have. ⚠ The compositor is
  SHARED WITH KINYARWANDA — a two-language change — so it is out of scope for an rn-only commit
  (concurrency rule 3). Reported, not touched.
- **`mm 1,200 / 1,400 mm` says the unit twice** (`milimetero kuva 1200 gushika milimetero 1400`),
  because the source writes it twice. rw solved the equivalent with a unit-HOISTING range arm; rn has
  **one** instance of the shape, and trap 9 says a guard widened for an uncounted shape is a misfire
  generator. Left, and stated.
- **`US $ 4,000` leaves `US` as a token** reading [us]: the tier's `US$` key is literal and rn writes
  the sign detached. Not a regression (the letters read the same before), and initialisms are
  structurally blocked for rn anyway for want of a `letterName` table.
- **`hab` (French *habitants*, ×9 glued to digits) is left as a readable word.** It is redundant with
  the `Abanyagihugu:` label every instance sits under, and translating a French abbreviation into a
  Kirundi noun is not this layer's job.
- **`review.ts`'s sourcing line cannot read rn's percent word** (`⚠ could not read the word for:
  percent`) — `kw'ijana` carries an apostrophe. A `[??]` prompt rather than a FAIL, and the word is the
  best-sourced item in this layer (corpus ×7, wiki 11/8, attested bare after a decimal in
  `amajwi 24,4 kw'ijana`). Noted so the blank is not read as an absence.

---

## Run 11 — 2026-08-12 17:20 — the 10⁹ ceiling, and the word Kirundi does not have

**Question.** `composeRwandaRundi` (shared: rw authors it, rn borrows it) stops at 10⁹ — `1000000000` composed
nothing and fell to `rimwe zeru zeru zeru zeru zeru zeru zeru zeru zeru`, ten digit words for a round number.
What is the magnitude series above 10⁶, **for each language separately**? Run 7 of this doc found seven rw
rules that were wrong for Kirundi (including `kare`, which means "early" in Kirundi, not "squared"), so a word
attested for rw is not thereby attested for rn.

**Searches — CirrusSearch `insource:` token counts against each language's OWN wiki, plus dictionaries.**

```
rw.wikipedia   miliyari 257 · miriyari 8 · miliyaridi 1 · miriyaridi 0 · biliyoni 5
               miliyoni 757 · miriyoni 55            tiriyoni 2 · triliyoni 0 · tiriliyoni 0
rn.wikipedia   miliyari 0 · miriyari 0 · miliyaridi 0 · miriyaridi 0 · umuliyaridi 0
               umuriyaridi 0 · miliaridi 0
               imiliyoni 19 · miliyoni 7 · umuliyoni 3 · umuriyoni 1 · ibihumbi 25 · amajana 36
en.wiktionary  `miliyari` — ONE sense line, under a "Rwanda-Rundi" header: "(Kinyarwanda) billion"
languagesandnumbers.com/how-to-count-in-kinyarwanda (kin) — "The word for billion (10⁹) is miliyaridi:
               miliyaridi imwe [1 billion]".  The /how-to-count-in-rundi (run) page did not serve Rundi
               content at all (it returned a Yakut page) — a dead end, recorded.
igihe.bi, a Burundi Kirundi-language outlet, one article: "Imiliyaridi 4 z'amafaranga y'amarundi niyo
               yaguzwe ico kibanza" … "ni hafi imiliyaridi zirenga 100 z'amarundi" … "izo miliaridi
               ntizizobura ico zifasha" — TWO spellings in one article, both PLURAL.
```

**Raw findings.**

- **rw (KINYARWANDA) has a 10⁹ word and the corpus writes it in the compositor's own shape.** The deciding
  hit is `Gahunda yo gusiramura izatwara akayabo ka **miriyari 53 na miriyoni 910**` — billion + multiplier,
  `na`, million + multiplier, written by a Kinyarwanda hand, using **this table's `miriyoni` and `na`**. The
  other `miriyari` hits are ordinary numerals (`miriyari 55 m3`, `miriyari 1`, `babarirwa muri za miriyari`).
- **The l/r question is orthographic, not lexical.** `miliyari` ×257 vs `miriyari` ×8 is the same 14:1-ish
  split this table already faced and already settled the other way when it authored `miriyoni` (×55) against
  `miliyoni` (×757); Kinyarwanda l~r is allophonic, so both spell one word. The r-form is authored because it
  is what the one attested billion+million COMPOUND uses and because the rest of the table is in it. Both
  counts are in the code comment so this is not re-derived as an oversight.
- **rn (KIRUNDI) has NO attested 10⁹ word, and the silence is about the magnitude, not the corpus.** Seven
  spellings probed, all zero — while the same wiki writes the MILLION word freely across four spellings
  (×30 combined). A corpus that says `imiliyoni` 19 times and `miliyari` zero times is not simply too small.
- **The one Kirundi attestation found anywhere is a PLURAL, and it is unstable.** `imiliyaridi` and
  `miliaridi` in one article. `N.million` for rn is the SINGULAR `umuriyoni`, so filling the slot means
  deriving `*umuliyaridi` from a bare plural — the Fula `tere` failure, playbook trap 37: a bare stem or a
  bare inflection is never the attestation of the form you actually need.
- **10¹² is declined for BOTH.** rw.wikipedia does write `tiriyoni` ×2 — `tiriyoni 1.53 z'amadolari ya
  Amerika` and `gifite miriyari 55 m3 (tiriyoni 1,9 cu ft)` — so the word is not imaginary. But two hits,
  both inside converted foreign units, with no dictionary or grammar corroboration, is under the bar when the
  magnitude one step down already has three competing spellings (`miliyari` / `miriyari` / `biliyoni`).
  Negative result kept so the next reader does not re-derive it and reach a different answer.

**Implication — the ceiling is per-language, so it cannot be a constant in a SHARED compositor.** `billion`
is now **optional** in `RwandaRundiNumbers`: the compositor's ceiling is 10¹² when the table has the word and
stays 10⁹ when it does not. rw gets `"billion": "miriyari"`; rn's manifest gets a comment where the key would
be, saying why there is no key. The absence is authored, not forgotten.

**⚠ ONE SHIPPED GOLDEN MOVED, in `test/kinyarwanda.test.ts`:**

| | before | after |
|---|---|---|
| `numberToWords(1000000000)` | `rimwe zeru zeru zeru zeru zeru zeru zeru zeru zeru` | `miriyari` |

That golden was pinning the DEFECT — it asserted that Kinyarwanda spells its milliard out digit by digit,
which the corpus contradicts ×8. The Kirundi golden for the same input is **unchanged and now asserted on
purpose**, with `expect(rwNum(1e9)).toBe("miriyari")` beside it so the divergence is pinned from both sides.

**Fallback, verified for both languages after the change** (the `ln`/`ha` defect class, commits `d38f00d` /
`fdab9b1`): rw `1234567890123` → `rimwe kabiri gatatu … gatatu`, rn `1000000000` → `rimwe zeru …` — never
empty, never raw ASCII, and one changed digit changes the reading. `npx vitest run
test/bignum-fallback.test.ts` 118/118 before and after; new assertions added to both language files.

**Gates.**

| gate | before | after |
|---|---|---|
| `referee-eval.ts rw` | 1407/1600 folded (87.9%) · 96.6% symbol | **identical** |
| `referee-eval.ts rn` | 1467/1600 folded (91.7%) · 98.0% symbol | **identical** |
| `review.ts --lang rw` | 2 FAIL (the minus, argued) | 2 FAIL, **same two**, unchanged |
| `review.ts --lang rn` | 2 FAIL (the minus, argued — Run 8) | 2 FAIL, **same two**, unchanged |
| `npx vitest run` | 240 files pass | **240 files / 3767 pass** |
| `npx tsc --noEmit` | clean | clean |

Both referees are word lists over a Common Voice / epitran vocabulary with no digits in it, so — as in Run 8
— they cannot move for a number-data change. Measured both ways anyway (the `billion` key was disabled, the
three referees re-run, and the key restored) rather than argued.
