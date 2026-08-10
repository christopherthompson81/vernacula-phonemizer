# Lingala (ln) text-normalization investigation

Chronological log of the normalization run. The corpus is `ln.wikipedia.org` — there is no FLEURS for
Lingala. Two text sources are used and they are NOT the same:

- `tools/corpus/mined/ln.jsonc` — the committed artifact, 15,486 segments, dump-sourced (an older dump).
- a **fresh** `lnwiki-latest-pages-articles.xml.bz2` (3.7 MB, dumped 2026-08-04) converted with
  `wikidump-to-text.py` and passed through `filter-markup.py` → **23,678 lines**. Every count below marked
  "corpus" is over this file. It is a scratch file; the artifact remains the committed evidence.

---

## Run 0 — 2026-08-10 — state of the language

`npx tsx tools/normalization/review.ts --lang ln` → `[FAIL] normalizer … missing`. No `normalize.ts`.
`sources.ts --lang ln` reports espeak **does not ship Lingala at all**, so the letter-name, decimal-point
and every sign class start with no espeak tier — corpus, referee (36 lines) and Wikipedia are all there is.

`mine.ts scan` over the artifact:

```
DROP percent ×26 · DROP degree ×14 · DROP math-sign ×13 · DROP exponent ×11
DROP currency ×10 · DROP minus ×7 · DROP ampersand ×7 · LEAK DIGIT ×2 · MARKUP math-sign ×1
```

Baseline emitted BEFORE any edit (playbook fan-out rule 2):
`corpus-diff.ts emit --lang ln --corpus mined:ln` → 411 utterances.

## Run 1 — 2026-08-10 — probing the engine on the attested forms

Question: what does the engine produce today? (Playbook step 2 — the defect list is what it *produces*.)
Selected results, all real corpus shapes:

```
21%            → túku míbalé na mǒkó                     the sign is SILENT
0,44 km²       → libungutúlu , túku mínei na mínei km    comma → PAUSE, km raw, ² gone
300.000 km2    → kámá mísáto . libungutúlu km míbalé     dot → SENTENCE BREAK; the ASCII 2 read as a NUMBER
5,500 bato     → mítáno , kámá mítáno bato               grouping comma → pause + wrong number
1 000 000      → mǒkó libungutúlu libungutúlu            space grouping → three numbers
4,20           → mínei , túku míbalé                     "four, twenty"
-22°C          → túku míbalé na míbalé k                 sign INVERTED away, C → raw [k]
1965-1975      → …libwá na túku mótóbá na mítáno ko̍to…   two numbers, no connective
2/3            → míbalé mísáto                           no fraction reading
b.n.b.         → b . n . b .                             three spurious clause breaks
1979 n. Y.K.   → … n . j . k .                           ditto
16ème          → zómi na motóbá e˩me˩                    raw suffix letters in the IPA
RDC / TB / FC  → ɾdk / tb / fk                           vowel-less clusters
$ / £ / €      → (nothing)                               silent
&              → (nothing)                               silent
```

Implication: essentially every non-word class is unread. This is a from-zero layer.

## Run 2 — 2026-08-10 — the number data, and a finding I am NOT acting on

Counting the manifest's own cardinal words against the corpus:

| manifest form | corpus count | corpus's form | count |
|---|---:|---|---:|
| `kámá` (100) | **0** | `nkámá` / `nkama` | 237 / 190 |
| `kóto` (1000) | **0** | `nkóto` / `nkoto` | 43 / 314 |
| `túkú` (tens) | **1** | `ntúkú` / `ntuku` | 627 / 341 |

The corpus writes the nasal-prefixed forms essentially always: `nkóto na nkámá libwá na ntúkú mísáto`
(1930). The bare forms do occur — `mobu koto na kama libwa na tuku minei na sambo` (1947) ×~8 — so both
are real, but the manifest ships the minority form as the only form.

**Not changed in this run, deliberately.** The manifest is authored from Meeuwis (2020) on prestige
Kinshasa and cites §3.6; the corpus is a French-influenced wiki. Changing it rewrites *every* number in
the language and needs its own before/after diff and its own sourcing argument — it is not a
normalization question, and this layer emits digits rather than words, so nothing here is built on top of
it. Recorded here so the measurement is re-runnable in one command.

## Run 3 — 2026-08-10 — the separator question, measured

Lingala's wiki writes **both** conventions. Over the corpus:

```
space-grouped   1 800 / 87 009        235
dot-grouped     1.180 / 24.383.301    136
comma-grouped   5,500 / 295,658        93
comma-decimal   4,20 / 1,6%           149   (1–2 digit tail)
dot-decimal     362.07 / 83.06%       133   (1–2 digit tail)
```

So the separator cannot be decided by convention; it is decided **structurally** — a 3-digit group is
grouping, a 1–2 or 4+ digit tail is a decimal. Reading every `\d{1,3}[.,]\d{3}` instance:

- dot: **136/136** are groupings (incl. Portuguese-text years `em 1.492`, which de-group correctly);
- comma: **91/93** are groupings. The **2** exceptions are atomic masses in the chemistry articles —
  `masi ya atomi ma yango ezalí 6,941` (lithium) and `10,811` (boron).

91-against-2 is the trap-28 shape: state both numbers rather than hide the cost. The rule de-groups.

## Run 4 — 2026-08-10 — sourcing, one word at a time

Everything the layer speaks had to come from somewhere. What was found, and what was refused:

**FOUND in the corpus.**

- **Range connective `kino`** — ×248 between two numbers, and every instance read is a genuine span:
  `na mibu 1600 kino 1850`, `mikolo 30 kino 180`, `10 kino 30% ya batu`. (`na` 82, `mpe` 73, `tii` 43 also
  occur; `kino` is the plurality and the least ambiguous.)
- **The metric table**, an explicit in-corpus definition keyed to the abbreviations:
  `1 mɛtɛlɛ (m) = 10 desimɛtɛlɛ (dm) = 100 sɛntimɛtɛlɛ (cm) = 1000 millimɛtɛlɛ (mm)` /
  `1000 mɛtɛlɛ = 1 kilómɛtɛlɛ (km)`. Running prose prefers the `-mɛtrɛ` spelling: `kilomɛtrɛ` ×57,
  `mɛtrɛ` ×24, `milimɛtrɛ` ×6, `kilogálame` ×6. `sɛntimɛtɛlɛ` exists only in the table (×1), which is
  exactly the slot the table is authoritative for.
- **Unit POSITION is unit-first**: `ntaka ya kilomɛtrɛ 15`, `mɛtrɛ 1 372`, `milimɛtɛlɛ 1 174`,
  `dolare 1 500 kino dolare 50 000`. The shared tier can only POSTPOSE (playbook §47 reason 2), so units
  are handled locally, as in Oromo.
- **The squared word is `kare`**, ×11, always suffixed to the unit noun with a hyphen:
  `kilomɛtrɛ-kare 79 906`, `mɛtrɛ-kare 17 000`, and once glossed against the imperial form
  (`kilomɛtrɛ-kare 600 (230 pieds carrés)`).
- **Era markers, from the text that spells them out beside the abbreviation.** All 7 `T.B.` instances are
  immediately preceded by the phrase itself: `Na mobu 1792 liboso ya ntango na biso. T.B., Hammurabi …`.
  So `T.B.` = *tango na biso* and `L.T.B.` (×2, same shape) = *liboso ya tango na biso* — BCE.
  `n. Y.K.` ×1 and `yambo Y.K.` ×1 give `Y.K.` = *Yézu Klísto* with `n.` = nsima (AD) / yambo (BC).
- **`b.n.b.` = `bôngó na bôngó`** — the abbreviation ×31, always closing a list; the expansion ×18, always
  in the same "and so on" slot (`… libóta mpé bôngó na bôngó`).
- **Currency `dolare`** ×16, sense checked: `dolare ya Amerika`, `dolare milio 1,8`, `dolare 1 500`. The
  Congolese franc is `falánga` ×11 but no `₣`/`FC` sign occurs adjacent to a number, so it is not declared.

**REFUSED, each with the check that refused it.**

- **A decimal-point word.** `virgule` is attested ×2 on ln.wikipedia — both hits are an **album title**
  ("Virgule" (2005), Extra Musica). No other candidate exists; `sources.ts` says no `_dpt`, no `_.`, no
  manifest word. So the fractional digits are read one at a time with **no** separator word, which is what
  `sources.ts` itself recommends for this case. A dropped point beats an invented one.
- **A minus word.** The one candidate the corpus offers is `molongola`, ×1, in
  `Eléktron ezalí na mokúmba ya molongola (negative "-")` — an ADJECTIVE describing a charge in a physics
  article, not what a reader says before a number. That is trap 37's register failure with the citation
  looking right. The corpus contains a handful of true negatives (`-273,15 °C`, `-22°C`, `-1,602 189`,
  `-4.800`; the artifact's exact six are enumerated in Run 6), so
  the sign stays silent and the refusal is recorded rather than papered over. ⚠ Omitting a minus INVERTS;
  this is a known-wrong-but-unsourceable class, not an acceptable drop.
- **A degree word.** `Celsius` ×3 and `kelvin` ×4 are attested; no Lingala word for *degree* is
  (`degré` ×1 is French). So `25 °C` reads *25 Celsius* — the scale name without the measure noun. The
  bare `°` of coordinates and angles (`4°16′S`, `90°`) has no reading at all and is left alone.
- **`=`, `×`, `<`, `>`.** `=` counts 89, but the wiki's `==` heading markers are inside that number and
  the corpus's own equalities are written out in words (`Falánga ya Swisi mókó ezalí 100 centimes`), so a
  reading would be built on a contaminated count. `×` ×22 is scientific notation and `4×4`. Declined.
- **Initialisms.** `core/initialisms.ts` exists and ~30 languages wire it, but it is a NO-OP without a
  `letterName` table, and espeak does not ship Lingala. This is the fleet's 94-language sourcing block,
  not a coding one. `RDC` → [ɾdk] stands, and is recorded rather than guessed at.
- **A clock rule.** 62 colon-numerals; the majority are SCRIPTURE references (`Mt 3:16`, `Malako 16:15-18`,
  `Kol 1:26`) and only a handful are true clocks (`ngonga ya 10:43`, `kobanda 19:00 ti 19:30`). Claiming
  the colon claims the references, and there is no attested Lingala reading for a digital time. Declined.

**SHIPPED ON THIN EVIDENCE, and flagged as such: the percent word.**

`%` occurs **274** times and the corpus never spells it out — except once. A Lingala constitutional text
writes both arms of a pair with the figure in parentheses:

> … zambi ya eteni ntuku minei **likolo ya mokama** (40%) mpo ya bingumba, mpé eteni ntuku motoba
> **likolo ya mokama** (60%) mpo ya Mbula Matari.

Forty *over the hundred* (40%), sixty *over the hundred* (60%) — the reading of the symbol, postposed
after the number, arithmetically correct in both arms, in native Lingala prose. `attest.ts` confirms the
phrase ×2 in 1 article and finds `pursa`/`pourcent` **absent**; `concept.ts` returns no ln label for
"percent" at all. This is one sentence. It is also the whole of the in-language evidence, and 274
instances currently say nothing, so it ships with the count stated at the rule.

## Run 5 — 2026-08-10 — writing and verifying

See `src/languages/lingala/normalize.ts` for the ordered rule list and the coupling comments.
Gates: `vitest`, `tsc --noEmit`, referee eval, corpus diff over `mined:ln`, `mine.ts scan`, `review.ts`.

Two rules were added *because of* gate output rather than before it, and both are recorded here because the
gate is what found them:

- **ISBN, digit by digit** (step 3). The corpus-diff DIGIT counter would not go to zero:
  `ISBN 9780829703962` is 13 digits, over the engine's `n < 1e12` guard, so it fell through to raw digits in
  the phoneme stream. The hyphenated ones were worse in a quieter way — `ISBN 1-59427-034-1` read as four
  cardinals ("one, fifty-nine thousand four hundred twenty-seven, …"). Five ISBNs in the artifact; all five
  now spell out. **DIGIT 2 → 0.**
- **A percent-to-percent span** (step 7). `mine.ts scan` reported `DROP minus ×7`, and reading the seven
  showed that two of them were not minuses at all: `20%-40%` and `7.5%-10%`, both in one sentence, where the
  dash means *to*. RANGE cannot reach them (its lookbehind refuses a `.`-preceded digit, its lookahead
  refuses `%` — both deliberate), so they got their own arm. It costs no new word: `kino` either side, each
  operand keeping its `%` for step 8. ×2 instances, stated at the rule. **minus 7 → 6.**

### Gate results

```
tsc --noEmit                       clean
vitest run                         233 files, 3326 tests, all pass  (15 in test/lingala.test.ts)
referee-eval ln                    34 words · folded backbone 33/34 (97.1%) · symbol accuracy 99.4%
                                   1 residual (mb: ᵐb ≠ ⁿb) — a transcription-convention difference in the
                                   referee, unchanged by this layer, which touches no word in that set
corpus-diff mined:ln               changed 108/411 (26.3%)
                                   DIGIT   2 → 0
                                   DROP   75 → 34
                                   SLOT-GAP 0 → 0 · RAWMARK 0 → 0 · THROW 0 → 0
mine.ts scan                       DROP minus ×6
                                   ACCEPTED-CLASS math-sign ×14
                                   ACCEPTED degree ×11 · exponent ×5 · currency ×4 · percent ×1
review.ts --lang ln                9 ok, 1 FAIL (artifact scan — the six minuses, deliberately)
```

All 108 changed utterances were read individually. The two that only lose a comma are `(+ 1,3 m/s)`, a
French decimal, and `(cf. Mt 11,5)`, a continental scripture reference — neither a regression.

## Run 6 — 2026-08-10 — the residual, and why one gate stays red

`review.ts` ends at 9 ok / 1 FAIL, and the FAIL is the intended state of the language rather than unfinished
work. Enumerating the whole residual by instance (the artifact's 416 lines, each class's `DROPPABLE` regex
run over the lines `dropsIn` flags):

**Accepted per instance** — added to `ACCEPTED_SILENT` in `tools/normalization/defects.ts`, by instance and
never by class, so a regression in the shapes that ARE read stays visible:

| class | ×  | what they actually are |
|---|---:|---|
| degree | 11 | the bare `°` doing three jobs one character should not: coordinates (`4°16′S`, `04°48′S`, `4.800°S`), geometry angles (`180°`, `90°` ×3), and the **French numero sign** (`Mobéko n°011/2002`, `n° 33-34`, `n° 68-70`). Only `°C` has a Lingala word behind it (the scale name), and that one is read. |
| exponent | 5 | scientific notation (`10⁻¹⁹`, `10⁻³¹`, `10⁻²⁷` — electron charge, electron mass, neutron mass), the continental **edition** convention in a reference list (`2007³`, `2007²`), and `m³/s`, a river discharge the shared unit tier can compose only halfway. Unit exponents (`km²` → `kilomɛtrɛ-kare`) are read. |
| currency | 4 | the sign is **named in its own sentence** every time: `Bozitó Sterling (…, £)`, `Euro (€)` — definitional glosses; `badollar 45$` — the dollar named right before the figure, which is exactly what step 9's `NAMED` lookbehind suppresses; and `ndako na €1` inside a French passage. |
| percent | 1 | `local zehner = (zahl - zahl % 10 ) / 10;` — **Lua module source** quoted into the wiki. That `%` is modulo. |

**Not accepted, deliberately** — `minus` ×6, and there is no `ln.minus` key. All six are genuine negatives:
two negative latitudes (`-4.2667`, `-4.800`), the electron charge (`-1,602 189`), absolute zero
(`-273,15 °C`), and two BCE years (`mobú -753`, `mobú -3300`). Run 4 established that the only candidate word
the corpus offers, `molongola`, is an adjective describing a charge and not what a reader says before a
number. Omitting a plus is lossless; omitting a minus **inverts**. Accepting this would convert a
known-wrong reading into a green checkmark, so the gate stays red and points at the real defect. It comes
off the day a Lingala negative-number word is attested, not before.

Note that `ACCEPTED_SIGN_SILENCE` (per CLASS, read by `coverage.ts`) and `ACCEPTED_SILENT` (per INSTANCE,
read by `mine.ts scan`) are different tables answering different questions — the `ln` class-level entry
written in Run 5 clears `math-sign` in the scan output as `ACCEPTED-CLASS ×14` but cannot speak for the
five classes above, which needed the instance list.
