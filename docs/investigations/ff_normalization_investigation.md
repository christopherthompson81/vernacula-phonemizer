# Fula (ff) normalization investigation (#562)

Chronological record. Baseline worktree: `~/Programming/tmp/ff-base` (pinned at the commit the work
started from). Working branch: `norm-ff-562`.

## Run 1 — 2026-08-01

**Setup**: referee baseline `folded backbone: 1424/2000 (71.2%)` identical in the worktree baseline.
Baseline emitted from `~/Programming/tmp/ff-base` → `/tmp/ff.base` (1500 utterances).

**Corpus shape** (1,500 unique ff_sn utterances — a FLEURS English translation into Fula, heavily
English-influenced loanwords: miliyon, biliyon, kilometre, miles, hour):
- **`Nst`/`Nth`/`Nrd` Latin ordinals** ×17 (1st, 16th, 15th, 4th, 190th, 17th) — read *goo st* / *sappo
  e jeegom th* (the suffix as a bare word). NOTE: this is ENGLISH ordinal notation (English FLEURS
  translation), unlike Welsh's Nfed. The corpus writes English `1st`/`16th`.
- **comma-thousands** ×23 (2,243, 100,000, 5,000,000, 3,000) — the TOKEN `\d+` splits these on the
  comma. + **dot-decimals** (1.5, 1.2, 3.50, 2.3, 12.8) — read as two numbers with a dot pause.
- **clocks** ×15 — `1:15 a.m.`, `11:29`, `11:00nje`, `9:30 fajiri`, `0230 UTC`, `8:30 p.m.`,
  `15.00 UTC`, `07:19 a.m.`, `09:19p.m. GMT`. NOTE `11:00nje` (a glued suffix) and `0230 UTC` (24h).
- **era markers** ×4 — `1000B.C.` → *ujundere b. tʃ.* (B.C. letter-spelled).
- **rates** ×6 — `160km/h`, `480 km/h`, `133m/s`, `300mph`, `40 mph`, `64kph`, `105 miles per hour`.
  The corpus also writes "miles per hour" in English!
- **units** ×18 — 5mm, 35mm, 3136mm2, 12.8km, 20 km, 360km, 2-3km.
- **currency** ×8 — `US$11,000`, `$22,500`, `$2.3`, `AUD$45`, `¥2,500`, `¥130,000`, `£27`, `uS$14.7`.
- **percent** ×4 — 88%, 93%, 80%, 3% (the tier's "y cant" — Fula reads the number then a pause).
- **ranges/scores** ×11 — `7-2`, `5-3`, `1995-96`, `1644-1912`, `2-3km`, `1469-1539`.
- **signs** — `4×4` (arithmetic), `&amp;` (HTML entity).
- **initialisms** ×102 — MRI, OHA, REM, ACMA, U.S., H5N1, A1GP, iPhone, GPS, USA, NASA.
- **degrees** ×1 — `30°C`.
- **fractions** ×1 — `1/5 inch`.
- **roman** — Elizabeth II (postposed cardinal, shared pass).

**KEY DEFECTS from the probe**:
- `1st` → *goo st*; `16th` → *sappo e jeegom th* (ordinal suffix as a word).
- `2,243` → *ɗiɗi, teemedde...* (comma → pause). All comma-thousands break.
- `1:15 a.m.` → colon pause + [a . m .]; `9:30` → pause; `0230 UTC` → "teemedde ɗiɗi e cappanɗe tati uttʃ".
- `1000B.C.` → [b. tʃ.].
- `160km/h` → "...km h" (rate raw).
- `US$11,000` → *us sappo e goo, meere* (currency prefix swallowed, comma pause).
- `¥2,500` → comma pause (¥ dropped).
- `30°C` → [tʃ] (degree dropped).
- `1/5 inch` → *goo joyi intʃh* (fraction → two numbers).
- `4×4` → *nayi nayi* (× dropped).
- `&amp;` → empty (dropped).
- `MRI` → [mɾi], `OHA` → [oha], `ACMA` → [atʃma], `U.S.` → [u.s.] (clusters/letter-spelled wrongly).
- `H5N1` → *h joyi n goo* (digits inside the code read as words).
- `A1GP` → [a goo gp] (digits read as words, GP cluster).

**GOOD already**: plain years (1300, 2010), `2.243`→ no wait — comma-thousands broken; simple numbers
(300, 40), `105 miles per hour` (English text), roman numerals (II → ɗiɗi), `iPhone` (English word).

**Next**: write `src/languages/fula/normalize.ts`, wire into `text()`.

## Run 2 — 2026-08-01 (implementation)

`src/languages/fula/normalize.ts` landed on `norm-ff-562`. Steps, in order:
1) HTML entities (&amp; → e)
1b) currency prefixes (AUD$ → dollar Awstraliya, US$/uS$ → dollar Amerik)
2) era markers (1000B.C. → ɓawo)
3) dotted capital runs (U.S., George W. Bush)
4) `Nst`/`Nth`/`Nrd`/`Nnd` ORDINALS — the corpus's English ordinal digits read as the FULA ordinal
   (cardinal + -aɓal on the last element, gootal suppletive for 1). STEM_ORD table for the compositor's
   unit/tens words; the corpus's 1st/16th/190th verified.
5) ranges/scores → "hakkunde" (between)
5b) glued clock suffix (11:00nje → the -nje is a separate word)
6) clocks in the COLON form, a.m./p.m. → fajiri/kikiiɗe; the trailing marker captured WITHOUT eating
   the space (the Welsh clock-glue trap)
6b) clocks in the DOT form before a timezone (15.00 UTC)
7) version dots and dot-decimals → "tere" (point), fraction digit-by-digit; units claimed with the word
   (12.8km → kilometre)
7c) comma-decimals → tere (the review's leak guard)
8) fractions (1/5 → goo e joyi)
9) degrees (digiri Celsius/Fahrenheit)
10) rates (km/h, m/s → kilometre e wakkati gootel; mph/kph; the corpus's `16okm/h` TYPO)
11) Ghz → gigahertz
12) signs (+ → e gooto, - → leɓɓa, & → e, × → je, = < > %, and the all-eight classes)
13) initialisms (MRI → ma ra i, H5N1 → ha joyi na goo, U.S. → u sa)

**Engine wiring** (fula.ts): `text()` = `assembleClauses(SYMBOLS(normalizeFula(input)), TOKEN, …)`. The
TOKEN gained comma-thousands + dot-decimals AND kept the Adlam digit range (the `\d` class is ASCII-only
without the explicit `\u{1E950}-\u{1E959}` — the Adlam equivalence test caught it). Added the tier:
percent "tere", currency (dollar/euro/yen/pound), units (kilometre/metre/kilogram/milimeta/santimeta),
unitPer "e wakkati gootel", rateDenominators h→wakkati, s→sahaawa.

**Gates**:
- scan: no defects (DROP 13 → 0; REDUNDANT currency ×2 notes — AUD$/US$ now say "dollar", read the notes)
- tsc: clean
- vitest: 2653 passed (5 new ff normalization tests)
- referee: 1424/2000 (71.2%) — IDENTICAL to the worktree baseline
- corpus diff: 161/1500 (10.7%) changed, every change READ and verified an improvement (57 initialism,
  22 comma-thousands, 17 misc — H5N1/U.S./units, 15 dot-decimal, 14 ordinal, 9 clock, 8 range,
  6 currency/percent, 5 rate, 4 unit, 2 degree/fraction/amp, 1 era, 1 sign)
- normalization-review --lang ff: checklist clean

**Notes**: the review probes `5 000` (space-grouped, corpus-absent — Fula groups with commas) reads
"joyi meere". The `H5N1` normalize output keeps the digits raw (ha5na1) but the TOKEN reads them as
words in the IPA — a probe artifact that does not affect the corpus.

## Run 3 — 2026-08-01 (re-review against the playbook traps)

The parent asked for a re-review with `docs/normalization_playbook.md` in mind. Two real defects found
by probing the adversarial neighbour (trap 8), both in forms the corpus happens not to exercise:

- **Ghz glue (the version-dot ordering)**: the dot rule converted `2.4` → "2 tere nayi" (words), and the
  step-11 Ghz rule expected a DIGIT after "tere", so `2.4Ghz` read *ɗiɗi tere nayiGhz* — the Ghz glued
  and unexpanded. Same shape as the Welsh/Azerbaijani "wordify-then-claim" ordering (trap 14): the Ghz
  claim now runs BEFORE the dot rule on the raw digits. The Fula corpus has no Ghz (verified — it was a
  probe form), so this is defensive, but it is now correct.
- **Decimal percent leak**: `3.5%` read *tati tere joyi%* — the `%` survived after a decimal because the
  bare-digit percent rule missed the word-form number. The percent rule now claims the word-form too
  (3.5% → tati tere joyi tere).

**Trap 9 cleanup**: the glued-clock-suffix rule matched `nje|nde|ni|na` but the corpus has ONLY `11:00nje`;
the -na/-ni/-nde alternatives are unattested guard branches and were removed. Also dropped a redundant
duplicate `US$` rule.

**Verified non-issues**: the case-insensitive ordinal digits (16TH, 1ST, 190TH); the fractions 2/3, 3/4,
1/2, 3¾, 2½; 30°F and bare 30°; the minus-vs-range guard (-5 → leɓɓa, 5-10 → hakkunde, -5°C); the
sports-time 4:42.30 (colon pause + decimal — the clock guard keeps it unclaimed); the comma-decimal vs
comma-thousands (12,5/12,50 → tere, 1,400/5,000,000 → thousands); the currency prefixes (US$11,000 i
$22,500, AUD$45, £27, ¥2,500); UN reads as the word, REM/US/USA letter-spell.

**Post-fix gates**: corpus diff 161/1500 (10.7%) — byte-identical to the pre-review run (no regression,
the fixes touch only corpus-absent forms); 2653 tests; referee 71.2% unchanged; scan no defects; review
checklist clean.
