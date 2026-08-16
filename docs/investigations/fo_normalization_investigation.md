# Faroese (fo) normalization — investigation log

Picked to break a run and to test a sibling. The two previous rounds were Ibero-Romance neighbours
(Asturian, then Occitan) and a third would have confirmed rather than taught; Faroese is North Germanic,
the family whose is/da/nb/sv are all treated, so the Germanic ordinal period arrives here with three
finished implementations next door (trap 55).

`tools/corpus/mined/fo.jsonc` — fo.wikipedia dump, 52,355 paragraph segments, 32/35 cells.

## Run 1 — 2026-08-16 — ⚠ THE FULL STOP DOES FIVE JOBS, AND ALL FIVE READ AS A SENTENCE END

This is the round's finding. One character, five functions, every one of them producing a false clause
break before this layer:

| job | instance | discriminator |
|---|---|---|
| THOUSANDS GROUP | `49.267 fólk` · `19.300` · `80.000 føroyingar` · `11.738 mió. kr.` | exactly 3 digits follow |
| DECIMAL | `3.00 kr frímerki` · `4.19$ pr. km²` | fewer than 3 digits follow |
| TIME | `Eitt eyka sekund, 23.59.60, verður lagt at enda árið` | two dots, 2+2 digits |
| ORDINAL MARKER | `1. juli` · `23. apríl` · `3. min.` · `2. og 3. ættarlið` | a lowercase word follows |
| SENTENCE END | everything else | — |

⚠ **And the COMMA is the decimal**, so the two marks do each other's textbook jobs: `6,3°C`, `56,7 °C`,
`49,5 %`, `80,11 ár`, `3,4 miljardir`, `7,2 milliónir`. The two dot decimals are both inside DOLLAR
figures — an American convention arriving with the quantity it describes.

The layer is organised around resolving the five in order, most constrained shape first.

## Run 2 — 2026-08-16 — the ordinal WORD is refused and the false BREAK is fixed

The ordinal period is ×127 in the retained text and is this language's commonest defect. It is also where
the sibling test fails: `attest.ts` says the DATE slot takes the **weak** form —

    fyrsta ×51  against  fyrsti ×29        triðja ×28  against  triði ×20
    fjórða ×25  against  fjórði ×20

— and of the 31 day ordinals, `sekstandi` (16), `nítjandi` (19) and every compound above 20 score
**zero**. 1–15, 17 and 18 are attested, in the strong form. So a bounded table would cover about half the
month and be in the wrong case for all of it.

**Implication** The dot is spent and no word is emitted. `1. juli` → `1 juli`, which reads the cardinal
where an ordinal belongs but puts the figure and its noun in ONE clause instead of two — and that half is
unambiguously right. The other half is left to a round with a source. Same shape as the Latin refusal two
rounds ago, reached from thin attestation rather than from case agreement.

## Run 3 — 2026-08-16 — the colon is a swimming record, not a clock

`clock` is 1,092 corpus-wide. The retained text's colon instances are `9:59.91`, `14:46.33`, `2:25.36`,
`2:27.62` — **minutes:seconds.hundredths**, Faroese national records in the athletics articles — and the
one real clock is written `kl. 3 e.m.`, with no colon at all. A clock rule would read every national
record as a time of day (trap 9). The abbreviations are claimed instead: `kl.` = `klokkan` ×38,
`e.m.`/`f.m.` = *eftir*/*fyri middag*.

⚠ **And the corpus glosses its own coordinate abbreviation**: `Føroyar (danskt: Færøerne; 62°
norðurbreidd, 7° vesturlongd)` spells out what `57°71° og 71°11° n.br.` abbreviates, three articles away.
`f.Kr.` ×45 is the era marker and its expansion is its own letters.

## Run 4 — 2026-08-16 — one defect the test caught that the corpus diff could not

The no-break-space branch of the ordinal rule was written with an ORDINARY space and a bare `\p{L}`
lookahead, and it ate the SENTENCE-FINAL dot in `Tað var 1998. Síðan kom` — the fifth job of the full
stop, and the one that must survive untouched.

⚠ **The corpus diff could not have found this**, because a lost pause is not a lost reading: no word
changes, `DROP` sees nothing, and the utterance is still well-formed. Restricting the separator to U+00A0
and the lookahead to `\p{Ll}` on the ordinary-space branch is the fix. Trap 58's family, caught by a test
rather than by a gate.

## Run 5 — 2026-08-16 — the gates

- **`mine.ts scan`**: `percent` 34→0 · `degree` 11→0 · `exponent` 28→1 · `currency` 15→1 · `ampersand`
  6→0 · `minus` 5→1 · LEAK `km` 30→5. Residual, all read: the football scores (`5-1`, `1-0`, `2-0`, which
  the range rule gives a pause), `km²` inside a rate the tier does not reach, one `£34 milliónir` whose
  sign is undeclared, and three abbreviations in a Swedish citation.
- **corpus diff** (baseline emitted from a pristine worktree at `a370a3d`): **244/451 utterances changed
  (54.1%), DROP 94 → 13** — the largest DROP reduction of the sweep in proportion — and no DIGIT /
  SLOT-GAP / RAWMARK / RAW-CAPS / THROW on either side.
- **`review.ts --lang fo`**: green on every checklist item including `sourcing`, `sign classes` and
  `clause-final` — seven refused classes registered in `ACCEPTED_SIGN_SILENCE` with their counts.
- **`referee-eval fo`**: **29.1% raw / 57.1% folded / 88.6% symbol, before and after** — measured on both
  sides from the pristine worktree.
- **`vitest`** 4,586 passed and **`tsc --noEmit`** clean.

## Backlog surfaced, not fixed

- **The day ordinal** — ×127, blocked on 16, 19 and every compound above 20 scoring zero, and on the weak
  form the date slot needs. Run 2.
- **`£`** is undeclared; one instance.
- **`kr.`'s trailing dot** survives into the reading as a pause when the abbreviation is mid-clause. The
  tier's key is `kr`, so expanding it in normalize.ts first would leave the tier with a word it cannot
  match.
