# Luxembourgish (lb) text normalization — #562

Corpus: FLEURS `lb_lu`, 1,896 unique utterances, **column 3** (the cased original).
Artifact: `tools/corpus/mined/lb.jsonc` (already committed).

## Run 1 — 2026-08-02 — baseline

```
npx tsx tools/normalization/corpus-diff.ts emit --lang lb --corpus lb_lu --out /tmp/lb.before
npx tsx tools/referee-eval/eval.ts lb
```

`emit` → 1,896 utterances. Referee eval (wikipron `ltz_latn_broad`) recorded verbatim so the post-change run
can be compared byte-for-byte; the top mismatches are all g2p, none normalization
(`lətsəbuərɡəʃ ≠ lətsəbuərəʃ`, `oraŋə ≠ oraʃ`, `fərhalən ≠ fəhalən`, …).

## Run 2 — 2026-08-02 — what the corpus writes (counts per shape)

Tabulated over column 3. Counts are instances, not utterances.

| shape | n | note |
|---|---|---|
| `N.` ordinal (digits + period + whitespace) | **67** | 63 with something after, **4 sentence-final** |
| space-grouped thousands (nbsp / narrow-nbsp / space) | **50** | `9 000`, `783 562`, `55 000` |
| units (`km m cm mm kg km/h m/s mph Meile/h`) | **40** | |
| clock written with a **PERIOD** | **26** | `7.19 Auer`, `20.30 Auer`, `15.00 UTC` |
| comma decimals | **23** | `1,5`, `7,74`, `75,57` |
| dotted abbreviations | **20** | `v./n. Chr.` 10, `asw.` 7, `Dr.` 6, `St.` 5, `Jr.` 4, `z. B.` 4, `Nr.` 2, `d. h.` 1 |
| ranges `N – M` (en dash + nbsp) | **11** | plus 44 en dashes that are *parenthetical*, never between digits |
| `:`-separated pairs | **6** | **all six are SCORES / ratios**, not clocks — see Run 4 |
| currency | **6** | `30 $`, `1.000 $`, `2.500 ¥`, `130.000 ¥`, `7.000 ¥` |
| version dot `802.11n/a/b/g` | 5 | |
| period-grouped thousands | 4 | `1.000`, `2.500`, `7.000`, `130.000` — **all with 3 digits after the dot** |
| percent | 3 | `88 %`, `3 %`, `80 %` |
| sports time `M.SS,hh` | 3 | `4.41,30`, `2.11,60`, `1.09,02` |
| degree | 3 | `32 °C` ×2, `35 °W` |
| `+N` | 2 | `+30 Grad Celsius`, `(UTC+1)` |
| fraction | 1 | `1/5 Zoll` |
| dot decimal | 1 | `1.5 Fuerstonne` (an anglicism) |
| **negative numbers** | **0** | every `-N` in the corpus is a compound hyphen: `Typ-1-Diabetes`, `COVID-19`, `II-76`, `36-x-24-mm` |
| all-caps initialisms | 173 | `US` 18, `USA` 14, `UN` 5 — **not treated**, see Run 8 |

### The `N.` context table (trap 4, the German method)

AFTER: `Joerhonnert` 23 · `September` 8 · `August` 5 · `Juli` 4 · `Januar` 3 · `Oktober` 2 · `Mäerz` 2 ·
`Juni`/`Februar`/`November` 1 each (= 27 months) · `an` 4 · `vun` 2 · `bis`/`beim`/`gréisste`/`Dag`/`oder`/
`Timber`/`New-Hampshire-Regimenter` 1 each.

BEFORE: `den` 9 · `de` 8 · `dem` 8 · `am` 8 · `vum` 7 · `De` 4 · `an` 3 · `Am`/`Den`/`zum` 2 · `bis`/`ass`/
`nom`/`fréien`/`säi`/`déi` 1.

SENTENCE-FINAL (must NOT be claimed), all 4 at end-of-utterance:
`… an Afghanistan 1979.` · `… am Joer 2020.` · `… am Joer 1922.` · `… d'Wanterolympiad 2010.`

**Finding:** there are ZERO mid-utterance sentence-final `N.` in this corpus, and all 63 `N.` with a
follower are genuine ordinals. So requiring *something to follow* already protects all four.

## Run 3 — 2026-08-02 — probing the CURRENT engine

`phonemize(form, "lb")` on every attested shape. Verbatim before-readings:

```
"am 16. Joerhonnert"        → am ziəχt͡seːŋ . joərhonərt          ← cardinal + a spurious PAUSE
"den 24. September"         → dæn fei̯ərant͡svant͡səχ . zæptəmbər
"vun 1.000 $"               → fun eːnt . nul                      ← pause + "null", $ dropped
"55 000 Barrellen"          → fənəfafoft͡səχ nul barələn           ← a spurious "null" (×50)
"1,5 Kilometer"             → eːnt , fənəf kilomətər              ← decimal comma read as a PAUSE
"um 7.19 Auer"              → um zivən . nont͡seːŋ æu̯ər
"88 % vun den Netzpunkten"  → aːχtanaχt͡səχ fun dæn næt͡spuŋktən   ← % silently DROPPED
"165 km/h (105 Meile/h)"    → honərtfənəfaziəχt͡səχ km h honərtfənəf mai̯lə h
"0 kg" / "7 cm" / "5 mm"    → nul kk / zivən km / fənəf m         ← raw letters into the IPA
"32 °C"                     → t͡sveːandrəsəχ k                    ← ° dropped, C read as [k]
"vun 2 – 3 km Äis"          → fun t͡sveː dræi km æis               ← dash dropped
"am 10. Joerhonnert v. Chr."→ am t͡seːŋ . joərhonərt f . χr .
"z. B. de Pennsylvania"     → t͡s . p . dæ pænsilfania
"Nëss, Iessen asw."         → nəs , iəsən asf .
"5 mm (1/5 Zoll)"           → fənəf m eːnt fənəf t͡sol
"iwwer +30 Grad Celsius"    → ivər drəsəχ ɡrat kælsius            ← + dropped
```

Also probed and confirmed *correct today* (must not regress): `COVID-19`, `Typ-1-Diabetes`,
`Standard-35-mm-Film`, `4x4`, `50 Hektar`, `5 Zoll`, `15 Meilen`.

## Run 4 — 2026-08-02 — the period, and the colon (the crux)

Luxembourgish writes German-style, so one character (`.`) carries four jobs. The disambiguation falls out
of the corpus with no heuristics at all:

| job | shape | n | discriminator |
|---|---|---|---|
| thousands grouping | `\d{1,3}.\d{3}` | 4 | **exactly three** digits after the dot |
| clock | `\d{1,2}.\d{2}` | 26 | **two** digits, plus a licenser (`Auer`/zone after, or `um/ëm/géint/tëschent` before) |
| ordinal | `\d{1,4}.` + whitespace | 67 | **nothing** after the dot |
| version / sports / figure | `802.11n`, `4.41,30`, `1.1.` | 9 | a trailing letter, a following `,\d`, or a following `.` |

That is a *different* solution from both precedents the brief named: German disambiguates grouping from the
decimal inside its TOKEN regex (it has no period-clock), and Czech leans on its ordinal being licensed by a
case-governing preposition. Luxembourgish needs **fraction length**, because it writes the clock with a
period *and* groups with a period.

**The colon is not a clock in this language.** All six `\d+:\d+` are scores or ratios —
`7:2` (head-to-head), `2:2` (a degree class), `6:6` (a tie-break), `21:20` (a rugby result), `3:2` (an
aspect ratio), `5:3-Victoire`. A colon-clock rule would have misfired on 6 of 6. **No colon rule written.**

## Run 5 — 2026-08-02 — the Eifeler Regel is the ordinal ending

The corpus spells out enough ordinals to derive both the stem table and the inflection, with no invention:

```
vum zwanzegste Joerhonnert     wärend dem zwielefte Joerhonnert     am drëtte Joerhonnert
den éischte Joresdag           vum éischten Dag                     duerch d'Ufroe vum éischten Dag
ass néngte beim Männer-Super-G gouf eeleften am Männer-Super-G      gouf siechzéngten am Männer-Super-G
op der drëtter Plaz            op der zweeter Plaz                  op der zéngter Plaz
```

Read them together and the ending is **always `-en`**, with the **Eifeler Regel** deleting the final `n`
before a consonant outside `n d t z h`:

* `-en` kept before `Dag` (d) · `am` (vowel) · `New-…` (n)
* `-e` before `Joerhonnert` (j) · `Joresdag` (j) · `beim` (b)
* `-er` only after the feminine dative article `der` (`op der zéngter Plaz`)

So the ending is not a case table at all — it is one ending plus a sandhi rule the language already has in
`numbers.ts` (the `an-`/`a-` connector: *fënnefa**n**drësseg* 35 vs *fënnefa**véierzeg* 45). The rule was
factored out as `applyEifelerRegel()` and is now shared by the connector, the ordinal ending and the
fraction numerator (`een Drëttel` — corpus — but `ee Fënneftel`).

### The ordinal STEM, and how it was validated (trap 13)

Composition: cardinal + `t` below 20, + `st` from 20, collapse a doubled `t`, two suppletive stems
(`1 éischt`, `3 drëtt`). Enumerated 1…30 and spot-checked against **two independent sources**:

* corpus: éischt zweet drëtt véiert fënneft sechst siwent néngt zéngt eeleft zwieleft dräizéngt
  siechzéngt uechtzéngt zwanzegst
* `espeak-ng/dictsource/lb_list`: aacht éischt drëtt véiert fënneft sechst siwent néngt zéngt eeleft
  zwieleft dräizéngt véierzéngt fofzéngt siechzéngt siwwenzéngt uechtzéngt nonzéngt zwanzegst drëssegst
  véierzegst fofzegst siechzegst siwwenzegst nonzegst honnertst dausendst — **and the compounds**
  `véieranzwanzegst`, `nénganzwanzegst`, `néngandrëssegst`, `néngafofzegst`, which confirm both the `+st`
  branch and that the connector's Eifeler alternation carries into the ordinal.

`8` is the branch neither list would have caught by accident: `aacht` + `t` = `aachtt`, collapsed to
`aacht`. Pinned.

## Run 6 — 2026-08-02 — sourcing every word the layer emits (§5e)

| word | for | source |
|---|---|---|
| `Prozent` | `%` | corpus ×14, espeak `lb_list` |
| `Dollar` | `$` | corpus ×7 |
| `Euro` | `€` | corpus ×1, espeak |
| **`Yen`** | `¥` | **no in-repo source** — see below |
| `Komma` | decimal | espeak `komma koma:` (the corpus's only `Komma` is *Kommandomodul*) |
| `bis` | range | corpus ×63, **including as a numeric infix**: `100 bis 250`, `10 bis 15`, `siwe bis aacht`, `10. bis 11.` |
| `an der` / `pro` | `/h` / `/s` | corpus: `240 Kilometer **an der Stonn** (149 Meilen an der Stonn)` and `1,5 Kilometer **pro** Sekonn` — both idioms taken verbatim |
| `Stonn`, `Sekonn`, `Meilen` | rate nouns | corpus + espeak |
| `Grad`, `Celsius` | `°C` | espeak / corpus ×1 |
| `Fahrenheit` | `°F` | invariant proper name; **zero corpus instances** (trap 8 probe only) |
| `vir`, `no`, `Christus` | `v./n. Chr.` | espeak `vir`, `no`; **`Christus` corpus ×1** (`d'Opersteeung vu Christus`) |
| `zum Beispill` | `z. B.` | corpus ×10 as words |
| `an sou weider` | `asw.` | espeak `sou`, `weider` |
| `Dokter`, `Junior`, `Nummer` | `Dr. Jr. Nr.` | espeak (`Dokter` also in the referee list) |
| `dat heescht` | `d. h.` | ordinary lb vocabulary, corpus |
| `hallef`, `Drëttel`, `Véierel`, `Fënneftel` | fractions | espeak has `hallef aachtel drëttel fënneftel néngtel sechstel siwentel **véierel**` — the composition *stem + el* is validated on 6 of 7, with `véierel` (not \*véiertel) the one irregular, so it is tabled |
| `plus`, `minus` | signs | espeak |
| `eng` | the 1-o'clock hour | ordinary lb (`Auer` is feminine); manifest already writes `eng Millioun` |
| `Kilometer Meter Zentimeter Millimeter Kilogramm` | units | espeak (`Kilogramm` absent, but units are excluded from the §5e check by design) |

**`Yen` is the one word I could not source.** It is in no in-repo source (FLEURS lb, the mined artifact, the
wikipron referee, espeak's `lb_list`). It carries 3 of the corpus's 6 currency instances, and the playbook's
own §5e residue list names `yen` as exactly this class in 9 already-shipped languages. Shipped, and flagged
in the PR.

**Not shipped for want of a source:** `St.` → *Sankt*. `sankt` appears in `lb_list` only inside
*sanktioun*/*sanktionéieren*; all 5 corpus instances are US place names (`St. Louis`, `Six Flags St. …`)
where an lb speaker may equally say the French *Saint*, which is playbook §5b territory (ask the audio) and
not a text question. Left unexpanded — 5 spurious pauses kept rather than 5 confidently-wrong words.

## Run 7 — 2026-08-02 — trap 14: what a joiner does to its neighbour

`bis` begins with `b`, which is **not** in the Eifeler keeper set — so a range whose left operand ends in
`n` must lose that `n`, and the corpus proves it: **`siwe bis aacht`**, not \**siwen bis aacht*.

Emitting `$1 bis $2` on digits could never do that, because at that moment there is no word. So the range
rule words-ifies the LEFT operand — and only when it has to (`numberToWords(n)` ends in `n`; in practice 7,
and anything ending in *Millioun*/*Milliarden*). The right operand stays digits, which is what keeps the
shared tier's number↔unit adjacency alive for `2 – 3 km` (trap 14's second clause). The operand character
class is anchored to end in a digit so it cannot eat a clause comma (trap 14, hazard 2).

The same applies to the clock: `Auer` is **feminine**, so hour 1 is *eng Auer*, never \**eent Auer*. The
clock rule words-ifies h=1 for that reason. Zero corpus instances of `1 Auer`/`1.xx Auer`… except
`E Samschdeg um 1.15 Auer`, which is exactly the case. Pinned.

**A pre-existing gap I did NOT fix, and why.** The Eifeler Regel also applies between a *cardinal* the
tokenizer emits and the following word — `7 Kilometer` reads *siwen kilomətər* where the language says
*siwe Kilometer*. That is the number path in `luxembourgish.ts`, not this layer; it affects text with no
symbol in it at all, and fixing it is a behaviour change to every number in the language with its own
corpus-diff to earn. Reported, not done. Where **this layer** emits a word, the sandhi is applied.

## Run 8 — 2026-08-02 — deliberately NOT done

* **Initialisms** (173 all-caps: `US` 18, `USA` 14, `UN` 5, `UNESCO`, `FBI`, `GPS`…). Needs a Luxembourgish
  letter-name table. No in-repo source has one; guessing at 26 letter names would be confidently wrong 173
  times over. Left for a run that can source them (or arbitrate with audio, §5b).
* **A colon clock** — Run 4. Six of six colons are scores.
* **`St.`** — Run 6.
* **The parenthetical en dash** (44 instances, `… gëtt – duerch …`). It is currently dropped entirely,
  because `–` is in neither `TOKEN` nor `clausePunctuation`. Adding it is a one-line manifest change and
  clearly right, but it is a change to the *tokenizer's* punctuation set rather than to normalization, and
  it would move 44 utterances for a reason unrelated to #562. Reported.
* **`bzw.`** (1 instance, inside a German-flavoured sentence) and **`Prof.`/`etc.`** (0 instances) —
  trap 9: no attested instance, no rule.
* **`ha`/`t`/`g` units** — `50 Hektar` is written out, and there is no bare `\dg` in the corpus
  (`802.11g` is the version). A one-letter unit key is the Dutch `Il-76s` hazard; not declared.
* **`£`** — sign absent from the corpus, word unsourced.

## Run 9 — 2026-08-02 — branch enumeration (trap 13)

Ran `ordinalStem` over 1…30 plus {37, 60, 100, 190, 1000, 1922, 1979, 2010} and the fraction composer over
denominators 2…12, and read the lists. Output recorded in the test file as pins. The branches are:
irregular table (1, 3) · `+t` (2, 4…19) · `tt` collapse (8) · `+st` (20+) · multi-word carrier
(1000+, where the ending must land on the last word only) · fraction table (2 → `hallef`, 4 → `Véierel`) ·
fraction composition (everything else → stem + `el`).

## Run 10 — 2026-08-02 — corpus diff, and the TWO defects only it could see

```
npx tsx tools/normalization/corpus-diff.ts emit    --lang lb --corpus lb_lu --out /tmp/lb.after
npx tsx tools/normalization/corpus-diff.ts compare --before /tmp/lb.before --after /tmp/lb.after --corpus lb_lu
```

First pass: **187/1896 changed (9.9%)**, `DROP 9 → 0`, every other counter 0 before and after. All 187
word-level diffs were dumped and read. 185 were unambiguous improvements. Two were not:

**Defect A — `Meile` → `Meilen`, 6 instances, wrong.** I had declared `meile` as a tier unit so that
`Meile/h` could compose as a rate. That also made the tier rewrite the corpus's own spelled-out noun:

```
(31 Meile) vu Buenos Aires   → Meilen        (3 980 Meile) laang → Meilen
(140 Meile) vu Peking        → Meilen        (1 000 Meile) laang → Meilen
(500 Meile) breet            → Meilen        (40 Meile) südlech  → Meilen
(15 Meilen) nord-nordëstlech → Meilen  ← the only one that was already Meilen
```

Line those up and the corpus is applying the **Eifeler Regel to the noun itself**, correctly, 7 times out
of 7: the ⟨n⟩ survives before *nord-* and is deleted before *vu*, *laang*, *breet*, *südlech*. My rewrite
destroyed the writer's own sandhi in 6 of them. Fix: `meile` removed from the tier entirely; `mph` and
`Meile/h` claimed in normalize.ts, where `Meilen an der Stonn` (the corpus's own phrase, ⟨n⟩ kept before
the vowel of *an*) is emitted for the rate only, and a spelled-out `Meile` is now left untouched.

**Defect B — `km²` left entirely raw, 4 instances.** `19 500 km²`, `3 850 km²`, `2,2 Millioune km²`,
`3 136 mm²`. The tier matches the exponent and then declines when `exponentWords` is undeclared, so `km`
reached the IPA as raw letters. Luxembourgish fuses the measure word German-style and the corpus writes
both compounds itself — `783 562 Quadratkilometer (300 948 Quadratmeilen)` and `120 – 160 Kubikmeter` — so
`exponentWords: { squared: ["Quadrat"], cubed: ["Kubik"], position: "compound" }`. Sourced, not invented.

Neither was visible in any unit probe. This is trap 3, twice, in one language.

## Run 11 — 2026-08-02 — the mechanical review, and the sign classes

```
npx tsx tools/normalization/review.ts --lang lb
```

First run: `[FAIL] sign classes  DROPPED: equals less-than times`. Calibrated against the shipped
languages before acting — `de` FAILs the same three, but `cs`, `is`, `mk` and `kk` are all clean, and the
Czech layer says why in a comment: none of those signs occurs in its corpus either, but *a phonemizer is
handed arbitrary text and a dropped sign is inaudible*, which is the one outcome that cannot be right
(#584). Took the same position, with every word attested rather than guessed:

| sign | reading | source | corpus n |
|---|---|---|---|
| `=` `≈` | ass gläich | `gläich` espeak + corpus ×1 | 0 |
| `<` | méi kleng ewéi | `méi` ×220, `kleng` ×28, `ewéi` ×205 | 0 |
| `>` | méi grouss ewéi | `grouss` ×34 | 0 |
| `×` | mol | espeak `mol`; corpus `Mol` ×8 | 0 |
| `÷` | dividéiert duerch | **the corpus's own phrase** — *dividéiert duerch zwielef* | 0 |
| `&` | an | lb's commonest word | **2** |

The ampersand turned out to have real instances after all: `College of Arts & Sciences` and `B&B`, both
of which previously read as two adjacent bare letters with nothing between them — the exact Czech
`BB`-vs-`B B` case that the DROP test cannot see. The corpus's other 90 `&` are `&apos;`, and those are
**already decoded upstream** by `core/markup.ts` — which was written for `lb_lu` specifically. A local
entity-decoding step was written, measured as a no-op against that, and removed rather than shipped as
duplicate machinery.

The ASCII `x` in `75,57 cm x 62,23 cm` is deliberately left alone: it is a LETTER of this orthography, and
claiming it would also claim `4x4` (×2) and `36-x-24-mm-Negativ`.

`[??] sourcing  Yen` is the residue, discussed in Run 6. German shows the identical prompt.

## Run 12 — 2026-08-02 — final gates

| gate | result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | **200 files / 2692 tests passed** (26 in `test/luxembourgish.test.ts`, 12 of them new) |
| `mine.ts scan --lang lb` | 134 lines scanned, **no defects** |
| `review.ts --lang lb` | **checklist clean**; `Yen` is the one `??` |
| `referee-eval lb` | **72.1% folded / 93.0% symbol — unchanged.** Proved rather than eyeballed: 0 of the referee's 3,894 headwords are altered by `normalizeLuxembourgish`, and the divergence-class tail is byte-identical to the pre-change run |
| `corpus-diff compare` | **189/1896 changed (10.0%)**; `DIGIT 0→0, SLOT-GAP 0→0, RAWMARK 0→0, DROP 9→0, THROW 0→0` |

The 9 DROPs were 3 percent, 3 currency and 3 degree instances, all now spoken. Every one of the 189
changes was read at word level.

## Not fixed, and why — for the reviewer

1. **The Eifeler Regel between a CARDINAL and the next word.** `7 Kilometer` reads *siwen kilomətər*
   where the language says *siwe Kilometer*, and the corpus proves it (`siwe bis aacht`). That is the
   number path in `luxembourgish.ts`, it affects text with no symbol in it at all, and fixing it is a
   behaviour change to every number in the language with its own corpus diff to earn. Where THIS layer
   emits a word the sandhi is applied (ordinal ending, fraction numerator, range operand); the general
   case is a separate issue.
2. **Bare `1` before a noun** — `1 km` reads *eent Kilometer* where it should be *een Kilometer*. Same
   place, same reason: the manifest's own "JUDGMENT CALL" note already records that bare 1 is the counting
   form `eent`. Zero corpus instances.
3. **`2,2 Millioune km²`** (1 instance) still reads `km` raw. The shared tier requires the NUMBER adjacent
   to the unit, and a magnitude word sits between them. That is a `core/normalizeSymbols.ts` gap; core was
   not touched.
4. **Initialisms** — 173 all-caps runs, no sourceable Luxembourgish letter-name table (Run 8).
5. **`St.`** — unsourced expansion (Run 6).
6. **A hyphen range** — `1990-1995` is not claimed. The corpus writes 11 ranges and every one uses an en
   dash with NBSP; `\d-\d` has ZERO instances while `-N` compounds have many (`Typ-1-Diabetes`,
   `COVID-19`, `II-76`, `HJR-3`, `36-x-24`). Trap 9.
7. **The parenthetical en dash** — 44 instances, dropped entirely, because `–` is in neither `TOKEN` nor
   `clausePunctuation`. A one-line manifest change, clearly right, and out of scope for #562 (Run 8).
