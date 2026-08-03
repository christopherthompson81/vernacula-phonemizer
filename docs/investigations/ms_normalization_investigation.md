# Standard Malay (zsm) text normalization — investigation log (#562)

`zsm` is an ALIAS: `registry.ts` returned `createIndonesian()` as a labelled approximation, so Malay
inherited Indonesian's `normalize.ts` and Indonesian's symbol tier. This log measures where that
inheritance is right (most of it) and where the two standards' ORTHOGRAPHIC conventions actually diverge.

Corpus: FLEURS `ms_my`, column 3 (cased), 1,908 unique utterances. Artifact: `tools/corpus/mined/ms.jsonc`
(23/30 cells covered). Indonesian's corpus `id_id` is the no-regression control.

---

## Run 1 — 2026-08-02, baselines before any edit

```
npx tsx tools/normalization/corpus-diff.ts emit --lang zsm --corpus ms_my --out /tmp/ms.before  → 1908
npx tsx tools/normalization/corpus-diff.ts emit --lang id  --corpus id_id --out /tmp/id.before  → 1936
```

Question: is the separator inversion the whole story, or only the visible part?

## Run 2 — tabulation of what `ms_my` writes

| shape | count | note |
|---|---|---|
| comma-thousands `1,400` `¥130,000` `5,000,000` | 39 (35 utterances) | the ENGLISH convention — Indonesian's is the dot |
| dot-decimals `3.7 juta` `14.7` `3.50 m` `6.34 inci` | ~19 | the ENGLISH convention — Indonesian's is the comma |
| dot-thousands `9.000 orang` | 1 | an Indonesian-convention leak in one translated sentence |
| clocks, dot `06.30` `07.30` `12.00` `1.15` `10.08` `15.00` | 6 | all carry `pukul` or a zone marker |
| clocks, colon `07:19` `09:19` `9:30` `11:35` `11:20` `10:00` `8:30` `11:00`×2 `11:29` `8:46` | 10 | ditto |
| colon NOT a clock `21:20` `3:2` `2:2` | 3 | rugby score, aspect ratio, UK degree class |
| `%` | 4 | and `peratus` ×15 spelled out, `persen` ×0 |
| hyphen ranges | 15 | 4 year pairs, 6 quantity+noun, 4 sports scores, 1 mangled clock |
| `SM` after a year (`323 SM`) | 4 | `sebelum Masihi` ×3 / `Tahun Masihi` ×2 spelled out |
| dotted `Dr.` ×4 `dsb.` ×2 `dll.` ×1 `En.` ×1 `No.` ×1, `A.S.` ×8 | 17 | |
| rate `160km/j` `165 km/j` `batu/jam` `600Mbit/s` (`ela/meter` ×2 = an alternation, not a rate) | 6 | `sejam` ×4, `sesaat` ×2 spelled out |
| exponent `3,850 km²` `19,500km²` | 2 | `persegi` ×1 spelled out |
| `2.4Ghz` `5.0Ghz` | 2 | |
| degrees `90°F` `35°W` | 2 | `darjah` ×3, one of them the angular sense ("beberapa darjah di utara khatulistiwa") |
| `&amp;` ×2, `B&B` ×1 | 3 | |
| currency `¥2,500` `¥130,000` `¥7,000` `$2.3` `$1000` `US$30` `$10` `US $14.7` `£ 27` | 9 | |
| `ke-N` ordinals | 20 | already correct (`ke` + cardinal) |
| dates `21 Mac`, `15 Ogos 1940`, … | ~40 | already correct — the corpus SPELLS the Malay month names (Mac, Julai, Ogos, Disember) |

## Run 3 — probing the current (Indonesian-inherited) engine on every attested form

Verbatim, `phonemize(form, "zsm")` at aba9257:

```
"1,400 orang"                → sˈatu kˈoma əmpˈat nˈol nˈol ˈoraŋ        # "one point four zero zero"
"¥2,500 dan ¥130,000"        → dˈua kˈoma lˈima nˈol nˈol jˈen dˈan sərˈatus tˈiɡa pˈuluh kˈoma nˈol nˈol nˈol jˈen
"5,000,000 ringgit"          → lˈima kˈoma nˈol nˈol nˈol , nˈol rˈiŋɡit   # digits LOST + a bogus pause
"populasi hampir 3.7 juta"   → … tˈiɡa . tˈud͡ʒuh d͡ʒˈuta                   # decimal read as a clause PAUSE
"selebar 3.50 m"             → sələbˈar tˈiɡa lewˈat lˈima pˈuluh mɛtˈər  # decimal claimed as a CLOCK
"6.34 inci"                  → ənˈam lewˈat tˈiɡa pˈuluh əmpˈat ˈint͡ʃi   # ditto
"21:20, yang mengakhiri"     → dˈua pˈuluh sˈatu lewˈat dˈua pˈuluh , …   # a rugby SCORE read as a clock
"dikatakan 3:2."             → tˈiɡa , dˈua .                             # colon → a clause pause
"antara pukul 06.30 dan 07.30" → … pˈukul ənˈam lewˈat tˈiɡa pˈuluh dˈan tˈud͡ʒuh lewˈat …
"menyumbang 80% daripada"    → … dəlˈapan pˈuluh pərsˈɛn daripˈada       # persen, not peratus
"pukul 1.15 a.m. hari"       → pˈukul sˈatu lewˈat lˈima bəlˈas ˈa . m . hˈari
"pukul 10.08 p.m. pada"      → … səpˈuluh lewˈat dəlˈapan p . m . pˈada
"pada 07:19 waktu tempatan pg" → … tˈud͡ʒuh lewˈat səmbˈilan bəlˈas wˈaʔtu təmpˈatan pɡ
"dengan 802.11a, 802.11b"    → … dəlˈapan rˈatus dˈua . səbəlˈas ˈa , …  # version dot → pause
"2.2 juta km2"               → dˈua . dˈua d͡ʒˈuta ʔm dˈua                # km2 → "ʔm dua"
"3,850 km²"                  → tˈiɡa kˈoma dəlˈapan lˈima nˈol ʔm        # ² dropped, k → ʔ
"frekuensi 2.4Ghz"           → … dˈua . əmpˈat ɣz                        # "ɣz"
"600Mbit/s"                  → ənˈam rˈatus mbˈit s
"melebihi 160km/j"           → … sərˈatus ənˈam pˈuluh kilomətˈər pˈɛr d͡ʒˈam   # Indonesian rate idiom
"sering 100-200 batu/jam"    → … sərˈatus dˈua rˈatus bˈatu d͡ʒˈam        # slash dropped
"suhu panas 90°F."           → … səmbˈilan pˈuluh dərˈad͡ʒat fahrənhəˈit  # derajat, not darjah
"sebelah timur 35°W."        → … tˈiɡa pˈuluh lˈima dərˈad͡ʒatw           # glued garbage
"pada 323 SM."               → … tˈiɡa rˈatus dˈua pˈuluh tˈiɡa ɛsɛm
"Dr. Damadian"               → dˈoʔtər damadˈian                         # dokter, not doktor
"angkasawan No. 11"          → aŋkasˈawan nˈomor səbəlˈas                # nomor, not nombor
"Keputusan En. Rudd untuk"   → kəputˈusan ˈɛn . rˈudd ˈuntuʔ
"Presiden A.S. mengatakan"   → presˈidɛn ˈa . s . məŋatˈakan             # two bogus pauses
"Seni &amp; Sains"           → sənˈi sˈains                              # & DROPPED
"yuran sebanyak US$30"       → … uɛs tˈiɡa pˈuluh ,                      # $ swallowed when glued to US
"selama 2-5 hari"            → səlˈama dˈua lˈima hˈari                  # range joiner absent
"Antara 10: 00-11: 00 pm MDT" → antˈara səpˈuluh , nˈol səbəlˈas , nˈol pm ɛmdete
```

Already correct and inherited untouched: `9.000` → *sembilan ribu* (the Indonesian tokenizer's dot-thousands
class), `ke-190` → *kə seratus sembilan puluh*, `$1000` → *seribu dolar*, `£ 27` → *dua puluh tujuh pound*,
`dsb.` → *dan sebagainya*, `dll.` → *dan lain lain*, every date (the corpus spells the Malay month names),
`<i>`/`<sup>` markup (already stripped upstream).

## Run 4 — sourcing every word the layer would emit

| word | source |
|---|---|
| `peratus` | ms corpus ×15 (`90 peratus daripada`, `29 peratus`, `3 hingga 5 peratus`); `persen` ×0 |
| `perpuluhan` | espeak-ng `dictsource/ms_list:70` — `_dpt  _p'@rpul'uhan_`, i.e. the DECIMAL POINT entry. Round-tripped through this repo's g2p (§5c): `phonemize("perpuluhan","zsm")` = `pərpulˈuhan`, byte-identical to espeak's mnemonic |
| `hingga` | ms corpus ×23, used as the infix between two quantities (`3 hingga 5 peratus`) — POS checked (Fula lesson) |
| `sebelum Masihi` | ms corpus ×3 spelled out (`abad ke-10 sebelum Masihi`, `10,000 tahun sebelum Masihi`) |
| `sejam` / `sesaat` | ms corpus ×4 / ×2 (`105 batu sejam`, `1.5 kilometer sesaat`) — the Malay rate idiom is the `se-` prefix, not Indonesian's `per` |
| `darjah` | ms corpus ×3, incl. the angular sense `beberapa darjah di utara khatulistiwa`; espeak has no entry |
| `persegi` | ms corpus ×1 (`kilometer persegi`) |
| `utara/selatan/timur/barat` | ms corpus ×44/37/25/21 |
| `pagi/petang/malam/tengah malam` | ms corpus ×9/×4/×27/×1 (`tepat jam dua belas tengah malam`) |
| `tengah hari` | NOT in the corpus. Composed from `tengah` ×9 + `hari` ×many on the model of the attested `tengah malam` (sourced arithmetic, §"Compose from attested pieces"). Zero corpus instances (12 p.m. never occurs) — it exists only so the adversarial neighbour is not wrong |
| `titik` | ms corpus ×3, the noun "dot/point" (`titik hubungan`, `antara dua titik`) — the Malay name of the full stop |
| `doktor` / `nombor` / `Encik` | ms corpus ×1 / ×11 / ×1 (`kata Encik Costello`); espeak `ms_list:493 doktor` |
| `dan` (for `&`) | ms corpus ×874 |
| `gigahertz` / `megabit` | UNSOURCED in every in-repo source. Unit borrowings, which §5e excludes from the sourcing check by measurement (kilogram/millimetre are absent in ~30 languages and correct). Stated rather than hidden |

**`£` deliberately NOT changed.** Malay `paun` ×3 in this corpus is the WEIGHT pound (`17 paun 1 auns`,
`200 paun (90kg)`); the CURRENCY is written `pound` ×2 (`pound Falkland`, `pound British`). Indonesian's
tier already says `pound`, so it is right for Malay too. Checking the word without checking its SENSE would
have produced a confidently wrong currency name.

## Run 5 — what was deliberately NOT duplicated from Indonesian

The alias is right about far more than it is wrong about, and a Malay layer that re-states Indonesian for no
measured reason is worse than the alias (playbook, "duplication is evidence, not yet a reason"):

- **Units** (`km cm mm kg m g l ha`) — identical spellings in both standards; the shared tier stays.
- **Currency** (`$ € £ ¥` → dolar, euro, pound, yen) — see above; the corpus attests `pound`, and `dolar`
  ×3. Only the GLUED `US$30` needed anything, and what it needed was a space.
- **`dsb.` / `dll.`** — already the Malay wording. Only `Dr.`/`No.`/`En.` diverge.
- **Ordinals** — `ke-N` is `ke` + cardinal in both standards; the engine is already right.
- **Dates** — the corpus writes Malay month names as WORDS (Mac ×8, Julai ×8, Ogos ×8, Disember ×1). A
  normalization rule would have nothing to do; no month name is ever emitted by this layer.
- **Dot-thousands `9.000`** — one instance, an Indonesian-convention leak in a translated sentence. The
  Indonesian tokenizer already reads it as *sembilan ribu*; the Malay decimal rule EXCLUDES `\d{1,3}.\d{3}`
  so that reading survives. Malay's own convention would write `9,000`, which rule 2 handles.
- **Number WORDS.** espeak's `ms_list` shows real lexical divergence — `_0 k'osoN` (kosong, not *nol*) and
  `_8 l'apan` (lapan, not *delapan*) — and the corpus's readings inherit Indonesian's *nol* and *delapan*.
  That is a MANIFEST/engine fact, not a text→text one; fixing it means a Malay manifest and number table,
  it would change hundreds of readings, and there is no Malay referee to gate it. Recorded here as the
  single largest remaining Malay-vs-Indonesian delta, deliberately out of this layer's scope.
- **Roman numerals / regnal ordinals** — `Elizabeth II` arrives from the registry seam as `Elizabeth 2` and
  reads *dua* where Malay says *Kedua*. 4 instances, same in Indonesian, and the guard shape that gets it
  right is exactly the misfire generator trap 9 warns about. Left alone.
- **`ela/meter` ×2** — a slash ALTERNATION ("keep 100 yards/metres away"), not a rate. No word is sourced
  for it; the rate table is a closed list so it cannot be claimed by accident.
- **`N:M` where nothing marks a clock** (score 21:20, ratio 3:2, degree class 2:2) — three instances, three
  different senses, and no single Malay word fits all three (`kepada` is right for the ratio and wrong for
  the degree class). The mark is left UNREAD (rule 12 just removes the spurious pause), because a wrong
  word is worse than a dropped sign.
- **A single mid-name initial (`George W. Bush`)** — dropping that period would also drop a real
  sentence-final pause after a trailing initialism letter. 1 instance, left alone.
- **`AD 1000 -1300`** — 1 instance, prefixed, where the corpus's own idiom is postfixed (`400 Tahun
  Masihi`). Reordering it is a rewrite, not a reading; left as letter names.

## Run 6 — first implementation, and the five defects the probe pass found in it

Probing my own rules before the corpus diff (the cheap half of trap 13 — diff the rule against itself):

1. `antara pukul 06.30 dan 07.30` — only the FIRST clock was claimed. The `pukul` window is bounded by
   `[^.!?]`, and the first clock's own DOT closes it for the second. Fix: repeat the clock pass to a fixed
   point; once pass 1 has written `pukul 6 30 dan 07.30` the dot is gone and pass 2 claims the second.
2. `80% peratus` (the trap-12 neighbour) read *lapan puluh persen peratus* — declining to rewrite the sign
   left it for the inherited tier, which said it in Indonesian. Fix: DELETE the sign in that case.
3. `sejak 1995-1996, apabila` did not join, because the year arm's trailing guard was `(?![\d.,])` and the
   corpus's commonest year range ends on a clause comma.
4. `dikatakan 3:2.` kept its bogus pause for the same reason — a trailing sentence period was excluded.
5. `$2.3 bilion` regressed to *dua DOLAR perpuluhan tiga bilion*: splitting the number left the shared tier
   only the integer part, so the currency word landed inside the number. Fix, and the reason this layer
   still declares no currency name: the tier reads a POSTFIX sign too (`2 perpuluhan 3 $ bilion` →
   *dua perpuluhan tiga dolar bilion*), so the rule just moves the sign behind the amount.

And two the mechanical review found:

6. `equals`, `less-than`, `times` were DROPPED sign classes (they are in Indonesian too). Zero corpus
   instances, which is not evidence of correctness — and the corpus supplies every word itself, including
   the multiplication infix: `format 6 kali 6 sm`, `negatif 56 kali 56 mm`, `sama dengan` ×11,
   `kurang daripada` ×3, `lebih daripada` ×11. Claimed only between DIGITS, because this corpus's text
   still carries `<i>`/`<sup>` tags and a bare `<` rule would eat them.
7. `21:00` read *dua puluh satu nol*: rule 12's colon-drop is right for a score but adds a spoken zero to an
   unmarked clock. An `H:00` on the COLON only (never a decimal point) now reads as the bare hour.

## Run 7 — implementation and the gates

`src/languages/malay/normalize.ts` (15 ordered steps) + `src/languages/malay/malay.ts`, which is a
PRE-PASS wrapper around `createIndonesian()`: `id.text(normalizeMalay(input))`. Nothing in
`src/languages/indonesian/` is touched, which is what makes the id no-regression proof structural rather
than empirical. `registry.ts`: `case "zsm": return createMalay();` — one line, plus its import.

Gate results, all from this worktree:

```
npx tsc --noEmit                                              → clean
npx vitest run                                                → 201 files, 2686 tests, 0 failed
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/ms.jsonc --lang zsm
                                                              → scanned 135 lines, NO DEFECTS
npx tsx tools/normalization/review.ts --lang zsm              → sign classes: none dropped; normalizer,
                                                                wiring, tests, spelling→g2p all ok
                                                                (one FAIL is a NAME mismatch — see below)
npx tsx tools/referee-eval/eval.ts zsm                        → no zsm referee exists (not in eval's list)
npx tsx tools/referee-eval/eval.ts id                         → 17639/18590 folded (94.9%), symbol acc
                                                                98.9%, secondary 25/25 — UNCHANGED
corpus-diff ms_my   before→after                              → 105/1908 changed (5.5%)
                                                                DIGIT 0 / SLOT-GAP 0 / RAWMARK 0 / DROP 0
corpus-diff id_id   before→after                              → 0/1936 changed
                                                                (counters identical: RAWMARK 2, DROP 19,
                                                                both pre-existing Indonesian issues)
```

The id figure is 0 by construction and confirmed by measurement: the Malay rules live in a file the
Indonesian engine never imports.

**The one remaining review FAIL is a naming mismatch, not a missing artifact.** `review.ts` looks for
`tools/corpus/mined/<lang>.jsonc`, i.e. `zsm.jsonc`, while the artifact was mined and committed under the
code the miner used — `ms.jsonc`, with `"language": "ms"` inside it, and it IS tracked
(`git ls-files tools/corpus/mined/ms.jsonc`). The documented gate over it,
`mine.ts scan --in tools/corpus/mined/ms.jsonc --lang zsm`, passes with no defects. Teaching the lookup
about the ms/zsm pair is a `tools/` change, which the fan-out rules say to report rather than make: the
same `SISTER_STANDARDS` table review.ts already carries (`["id","zsm","ms"]`) is where the alias belongs.

**The `[??] sourcing` line is inert for this language, so it was done by hand** (Run 4 above). The check
reads the words out of a `makeSymbolNormalizer({…})` declaration and the language's manifest; Malay has
neither, deliberately — its percent word is emitted as TEXT by rule 4 and its currency vocabulary stays
with the Indonesian tier. Every word this layer can emit is listed in Run 4 with its source; the only two
that no in-repo source attests are `gigahertz` and `megabit`, which are the unit-borrowing class §5e
excludes by measurement.

### Every one of the 105 ms changes, read and classified

Read in full (word-level diff of before/after). No change falls outside these classes:

| class | count | example |
|---|---|---|
| comma-thousands read as one number | 39 | `1,400 orang`: *satu koma empat nol nol* → *seribu empat ratus* |
| dot-decimal read as a decimal, not a pause | 17 | `3.7 juta`: *tiga . tujuh* → *tiga perpuluhan tujuh* |
| dot-decimal no longer claimed as a clock | 2 | `3.50 m`: *tiga lewat lima puluh* → *tiga perpuluhan lima nol* |
| clock loses Indonesian `lewat` | 15 | `pukul 8:46 pagi`: *lapan lewat empat puluh enam* → *lapan empat puluh enam* |
| meridiem → part of the day | 4 | `11:35 pm`: *pm* → *malam*; `1.15 a.m.`: *ˈa . m .* → *pagi*; `pg` → *pagi* |
| `%` → peratus | 4 | |
| range takes `hingga` | 11 | incl. `AD 1000 -1300`, which read *minus* — the inherited sign rule saw ` -1300` |
| `SM` → sebelum Masihi | 4 | |
| `A.S.` loses two phrase breaks | 8 | *ˈa . s .* → *aɛs* (clause-final dot kept) |
| `Dr./No./En.` in Malay | 6 | *dokter/nomor/ˈɛn .* → *doktor/nombor/Encik* |
| `&` no longer vanishes | 3 | `Seni &amp; Sains`, `B&B` |
| rate / exponent / frequency / degrees | 8 | `km/j` → *sejam*; `km²` → *kilometer persegi*; `Ghz` → *gigahertz*; `°F` → *darjah*; `35°W` → *darjah barat*; `bsj`/`kmj` |
| version dot → `titik` (and `11g` no longer *gram*) | 3 | `802.11a/b/g/n` |
| colon that is not a clock loses its pause | 3 | rugby 21:20 (also no longer a clock), ratio 3:2, degree class 2:2 |
| currency sign no longer swallowed / misplaced | 3 | `US$30` gains *dolar*; `$2.3 bilion` keeps it outside the number |

(Utterances carrying more than one class are counted once per class, which is why the column sums above the
105 changed utterances.)

### Adversarial neighbours probed (trap 8 / trap 13)

Branches with ZERO corpus instances, pinned anyway: the `12 p.m.` → *tengah hari* and `12 a.m.` →
*tengah malam* arms of the meridiem table (the corpus only has 1 a.m., 8/10/11 p.m.); the `1–6 p.m.` →
*petang* arm; the year-pair arm of the range rule vs. its measure-word arm; `°C` and bare `°`; `m²`;
`km/s`, `m/s`; a fraction with three digits after the point (`3.141`, decimal) vs a 3-digit group
(`9.000`, thousands); a percent already followed by its own word (`80% peratus` — the sign is dropped, the
word said once, trap 12); `8 p.m.` with no minutes; `$1.00` (a decimal price, NOT a one-o'clock);
`4:41.30` (a sports time, not a clock); a sentence-final `A.S.` (keeps its pause) against a mid-sentence
one (loses both); `12,5` (an Indonesian-convention decimal comma still reads *dua belas koma lima* — this
layer does not claim it, because in the Malay convention a lone `,5` is not a group and guessing between
the two would be worse than reading the inherited one).

Not fixed and known: `5 000` (space-thousands) reads *lima nol*; the corpus never writes it, and it is a
shared-tokenizer question rather than a Malay one. `ela/meter` keeps its unread slash. `Elizabeth II`
reads *dua*, not *Kedua*.
