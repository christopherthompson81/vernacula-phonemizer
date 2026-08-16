# Papiamento (pap) normalization — investigation log

Picked on a specific, testable prediction. Papiamento has **two official orthographies, both current**:
Curaçao and Bonaire write phonologically (`ku`, `-shon`, `i`, `k-`) and Aruba etymologically (`cu`,
`-cion`, `y`, `c-`). That is the Tatar/Zamanälif shape — a corpus split between writing systems — except
that here both norms are official and in daily use, so the prediction should hold rather than dissolve
into "one is a legacy". It held, and its practical consequence turned out to be somewhere I did not
expect.

`tools/corpus/mined/pap.jsonc` — pap.wikipedia dump, 31,099 paragraph segments, 32/35 cells.

## Run 1 — 2026-08-16 — the prediction, measured

| marker | Curaçaoan | × | Aruban | × |
|---|---|---|---|---|
| -tion nouns | `-shon` | **246** | `-cion` | 135 |
| "with" | `ku` | **344** | `cu` | 207 |
| "and" | `i` | **461** | `y` | 256 |

Segments carrying one norm's markers and not the other's: **205 Curaçaoan, 102 Aruban, and 8 carrying
both.** Two sentences from the scan's own examples, three articles apart:

> Curaçaoan — "Segun Senso 2023, 24,6% di e **poblashon** ta **konsistí** di migrantenan di promé
> **generashon**"
> Aruban — "Na Aruba e dollar Mericano ta **acepta casi** tur caminda. E florin **cu** e dollar ta mara"

## Run 2 — 2026-08-16 — ⚠ AND THE CONSEQUENCE IS IN THE SEPARATORS

This is the part the prediction did not anticipate. Each norm brings its **source language's number
conventions** with it, so both marks do both jobs in one artifact:

| | groups | decimates |
|---|---|---|
| Curaçaoan / Dutch | **dot** — `130.627 habitante`, `158.006 residente`, `2.754.000 km²`, `108.166 hende` | **comma** — `24,6%` |
| Aruban / American | **comma** — `1,290 km di kosta`, `1,016`, `52,000 km2` | **dot** — `27.3°C` |

**Implication** The codepoint settles nothing — a `.` between digits is a group in one article and a
decimal in the next. What settles it is the **three-digit test applied symmetrically to both marks**:
every grouped instance in this corpus has exactly three digits after the mark and every decimal has one
or two. The layer runs the same test on `.` and on `,`, then folds whatever survives onto the comma the
engine's number branch reads. One mechanism, both orthographies.

## Run 3 — 2026-08-16 — the vocabulary exists in only ONE norm

`attest.ts` over 22 words, and the asymmetry is sharp:

    porshento ×28   ·   porcento  ABSENT
    kuadrá    ×23   ·   cuadrado  ABSENT

`florin` ×112 (more than `dollar` ×35 and `euro` ×34 together — it is the local currency, and the corpus
writes it beside its code: "un tarifa oficial fiho di **AWG 1,79** pa cada **US$ 1**"), `promé` ×129,
`despues` ×133, `meter` ×75, `ora` ×58, `grado` ×41, `kilometer` ×38, `antes` ×26, `Cristo` ×21,
`koma` ×18, `Celsius` ×10, `kubiko` ×3.

**Implication** The orthographic split is in the RUNNING PROSE; the technical vocabulary this layer needs
exists on the wiki only in the Curaçaoan norm. So the measure words emitted are phonological even where
the surrounding article is etymological — a reader of an Aruban article hears *porshento*. A small, real
cost, stated in the file rather than discovered later.

## Run 4 — 2026-08-16 — the colon is a flag

`clock` is 233 corpus-wide. The retained text's colon instance is **the Curaçao flag's stripe ratio** —
"E strepinan horizontal tin un proporshon di **5:1:2**" — sitting beside the flag's own fractions ("E
streanan tin diameter di **1/6 i 2/9** di e haltura"). A clock rule would read the ratio as five past
one; a fraction rule would read the star diameters aloud as fractions. Neither is written (trap 9).

⚠ **The degree is both senses again**, as in Turkmen and Shan: coordinates (`46° 37' W`, `10° nort di e
ekuator i 84° wèst`, `longitut 180°`), one interior angle (`kada ángulo di e strea ta 36°`), and the
temperatures (`entre 24 i 36°C`, `27.3°C`, `te 32°C`).

## Run 5 — 2026-08-16 — the gates

- **`mine.ts scan`**: `percent` 32→0 · `degree` 11→0 · `exponent` 20→3 · `currency` 18→5 · `ampersand`
  10→0 · `minus` 6→3 · LEAK `km` 27→0. Residual, all read: a timezone offset in a daylight-saving note,
  the LaTeX `1 Pa = \frac{1N}{m^2}`, `mia²` (square miles, undeclared), `kg/m2` as a rate the tier does
  not reach, and three abbreviations in Dutch and English citations.
- **corpus diff** (baseline emitted from a pristine worktree at `846fc2e`): **163/445 utterances changed
  (36.6%), DROP 98 → 20**, and no DIGIT / SLOT-GAP / RAWMARK / RAW-CAPS / THROW on either side.
- **`review.ts --lang pap`**: green on every checklist item including `sourcing`, `sign classes` and
  `clause-final` — seven refused classes registered in `ACCEPTED_SIGN_SILENCE` with their counts.
- **`referee-eval pap`**: **15.0% raw / 70.0% folded / 93.8% symbol, before and after** — measured on both
  sides from the pristine worktree. (The referee is 20 pairs; it says so.)
- **`vitest`** 4,596 passed and **`tsc --noEmit`** clean.

## Backlog surfaced, not fixed

- **The Aruban measure words** — `porcento` and `cuadrado` are absent from the wiki, so a third of this
  corpus gets Curaçaoan vocabulary. Run 3.
- **`kg/m2`** — a rate whose denominator carries an ASCII exponent; the tier reaches neither.
- **`mia²`** (square miles) is undeclared; ×3.
- **`US$`** — the country-prefixed sign, which the tier does not match. One instance; Shan's layer strips
  the prefix for the same reason and pap could adopt that if the class grows.
