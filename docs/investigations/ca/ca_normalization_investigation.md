# Catalan (ca) normalization investigation (#562)

Chronological record. Baseline worktree: `<sibling checkout>/ca-base` (pinned at the commit the work
started from). Working branch: `norm-ca-562`.

## Run 1 — 2026-08-01

**Setup**: baseline emitted from `<sibling checkout>/ca-base` via
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
- normalization/review.ts --lang ca: checklist clean (wired, tests, all 8 sign classes, spelling→g2p, scan)

**Notes**:
- the review probe `5 000` reads "cinc zero" — a synthetic space-grouping the Catalan corpus never
  writes (Catalan groups thousands with dots, which the TOKEN already handles); identical to baseline.
- `4.892 m` is the subtle case: 4892 metres has a 3-digit fraction → stays a grouping; only 1-2 digit
  fractions are versions/decimals.

## Run 3 — 2026-08-01 (re-review against the playbook traps)

The parent asked for a re-review with `docs/normalization_playbook.md` in mind. Three traps bit, all
caught by probing the ADVERSARIAL NEIGHBOUR, none visible in the corpus diff or the review checklist:

- **Trap 1 (`\b` ASCII)**: the era markers (`\bdC`) and the Ghz rule (`Ghz?\b`) used `\b`. Replaced
  with the explicit `(?<![\p{L}\p{M}])`…`(?![\p{L}\p{M}])` lookarounds. (The era bodies now carry the
  lookarounds alone.)
- **Trap 12 / Il-76s (`s` unit collision)**: `1920s` read *mil nou-cents vint segons* — nineteen-twenty
  SECONDS — because the shared tier declares `s` in `units`, and "1920 s" is a number-adjacent unit.
  The playbook's own migration section documents exactly this. The corpus's one instance is
  `Durant els anys 1920s`. Fix: normalize strips the plural `s` (`\d+s` → the number) BEFORE the tier.
- **Trap 8 (neighbour of an attested rule)**: `4t` (quart) — the `t` series — was not in the ordinal
  suffix set, reading *quatre t*. The fix gates EVERY suffix against the spoken ordinal's final word
  (primer/segon/tercer/quart/…è), which simultaneously rules out forms the language does not write
  (20t, 2000n, 11r) — trap 9 (a guard alternative with no attested…)'s misfire generator, an unattested guard alternative.
- **Trap 8 (sports time)**: the clock rule claimed `4:41.30` as a clock (the third `.SS` field was not
  guarded). Added `(?![:.\d])` so a trailing dot-decimal keeps it unclaimed. Corpus has zero sports
  times, so this is a defensive neighbour fix.
- **B&Bs plural**: the corpus's only ampersand is the PLURAL `B&Bs`, which read *p ps* — the `&`
  dropped AND the plural `s` orphaned. The ampersand rule now carries an optional trailing `s` onto
  the last letter name: *be i bes*. (The review tool's `&` class is blind to a mid-string `&` that
  changes TOKENIZATION — exactly the note on the checklist's sign check.)

**Post-fix gates**: corpus diff 111/1841 (6.0%), RAWMARK 1→0, DROP 2→0; 2635 tests (3 new trap-pin
tests); referee 4201/5168 (81.3%) unchanged; review checklist clean.

## Run 3 — 2026-08-01 (PR #594 review pass)

**Question**: the branch already self-reviewed against the playbook traps, so what is left? ~30 probes over
the shapes the rules build rather than the shapes they match. **Five defects, one of them on live corpus
text — and it is in the ordinal, the layer's defining rule.**

1. **A tens ordinal kept its stem vowel.** `${stem}è` appended straight to the cardinal gave *seixantaè*
   and *cent norantaena*, where Catalan drops the stem-final vowel: **seixantè**, **cent norantena**
   (quaranta → quarantè, noranta → norantena). Both of the corpus's tens ordinals are affected — `60è`
   and `190a`, i.e. two of its ten ordinal instances — and both were in the shipped tests' blind spot,
   because the tests pinned 7è/7a/1r/4t, all of which come from the irregular under-ten TABLE and never
   exercise the compositional path. A final -ó takes the -on- stem (milió → milionè).
2. **Fractions read the bare ordinal.** 1/3 was *un tercer* and 3/4 *tres quart*. Catalan uses NOUNS for
   thirds and quarters (un terç, tres quarts) and pluralises every denominator above one (2/3 dos terços,
   2/5 dos cinquens). The corpus's only slash fraction is 1/5, which the ordinal path happens to get right.
3. **The decade rule stripped the plural `s` from ANY number**, so a genuine `45s` (forty-five SECONDS) lost
   its unit. Narrowed to the decade shapes — a four-digit year or a bare tens (`1920s`, `90s`) — which is
   what the corpus's one instance is, and the tier then reads `45s` correctly.
4. **The compass-degree class was missing S** while its map carried "sud", so `35 ºS` left the º raw (a
   RAWMARK) and read the S as a letter. The corpus writes `ºO`, which is why it never fired.
5. **A padded replacement doubled an existing space** (`UTC +1` → `UTC  més 1`). Harmless downstream today,
   since assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not manufacture
   candidates for it. The pass now collapses runs on the way out.

**Gates**: vitest 2639 (200 files, +4 tests); tsc clean; scan no defects; `normalization/review.ts --lang ca`
checklist clean; referee **identical** at 4201/5168; corpus diff **2/1841**, every counter 0 → 0, and both
changes are the tens ordinal (`nuɾəntəˈɛnə` → `nuɾəntˈɛnə`, `səʃəntəˈɛ` → `səʃəntˈɛ`).

**The transferable lesson**: this layer's tests covered every ordinal the corpus writes and still missed the
defect, because the corpus's instances and the RULE's branches are different sets. A table-plus-composition
rule needs a pin on the composition, not only on the table.

## Run 4 — 2026-08-01 (the trap, applied to itself)

Writing trap 13 ("pin the rule's branches, not the corpus's instances") into the playbook meant running its
own advice: enumerate what `ordinalWords` produces across a range and read the list, both genders. Thirty
lines of output, no corpus needed — and it found **another defect in the same unexercised branch**:

- `200` read *dos centsè* and `900` *nou centsena*. A PLURAL hundreds stem loses its -s: **dos-centè**,
  **nou-centena**. It cannot be a blanket strip, because a bare `dos` ending a compound keeps its s
  (102 → cent dosè), so the rule targets the `cents` stem only.

Also read and deliberately LEFT: the compound units 1–4 produce *vint i primer* / *trenta primer* rather
than the *vint-i-unè* / *trenta-unè* the IEC prefers. Both forms are attested in Catalan, the corpus contains
no compound ordinal with a 1–4 unit, and choosing between them is a sourcing question, not a bug — so it is
recorded here rather than guessed at (playbook: do not bulk-invent language data).

**Gates**: vitest 2639, tsc clean, review checklist clean, referee identical (4201/5168), corpus diff
**0/1841** — no corpus utterance reaches this branch, which is exactly why the enumeration was needed.
