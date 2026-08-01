# Afrikaans (af) normalization investigation (#562)

Chronological record. Baseline worktree: `~/Programming/tmp/af-base` (pinned at the commit the work
started from). Working branch: `norm-af-562`.

## Run 1 — 2026-07-31

**Setup**: baseline emitted from `~/Programming/tmp/af-base` via
`npx tsx tools/normalization-corpus-diff.ts emit --lang af --corpus af_za --out /tmp/af.base`;
identical to `/tmp/af.before` (main tree). 1236 utterances.

**Corpus shape** (1,236 unique af_za utterances, FLEURS — the mined corpus is the guide):
- **decimals**: 26 — `12.8`, `2.3`, `3.7`, `2,243`, `9,000` … Afrikaans in this corpus uses the
  ENGLISH convention: DOT decimal, COMMA thousands (`2,243`, `9,000`, `1,000`, `17,500`, `2,220`,
  `2,207`). The mined hard-set confirms: "Sewe punte agter, is Johnson tweede met 2,243" is a score.
- **grouped**: 21 — comma-thousands (`1,000`, `17,500`, `9,000`) AND space-thousands (`3 000 myl`,
  `55 000 vate`, `3 850 km²`, `VS$11 000`, `22 500`).
- **clock**: 12 — `11:20`, `11:00`, `10:00vm`, `9:30 vm`, `8:30 n.m.`, `10:08 n.m.`, `15.00 GUT`,
  `0230 UTC`, plus racing times `4:41.30`, `2:11:60`, `1:09:02`.
- **ordinal-latin**: 3 — `11de Hussars`, `5de gekeurde`, plus `190ste` in signs. Afrikaans writes
  ordinals as digit + hyphen + suffix: `11de`, `15de`, `9e`, `19e`, `20e`, `190ste`, `5de`.
- **units**: `35 mm`, `1600 km`, `220 km`, `12 km`, `2-3 km`, `km²`, `mm2`, `3136mm2`.
- **rates**: `480 km/h`, `133 m/s`, `300 mph`, `160 km/h`, `35-40mph`, `56-64 km/h`, `40 m.p.u
  (64 km/h)`, `600Mbit/s`. **m.p.u** = myl per uur (mph in Afrikaans!).
- **percent**: 4 — `93%`, `88%`, `3%`, `80%`.
- **currency**: 6 — `$1000`, `$2.3 biljoen`, `U$14.7 biljoen`, `VS$11 000`, `$22 500`, `£27 miljoen`,
  `¥2 500`, `¥130 000`, `¥7 000`.
- **era-marker**: 7 — `v. C.` / `v.C.` / `V.C.` (voor Christus = BC), `d.i.` (dit is = i.e.), `n.m.`
  (namiddag = PM), `vm` (voormiddag = AM).
- **dotted**: 13 — `V.S.` (Verenigde State = US), `m.p.u`, `Dr.`, `Co.`, `v.C.`, `n.m.`, `GUT`.
- **fractions**: 1 — `5 mm (1/5 duim)`.
- **signs**: 12 — `+30°C`, `90 ° F`, `$`, `&amp;` (HTML-escaped ampersand!), `7's rugby`
  (possessive apostrophe after digit), `U$`, `VS$`.
- **roman**: 3 — `Wêreld Oorlog I`, `Wêreld Oorlog II` (cardinal, English-style — no ordinal policy).
- **initialism**: 94 — UK, SUV, FBI, ACTA, BBP, AOL, IM, RSPCA, ABC, UW, VN, VSA, DNA, ATS, MIP,
  JAS, UTC, U-bote, Xinhua, GPS.
- **letter-name**: 26 — `A(H5N1)`, `U-bote`, `Super-G`.
- **exponent**: 1 — `km²`. **ampersand**: 2 — `B&amp;B` (HTML entity!), `Qatar Airways &amp;`.

**Next**: probe the current engine, then write normalize.ts.

## Run 2 — 2026-07-31

**Implementation landed** on `norm-af-562`. `normalize.ts` steps, in order (each coupling stated in the file):
0) HTML ampersand decode (`&amp;` → ` & `); 0b) the ń indefinite article (`ń` → en, the `'n` variant)
1) era markers and multi-dot abbrevs (v.C./vC/V.C. → voor Christus, d.i. → dit is, n.C. → na Christus)
2) dotted capital runs (V.S. → VS)
3) single-dot abbrevs (Dr → Dokter, n.m. → namiddag, m.p.u → myl per uur — the keys carry DOTS and are
   regex-escaped; a bare-key branch covers the undotted `m.p.u`, restricted to dotted keys so `dr` can
   never misfire inside "Dromaeosauridae")
4) ordinals (`Ne/Nde/Nste` → ordinalWord; the Dutch-style table + -ste from 20 up)
5) clock (colon + dot forms, vm/nm → voormiddag/namiddag, 4-digit military time, sports-time guard,
   dimension guard `3.50-meter` is not a clock)
6) comma-grouped thousands (17,500 → 17500)
7) version dots (`802.11n` → "punt", `Figuur 1.1`); decimals are left for the TOKEN's `\d+\.\d+`
   (emits "komma" in the number path) so the symbol tier still sees $2.3
8) Mbit/s rate
9) regnal ordinals (`Wêreld Oorlog II` → tweede Wêreldoorlog, targeted at the only corpus phrase)
10) degrees (grade Celsius/Fahrenheit)
11) signs (+ → plus, true minus → minus with a range guard, & → en with letter-named B&B, = < > × ÷)
12) fractions (1/5 → een vyfde, 1/2 → een half)
13) initialisms (letter names aa/bee/see…; UK/VN/VSA/VS/AOL letter-spelled; REM/COVID/FIFA/NATO/OPEC/
    UNESCO/AIDS as words; GPS letter-spelled)

**Engine wiring** (afrikaans.ts): `text()` = `assembleClauses(normalizeAfrikaansInitialisms(SYMBOLS(normalizeAfrikaans(input))), TOKEN, …)`. TOKEN swallows `\d+\.\d+` (decimal) and `\d{1,3}(?:,\d{3})+` (grouping), emitting "komma" in the number path. The initialism pass is re-applied AFTER the tier because its currency nouns carry caps (U$/VS$ → "VS-dollar" → vee-es-dollar). SYMBOLS: percent persent, currency dollar/pond/jen/VS-dollar, units km/cm/mm/kg/mi/mph, rates per uur/sekonde, exponent "vierkante" before, magnitudes miljoen/miljard/biljoen.

**Gates, all green**:
- scan: no defects (DROP 12 → 0)
- tsc: clean
- vitest: 2599 passed (200 files) — 13 afrikaans tests
- referee: folded backbone 1658/2220 (74.7%) — IDENTICAL to the worktree baseline
- corpus diff: 169/1236 (13.7%) changed, every sample-tier change READ and verified an improvement
- normalization-review: checklist clean (including the sign classes and the new spelling→g2p gate)

**Key corrections found while diffing**:
- the abbrev keys carry literal dots (m.p.u) → must be regex-escaped; the alternation order made `dr`
  match the start of "Dromaeosauridae" (fixed by restricting the bare-key branch to dotted keys)
- the `[a-zà-ÿ]` TOKEN class (copied from Dutch) excluded `ł`/`ń` → foreign names split; widened to `\p{L}`
- the dot-clock claimed `3.50-meter` (a dimension) → hyphen guard added
- decimals must NOT be rewritten to "komma" text in normalize (it broke $2.3 biljoen adjacency for the
  tier) — the TOKEN emits "komma" instead, and only VERSION dots are claimed as "punt"
- the review tool's "spelling → g2p" gate (added in #590) is satisfied by emitting
  `phonemizeWord("komma")`

## Run 3 — 2026-07-31 (PR #591 review pass)

**Question**: which of these rules fire on text the corpus contains but the hard-set does not, and which
fire on text the corpus does NOT contain? Probed ~30 adversarial shapes, then re-ran every gate.

**Seven defects found, all fixed in this PR. Corpus counts measured, not estimated:**

1. **The indefinite article read as a bare `n` in 591 of 732 instances.** `phonemizeWord` recognises two
   spellings of `'n` (U+0027, U+2019); the corpus writes it **588× as `‘n` (U+2018, the LEFT quote)**, 137×
   as `'n`, 4× as `’n` and 3× as `ń`. So Afrikaans's commonest word came out `n` instead of `[ə]` —
   `‘n meter` → *n miətər*. The layer added a rule for the 3-instance `ń` variant (and mapped it to *en*
   [ɛn], contradicting its own comment saying [ə]) while the 588-instance variant went unnoticed. All four
   spellings now fold onto the canonical `'n` in step 0b. **411/1236 utterances change on this alone.**
2. **The era marker ate the indefinite article.** `n\.?\s?C\.?` — every dot optional — matched `'n C…`, so
   `'n Chinese skip` read *'na Christushinese skip*. Zero corpus instances of "na Christus" exist; the rule
   with no evidence of its own was destroying the commonest word in the language. All four era patterns are
   now dot-bound or letter-adjacent, which is exactly what the four BC instances are written as
   (`v. C.`, `v.C.`, `V.C.`, `vC`/`VC`).
3. **The dot-clock claimed decimals.** In this corpus the dot IS the decimal point, so `H.MM` and `N.NN`
   are the same string. An hour/minute range check read `6.34 duim` as *ses vier en dertig* (a live corpus
   instance), and only a hyphen guard saved `3.50-meter`. The corpus's single dot-clock is `15.00 GUT`, so
   the dot form is now claimed ONLY before a timezone or AM/PM marker.
4. **The sports-time guard did not hold.** `(?![:\d])` passes a following `.`, so `4:41.30` (corpus) read
   as a clock plus a stranded `.30`. Now `(?![:.]?\d)` — a bare `.` must still be allowed, since a clause
   can end on a clock.
5. **The AM/PM marker landed between hour and minutes**: `9:30 vm` (corpus) → *nege voormiddag dertig*.
   Invisible in the tested `10:00vm`, whose zero minutes are dropped.
6. **`Wêreldoorlog` matched 2 of its 5 corpus instances.** The rule keyed on the two-word spelling and on a
   digit; the corpus writes the noun as one word 2× and the shared roman pass never converts a lone `I`, so
   `Wêreldoorlog II` stayed cardinal and both `… Oorlog I` read as the stray letter *i*.
7. **The ordinal class was lowercase-only** (`11De` → *elf de*). Zero corpus instances; the suffix is
   orthography, not a lowercase convention.

**Gates after the fixes**: vitest 2604 passed (200 files, +5 tests); tsc clean; scan no defects;
`normalization-review --lang af` fully clean; referee **byte-identical** (wikipron 1658/2220); corpus diff
vs the branch head **411/1236 (33.3%)** with all counters 0 → 0. Every one of the **15 distinct change
shapes** in that diff was classified and matches a fix above — 587 `n`→`ə`, 3 `ɛn`→`ə`, 4 Wêreldoorlog, and
one each for the sports time, the vm placement and `6.34`.

**The pattern worth carrying forward**: five of the seven had live corpus instances that the corpus DIFF
could not surface, because the baseline was already wrong in the same place (the article) or the shape sits
in a sample the diff reports as "changed, improved" without the reader checking the neighbouring reading.
The corpus diff answers "did I change anything unexpectedly", never "is what I left alone correct".
