# Irish (ga) normalization investigation (#562)

Chronological record. Baseline worktree: `<sibling checkout>/ga-base` (pinned at the commit the work
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
- normalization/review.ts --lang ga: checklist clean (wired, tests, all 8 sign classes, spelling→g2p,
  SOURCING all 2 high-traffic words attested, scan)

**Notes**: the review probes `12,5` (comma-decimal → pointe), `1.234` (pointe digit-by-digit), `5 000`
(space-grouped, corpus-absent) all read correctly. The `1960idí` decade reads "1960 idí" (the number +
the Irish -idí suffix as a word) — the corpus's own prose register; acceptable.

## Run 3 — 2026-08-01 (re-review against the playbook traps)

The parent asked for a re-review with `docs/normalization_playbook.md` in mind. Three real defects,
all found by probing the adversarial neighbour (trap 8 (zero corpus instances is not evidence of…)/13), none visible in the corpus diff:

- **The `haon`-ending compound ordinals (trap 13 (pin the rule's BRANCHES))**: `21ú` and `31ú` read "21ú"/"31ú" unchanged — the
  compositor emits "fiche a haon" (the counting `a` + h-prefixed `haon`), but UNIT_ORD keyed only "aon",
  so the last word "haon" found no ordinal. The corpus has NO 21ú/31ú (only 11ú, which goes through the
  <20 table path), so this is defensive — but it was wrong for the language. Fixed: "haon" → "aonú".
- **The decimal-percent leak (trap 8 (zero corpus instances is not evidence of…), the Fula lesson)**: `3.5%` read "a trí pointe a cúig" with the `%`
  silently dropped — the dot rule converted the number to words, so the tier's digit-adjacent `%` could
  not see it. Fixed by claiming the word-form percent ("X pointe … faoin gcéad").
- **English `BC` era marker (defensive)**: the corpus uses `R.C.` (roimh Chríost), but the synthetic
  `BC 1000`/`1000 BC` probes read [bk]. Added the BC → roimh Chríost expansion.

**Verified non-issues**: the capitalized ordinals (15Ú, 18Ú, 7Ú, 190Ú); the fraction denominators
(2/3, 3/4, 1/2, 2/5, 3¾, 2½); 30°F/30°/35°E/35°N; the minus-vs-range guard (-5 → lúide, 5-10 → go
dtí, -5°C); the rate forms (12.8msu, 64km/u, 2.4Ghz/GHz); the comma-decimal vs comma-thousands
(12,5/12,50 → pointe, 1,400/5,000,000 → thousands); the currency amounts (£27, ¥2,500, $2.3, $1000);
`go dtí` and `san uair` do NOT trigger mutation (verified — the corpus's own prose matches).

**Post-fix gates**: corpus diff 202/1948 (10.4%) — byte-identical to the pre-review run (no regression,
the fixes touch only corpus-absent forms); 2660 tests (2 new trap pins); referee 44.8% unchanged; scan
no defects; review checklist clean, sourcing check passes.

## Run 4 — 2026-08-01 (PR #597 review pass): the ordinal, against the corpus's own prose

The traps were already swept, the sourcing check passes, and the sign classes are clean. So this pass read
the ordinal against **the register the corpus writes in its own words** — 58 `chéad`, 26 `dara`, 23 `déag`,
plus "sa tríú haois", "an cúigiú huair", "sa naoú háit", "san aonú háit déag", "an fichiú haois", "an naoú
haois déag". Four defects, all live, all in the layer's defining rule.

1. **The ordinal table carried its own article, and the corpus supplies one — 27 of the 36 `Nú` instances
   are preceded by `an`, `sa`, `san`, `ón` or `sna`.** So the reading doubled it: *an an cúigiú déag haois*,
   *sa an deichiú haois*, *ón an t-ochtú haois*. The table is now bare (chéad, dara, tríú …), which is
   exactly how the corpus's prose writes it, and the ARTICLE's one piece of morphology that is ours — the
   t- prefix on a vowel-initial ordinal after a bare `an` — is applied by the rule (`an 8ú lá` → *an t-ochtú
   lá*). The article does belong to the FRACTION rule, which supplies its own (`1/5 orlach` → *an cúigiú
   orlach*), so it moved there.
2. **The noun goes INSIDE a compound ordinal.** Irish writes "an naoú haois déag" (lit. ninth century
   tenth) and "an séú háit déag" — the tens element follows the noun. The layer emitted *an cúigiú déag
   haois*. Six corpus teens are of that shape, so the rule now captures the following word and places it:
   `an 15ú haois` → *an cúigiú haois déag*. The same order applies above twenty, joined by `is`:
   `an 37ú tír` → *an seachtú tír is tríocha*.
3. **Eleven was `chéad`, not `aonú`.** Composing 11 as ORD_1_10[1] + déag gave *an chéad déag*; the corpus
   writes "san aonú háit déag", and `chéad` is only ever the standalone first. The teens now take their own
   unit series, which also fixes 12 (`dóú déag`, not *dara déag* — see the sourcing note below).
4. **A LIST swallowed its conjunction as the noun.** The corpus writes "sna 11ú, 12ú agus 13ú haoiseanna",
   where the noun comes once at the end; pulling the next token inside gave *dóú agus déag*. A closed set of
   function words (agus, is, nó, the prepositions, the articles) now blocks the enclosure.

**Two regressions I introduced and caught in the diff**, both worth recording because they are the hazard of
this shape of fix:
- rewriting the compound path made `190ú` — a corpus form — return undefined and leave the digits. A
  compound ending in a TENS word ordinalises IN PLACE and keeps its order (*céad nóchadú*); only a
  UNIT-final compound takes the `is` inversion. Pinned.
- `200ú` declined because `TENS_ORD` keyed `céad` but the compositor emits the lenited `chéad` (dhá chéad).

**Sourcing note (the new checklist item's discipline)**: `dóú` for 12-in-a-compound appears in neither the
corpus nor the referee — but neither does `dara déag`, and the corpus DOES evidence that the compound series
differs from the standalone one (`aonú` in "san aonú háit déag" where standalone is `chéad`). `dóú` is
therefore an inference from the corpus's own analogy rather than an attestation, and is marked as such in
the code.

**Recorded, not fixed**: `an 10ú - 11ú haois` — a range of ORDINALS. Both sides now read correctly, but the
hyphen is dropped rather than read as `go dtí`/`agus`, because the range rule matches digit-hyphen-digit and
these are digit-suffix forms. One corpus instance; a rule for it would have to run before the ordinal rule
and is not worth the interference at merge time.

**Gates**: vitest 2660 (200 files); tsc clean; scan no defects; `normalization/review.ts --lang ga`
checklist clean including the sourcing check; referee **identical** at 4233/9453; corpus diff **31/1948**
with every counter 0 → 0 — 26 doubled articles removed, 18 nouns moved inside, the 11ú/12ú unit series, the
37ú compound and the list, each read in full.
