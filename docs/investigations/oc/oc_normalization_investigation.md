# Occitan (oc) normalization — investigation log

Picked as the largest untreated corpus remaining (393,961 paragraph segments) and with a specific
prediction worth testing: Occitan is a dialect continuum with several written norms, so the round was
opened expecting the Tatar/Zamanälif shape — a corpus split between orthographies. It is not; the split
that showed up is in the SEPARATORS and in one abbreviation, not in the alphabet.

`tools/corpus/mined/oc.jsonc` — oc.wikipedia dump, 32/35 cells.

## Run 1 — 2026-08-16 — what the engine does today

```
"19 042 936 estatjants" → three separate numbers
"1640.93 abitants"      → …kwaɾantɔ . nunantɔ tɾes    the dot a FULL STOP
"13,1°C" · "5,2°C"      → tɾet͡se , y k                 the comma a pause, ⟨C⟩ a bare letter
"-20,4°C"               → bint , kwatɾe k              …and the minus dropped on top
"250°" · "100°C"        → the sign gone
"50 %"                  → sinkwantɔ                    the sign gone
"3500 abC"              → tɾes milɔ siŋk sents abk     ⚠ the era read as the SYLLABLE [abk]
"12:30 h"               → dut͡se , tɾentɔ               the colon a clause pause
"9 km" · "357 g/kg"     → nɔw km · … k kk              the units as consonant clusters
"1909-2006" · "18-20"   → the endpoints fused
"sègle XX"              → sɛɡle bint                   "century twenty"
```

## Run 2 — 2026-08-16 — ⚠ `>` IS A TAXONOMIC RANK CHAIN, THE FIFTH SENSE IN THIS SWEEP

All 47 instances in the retained text are one string, repeated down a mammal article's classification box:

> Eucariòtas > Metazoaris > Cordats > Craniats > vertebrats > Euteleostòms > Mamifèrs > Euteriats >
> Carnivora > Fissipedia > Canidae

Zero are comparisons. Set against the rest of the sweep: gd's `>` was a LaTeX fragment, tk's a typo for
⟨ş⟩, shn's a **sound-change arrow**, la's a **genuine comparison** (`si summa > 11 sit`), and this is a
**rank separator**. Five languages, five senses, and only one of them the sign's nominal meaning.

## Run 3 — 2026-08-16 — the separators are NOT the neighbour's, which is worth saying out loud

Asturian was treated one round earlier and its rule does not transfer:

| | Asturian | **Occitan** |
|---|---|---|
| grouping | dot (`171.057`) **and** space | **space only** (`19 042 936`, `250 000 per an`, `1 275 207`) |
| decimal | comma, and the dot when <3 digits follow | **both marks, unconditionally** |

`1640.93 abitants` is a decimal and `19 042 936` is a group; no dot in this corpus ever groups. So the
three-digit test Asturian *needs* would be wrong here, and the dot folds onto the comma unconditionally.
Two Romance neighbours, treated back to back, with genuinely different rules — which is the whole reason
the sweep reads each corpus instead of porting.

## Run 4 — 2026-08-16 — the era was never a LEAK, which is why no gate saw it

`abC` and `avC` — *abans Crist* and its Provençal spelling — in "Entre 5500 e 4000 abC", "A partir de
3500 abC", "(2900-2750 abC)", "Erodòt (484-425 avC)". Occitan's TOKEN admits the hyphen and treats a
letter run as a WORD, so `abC` reached the g2p as the syllable **[abk]** rather than as three stray
letters. Nothing was dropped, nothing was raw, and the output was a pronounceable syllable — so `DROP`,
the leak gates and the referee were all silent. The same blindness `foldCyrillicConfusables` exists for,
arrived at from a completely different direction.

`Crist` ×98, `abans` ×53, `après` ×72 on oc.wikipedia.

## Run 5 — 2026-08-16 — one degree sign is a book size, and two words are traps

⚠ **`2 in-12°` is DUODECIMO** — "Les Troubadours cantaliens XII-XXe siècle, 1910, Bloud et Gay, , 2
in-12°, 645 et 577 p." Reading it as twelve degrees is the trap-56 shape. ⚠ **And the obvious guard does
not work**: written `(?<!in-)` the lookbehind tests the three characters before the LAST DIGIT — `n-1` in
`in-12°` — and passes. `(?<!in-\d{0,3})` is variable-length, which V8 allows, and is what actually
excludes it. The corpus's other degrees are temperatures and the dog's 250° field of vision.

⚠ **`gras` ×156 is the word for FAT.** It is the highest-scoring candidate for "degree" and the Fula
`tere` shape for the sixth time in this sweep. The degree word is `graus` ×17, the attested plural, with
`grau` its transparent singular.

⚠ **`+` ×2 is a bibliographic FLORUIT marker** — "Jean de Roquetaillade (+ 1366 ca)" — not an addition.

## Run 6 — 2026-08-16 — the gates

- **`mine.ts scan`**: `percent` 29→0 · `minus` 9→0 · `ampersand` 6→0 · `degree` 16→3 · `currency` 16→6 ·
  `exponent` 21→11 · LEAK `km` 21→11 · `math-sign` 25→24 (the taxonomy refusal). Residual, all read: the
  rank chain, the LaTeX Fermat fragment, `in-12°`, `km` inside compound rates the tier does not reach,
  and a bibliographic `?-1310`.
- **corpus diff** (baseline emitted from a pristine worktree at `8b3f04a`): **160/452 utterances changed
  (35.4%), DROP 103 → 46**, and no DIGIT / SLOT-GAP / RAWMARK / RAW-CAPS / THROW on either side.
- **`review.ts --lang oc`**: green on every checklist item including `sourcing`, `sign classes` and
  `clause-final` — seven refused classes registered in `ACCEPTED_SIGN_SILENCE` with their counts.
- **`referee-eval oc`**: **39.3% raw / 70.4% folded / 93.3% symbol, before and after** — measured on both
  sides from the pristine worktree. (The referee itself is dialect-mixed and says so; unchanged either way.)
- **`vitest`** 4,575 passed and **`tsc --noEmit`** clean.

## Backlog surfaced, not fixed

- **The century ordinal** — `sègle XX` ×153 and no spelled instance, the same refusal Asturian records.
- **The rate with a compound denominator** (`357 g/kg`, `abitants/km²`) — the shared tier reaches neither
  side when the numerator is a word, which is the twin of the gap trap 60 closed on the exponent side.
- **`XXe siècle`** — the French ordinal suffix on a Roman numeral, in a French-language citation.
