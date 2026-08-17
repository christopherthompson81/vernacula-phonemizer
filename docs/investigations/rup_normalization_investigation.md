# Aromanian (rup) normalization — investigation log

The last residual language reachable by the ordinary method. After the eight-language separator pass, `rup`
was the only one of them whose wiki was **open and non-empty** — `roa-rup.wikipedia`, 1,389 articles — so it
was the one that could be converted from `separators` (the corpus-independent subset) to an argued layer.

⚠ **The wiki code is `roa-rup`, not `rup`.** That is the trap the Nahuatl round hit an hour earlier, where
`attest.ts` against a non-existent `nci.wikipedia.org` returned a page of false absences. Every fetch and
every attestation here passes `--wiki roa-rup` explicitly.

## Run 1 — 2026-08-16 — mining, and one correction mid-run

```
mine.ts fetch --wiki roa-rup --out /tmp/rup.raw.txt --random 1000 \
  --fill percent,currency,degrees,clock,era-marker,units,ranges,decimals,grouped,abbrev,fractions,signs
→ random: 1555 passages from 50/50 batches; 2,325 total
→ ranges  0 hits — genuinely absent from this wiki   ⚠ a MEASURED absence, not a sampling miss
```

⚠ **The first mine used the default SENTENCE segmentation and lost a cell.** `currency` came back EMPTY
despite the fetch having found 21 paragraphs for it, and the tool's own hint named the cause. Re-mined with
`--segment paragraph` — which is what every recent artifact uses, and for the reason its header states: in
paragraph mode no dot is ever interpreted, which is correct when the dot IS the target. 1,492 segments,
27/36 cells, and after the layer landed the artifact reports **36/36**.

The artifact is honestly labelled: `roa-rup.wikipedia.org (API: 1000 random + targeted cell fill)`, and the
generated header says *"⚠ THIS artifact is API-sourced … so `sample` is NOT frequency-representative"*. Over
a 1,389-article wiki the fetch covers a large fraction of the whole encyclopedia, but a rate computed from
it is still a fact about the fetch.

## Run 2 — 2026-08-16 — what the engine did

```
"9.695 persoani"        → nao . ʃasi suti … a single dot-group read as TWO SENTENCES
"0.48% di tuta mileti"  → nulə patrudzəts ʃi optu …   the sign gone
"287 n.Hr. –212 d.Hr."  → … n . hr . … d . hr .       the era letter-by-letter, four false stops
"216 061 bãn."          → … bən .                     the abbreviation as a cluster
"47°18′N, 22°48′E"      → … n , … e                   degree, prime and compass all silent
"tu anlu 1900-1910"     → … nao suti … nao suti dzatsi   the span fused
"6650 km di la izvuri"  → … km …                      the unit raw
```

The multi-group case (`1.234.567`) was already right — that is the shared `separatorHygiene` pass this
round replaces, which claims exactly the shapes that need no evidence. Everything above is what needed some.

## Run 3 — 2026-08-16 — ⚠ ALL FOUR SEPARATOR CONVENTIONS, AND ONE SENTENCE CARRIES TWO

The round's finding, and the reason mining was worth it: the ambiguous single group — the one shape the
corpus-independent pass deliberately refuses — turns out to be decidable here, because Aromanian writes
**both** of its neighbours' conventions and the three-digit test separates them cleanly.

| mark | job | count | instances |
|---|---|---|---|
| `.` | GROUPS | 25 | `2.601 m` · `52.360 bãnãtori` · `371.000 km2` · `22.834` |
| `.` | DECIMATES | 9 | `0.48%` · `7.6 milioani` · `41.33°N` (+ the dotted dates) |
| `,` | GROUPS | 8 | `10,600,000 km²` · `869,709` · `4,154,200` · `206,235` |
| `,` | DECIMATES | 12 | `1,5 milionji` · `221,6 km²` · `56,70%` · `19,5%` |
| ` ` | GROUPS | 4 | `216 061 bãn.` · `170 000 di mãrchi` · `21 000 000` |

⚠ **And two single sentences settle it beyond argument:**

```
"Ari unã populatsie di 206,235 (2004) shi unã suprafatsã di 111,2 km2"
                       ↑ comma GROUPS                     ↑ comma DECIMATES

"numirlu a populatsiiljei eara 22.834 (77%) Machidonj, 5.798 (19,5%) Turtsã"
                               ↑ dot GROUPS                    ↑ comma DECIMATES
```

**Implication** the codepoint settles nothing in either direction, and the THREE-DIGIT TEST APPLIED
SYMMETRICALLY TO BOTH MARKS settles everything — the Papiamento mechanism, arriving in a Romance language
that writes the Anglo-American and the continental convention side by side.

⚠ **The dotted DATE has to be taken first.** `23.12.1951`, `16.04.1959` are birth dates in the biography
stubs, and two digits follow the first dot, so the decimal arm would claim them and leave a stray break.

## Run 4 — 2026-08-16 — ⚠ THE COLON IS NEVER A CLOCK, TWENTY-EIGHT TIMES

`\d\s*:\s*\d` occurs ×28 and every single one is the population template's year-then-value apposition:

```
"Tu anlu 1992, cãsãbãlu avea 52.360 bãnãtori sh-tu 2001: 52.116. Estimarea trã anlu 2011 fu cã …"
```

Twenty-eight instances, zero times of day. No clock rule is written — and unlike the languages where this
refusal rested on a handful of instances, here the count is large enough to be a real measurement.

## Run 5 — 2026-08-16 — ⚠ THE CORPUS GLOSSES ITS OWN PERCENT SIGN, AND THE WIKI GLOSSES ITS OWN ERA

`%` is ×14 (`0.48%`, `56,70%`, `19,5%`, `97,94%`…) and exactly one sentence spells the phrase out:

> "tsi crishce pi **19,1 la sutã**"

That is the Aromanian percent phrase (cf. Romanian *la sută*), in the same sentence type that elsewhere
writes the sign. `procentu` ×1 on the wiki is the NOUN — "un procentu multu njicu dit populatsie", *a very
small percentage* — not the unit after a figure.

⚠ **And both halves of the era are quoted, not constructed:**

```
"Tu anlu 800 ninti di Hristo, Vãsãlia Machedonã mutã Hlambura ei"   ×2
"Makedonji di ninti di anji 50-70 dupu Hristo, iarau poligami"      ×1
```

⚠ The FORMS matter and both are the minority spelling's opposite: `ninti` ×34 against `nãinti` ×12, and
`dupu` ×56 against `dupã` ×22. A layer built on the Romanian cognates would have written `nãinte`/`după`.

## Run 6 — 2026-08-16 — ⚠ THREE WORDS SCORED AND WERE STILL WRONG, ALL FROM THE SAME CAUSE

`attest.ts --lang rup --wiki roa-rup` over 38 words. Reading the examples killed three, and the three share
a source: **roa-rup.wikipedia hosts Aromanian–Romanian DICTIONARY pages**, and a glossary line is a
definition rather than running prose.

| word | × | what the examples show |
|---|---|---|
| `gradi` | 2 | ⚠ BOTH are `Gradi didactitsi` — teaching grades in an academic CV |
| `minus` | 2 | ⚠ a Latin book title (`nec minus salutaris`) and a glossary line (`nghiosu = minus`) |
| `kilometru` | 2 | ⚠ both from one glossary dump: `kilodhramu = kilogram kilometru = kilometru` |
| `la sutã` | — | ✓ the corpus's own, above |
| `metru` | 7 | ✓ prose — "lungu di vãrã metru sh-giumitati" |
| `bãnãtori` | 38 | ✓ the geography stubs' commonest content word |

⚠ **`kilometru` ships anyway, and that is a judgement stated rather than hidden.** A bilingual glossary
entry IS a definitional attestation of the word, `metru` occurs in prose, and the compound is transparent.
`gradi` and `minus` do not ship, because for them the glossary is the ONLY source and the sense it gives is
the wrong one.

⚠ **The same dictionary pages explain `=`.** It is ×17 and not one is an equation: `giuvair = lucru mushat`,
`Dies Dominus (l.lat.) = Dzuã-alu Dumidzã`, `metru = măsură metru = metru`. Where a wiki hosts a dictionary,
the equals sign is a gloss separator — the tt finding, recurring for a structural reason rather than by
chance.

## Run 7 — 2026-08-16 — two defects the first draft carried

⚠ **THE ABBREVIATION GUARD DECLINED THE COMMONEST INSTANCE.** The first version required a letter or digit
after the dot, and the corpus writes `216 061 **bãn.** (2002)` — a BRACKET. Replaced with the sentence-end
guard the era rule already uses, which is right for the same reason (trap 10: keep the dot only where the
clause actually ends).

⚠ **AND THE EN-DASH SPAN HAD TO MOVE ABOVE THE ERA STEP.** This corpus writes `287 n.Hr. –212 d.Hr.`, where
the character left of the dash is the abbreviation's **dot**, not a digit. Expand the era first and the dash
is a letter's neighbour (`…Hristo –212`), invisible to any digit-anchored rule — so the span is dropped and
two eras fuse into one run. Matching `[.\d]` on the left, while the dot is still there, is what claims it.

⚠ **And the numeral particle `di` sits between the figure and the unit** — `largu 18 di km.di Tetova, 53 di
km.di Scopia` — which the tier's adjacency requirement cannot bridge. Both orders occur (`6650 km di la
izvuri` is bare), and only the first reached the tier. The same shape as Karakalpak's `mıń` and Crimean
Tatar's `biñ`, in a Romance language.

## Run 8 — 2026-08-16 — the gates

- **`mine.ts scan`**: LEAK `km` 9→0, `nr` 4→0, `dr` 2→0, `gr` 3→0 · `percent` 14→0. Residual, all read:
  `exponent` ×3 (`km²`/`km2`, no square word — registered), the interwiki language prefixes `tr:`/`fr:`/
  `rm:` and the dictionary `pl.` (plural), the list-dash minus ×1 and the vandalism segment.
- **corpus diff** (baseline emitted from HEAD, i.e. against the separator pass this replaces):
  **68/440 utterances changed (15.5%), DROP 32 → 21**, and no DIGIT / SLOT-GAP / RAWMARK / ZERO-WIDTH /
  RAW-CAPS / THROW either side.
- **`review.ts --lang rup`**: green on every checklist item — `artifact tracked`, `artifact current`
  (**36/36 cells**), `sign classes`, `sourcing`, `clause-final`. Seven refused classes registered.
- **`referee-eval rup`**: unchanged — wikipron 97.0% folded / 99.2% symbol, kaikki 95.5% / 99.0%.
- **`vitest`** full suite and **`tsc --noEmit`** clean.

## Backlog surfaced, not fixed

- **The coordinates** — `47°18′N`, `41°19′48″N, 19°49′12″E`, and `40°57' LGN shi 21°14' LGA` where `LGN`
  and `LGA` are longitude/latitude abbreviations with no expansion attested. Blocked on a degree word.
- **`km²` / `km2`** — the unit noun reads, the power does not; `patrat`/`pãtrat` are ×0.
- **The decimal has no word.** `virgulã` ×0, so the mark is spent and `111,2` reads as two numbers.
- **`cca.`** (circa) ×1 and `etc.` — no attested Aromanian expansion for the first.
- **`P.129-224`** keeps its endpoints fused: the range guard blocks on the preceding `.`, which is right for
  version numbers and wrong for this bibliography.
- **The wiki's dictionary pages** are a large fraction of this artifact and are not running prose. A future
  re-mine could exclude them by title and would get a cleaner frequency picture — at the cost of the
  self-glosses that made this round's sourcing possible.
