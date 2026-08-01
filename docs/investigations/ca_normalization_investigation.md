# Catalan (ca) normalization investigation (#562)

Chronological record. Baseline worktree: `~/Programming/tmp/ca-base` (pinned at the commit the work
started from). Working branch: `norm-ca-562`.

## Run 1 — 2026-08-01

**Setup**: baseline emitted from `~/Programming/tmp/ca-base` via
`npx tsx tools/normalization/corpus-diff.ts emit --lang ca --corpus ca_es --out /tmp/ca.base`.
Referee baseline: `folded backbone: 4201/5168 (81.3%)`.

**Corpus shape** (1,837 unique ca_es utterances — a FLEURS English translation):
- **dot-thousands** (1.400, 400.000, 19.500, 800.000, 7.000) — the TOKEN already handles these
  (`\d+\.\d+`); **comma decimals** (decimalConnector "coma").
- **`Nè`/`Na` ordinal suffix** — `7è de rugbi`, `la 7a illa`. Catalan ordinals: è (masc), a (fem),
  and 2n/2a, 3r/3a, 1r/1a. The corpus's instances are `7è`, `7a`.
- **clocks** ×17 — `11:35 PM`, `06:30`, `10:00h-11:00 PM MDT`, `11:00, hora local (UTC +1)`.
- **version dots** — `2.4 Ghz`, `5.0 Ghz`, `802.11a/b/g/n`.
- **fractions** ×2 — `29¾`, `24½`, `1/5 polzades`.
- **era markers** — `segle III aC` (abans de Crist = BC), `1.300 dC` (després de Crist = AD).
- **roman** ×24 — `Lluís XVI` (cardinal per source), `Lealofi III`, `segle XVIII`/`XX` (cardinal),
  `segles XI, XII i XIII`. The romanOrdinals policy is nuanced (prenominal ordinal, postnominal
  cardinal) and the existing shared pass already reads `segle XVIII` correctly.
- **percent** ×6 — `3%`, `88%`, `93 %`, `34 %`, `80%` (the tier's "per cent").
- **currency** ×2 — `2.500 ¥`, `130.000 ¥`, `7.000 ¥` (¥ dropped), `5 $ i 100 $` (tier handles $).
- **units/rates** — `35 mm`, `70 km/h`, `160 km/h`, `4.892 m`, `3.850 km²`, `3.136 mm²`, `100-200
  milles/hora`, `100 iardes/metres`, `25 iardes/metres`.
- **initialisms** ×135 — EUA (read [ɛwə] as a word — but should be E-U-A?), ONU, NHK, FIC, AP, NSW,
  IRM/RMN, B&B, XDR-TB.
- **abbrev** — `Dr.`, `George W. Bush`, `etc.`, `dC`/`aC`.

**KEY FINDINGS from the probe**:
- `11:35 PM` → colon pause + PM [pm]. `06:30` → colon pause.
- `30 °C` → [k] (C dropped). `2.4 Ghz` → "bín i quatre gs" (version dot → pause, Ghz raw).
- `7è de rugbi` → "set è de rugbi" (ordinal suffix as a word). `la 7a illa` → "set a illa".
- `29¾`, `24½`, `1/5` → the fraction glyphs dropped / read as two numbers.
- `dC` → [tk], `aC` → [ak] (era markers as bare clusters).
- `2.500 ¥` → ¥ dropped.
- `EUA` → [ɛwə] (should be E-U-A letters — "els EUA" is "the USA"). `ONU` → [ɔnu] as a word (the UN).
- `B&B` → [p p]. `Dr.` → [dr .]. `George W. Bush` → [w .].
- `D` (dC) and other dotted caps.

**Next**: write `src/languages/catalan/normalize.ts`, wire into `text()`.

## Run 2 — 2026-08-01

**Implementation landed** on `norm-ca-562`. `normalize.ts` steps, in order:
1) era markers (dC/aC → després/abans de Crist)
2) dotted capital runs (George W. Bush, John F. Kennedy)
3) single-dot abbrevs (Dr → doctor, etc → etcètera)
4) `Nè`/`Na`/`Nr`/`Nn` ORDINALS — the defining rule; masculine -è / feminine -a (setè/setena,
   primer, vint-i-quatrè), from 10 up the cardinal + -è/-ena on the last word
5) clocks (colon form; 11:35 PM → onze trenta-cinc pe ema; 06:30; 10:00h; the 24h h and AM/PM consumed)
6) VERSION DOTS and DOT DECIMALS — the disambiguation that cost a round: the dot is THOUSANDS when the
   fraction is 3 digits (1.400 = mil quatre-cents), a DECIMAL/VERSION when 1-2 (1.5 milions, 12.8 km,
   2.4 Ghz, 802.11n, Figura 1.1, 4.2-3.9) — read "punt"
7) fractions (N¾ → i tres quarts, N½ → i mig, N/M → un cinquè)
8) degrees (graus Celsius/Fahrenheit, and the LONGITUDE º (U+00BA) → graus + nord/sud/est/oest — the
   review gate's RAWMARK)
9) Ghz → gigahercis
10) signs (+ → més, - → menys with a range guard, & → i, = < > ×)
11) initialisms (EUA letter-spells E-U-A; ONU stays the word; NHK/FIC/NSW/IRM/RMN/GPS/PM letter-spell)

**Engine wiring** (catalan.ts): `text()` = `assembleClauses(SYMBOLS(normalizeCatalan(input)), TOKEN, …)`.
The tier already owned percent (per cent), currency (dollar/lliura/euro — ¥ ADDED as ien), units,
rates, exponents, magnitudes. No TOKEN change needed (the dot-thousands/comma-decimal class already
worked).

**Gates, all green**:
- scan: no defects (DROP 2 → 0, RAWMARK 1 → 0)
- tsc: clean
- vitest: 2633 passed (200 files) — 8 new ca tests
- referee: folded backbone 4201/5168 (81.3%) — IDENTICAL to the worktree baseline
- corpus diff: 109/1841 (5.9%) changed, every change READ and verified an improvement
- normalization-review --lang ca: checklist clean (wired, tests, all 8 sign classes, spelling→g2p, scan)

**Notes**:
- the review probe `5 000` reads "cinc zero" — a synthetic space-grouping the Catalan corpus never
  writes (Catalan groups thousands with dots, which the TOKEN already handles); identical to baseline.
- `4.892 m` is the subtle case: 4892 metres has a 3-digit fraction → stays a grouping; only 1-2 digit
  fractions are versions/decimals.
