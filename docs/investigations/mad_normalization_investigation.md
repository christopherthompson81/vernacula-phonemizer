# mad (Madurese) text normalization — investigation log

Worked in a dedicated git worktree on branch `norm/mad`, based on `fdab9b1`.

## Run 1 — 2026-08-11 (baselines, before touching anything)

**Question.** What is the pre-change state of every gate, so the "after" numbers mean something?

Commands and raw findings:

```
$ npx tsx tools/referee-eval/eval.ts mad
=== mad vs JIPA Illustration (Misnadin & Kirby 2020), human [primary] (35 words) ===
raw exact:      33/35 (94.3%)
folded backbone:33/35 (94.3%)
symbol accuracy:98.9%
residual: mokka→mɔkːa vs mɔkːaʔ ; aherra→ahəɾa vs ahɛɾa
```

```
$ npx tsx tools/normalization/corpus-diff.ts emit --lang mad --corpus mined:mad --out …/mad.before
emitted 435 utterances
```

```
$ npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/mad.jsonc --lang mad
DROP exponent      ×27
DROP percent       ×24
DROP ampersand     ×18
DROP currency      ×16
DROP math-sign     ×14
DROP degree        ×11
DROP minus         ×10
REDUNDANT currency ×1
```

```
$ npx tsx tools/normalization/review.ts --lang mad
[FAIL] normalizer  src/languages/madurese/normalize.ts missing   (1 FAILING)
```

```
$ npx tsx tools/normalization/sources.ts --lang mad
[NONE] letter-names   espeak does not ship this language at all
[NONE] decimal-point  no _dpt, no _., no manifest word
[  · ] era-phrase     no era marker in the corpus
[NONE] scale-names    ° occurs, neither scale name anywhere
[chk?] percent/currency/minus/plus-minus/equals/times/ampersand/plus/exponent — signs occur, nothing declared
espeak: NOT SHIPPED · referee: 41 lines · corpus: 437 lines (mined artifact)
```

**Findings that shape the work.**

- The `mad.jsonc` artifact already exists (dump-sourced, mad.wikipedia pages-articles, 37,821 segments,
  31/35 cells covered), so step 0b is already done and `sample` IS the real distribution.
- The engine has NO normalize.ts at all. Every symbol class is dropped.
- espeak does not ship Madurese, and there is no machine referee — the only referee is a 35-word human
  gold from the JIPA Illustration. So `letter-names` is structurally blocked: initialisms are not
  wireable (playbook §"Before you defer a class"), and I must not invent a letter table.
- Corpus counts (whole corpus, from the artifact header): decimals 1541, percent 367, ranges 3606,
  units 580, currency 124, degrees 93, clock 195, grouped 973, exponent 241, ampersand 493,
  signed-number 64, arithmetic 56, roman 1755, initialism 10505, ordinal-latin 4496.

**Implication for the next step.** Read the corpus by hand for the dot/comma convention (Indonesian
`1.000` / `1,5` vs imported English), then probe the current engine on each attested surface form.

## Run 2 — 2026-08-11 (read the corpus, then probe the engine)

**Question.** Which separator convention does Madurese write, and what does the engine actually do to
each attested surface form?

Evidence extracted from the artifact (437 lines = 237 hard + 200 sample; the corpus-wide counts are in
the artifact header). Separator tabulation over those 437 lines:

```
period + exactly 3 digits   2.093, 5.168, 40.000, 2.150.000   ×79   ← THOUSANDS, dominant
comma  + exactly 3 digits   857,530  54,806,012  0,001         ×10   ← English thousands (and one decimal)
comma  + 1–2 digits         1,6  2,4  62,63  16,09  35,29      ×55   ← DECIMAL, dominant
period + 1–2 digits         39.33%  17.30  1.6m  2.5pp  4.5    ×16   ← English decimal AND the clock
```

So Madurese takes the Indonesian/Dutch convention (dot groups, comma decimals) and the wiki also carries
English-format imports — **the same article writes both**: `Rp 16.31 milyad` and `Rp 16,09 milyad` are
adjacent sentences of the campaign-finance article. Confirmed rather than assumed, as instructed.

**Engine probe (`getPhonemizer("mad").text(...)`), raw:**

```
2.093,45 km²   → duwɤ . saŋaʔ pɔlɔ bɤn təlɔ , əmpaʔ pɔlɔ bɤn lɛmaʔ km   ← value DESTROYED, unit raw, ² gone
5.168 km²      → lɛmaʔ . atɔs bɤn ənːəm pɔlɔ bɤn bɤluʔ km
71%            → pətːɔʔ pɔlɔ bɤn sətːɔŋ                                  ← % silently dropped
50%-na         → lɛmaʔ pɔlɔ na
pokol 14.00    → pɔkɔl sapɔlɔ bɤn əmpaʔ . nɔla                           ← clock read as "14, zero"
pokol 18:45    → pɔkɔl sapɔlɔ bɤn bɤluʔ , əmpaʔ pɔlɔ bɤn lɛmaʔ
Rp 16,09 milyad→ ɾp sapɔlɔ bɤn ənːəm , saŋaʔ miljat                      ← Rp as bare letters
US$550 juta    → us lɛmaʔ pɔlɔ ɟuta                                      ← $ dropped
$40.000        → əmpaʔ pɔlɔ . nɔla
€1,3 triliun   → sətːɔŋ , təlɔ tɾilijun                                  ← € dropped
36°C           → təlɔ pɔlɔ bɤn ənːəm c                                   ← ° dropped, C read as Madurese /c/
40 °C          → əmpaʔ pɔlɔ c
7°53’-8°34’    → pətːɔʔ lɛmaʔ pɔlɔ bɤn təlɔ bɤluʔ təlɔ pɔlɔ bɤn əmpaʔ    ← coordinate, all marks gone
70-90%         → pətːɔʔ pɔlɔ saŋaʔ pɔlɔ                                  ← range with no connective
30kg nitrogen  → təlɔ pɔlɔ kk nitɾɔɡɨn                                   ← ⟨kg⟩ read as a GEMINATE [kː]→kk
40m tèngghina  → əmpaʔ pɔlɔ m tɛŋkʰina
96x100cm       → saŋaʔ pɔlɔ bɤn ənːəm z atɔs cm                          ← the ⟨x⟩ dimension cross reads [z]
940 M / 12 SM  → … m  /  … sm                                            ← era letters raw
±3.78%         → təlɔ . pətːɔʔ pɔlɔ bɤn bɤluʔ                            ← ± dropped
+599           → lɛmaʔ atɔs bɤn saŋaʔ pɔlɔ bɤn saŋaʔ                     ← + dropped
A & B          → … (the & dropped)
PBB            → ppː                                                     ← vowel-less initialism
2.5pp          → duwɤ . lɛmaʔ pː
```

**Two seams already work and must be left alone (playbook trap 16):**

```
abad ka-20  → abɤt ka duwɤ pɔlɔ      the ordinal prefix ⟨ka-⟩ is an ordinary word; the hyphen falls out
ka -8       → ka bɤluʔ               the SPACED variant too (`Perdana Mantrè … ka -8`, `abad sè kapèng -20`)
Olimpiade XXIX → (core/roman.ts in the registry turns it to digits before text() runs)
```

**Vocabulary sourced from the corpus itself** (`corpus-words.ts --lang mad`, whole-token counts, sense read):

| slot | word | count | the instance that settles it |
|---|---|---:|---|
| percent | `persen` | 1t | `Sangang polo petto' persen aèng` — "ninety-seven percent water", the exact slot |
| clock | `pokol` | 6t | `pokol 14.00`, `pokol 18.56`, `pokol 18:45`, `pokol 11:00`, `pokol 8` |
| range | `sampè'` | 14t | `111º05′ sampè' 112º13′ Bujur Tèmor`, `1998 sampè' taon 2008`, `2015 sampè' taon 2019` |
| range (formal) | `kantos` | 26t | `30 kantos 38 ppt`, `1596 kantos taon 1651` — the same slot, higher register |
| degree | `derajat` | 2t | `suhu rata-rata 30 derajat celcius` — degree AND the scale name in one sentence |
| Celsius | `celcius` | 1t | same sentence |
| currency | `dolar` | 3t | `dolar AS`, `dolar Amèrika Serikat` |
| ≈ / ± | `korang lebbi` | 17t | `Loas wilayana korang lebbi ±1.752,21 km²` — the corpus GLOSSES the sign with the phrase |
| "less than" | `korang ḍâri` | — | `korang ḍâri sèttong milimeter`, `korang ḍâri 50%` |
| and (`&`) | `bân` | 536t | the ordinary conjunction |
| km | `kilomèter` 1t / `kilometer` 2t | | `ra-kèra 25 kilomèter otabâ 40 mennèt` |
| m | `mèter` 8t / `meter` 4t | | `lanjhângnga korang lebbi 2 mèter` |
| ha | `hèktar` 5t / `hektar` 1t | | `10 ton/hèktar`, `79.230 hektar` |
| squared | `persegi` 1t | | `361 juta kilometer persegi` — the exact unit-modifier slot |
| magnitudes | `juta` 18t, `miliar` 11t, `milyad` 6t, `triliun` 3t, `èbu` 2t, `jutah` 2t, `triliyun` 1t | | |

**Absent from the corpus and therefore still open:** `koma` (0 token / 4 substring), `rupiah` (0 — although
`Rp` is written 9 times with an amount), `kubik` (0), `sèntimèter`/`kilogram` (0), `Masèhi` (0 — although
`940 M`, `875 M.`, `12 SM` are written), `fahrenheit` (0 — but `°F` occurs once), letter names (espeak
ships no Madurese at all).

**Implication.** De-grouping is the single most destructive defect and goes first. Then the open words go
to `attest.ts` on mad.wikipedia; anything still unsourced stays unread.

## Run 3 — 2026-08-11 (sourcing the words the corpus cannot supply)

**Question.** Six slots have no whole-token corpus hit — the decimal word, the rupiah, the cube word, the
centimetre/kilogram nouns, the era phrases and the Latin letter names. Does mad.wikipedia have them?

```
$ npx tsx tools/normalization/attest.ts --lang mad --words "koma,rupiah,kubik,sèntimèter,sentimeter,\
kilogram,Masèhi,Masehi,fahrenheit,persegi,pasagi,tamba,korang lebbi"
```

(Note on the wiki code: Madurese's wiki IS `mad`, so no `--wiki` override is needed — verified by the
artifact's own `source: mad.wikipedia.org dump`. The probe was rate-limited twice mid-session; three
sibling agents are hitting Wikimedia at the same time.)

| word | token | arts | the sense, read from the examples |
|---|---:|---:|---|
| `koma` | 18 | 12 | ⚠ **every recorded instance is a COMET'S COMA** — `Bâgiyân-bâgiyân komèt aèssè inti, koma, ondem hidrogèn, bân bunto'`. NOT an attestation of the decimal reading. |
| `rupiah` | 19 | 16 | monetary throughout — `arghâ ra-kèra 1 juta rupiah per orèng`, `uang kertas Rp 10.000` ✓ |
| `kubik` | 19 | 8 | volume throughout — `volume 181.000 meter kubik`, `200 meter kubik per detik` ✓ |
| `sentimeter` | — | 10 | and the wiki GLOSSES THE ABBREVIATION ITSELF: `ècapa' 120 sentimeter (cm)` ✓ |
| `sèntimèter` | — | 4 | the marked spelling, also attested ✓ |
| `kilogram` | — | 11 | `bom saberrâ' 12,5 kilogram`, `berrâ'en 40 sampè' 90 kilogram` ✓ |
| `Masèhi` / `Masehi` | — | 20 / 20 | `neng taon 622 Masèhi`, `abad ke-18 Masehi`, `taon 700-an Masehi` ✓ |
| `fahrenheit` | — | 2 | `(èsebbhut titi' bekku, 0° Celcius, 32° Fahrenheit)` — both scale names in one sentence ✓ |
| `persegi` | — | 20 | `120 meter persegi (1.300 kaki persegi)` — the unit-modifier slot, trap 37's collocation ✓ |
| `pasagi` | 0 | 0 | absent — the Sundanese spelling is not Madurese's |
| `tamba` | — | 9 | ⚠ every hit is the verb/adverb "to increase" (`pânḍuḍuk Katolik tamba bânnya'`) — **not** the plus |

**The BC phrase, from two independent sources** (the wiki probe returned nothing for it at first because
I had not guessed the spelling — trap 40's "name the slot"):

```
$ WebFetch mad.wikipedia.org/w/api.php?…insource:/sabellunna Masèhi/   → 1 hit
   "Alfabèt Latin": "…rakèra molàèn abad ka-7 sabellunna Masèhi. Ka'dissa orèng ajhâr nyerrat…"
$ web search                                                          → the Madurese Bible (YouVersion
   `MAD`) uses "Sabellunna Masehi" in its book introductions
```

A later re-probe scored it `attested 2 token / 2 articles` on the wiki directly.

**LETTER NAMES: a definitive negative.** `sources.ts` says `[NONE] letter-names — espeak does not ship this
language at all`; the corpus never spells an acronym out; and mad.wikipedia's own `Alfabèt Latin` article
was fetched and read — it gives the letter SHAPES (handwritten and cursive) and **no nomenclature table**.
So initialisms are structurally blocked (`IAIN` ×13, `SMA` ×11, `PT` ×9, `UIN` ×8, `PBB` ×5 in 437 lines;
`PBB` reads [ppː]). Javanese shipped an INFERRED Indonesian inventory on the argument that its own g2p
supplies the phonology; that argument transfers, but the inventory would still be a guess and this pass
declines to make it. Recorded as a re-runnable measurement, not a TODO.

**Implication.** Every slot but the decimal word is sourced. `koma` ships anyway, flagged as the one
unattested reading in the file — the playbook's own rule that a written corpus is the weakest evidence
about how a SYMBOL is spoken, plus the fact that Madurese's whole numeric-technical stratum here is the
Indonesian one and every other member of it IS attested (persen, derajat, celcius, persegi, kubik, mèter,
kilogram, rupiah, dolar, triliun, miliar, per). The alternative is 1,541 values destroyed by a phrase break.

## Run 4 — 2026-08-11 (write the layer, then read what the scan still refuses)

Wrote `src/languages/madurese/normalize.ts` (10 numbered steps) and wired it into `madurese.ts`'s `text()`.
First scan after the layer landed:

```
$ npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/mad.jsonc --lang mad
DROP exponent 27 → 1 · percent 24 → 0 · ampersand 18 → 0 · currency 16 → 3
DROP math-sign 14 → 9 · degree 11 → 0 · minus 10 → 5
```

**Then I read the five remaining minus instances, and two of them were a BUG rather than a refusal.**

```
6º51’54’’-7º23’6’’ Lintang Lao' bân 112º4’41’’-112º33’12’ Bujur Tèmor
```

The coordinate-span rule matched `(?<=\d)(['’′″"”º°])` — ONE character. This wiki writes the arc-second as
TWO apostrophes, so the character before the dash is itself a `’` and the digit lookbehind failed on
exactly the two densest coordinate sentences in the corpus. Matching a RUN (`[…]+`) closed both. **DROP
minus 5 → 1.** This is the playbook's own instruction working: closing a DROP is not finished until you
read the reading, and the leftovers named the bug.

The same read produced the second fix. `review.ts`'s ordinary-text probes print `2:00 → duwɤ , nɔla` — a
bare colon-clock with no hour word and no marker, which my first version declined. Counted: **all seven of
the artifact's colon-times are clocks** (`8:00 PM`, `10:00`, `11:00`, `12:00`, `17:00 WIB`, `18:45`, and
the three-field `08:08:08` the trailing guard refuses), and the later wiki probe for `pokol` independently
showed `pokol 01:00-03:00`, `pokol 09:30-10:00`. So the bare COLON arm went in — and the PERIOD deliberately
did not, because `Rp 16.31 milyad` is 16.31 BILLION rupiah two sentences from `Rp 16,09 milyad`.

**What the scan refuses after both fixes, all read by hand:**

| class | ×  | instances |
|---|---:|---|
| minus | 1 | `ka'dissa' -1 mèter dpl` — a GENUINE negative. Stays RED (see below). |
| minus (accepted) | 3 | `ka -8`, `kapèng -20` (the spaced ORDINAL prefix), `35° Lintang Dâjâ -71°` (a coordinate span with a compass phrase between the endpoints) |
| math-sign (class) | 8 | `UTC+7`, `+31`/`+599`, `"1+1"`, and five `=` that are all bilingual glosses or `E = mc²` |
| math-sign (accepted) | 1 | `ra-kèra ±335,28 km²` — the sentence already says "approximately"; trap 12's permissible drop |
| currency | 3 | `S$8 miliar`, `¥ 150.000`, `HK$ 490,3 miliar` — no Madurese name for any of the three |
| exponent | 1 | `E = mc²` — a bare-base power; `bareExponent` is not declared |

**`minus` STAYS RED, deliberately.** `plus`, `equals`, `less-than`, `greater-than` and `divide` went into
`ACCEPTED_SIGN_SILENCE` with their measurements, because in each case the sign is never arithmetic in this
corpus AND no Madurese word for it survives a sense check. `minus` did not: there are two genuine negatives
(`-1 mèter dpl`, and `0, 1, -1, 2, - 2, ...` in the integers article), omitting a minus INVERTS the value,
and the only candidate word — `korang` ×17 — is bound into a comparative PHRASE in every instance
(`korang lebbi` "more or less" ×13, `korang ḍâri` "less than" ×4), never a prefixed sign. That is the Fula
`hakkunde` failure: a real word whose part of speech does not fit the slot. So `review.ts --lang mad` ends
with `[FAIL] sign classes DROPPED: minus`, exactly as `ln` does, and that is the correct state (trap 24 —
do not fix the FAIL).

## Run 5 — 2026-08-11 (the gates, before and after)

```
                          BEFORE                          AFTER
tsc --noEmit              clean                           clean
vitest run                236 files pass                  237 files pass (3606 tests; +15 new)
referee-eval mad          33/35 (94.3%), symbol 98.9%     33/35 (94.3%), symbol 98.9%  — unchanged
corpus-diff (mined:mad)   DROP 98                         DROP 16     · 159/435 utterances changed (36.6%)
                          DIGIT 0 SLOT-GAP 0 RAWMARK 0    DIGIT 0 SLOT-GAP 0 RAWMARK 0 THROW 0
mine.ts scan              7 DROP classes, 98 lines        1 DROP line (the true negative) + 5 ACCEPTED
review.ts --lang mad      1 FAIL (no normalizer at all)   2 FAIL (sign classes: minus; artifact scan: it)
sources.ts --lang mad     percent/currency/times/&/exp    all five now `ok`; scale-names NONE → part
language-catalogue        mad normalization = (blank)     mad normalization = `done`
```

The referee is unchanged and must be: this layer never touches the word path.

**Read the sampled diff, not just the counts** (25 changes sampled at random from the 159):

```
- buwaləmɔ bɤdɤ atɔs bɤn əmpaʔ pɔlɔ bɤn pətːɔʔ . ənːəm atɔs …     447.682 people: "447, 682"
+ buwaləmɔ bɤdɤ atɔs bɤn əmpaʔ pɔlɔ bɤn pətːɔʔ ɛbu bɤn ənːəm …    → 447 thousand 682
- … bisa sampɛʔ əmpaʔ pɔlɔ cm .                                    the unit raw in the IPA
+ … bisa sampɛʔ əmpaʔ pɔlɔ sɛntimɛtəɾ .
- … lɛmaʔ pɔlɔ na .  ⟪DROP:percent⟫                                50%-na, the sign gone
+ … lɛmaʔ pɔlɔ pəɾsən na .
- … maɾija əmilija iɾmləɾ dɤɲː susantɔ …  ⟪DROP:ampersand⟫         a citation's `&`
+ … maɾija əmilija iɾmləɾ bɤn dɤɲː susantɔ …
- … lɛmaʔ pɔlɔ bɤn lɛmaʔ . lɛmaʔ z pətːɔʔ pɔlɔ bɤn sətːɔŋ cm       `55.5x71cm` — the ⟨x⟩ read as [z]
+ … lɛmaʔ pɔlɔ bɤn lɛmaʔ kɔma lɛmaʔ kalɛ pətːɔʔ pɔlɔ bɤn sətːɔŋ sɛntimɛtəɾ
- … duwɤ pɔlɔ bɤn əmpaʔ . nɔla m duwɤ ɛ atːasːa …                  `24.000m2` — "24, 0, m, two"
+ … duwɤ pɔlɔ bɤn əmpaʔ ɛbu mɛtəɾ pəɾsəɡi ɛ atːasːa …
```

**One regression-shaped change that is not one, and one that is a real residual.**

- `kol 17.30 – 21.00 WIB` now reads `kɔl 17 . 30 sampɛʔ 21 wip`. The `21.00` was claimed by the
  clock-marker arm and the dash by the range rule (correct: "from 17:30 to 21:00"); the `17.30` keeps its
  phrase break, which is the DECLARED refusal — no Madurese "minutes-past" construction is attested, so a
  real-minutes clock is left alone rather than read with a guessed connective. Both the clock rule and the
  decimal rule refuse it, and the decimal refusal is a guard I had to add: without it `kol 17.30` read
  *kol 17 koma 3 0*, a decimal inside a time.
- `87.017.41 km²` (a malformed 87,017.41 in the source) still carries two phrase breaks. The period arm
  refuses a following period on purpose — that is what keeps the two conventions apart — so this one is
  left rather than half-read.

**An adjacent defect this layer UNCOVERS and does not fix, counted rather than felt (trap 17).**
`numbers.ts` composes 0 … <10⁶ and falls back to DIGIT-BY-DIGIT above that, by its own documented design.
De-grouping newly hands it whole millions, so `2.150.000` went from three fragmented values with phrase
breaks (*duwɤ . sapɔlɔ bɤn lɛmaʔ …*) to one ordered digit run — better, and still not how the number is
said. **26 instances in the artifact's 437 lines**, all populations and areas. The words are in fact well
attested here (`juta` ×18 in the magnitude slot, `miliar` ×11), but this is the NUMBER PATH rather than
this layer, it has no referee to gate it, and it deserves its own corpus diff. Named, counted, left.

**A tool verdict contradicted by its own example (trap 41), recorded so nobody re-derives it.**
`attest.ts --lang mad --words "sampè'"` reports `0 token / 17 substring-only` — which reads as a negative —
while the examples it prints in the SAME run contain `ḍâri sobbhu sampe’ pokol 10:00` and
`sampe’ tengnga arè`. The word ends in the orthographic GLOTTAL `'`/`’`, and `tokens()` splits on
non-letters, so the boundary test cannot see it. `corpus-words.ts` scores it `attested ×14` on the same
language. Believe the example.
