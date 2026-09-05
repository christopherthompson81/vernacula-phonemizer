# Chuvash (chv) normalization — investigation log

Picked as the **far end of the Turkic branch**. The last two rounds were Bashkir and Tatar, both Kipchak;
Chuvash is the sole surviving **Oghur** language, the branch that split first, and it is the one place where
"Turkic ordinal morphology" can be tested against a genuinely distant relative instead of a near twin
(trap 55). It also appeared in the tt round's own fleet measurement as a corpus containing `м³/с` that
still dropped the denominator — a defect already on the books before this round started.

`tools/corpus/mined/chv.jsonc` — cv.wikipedia dump, 232,373 paragraph segments, 32/35 cells.

## Run 1 — 2026-08-16 — the language is written in the WRONG CODEPOINTS, and that is the whole story

Counting the four Chuvash-specific letters over the retained text, by codepoint:

| letter | LATIN twin | ×    | CYRILLIC (correct) | ×   |
|---|---|---|---|---|
| ă / ӑ | U+0103 | **1,886** | U+04D1 | 314 |
| ĕ / ӗ | U+0115 | **1,857** | U+04D7 | 418 |
| ç / ҫ | U+00E7 | **1,164** | U+04AB | 174 |
| ü / ӳ | U+00FC | 4 | U+04F3 | — |
| caps  |        | 25 | | 12 |
| **total** | | **4,936** | | **918** |

**Raw finding** — cv.wikipedia is written predominantly with the **Latin** look-alikes. 315 of 454 retained
segments use them; 68 use the real letters; **28 use both in the same segment**. The ratio is 5.4:1 the
wrong way.

**Implication** Every Cyrillic engine in this repo tokenizes on the block range `[Ѐ-ӿ]`, so a Latin letter
inside a Chuvash word does not merely mispronounce — it **splits the word** and hands the stray letter to
the foreign reader as an English letter name. Measured on the engine before any change:

```
"вăтам"     → ʋ ˈə ˈtam          vs   "вӑтам"     → ʋəˈdam
"Чăваш"     → t͡ɕ ˈə ˈʋaʂ         vs   "Чӑваш"     → t͡ɕəˈʋaʂ
"пĕрремĕш"  → p ˈiː ˈrːem ˈiː ʂ   vs   "пӗрремӗш"  → pɘˈrːemɘʂ
"çĕр"       → sˈɛp                vs   "ҫӗр"       → ˈɕɘr        ← English "sep"
"ĕмĕр"      → ˈiː m ˈɛp
```

**3,424 words** in this one artifact carry the defect. Nothing is dropped and no raw character survives, so
neither the leak gate nor `DROP` could see any of it — the same blindness `foldCyrillicConfusables` was
written for, and `chv` was already in `CYRILLIC_HOSTS`. The fold's map simply had no rows for these four.

## Run 2 — 2026-08-16 — the fold is safe fleet-wide, and the majority rule is not enough

Two things had to be measured before touching a shared table.

**Is it safe to add ⟨ç ü⟩, which are ordinary letters in Turkish, French and German?** Over all 15
`CYRILLIC_HOSTS` artifacts, a *Cyrillic-majority* word containing one of the four Latin twins occurs
**3,356 times in chv and once anywhere else** (ba `арăм`, itself the same typo). The genuinely foreign
words in the chv corpus — `für`, `München`, `göğsüm`, `ÜMUMİ`, `Qıçıtqanlı` — are all-Latin, so the
existing majority guard already refuses them. **Five foreign words against 3,424 Chuvash ones.**

**And the majority rule refuses the commonest Chuvash words.** `çĕр` is ç(Lat) + ĕ(Lat) + р(Cyr) — two
Latin against one Cyrillic, so `lat > cyr` and the fold declines. Measuring the words the majority rule
refuses but a *presence* test would fold: **76 in chv** — `ăшă` (warm), `çĕр`, `çĕнĕ` (new), `виççĕ`
(three), `Кĕçĕн` — against **one** anywhere else (tt `kübrәk`, already broken either way).

**Implication** The four Chuvash rows are applied on PRESENCE and the ASCII rows keep their MAJORITY test,
and the asymmetry is principled rather than convenient: an ASCII look-alike **is a real letter of the Latin
alphabet**, so a word carrying several of them may genuinely be a Latin word and the majority test is what
protects it. ⟨ă ĕ ç ü⟩ standing beside a Cyrillic letter cannot be a Latin word. After the change `çĕр` and
`ҫӗр` phonemize identically, and the full suite is unchanged at 4,511 passing.

## Run 3 — 2026-08-16 — the attributive numeral: the data was already there and nothing called it

`src/languages/chuvash/numbers.ts` documents, sources and implements Chuvash's **two numeral series** —
FULL/substantival (пӗрре, иккӗ, виҫҫӗ, пиллӗк) for counting, SHORT/attributive (пӗр, ик, виҫ, пилӗк) before
the thing counted — and its `numberToWords(n, attr)` already takes the flag. **The engine never passes it.**

```
"5 км"     → ˈpilːɘk km      пиллӗк, the counting form, before a noun
"1 км"     → pɘˈrːe km       пӗрре, likewise
```

Chuvash wants *пилӗк километр* and *пӗр километр*. This is the playbook's one allowed exception in its
canonical shape — except that the research is already done and committed, so all that is missing is the
context. A final text→text pass composed AFTER the symbol tier (so the unit is already a word) spells a
digit run that is immediately followed by a Chuvash word using the attributive series, and leaves a digit
run standing alone to the engine's substantival path.

## Run 4 — 2026-08-16 — degrees, and the same class answering the opposite way two rounds running

⚠ **EVERY ONE OF THIS CORPUS'S 33 DEGREE SIGNS IS A TEMPERATURE**, and they are the climate paragraphs of
district articles: `−19 °C пуҫласа −4 °C таран`, `+26 °C`, `-13°С`, `+18,7°С`, `-44 °C`, `-42 °С`, `+20°с`.
Two rounds ago Tatar's ten were **all angular** and the Celsius branch shipped as declared insurance; here
the angular reading has no instance at all and Celsius carries the entire class. Same cell, same family,
opposite answer — which is the argument for reading the instances every time rather than porting the rule.

⚠ **And the scale letter is written three ways** — Latin ⟨C⟩, Cyrillic ⟨С⟩ and lowercase Cyrillic ⟨с⟩
(`+20°с`) — which render identically. A branch carrying only the Latin one would leave two thirds of the
class to `core/foreign.ts` and the English letter name.

⚠ **The sign is on BOTH sides of the number and in both encodings**: `−19` (U+2212) and `-13` (hyphen),
`+19` and `+ 37°С` (spaced). `signed-number` is 1,576 corpus-wide.

## Run 5 — 2026-08-16 — the fraction is real here, and the guard that makes it safe

Chuvash writes a fraction and this corpus proves the reading in its own prose:

> Республикăра 1299.3 пин çын пурăннă, вĕсенчен **виççĕ тăваттăмĕш пайĕ (71,8%)** …

— "three fourth-part of them", the numerator in the FULL series, the denominator as an ordinal, and the
noun `пай` written out. The slash instances line up with it: `4/5 пайĕ`, `1/3 пайĕ`, `1/2 пайĕн`.

⚠ **And six of the nine slashes are not fractions**: `3/14` (a Pi-day date), `1608/09 çулхи` (a year span),
`1/15 çурт` and `57/1 ҫурт` (street addresses), `№ 5 / 2002` (a citation). A rule requiring
**numerator < denominator ≤ 12 AND the noun `пай` following** takes all three real ones and refuses all six
others — and the `пай` requirement is not a guess, it is the shape every attested instance has.

## Run 6 — 2026-08-16 — the `=` is not an equation, for the third time in three rounds

Printing all 14 of this corpus's `=`:

```
Халăх шкулĕ = Народная школа                              ×4   a bilingual parallel title
Tšuvassilais-suomalainen sanakirja = Чăвашла-финла словарь
Reverse dictionary of Chuvash. = Обратный словарь чувашского языка
Энциклопедия Комсомольского района = Комсомольски районӗн энциклопедийӗ
Текстология Ветхого Завета = Textual Criticism of the Hebrew Bible          … 10 in all
\mathbf{r}=\mathbf{r}(u,v)  ·  \pi = 3,1415926…                             raw LaTeX
1 мм²=0,000 001 м²  ·  1 километр = 1000 метр = 0,621 милĕ                  ← the real ones
```

**Ten of fourteen are the ISBD parallel-title mark** of a library catalogue entry. gd's `=` was wiki
heading markers, tt's was etymology and translation glosses, and this is a third distinct non-equation
sense of the same character in three consecutive rounds.

⚠ **And the word is the second, independent reason to decline.** `тан` is attested as "equal" — the corpus
writes "абсолютлă нулĕпе **пĕр тан**" — but **postpositionally**, and the tier can only place a connective
BETWEEN its operands. So even the three genuine equations could not be read correctly from here.

⚠ **`хут` ×78 is the Fula `tere` trap again**: it is PAPER in every attestation ("Хут — çулçă евĕр
целлюлозăран хатĕрлесе тунă çыру материалĕ"). The frequency word is `хутчен` ("тăваттă хутчен Совет Союзĕн
Паттăрĕ", "Виç хутчен чĕрĕлнĕскер") — "on four occasions", not an arithmetic product. `×` is ×0 here, so
declining both costs nothing.

⚠ **`запятой` ×7 is the same shape** and it nearly shipped: all seven are inside RUSSIAN-language reference
titles ("Орфографические правила употребления запятой"). The Chuvash word came from a translation gloss in
a film title instead — "**Пăнчă, пăнчă, хӳрешке...** (выр. Точка, точка, запятая...)" — which names the
comma directly. `хӳрешке` is only ×2 and both are that title; a bilingual gloss is thin evidence by count
and strong evidence by kind, and this log says which.

## Run 7 — 2026-08-16 — two defects the probes found late

**`XVIII ĕмĕр` stayed a CARDINAL with every gate green.** The Roman policy's context regex was written for
the folded Cyrillic `ӗмӗр` — but `core/roman.ts` runs at `romanPass` in registry.ts and the shared
character folds run **AFTER** it, so the policy sees the text as the writer typed it. I had the ordering
backwards in the file's own comment. The proportions make this the majority case, not an edge: `ĕмĕр` is
×61 in cv.wikipedia and the Cyrillic `ӗмӗр` came back **ABSENT** from the same probe.

⚠ **That absence is also a caution about the instrument.** `attest.ts` reporting a word missing from a wiki
that is written in the wrong codepoints is a confident negative manufactured by the very defect under
investigation. The word is on every history page in the language.

**`2,8 м/ç` left `[s]` hanging.** The denominator is written with the Latin ⟨ç⟩ and stands alone as its own
token, so the word-scoped confusable fold — which requires a Cyrillic letter IN THE WORD — cannot reach it.
That is the residual class run 2 measured (15 occurrences of an all-Latin-special fragment), showing up in
a slot that matters. The tier declares both spellings of the key.

**And the seconds field reaches 60.** `1972, 23:59:60 UTC — пĕрремĕш хут тĕкел çул çеккунтине кĕртнĕ` — a
`[0-5]\d` seconds field is right for every clock in the world except the one this corpus was written to
describe.

## Run 8 — 2026-08-16 — the gates

- **`mine.ts scan`**: `percent` 28→0 · `degree` 9→0 · `currency` 16→1 · `minus` 16→2 · `exponent` 17→5 ·
  `math-sign` 22→2. Residual, all read: the caret exponent `10,5 г/см^3`, a double hyphen inside
  `50-мĕш--80-мĕш çç.`, `Latin 1+A` in prose about character encodings, and one currency sign inside a
  Latin-script run.
- **corpus diff** (baseline emitted from a pristine worktree at `376d5bf`): **395/453 utterances changed
  (87.2%), DROP 82 → 24**, and no DIGIT / SLOT-GAP / RAWMARK / RAW-CAPS / THROW on either side. The
  largest diff of this sweep by a wide margin, and the before/after lines say why — whole sentences that
  were shredded into letter names now read as Chuvash: `sˈiː anˈdal ˈə k ˈiː kunˈda` → `ɕanˈdaləɡɘ kunˈda`.
- **`review.ts --lang chv`**: green on every checklist item including `sourcing` and `sign classes` — the
  six refused sign classes are registered in `ACCEPTED_SIGN_SILENCE` with their counts. Only the artifact
  scan is red, on the residuals above.
- **`referee-eval chv`**: **44.0% raw / 92.9% folded / 97.9% symbol, before and after** — measured on both
  sides from the pristine worktree. Unchanged, as expected for a layer that rewrites text and not the word
  g2p; the confusable rows change TEXT handling, and the referee's input is a word list already spelled
  correctly.
- **`vitest`** 4,521 passed and **`tsc --noEmit`** clean, including the 15 pre-existing confusable-fold
  goldens, which is the gate that mattered for the shared-table change.

## Backlog surfaced, not fixed

- **An all-Latin-special word has no Cyrillic letter to trigger the fold** — `ĕç` (work), `çeç`, and bare
  `ç`; 15 occurrences in the retained text. The presence test needs one real Cyrillic letter in the word,
  and these have none. The tier works around it for the one slot that mattered (`м/ç`).
- **`ba` `арăм` and `tt` `kübrәk`** are the same typo in their own corpora, and the fold now rewrites the
  first to `арӑм` — a letter Bashkir's table does not have. One instance each; both were already broken.
- **The caret exponent `см^3`** has no rule in the shared tier at all.
