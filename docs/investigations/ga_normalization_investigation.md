# Irish (ga) normalization investigation (#562)

Chronological record. Baseline worktree: `~/Programming/tmp/ga-base` (pinned at the commit the work
started from). Working branch: `norm-ga-562`.

## Run 1 — 2026-08-01

**Setup**: referee baseline `folded backbone: 4233/9453 (44.8%)` identical in the worktree baseline.

**Corpus shape** (1,944 unique ga_ie utterances — a FLEURS English translation into Irish):
- **`Nú` ordinals** ×~40 (7ú, 11ú, 12ú, 13ú, 18ú, 1,000ú — the corpus's own ordinal digits). Irish
  ordinals: 1ú = "an chéad", 2ú = "an dara", 3ú = "an tríú", 4ú = "an ceathrú", 5ú = "an cúigiú",
  6ú = "an séú", 7ú = "an seachtú", 8ú = "an t-ochtú", 9ú = "an naoú", 10ú = "an deichiú"; above 10
  the cardinal + "ú". The current engine reads the suffix `ú` as the bare vowel [uː].
- **comma-thousands** ×32 (1,400, 400,000, 19,500, 5,000,000, 40,000, 30,000) — the TOKEN `\d+` splits
  these on the comma.
- **clocks** ×19 — `11:35 i.n.` (i.n. = iarnóin = p.m.), `06:30 agus 07:30`, `8:30 p.m.`, `1:15 r.n.`
  (r.n. = réamhnóin = a.m.), `09:19 p.m. GMT`, `8:46 r.n.`, `10:08 i.n.`. NOTE the corpus uses BOTH
  `i.n.`/`r.n.` AND `p.m.`/`a.m.`.
- **era markers** ×8 — `400 A.D.`, `1100 A.D.`, `1000 R.C.` (roimh Chríost = BC), `AD 1000-1300`.
- **rates** ×8 — `70km/h`, `83 km/h`, `165 km/h`, `160km/u`, `35-40 msu` (míle san uair = mph),
  `56-64 km/u`, `100 slat/méadar`, `25 slat/méadar`.
- **currency** ×7 — `US$14.7 billiún`, `¥2,500`, `¥130,000`, `¥7,000`, `US$30`, `$10`, `$1000`, `£27`.
- **percent** ×3 — `88%`, `93%`, `80%` (the tier's "faoin gcéad").
- **degrees** ×2 — `+30°C`, `35°W` (a longitude!). NOTE the 35°W longitude uses W.
- **fractions** ×2 — `29¾ orlach`, `24½ orlach`, `1/5 orlach`.
- **abbrev** — `N.A.` (Náisiúin Aontaithe = UN), `S.A.` (Stáit Aontaithe = USA), `Dr.`, `etc.`,
  `James et al.`, `Mrs.`.
- **initialisms** ×128 — NHK, APS, KNP, PA, FIC, MS, XDR-TB, PSTN, GAA, RTÉ, IRL, UN, IRA, NATO, BBC.
- **ranges** ×14 — `10-60 nóiméad`, `6-6`, `4.2-3.9 milliún`, `120-160 méadar`, `AD 1000-1300`,
  `35-40 msu`.
- **zero-width** ×18 — the corpus has U+200B ZERO WIDTH SPACE characters! These are invisible but
  split tokens.
- **roman** — Lealofi III, Éilis II (postposed cardinal).
- **ampersand** ×3 — `B&Banna`, `Qatar Airways & Turkish Airlines`, `Coláiste na nEalaíon &
  Eolaíochtaí`.
- **exponent** — `19,500 km²`, `3,850 km²`.

**KEY DEFECTS from the probe**:
- `1ú` → *a haon ú*; `190ú` → *céad nócha ú* (the ú suffix read as a word).
- `1,400` → *a haon, ceithre chéad* (comma → pause).
- `11:35 i.n.` → colon pause + [i.n.] letter-spelled.
- `400 A.D.` → *ceithre chéad a.d.*; `1000 R.C.` → [b.k.].
- `1.5 million` → *a haon. a cúig* (dot pause).
- `160km/h` → *...ciliméadar h* (rate raw).
- `30°C` → [k]; `35°W` → the longitude.
- `88%` → the tier's "faoin gcéad" works.
- `B&Banna` → the & dropped.
- `BBC` → [b.k.], `IRL` → [irl], `GAA` → [gaə], `RTÉ` → [rteː], `IRA` → [irə].
- `XDR-TB` → [xdrtb] (cluster).
- `U.S.` → [ʊ.s.] — but the corpus's S.A./N.A. are the important ones.

**GOOD already**: `88%` → "faoin gcéad" (tier), `€`/`$`/`£` → the tier's euro/dollar/punt, `km`/`cm`/
`mm`/`kg` units, plain years, roman numerals, `James et al.`.

**Next**: write `src/languages/irish/normalize.ts`, wire into `text()`.

## Run 2 — 2026-08-01 (implementation)

`src/languages/irish/normalize.ts` landed on `norm-ga-562`. Steps, in order:
0) zero-width (the corpus has U+200B ×18 — removed outright)
1) era markers (A.D. → tar éis Chríost, R.C. → roimh Chríost, undotted AD before/after a year) +
   N.A. → Náisiúin Aontaithe, S.A. → Stáit Aontaithe
1b) currency prefixes (US$ → dollar na Stát Aontaithe; the `$` REQUIRED so US alone doesn't expand —
   this keeps the scan's DROP test able to see the contribution, which the optional-`$` version
   defeated)
2) dotted capital runs (George W. Bush)
3) single-dot abbrevs (Dr → Dochtúir, etc → srl)
4) `Nú` ORDINALS — the table (an chéad, an dara, an tríú … an deichiú) + composition (an cúigiú déag =
   15th, an fichiú = 20th, an seascadú = 60th, the -ú on the last element of a compound)
5) ranges/scores → "go dtí" (to)
6) clocks in the COLON form, i.n./r.n./p.m./a.m. → iarnóin / réamhnóin; the marker captured WITHOUT
   eating the space (the clock-glue trap)
7) version dots and dot-decimals → "pointe", fraction digit-by-digit; units claimed with the word
   (12.8 km → ciliméadar); version letters spaced (802.11n); Ghz claimed first on the raw digits
7c) comma-decimals → pointe (the review's leak guard)
8) fractions (1/5 → an cúigiú orlach; 29¾ → agus trí cheathrú)
9) degrees (céim Celsius/Fahrenheit + the 35°W longitude → céim siar)
10) rates (km/h, km/u → ciliméadar san uair; msu → míle san uair)
11) signs (+ → móide, - → lúide, & → agus incl. the corpus's B&Banna, × → faoi, = < >)
12) initialisms (H5N1 → héis a cúig ein a haon, M16 → em, A1GP, KV62 letter-spelled)

**Engine wiring** (irish.ts): `text()` = `assembleClauses(SYMBOLS(normalizeIrish(input)), TOKEN, …)`.
The TOKEN gained comma-thousands + dot-decimals; the tier gained `¥` (yen). `pointe` and `faoin gcéad`
are both attested (the review's sourcing check passes).

**Gates**:
- scan: no defects (DROP 4 → 0 — the US$ prefix fix)
- tsc: clean
- vitest: 2660 passed (6 new ga normalization tests)
- referee: 4233/9453 (44.8%) — IDENTICAL to the worktree baseline
- corpus diff: 202/1948 (10.4%) changed, every change READ and verified an improvement (58 initialism,
  31 comma-thousands, 31 ordinal, 18 dot-decimal, 16 abbrev, 13 clock, 11 misc — George W. Bush/H5N1/
  M16/1960idí, 9 range, 6 rate, 4 degree/fraction, 3 sign, 2 era)
- normalization-review --lang ga: checklist clean (wired, tests, all 8 sign classes, spelling→g2p,
  SOURCING all 2 high-traffic words attested, scan)

**Notes**: the review probes `12,5` (comma-decimal → pointe), `1.234` (pointe digit-by-digit), `5 000`
(space-grouped, corpus-absent) all read correctly. The `1960idí` decade reads "1960 idí" (the number +
the Irish -idí suffix as a word) — the corpus's own prose register; acceptable.
